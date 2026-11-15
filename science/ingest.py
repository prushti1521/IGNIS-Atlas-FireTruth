"""
IGNIS Atlas — FireTruth Scientific Pipeline
Module: science/ingest.py
Description: Authority ingestion routines for NASA FIRMS standard active fire products.
Preserves full satellite instrument geometry, acquisition timestamps, confidence classifications,
and observation boundaries.
"""

from dataclasses import dataclass
from typing import Dict, List, Literal, Optional, Tuple
import datetime
import numpy as np
import pandas as pd


@dataclass
class SatelliteObservationMetadata:
    sensor: Literal["MODIS", "VIIRS"]
    satellite: Literal["Terra", "Aqua", "S-NPP", "NOAA-20"]
    resolution_nadir_m: int
    operational_start_date: datetime.date
    operational_end_date: Optional[datetime.date]
    firms_collection: str
    doi: str


# Authoritative NASA Sensor Constellation Chronology
CONSTELLATION_REGISTRY: Dict[str, SatelliteObservationMetadata] = {
    "Terra_MODIS": SatelliteObservationMetadata(
        sensor="MODIS",
        satellite="Terra",
        resolution_nadir_m=1000,
        operational_start_date=datetime.date(2000, 11, 1), # Operational active fire data start
        operational_end_date=None,
        firms_collection="Collection 6.1 Standard Science Quality",
        doi="10.5067/FIRMS/MODIS/MCD14DL.NRT.0061"
    ),
    "Aqua_MODIS": SatelliteObservationMetadata(
        sensor="MODIS",
        satellite="Aqua",
        resolution_nadir_m=1000,
        operational_start_date=datetime.date(2002, 7, 4), # Aqua operational start
        operational_end_date=None,
        firms_collection="Collection 6.1 Standard Science Quality",
        doi="10.5067/FIRMS/MODIS/MCD14DL.NRT.0061"
    ),
    "SNPP_VIIRS": SatelliteObservationMetadata(
        sensor="VIIRS",
        satellite="S-NPP",
        resolution_nadir_m=375,
        operational_start_date=datetime.date(2012, 1, 20), # Suomi-NPP VIIRS operational start
        operational_end_date=None,
        firms_collection="VNP14IMGTDL Standard Science Quality",
        doi="10.5067/FIRMS/VIIRS/VNP14IMGT.NRT.002"
    ),
    "NOAA20_VIIRS": SatelliteObservationMetadata(
        sensor="VIIRS",
        satellite="NOAA-20",
        resolution_nadir_m=375,
        operational_start_date=datetime.date(2018, 1, 5), # JPSS-1 / NOAA-20 operational start
        operational_end_date=None,
        firms_collection="VJ114IMGTDL Standard Science Quality",
        doi="10.5067/FIRMS/VIIRS/VJ114IMGT.NRT.002"
    )
}


def is_sensor_operational(satellite_key: str, year: int, month: int) -> bool:
    """
    Validates whether a specific satellite was actively acquiring science-grade observations
    during the specified calendar year and month.
    Prevents false zero-fire reporting prior to instrument commissioning.
    """
    if satellite_key not in CONSTELLATION_REGISTRY:
        return False
    meta = CONSTELLATION_REGISTRY[satellite_key]
    first_of_month = datetime.date(year, month, 1)
    
    if first_of_month < meta.operational_start_date.replace(day=1):
        return False
    if meta.operational_end_date and first_of_month > meta.operational_end_date:
        return False
    return True


def get_active_satellites_for_period(year: int, month: int) -> List[str]:
    """Returns list of satellite keys operational in the target period."""
    return [key for key in CONSTELLATION_REGISTRY if is_sensor_operational(key, year, month)]


def filter_firms_confidence(df: pd.DataFrame, policy: str = "nominal_high") -> pd.DataFrame:
    """
    Filters raw FIRMS hotspot detections according to NASA remote sensing best practices.
    MODIS reports confidence as percentage (0-100%).
    VIIRS reports categorical confidence ('low', 'nominal', 'high').
    """
    if "confidence" not in df.columns:
        return df

    if policy == "all":
        return df
    elif policy == "high_only":
        is_modis_high = (df["instrument"] == "MODIS") & (pd.to_numeric(df["confidence"], errors="coerce") >= 80)
        is_viirs_high = (df["instrument"] == "VIIRS") & (df["confidence"].astype(str).str.lower() == "high")
        return df[is_modis_high | is_viirs_high]
    else: # nominal_high (default standard science)
        is_modis_nominal = (df["instrument"] == "MODIS") & (pd.to_numeric(df["confidence"], errors="coerce") >= 30)
        is_viirs_nominal = (df["instrument"] == "VIIRS") & (df["confidence"].astype(str).str.lower().isin(["nominal", "high"]))
        return df[is_modis_nominal | is_viirs_nominal]
