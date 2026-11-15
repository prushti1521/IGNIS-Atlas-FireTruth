"""
IGNIS Atlas — FireTruth Cross-Language Numerical Parity Test
Module: tests/test_cross_language.py
Validates that Python calculations match the shared specification in tests/fixtures/shared_calibration_fixture.json.
"""

import json
import os
import numpy as np
import pandas as pd
import pytest

from science.aggregate import (
    project_wgs84_to_equal_area,
    snap_to_equal_area_grid,
    compute_sensor_cell_days
)


@pytest.fixture
def shared_fixture():
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "shared_calibration_fixture.json")
    assert os.path.exists(fixture_path), f"Shared fixture not found at {fixture_path}"
    with open(fixture_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_spatial_projection_cross_language_parity(shared_fixture):
    """Verifies that Python project_wgs84_to_equal_area matches the shared fixture coordinates."""
    for sample in shared_fixture["spatial_projection_samples"]:
        x, y = project_wgs84_to_equal_area(sample["lat"], sample["lon"])
        assert abs(x - sample["expected_x_km"]) < 0.5, f"{sample['name']}: x coordinate mismatch: {x} vs {sample['expected_x_km']}"
        assert abs(y - sample["expected_y_km"]) < 0.5, f"{sample['name']}: y coordinate mismatch: {y} vs {sample['expected_y_km']}"

        cell = snap_to_equal_area_grid(sample["lat"], sample["lon"], cell_size_km=shared_fixture["metadata"]["cell_size_km"])
        assert cell.cell_id == sample["expected_cell_id"], f"{sample['name']}: cell_id mismatch: {cell.cell_id} vs {sample['expected_cell_id']}"


def test_cell_day_deduplication_cross_language_parity(shared_fixture):
    """Verifies that multiple hotspot points in the same cell and date deduplicate to 1 cell-day."""
    for case in shared_fixture["cell_day_deduplication_cases"]:
        df = pd.DataFrame(case["hotspots"])
        result = compute_sensor_cell_days(df, cell_size_km=shared_fixture["metadata"]["cell_size_km"])
        row = result.iloc[0]
        assert row["raw_hotspot_count"] == case["expected_raw_hotspots"]
        assert row["active_cell_days"] == case["expected_cell_days"]


def test_calibration_translation_cases(shared_fixture):
    """Verifies linear empirical translation calculations match."""
    for case in shared_fixture["calibration_translation_cases"]:
        pred = case["modis_cell_days"] * case["alpha"]
        assert abs(pred - case["expected_b1_hsfai"]) < 1e-4

