# IGNIS Atlas — FireTruth Scientific Reproducibility Guide

**Document Version:** 2.1.0-STABLE  
**Scope:** Standalone Deterministic Execution, Cryptographic Checksums, and Independent Verification  

---

## 1. Reproducibility Standard

In accordance with NASA Earth Science Data and Information System (ESDIS) Open Science guidelines and the FAIR Data Principles (Findable, Accessible, Interoperable, and Reusable), every numerical result, model calibration parameter, and historical anomaly index presented in **IGNIS Atlas — FireTruth** is 100% deterministically reproducible.

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
**Expected Output:**
- Ingests multi-sensor records.
- Projects coordinates into $25\text{ km} \times 25\text{ km}$ ($625\text{ km}^2$) equal-area grid cells.
- Evaluates B0, B1, and B2 models on overlapping data (2012–2018).
- Exports `data/processed/harmonized_fire_records.json` and updates `science/reproducibility_manifest.json`.

### 3.3 Execute Statistical Validation & Backtesting
To run rolling-origin cross-validation (folds 1–8) and evidence-gate backtesting:

```bash
python -m science.run_evaluation
```
**Expected Output:**
- Evaluates 8 rolling-origin folds from 2017 to 2024 (Mean MAPE: **11.35%**, RMSE: **114.7**, $R^2 = 0.947$).
- Executes cross-regime transfer experiment on Punjab crop residue (MBE: **-461.9 cell-days**, -37% bias).
- Evaluates Evidence Gate backtesting (Unsafe conclusion rate: **0.0%**; Coverage rate: **89.5%**).

### 3.4 Run the Automated Python Test Suite
```bash
pytest
```
**Expected Result:**
- `tests/test_harmonization.py`: 8 passed.
- `tests/test_cross_language.py`: 3 passed.
- **Total: 11 passed (0 failed).**

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

