# IGNIS Atlas — FireTruth NASA Data Sources & Ingestion Specification

**Document Version:** 2.1.0-STABLE  
**Scope:** Data Provenance, Sensor Specifications, Product Versions, and Download Guide  

---

## 1. Authoritative NASA Earth Observation Data Sources

FireTruth ingests and harmonizes observations from NASA’s Earth Observing System Data and Information System (EOSDIS) via the Fire Information for Resource Management System (FIRMS).

### 1.1 Sensor Constellation & Standard Products

| Satellite Platform | Sensor Instrument | Spatial Resolution | Orbit & Overpass Time | Science Processing Version | Primary Bands Used |
|---|---|:---:|---|:---:|---|
| **Terra (EOS AM-1)** | MODIS | 1,000 m | Polar Sun-Synchronous (~10:30 AM/PM local) | Collection 6.1 (`MCD14DL`) | Ch 21/22 ($3.96\,\mu\text{m}$), Ch 31 ($11.0\,\mu\text{m}$) |
| **Aqua (EOS PM-1)** | MODIS | 1,000 m | Polar Sun-Synchronous (~01:30 PM/AM local) | Collection 6.1 (`MCD14DL`) | Ch 21/22 ($3.96\,\mu\text{m}$), Ch 31 ($11.0\,\mu\text{m}$) |
| **Suomi-NPP** | VIIRS | 375 m (I-band) | Polar Sun-Synchronous (~01:30 PM/AM local) | Version 1.0 (`VNP14IMGTDL`) | I4 ($3.74\,\mu\text{m}$), I5 ($11.45\,\mu\text{m}$), M13 ($4.05\,\mu\text{m}$) |
| **NOAA-20 (JPSS-1)** | VIIRS | 375 m (I-band) | Polar Sun-Synchronous (~01:30 PM/AM local, 50-min orbit offset) | Version 2.0 (`VJ114IMGTDL`) | I4 ($3.74\,\mu\text{m}$), I5 ($11.45\,\mu\text{m}$), M13 ($4.05\,\mu\text{m}$) |
| **NOAA-21 (JPSS-2)** | VIIRS | 375 m (I-band) | Polar Sun-Synchronous (~01:30 PM/AM local) | Version 2.1 (`VJ214IMGTDL`) | I4 ($3.74\,\mu\text{m}$), I5 ($11.45\,\mu\text{m}$), M13 ($4.05\,\mu\text{m}$) |

---

## 2. Standard Science Processing vs Near-Real-Time (NRT)

FIRMS distributes data under two distinct processing regimes:
1. **Standard Science Processing (MCD14DL / VNP14IMGTDL):**
   - Produced with a latency of 2–3 months after acquisition.
   - Utilizes definitive satellite ephemeris, final calibrated attitude vectors, and verified ancillary atmospheric profiles from NASA Goddard.
   - **Mandatory for Climate & Multi-Decadal Historical Harmonization.**
2. **Near-Real-Time (NRT / Ultra-NRT):**
   - Produced within 60–180 minutes of downlinking.
   - Uses predicted satellite orbits and coarse atmospheric approximations.
   - Subject to minor geolocation jitter and calibration drift.
   - Useful for immediate wildland firefighting dispatch, but invalid for rigorous decadal trend determination.

**FireTruth Policy:** All pre-computed historical matrices and calibration baselines in FireTruth utilize **Standard Science Processing** archives. User-uploaded CSVs are inspected for version headers to notify users if NRT data is present.

---

## 3. Data Field Normalization & Quality Policies

### 3.1 Field Schema Specification
When ingesting raw CSV records from NASA FIRMS, FireTruth normalizes disparate sensor schemas into an invariant data structure:

```python
@dataclass
class NormalizedHotspot:
    latitude: float         # WGS84 decimal degrees [-90.0, 90.0]
    longitude: float        # WGS84 decimal degrees [-180.0, 180.0]
    brightness_kelvin: float# Mid-infrared brightness temp (Ch 21/22 or Band I4)
    scan_km: float          # Pixel size along scan direction
    track_km: float         # Pixel size along orbital track
    acq_date: str           # YYYY-MM-DD
    acq_time: str           # HHMM UTC
    satellite: str          # Terra, Aqua, Suomi-NPP, NOAA-20, NOAA-21
    instrument: str         # MODIS or VIIRS
    confidence_level: str   # Normalized to: low, nominal, high
    frp_mw: float           # Fire Radiative Power in Megawatts
    daynight: str           # D (Day) or N (Night)
```

### 3.2 Confidence Harmonization
- **MODIS:** Reports confidence as an integer percentage from `0` to `100%`.
  - `low`: $0\% \le \text{conf} < 30\%$
  - `nominal`: $30\% \le \text{conf} < 80\%$
  - `high`: $80\% \le \text{conf} \le 100\%$
- **VIIRS:** Reports confidence as discrete string categories: `'low'`, `'nominal'`, `'high'`.
- **Standard Quality Policy:** Detections flagged as `nominal` and `high` are retained for science calibration; `low` confidence detections (typically cloud-edge false alarms or solar glint off water) are filtered out unless explicitly requested.

---

## 4. How to Download Authentic NASA Datasets

Judges and researchers can verify FireTruth using raw NASA FIRMS downloads:
1. Visit the **NASA FIRMS Archive Download Portal**:
   [https://firms.modaps.eosdis.nasa.gov/download/](https://firms.modaps.eosdis.nasa.gov/download/)
2. Request an active fire download for:
   - **Region:** California bounding box `[-124.5, 32.5, -114.0, 42.0]` or Punjab `[73.5, 29.5, 77.0, 32.5]`.
   - **Date Range:** 2000-01-01 to 2024-12-31.
   - **Source:** MODIS Collection 6.1 and VIIRS S-NPP 375 m (Standard Processing).
3. Once downloaded, drag and drop the CSV directly into FireTruth's **Header -> Upload NASA CSV** button. The application will parse the records, project them into the equal-area grid, and recompute all 6 Evidence Gates in real time.

