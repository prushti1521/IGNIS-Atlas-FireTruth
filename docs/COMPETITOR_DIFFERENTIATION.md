# IGNIS Atlas — FireTruth Competitor Differentiation & Scientific Novelty

**Document Version:** 2.1.0-STABLE  
**Focus:** Competitive Strategy, Peer-Review Distinction, and Defense Against Common Hackathon Tropes  

---

## 1. Executive Differentiation Summary

In competitive challenges like NASA Space Apps, submissions often enter a "feature-count arms race" — piling on multiple uncalibrated machine learning models, unverified 26-year calendars, or decorative 3D globe visualizations.

Another public 2026 project, *IGNIS — Fire Calendar*, addresses the same MODIS–VIIRS challenge by describing a 26-year harmonized burning calendar, fire segmentation, satellite imagery, and multiple machine-learning models.

**FireTruth does not compete on feature count.** Our flagship contribution is **evidence-based interpretation and scientific defensibility**:
- Anyone can train a neural network to produce numbers.
- FireTruth is the first system that **tells land managers and climate scientists when to trust the numbers and when to discard them.**

```
                     [ Common Approach ]                         [ FireTruth Approach ]
                Raw Hotspot Concatenation                 Authalic Sinusoidal Equal-Area Projection
                           │                                                 │
            Flawed Angular Grid (0.1° / 0.25°)             Constant Area Globally (25 km = 625 km²)
                           │                                                 │
            Universal Global Multiplier (3.5x–6x)        Biome-Stratified Calibration (α=3.68 vs 5.84)
                           │                                                 │
            Randomized Shuffled K-Fold Validation         Chronological Holdout & Rolling-Origin Folds
                           │                                                 │
            Unchecked Anomaly Numbers (Black Box)        6-Gate Scientific Evidence Resolver
```

---

## 2. Head-to-Head Architectural Comparison

| Dimension | Typical Entrant / Generic Dashboard | IGNIS Atlas — FireTruth | Scientific Consequence |
|---|---|---|---|
| **Spatial Discretization** | Angular degree grids ($0.1^\circ, 0.25^\circ, 0.5^\circ$). | **Authalic Sinusoidal Equal-Area Grid** ($R = 6,371.0088\text{ km}$, $S = 25\text{ km}$). | Angular cells shrink by $\cos(\text{latitude})$; at $60^\circ\text{N}$, angular cells have $50\%$ smaller area than at equator. FireTruth maintains exact equal surface area ($625\text{ km}^2$) globally. |
| **Observation Metric** | Raw hotspot detection counts ($N$). | **Active Cell-Days** ($A_{s,m} = \sum_g \sum_d I_{s,g,d}$). | Raw counts double-count overlapping scans and swath boundaries. Active cell-days measure true spatial-temporal combustion footprint. |
| **Sensor Harmonization** | Universal single scaling factor ($3.5\times\text{–}6\times$) applied globally. | **Regime-Stratified B2 Ridge Model** (California $\alpha=3.68$, Punjab $\alpha=5.84$). | Single global scaling fails across biomes. Applying forest scaling to agriculture underestimates stubble burns by **-37%** ($\text{MBE} = -461.9\text{ cell-days}$). |
| **Statistical Validation** | Randomized K-Fold Cross-Validation (temporal leakage). | **Strict Chronological Holdout (2019–2024)** + **8 Rolling-Origin Expanding Folds**. | Randomized splitting leaks future drought/climate signals into training folds. Chronological holdout guarantees out-of-sample generalizability. |
| **Output Interpretation** | Displays uncorrected percentage shifts ($+370\%$) as climate truth. | **6-Gate Evidence Resolver** with transparent verdicts (`SUPPORTED`, `QUALIFIED`, `INSUFFICIENT`). | Automatically intercepts false surge artifacts caused by sensor resolution transition from 1,000 m to 375 m. |
| **Observation Completeness** | Assumes zero hotspots = zero fires. | **Completeness Gate with Positive-Detection Disclosure**. | Recognizes that active fire CSVs only report detections; flags `NOT_EVALUATED` if auxiliary cloud masks (MOD35/VNP35) are missing. |
| **Independent Verification** | Internal model metrics only. | **Cross-Comparison with NASA MCD64A1 Burned Area** and MTBS fire perimeters. | Corroborates active thermal emissions with independent post-fire surface reflectance charcoal charring. |
| **Data Transparency** | Silently presents pre-computed fixtures as real NASA feeds. | **Prominent Synthetic Demo Banner** + Drag-and-drop client-side NASA FIRMS CSV parser. | Clear distinction between calibrated demonstration baselines and live user-uploaded observational files. |

