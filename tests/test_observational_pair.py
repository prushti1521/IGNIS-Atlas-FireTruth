import json

import pandas as pd

from science.analyze_observational_pair import build_artifact


def write_processed(path, instrument, cell_days, raw_hotspots):
    path.write_text(json.dumps({
        "provenance": {
            "source_file": str(path),
            "source_sha256": f"{instrument.lower()}-hash",
        },
        "monthly_aggregates": [{
            "year": 2020,
            "month": 8,
            "instrument": instrument,
            "active_cell_days": cell_days,
            "raw_hotspots": raw_hotspots,
        }],
    }), encoding="utf-8")


def test_observational_pair_reports_real_counts_and_insufficient_holdout(tmp_path):
    modis = tmp_path / "modis.json"
    viirs = tmp_path / "viirs.json"
    write_processed(modis, "MODIS", 125, 2168)
    write_processed(viirs, "VIIRS", 263, 14033)

    artifact = build_artifact(modis, viirs)

    assert artifact["data_mode"] == "NASA_OBSERVATIONAL_LOCAL_SAMPLE"
    assert artifact["overlap_month_count"] == 1
    assert artifact["monthly_observations"][0]["modis_cell_days"] == 125
    assert artifact["monthly_observations"][0]["viirs_cell_days"] == 263
    assert artifact["calibration"]["status"] == "NOT_EVALUATED"
    assert "holdout" in artifact["calibration"]["status_reason"]


def test_observational_pair_evaluates_b0_b1_and_b2_chronologically(tmp_path):
    modis = tmp_path / "modis.json"
    viirs = tmp_path / "viirs.json"
    records = [
        {"year": 2018, "month": 1, "active_cell_days": 10, "raw_hotspots": 20},
        {"year": 2018, "month": 2, "active_cell_days": 20, "raw_hotspots": 40},
        {"year": 2018, "month": 3, "active_cell_days": 30, "raw_hotspots": 60},
        {"year": 2018, "month": 4, "active_cell_days": 40, "raw_hotspots": 80},
    ]
    write_processed(modis, "MODIS", 0, 0)
    write_processed(viirs, "VIIRS", 0, 0)
    for path, instrument, multiplier in (
        (modis, "MODIS", 1),
        (viirs, "VIIRS", 3),
    ):
        payload = json.loads(path.read_text(encoding="utf-8"))
        payload["monthly_aggregates"] = [
            {**record, "instrument": instrument,
             "active_cell_days": record["active_cell_days"] * multiplier,
             "raw_hotspots": record["raw_hotspots"] * multiplier}
            for record in records
        ]
        path.write_text(json.dumps(payload), encoding="utf-8")

    artifact = build_artifact(modis, viirs)

    calibration = artifact["calibration"]
    assert calibration["status"] == "EVALUATED"
    assert calibration["training_sample_size_months"] == 2
    assert calibration["holdout_sample_size_months"] == 2
    assert calibration["b0"]["metrics"]["sample_size_months"] == 2
    assert calibration["b1"]["alpha"] == 3.0
    assert calibration["b2"]["seasonal_factors"]
