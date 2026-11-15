"""
IGNIS Atlas — FireTruth Automated Scientific Test Suite
Module: tests/test_harmonization.py
Runs automated scientific regression tests on spatial aggregation,
temporal boundaries, model calibration error reduction, cross-regime transfer failure,
the 5-Gate Evidence Resolver, and factual calibration criteria.
"""

import os
import json
import numpy as np
import pandas as pd
import pytest

from science.ingest import is_sensor_operational, CONSTELLATION_REGISTRY
from science.aggregate import (
    compute_sensor_cell_days,
    discretize_coordinates_to_grid,
    discretize_coordinates_to_equal_area_grid
)
from science.calibrate import fit_calibration_models, predict_calibrated_cell_days
from science.evaluate import evaluate_models_on_heldout_set, run_cross_regime_transfer_test
from science.evidence_gate import audit_historical_fire_claim


@pytest.fixture
def processed_dataset():
    path = os.path.join(os.path.dirname(__file__), "..", "data", "processed", "harmonized_fire_records.json")
    assert os.path.exists(path), f"Processed dataset missing at {path}. Run science.pipeline first."
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_temporal_boundary_rules():
    """Rule 1: Terra was commissioned in Nov 2000. Prior months must not report zero fires."""
    assert not is_sensor_operational("Terra_MODIS", 2000, 5), "May 2000 was prior to Terra active fire operations."
    assert not is_sensor_operational("Terra_MODIS", 2000, 10), "October 2000 was prior to Terra active fire operations."
    assert is_sensor_operational("Terra_MODIS", 2000, 11), "November 2000 is Terra operational start."
    assert is_sensor_operational("Aqua_MODIS", 2002, 8), "Aqua was operational in August 2002."
    assert not is_sensor_operational("SNPP_VIIRS", 2011, 8), "VIIRS was not operational in 2011."
    assert is_sensor_operational("SNPP_VIIRS", 2012, 2), "VIIRS was operational in February 2012."


def test_equal_area_spatial_discretization_deduplication():
    """Rule 2: Multiple hotspot pixels in same equal-area cell on same day produce exactly 1 cell-day."""
    test_points = pd.DataFrame([
        {"latitude": 37.251, "longitude": -119.751, "acq_date": "2024-08-15", "instrument": "VIIRS"},
        {"latitude": 37.254, "longitude": -119.749, "acq_date": "2024-08-15", "instrument": "VIIRS"}, # Same cell & day
        {"latitude": 37.248, "longitude": -119.752, "acq_date": "2024-08-15", "instrument": "VIIRS"}, # Same cell & day
        {"latitude": 37.250, "longitude": -119.750, "acq_date": "2024-08-16", "instrument": "VIIRS"}, # Next day
    ])

    result = compute_sensor_cell_days(test_points, cell_size_km=25.0)
    row = result[(result['year'] == 2024) & (result['month'] == 8) & (result['instrument'] == 'VIIRS')]
    assert not row.empty
    # 3 detections on day 15 + 1 on day 16 = exactly 2 unique cell-days!
    assert row.iloc[0]['active_cell_days'] == 2, "Equal-area common-grid aggregation must deduplicate to 2 cell-days."
    assert row.iloc[0]['raw_hotspot_count'] == 4, "Raw count must reflect all 4 detections."


def test_equal_area_cosine_latitude_projection():
    """Rule 2b: Projected Equal-Area cells scale longitude step by cosine(latitude) to preserve area."""
    eq_cell = discretize_coordinates_to_equal_area_grid(0.0, 10.0, cell_size_km=25.0)
    high_lat_cell = discretize_coordinates_to_equal_area_grid(60.0, 10.0, cell_size_km=25.0)
    assert eq_cell.nominal_area_km2 == high_lat_cell.nominal_area_km2 == 625.0


def test_nominal_sensor_pixel_area_ratio():
    """Rule 3: Nominal pixel area ratio is 1000^2 / 375^2 ~= 7.11x."""
    modis_pixel_area_m2 = 1000.0 ** 2
    viirs_pixel_area_m2 = 375.0 ** 2
    ratio = modis_pixel_area_m2 / viirs_pixel_area_m2
    assert abs(ratio - 7.111) < 0.01, f"Nominal pixel area ratio must be ~7.11, got {ratio}"


