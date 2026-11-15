# INITIAL SCIENTIFIC & TECHNICAL AUDIT
**Project**: IGNIS Atlas — FireTruth (NASA Space Apps Challenge 2026)  
**Date**: November 7, 2026  
**Auditors**: Remote Sensing Scientist, Python Scientific Software Engineer, React 19 Architect, Reproducibility Specialist  
**Evaluation Standard**: Strict NASA Space Apps Global Award Readiness (Best Use of Science & Best Use of Data)

---

## 1. Executive Summary

This initial audit examines the existing codebase of `IGNIS Atlas — FireTruth` across Python scientific pipelines, React 19 + TypeScript frontend components, geospatial algorithms, statistical validation routines, and data artifacts.

The project possesses a compelling scientific premise: resolving the **2012 MODIS-to-VIIRS sensor resolution discontinuity** (1,000 m nadir footprint to 375 m I-band footprint) and exposing the artificial "+370% false surge" produced by uncalibrated cross-era hotspot counting. However, a rigorous audit reveals critical differences between claimed capabilities and actual implementation that must be systematically addressed to meet NASA Global Award standards.

---

## 2. Component-by-Component Audit Findings

### 2.1 Verified Working Features
* **Build & Type Checking**: The project builds successfully with `npm run build` using React 19, TypeScript 7, and Vite 8 (`dist/assets/index-CZIuathA.js`, 496 kB).
* **Automated Regression Suite**: 8 Python regression tests pass cleanly under `pytest` (0.81s) testing temporal boundaries, common-grid deduplication, and baseline error reductions.
* **Executable Validation Harness**: `science/run_evaluation.py` executes cleanly, calculating MAE, RMSE, and MAPE across in-sample (2012–2018) and held-out (2019–2024) periods.
* **JSON Compliance**: The scientific pipeline outputs valid standard JSON (`null` rather than non-standard `NaN`) in `data/processed/harmonized_fire_records.json` and `src/data/processed_dataset.json`.
* **Expandable Gate UI**: `src/components/EvidenceResolverView.tsx` provides accordion drill-downs exposing input data, mathematical formulations, and limitations for audit gates.

### 2.2 Partially Implemented Features
* **Navigation & Architecture**: The UI currently has 5 tabs (`explorer`, `calendar`, `lab`, `resolver`, `science`). It lacks dedicated interfaces for:
  1. **FireTruth Scientific Challenge Mode** (a step-by-step flagship investigative workflow).
  2. **Scientific Evidence Dossier** (standalone dossier viewer with multi-format export).
  3. **Overview / Executive Context**.
* **Real NASA Data Ingestion**: `science/ingest.py` defines metadata schemas and constellation timelines, but `science/pipeline.py` and `src/data/historicalFireData.ts` generate observations using parametric sinusoidal models with realistic fire siege multipliers rather than parsing raw NASA FIRMS CSV/SHP archives.
* **Data Separation**: Demonstration fixtures and calibrated records are presented without an explicit, prominent **SYNTHETIC DEMONSTRATION** banner, risking confusion for NASA evaluators.
* **Equal-Area Grid**: `science/aggregate.py` uses cosine-latitude projection scaling on longitude steps ($\Delta \lambda = S / (111.32 \cos \phi)$). While this approximates equal cell areas locally, it does not use a standardized projected Coordinate Reference System (CRS) such as Albers Equal Area (ESRI:102008 for CA) or Cylindrical Equal-Area (EPSG:6933 / EASE-Grid 2.0).

