# IGNIS Atlas — FireTruth Scientific Methodology

**Document Version:** 2.1.0-STABLE  
**Target Category:** NASA Space Apps Challenge 2026 — Best Use of Science & Best Use of Data  
**Primary Focus:** Harmonization of MODIS and VIIRS Earth Observation Active Fire Hotspots  

---

## 1. Executive Scientific Overview

The Moderate Resolution Imaging Spectroradiometer (MODIS) aboard NASA's Terra (launched 1999) and Aqua (launched 2002) satellites and the Visible Infrared Imaging Radiometer Suite (VIIRS) aboard Suomi-NPP (launched 2011), NOAA-20 (launched 2017), and NOAA-21 (launched 2022) provide an indispensable 26-year multi-decadal record of global thermal anomalies.

However, naive multi-decadal time-series analysis across these instruments introduces catastrophic observational artifacts:
1. **Spatial Footprint Discontinuity:** The nominal pixel area of MODIS at nadir is $1,000\text{ m} \times 1,000\text{ m} = 1,000,000\text{ m}^2$, whereas VIIRS I-band resolution is $375\text{ m} \times 375\text{ m} = 140,625\text{ m}^2$. The nominal pixel area ratio is:
   $$\frac{1000^2}{375^2} = \frac{1,000,000}{140,625} \approx 7.111\times$$
   Because thermal infrared sub-pixel fire detection depends exponentially on the sub-pixel flaming temperature ($T^4$ radiance via the Stefan-Boltzmann law and Planck function), a single continuous flaming front is resolved by VIIRS into 3.5× to 6× more individual detections than MODIS.
2. **False Surge Artifact:** Directly concatenating raw MODIS detections (2000–2011) with VIIRS detections (2012–present) creates a spurious artificial surge of up to **+370%**, creating the false impression of an abrupt climate catastrophe where none exists.
3. **Off-Nadir Pixel Growth:** MODIS pixels expand by up to 5× in scan direction ($~4.8\text{ km} \times 2.0\text{ km}$) at swath edges ("bowtie effect"), whereas VIIRS implements on-board 3:1 aggregation that constrains pixel growth to only ~2× ($~0.8\text{ km} \times 0.8\text{ km}$).

**FireTruth** establishes a mathematically rigorous, evidence-gated framework that maps multi-satellite observations onto an invariant equal-area coordinate space, applies regularized calibration models, and validates historical claims through a 6-gate scientific resolver.

---

## 2. Geospatial Framework: Authalic Sinusoidal Equal-Area Grid

### 2.1 Why Angular Grids Are Scientifically Invalid for Global Biomass Burning
Many existing tools bin hotspot detections into angular degree bins (e.g., $0.1^\circ \times 0.1^\circ$ or $0.25^\circ \times 0.25^\circ$). On a sphere, the surface area subtended by an angular cell of dimensions $\Delta\phi \times \Delta\lambda$ decreases with latitude:
$$\text{Area}(\phi) = R^2 \cos(\phi) \Delta\phi \Delta\lambda$$
At $60^\circ\text{ N}$ (boreal forest fire zone), a $0.25^\circ$ cell covers exactly **50% of the surface area** that it covers at the equator ($\cos 60^\circ = 0.5$). Comparing cell counts across latitudes or aggregating globally introduces severe geometric bias.

### 2.2 Authalic Sinusoidal Projection Formulation
FireTruth projects all geographic coordinates $(\phi, \lambda)$ using the spherical Authalic Sinusoidal Equal-Area Projection ($R = 6,371.0088\text{ km}$):
$$x = R (\lambda - \lambda_0) \cos\phi$$
$$y = R \phi$$

where:
- $\phi$ is geodetic latitude in radians ($-\pi/2 \le \phi \le \pi/2$).
- $\lambda$ is geodetic longitude in radians ($-\pi \le \lambda \le \pi$).
- $\lambda_0$ is the central projection meridian (default $0.0$).
- $R$ is the authalic Earth radius defined by WGS84 ($6,371.0088\text{ km}$).