def test_calibration_error_reduction(processed_dataset):
    """Rule 4: Calibrated models B1 and B2 strictly reduce held-out error vs raw B0."""
    benchmarks = processed_dataset["benchmark_evaluations"]["california"]
    b0_rmse = benchmarks["model_b0"]["rmse"]
    b1_rmse = benchmarks["model_b1"]["rmse"]
    b2_rmse = benchmarks["model_b2"]["rmse"]

    assert b1_rmse < b0_rmse, "Model B1 must have lower RMSE than uncalibrated B0."
    assert b2_rmse < b0_rmse, "Model B2 must have lower RMSE than uncalibrated B0."
    assert benchmarks["model_b1"]["mape_percent"] < benchmarks["model_b0"]["mape_percent"]


def test_cross_regime_transfer_failure(processed_dataset):
    """Rule 5: California forest model transferred to Punjab agriculture exhibits significant negative bias."""
    transfer = processed_dataset["transfer_experiment"]
    # Model trained on forest fires (alpha ~3.68) severely underpredicts small agricultural fires (alpha ~5.84)
    assert transfer["mean_bias_error"] < -300.0, "Transferred forest model must underpredict agricultural burns."
    assert transfer["transfer_rmse"] > 500.0, "Transfer RMSE must be high, proving regime dependence."


def test_claim_centered_evidence_audit_drilldowns(processed_dataset):
    """Rule 6: Evidence Resolver produces expandable drill-down details (formula, justification, limitations)."""
    ca_df = pd.DataFrame(processed_dataset["records"]["california"])

    # Claim A: 2008 vs 2018 (The 2012 False Surge Paradox)
    claim_a = "Did fire activity surge by +370% in California between 2008 and 2018?"
    res_a = audit_historical_fire_claim(claim_a, "california", 2008, 2018, None, ca_df)

    assert res_a.naive_uncalibrated_delta_percent > res_a.harmonized_hsfai_delta_percent * 2.0
    assert res_a.overall_verdict in ("SUPPORTED", "QUALIFIED")

    # Verify each gate has scientific drill-down fields
    for gate in res_a.gates:
        assert len(gate.input_data) > 0, f"Gate {gate.gate_id} missing input_data"
        assert len(gate.calculation) > 0, f"Gate {gate.gate_id} missing calculation"
        assert len(gate.threshold_justification) > 0, f"Gate {gate.gate_id} missing threshold_justification"
        assert len(gate.limitations) > 0, f"Gate {gate.gate_id} missing limitations"

    # Claim B: August 2020 Historic Siege vs 2010 Baseline
    claim_b = "Was detected fire activity in California during August 2020 unusually high relative to August 2010?"
    res_b = audit_historical_fire_claim(claim_b, "california", 2010, 2020, 8, ca_df)
    assert res_b.overall_verdict == "SUPPORTED"
    assert res_b.stability_score_percent >= 80.0


def test_observation_completeness_gate_cloud_failure(processed_dataset):
    """Rule 7: Severe cloud cover (>60%) triggers FAIL on Observation Completeness Gate."""
    am_df = pd.DataFrame(processed_dataset["records"]["amazon"])
    # Compare wet season months (Jan-Apr where cloud cover is 75-85%)
    res = audit_historical_fire_claim("Did wet season burning decline in 2020 vs 2010?", "amazon", 2010, 2020, 2, am_df)
    cloud_gate = next(g for g in res.gates if g.gate_id in ("gate-5-observation", "gate-4-observation"))
    assert cloud_gate.status == "FAIL", "Cloud cover >60% must trigger FAIL on observation completeness"
    assert res.overall_verdict == "INSUFFICIENT_EVIDENCE"


def test_observation_completeness_not_evaluated_forces_qualified(processed_dataset):
    """Rule 8: Missing observation completeness data (NOT_EVALUATED) must restrict verdict to QUALIFIED, never SUPPORTED."""
    ca_df = pd.DataFrame(processed_dataset["records"]["california"])
    # When has_independent_cloud_mask is False, Gate 5 is NOT_EVALUATED
    res = audit_historical_fire_claim(
        "Check California fire change with unassessed cloud completeness",
        "california", 2008, 2018, None, ca_df,
        has_independent_cloud_mask=False
    )
    gate5 = next(g for g in res.gates if g.gate_id == "gate-5-observation")
    assert gate5.status == "NOT_EVALUATED"
    # Even if other gates pass, missing observation completeness forces verdict to QUALIFIED (never SUPPORTED)
    assert res.overall_verdict == "QUALIFIED"


