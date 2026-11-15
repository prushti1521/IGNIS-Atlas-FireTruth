"""
IGNIS Atlas — FireTruth Scientific Pipeline
Module: science/normalize.py
Description: Authoritative schema normalization and validation for NASA FIRMS standard active fire products.
Standardizes MODIS (Collection 6.1) and VIIRS (Collection 2) archives into a unified, validated representation.
Strictly separates REAL observations from SYNTHETIC fixtures.
"""

from dataclasses import dataclass
from typing import Dict, List, Literal, Optional, Tuple, Union
import datetime
import numpy as np
import pandas as pd


DataStatus = Literal["REAL", "SYNTHETIC", "UNAVAILABLE"]
ConfidenceClass = Literal["low", "nominal", "high"]


@dataclass
class NormalizedHotspot:
    latitude: float
    longitude: float
    brightness_kelvin: float
    scan_km: float
    track_km: float
    acq_date: str # YYYY-MM-DD
    acq_time: str # HHMM
    satellite: str
    instrument: Literal["MODIS", "VIIRS"]
    confidence_class: ConfidenceClass
    raw_confidence: Union[int, str]
    frp_mw: float
    daynight: Literal["D", "N"]
    source_filename: str
    product_id: str
    processing_version: str
    data_status: DataStatus


@dataclass
class IngestionValidationSummary:
    total_raw_rows: int
    valid_rows: int
    invalid_coords_dropped: int
    invalid_dates_dropped: int
    duplicates_dropped: int
    data_status: DataStatus
    detected_sensors: List[str]
    min_date: Optional[str]
    max_date: Optional[str]


def parse_modis_confidence(raw_val: Union[int, float, str]) -> ConfidenceClass:
    """
    Converts MODIS 0-100% confidence into standard categorical confidence class:
    - Low: 0 - 29%
    - Nominal: 30 - 79% (Standard Science)
    - High: 80 - 100%
    """
    try:
        val = float(raw_val)
        if val >= 80.0:
            return "high"
        elif val >= 30.0:
            return "nominal"
        return "low"
    except (ValueError, TypeError):
        return "nominal"


def parse_viirs_confidence(raw_val: str) -> ConfidenceClass:
    """
    Converts VIIRS categorical confidence indicator ('l', 'n', 'h' or 'low', 'nominal', 'high')
    into standard confidence class.
    """
    s = str(raw_val).strip().lower()
    if s in ("h", "high"):
        return "high"
    elif s in ("l", "low"):
        return "low"
    return "nominal"


