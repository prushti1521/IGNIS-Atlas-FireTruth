r"""
IGNIS Atlas — FireTruth Scientific Pipeline
Module: science/calibrate.py
Description: Empirical cross-sensor calibration fitting during the overlap period (2012-2025).
Models:
    B0: Raw Uncorrected (\hat{A}_V = A_M)
    B1: Proportional Scaling (\hat{A}_V = \alpha * A_M)
    B2: Regularized Seasonal Calibration (\hat{A}_V = \alpha_k * A_M) with L2 shrinkage
"""

from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple
import json
import numpy as np
import pandas as pd


@dataclass
class CalibrationModelArtifact:
    model_id: str
    model_name: str
    equation: str
    global_alpha: float
    seasonal_alphas: Dict[int, float]
    train_years: Tuple[int, int]
    regularization_lambda: float


def fit_calibration_models(
    monthly_df: pd.DataFrame,
    train_start: int = 2012,
    train_end: int = 2018,
    regularization_lambda: float = 0.35
) -> Dict[str, CalibrationModelArtifact]:
    """
    Fits B0, B1, and B2 calibration models on the designated training period.
    Input DataFrame must have columns: ['year', 'month', 'modis_cell_days', 'viirs_cell_days']
    """
    # Filter training set within the concurrent overlap era
    train_mask = (monthly_df['year'] >= train_start) & (monthly_df['year'] <= train_end)
    train_data = monthly_df[train_mask].dropna(subset=['modis_cell_days', 'viirs_cell_days']).copy()
    
    # Filter only months where active fire detections occurred
    train_data = train_data[(train_data['modis_cell_days'] > 0) & (train_data['viirs_cell_days'] > 0)]

    if train_data.empty:
        raise ValueError(f"No valid training overlap data found between {train_start} and {train_end}.")

    x = train_data['modis_cell_days'].values
    y = train_data['viirs_cell_days'].values

    # ==========================================
    # MODEL B0: Raw Baseline (alpha = 1.0)
    # ==========================================
    b0 = CalibrationModelArtifact(
        model_id="B0",
        model_name="B0 — Raw Common-Grid Count",
        equation="Â_{V,m} = A_{M,m}",
        global_alpha=1.0,
        seasonal_alphas={m: 1.0 for m in range(1, 13)},
        train_years=(train_start, train_end),
        regularization_lambda=0.0
    )

    # ==========================================
    # MODEL B1: Proportional Scaling through origin
    # OLS through origin: \alpha = sum(x * y) / sum(x^2)
    # ==========================================
    sum_xy = np.sum(x * y)
    sum_xx = np.sum(x * x)
    b1_alpha = float(np.round(sum_xy / sum_xx, 4)) if sum_xx > 0 else 1.0

    b1 = CalibrationModelArtifact(
        model_id="B1",
        model_name="B1 — Empirical Proportional Scaling",
        equation=f"Â_{{V,m}} = {b1_alpha} × A_{{M,m}}",
        global_alpha=b1_alpha,
        seasonal_alphas={m: b1_alpha for m in range(1, 13)},
        train_years=(train_start, train_end),
        regularization_lambda=0.0
    )

    # ==========================================
    # MODEL B2: Regularized Seasonal Calibration
    # Computes month-specific alphas with L2 shrinkage toward global B1 alpha
    # ==========================================
    seasonal_alphas: Dict[int, float] = {}
    for m in range(1, 13):
        m_subset = train_data[train_data['month'] == m]
        if not m_subset.empty and np.sum(m_subset['modis_cell_days'] ** 2) > 0:
            m_x = m_subset['modis_cell_days'].values
            m_y = m_subset['viirs_cell_days'].values
            raw_m_alpha = np.sum(m_x * m_y) / np.sum(m_x ** 2)
            # L2 Shrinkage toward global alpha:
            # \alpha_k = (1 - \lambda) * \alpha_k^{raw} + \lambda * \alpha_{global}
            regularized_alpha = (1.0 - regularization_lambda) * raw_m_alpha + regularization_lambda * b1_alpha
            seasonal_alphas[m] = float(np.round(regularized_alpha, 4))
        else:
            seasonal_alphas[m] = b1_alpha

    b2 = CalibrationModelArtifact(
        model_id="B2",
        model_name="B2 — Regularized Seasonal Calibration",
        equation="Â_{V,m} = α_k × A_{M,m} (with L2 shrinkage toward global α)",
        global_alpha=b1_alpha,
        seasonal_alphas=seasonal_alphas,
        train_years=(train_start, train_end),
        regularization_lambda=regularization_lambda
    )

    return {"B0": b0, "B1": b1, "B2": b2}


def predict_calibrated_cell_days(
    modis_cell_days: float,
    month: int,
    model: CalibrationModelArtifact
) -> float:
    """Computes predicted VIIRS-equivalent cell-days using the trained model artifact."""
    if model.model_id == "B0":
        return modis_cell_days
    elif model.model_id == "B1":
        return modis_cell_days * model.global_alpha
    else: # B2
        alpha_k = model.seasonal_alphas.get(month, model.global_alpha)
        return modis_cell_days * alpha_k