### 2.3 Synthetic or Hardcoded Scientific Results
* **Calibration Ratios**: Base ratios ($\alpha = 3.68$ for California, $\alpha = 5.84$ for Punjab, $\alpha = 4.15$ for Amazon, $\alpha = 3.42$ for Australia) are set as configuration parameters in `science/pipeline.py` and `src/data/regions.ts` rather than dynamically derived from a live ingestion of raw FIRMS archives.
* **Cloud Cover Metrics**: Cloud obscuration percentages are currently generated via seasonal monthly functions (e.g. Amazon wet season 75–85%, California winter 45–65%) rather than parsed from MODIS/VIIRS cloud mask products (MOD35 / VNP35) or Earthdata products.
* **Sample Hotspots**: `src/data/sampleHotspots.ts` contains 28 sample hotspot records. While accurate in schema, they represent a demonstration fixture rather than a live geospatial query.

### 2.4 Incorrect or Unsupported Claims in Prior Iterations
* **Observation Completeness from Hotspots**: A positive hotspot detection CSV (e.g. FIRMS standard output) registers *only where fire was detected*. It provides zero information on orbital scan gaps, cloudy overpasses, or instrument blind spots. Claiming that positive hotspot records alone prove observation coverage is scientifically invalid. When independent cloud mask/orbital coverage data is absent, the gate must evaluate to `NOT_EVALUATED`.
* **Universal Scaling**: The claim of a universal 3.5–6× ratio was overly broad. Empirical ratios vary by fire radiative power distribution, canopy cover, and fuel type.
* **Burned Area Equivalence**: Hotspots reflect instantaneous active thermal emissions during satellite overpass; they are not measurements of total burned area.

### 2.5 Statistical Validation Weaknesses
* **Single Train/Test Split**: Calibration currently evaluates only on a fixed split (Train: 2012–2018, Test: 2019–2024). It lacks **Rolling-Origin Validation** (e.g., training on 2012–2015 -> testing on 2016; training on 2012–2016 -> testing on 2017) to verify that calibration parameters do not drift over time.
* **Missing Uncertainty Intervals on Differences**: The Evidence Resolver calculates percentage change but does not propagate model RMSE to compute a formal uncertainty interval $[\Delta_{\text{harmonized}} \pm 1.96 \sigma_{\text{residual}}]$.
* **Missing Evidence-Gate Backtesting**: There is no quantitative backtesting showing the **Unsafe Conclusion Rate** vs. **Coverage Rate** across all possible historical year pairs.

### 2.6 UI/UX Weaknesses & Oxlint Warnings
* **React Purity Warning**: `src/components/EvidenceReportModal.tsx` calls `new Date().toISOString()` directly inside component render, triggering React 19 purity warnings.
* **State in Effect Warning**: `src/components/ExplorerMap.tsx` calls `setCustomBbox` synchronously inside `useEffect`, causing cascading renders.
* **Visual Data Status Flags**: The interface does not clearly display data provenance badges (`REAL NASA ARCHIVE`, `SYNTHETIC BENCHMARK FIXTURE`, `MODEL TRANSLATED ESTIMATE`, `NOT EVALUATED`).
* **Map Performance**: Leaflet renders all points without clustered bounds if a large dataset is loaded.

---

## 3. Existing Test Results

### 3.1 Python Test Suite (`pytest`)
* **Execution Command**: `pytest`
* **Status**: 8 passed in 0.81s
* **Coverage**:
  - `test_temporal_boundary_rules`: Commissioning date validation.
  - `test_equal_area_spatial_discretization_deduplication`: Daily cell-day deduplication.
  - `test_equal_area_cosine_latitude_projection`: Equal area scaling.
  - `test_nominal_sensor_pixel_area_ratio`: 1,000 m vs 375 m pixel ratio ($\approx 7.11\times$).
  - `test_calibration_error_reduction`: B1/B2 held-out RMSE reduction vs B0.
  - `test_cross_regime_transfer_failure`: California model transfer to Punjab ($\text{MBE} < -300$).
  - `test_claim_centered_evidence_audit_drilldowns`: Gate audit drill-downs.
  - `test_observation_completeness_gate_cloud_failure`: Cloud $>60\%$ flags FAIL.

### 3.2 Frontend Production Build (`npm run build`)
* **Execution Command**: `npm run build` (`tsc -b && vite build`)
* **Status**: Clean exit code 0 in 674ms.
* **Bundle Output**: `dist/assets/index-CZIuathA.js` (496 kB gzip: 145 kB).

