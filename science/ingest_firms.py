"""
IGNIS Atlas — FireTruth Scientific Pipeline
Module: science/ingest_firms.py
Description: Resumable Real NASA FIRMS CSV Ingestion & Equal-Area Harmonizer.
Processes authentic NASA FIRMS downloads (MODIS MCD14DL and VIIRS VNP14IMGTDL/VJ114IMGTDL),
performs coordinate validation, confidence normalization, authalic sinusoidal equal-area
discretization, and daily cell-day deduplication.
"""

import argparse
import datetime
import hashlib
import json
import os
import sys
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

from science.aggregate import snap_to_equal_area_grid
from science.ingest import filter_firms_confidence


def calculate_file_sha256(filepath: str) -> str:
    """Calculates SHA-256 checksum of source file for provenance verification."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def ingest_firms_csv(
    filepath: str,
    cell_size_km: float = 25.0,
    confidence_policy: str = "nominal_high",
    chunk_size: int = 50000,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    bbox: Optional[Tuple[float, float, float, float]] = None
) -> Tuple[pd.DataFrame, Dict]:
    """
    Ingests a raw NASA FIRMS CSV file, performing chunked streaming, coordinate validation,
    equal-area projection, and cell-day aggregation.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"FIRMS file not found at: {filepath}")

    sha256 = calculate_file_sha256(filepath)
    file_bytes = os.path.getsize(filepath)
    parsed_start = pd.Timestamp(start_date) if start_date else None
    parsed_end = pd.Timestamp(end_date) if end_date else None
    if parsed_start is not None and parsed_end is not None and parsed_start > parsed_end:
        raise ValueError("start_date must be earlier than or equal to end_date.")
    if bbox is not None:
        south, west, north, east = bbox
        if not (-90 <= south <= north <= 90 and -180 <= west <= east <= 180):
            raise ValueError("bbox must be ordered as south, west, north, east within valid coordinate ranges.")

    print(f"[+] Ingesting NASA FIRMS CSV: {filepath}")
    print(f"    File Size: {file_bytes / 1024:.1f} KB | SHA-256: {sha256}")

    # Read first line to inspect columns
    with open(filepath, "r", encoding="utf-8") as f:
        header_line = f.readline().lower()

    col_names = [c.strip().replace('"', '') for c in header_line.split(',')]
    if "latitude" not in col_names or "longitude" not in col_names:
        raise ValueError("Invalid NASA FIRMS format: Missing 'latitude' or 'longitude' columns.")

    total_rows = 0
    valid_hotspots = []
    rejected_rows = {
        "invalid_coordinates": 0,
        "invalid_dates": 0,
        "invalid_times": 0,
        "invalid_satellites": 0,
        "invalid_instruments": 0,
        "outside_filters": 0,
        "confidence_filtered": 0
    }

    # Stream in chunks to handle multi-gigabyte historical archives
    for chunk in pd.read_csv(filepath, chunksize=chunk_size, low_memory=False):
        total_rows += len(chunk)
        chunk.columns = [c.strip().lower().replace('"', '') for c in chunk.columns]

        # 1. Coordinate range validation
        valid_coords = (
            chunk["latitude"].notna() &
            chunk["longitude"].notna() &
            (chunk["latitude"] >= -90.0) & (chunk["latitude"] <= 90.0) &
            (chunk["longitude"] >= -180.0) & (chunk["longitude"] <= 180.0)
        )
        rejected_rows["invalid_coordinates"] += int((~valid_coords).sum())
        filtered = chunk[valid_coords].copy()

        # 2. Date normalization
        if "acq_date" in filtered.columns:
            raw_dates = filtered["acq_date"].copy()
            filtered["acq_date"] = pd.to_datetime(filtered["acq_date"], errors="coerce")
            rejected_rows["invalid_dates"] += int(filtered["acq_date"].isna().sum())
            filtered = filtered[filtered["acq_date"].notna()]
            filtered["year"] = filtered["acq_date"].dt.year
            filtered["month"] = filtered["acq_date"].dt.month
            filtered["day"] = filtered["acq_date"].dt.day
        else:
            rejected_rows["invalid_dates"] += len(filtered)
            continue

        if "acq_time" in filtered.columns:
            time_values = (
                filtered["acq_time"]
                .astype(str)
                .str.strip()
                .str.replace(r"\.0$", "", regex=True)
                .str.zfill(4)
            )
            valid_times = time_values.str.fullmatch(r"(?:[01]\d|2[0-3])[0-5]\d")
            rejected_rows["invalid_times"] += int((~valid_times).sum())
            filtered = filtered[valid_times]

        if parsed_start is not None:
            filtered = filtered[filtered["acq_date"] >= parsed_start]
        if parsed_end is not None:
            filtered = filtered[filtered["acq_date"] <= parsed_end]
        if bbox is not None:
            south, west, north, east = bbox
            in_bbox = (
                (filtered["latitude"] >= south) & (filtered["latitude"] <= north) &
                (filtered["longitude"] >= west) & (filtered["longitude"] <= east)
            )
            filtered = filtered[in_bbox]

        filtered_rows = len(filtered)
        if filtered_rows < len(chunk[valid_coords]):
            rejected_rows["outside_filters"] += len(chunk[valid_coords]) - filtered_rows

        # 3. Instrument detection
        if "instrument" not in filtered.columns:
            # Infer from satellite column or scan resolution
            if "scan" in filtered.columns and filtered["scan"].median() < 0.5:
                filtered["instrument"] = "VIIRS"
            else:
                filtered["instrument"] = "MODIS"
        else:
            filtered["instrument"] = filtered["instrument"].astype(str).str.upper().str.strip()
            valid_instruments = filtered["instrument"].isin(["MODIS", "VIIRS"])
            rejected_rows["invalid_instruments"] += int((~valid_instruments).sum())
            filtered = filtered[valid_instruments]

        if "satellite" in filtered.columns:
            satellite_values = filtered["satellite"].astype(str).str.upper().str.strip()
            valid_satellites = satellite_values.isin([
                "TERRA", "AQUA", "N", "SNPP", "S-NPP", "NOAA-20", "NOAA20"
            ])
            rejected_rows["invalid_satellites"] += int((~valid_satellites).sum())
            filtered = filtered[valid_satellites]

        # 4. Confidence filter
        before_confidence = len(filtered)
        filtered = filter_firms_confidence(filtered, policy=confidence_policy)
        rejected_rows["confidence_filtered"] += before_confidence - len(filtered)

        # 5. Snap to Authalic Sinusoidal Equal-Area Grid
        for _, row in filtered.iterrows():
            cell = snap_to_equal_area_grid(row["latitude"], row["longitude"], cell_size_km=cell_size_km)
            valid_hotspots.append({
                "cell_id": cell.cell_id,
                "year": int(row["year"]),
                "month": int(row["month"]),
                "day": int(row["day"]),
                "instrument": row["instrument"],
                "frp": float(row.get("frp", 0.0)) if pd.notna(row.get("frp")) else 0.0
            })

    if not valid_hotspots:
        print("[!] No valid qualified hotspots found after filtering.")
        return pd.DataFrame(), {}

    hotspots_df = pd.DataFrame(valid_hotspots)
    print(f"    Ingested {total_rows} raw rows -> {len(hotspots_df)} qualified detections.")

    # Deduplicate to active cell-days per sensor per day: I_{s,g,d} in {0, 1}
    daily_cell_days = hotspots_df.groupby(
        ["year", "month", "day", "cell_id", "instrument"]
    ).agg(
        detections=("frp", "count"),
        total_frp=("frp", "sum")
    ).reset_index()

    # Aggregate to monthly totals
    monthly_aggregates = daily_cell_days.groupby(
        ["year", "month", "instrument"]
    ).agg(
        active_cell_days=("cell_id", "count"),
        raw_hotspots=("detections", "sum"),
        total_frp_mw=("total_frp", "sum")
    ).reset_index()

    provenance_meta = {
        "source_file": filepath,
        "source_sha256": sha256,
        "file_size_bytes": file_bytes,
        "total_records_ingested": total_rows,
        "qualified_hotspots": len(hotspots_df),
        "equal_area_cell_size_km": cell_size_km,
        "nominal_cell_area_km2": cell_size_km * cell_size_km,
        "confidence_policy": confidence_policy,
        "filters": {
            "start_date": start_date,
            "end_date": end_date,
            "bbox": list(bbox) if bbox is not None else None
        },
        "rejected_rows": rejected_rows,
        "date_processed": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "min_date": f"{hotspots_df['year'].min()}-{hotspots_df['month'].min():02d}",
        "max_date": f"{hotspots_df['year'].max()}-{hotspots_df['month'].max():02d}"
    }

    return monthly_aggregates, provenance_meta


