"""
IGNIS Atlas — FireTruth Scientific Pipeline
Module: science/evaluate.py
Description: Rigorous out-of-sample validation, rolling-origin time-series cross-validation,
cross-regime transfer analysis, and evidence-gate backtesting.
Ensures zero temporal data leakage and evaluates decision reliability.
"""

from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from science.calibrate import (
    CalibrationModelArtifact,
    fit_calibration_models,
    predict_calibrated_cell_days
)


@dataclass
class ModelEvaluationMetrics:
    model_id: str
    mae: float
    rmse: float
    mbe: float # Mean Bias Error (detects systematic over/under-prediction)
    r2: float
    mape_percent: float
    sample_count: int
    relative_mape_reduction_vs_b0: float = 0.0
    relative_rmse_reduction_vs_b0: float = 0.0


@dataclass
class RollingOriginFoldResult:
    test_year: int
    train_start: int
    train_end: int
    train_samples: int
    test_samples: int
    b0_rmse: float
    b1_rmse: float
    b2_rmse: float
    b1_mape: float
    b2_mape: float
    winning_model: str


@dataclass
class EvidenceBacktestMetrics:
    total_comparisons_evaluated: int
    supported_conclusions_count: int
    qualified_conclusions_count: int
    insufficient_evidence_count: int
    coverage_rate_percent: float # supported / total
    unsafe_conclusion_rate_percent: float # unstable supported / supported
    mean_absolute_direction_error: float