### 3.3 Static Code Analysis (`npm run lint` / `oxlint`)
* **Status**: 2 warnings (React 19 compiler purity & set-state-in-effect).

---

## 4. High-Priority Engineering Risks & Gaps

1. **Synthetic vs. Real Data Transparency**: Without an unmistakable indicator, judges may perceive modeled benchmark demonstrations as an attempt to pass off synthetic data as raw NASA downloads.
2. **Missing Real Data Ingestion Pipeline**: Ingestion must support drag-and-drop or local file loading of genuine NASA FIRMS CSVs (`MODIS_C6_1_...csv`, `VIIRS_SNPP_...csv`, `VIIRS_NOAA20_...csv`) with full schema parsing and validation.
3. **Rigorous CRS Projection**: The equal-area calculation must explicitly support documented standard projection geometries (e.g. Albers Equal Area for regional benchmarks, cylindrical equal-area for global) with 5 km, 10 km, and 20 km cell dimensions.
4. **Missing 6th Gate (Independent Evidence)**: The Evidence Resolver currently implements 5 gates. The master specification requires 6 gates, including **Gate 6: Independent Evidence** comparing active fire trends against NASA MCD64A1 Burned Area products.
5. **Missing Scientific Challenge Mode**: The interactive flagship walkthrough where a user formulated, challenged, and verified a real historical claim needs a dedicated React module.

---

## 5. Strategic Implementation Roadmap

| Phase | Core Objective | Key Deliverables |
| :---: | :--- | :--- |
| **Phase 1** | One Scientific Source of Truth | Shared Python architecture, versioned JSON schema, prominent synthetic data banner in React. |
| **Phase 2** | Real NASA FIRMS Ingestion Engine | Standardized CSV ingestion supporting Terra, Aqua, S-NPP, NOAA-20, schema normalization, and user file upload. |
| **Phase 3** | True Equal-Area Projection & CRS | Documented Equal-Area grid with 5km, 10km, 20km cells; WGS84 to Equal-Area transformations; cell-day deduplication. |
| **Phase 4** | Calibration & Rolling-Origin Validation | B0, B1, B2 models with rolling-origin time-aware cross-validation, explicit low-activity handling, `docs/CALIBRATION_VALIDATION.md`. |
| **Phase 5** | Cross-Regime & Backtesting Engines | Cross-regime transfer evaluation, sensitivity analysis across grid sizes/policies, evidence-gate backtesting (unsafe conclusion rate vs coverage). |
| **Phase 6** | 6-Gate Evidence Resolver Upgrade | Domain, Stability, Change vs Uncertainty, Sensitivity, Completeness (FIRMS positive limit), and Independent Evidence (MCD64A1). |
| **Phase 7** | FireTruth Scientific Challenge Mode | Flagship interactive 6-step React workflow investigating real California wildfire history. |
| **Phase 8** | Scientific Evidence Dossier & Exports | Dossier generator exporting Markdown, JSON, and CSV with complete cryptographic provenance hashes. |
| **Phase 9** | Independent Validation (MCD64A1) | Contextual comparison between active fire HSFAI and MCD64A1 burned area, documented in `docs/INDEPENDENT_VALIDATION.md`. |
| **Phase 10** | React 19 UI Polish & Navigation | 8-tab scientific navigation, accessible styling, oxlint purity fix, performance optimization. |
| **Phase 11** | Automated Verification & Tests | Cross-language test fixtures (Python vs TS), end-to-end integration tests, pytest & build passes. |
| **Phase 12** | NASA Award Documentation Suite | Complete `docs/` repository covering methodology, limitations, data sources, competitor differentiation, checklist. |
| **Phase 13** | Strict Final Review & Audit | Independent peer review audit in `docs/FINAL_SCIENTIFIC_AUDIT.md`. |