def main():
    parser = argparse.ArgumentParser(description="Ingest raw NASA FIRMS CSV dataset into equal-area active cell-days.")
    parser.add_argument("--input", default="data/sample_firms_download.csv", help="Path to raw NASA FIRMS CSV file")
    parser.add_argument("--output", default="data/processed/real_firms_harmonized.json", help="Path to output JSON")
    parser.add_argument("--cell-size", type=float, default=25.0, help="Equal-area cell size in km (default 25.0)")
    parser.add_argument("--confidence", default="nominal_high", choices=["all", "nominal_high", "high_only"])
    parser.add_argument("--start-date", help="Inclusive acquisition date filter (YYYY-MM-DD)")
    parser.add_argument("--end-date", help="Inclusive acquisition date filter (YYYY-MM-DD)")
    parser.add_argument(
        "--bbox",
        nargs=4,
        type=float,
        metavar=("SOUTH", "WEST", "NORTH", "EAST"),
        help="Inclusive geographic filter"
    )
    args = parser.parse_args()

    monthly_df, meta = ingest_firms_csv(
        args.input,
        cell_size_km=args.cell_size,
        confidence_policy=args.confidence,
        start_date=args.start_date,
        end_date=args.end_date,
        bbox=tuple(args.bbox) if args.bbox else None
    )

    if not monthly_df.empty:
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        out_payload = {
            "provenance": meta,
            "monthly_aggregates": monthly_df.to_dict(orient="records")
        }
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(out_payload, f, indent=2)
        print(f"[✓] Successfully exported real NASA FIRMS harmonized records to: {args.output}")
        print("\nMonthly Aggregates Summary:")
        print(monthly_df.to_string(index=False))


if __name__ == "__main__":
    main()