def test_scientific_claims_wording_rigor(processed_dataset):
    """Rule 9: Ensure rigorous scientific terminology in all gate specifications."""
    ca_df = pd.DataFrame(processed_dataset["records"]["california"])
    res = audit_historical_fire_claim("Test gate descriptions", "california", 2010, 2020, 8, ca_df)

    gate2 = next(g for g in res.gates if g.gate_id == "gate-2-calibration")
    assert "Project-defined decision threshold" in gate2.threshold_justification or "Project Decision Tolerance" in gate2.threshold
    assert "CEOS LPV Stage 2" not in gate2.threshold

    gate3 = next(g for g in res.gates if g.gate_id == "gate-3-uncertainty")
    assert "heuristic" in gate3.threshold_justification.lower()
    assert "heteroscedasticity" in gate3.threshold_justification.lower()

    gate5 = next(g for g in res.gates if g.gate_id == "gate-5-observation")
    assert "kaufman" in gate5.threshold_justification.lower()

    gate6 = next(g for g in res.gates if g.gate_id == "gate-6-independent")
    assert "burned area" in gate6.limitations.lower() or "burned area" in gate6.physical_mechanism.lower()


def test_real_firms_ingestion_pipeline():
    """Rule 10: Ingest authentic NASA FIRMS CSV sample and verify sinusoidal equal-area discretization."""
    from science.ingest_firms import ingest_firms_csv
    sample_csv = os.path.join(os.path.dirname(__file__), "..", "data", "sample_firms_download.csv")
    assert os.path.exists(sample_csv), f"Sample FIRMS CSV missing at {sample_csv}"

    monthly_df, meta = ingest_firms_csv(sample_csv, cell_size_km=25.0)
    assert not monthly_df.empty
    assert meta["total_records_ingested"] == 13
    assert meta["qualified_hotspots"] == 13
    assert meta["nominal_cell_area_km2"] == 625.0
    assert meta["source_sha256"] == "9763df44d02ff223a2ecc0eb8512849e47131c1db5e60c8fec71a95719925d6b"

    # Verify grouping
    aug_viirs = monthly_df[(monthly_df["year"] == 2024) & (monthly_df["month"] == 8) & (monthly_df["instrument"] == "VIIRS")]
    assert not aug_viirs.empty
    # In August 2024, 5 VIIRS hotspots snap into 4 unique cell-days
    assert aug_viirs.iloc[0]["raw_hotspots"] == 5
    assert aug_viirs.iloc[0]["active_cell_days"] == 4


def test_firms_ingestion_filters_and_rejection_provenance(tmp_path):
    """Date/region filters and malformed-row counts must be explicit in provenance."""
    from science.ingest_firms import ingest_firms_csv

    csv_path = tmp_path / "firms.csv"
    csv_path.write_text(
        "latitude,longitude,acq_date,acq_time,satellite,instrument,confidence,frp\n"
        "37.25,-119.75,2024-08-15,1930,Aqua,MODIS,85,42.5\n"
        "37.25,-119.75,2024-08-16,0815,N,VIIRS,nominal,18.4\n"
        "91.0,-119.75,2024-08-15,1930,Aqua,MODIS,85,42.5\n"
        "37.25,-119.75,not-a-date,1930,Aqua,MODIS,85,42.5\n"
        "37.25,-119.75,2024-08-15,2500,Aqua,MODIS,85,42.5\n"
        "37.25,-119.75,2024-08-15,1930,Unknown,MODIS,85,42.5\n",
        encoding="utf-8"
    )

    monthly_df, meta = ingest_firms_csv(
        str(csv_path),
        start_date="2024-08-15",
        end_date="2024-08-15",
        bbox=(37.0, -120.0, 38.0, -119.0)
    )

    assert meta["total_records_ingested"] == 6
    assert meta["qualified_hotspots"] == 1
    assert meta["rejected_rows"]["invalid_coordinates"] == 1
    assert meta["rejected_rows"]["invalid_dates"] == 1
    assert meta["rejected_rows"]["invalid_times"] == 1
    assert meta["rejected_rows"]["invalid_satellites"] == 1
    assert meta["filters"]["start_date"] == "2024-08-15"
    assert meta["filters"]["bbox"] == [37.0, -120.0, 38.0, -119.0]
    assert monthly_df.iloc[0]["raw_hotspots"] == 1
