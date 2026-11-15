import json
from pathlib import Path

import pandas as pd

from science.phase3_transfer import fit_local, metrics


ROOT = Path(__file__).parents[1]
ARTIFACT_PATH = ROOT / "public" / "data" / "crossRegionTransfer.json"


def test_local_fit_uses_only_training_rows():
    training = pd.DataFrame(
        [
            {"year": 2018, "month": 1, "modis_cell_days": 10, "viirs_cell_days": 20},
            {"year": 2019, "month": 1, "modis_cell_days": 10, "viirs_cell_days": 20},
        ]
    )
    alpha, seasonal = fit_local(training)
    assert alpha == 2.0
    assert seasonal[1] == 2.0


def test_metrics_are_signed_and_holdout_sized():
    actual = pd.Series([10.0, 20.0])
    predicted = pd.Series([12.0, 16.0])
    result = metrics(actual, predicted)
    assert result["sample_size_months"] == 2
    assert result["mae"] == 3.0
    assert result["bias"] == -1.0


def test_browser_artifact_proves_temporal_separation_and_comparison_role():
    artifact = json.loads(ARTIFACT_PATH.read_text(encoding="utf-8"))
    assert len(artifact["monthly_observations"]) == 60
    assert artifact["evaluation"]["training_rows_used_for_local_fit"] == 30
    assert artifact["evaluation"]["holdout_rows_excluded_from_local_fit"] == 30
    assert "training months only" in artifact["evaluation"]["fit_rule"]
    assert artifact["source_products"]["reference_role"] == "comparison sensor; not ground truth"
    assert all(
        row["training_observation"] == (row["period"] <= "2020-06")
        for row in artifact["monthly_observations"]
    )


def test_reproduced_headline_metrics_remain_frozen():
    artifact = json.loads(ARTIFACT_PATH.read_text(encoding="utf-8"))
    models = artifact["failure_analysis"]["zero_shot_metrics_recomputed"]
    assert round(models["b0"]["rmse"], 2) == 389.21
    assert round(models["b1"]["rmse"], 2) == 395.50
    assert round(models["b2"]["rmse"], 2) == 400.95
    assert round(artifact["local_calibration_benchmark"]["models"]["b2"]["rmse"], 2) == 132.75
