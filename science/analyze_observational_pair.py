"""Build a provenance-preserving MODIS/VIIRS observational analysis artifact."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd


def load_processed(path: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    frame = pd.DataFrame(payload.get("monthly_aggregates", []))
    if frame.empty:
        raise ValueError(f"No monthly aggregates found in {path}")
    required = {"year", "month", "active_cell_days", "raw_hotspots", "instrument"}
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"{path} is missing required columns: {sorted(missing)}")
    return frame, payload["provenance"]


def build_artifact(modis_path: Path, viirs_path: Path) -> dict[str, Any]:
    modis, modis_provenance = load_processed(modis_path)
    viirs, viirs_provenance = load_processed(viirs_path)
    modis = modis[modis["instrument"] == "MODIS"].rename(
        columns={
            "active_cell_days": "modis_cell_days",
            "raw_hotspots": "modis_raw_hotspots",
        }
    )
    viirs = viirs[viirs["instrument"] == "VIIRS"].rename(
        columns={
            "active_cell_days": "viirs_cell_days",
            "raw_hotspots": "viirs_raw_hotspots",
        }
    )
    monthly = modis.merge(viirs, on=["year", "month"], how="outer")
    monthly = monthly[[
        "year",
        "month",
        "modis_cell_days",
        "viirs_cell_days",
        "modis_raw_hotspots",
        "viirs_raw_hotspots",
    ]].sort_values(["year", "month"])
    complete_overlap = monthly.dropna(subset=["modis_cell_days", "viirs_cell_days"]).copy()

    evaluation_status = "NOT_EVALUATED"
    status_reason = (
        "A chronological holdout requires at least two complete overlapping "
        "monthly observations; evaluation remains NOT_EVALUATED until that "
        "requirement is met."
    )
    calibration: dict[str, Any] = {
        "status": evaluation_status,
        "reference_sensor": "VIIRS",
        "training_period": None,
        "holdout_period": None,
        "sample_size_months": int(len(complete_overlap)),
        "status_reason": status_reason,
        "b0": None,
        "b1": None,
        "b2": None,
    }

    if len(complete_overlap) >= 2:
        complete_overlap = complete_overlap.sort_values(["year", "month"])
        split = max(1, len(complete_overlap) // 2)
        train = complete_overlap.iloc[:split]
        holdout = complete_overlap.iloc[split:]
        if not holdout.empty and not train.empty:
            x = train["modis_cell_days"].to_numpy(dtype=float)
            y = train["viirs_cell_days"].to_numpy(dtype=float)
            alpha = float((x * y).sum() / (x * x).sum()) if (x * x).sum() else None
            seasonal_factors: dict[int, float] = {}
            if alpha is not None:
                for month in range(1, 13):
                    month_train = train[train["month"] == month]
                    month_x = month_train["modis_cell_days"].to_numpy(dtype=float)
                    month_y = month_train["viirs_cell_days"].to_numpy(dtype=float)
                    denominator = float((month_x * month_x).sum())
                    raw_ratio = float((month_x * month_y).sum() / denominator) if denominator else alpha
                    seasonal_factors[month] = round(0.65 * raw_ratio + 0.35 * alpha, 3)
            predictions = {
                "b0": holdout["modis_cell_days"].to_numpy(dtype=float),
                "b1": holdout["modis_cell_days"].to_numpy(dtype=float) * alpha if alpha is not None else None,
                "b2": (
                    holdout.apply(
                        lambda row: row["modis_cell_days"] * seasonal_factors.get(int(row["month"]), alpha),
                        axis=1,
                    ).to_numpy(dtype=float)
                    if alpha is not None
                    else None
                ),
            }

            def metrics(prediction: Any) -> dict[str, float] | None:
                if prediction is None:
                    return None
                errors = prediction - holdout["viirs_cell_days"].to_numpy(dtype=float)
                return {
                    "mae": float(abs(errors).mean()),
                    "rmse": float((errors ** 2).mean() ** 0.5),
                    "bias": float(errors.mean()),
                    "sample_size_months": int(len(holdout)),
                }

            calibration.update({
                "status": "EVALUATED",
                "status_reason": "Evaluated on complete overlapping months with a chronological holdout.",
                "training_period": [
                    f"{int(train.iloc[0].year)}-{int(train.iloc[0].month):02d}",
                    f"{int(train.iloc[-1].year)}-{int(train.iloc[-1].month):02d}",
                ],
                "holdout_period": [
                    f"{int(holdout.iloc[0].year)}-{int(holdout.iloc[0].month):02d}",
                    f"{int(holdout.iloc[-1].year)}-{int(holdout.iloc[-1].month):02d}",
                ],
                "training_sample_size_months": int(len(train)),
                "holdout_sample_size_months": int(len(holdout)),
                "b0": {"alpha": 1.0, "metrics": metrics(predictions["b0"])},
                "b1": {"alpha": alpha, "metrics": metrics(predictions["b1"])},
                "b2": {
                    "alpha": alpha,
                    "seasonal_factors": seasonal_factors,
                    "shrinkage": {"seasonal_weight": 0.65, "global_weight": 0.35},
                    "metrics": metrics(predictions["b2"]),
                },
            })

    monthly_records = monthly.astype(object).where(pd.notna(monthly), None).to_dict(orient="records")
    return {
        "artifact_version": "1.0.0",
        "data_mode": "NASA_OBSERVATIONAL_LOCAL_SAMPLE",
        "study_region": "California, USA",
        "source_products": {
            "modis": modis_provenance,
            "viirs": viirs_provenance,
        },
        "monthly_observations": monthly_records,
        "overlap_month_count": int(len(complete_overlap)),
        "calibration": calibration,
        "limitations": [
            "These are active-fire detections and cell-days, not confirmed fire events or burned area.",
            "VIIRS is a comparison reference, not ground truth.",
            "Coverage completeness is not established by positive detections alone.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a local observational MODIS/VIIRS analysis artifact.")
    parser.add_argument("--modis", type=Path, required=True)
    parser.add_argument("--viirs", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    artifact = build_artifact(args.modis, args.viirs)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    print(f"[OK] Wrote observational artifact: {args.output}")
    print(f"    Overlap months: {artifact['overlap_month_count']}")
    print(f"    Calibration status: {artifact['calibration']['status']}")


if __name__ == "__main__":
    main()