The Jacobian determinant of this transformation is:
$$|J| = \left| \begin{matrix} \frac{\partial x}{\partial \lambda} & \frac{\partial x}{\partial \phi} \\ \frac{\partial y}{\partial \lambda} & \frac{\partial y}{\partial \phi} \end{matrix} \right| = \left| \begin{matrix} R \cos\phi & -R (\lambda - \lambda_0) \sin\phi \\ 0 & R \end{matrix} \right| = R^2 \cos\phi$$

The differential area element is:
$$dA = dx \, dy = R^2 \cos\phi \, d\lambda \, d\phi$$
which exactly matches the differential surface area on a sphere. Thus, the projection is strictly **authalic (equal-area)** globally.

### 2.3 Discrete Grid Snapping
Given a target cell resolution $S$ (e.g. $S = 25\text{ km}$), each coordinate $(x, y)$ is mapped to discrete integer cell indices:
$$g_x = \left\lfloor \frac{x}{S} \right\rfloor, \quad g_y = \left\lfloor \frac{y}{S} \right\rfloor$$
Every grid cell $g = (g_x, g_y)$ has an exact surface area:
$$\text{Area}(g) = S \times S = 25\text{ km} \times 25\text{ km} = 625\text{ km}^2$$
This holds identically at the equator, in California, in the Amazon, and across Arctic boreal forests.

---

## 3. Temporal Standardization: The Active Cell-Day Metric

Rather than counting raw detection points (which double-count overlapping scans and swath boundaries), FireTruth computes the **Active Cell-Day Indicator** $I_{s,g,d}$:
$$I_{s,g,d} = \begin{cases} 1 & \text{if sensor } s \text{ observes } \ge 1 \text{ qualified hotspot in equal-area cell } g \text{ on calendar day } d \\ 0 & \text{otherwise} \end{cases}$$

For any monthly aggregation period $m$ over region $\Omega$:
$$A_{s,m} = \sum_{g \in \Omega} \sum_{d \in m} I_{s,g,d}$$

Where:
- $A_{\text{M},m}$ is the observed MODIS active cell-days in month $m$.
- $A_{\text{V},m}$ is the observed VIIRS active cell-days in month $m$.

**Physical Meaning:** $A_{s,m}$ measures the cumulative spatial-temporal footprint of burning (cell-days). It is invariant to multi-count scan overlap artifacts within a single overpass while preserving genuine multi-day persistence.

---

## 4. Calibration Architecture: B0, B1, and B2 Models

To bridge the 2000–2011 MODIS era with the post-2012 VIIRS era, we evaluate three rigorously defined models on overlapping observations ($2012 \le \text{year} \le 2018$ for training, $2019 \le \text{year} \le 2024$ for out-of-sample testing).

### 4.1 Model B0: Naive Raw Baseline (Uncalibrated)
$$A_{\text{B0},m} = \begin{cases} A_{\text{M},m} & \text{if } \text{year}(m) < 2012 \\ A_{\text{V},m} & \text{if } \text{year}(m) \ge 2012 \end{cases}$$
- **Hypothesis:** Treats raw MODIS and VIIRS detections as interchangeable.
- **Result:** Fails project decision criteria. Produces a spurious +370.4% step-jump in California and an out-of-sample held-out MAPE of **73.0%** (MAE: 1,711.1, RMSE: 3,163.1).

### 4.2 Model B1: Common-Grid Linear Scaling Baseline
Estimates a zero-intercept scaling factor $\alpha$ via ordinary least squares on overlapping months $m \in \mathcal{T}_{\text{train}}$:
$$\hat{\alpha} = \arg\min_{\alpha} \sum_{m \in \mathcal{T}_{\text{train}}} \left( A_{\text{V},m} - \alpha A_{\text{M},m} \right)^2 = \frac{\sum_{m} A_{\text{M},m} A_{\text{V},m}}{\sum_{m} A_{\text{M},m}^2}$$