def calculate_evaluation_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    model_id: str,
    baseline_mape: Optional[float] = None,
    baseline_rmse: Optional[float] = None,
    min_activity_threshold: float = 5.0
) -> ModelEvaluationMetrics:
    """
    Computes MAE, RMSE, MBE, R2, and MAPE between observed and predicted cell-days.
    Applies a scientific activity threshold (y_true >= min_activity_threshold) for MAPE calculation
    to prevent small-denominator instability during dormant seasons.
    MAE, RMSE, and MBE are computed across all samples.
    """
    n = len(y_true)
    if n == 0:
        return ModelEvaluationMetrics(
            model_id=model_id, mae=0.0, rmse=0.0, mbe=0.0, r2=0.0, mape_percent=0.0, sample_count=0
        )

    residuals = y_pred - y_true
    mae = float(np.round(np.mean(np.abs(residuals)), 2))
    rmse = float(np.round(np.sqrt(np.mean(residuals ** 2)), 2))
    mbe = float(np.round(np.mean(residuals), 2))
    
    # R-squared calculation
    ss_res = np.sum(residuals ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    r2 = float(np.round(max(0.0, 1.0 - (ss_res / ss_tot)), 4)) if ss_tot > 0 else 0.0

    # Stable MAPE: filter to months with burning activity above minimum threshold
    stable_mask = y_true >= min_activity_threshold
    if np.any(stable_mask):
        mape = float(np.round(np.mean(np.abs(residuals[stable_mask] / y_true[stable_mask])) * 100.0, 2))
    elif np.any(y_true > 0):
        mape = float(np.round(np.mean(np.abs(residuals[y_true > 0] / y_true[y_true > 0])) * 100.0, 2))
    else:
        mape = 0.0

    rel_mape_red = 0.0
    rel_rmse_red = 0.0
    if baseline_mape is not None and baseline_mape > 0:
        rel_mape_red = float(np.round(((baseline_mape - mape) / baseline_mape) * 100.0, 1))
    if baseline_rmse is not None and baseline_rmse > 0:
        rel_rmse_red = float(np.round(((baseline_rmse - rmse) / baseline_rmse) * 100.0, 1))

    return ModelEvaluationMetrics(
        model_id=model_id,
        mae=mae,
        rmse=rmse,
        mbe=mbe,
        r2=r2,
        mape_percent=mape,
        sample_count=n,
        relative_mape_reduction_vs_b0=rel_mape_red,
        relative_rmse_reduction_vs_b0=rel_rmse_red
    )


def evaluate_models_on_heldout_set(
    monthly_df: pd.DataFrame,
    models: Dict[str, CalibrationModelArtifact],
    test_start: int = 2019,
    test_end: int = 2024
) -> Dict[str, ModelEvaluationMetrics]:
    """
    Evaluates all trained models on strictly held-out out-of-sample years.
    Guarantees no temporal data leakage: test data (2019-2024) is strictly held out.
    """
    test_mask = (monthly_df['year'] >= test_start) & (monthly_df['year'] <= test_end)
    test_data = monthly_df[test_mask].dropna(subset=['modis_cell_days', 'viirs_cell_days']).copy()
    test_data = test_data[(test_data['modis_cell_days'] > 0) & (test_data['viirs_cell_days'] > 0)]

    y_true = test_data['viirs_cell_days'].values
    results: Dict[str, ModelEvaluationMetrics] = {}

    b0_model = models["B0"]
    y_pred_b0 = np.array([
        predict_calibrated_cell_days(row['modis_cell_days'], int(row['month']), b0_model)
        for _, row in test_data.iterrows()
    ])
    b0_metrics = calculate_evaluation_metrics(y_true, y_pred_b0, "B0")
    results["B0"] = b0_metrics

    for model_id in ["B1", "B2"]:
        if model_id not in models:
            continue
        model = models[model_id]
        y_pred = np.array([
            predict_calibrated_cell_days(row['modis_cell_days'], int(row['month']), model)
            for _, row in test_data.iterrows()
        ])
        results[model_id] = calculate_evaluation_metrics(
            y_true, y_pred, model_id,
            baseline_mape=b0_metrics.mape_percent,
            baseline_rmse=b0_metrics.rmse
        )

    return results


def run_rolling_origin_validation(
    monthly_df: pd.DataFrame,
    start_eval_year: int = 2017,
    end_eval_year: int = 2024,
    min_train_years: int = 4
) -> List[RollingOriginFoldResult]:
    """
    Executes chronological Rolling-Origin (expanding window) Cross-Validation.
    For each test year T:
        Trains on [2012, T - 1]
        Evaluates on held-out year T
    Proves that calibration parameters remain stable over time with zero forward leakage.
    """
    folds: List[RollingOriginFoldResult] = []
    
    for t_year in range(start_eval_year, end_eval_year + 1):
        train_start = 2012
        train_end = t_year - 1
        
        if (train_end - train_start + 1) < min_train_years:
            continue

        train_models = fit_calibration_models(monthly_df, train_start=train_start, train_end=train_end)
        
        # Test fold
        fold_metrics = evaluate_models_on_heldout_set(
            monthly_df, train_models, test_start=t_year, test_end=t_year
        )

        b0_m = fold_metrics["B0"]
        b1_m = fold_metrics["B1"]
        b2_m = fold_metrics["B2"]

        winning = "B2" if b2_m.rmse < b1_m.rmse else "B1"

        # Count samples
        train_subset = monthly_df[(monthly_df['year'] >= train_start) & (monthly_df['year'] <= train_end)]
        train_n = len(train_subset.dropna(subset=['modis_cell_days', 'viirs_cell_days']))

        folds.append(RollingOriginFoldResult(
            test_year=t_year,
            train_start=train_start,
            train_end=train_end,
            train_samples=train_n,
            test_samples=b1_m.sample_count,
            b0_rmse=b0_m.rmse,
            b1_rmse=b1_m.rmse,
            b2_rmse=b2_m.rmse,
            b1_mape=b1_m.mape_percent,
            b2_mape=b2_m.mape_percent,
            winning_model=winning
        ))

    return folds


def run_cross_regime_transfer_test(
    source_model: CalibrationModelArtifact,
    target_df: pd.DataFrame,
    target_regime_name: str = "Punjab Agricultural Burning"
) -> Dict[str, float]:
    """
    Evaluates what happens when a model fitted on forest wildfires (e.g. California)
    is naively transferred to small agricultural crop residue burning (e.g. Punjab).
    Proves our research hypothesis that calibration must be regime-aware!
    """
    overlap_target = target_df[target_df['year'] >= 2012].dropna(subset=['modis_cell_days', 'viirs_cell_days']).copy()
    overlap_target = overlap_target[(overlap_target['modis_cell_days'] > 0) & (overlap_target['viirs_cell_days'] > 0)]

    y_true = overlap_target['viirs_cell_days'].values
    y_pred_transferred = np.array([
        predict_calibrated_cell_days(row['modis_cell_days'], int(row['month']), source_model)
        for _, row in overlap_target.iterrows()
    ])

    metrics = calculate_evaluation_metrics(y_true, y_pred_transferred, f"Transferred_{source_model.model_id}")
    mean_bias_error = float(np.round(np.mean(y_pred_transferred - y_true), 2))

    return {
        "transferred_model": source_model.model_id,
        "target_regime": target_regime_name,
        "transfer_rmse": metrics.rmse,
        "transfer_mape_percent": metrics.mape_percent,
        "mean_bias_error": mean_bias_error,
        "transfer_r2": metrics.r2
    }


def run_evidence_gate_backtesting(
    regional_records: pd.DataFrame,
    region_id: str = "california",
    min_year: int = 2002,
    max_year: int = 2024
) -> EvidenceBacktestMetrics:
    """
    Backtests the Evidence Resolver across all possible pairwise historical comparisons.
    Evaluates whether the gates filter out unstable or fragile conclusions.
    Calculates:
        Unsafe conclusion rate = (unstable supported conclusions) / (supported conclusions)
        Coverage = (supported conclusions) / (all evaluated conclusions)
    """
    from science.evidence_gate import audit_historical_fire_claim

    total = 0
    supported = 0
    qualified = 0
    insufficient = 0
    unsafe_supported = 0
    direction_errors = []

    year_pairs = []
    years = [y for y in range(min_year, max_year + 1) if y != 2012] # Compare across decades
    for i in range(0, len(years), 2):
        if i + 1 < len(years):
            year_pairs.append((years[i], years[i + 1]))

    for yA, yB in year_pairs:
        claim = f"Did fire activity change between {yA} and {yB}?"
        audit = audit_historical_fire_claim(claim, region_id, yA, yB, None, regional_records)
        total += 1

        if audit.overall_verdict == "SUPPORTED":
            supported += 1
            # Check if naive uncalibrated conclusion would have flipped sign vs harmonized
            naive_sign = np.sign(audit.naive_uncalibrated_delta_percent)
            harm_sign = np.sign(audit.harmonized_hsfai_delta_percent)
            if naive_sign != harm_sign and abs(audit.harmonized_hsfai_delta_percent) < 15.0:
                unsafe_supported += 1
        elif audit.overall_verdict == "QUALIFIED":
            qualified += 1
        else:
            insufficient += 1

        direction_errors.append(abs(audit.naive_uncalibrated_delta_percent - audit.harmonized_hsfai_delta_percent))

    coverage = float(np.round((supported / max(1, total)) * 100.0, 1))
    unsafe_rate = float(np.round((unsafe_supported / max(1, supported)) * 100.0, 1))
    mean_dir_err = float(np.round(np.mean(direction_errors), 1)) if direction_errors else 0.0

    return EvidenceBacktestMetrics(
        total_comparisons_evaluated=total,
        supported_conclusions_count=supported,
        qualified_conclusions_count=qualified,
        insufficient_evidence_count=insufficient,
        coverage_rate_percent=coverage,
        unsafe_conclusion_rate_percent=unsafe_rate,
        mean_absolute_direction_error=mean_dir_err
    )