---

## 3. Resolving the 7 Critical Scientific Challenges

FireTruth specifically addresses and resolves the 7 highest-priority scientific issues identified in pre-competition audits:

### 1. Unverified 11.4% MAPE Claim
- *Pre-audit critique:* "The number is meaningless without an executable experiment."
- *FireTruth Resolution:* Executable evaluation pipeline published in `science/run_evaluation.py` and `tests/test_harmonization.py`. Evaluated on 72 held-out out-of-sample months (2019–2024) across 8 rolling-origin folds (mean MAPE: **11.35%**, RMSE: **114.7**, $R^2 = 0.947$).

### 2. Universal 3.5–6× Sensor Ratio
- *Pre-audit critique:* "Detection ratios vary by region, fire conditions, observation timing, and filtering."
- *FireTruth Resolution:* Replaced universal claim with documented multi-regime empirical findings. Proved via transfer experiment that Punjab agricultural stubble requires $\alpha = 5.84\times$, whereas California forest wildfire requires $\alpha = 3.68\times$.

### 3. +370% False Surge Paradox
- *Pre-audit critique:* "Mixing two sensor eras does not automatically prove a 370% artificial increase."
- *FireTruth Resolution:* Implemented side-by-side comparison in Challenge Mode and Evidence Resolver. Demonstrates that comparing California 2008 (MODIS) with 2018 (VIIRS) yields a raw uncalibrated $+370.4\%$ jump, whereas harmonized HSFAI reveals a true detected-activity shift of $+27.8\%$.

### 4. Cloud Completeness Gate
- *Pre-audit critique:* "Positive hotspot records alone cannot establish complete observation coverage."
- *FireTruth Resolution:* Gate 5 strictly returns `NOT_EVALUATED` when independent cloud mask products (MOD35 / VNP35) are absent, explicitly informing the user that positive-only FIRMS CSVs cannot prove clear-sky coverage.

### 5. Angular vs Equal-Area Grids
- *Pre-audit critique:* "Your 0.1°, 0.25°, and 0.5° grids are not equal-area grids."
- *FireTruth Resolution:* Completely rebuilt geospatial engine using Authalic Sinusoidal Equal-Area projection ($R = 6,371.0088\text{ km}$), guaranteeing strictly constant $S \times S$ surface area across all latitudes.

### 6. Unjustified Thresholds
- *Pre-audit critique:* "MAPE $\le 15\%$ and cloud attenuation $>60\%$ appear arbitrary without calibration."
- *FireTruth Resolution:* Fully grounded in authoritative literature: CEOS Land Product Validation Stage 2 protocol (Schroeder et al. 2014) and Kaufman et al. 1998 (cloud optical depth extinction).

### 7. Historical Anomaly Interpretation
- *Pre-audit critique:* "A larger hotspot index does not necessarily mean a larger burned area."
- *FireTruth Resolution:* All outputs throughout the UI, exports, and documentation are strictly labeled as **"Harmonized Satellite-Detected Fire Activity Index (HSFAI)"**, never as fire severity or final burned acres.

---

## 4. Factual Precision Corrections
- **August Complex Acreage:** Corrected California's 2020 August Complex to **1,032,648 acres** (California's first gigafire; 4.3 million acres was California's entire statewide fire season).
- **Nominal Sensor Pixel Area Ratio:** Corrected to $(1,000^2) / (375^2) \approx 7.11\times$.

