# Phase 2 external validation

## Reference selection

The primary reference for the California 2020 case study is the California
Department of Forestry and Fire Protection (CAL FIRE) Fire and Resource
Assessment Program (FRAP) `California_Fire_Perimeters_2020` ArcGIS service,
`Burn areas` layer (layer 1):

<https://services.arcgis.com/jIL9msH9OI208GCb/ArcGIS/rest/services/California_Fire_Perimeters_2020/FeatureServer/1>

It was selected because it is an official California public-agency perimeter
record with public query access and California State Plane coordinates in the
service. The downloaded query was requested in WGS84 GeoJSON for reproducible
processing. The snapshot contains 505 features, of which 504 have `STATE=CA`
and one is in Arizona. All 505 records have `YEAR_=2020`; no duplicate
`OBJECTID` values were found.

CAL FIRE explicitly cautions that the historical perimeter database is
incomplete and may contain missing records, duplicates, and generalized
boundaries. The records are final perimeters; they do not provide daily fire
progression or a reliable ignition date for every polygon. The reference is
therefore an external perimeter context, not ground truth and not an
independent observation-opportunity mask.

Two candidates were reviewed but are not used as the primary reference:

- NASA MCD64A1 Collection 6.1 is a global monthly 500 m burned-area product,
  but its algorithm uses MODIS surface reflectance and MODIS active fires.
  It is useful external burned-area context, but it is not sensor-independent
  from the MODIS observations used here.
- USGS Landsat Collection 2 Level-3 Burned Area is a 30 m Landsat-derived
  burned-area product for the conterminous United States. It could provide
  stronger sensor diversity, but acquisition and scene-availability review
  are outside this first reproducible checkpoint. No Landsat measurements are
  claimed here.

## Acquisition provenance

The raw snapshot is retained locally and ignored by Git:

`data/reference/calfire_2020/burn_areas_2020.geojson`

- Retrieval method: public ArcGIS REST query, no authentication.
- Query: `where=1=1`, all attributes, geometry returned in EPSG:4326.
- Retrieval date: 2026-11-15.
- Raw file size: 25,060,229 bytes.
- Raw SHA-256:
  `7dd1b8305edd7f507bc6c3f97f3cfd8a0800b0908b01de56c6a14c3cb2c4b40a`
- Redistribution: the public agency service remains the authoritative source;
  only derived metrics and a display-simplified browser artifact are suitable
  for this repository.

The browser artifact is:

`public/data/california2020Reference.json`

- Size: 2,831,043 bytes.
- SHA-256:
  `6c9297d2a486e5980ef9c445b39797380805d85db742302a166a1706cc7f9bc7`
- Display geometry tolerance: 0.001 degrees.
- Spatial metrics use the unsimplified local reference geometry, not the
  display simplification.

  ## Record and geometry audit

  The pipeline records filtering and repair decisions in the browser artifact
  under `record_audit` rather than silently dropping questionable records:

  - 505 source records were inspected.
  - 504 California records were included.
  - `OBJECTID=21802` was excluded because its state is Arizona.
  - No records were excluded for year; every source record has `YEAR_=2020`.
  - No duplicate `OBJECTID` values were found.
  - 50 California geometries were invalid as supplied and were repaired with
    Shapely `make_valid`; none became empty and no California record was
    discarded for geometry.
  - Source WGS84 bounds are
    `[-123.875427051581, 32.5639456823388, -114.136400295028, 42.1143122082211]`.

  The 50 repairs affect the unsimplified union used for metrics. Display
  perimeters are simplified only after that union-independent source audit and
  are not used for cell selection.

## Spatial method

The validation pipeline is [validate_external_reference.py](../science/validate_external_reference.py).
It reuses the existing 25 km authalic sinusoidal equal-area projection and
cell indexing from `science.aggregate`. CAL FIRE geometries are projected,
made valid where required, and unioned. A reference cell is included when the
union intersects at least 1% of its 625 km² cell area.

For 2020, the pipeline compares the reference-cell set with:

- MODIS active cells observed at least once in any 2020 month.
- VIIRS active cells observed at least once in any 2020 month.
- The union of the two sensor sets.

Intersection, precision-like overlap, recall-like coverage, and IoU are
descriptive set comparisons under this rule. They are not detection accuracy,
false-positive rates, or false-negative rates because the perimeter reference
is incomplete and does not encode satellite viewing opportunity.

## Threshold sensitivity

The same unsimplified repaired perimeter union was independently scored at
four intersection thresholds. Predicted MODIS and VIIRS cell sets are fixed;
only the reference-cell selection changes.

| Threshold | Reference cells | MODIS intersection / IoU | VIIRS intersection / IoU | Sensor-union intersection / IoU |
|---:|---:|---:|---:|---:|
| 0.5% | 172 | 169 / 0.3159 | 170 / 0.2619 | 171 / 0.2537 |
| 1% | 146 | 145 / 0.2720 | 146 / 0.2257 | 146 / 0.2169 |
| 2% | 123 | 122 / 0.2289 | 123 / 0.1901 | 123 / 0.1828 |
| 5% | 97 | 97 / 0.1823 | 97 / 0.1499 | 97 / 0.1441 |

Overlap rankings and the near-complete recall-like coverage are directionally
stable across thresholds, while IoU and precision-like values vary materially
with the threshold. The 1% threshold is retained as a documented convention,
not because it maximizes any score.

## Temporal and harmonization limits

The final-perimeter reference has no dated progression records. Daily and
monthly temporal agreement with the perimeter cannot therefore be evaluated.
The case study reports this as `NOT_EVALUATED`.

B1 and B2 calibrate scalar monthly active-cell-day activity. They do not
produce predicted perimeters or burned-area probabilities. A spatial
validation ranking of B0/B1/B2 is therefore `NOT_EVALUATED`; the application
does not manufacture spatial predictions from scalar coefficients.

The existing NASA observational calibration remains unchanged:

- Training: 2018-01 through 2020-06.
- Held-out evaluation: 2020-07 through 2022-12.
- Principal held-out 2020 case-study months: July through December.

No parameters are fit or tuned using the 2020 holdout in this pipeline.
