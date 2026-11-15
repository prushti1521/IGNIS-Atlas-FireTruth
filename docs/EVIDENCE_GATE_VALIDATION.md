# IGNIS Atlas — FireTruth 6-Gate Evidence Resolver Specification

**Document Version:** 2.1.0-STABLE  
**Scope:** Mathematical Formulation, Threshold Criteria, Physical Mechanisms, and Verdict Synthesis  

---

## 1. Architectural Philosophy

The **Evidence Resolver** is FireTruth's signature contribution. In remote sensing, producing a number is easy; proving that the number represents genuine environmental reality rather than an observational artifact is hard.

Rather than acting as a black box, the Evidence Resolver tests every historical statement against **6 modular physical and methodological gates** (addressing calibration limits, model stability, residual noise, spatial resolution sensitivity, atmospheric transmission, and contextual burned area concordance). Every gate returns:
- Status: `PASS`, `WARNING`, `FAIL`, or `NOT_EVALUATED`.
- Measured metric & input data.
- Mathematical calculation.
- Threshold & documented NASA scientific literature justification.
- Physical remote-sensing mechanism.
- Documented limitations and recommended investigative actions.

```
                     [ User Historical Claim ]
                                │
   ┌────────────────────────────┼────────────────────────────┐
   ▼                            ▼                            ▼
[Gate 1: Domain]     [Gate 2: Stability]     [Gate 3: Uncertainty]
Extrapolation Check   Held-out Error Check    Noise vs Signal Check
   │                            │                            │
   ▼                            ▼                            ▼
[Gate 4: Sensitivity][Gate 5: Completeness]  [Gate 6: Independent]
Grid Invariance       Cloud Obscuration       MCD64A1 Burned Area
   └────────────────────────────┼────────────────────────────┘
                                ▼
                   [ Transparent Decision Policy ]
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
    [SUPPORTED]            [QUALIFIED]       [INSUFFICIENT_EVIDENCE]
```

---

## 2. Gate-by-Gate Scientific Specifications

### Gate 1: Calibration Domain Validity Gate
- **Purpose:** Ensures the fire conditions being compared fall within the represented empirical calibration distribution and do not risk non-linear detector saturation.
- **Metric:** Peak active cell-days $\max(A_{\text{HSFAI},A}, A_{\text{HSFAI},B})$.
- **Threshold:** $\le 4,500\text{ cell-days}$ (98th percentile ceiling of historical training envelope).
- **Physical Mechanism:** Linear empirical calibration assumes constant atmospheric transmissivity. Extreme megafire conflagrations (e.g. 2020 California August Complex) produce massive pyrocumulonimbus columns where optical smoke depth causes mild non-linear extinction in the 3.9 µm channel.
- **Threshold Justification:** Derived from the multi-decadal empirical calibration envelope (2000–2024). Beyond this envelope, thermal radiation approaches detector saturation limits.
- **Status Assignment:**
  - `PASS` if $\max \le 4,500$.
  - `WARNING` if $\max > 4,500$.

---

### Gate 2: Calibration Stability Gate
- **Purpose:** Verifies that cross-instrument sensor translation meets required precision standards on unseen held-out validation data.
- **Metric:** Held-out Mean Absolute Percentage Error (MAPE).
- **Threshold:** $\le 15.0\%$ (Project-Defined Decision Tolerance; informed by active fire concordance assessment criteria).
- **Physical Mechanism:** Equal-area common-grid binning bridges the resolution gap between 1,000 m MODIS and 375 m VIIRS. For cross-era comparisons (pre-2012 vs post-2012), the translation model must achieve $<15\%$ error out-of-sample.
- **Threshold Justification:** Project-defined decision threshold informed by CEOS Land Product Validation active fire product assessment criteria (Schroeder et al. 2014, Giglio et al. 2016). Note: CEOS LPV defines validation hierarchy stages, not an official fixed global numerical MAPE cutoff.
- **Status Assignment:**
  - `PASS` if cross-era and $\text{MAPE} \le 15.0\%$, or if comparison is intra-era (same observing constellation; drift $<3.2\%$).
  - `FAIL` if cross-era and $\text{MAPE} > 15.0\%$.

---

### Gate 3: Change Versus Calibration Uncertainty Gate
- **Purpose:** Evaluates whether the claimed historical change exceeds the nominal empirical residual uncertainty of the cross-instrument calibration model.
- **Metric:** Absolute harmonized change $|\Delta_{\text{HSFAI}}\%|$ vs nominal baseline uncertainty heuristic $\pm U$:
  $$U = \left( \frac{1.96 \cdot \text{RMSE}_{\text{held-out}}}{A_{\text{HSFAI},\text{baseline}}} \right) \times 100\%$$
- **Threshold:** $|\Delta_{\text{HSFAI}}\%| > U$ (Signal-to-noise ratio $> 1.0$).
- **Physical Mechanism:** Orbital sampling variability, slight overpass time jitter, and model residual spread create natural statistical scatter ($\text{RMSE} = 117.1\text{ cell-days}$). If the reported change is smaller than $U$, the trend is statistically indistinguishable from baseline model noise.
- **Threshold Justification:** Nominal baseline uncertainty heuristic based on $\pm 1.96 \cdot \text{RMSE}_{\text{held-out}}$. Note: active-fire distributions exhibit residual heteroscedasticity across seasonal cycles rather than strict Gaussian homoscedasticity; changes within this margin cannot be reliably distinguished from calibration model residual noise.
- **Status Assignment:**
  - `PASS` if $|\Delta| > U$.
  - `WARNING` if $|\Delta| \le U$ (trend is within expected model noise).

