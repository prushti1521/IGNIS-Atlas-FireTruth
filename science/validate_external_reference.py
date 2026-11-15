"""Compare authentic 2020 FIRMS cell activity with CAL FIRE final perimeters.

The CAL FIRE layer is a final-perimeter reference, not a daily progression
record or ground-truth detector. Metrics are therefore annual spatial
descriptors only; temporal progression and harmonized spatial prediction are
explicitly reported as not evaluated.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np
from shapely import transform as shapely_transform
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

REFERENCE_URL = (
    "https://services.arcgis.com/jIL9msH9OI208GCb/ArcGIS/rest/services/"
    "California_Fire_Perimeters_2020/FeatureServer/1/query"
)
CELL_SIZE_KM = 25.0
SPATIAL_ARTIFACT_PATH = Path("public/data/nasaSpatialDisagreement.json")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def project_geometry(geometry: Any) -> Any:
    def project_coordinates(coordinates: Any) -> Any:
        latitudes = np.radians(coordinates[:, 1])
        longitudes = np.radians(coordinates[:, 0])
        return np.column_stack((
            6371.0088 * longitudes * np.cos(latitudes),
            6371.0088 * latitudes,
        ))

    return shapely_transform(
        geometry,
        project_coordinates,
        interleaved=True,
    )


def cell_polygon(cell_id: str) -> Polygon:
    _, size, x, y = cell_id.split("_")
    cell_size = float(size.removesuffix("km"))
    grid_x, grid_y = int(x), int(y)
    x0, y0 = grid_x * cell_size, grid_y * cell_size
    return Polygon([(x0, y0), (x0 + cell_size, y0), (x0 + cell_size, y0 + cell_size), (x0, y0 + cell_size)])


def load_reference(path: Path) -> tuple[Any, list[dict[str, Any]], dict[str, Any]]:
    document = json.loads(path.read_text(encoding="utf-8"))
    all_features = document["features"]
    california_features = [
        feature for feature in all_features
        if feature.get("properties", {}).get("STATE") == "CA"
    ]
    geometries = []
    repaired_ids = []
    empty_ids = []
    for feature in california_features:
        original_geometry = shape(feature["geometry"])
        if not original_geometry.is_valid:
            repaired_ids.append(feature.get("properties", {}).get("OBJECTID"))
        geometry = make_valid(project_geometry(shape(feature["geometry"])))
        if not geometry.is_empty:
            geometries.append(geometry)
        else:
            empty_ids.append(feature.get("properties", {}).get("OBJECTID"))
    object_ids = [
        feature.get("properties", {}).get("OBJECTID")
        for feature in all_features
    ]
    non_2020_ids = [
        feature.get("properties", {}).get("OBJECTID")
        for feature in all_features
        if str(feature.get("properties", {}).get("YEAR_")) != "2020"
    ]
    return unary_union(geometries), california_features, {
        "feature_count_total": len(all_features),
        "feature_count_california": len(california_features),
        "excluded_out_of_region": [
            feature.get("properties", {}).get("OBJECTID")
            for feature in all_features
            if feature.get("properties", {}).get("STATE") != "CA"
        ],
        "year_values": sorted({
            feature.get("properties", {}).get("YEAR_")
            for feature in all_features
        }),
        "non_2020_objectids": non_2020_ids,
        "duplicate_objectid_count": len(object_ids) - len(set(object_ids)),
        "invalid_california_geometry_count": len(repaired_ids),
        "repaired_objectids": repaired_ids,
        "empty_after_repair_objectids": empty_ids,
        "coordinate_bounds_wgs84": [
            min(shape(feature["geometry"]).bounds[0] for feature in all_features),
            min(shape(feature["geometry"]).bounds[1] for feature in all_features),
            max(shape(feature["geometry"]).bounds[2] for feature in all_features),
            max(shape(feature["geometry"]).bounds[3] for feature in all_features),
        ],
    }


def score_cells(reference_union: Any, cell_ids: list[str], threshold: float) -> set[str]:
    selected = set()
    for cell_id in cell_ids:
        cell = cell_polygon(cell_id)
        fraction = reference_union.intersection(cell).area / cell.area
        if fraction >= threshold:
            selected.add(cell_id)
    return selected


def spatial_metrics(predicted: set[str], reference: set[str]) -> dict[str, Any]:
    intersection = predicted & reference
    union = predicted | reference
    return {
        "predicted_cells": len(predicted),
        "reference_cells": len(reference),
        "intersection_cells": len(intersection),
        "precision": len(intersection) / len(predicted) if predicted else None,
        "recall": len(intersection) / len(reference) if reference else None,
        "iou": len(intersection) / len(union) if union else None,
    }


def build_validation(reference_path: Path, artifact_path: Path, threshold: float) -> dict[str, Any]:
    artifact = json.loads(artifact_path.read_text(encoding="utf-8"))
    reference_union, features, record_audit = load_reference(reference_path)
    cell_ids = [cell["cell_id"] for cell in artifact["cells"]]
    reference_cells = score_cells(reference_union, cell_ids, threshold)
    rows = [row for row in artifact["cell_months"] if row["year"] == 2020]
    modis_cells = {row["cell_id"] for row in rows if row["modis_active_cell_days"] > 0}
    viirs_cells = {row["cell_id"] for row in rows if row["viirs_active_cell_days"] > 0}
    union_cells = modis_cells | viirs_cells
    sensitivity = []
    for sensitivity_threshold in (0.005, 0.01, 0.02, 0.05):
        sensitivity_reference_cells = score_cells(
            reference_union,
            cell_ids,
            sensitivity_threshold,
        )
        sensitivity.append({
            "intersection_threshold": sensitivity_threshold,
            "reference_cells": len(sensitivity_reference_cells),
            "modis": spatial_metrics(modis_cells, sensitivity_reference_cells),
            "viirs": spatial_metrics(viirs_cells, sensitivity_reference_cells),
            "sensor_union": spatial_metrics(union_cells, sensitivity_reference_cells),
        })
    monthly_activity = [
        {
            "month": month,
            "modis_active_cell_days": sum(row["modis_active_cell_days"] for row in rows if row["month"] == month),
            "viirs_active_cell_days": sum(row["viirs_active_cell_days"] for row in rows if row["month"] == month),
        }
        for month in range(1, 13)
    ]
    display_perimeters = []
    for feature in features:
        simplified = shape(feature["geometry"]).simplify(0.001, preserve_topology=True)
        display_perimeters.append({
            "type": "Feature",
            "geometry": mapping(simplified),
            "properties": {
                key: feature.get("properties", {}).get(key)
                for key in ("OBJECTID", "YEAR_", "STATE", "AGENCY", "UNIT_ID")
            },
        })
    return {
        "artifact_id": artifact["artifact_id"],
        "reference": {
            "publisher": "California Department of Forestry and Fire Protection, FRAP",
            "dataset": "California Fire Perimeters 2020 / Burn areas layer",
            "service_url": REFERENCE_URL,
            "retrieval_sha256": sha256_file(reference_path),
            "feature_count_total": record_audit["feature_count_total"],
            "feature_count_california": record_audit["feature_count_california"],
            "coverage_semantics": "Final fire perimeters; no dated fire progression.",
            "limitations": [
                "CAL FIRE states the historical perimeter database is incomplete.",
                "Final perimeters do not establish daily observation opportunity or ignition timing.",
                "The reference is an external perimeter product, not ground truth.",
            ],
        },
        "record_audit": record_audit,
        "method": {
            "grid": "Existing 25 km authalic sinusoidal equal-area grid.",
            "projection": "Same coordinate transform as science.aggregate.",
            "intersection_rule": f"Reference union intersects at least {threshold:.2%} of a grid-cell area.",
            "period": "2020 annual spatial comparison.",
            "temporal_evaluation": "NOT_EVALUATED: final perimeters have no progression dates.",
            "harmonized_spatial_prediction": "NOT_EVALUATED: B1/B2 calibrate scalar monthly activity, not perimeters.",
        },
        "reference_area_km2_projected": reference_union.area,
        "reference_cells": sorted(reference_cells),
        "display_perimeters": {
            "type": "FeatureCollection",
            "simplification_tolerance_degrees": 0.001,
            "geometry_semantics": "Display-only simplification of final perimeters; metrics use unsimplified geometries.",
            "features": display_perimeters,
        },
        "metrics": {
            "modis": spatial_metrics(modis_cells, reference_cells),
            "viirs": spatial_metrics(viirs_cells, reference_cells),
            "sensor_union": spatial_metrics(union_cells, reference_cells),
        },
        "threshold_sensitivity": sensitivity,
        "monthly_activity_2020": monthly_activity,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--artifact", type=Path, default=SPATIAL_ARTIFACT_PATH)
    parser.add_argument("--threshold", type=float, default=0.01)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = build_validation(args.reference, args.artifact, args.threshold)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"External reference validation written to {args.output}")


if __name__ == "__main__":
    main()