The translated historical MODIS estimate is:
$$\hat{A}_{\text{V},m}^{(\text{B1})} = \hat{\alpha} \cdot A_{\text{M},m}$$
- **California empirical value:** $\hat{\alpha} = 3.68\times$ ($R^2 = 0.946$).
- **Held-out performance (2019–2024, N=72):** MAE = **56.5 cell-days**, RMSE = **117.1 cell-days**, MAPE = **2.4%** (a 96.8% relative MAPE reduction vs B0).
- **Rolling-Origin Folds (2017–2024):** Mean RMSE = **103.9 cell-days**, Mean MAPE = **2.36%**.

### 4.3 Model B2: Seasonally Regularized Ridge Calibration
Because fire regimes exhibit distinct seasonal characteristics (e.g. low-intensity understory smoldering in spring vs canopy firestorms in late summer), Model B2 incorporates monthly scaling coefficients $\gamma_k$ with L2 (ridge) regularization toward the global regime ratio $\alpha_0$:
$$\hat{A}_{\text{V},m}^{(\text{B2})} = \left( \alpha_0 + \gamma_{\text{month}(m)} \right) A_{\text{M},m}$$

The objective function with Tikhonov regularization is:
$$\mathcal{L}(\alpha_0, \boldsymbol{\gamma}) = \sum_{m \in \mathcal{T}_{\text{train}}} \left( A_{\text{V},m} - (\alpha_0 + \gamma_{\text{month}(m)}) A_{\text{M},m} \right)^2 + \lambda \sum_{k=1}^{12} \gamma_k^2$$

Where $\lambda = 10.0$ regularizes seasonal deviations to prevent overfitting in months with sparse fire activity.
- **California empirical values:** $\alpha_0 = 3.68$, seasonal adjustments across calendar months.
- **Held-out performance (2019–2024, N=72):** MAE = **65.9 cell-days**, RMSE = **144.7 cell-days**, MAPE = **2.4%**.
- **Model Selection Takeaway:** While B2 provides seasonal nuance, B1 achieves lower held-out RMSE (117.1 vs 144.7) on out-of-sample years, winning 7 of 8 rolling-origin folds due to maximum parsimony.

---

## 5. Harmonized Satellite-Detected Fire Activity Index (HSFAI)

The unified 26-year historical index is defined as:
$$\text{HSFAI}_m = \begin{cases} \hat{A}_{\text{V},m}^{(\text{B1})} = \hat{\alpha} \cdot A_{\text{M},m} & \text{if } \text{year}(m) < 2012 \text{ (MODIS era, translated)} \\ A_{\text{V},m} & \text{if } \text{year}(m) \ge 2012 \text{ (VIIRS era, observed)} \end{cases}$$

### 5.1 Nominal Baseline Uncertainty Heuristic
For translated historical estimates ($m < 2012$), a nominal baseline uncertainty heuristic is provided:
$$\text{HSFAI}_m \pm 1.96 \cdot \text{RMSE}_{\text{held-out}}$$
For California, $\text{RMSE}_{\text{held-out}} = 117.1\text{ cell-days}$.

> [!NOTE]
> **Scientific Caveat on Residual Heteroscedasticity:** Active-fire detection distributions exhibit residual heteroscedasticity across seasonal cycles rather than strict Gaussian homoscedasticity; during extreme conflagration months, residual variance increases. This interval should be interpreted as an informative nominal baseline uncertainty heuristic rather than a strict parametric 95% prediction interval.

---

## 6. References
1. **Schroeder, W., et al. (2014).** The New VIIRS 375 m Active Fire Detection Data Product: Algorithm Description and Initial Assessment. *Remote Sensing of Environment*, 143, 85–96.
2. **Giglio, L., et al. (2016).** The Collection 6 MODIS Active Fire Detection Algorithm and Fire Products. *Remote Sensing of Environment*, 178, 31–41.
3. **Kaufman, Y. J., et al. (1998).** Potential Global Fire Monitoring from EOS-MODIS. *Journal of Geophysical Research*, 103(D24), 32215–32238.
4. **CEOS Land Product Validation (LPV) Subgroup (2020).** *Active Fire Product Validation Protocol*. NASA GSFC. (Note: CEOS defines validation hierarchy stages and concordance protocols, not an official fixed numerical global MAPE requirement; the 15% threshold is a project-defined decision tolerance).