---

### Gate 4: Sensitivity Stability Gate
- **Purpose:** Tests whether the conclusion's sign or magnitude is an artifact of spatial discretization or quality-filtering choices.
- **Metric:** Sign invariance across 5 km, 10 km, 20 km, 25 km, and 50 km equal-area sinusoidal grid resolutions and confidence filters.
- **Threshold:** Invariant direction across all tested scales, or absolute change $|\Delta| \ge 8.0\%$.
- **Physical Mechanism:** When a physical burning trend is genuine and regional in scale, cell boundary perturbations have minimal relative impact. When a trend is near zero ($<8\%$), spatial cell edges can cause the sign of change to flip.
- **Threshold Justification:** Multi-resolution spatial sensitivity analysis demonstrates discretization noise matches signal amplitude below $\pm 8\%$ change.
- **Status Assignment:**
  - `PASS` if direction is invariant across all scales.
  - `WARNING` if direction flips or $|\Delta| < 8.0\%$.

---

### Gate 5: Observation Completeness Gate
- **Special Remote-Sensing Rule:** **Active-fire hotspot CSVs alone CANNOT establish observation completeness.** Positive hotspot records document where fires were detected; they contain zero records for clear-sky fire-free areas or cloud-covered obscured areas.
- **Metric:** Mean and differential cloud cover fraction ($\max(C_A, C_B)$ and $|C_B - C_A|$).
- **Threshold:** Acceptable cloud fraction $<40.0\%$; maximum threshold $60.0\%$ (Kaufman et al. 1998, Giglio et al. 2003).
- **Physical Mechanism:** Liquid water and ice droplets in clouds scatter and attenuate 3.9 µm thermal infrared radiation exponentially ($I = I_0 e^{-\tau}$). Sub-pixel cloud fractions $>60\%$ substantially reduce detection probability for typical flaming intensities (Kaufman et al. 1998, Giglio et al. 2003). Zero detected hotspots under thick cloud decks does not indicate an absence of burning.
- **Threshold Justification:** Kaufman et al. (1998) and Giglio et al. (2003): optical depth of thick convective and stratiform clouds causes exponential attenuation in the 3.9–4.0 µm channel; cloud fractions above 60% substantially reduce sub-pixel detection probability.
- **Status Assignment:**
  - `NOT_EVALUATED` if auxiliary cloud mask data (MOD35 / VNP35) is unavailable (standard hotspot CSV only). Missing completeness data strictly restricts the overall verdict to `QUALIFIED`, never `SUPPORTED`.
  - `FAIL` if $\max(C_A, C_B) > 60\%$ or $|C_B - C_A| > 25\%$.
  - `WARNING` if $35\% < \max(C_A, C_B) \le 60\%$.
  - `PASS` if $\max(C_A, C_B) \le 35\%$.

---

### Gate 6: Independent Contextual Evidence Gate
- **Purpose:** Evaluates directional concordance against independent surface reflectance burned area products (NASA MODIS Collection 6 MCD64A1 500 m Monthly Burned Area Product).
- **Metric:** Directional concordance between active-fire $\Delta_{\text{HSFAI}}\%$ and burned area $\Delta_{\text{BA}}\%$.
- **Threshold:** $\text{sign}(\Delta_{\text{HSFAI}}) == \text{sign}(\Delta_{\text{BA}})$.
- **Physical Mechanism:** Instantaneous middle-infrared thermal emissions (active fire) and post-fire near-infrared surface charring (burned area) measure distinct physical consequences of combustion.
- **Threshold Justification:** Multi-product validation standard (Giglio et al. 2018).
- **Status Assignment:**
  - `PASS` if directional concordance is confirmed.
  - `WARNING` if products diverge (flags sub-pixel persistence, cropland crop stubble, or canopy shielding).

---

## 3. Transparent Overall Verdict Policy

FireTruth synthesizes the 6 gate outcomes into an unambiguous scientific verdict:

```python
if fail_count > 0:
    overall_verdict = "INSUFFICIENT_EVIDENCE"
elif not_evaluated_count > 0:
    # Missing observation completeness strictly restricts verdict to QUALIFIED
    overall_verdict = "QUALIFIED"
elif warn_count >= 2 or (warn_count == 1 and abs(harmonized_delta_percent) < 15.0):
    overall_verdict = "QUALIFIED"
else:
    overall_verdict = "SUPPORTED"
```

### Definitions:
1. **SUPPORTED:** The historical statement is robustly corroborated by satellite evidence. It survives calibration domain, out-of-sample stability, uncertainty bounds, and spatial sensitivity checks.
2. **QUALIFIED:** A physical shift is indicated, but scientific caveats must accompany the claim (e.g. marginal signal-to-noise ratio, sensitivity to grid cell size, or unverified cloud mask).
3. **INSUFFICIENT_EVIDENCE:** The claim cannot be defended scientifically. Apparent trends are overwhelmingly vulnerable to sensor transition artifacts or severe cloud obscuration.

