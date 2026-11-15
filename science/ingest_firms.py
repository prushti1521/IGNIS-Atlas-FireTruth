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
    chunk_size: int = 50000
) -> Tuple[pd.DataFrame, Dict]:
    """
    Ingests a raw NASA FIRMS CSV file, performing chunked streaming, coordinate validation,
    equal-area projection, and cell-day aggregation.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"FIRMS file not found at: {filepath}")

    sha256 = calculate_file_sha256(filepath)
    file_bytes = os.path.getsize(filepath)

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
        filtered = chunk[valid_coords].copy()

        # 2. Date normalization
        if "acq_date" in filtered.columns:
            filtered["acq_date"] = pd.to_datetime(filtered["acq_date"], errors="coerce")
            filtered = filtered[filtered["acq_date"].notna()]
            filtered["year"] = filtered["acq_date"].dt.year
            filtered["month"] = filtered["acq_date"].dt.month
            filtered["day"] = filtered["acq_date"].dt.day
        else:
            continue

        # 3. Instrument detection
        if "instrument" not in filtered.columns:
            # Infer from satellite column or scan resolution
            if "scan" in filtered.columns and filtered["scan"].median() < 0.5:
                filtered["instrument"] = "VIIRS"
            else:
                filtered["instrument"] = "MODIS"
        else:
            filtered["instrument"] = filtered["instrument"].astype(str).str.upper().str.strip()

        # 4. Confidence filter
        filtered = filter_firms_confidence(filtered, policy=confidence_policy)

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
    args = parser.parse_args()

    monthly_df, meta = ingest_firms_csv(
        args.input,
        cell_size_km=args.cell_size,
        confidence_policy=args.confidence
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

