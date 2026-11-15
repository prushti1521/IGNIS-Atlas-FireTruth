# IGNIS Atlas — FireTruth Scientific Limitations & Caveats

**Document Version:** 2.1.0-STABLE  
**Standard:** Open Science Full Transparency & Peer-Review Integrity  

---

## 1. Executive Statement on Scientific Humility

A foundational principle of **IGNIS Atlas — FireTruth** is that scientific credibility requires explicitly articulating what an observation system *cannot* do. We reject overclaiming, black-box artificial intelligence claims, and unvalidated assertions of universal sensor translation.

The following documented physical and methodological limitations apply to all data, models, and outputs produced by FireTruth.

---

## 2. Remote-Sensing Physical Limitations

### 2.1 Polar Orbital Revisit Timing & Diurnal Fire Cycle
- **Limitation:** Terra, Aqua, and Suomi-NPP fly in sun-synchronous polar orbits, sampling any given mid-latitude location approximately 2–4 times every 24 hours (Terra at ~10:30 AM/PM local time; Aqua and Suomi-NPP at ~01:30 PM/AM local time).
- **Physical Consequence:** Wildfires exhibit dynamic diurnal cycles, frequently flaring during mid-afternoon peak temperatures and dropping during nocturnal inversions. Fast-moving grass or crop fires that ignite and extinguish entirely between orbital overpasses cannot be captured by polar active-fire radiometers.
- **Remedy / Recommendation:** Corroborate with geostationary sensors (GOES-East/West ABI or INSAT-3D), which sacrifice spatial resolution (2 km mid-infrared pixels) for high temporal revisit (5–10 minutes).

### 2.2 Active-Fire Detections Alone Cannot Certify Observation Completeness
- **Limitation:** Standard NASA FIRMS CSV archives report only **positive detections** (pixels where thermal anomalies exceeded contextual background thresholds). They contain zero records for pixels that were observed and clear of fire, nor for pixels obscured by clouds.
- **Physical Consequence:** A low or zero hotspot count in a FIRMS CSV cannot be distinguished between two opposite physical realities:
  1. *Clear-sky absence of burning* (genuine lack of fire).
  2. *Thick stratocumulus or convective storm cloud deck* that severely attenuates mid-infrared radiation ($I = I_0 e^{-\tau}$) from ground fires, substantially reducing sub-pixel detection probability (Kaufman et al. 1998, Giglio et al. 2003).
- **FireTruth Implementation:** Gate 5 of the Evidence Resolver explicitly flags `NOT_EVALUATED` whenever auxiliary cloud-mask products (MODIS MOD35 or VIIRS VNP35) are unavailable, preventing users from making false negative conclusions from positive-only CSVs.

### 2.3 Smoke Plume Attenuation & Pyrocumulonimbus Saturation
- **Limitation:** In catastrophic megafire sieges (e.g. California August Complex 2020), extreme firestorms inject dense smoke and water vapor into the upper troposphere and lower stratosphere (pyrocumulonimbus or "pyroCb" plumes).
- **Physical Consequence:** Optical thickness of heavy aerosol and moisture plumes causes non-linear extinction in the 3.9 µm mid-infrared channel, while detector electronics approach saturation limits.
- **FireTruth Implementation:** Gate 1 (Calibration Domain Validity) automatically triggers a `WARNING` when monthly regional fire activity exceeds 4,500 active cell-days (the 98th percentile empirical training envelope), advising analysts to inspect geostationary FRP time series.

### 2.4 Active Fire Activity $\neq$ Burned Area or Burn Severity
- **Limitation:** Hotspot detections and active cell-days measure the **spatial-temporal persistence of thermal radiative emissions** during satellite overpasses. They do NOT measure final land surface area burned (hectares) or vegetative mortality (burn severity).
- **Physical Consequence:** A slow-moving smoldering peat fire in the Amazon or Indonesia may occupy the same equal-area cell for 20 consecutive days, generating 20 cell-days while consuming relatively few horizontal hectares. Conversely, a fast-moving chaparral crown fire may sweep through four adjacent cells in 3 hours, generating 4 cell-days while consuming tens of thousands of hectares.
- **FireTruth Implementation:** All labels across the application and exports strictly use **"Harmonized Satellite-Detected Fire Activity Index (HSFAI)"** or **"Active Cell-Days"**, never "burned area" or "acres burned". Gate 6 cross-compares active fire against independent MCD64A1 surface reflectance burned area products.

---

## 3. Modeling & Algorithmic Limitations

### 3.1 Non-Transferability of Global Scaling Ratios
- **Limitation:** The empirical scaling ratio between VIIRS and MODIS is heavily dependent on the fire regime's sub-pixel fire size distribution.
- **Physical Consequence:** As demonstrated in our transfer experiment (`docs/CALIBRATION_VALIDATION.md`), applying a forest-fire scaling factor ($\alpha = 3.68$) to agricultural stubble burning (Punjab, $\alpha = 5.84$) results in a **-37% negative bias (MBE = -461.9 cell-days)**.
- **FireTruth Implementation:** FireTruth prohibits universal global scaling factors. Independent empirical models are trained and maintained for distinct biomes.

### 3.2 Boundary Sensitivity for Low-Amplitude Historical Changes
- **Limitation:** When a reported historical change is small ($|\Delta| < 8.0\%$), the discretization of points into discrete equal-area cells (5 km vs 25 km vs 50 km) can induce boundary perturbations that rival the signal amplitude.
- **FireTruth Implementation:** Gate 4 (Sensitivity Stability Gate) flags changes below $\pm 8\%$ with a `WARNING`, alerting users that the direction of change is fragile to spatial binning parameters.

### 3.3 No Future Fire Forecasting Claims
- **Limitation:** FireTruth is an Earth observation retrospective harmonization and audit system. It does NOT forecast future fire weather, ignite fuel moisture models, or predict future wildfire spread.
- **FireTruth Policy:** We explicitly refrain from claiming predictive or forecasting capabilities, which require validated atmospheric-fire coupling models (e.g. WRF-Fire) outside the scope of historical Earth observation harmonization.

