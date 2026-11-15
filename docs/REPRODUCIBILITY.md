# IGNIS Atlas — FireTruth Scientific Reproducibility Guide

**Document Version:** 2.1.0-STABLE  
**Scope:** Standalone Deterministic Execution, Cryptographic Checksums, and Independent Verification  

---

## 1. Reproducibility Standard

### Authentic NASA FIRMS acquisition

The verified local California observational run is represented in the
frontend by `src/data/nasaObservationalData.json`. It was built from:

- MODIS_SP: 366 successful five-day batches, 136,743 raw observations.
- VIIRS_SNPP_SP: 366 successful five-day batches, 613,099 raw observations.
- 60 complete overlapping months, processed on a 25 km authalic sinusoidal
  equal-area grid with the `nominal_high` confidence policy.
- Chronological training: 2018-01 through 2020-06.
- Chronological holdout: 2020-07 through 2022-12.
- B0 RMSE: 694.74 cell-days; B1 alpha: 3.2814 and RMSE 478.58 cell-days;
  B2 RMSE: 464.29 cell-days.

The artifact preserves per-batch SHA-256 inputs and provenance metadata but
does not include individual hotspot coordinates. Positive detections do not
establish complete orbital observation coverage, and VIIRS is a comparison
reference rather than ground truth.

### Spatial disagreement artifact

`public/data/nasaSpatialDisagreement.json` is generated locally by:

```powershell
python -m science.generate_spatial_artifact `
  --raw-dir data\nasa_firms\raw `
  --output public\data\nasaSpatialDisagreement.json
```

The generator reads only the 732 manifest-listed raw batches; it does not
download data. It reuses the 25 km authalic sinusoidal grid and
`nominal_high` confidence policy, deduplicates each sensor to one cell-day,
and writes 918 cells and 13,439 cell-month rows. Same-day agreement is the
intersection of sensor cell-days. The default temporal sensitivity comparison
uses greedy one-to-one matching within +/-1 UTC day, so a detection cannot be
counted multiple times.

Sensor-only cell-months are disagreement categories, not false positives or
false negatives. FIRMS positive records do not establish that the other
sensor had a clear-sky observation opportunity. The browser artifact contains
cell geometry and aggregate counts, not raw records or credentials.

Artifact SHA-256:
`4C811DE6D066EF2C514CCBC0D966CFBCB27B714DFCB2C0464EFDEF9150C3FA7`.

The bundled multi-year application benchmark is synthetic and is not an
authentic NASA validation dataset. Authentic FIRMS standard-processing files
must be acquired separately using a user-owned NASA FIRMS MAP_KEY. Downloads
are intentionally excluded from Git by `.gitignore`; their SHA-256 hashes and
request metadata are written to a local manifest.

The official FIRMS Area API supports five-day windows. For California,
2018-01-01 through 2022-12-31, run the following in PowerShell after
requesting a MAP_KEY from NASA:

```powershell
$env:FIRMS_MAP_KEY = "<your NASA FIRMS MAP_KEY>"
python -m science.acquire_firms --source MODIS_SP --start-date 2018-01-01 --end-date 2022-12-31
python -m science.acquire_firms --source VIIRS_SNPP_SP --start-date 2018-01-01 --end-date 2022-12-31
```

The key is read only from `FIRMS_MAP_KEY`, never placed in the command
arguments, frontend code, or provenance manifest. If the API rejects a
historical request or NASA requires archive email authorization, download the
corresponding files manually from the official archive and place the
unchanged CSV files under `data/nasa_firms/raw/`. Record their SHA-256 values
with `Get-FileHash` and process them with `science.ingest_firms`; do not treat
failed requests as zero observations.

Official sources:

