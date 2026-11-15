"""
IGNIS Atlas — FireTruth Scientific Pipeline
Module: science/aggregate.py
Description: Rigorous Equal-Area Common-Grid Spatial and Temporal Aggregation.
Implements:
    I_{s,g,d} = 1 if sensor s detects qualified activity in equal-area cell g on day d, else 0
    A_{s,m}   = sum_{g} sum_{d in m} I_{s,g,d}

Geospatial Projection:
Uses Authalic Spherical Sinusoidal Equal-Area projection (R = 6,371.0088 km)
where:
    x = R * (lambda - lambda_0) * cos(phi)
    y = R * phi
    Area(cell) = S * S = S^2 km^2 (strictly constant across all latitudes).

Supports sensitivity analysis at cell resolutions:
    - 5 km  (~25 km² fine localized cells)
    - 10 km (~100 km² standard regional cells)
    - 20 km (~400 km² macro-scale benchmark cells)
    - 25 km (~625 km² multi-decadal historical reference cells)
    - 50 km (~2,500 km² coarse macro cells)
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd


# WGS84 authalic Earth radius in kilometres
EARTH_RADIUS_AUTHALIC_KM = 6371.0088


@dataclass
class ProjectedGridCell:
    cell_id: str
    grid_x_km: float
    grid_y_km: float
    center_lat: float
    center_lon: float
    nominal_area_km2: float


def project_wgs84_to_equal_area(
    lat: float,
    lon: float,
    lon_0: float = 0.0
) -> Tuple[float, float]:
    """
    Projects WGS84 geographic coordinates (lat, lon in degrees) into
    Equal-Area Sinusoidal cartographic coordinates (x, y in kilometres).
    Differential area element: dA = dx * dy = R^2 * cos(lat) * dlat * dlon.
    Preserves exact surface area globally across all latitudes.
    """
    phi = np.radians(lat)
    lam = np.radians(lon - lon_0)
    
    x = EARTH_RADIUS_AUTHALIC_KM * lam * np.cos(phi)
    y = EARTH_RADIUS_AUTHALIC_KM * phi
    return float(x), float(y)


def inverse_equal_area_to_wgs84(
    x_km: float,
    y_km: float,
    lon_0: float = 0.0
) -> Tuple[float, float]:
    """Inverse projection from equal-area (x, y in km) back to WGS84 (lat, lon in degrees)."""
    phi = y_km / EARTH_RADIUS_AUTHALIC_KM
    cos_phi = np.cos(phi)
    if abs(cos_phi) < 1e-6:
        lam = 0.0
    else:
        lam = x_km / (EARTH_RADIUS_AUTHALIC_KM * cos_phi)
    
    lat = np.degrees(phi)
    lon = np.degrees(lam) + lon_0
    return float(np.round(lat, 5)), float(np.round(lon, 5))


def snap_to_equal_area_grid(
    lat: float,
    lon: float,
    cell_size_km: float = 25.0,
    lon_0: float = 0.0
) -> ProjectedGridCell:
    """
    Snaps a geographic coordinate to a discrete Equal-Area cell index:
        g_x = floor(x / S)
        g_y = floor(y / S)
    Guarantees every cell subtends exactly cell_size_km x cell_size_km = S^2 km².
    """
    x_km, y_km = project_wgs84_to_equal_area(lat, lon, lon_0=lon_0)
    
    g_x = int(np.floor(x_km / cell_size_km))
    g_y = int(np.floor(y_km / cell_size_km))
    
    center_x = (g_x + 0.5) * cell_size_km
    center_y = (g_y + 0.5) * cell_size_km
    c_lat, c_lon = inverse_equal_area_to_wgs84(center_x, center_y, lon_0=lon_0)
    
    cell_id = f"EA_{cell_size_km:.0f}km_{g_x:+d}_{g_y:+d}"
    return ProjectedGridCell(
        cell_id=cell_id,
        grid_x_km=center_x,
        grid_y_km=center_y,
        center_lat=c_lat,
        center_lon=c_lon,
        nominal_area_km2=float(cell_size_km * cell_size_km)
    )


# Backward-compatible aliases
discretize_coordinates_to_equal_area_grid = snap_to_equal_area_grid
snap_to_grid = snap_to_equal_area_grid


def discretize_coordinates_to_grid(
    lat: float,
    lon: float,
    grid_size_deg: Optional[float] = None,
    cell_size_km: float = 25.0
) -> ProjectedGridCell:
    """
    Backward-compatible entry point for coordinate snapping.
    If grid_size_deg is passed, converts 0.1° -> 10km, 0.2° -> 20km, 0.25° -> 25km, 0.5° -> 50km.
    """
    if grid_size_deg is not None:
        cell_size_km = grid_size_deg * 100.0
    return snap_to_equal_area_grid(lat, lon, cell_size_km=cell_size_km)


def compute_sensor_cell_days(
    hotspots_df: pd.DataFrame,
    cell_size_km: float = 25.0,
    grid_size_deg: Optional[float] = None,
    confidence_policy: str = "nominal_high"
) -> pd.DataFrame:
    """
    Calculates active cell-days (A_{s,m}) per sensor, year, and month.
    
    Standard Treatment Protocol:
    1. Multiple detections in one cell-day: Deduplicated to exactly 1 active cell-day (I_{s,g,d} = 1).
    2. Overpass times & satellite passes: Day & night passes within the same UTC calendar day
       are grouped into the single unique date key.
    3. Multi-satellite constellations: Detections are grouped by instrument ('MODIS' or 'VIIRS')
       and evaluated both per instrument and per satellite where specified.
    4. Quality filters: Applies confidence policy ('all', 'nominal_high', 'high_only') prior to aggregation.
    5. Grid alignment: Fixed projection origin (lon_0 = 0.0) ensures persistent cell boundary indexing.
    
    Returns DataFrame:
        ['year', 'month', 'instrument', 'active_cell_days', 'raw_hotspot_count', 'grid_cell_size_km']
    """
    if grid_size_deg is not None:
        cell_size_km = grid_size_deg * 100.0

    if hotspots_df.empty:
        return pd.DataFrame(columns=['year', 'month', 'instrument', 'active_cell_days', 'raw_hotspot_count', 'grid_cell_size_km'])

    df = hotspots_df.copy()
    
    # Standardize column naming
    if "instrument_standard" in df.columns:
        df["instrument"] = df["instrument_standard"]
    elif "instrument" not in df.columns:
        df["instrument"] = "MODIS"
    df["instrument"] = df["instrument"].astype(str).str.upper()

    # Filter confidence policy
    if "confidence_class" in df.columns:
        if confidence_policy == "high_only":
            df = df[df["confidence_class"] == "high"]
        elif confidence_policy == "nominal_high":
            df = df[df["confidence_class"].isin(["nominal", "high"])]
    elif "confidence" in df.columns:
        if confidence_policy == "high_only":
            is_mod = (df["instrument"] == "MODIS") & (pd.to_numeric(df["confidence"], errors="coerce") >= 80)
            is_vii = (df["instrument"] == "VIIRS") & (df["confidence"].astype(str).str.lower().isin(["high", "h"]))
            df = df[is_mod | is_vii]
        elif confidence_policy == "nominal_high":
            is_mod = (df["instrument"] == "MODIS") & (pd.to_numeric(df["confidence"], errors="coerce") >= 30)
            is_vii = (df["instrument"] == "VIIRS") & (df["confidence"].astype(str).str.lower().isin(["nominal", "high", "n", "h"]))
            df = df[is_mod | is_vii]

    if df.empty:
        return pd.DataFrame(columns=['year', 'month', 'instrument', 'active_cell_days', 'raw_hotspot_count', 'grid_cell_size_km'])

    df['acq_date'] = pd.to_datetime(df['acq_date'])
    df['year'] = df['acq_date'].dt.year
    df['month'] = df['acq_date'].dt.month
    df['day_str'] = df['acq_date'].dt.strftime('%Y-%m-%d')

    # Project coordinates to Equal-Area (Sinusoidal authalic projection)
    phis = np.radians(df['latitude'].values)
    lams = np.radians(df['longitude'].values)
    x_kms = EARTH_RADIUS_AUTHALIC_KM * lams * np.cos(phis)
    y_kms = EARTH_RADIUS_AUTHALIC_KM * phis

    g_xs = np.floor(x_kms / cell_size_km).astype(int)
    g_ys = np.floor(y_kms / cell_size_km).astype(int)

    df['cell_id'] = "EA_" + str(int(cell_size_km)) + "km_" + g_xs.astype(str) + "_" + g_ys.astype(str)

    # Indicator I_{s,g,d}: Unique occurrence of (instrument, cell_id, day_str)
    cell_days = df.groupby(['year', 'month', 'instrument', 'cell_id', 'day_str']).size().reset_index()

    # Sum active cell-days per month: A_{s,m}
    monthly_agg = cell_days.groupby(['year', 'month', 'instrument']).size().reset_index(name='active_cell_days')
    raw_counts = df.groupby(['year', 'month', 'instrument']).size().reset_index(name='raw_hotspot_count')

    merged = pd.merge(monthly_agg, raw_counts, on=['year', 'month', 'instrument'], how='left')
    merged['grid_cell_size_km'] = cell_size_km
    return merged.sort_values(by=['year', 'month', 'instrument']).reset_index(drop=True)