def normalize_firms_dataframe(
    df: pd.DataFrame,
    source_filename: str = "nasa_firms_archive.csv",
    data_status: DataStatus = "REAL"
) -> Tuple[pd.DataFrame, IngestionValidationSummary]:
    """
    Validates and normalizes raw NASA FIRMS CSV records across MODIS and VIIRS schemas.
    Applies strict data hygiene:
    - Validates coordinate bounds (-90 <= lat <= 90, -180 <= lon <= 180)
    - Validates acquisition dates and timestamps
    - Deduplicates redundant observations
    - Harmonizes brightness, scan/track geometry, and confidence metrics
    """
    total_raw = len(df)
    if total_raw == 0:
        return pd.DataFrame(), IngestionValidationSummary(
            total_raw_rows=0, valid_rows=0, invalid_coords_dropped=0,
            invalid_dates_dropped=0, duplicates_dropped=0,
            data_status=data_status, detected_sensors=[], min_date=None, max_date=None
        )

    clean_df = df.copy()

    # Normalize column names (strip whitespace, lowercase)
    clean_df.columns = [str(c).strip().lower() for c in clean_df.columns]

    # Required core columns check
    req_cols = ["latitude", "longitude", "acq_date"]
    for col in req_cols:
        if col not in clean_df.columns:
            raise ValueError(f"NASA FIRMS schema error: Missing required column '{col}'")

    # 1. Coordinate Validation
    clean_df["latitude"] = pd.to_numeric(clean_df["latitude"], errors="coerce")
    clean_df["longitude"] = pd.to_numeric(clean_df["longitude"], errors="coerce")
    valid_coords = (
        clean_df["latitude"].notna() &
        clean_df["longitude"].notna() &
        (clean_df["latitude"] >= -90.0) & (clean_df["latitude"] <= 90.0) &
        (clean_df["longitude"] >= -180.0) & (clean_df["longitude"] <= 180.0)
    )
    invalid_coords_count = int((~valid_coords).sum())
    clean_df = clean_df[valid_coords].copy()

    # 2. Date and Time Validation
    clean_df["acq_date"] = pd.to_datetime(clean_df["acq_date"], errors="coerce")
    valid_dates = clean_df["acq_date"].notna()
    invalid_dates_count = int((~valid_dates).sum())
    clean_df = clean_df[valid_dates].copy()
    clean_df["acq_date_str"] = clean_df["acq_date"].dt.strftime("%Y-%m-%d")

    if "acq_time" in clean_df.columns:
        clean_df["acq_time"] = clean_df["acq_time"].astype(str).str.zfill(4)
    else:
        clean_df["acq_time"] = "0000"

    # 3. Detect Instrument (MODIS vs VIIRS)
    if "instrument" in clean_df.columns:
        clean_df["instrument_standard"] = clean_df["instrument"].astype(str).str.upper()
    elif "bright_ti4" in clean_df.columns or "scan" in clean_df.columns and clean_df["scan"].median() < 0.6:
        clean_df["instrument_standard"] = "VIIRS"
    else:
        clean_df["instrument_standard"] = "MODIS"

    # 4. Brightness Temperature Normalization (Kelvin)
    if "bright_ti4" in clean_df.columns: # VIIRS I-band (375m)
        clean_df["brightness_kelvin"] = pd.to_numeric(clean_df["bright_ti4"], errors="coerce").fillna(
            pd.to_numeric(clean_df.get("brightness", 300.0), errors="coerce")
        )
    elif "brightness" in clean_df.columns: # MODIS Channel 21/22
        clean_df["brightness_kelvin"] = pd.to_numeric(clean_df["brightness"], errors="coerce").fillna(300.0)
    else:
        clean_df["brightness_kelvin"] = 300.0

    # 5. Scan & Track Pixel Dimensions
    clean_df["scan_km"] = pd.to_numeric(clean_df.get("scan", 1.0), errors="coerce").fillna(1.0)
    clean_df["track_km"] = pd.to_numeric(clean_df.get("track", 1.0), errors="coerce").fillna(1.0)

    # 6. Confidence Normalization
    conf_classes = []
    raw_confs = clean_df.get("confidence", "nominal")
    for raw_val, inst in zip(raw_confs, clean_df["instrument_standard"]):
        if inst == "MODIS":
            conf_classes.append(parse_modis_confidence(raw_val))
        else:
            conf_classes.append(parse_viirs_confidence(raw_val))
    clean_df["confidence_class"] = conf_classes

    # 7. Fire Radiative Power (MW)
    clean_df["frp_mw"] = pd.to_numeric(clean_df.get("frp", 0.0), errors="coerce").clip(lower=0.0).fillna(0.0)

    # 8. Day/Night Flag
    if "daynight" in clean_df.columns:
        clean_df["daynight"] = clean_df["daynight"].astype(str).str.upper().apply(lambda x: "D" if x == "D" else "N")
    else:
        clean_df["daynight"] = "D"

    # 9. Satellite & Metadata
    clean_df["satellite"] = clean_df.get("satellite", "Terra").astype(str)
    clean_df["version"] = clean_df.get("version", "Standard").astype(str)
    clean_df["source_filename"] = source_filename
    clean_df["data_status"] = data_status

    # 10. Deduplication (same location, time, sensor, instrument)
    dedup_cols = ["latitude", "longitude", "acq_date_str", "acq_time", "satellite", "instrument_standard"]
    pre_dedup = len(clean_df)
    clean_df = clean_df.drop_duplicates(subset=dedup_cols).reset_index(drop=True)
    duplicates_count = pre_dedup - len(clean_df)

    min_date = clean_df["acq_date_str"].min() if not clean_df.empty else None
    max_date = clean_df["acq_date_str"].max() if not clean_df.empty else None
    sensors = clean_df["instrument_standard"].unique().tolist()

    summary = IngestionValidationSummary(
        total_raw_rows=total_raw,
        valid_rows=len(clean_df),
        invalid_coords_dropped=invalid_coords_count,
        invalid_dates_dropped=invalid_dates_count,
        duplicates_dropped=duplicates_count,
        data_status=data_status,
        detected_sensors=sensors,
        min_date=min_date,
        max_date=max_date
    )

    return clean_df, summary


def compute_monthly_data_availability_matrix(
    normalized_df: pd.DataFrame,
    start_year: int = 2000,
    end_year: int = 2025
) -> pd.DataFrame:
    """
    Computes a transparent Observation Availability Matrix per instrument, year, and month.
    Distinguishes:
    - AVAILABLE: Active observations ingested.
    - UNOBSERVED_PRE_LAUNCH: Satellite was not yet operational.
    - MISSING_DATA: Operational instrument has no data records for month (potential observation hiatus).
    """
    matrix_rows = []
    instruments = ["MODIS", "VIIRS"]

    if normalized_df.empty:
        obs_counts = {}
    else:
        df = normalized_df.copy()
        df["year"] = pd.to_datetime(df["acq_date_str"]).dt.year
        df["month"] = pd.to_datetime(df["acq_date_str"]).dt.month
        obs_counts = df.groupby(["instrument_standard", "year", "month"]).size().to_dict()

    for inst in instruments:
        for year in range(start_year, end_year + 1):
            for month in range(1, 13):
                # Commissioning dates
                if inst == "MODIS" and (year < 2000 or (year == 2000 and month < 11)):
                    status = "UNOBSERVED_PRE_LAUNCH"
                    count = 0
                elif inst == "VIIRS" and year < 2012:
                    status = "UNOBSERVED_PRE_LAUNCH"
                    count = 0
                else:
                    count = obs_counts.get((inst, year, month), 0)
                    status = "AVAILABLE" if count > 0 else "ZERO_DETECTIONS_OR_GAP"

                matrix_rows.append({
                    "instrument": inst,
                    "year": year,
                    "month": month,
                    "record_count": count,
                    "status": status
                })

    return pd.DataFrame(matrix_rows)
