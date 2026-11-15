"""Generate a compact spatial MODIS/VIIRS disagreement artifact from local FIRMS files.

The artifact contains qualified, deduplicated cell-day aggregates only. It never
classifies a sensor-only detection as an error because positive detections do not
establish that the other sensor had an observation opportunity.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

import pandas as pd

from science.aggregate import (
    EARTH_RADIUS_AUTHALIC_KM,
    inverse_equal_area_to_wgs84,
    snap_to_equal_area_grid,
)
from science.normalize import normalize_firms_dataframe


CELL_PATTERN = re.compile(r"^EA_(?P<size>\d+)km_(?P<x>[+-]?\d+)_(?P<y>[+-]?\d+)$")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def cell_geometry(cell_id: str, cell_size_km: float) -> dict[str, Any]:
    match = CELL_PATTERN.match(cell_id)
    if not match:
        raise ValueError(f"Unexpected equal-area cell ID: {cell_id}")
    grid_x = int(match.group("x"))
    grid_y = int(match.group("y"))
    x0 = grid_x * cell_size_km
    x1 = (grid_x + 1) * cell_size_km
    y0 = grid_y * cell_size_km
    y1 = (grid_y + 1) * cell_size_km
    corners = [
        inverse_equal_area_to_wgs84(x0, y0),
        inverse_equal_area_to_wgs84(x1, y0),
        inverse_equal_area_to_wgs84(x1, y1),
        inverse_equal_area_to_wgs84(x0, y1),
        inverse_equal_area_to_wgs84(x0, y0),
    ]
    center_lat, center_lon = inverse_equal_area_to_wgs84(
        (x0 + x1) / 2,
        (y0 + y1) / 2,
    )
    return {
        "cell_id": cell_id,
        "grid_x_km": (x0 + x1) / 2,
        "grid_y_km": (y0 + y1) / 2,
        "center": [center_lat, center_lon],
        "geometry": {"type": "Polygon", "coordinates": [[[lon, lat] for lat, lon in corners]]},
        "nominal_area_km2": cell_size_km * cell_size_km,
    }


def read_sensor_files(
    files: list[Path],
    sensor: str,
    start_date: str,
    end_date: str,
    bbox: tuple[float, float, float, float],
    cell_size_km: float,
) -> tuple[pd.DataFrame, int]:
    qualified_frames: list[pd.DataFrame] = []
    raw_count = 0
    south, west, north, east = bbox
    for path in files:
        raw = pd.read_csv(path, low_memory=False)
        raw_count += len(raw)
        normalized, _ = normalize_firms_dataframe(raw, source_filename=path.name)
        if normalized.empty:
            continue
        filtered = normalized[
            (normalized["instrument_standard"] == sensor)
            & (normalized["confidence_class"].isin(["nominal", "high"]))
            & (normalized["acq_date_str"] >= start_date)
            & (normalized["acq_date_str"] <= end_date)
            & (normalized["latitude"].between(south, north))
            & (normalized["longitude"].between(west, east))
        ].copy()
        if filtered.empty:
            continue
        filtered["cell_id"] = [
            snap_to_equal_area_grid(float(lat), float(lon), cell_size_km).cell_id
            for lat, lon in zip(filtered["latitude"], filtered["longitude"])
        ]
        filtered["date"] = pd.to_datetime(filtered["acq_date_str"]).dt.date
        qualified_frames.append(filtered[["cell_id", "date"]])

    if not qualified_frames:
        return pd.DataFrame(columns=["cell_id", "date"]), raw_count

    observations = pd.concat(qualified_frames, ignore_index=True).drop_duplicates()
    return observations.sort_values(["cell_id", "date"]).reset_index(drop=True), raw_count


def one_to_one_window_matches(
    modis_dates: list[Any],
    viirs_dates: list[Any],
    window_days: int,
) -> list[tuple[Any, Any]]:
    """Greedily match each MODIS date to at most one VIIRS date."""
    available = set(viirs_dates)
    matches: list[tuple[Any, Any]] = []
    for modis_date in modis_dates:
        candidates = [
            date for date in available
            if abs((date - modis_date).days) <= window_days
        ]
        if not candidates:
            continue
        viirs_date = min(candidates, key=lambda date: (abs((date - modis_date).days), date))
        available.remove(viirs_date)
        matches.append((modis_date, viirs_date))
    return matches


def build_artifact(
    raw_dir: Path,
    output: Path,
    start_date: str,
    end_date: str,
    cell_size_km: float = 25.0,
    temporal_window_days: int = 1,
) -> dict[str, Any]:
    bbox = (32.5, -124.4, 42.0, -114.1)
    def manifest_files(source: str) -> list[Path]:
        manifest_path = raw_dir / f"{source}_2018-01-01_2022-12-31.manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        files = [raw_dir / Path(request["file"]).name for request in manifest["requests"]]
        if any(not path.exists() for path in files):
            missing = [str(path) for path in files if not path.exists()]
            raise FileNotFoundError(f"Manifest-listed raw files are missing: {missing[:3]}")
        return files

    modis_files = manifest_files("MODIS_SP")
    viirs_files = manifest_files("VIIRS_SNPP_SP")
    if len(modis_files) != 366 or len(viirs_files) != 366:
        raise ValueError(
            f"Expected 366 MODIS and 366 VIIRS batches; found {len(modis_files)} and {len(viirs_files)}."
        )

    modis, modis_raw_count = read_sensor_files(
        modis_files, "MODIS", start_date, end_date, bbox, cell_size_km
    )
    viirs, viirs_raw_count = read_sensor_files(
        viirs_files, "VIIRS", start_date, end_date, bbox, cell_size_km
    )

    modis_by_cell: dict[str, list[Any]] = defaultdict(list)
    viirs_by_cell: dict[str, list[Any]] = defaultdict(list)
    for cell_id, date in modis.itertuples(index=False):
        modis_by_cell[cell_id].append(date)
    for cell_id, date in viirs.itertuples(index=False):
        viirs_by_cell[cell_id].append(date)

    rows: list[dict[str, Any]] = []
    cells = {cell_id: cell_geometry(cell_id, cell_size_km) for cell_id in sorted(
        set(modis_by_cell) | set(viirs_by_cell)
    )}
    all_cells = sorted(set(modis_by_cell) | set(viirs_by_cell))
    for cell_id in all_cells:
        m_dates = sorted(modis_by_cell.get(cell_id, []))
        v_dates = sorted(viirs_by_cell.get(cell_id, []))
        m_set, v_set = set(m_dates), set(v_dates)
        same_day = sorted(m_set & v_set)
        window_matches = one_to_one_window_matches(m_dates, v_dates, temporal_window_days)

        by_month: dict[tuple[int, int], dict[str, Any]] = defaultdict(
            lambda: {
                "modis_dates": set(),
                "viirs_dates": set(),
                "same_day_dates": set(),
                "window_matches": [],
            }
        )
        for date in m_dates:
            by_month[(date.year, date.month)]["modis_dates"].add(date)
        for date in v_dates:
            by_month[(date.year, date.month)]["viirs_dates"].add(date)
        for date in same_day:
            by_month[(date.year, date.month)]["same_day_dates"].add(date)
        for m_date, v_date in window_matches:
            key = (m_date.year, m_date.month)
            by_month[key]["window_matches"].append([m_date.isoformat(), v_date.isoformat()])

        for (year, month), values in sorted(by_month.items()):
            modis_days = sorted(values["modis_dates"])
            viirs_days = sorted(values["viirs_dates"])
            has_modis = bool(modis_days)
            has_viirs = bool(viirs_days)
            category = (
                "SHARED_CELL_MONTH" if has_modis and has_viirs
                else "MODIS_ONLY_CELL_MONTH" if has_modis
                else "VIIRS_ONLY_CELL_MONTH"
            )
            rows.append({
                "cell_id": cell_id,
                "year": year,
                "month": month,
                "modis_active_cell_days": len(modis_days),
                "viirs_active_cell_days": len(viirs_days),
                "same_utc_day_matches": len(values["same_day_dates"]),
                "window_matches": len(values["window_matches"]),
                "temporal_window_days": temporal_window_days,
                "category": category,
                "coverage_interpretation": (
                    "Both sensors recorded qualified activity in this cell-month; "
                    "this is cross-sensor agreement, not independent accuracy."
                    if category == "SHARED_CELL_MONTH"
                    else "MODIS recorded qualified activity and VIIRS did not. "
                    "VIIRS observation opportunity and coverage are not established."
                    if category == "MODIS_ONLY_CELL_MONTH"
                    else "VIIRS recorded qualified activity and MODIS did not. "
                    "MODIS observation opportunity and coverage are not established."
                ),
            })

    manifest_paths = [
        raw_dir / "MODIS_SP_2018-01-01_2022-12-31.manifest.json",
        raw_dir / "VIIRS_SNPP_SP_2018-01-01_2022-12-31.manifest.json",
    ]
    manifests = [
        {"path": path.name, "sha256": sha256_file(path)}
        for path in manifest_paths if path.exists()
    ]
    artifact = {
        "artifact_version": "1.0.0",
        "artifact_id": "ignis-atlas-california-spatial-disagreement-2018-2022",
        "data_mode": "NASA_OBSERVATIONAL",
        "study_region": "California, USA",
        "source_products": {
            "modis": {
                "product": "MODIS_SP",
                "batch_count": len(modis_files),
                "raw_observation_count": modis_raw_count,
                "qualified_cell_day_count": len(modis),
            },
            "viirs": {
                "product": "VIIRS_SNPP_SP",
                "batch_count": len(viirs_files),
                "raw_observation_count": viirs_raw_count,
                "qualified_cell_day_count": len(viirs),
            },
        },
        "processing": {
            "start_date": start_date,
            "end_date": end_date,
            "bbox": {"south": bbox[0], "west": bbox[1], "north": bbox[2], "east": bbox[3]},
            "grid": {
                "projection": "authalic_sinusoidal_equal_area",
                "earth_radius_authalic_km": EARTH_RADIUS_AUTHALIC_KM,
                "cell_size_km": cell_size_km,
            },
            "confidence_policy": "nominal_high",
            "temporal_methods": {
                "same_utc_day": "Intersection of deduplicated sensor cell-days.",
                "window": f"Greedy one-to-one matching within +/- {temporal_window_days} UTC day(s); a date is used at most once per sensor and cell.",
                "monthly_cell": "Presence of at least one qualified sensor cell-day in the UTC calendar month.",
            },
        },
        "provenance": {
            "input_manifests": manifests,
            "raw_files_remain_external": True,
            "limitations": [
                "Sensor-only categories do not prove missed detections or false positives.",
                "FIRMS positive detections do not establish complete orbital or cloud-free coverage.",
                "VIIRS is a comparison sensor, not ground truth.",
                "Acquisition timestamps do not provide full overpass geometry or observation-opportunity masks.",
            ],
        },
        "summary": {
            "cell_count": len(all_cells),
            "cell_month_count": len(rows),
            "modis_only_cell_months": sum(row["category"] == "MODIS_ONLY_CELL_MONTH" for row in rows),
            "viirs_only_cell_months": sum(row["category"] == "VIIRS_ONLY_CELL_MONTH" for row in rows),
            "shared_cell_months": sum(row["category"] == "SHARED_CELL_MONTH" for row in rows),
            "same_utc_day_matches": sum(row["same_utc_day_matches"] for row in rows),
            "window_matches": sum(row["window_matches"] for row in rows),
        },
        "cells": list(cells.values()),
        "cell_months": rows,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    return artifact


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--start-date", default="2018-01-01")
    parser.add_argument("--end-date", default="2022-12-31")
    parser.add_argument("--temporal-window-days", type=int, default=1)
    args = parser.parse_args()
    artifact = build_artifact(
        args.raw_dir,
        args.output,
        args.start_date,
        args.end_date,
        temporal_window_days=args.temporal_window_days,
    )
    print(json.dumps(artifact["summary"], sort_keys=True))


if __name__ == "__main__":
    main()
