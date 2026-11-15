"""Run the authentic California-to-Pacific-Northwest transfer experiment.

The destination data must already exist locally under the supplied directory.
This module never downloads data and never refits the zero-shot California
models.  VIIRS is treated as a comparison sensor, not ground truth.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import pandas as pd

from science.aggregate import compute_sensor_cell_days


START_DATE = "2018-01-01"
TRAIN_END = "2020-06-30"
HOLDOUT_START = "2020-07-01"
END_DATE = "2022-12-31"
BOUNDING_BOX = "-124.8,41.9,-116.4,49.1"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_sensor_files(root: Path, source: str) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    frames = []
    manifests = []
    for manifest_path in sorted(root.glob(f"{source}_*.manifest.json")):
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifests.append({
            "file": str(manifest_path),
            "sha256": sha256_file(manifest_path),
            "source": manifest["source"],
            "area": manifest["area"],
            "start_date": manifest["start_date"],
            "end_date": manifest["end_date"],
            "complete": manifest["complete"],
            "request_count": len(manifest["requests"]),
            "failed_count": sum(
                request["status"] == "failed" for request in manifest["requests"]
            ),
        })
    for csv_path in sorted(root.glob(f"{source}_*.csv")):
        frames.append(pd.read_csv(csv_path))
    if not frames:
        raise FileNotFoundError(f"No {source} CSV files found in {root}")
    frame = pd.concat(frames, ignore_index=True)
    frame["acq_date"] = pd.to_datetime(frame["acq_date"], errors="coerce")
    frame = frame[
        frame["acq_date"].between(START_DATE, END_DATE)
        & frame["latitude"].between(41.9, 49.1)
        & frame["longitude"].between(-124.8, -116.4)
    ].copy()
    frame["instrument"] = "MODIS" if source == "MODIS_SP" else "VIIRS"
    return frame, manifests


def aggregate_destination(root: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    modis, modis_manifests = load_sensor_files(root, "MODIS_SP")
    viirs, viirs_manifests = load_sensor_files(root, "VIIRS_SNPP_SP")
    modis_monthly = compute_sensor_cell_days(
        modis, cell_size_km=25, confidence_policy="nominal_high"
    ).rename(columns={
        "active_cell_days": "modis_cell_days",
        "raw_hotspot_count": "modis_raw_hotspots",
    })
    viirs_monthly = compute_sensor_cell_days(
        viirs, cell_size_km=25, confidence_policy="nominal_high"
    ).rename(columns={
        "active_cell_days": "viirs_cell_days",
        "raw_hotspot_count": "viirs_raw_hotspots",
    })
    modis_monthly = modis_monthly[["year", "month", "modis_cell_days", "modis_raw_hotspots"]]
    viirs_monthly = viirs_monthly[["year", "month", "viirs_cell_days", "viirs_raw_hotspots"]]
    monthly = modis_monthly.merge(viirs_monthly, on=["year", "month"], how="outer")
    monthly = monthly.sort_values(["year", "month"]).reset_index(drop=True)
    return monthly, {
        "modis_raw_rows_in_period": int(len(modis)),
        "viirs_raw_rows_in_period": int(len(viirs)),
        "modis_manifests": modis_manifests,
        "viirs_manifests": viirs_manifests,
        "confidence_policy": "nominal_high",
        "grid": "25 km authalic sinusoidal equal-area, lon_0=0",
    }


def metrics(actual: pd.Series, predicted: pd.Series) -> dict[str, Any]:
    error = predicted - actual
    return {
        "mae": float(error.abs().mean()),
        "rmse": float((error.pow(2).mean()) ** 0.5),
        "bias": float(error.mean()),
        "sample_size_months": int(len(actual)),
    }


def residual_summary(
    actual: pd.Series,
    predicted: pd.Series,
    label: str,
) -> dict[str, Any]:
    error = predicted - actual
    return {
        "model": label,
        "mean_signed_bias": float(error.mean()),
        "mean_absolute_error": float(error.abs().mean()),
        "max_absolute_error": float(error.abs().max()),
        "largest_error_index": int(error.abs().idxmax()),
        "positive_error_months": int((error > 0).sum()),
        "negative_error_months": int((error < 0).sum()),
    }


def fit_local(train: pd.DataFrame) -> tuple[float, dict[int, float]]:
    x = train["modis_cell_days"].to_numpy(dtype=float)
    y = train["viirs_cell_days"].to_numpy(dtype=float)
    denominator = float((x * x).sum())
    if denominator == 0:
        raise ValueError("Destination training MODIS activity has zero sum of squares")
    alpha = float((x * y).sum() / denominator)
    seasonal = {}
    for month in range(1, 13):
        subset = train[train["month"] == month]
        month_x = subset["modis_cell_days"].to_numpy(dtype=float)
        month_y = subset["viirs_cell_days"].to_numpy(dtype=float)
        month_denominator = float((month_x * month_x).sum())
        raw = float((month_x * month_y).sum() / month_denominator) if month_denominator else alpha
        seasonal[month] = float(0.65 * raw + 0.35 * alpha)
    return alpha, seasonal


def evaluate_track(
    monthly: pd.DataFrame,
    alpha: float,
    seasonal: dict[int, float],
    label: str,
) -> dict[str, Any]:
    holdout = monthly[
        monthly["month_index"].between(
            pd.Timestamp(HOLDOUT_START).to_period("M"),
            pd.Timestamp(END_DATE).to_period("M"),
        )
        & monthly["modis_cell_days"].notna()
        & monthly["viirs_cell_days"].notna()
    ].copy()
    if holdout.empty:
        return {"track": label, "status": "NOT_EVALUATED", "reason": "No complete holdout months."}
    holdout["b0"] = holdout["modis_cell_days"]
    holdout["b1"] = holdout["modis_cell_days"] * alpha
    holdout["b2"] = holdout.apply(
        lambda row: row["modis_cell_days"] * seasonal.get(int(row["month"]), alpha),
        axis=1,
    )
    monthly_residuals = [
        {
            "year": int(row.year),
            "month": int(row.month),
            "modis_cell_days": float(row.modis_cell_days),
            "viirs_cell_days": float(row.viirs_cell_days),
            "b0_prediction": float(row.b0),
            "b1_prediction": float(row.b1),
            "b2_prediction": float(row.b2),
            "b0_error": float(row.b0 - row.viirs_cell_days),
            "b1_error": float(row.b1 - row.viirs_cell_days),
            "b2_error": float(row.b2 - row.viirs_cell_days),
            "training_observation": False,
        }
        for row in holdout.itertuples()
    ]
    return {
        "track": label,
        "status": "EVALUATED",
        "holdout_months": int(len(holdout)),
        "models": {
            model: metrics(holdout["viirs_cell_days"], holdout[model])
            for model in ("b0", "b1", "b2")
        },
        "monthly_residuals": monthly_residuals,
    }


def build_transfer(
    destination_root: Path,
    california_artifact: Path,
) -> dict[str, Any]:
    monthly, provenance = aggregate_destination(destination_root)
    monthly["month_index"] = pd.to_datetime(
        monthly[["year", "month"]].assign(day=1)
    ).dt.to_period("M")
    complete = monthly[
        monthly["modis_cell_days"].notna()
        & monthly["viirs_cell_days"].notna()
    ]
    train = complete[
        complete["month_index"].between(
            pd.Timestamp(START_DATE).to_period("M"),
            pd.Timestamp(TRAIN_END).to_period("M"),
        )
        & (complete["modis_cell_days"] > 0)
        & (complete["viirs_cell_days"] > 0)
    ].copy()
    local_alpha, local_seasonal = fit_local(train)
    california = json.loads(california_artifact.read_text(encoding="utf-8-sig"))
    frozen = california["calibration"]
    frozen_alpha = float(frozen["b1"]["alpha"])
    frozen_seasonal = {int(k): float(v) for k, v in frozen["b2"]["seasonal_factors"].items()}
    zero_shot = evaluate_track(
        monthly, frozen_alpha, frozen_seasonal, "California -> Pacific Northwest: Zero-Shot Transfer"
    )
    local = evaluate_track(
        monthly, local_alpha, local_seasonal, "Pacific Northwest: Local Calibration Benchmark"
    )
    holdout = pd.DataFrame(zero_shot["monthly_residuals"])
    model_metrics = {
        model: metrics(holdout["viirs_cell_days"], holdout[f"{model}_prediction"])
        for model in ("b0", "b1", "b2")
    }
    largest_error_rows = holdout.assign(
        abs_b2_error=holdout["b2_error"].abs(),
        abs_b1_error=holdout["b1_error"].abs(),
    ).sort_values("abs_b2_error", ascending=False)
    largest_month = largest_error_rows.iloc[0]
    without_extreme = holdout.index != largest_month.name
    sensitivity = {
        "excluded_month": f"{int(largest_month.year):04d}-{int(largest_month.month):02d}",
        "criterion": "Largest absolute California zero-shot B2 monthly residual",
        "models": {
            model: metrics(
                holdout.loc[without_extreme, "viirs_cell_days"],
                holdout.loc[without_extreme, f"{model}_prediction"],
            )
            for model in ("b0", "b1", "b2")
        },
    }
    seasonal_residuals = [
        {
            "month": month,
            "zero_shot_b1_bias": float(group["b1_error"].mean()),
            "zero_shot_b2_bias": float(group["b2_error"].mean()),
            "local_b2_bias": float(
                pd.DataFrame(local["monthly_residuals"])
                .loc[
                    pd.DataFrame(local["monthly_residuals"])["month"] == month,
                    "b2_error",
                ].mean()
            ),
            "sample_size": int(len(group)),
        }
        for month, group in holdout.groupby("month")
    ]
    local_b2_errors = pd.DataFrame(local["monthly_residuals"])["b2_error"].abs()
    largest_local_error_share = float(
        local_b2_errors.max() / local_b2_errors.sum()
    ) if local_b2_errors.sum() else 0.0
    failure_cases = [
        {
            "year": int(row.year),
            "month": int(row.month),
            "period": f"{int(row.year):04d}-{int(row.month):02d}",
            "zero_shot_b0_error": float(row.b0_error),
            "zero_shot_b1_error": float(row.b1_error),
            "zero_shot_b2_error": float(row.b2_error),
            "b1_worse_than_b0": bool(abs(row.b1_error) > abs(row.b0_error)),
            "b2_worse_than_b0": bool(abs(row.b2_error) > abs(row.b0_error)),
            "reason": "Observed residual magnitude; no causal attribution inferred.",
        }
        for row in largest_error_rows.head(5).itertuples()
    ]
    return {
        "artifact_version": "1.0.0",
        "study_region": "Oregon and Washington, USA",
        "boundary": {
            "type": "bounding_box",
            "west": -124.8,
            "south": 41.9,
            "east": -116.4,
            "north": 49.1,
            "definition": BOUNDING_BOX,
        },
        "provenance": provenance,
        "source_products": {
            "modis": "MODIS_SP",
            "viirs": "VIIRS_SNPP_SP",
            "reference_role": "comparison sensor; not ground truth",
        },
        "evaluation": {
            "training_period": [START_DATE[:7], TRAIN_END[:7]],
            "holdout_period": [HOLDOUT_START[:7], END_DATE[:7]],
            "reference_sensor": "VIIRS",
            "complete_overlap_months": int(len(complete)),
            "training_months": int(len(train)),
            "training_rows_used_for_local_fit": int(len(train)),
            "holdout_rows_excluded_from_local_fit": int(len(complete) - len(train)),
            "fit_rule": "local parameters use training months only; holdout is evaluation-only",
        },
        "frozen_california_models": {
            "source_artifact": str(california_artifact),
            "source_sha256": sha256_file(california_artifact),
            "b1_alpha": frozen_alpha,
            "b2_seasonal_factors": frozen_seasonal,
        },
        "local_training_models": {
            "b1_alpha": local_alpha,
            "b2_seasonal_factors": local_seasonal,
        },
        "monthly_observations": [
            {
                "year": int(row.year),
                "month": int(row.month),
                "period": f"{int(row.year):04d}-{int(row.month):02d}",
                "modis_cell_days": float(row.modis_cell_days),
                "viirs_cell_days": float(row.viirs_cell_days),
                "training_observation": bool(row.month_index <= pd.Timestamp(TRAIN_END).to_period("M")),
            }
            for row in complete.itertuples()
        ],
        "zero_shot_transfer": zero_shot,
        "local_calibration_benchmark": local,
        "failure_analysis": {
            "zero_shot_metrics_recomputed": model_metrics,
            "largest_absolute_error_months": failure_cases,
            "seasonal_residuals": seasonal_residuals,
            "months_where_zero_shot_b1_worse_than_b0": [
                f"{int(row.year):04d}-{int(row.month):02d}"
                for row in holdout[holdout["b1_error"].abs() > holdout["b0_error"].abs()].itertuples()
            ],
            "months_where_zero_shot_b2_worse_than_b0": [
                f"{int(row.year):04d}-{int(row.month):02d}"
                for row in holdout[holdout["b2_error"].abs() > holdout["b0_error"].abs()].itertuples()
            ],
            "extreme_month_sensitivity": sensitivity,
            "local_b2_largest_month_absolute_error_share": largest_local_error_share,
            "interpretation": [
                "MAE and RMSE weight errors differently; RMSE is more sensitive to extreme residuals.",
                "Failure lists describe measured residuals only and do not establish causal mechanisms.",
            ],
        },
        "limitations": [
            "VIIRS is a comparison sensor, not ground truth.",
            "Active cell-days are not fires, burned area, or complete occurrence.",
            "The boundary is an acquisition and analysis bounding box, not a state polygon.",
            "The first MODIS manifest records an interrupted run; the retry manifest completes the tail.",
            "The rectangular study boundary is not a state polygon and should not be described as complete Oregon/Washington coverage.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build authentic Phase 3 transfer artifact.")
    parser.add_argument("--destination-root", type=Path, required=True)
    parser.add_argument("--california-artifact", type=Path, default=Path("src/data/nasaObservationalData.json"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = build_transfer(args.destination_root, args.california_artifact)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"Transfer artifact written to {args.output}")
    print(f"Zero-shot status: {result['zero_shot_transfer']['status']}")
    print(f"Local benchmark status: {result['local_calibration_benchmark']['status']}")


if __name__ == "__main__":
    main()