- [NASA FIRMS archive](https://firms.modaps.eosdis.nasa.gov/download/)
- [NASA FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/)
- [NASA FIRMS data tools](https://www.earthdata.nasa.gov/data/tools/firms)

The authenticated raw archive remains local and excluded from Git. The
committed browser artifacts contain the verified monthly and spatial
aggregates; raw CSV files and NASA credentials are never committed.

In accordance with NASA Earth Science Data and Information System (ESDIS) Open Science guidelines and the FAIR Data Principles (Findable, Accessible, Interoperable, and Reusable), every numerical result in the bundled **synthetic demonstration benchmark** is deterministically reproducible. It is not an authentic NASA observational validation dataset.

Reproducibility is maintained across two independent calculation engines:
1. **Authoritative Python Engine (`science/`):** Executes batch spatial projection, rolling-origin cross-validation, and evidence-gate backtesting from terminal environments.
2. **Interactive TypeScript Engine (`src/science/`):** Implements identical authalic sinusoidal math and the 6-gate audit in the browser without server dependencies.

---

## 2. Cryptographic Checksums & Manifest

All processed data files and shared test fixtures are cryptographically signed with SHA-256 hashes to guarantee data integrity:

| File / Component | Relative Path | SHA-256 Checksum | Purpose |
|---|---|---|---|
| **Harmonized Dataset (Python Output)** | `data/processed/harmonized_fire_records.json` | `1b060834e7d465e3fbb63c77d281ade75e3058ba1609171802018d9fd3b50a72` | Authoritative 26-year matrix (2000–2025) across California, Punjab, Amazon, and NSW. |
| **Synchronized App Dataset** | `src/data/processed_dataset.json` | `1b060834e7d465e3fbb63c77d281ade75e3058ba1609171802018d9fd3b50a72` | Bit-for-bit identical bundle loaded by the React 19 client. |
| **Cross-Language Fixture** | `tests/fixtures/shared_calibration_fixture.json` | `b3d4f8e91823a07c12658140db7fca7e2e8e9324536768297491acbe8249021e` | Shared coordinates and expected calculations tested by both Python and Node. |
| **Reproducibility Manifest** | `science/reproducibility_manifest.json` | `9d554a9cb4e33917d0577a64112e2c8152c92a9c148bb091993457a3e7401a41` | Manifest tracking algorithm parameters and evaluation splits. |

---

## 3. Step-by-Step Python Reproduction

### 3.1 Environment Setup
Prerequisites: Python 3.10+ (tested through Python 3.13).

```bash
# Clone the repository
git clone https://github.com/prushti1521/Ignis-Atlas.git
cd Ignis-Atlas

# Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install required dependencies
pip install -r science/requirements.txt
```

### 3.2 Execute the Science Pipeline
To run the full ingestion, authalic sinusoidal spatial discretization, cell-day deduplication, and B2 regularized calibration pipeline:

```bash
python -m science.run_pipeline
```
**Expected Output for the bundled demonstration:**
- Ingests the repository's synthetic multi-sensor records.
- Projects coordinates into $25\text{ km} \times 25\text{ km}$ ($625\text{ km}^2$) equal-area grid cells.
- Evaluates B0, B1, and B2 models on synthetic overlapping data (2012–2018).
- Exports `data/processed/harmonized_fire_records.json` and updates `science/reproducibility_manifest.json`.

### 3.3 Execute Statistical Validation & Backtesting
To run rolling-origin cross-validation (folds 1–8) and evidence-gate backtesting:

```bash
python -m science.run_evaluation
```
**Expected Output:**
- Evaluates the rolling-origin folds on the synthetic demonstration benchmark.
- Executes the cross-regime transfer experiment on synthetic Punjab crop-residue records.
- Evaluates the evidence-gate logic on synthetic demonstration records.

These metrics are not real-world NASA validation results. Authentic-data
metrics remain `NOT EVALUATED` until the acquisition workflow above has been
completed and its provenance manifest is supplied.

### 3.4 Run the Automated Python Test Suite
```bash
pytest
```
**Expected Result:**
- `tests/test_harmonization.py`: 12 passed.
- `tests/test_firms_acquisition.py`: 4 passed.
- `tests/test_cross_language.py`: 3 passed.
- **Total: 19 passed (0 failed).**

---

## 4. Step-by-Step React / TypeScript Reproduction

### 4.1 Install Node Dependencies
Prerequisites: Node.js 18+ (tested on Node 20 / 22 / 24).

```bash
npm install
```

### 4.2 Run Cross-Language Node Parity Tests
```bash
npm test
```
**Expected Result:**
- Verifies Node.js projection coordinates match shared fixture to within 0.01 km.
- Confirms mathematical parity between browser JavaScript and Python science engine.

### 4.3 Run Linting and Code Integrity Verification
```bash
npm run lint
```
**Expected Result:**
- `oxlint`: 0 warnings, 0 errors.

### 4.4 Build Production Client
```bash
npm run build
```
**Expected Result:**
- Compiles production bundle cleanly via Vite with zero TypeScript errors.

### 4.5 Launch Local Development Server
```bash
npm run dev
```
- Open browser at `http://localhost:5173`.
- Explore all 8 views, test local NASA FIRMS CSV upload, run the 6-step Scientific Challenge walkthrough, and inspect the 6 Evidence Gates.
