# IGNIS Atlas — FireTruth
### *One Fire History. Multiple Satellites. Evidence You Can Trust.*

[![NASA Space Apps Challenge 2026](https://img.shields.io/badge/NASA%20Space%20Apps-2026-0284c7?style=for-the-badge&logo=nasa)](https://www.spaceappschallenge.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React%2019-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

---

## 🛰️ Overview & Challenge Statement

Active fire hotspots tracked from Earth orbit provide the critical foundation for early warnings, disaster response, and climate impact models. However, the multi-decadal historical record is split across fundamentally disparate sensors:
- **MODIS (Terra & Aqua)**: Operational since 2000 / 2002 with a **1,000 m** nadir footprint.
- **VIIRS (Suomi-NPP & NOAA-20)**: Operational since 2012 / 2017 with a **375 m** I-band footprint.

Because a VIIRS 375m pixel covers **7.1 times less surface area** than a MODIS 1km pixel, it experiences 7x less sub-pixel thermal dilution. Over the exact same fire perimeter, VIIRS registers **3.5x to 6x more detected hotspots** than MODIS.

> **The 2012 False Surge Paradox**: Naively comparing raw hotspot counts between 2008 (MODIS era) and 2018 (VIIRS era) creates the illusion of a **+370% surge** in burning activity. This is an artifact of changing satellite resolution.

**IGNIS Atlas — FireTruth** harmonizes NASA FIRMS observations into an **Evidence-Gated Burning Activity Calendar** to separate authentic physical trends from observation artifacts.

---

## 🌟 Key Capabilities & Architecture

| Module | Purpose | Acceptance Criterion Met |
| :--- | :--- | :--- |
| **1. Global Fire Explorer** | Interactive Leaflet map with dark cartography, FRP scaling, day/night toggles, and temporal scrubbers. | Full NASA FIRMS schema inspection (`brightness_kelvin`, `scan`, `track`, `frp`, `confidence`). |
| **2. Burning Activity Calendar** | 26-Year Matrix Heatmap (2000–2025) across 12 calendar months with 4 accessible palettes (Magma, Cividis, Viridis, Anomaly). | Standardized HSFAI cell-day aggregation, multi-year median anomaly calculation, and cell traceability. |
| **3. Sensor Harmonization Lab** | Empirical calibration workbench comparing raw $B_0$, proportional scaling $B_1$, and regularized seasonal model $B_2$. | Strictly evaluated on held-out out-of-sample years (2019–2024); interactive scatter plot with 1:1 parity line. |
| **4. FireTruth Evidence Resolver** | **Signature Innovation**: 5-Gate scientific verification engine certifying claims as `SUPPORTED`, `QUALIFIED`, or `INSUFFICIENT EVIDENCE`. | Distinguishes sensor transitions, cloud gaps, and regime transfer failures from real fire changes. |
| **5. Explain the Science** | Interactive sensor physics simulator showing sub-pixel fire dilution, the off-nadir bow-tie effect, and cloud obscuration. | Demonstrates why $0\text{ hotspots} \neq 0\text{ fires}$. |
| **6. Reproducible Dossier & Export** | One-click NASA Technical Memorandum generator and downloadable full CSV dataset. | Complete provenance metadata, calibration coefficients, and reproducibility hashes. |

---

## 🔬 Mathematical Formulations

### 1. Equal-Area Common-Grid Discretization
To eliminate multi-detection clustering within contiguous pixels during a single satellite pass while preserving regional fire persistence:

$$I_{s,g,d} = \begin{cases} 1 & \text{if sensor } s \text{ detects activity in cell } g \text{ on day } d \\ 0 & \text{otherwise} \end{cases}$$

Monthly active cell-days:
$$A_{s,m} = \sum_{g} \sum_{d \in m} I_{s,g,d}$$

### 2. Overlap Period Calibration & Models
- **Model $B_0$ (Raw Uncorrected)**: $\widehat{A}_{V,m} = A_{M,m}$ ($\text{Held-out MAPE} = 64.2\%$)
- **Model $B_1$ (Proportional Scaling)**: $\widehat{A}_{V,m} = \alpha A_{M,m}$ ($\text{Held-out MAPE} = 12.8\%$)
- **Model $B_2$ (Regularized Seasonal Calibration)**: $\widehat{A}_{V,m} = \alpha_k A_{M,m}$ with $L_2$ shrinkage ($\text{Held-out MAPE} = 11.4\%$, **Winning Model**)

### 3. Historical Anomaly Reference (Detecting Unusual Fire Seasons)

$$D_{y,k} = H_{y,k} - \text{median}(H_{*,k})$$

$$\text{Relative Anomaly (\%)} = \left(\frac{D_{y,k}}{\text{median}(H_{*,k})}\right) \times 100\%$$

#### 💡 In Plain English: What does this formula actually do?
This formula answers a vital question for scientists and emergency managers:  
> **"Did this region burn unusually more (or less) than normal for this exact time of year?"**

#### Formula Component Breakdown:
| Symbol | Plain-English Term | What It Measures |
| :--- | :--- | :--- |
| **$D_{y,k}$** | **Fire Activity Anomaly** | The difference between observed burning and historical baseline. A positive ($+$) value indicates an unusually severe fire season; a negative ($-$) value indicates a calm, suppressed season. |
| **$H_{y,k}$** | **Observed Fire Activity** | The standardized Harmonized Satellite Fire Activity Index (HSFAI active cell-days) detected in year $y$ during calendar month $k$ (for example, August 2020). |
| **$\text{median}(H_{*,k})$** | **Historical Baseline** | The middle (typical) burning level for that specific month $k$ across all 25 years of observations (2000–2025). |

#### Why use the **Median** instead of the Average (Mean)?
Wildfires follow extreme power-law distributions. A single catastrophic year (such as California's 2020 August Complex fire siege) would artificially inflate a standard mathematical average. The **median** is statistically resistant to extreme outliers, providing an honest baseline of what a "typical" fire season looks like in that region.

#### Real-World Example:
- In California, a typical August historically registers a median of **420 active cell-days**.
- During the historic lightning siege of **August 2020**, satellites recorded **1,722 cell-days**.
- **Calculation**:
  $$D_{2020, \text{Aug}} = 1,722 - 420 = +1,302 \text{ cell-days} \quad (+310\% \text{ above normal})$$
- The calendar immediately displays this cell in deep crimson fire alert, flagging it as an extreme historic anomaly.

## 🛡️ The 5 Scientific Evidence Gates

```
Historical Comparison Query (Period A vs Period B)
        │
        ▼
[Gate 1: Domain Validity Gate] ──────────► Checks peak intensity within training envelope
        │
        ▼
[Gate 2: Calibration Stability Gate] ────► Validates held-out error (MAPE ≤ 15%)
        │
        ▼
[Gate 3: Sensitivity Invariance Gate] ───► Verifies direction holds across 0.1°, 0.25°, 0.5° grids
        │
        ▼
[Gate 4: Observation Completeness Gate] ─► Evaluates cloud mask attenuation (>60% flags insufficient)
        │
        ▼
[Gate 5: Cross-Sensor Concordance Gate] ─► Confirms multi-satellite consensus during overlap
        │
        ▼
Verdict: 🟢 SUPPORTED  |  🟡 QUALIFIED  |  🔴 INSUFFICIENT EVIDENCE
```

---

## 🌍 Geographic Research Regimes

- **California (Wildfire Regime)**: High-intensity forest/chaparral fires. $\alpha = 3.68\times$. Captures landmark events: 2003 Cedar, 2008 Lightning Siege, 2017 Tubbs, 2018 Camp Fire, and the record 2020 August Complex (4.3M acres).
- **Punjab & Haryana, India (Agricultural Regime)**: Post-harvest paddy stubble burning in Oct–Nov. $\alpha = 5.84\times$. Small, short-lived fires undetectable by MODIS 1km prove that single global calibration ratios fail across contrasting fire regimes.
- **Amazon & Pantanal (Tropical Deforestation & Drought)**: Severe wet-season cloud obscuration ($>85\%$) triggers the Observation Completeness Gate.
- **SE Australia (Bushfire & Pyrocumulonimbus)**: 2019–2020 "Black Summer" pyro-convective saturation.

---

## 🚀 Quickstart & Local Installation

### Prerequisites
- Node.js v18+ (tested on Node v22)
- npm v10+

### Installation
```bash
# Clone the repository
git clone https://github.com/prushti1521/Ignis-Atlas.git
cd Ignis-Atlas

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173/` in your browser.

### Build Production Bundle
```bash
npm run build
```

---

## 📊 Data Ingestion & Provenance
- **NASA FIRMS EOSDIS**: MODIS Collection 6.1 (Terra & Aqua) and VIIRS 375m (Suomi-NPP VNP14IMG / NOAA-20 VJ114IMG).
- **Format**: Science-quality archive (2000–2025).

---

## 📄 License
MIT License. Developed for the NASA International Space Apps Challenge.
