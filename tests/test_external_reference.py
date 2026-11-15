import json
from pathlib import Path

import pytest

from science.validate_external_reference import build_validation


REFERENCE = Path("data/reference/calfire_2020/burn_areas_2020.geojson")
ARTIFACT = Path("public/data/nasaSpatialDisagreement.json")
BROWSER_REFERENCE = Path("public/data/california2020Reference.json")


def test_browser_reference_artifact_has_provenance_and_expected_semantics():
    result = json.loads(BROWSER_REFERENCE.read_text(encoding="utf-8"))
    assert result["reference"]["publisher"].startswith("California Department")
    assert result["reference"]["feature_count_california"] == 504
    assert result["method"]["temporal_evaluation"].startswith("NOT_EVALUATED")
    assert result["method"]["harmonized_spatial_prediction"].startswith("NOT_EVALUATED")
    assert result["display_perimeters"]["geometry_semantics"].startswith("Display-only")


@pytest.mark.skipif(not REFERENCE.exists(), reason="Local CAL FIRE reference snapshot is not available")
def test_calfire_reference_is_final_perimeter_only():
    result = build_validation(REFERENCE, ARTIFACT, 0.01)
    assert result["reference"]["feature_count_total"] == 505
    assert result["reference"]["feature_count_california"] == 504
    assert result["record_audit"]["year_values"] == ["2020"]
    assert result["record_audit"]["non_2020_objectids"] == []
    assert result["record_audit"]["duplicate_objectid_count"] == 0
    assert len(result["record_audit"]["excluded_out_of_region"]) == 1
    assert result["record_audit"]["invalid_california_geometry_count"] == 50
    assert result["record_audit"]["empty_after_repair_objectids"] == []
    assert "Final fire perimeters" in result["reference"]["coverage_semantics"]
    assert result["method"]["temporal_evaluation"].startswith("NOT_EVALUATED")
    assert result["method"]["harmonized_spatial_prediction"].startswith("NOT_EVALUATED")


@pytest.mark.skipif(not REFERENCE.exists(), reason="Local CAL FIRE reference snapshot is not available")
def test_external_metrics_are_derived_from_cell_sets():
    result = build_validation(REFERENCE, ARTIFACT, 0.01)
    for sensor in ("modis", "viirs", "sensor_union"):
        metrics = result["metrics"][sensor]
        assert metrics["predicted_cells"] >= metrics["intersection_cells"]
        assert metrics["reference_cells"] >= metrics["intersection_cells"]
        assert 0 <= metrics["iou"] <= 1


@pytest.mark.skipif(not REFERENCE.exists(), reason="Local CAL FIRE reference snapshot is not available")
def test_threshold_sensitivity_is_complete_and_monotonic():
    result = build_validation(REFERENCE, ARTIFACT, 0.01)
    sensitivity = result["threshold_sensitivity"]
    assert [row["intersection_threshold"] for row in sensitivity] == [0.005, 0.01, 0.02, 0.05]
    counts = [row["reference_cells"] for row in sensitivity]
    assert counts == sorted(counts, reverse=True)
    assert all(0 <= row["sensor_union"]["iou"] <= 1 for row in sensitivity)
