export type SatelliteSensor = 'Terra' | 'Aqua' | 'S-NPP' | 'NOAA-20';
export type InstrumentType = 'MODIS' | 'VIIRS';
export type FireConfidence = 'low' | 'nominal' | 'high';
export type DayNight = 'D' | 'N';

export interface FireHotspot {
  id: string;
  latitude: number;
  longitude: number;
  brightness: number; // Kelvin (e.g. 300 - 500 K)
  scan: number; // Scan pixel size (km)
  track: number; // Track pixel size (km)
  acq_date: string; // YYYY-MM-DD
  acq_time: string; // HHMM UTC
  satellite: SatelliteSensor;
  instrument: InstrumentType;
  confidence: FireConfidence;
  version: string;
  bright_t31?: number; // Channel 31 brightness temp (K)
  frp: number; // Fire Radiative Power (MW)
  daynight: DayNight;
  regionId: string;
}

export type FireRegimeType = 
  | 'Temperate Wildfire (Forest & Chaparral)'
  | 'Agricultural Residue Burning (Post-harvest)'
  | 'Tropical Deforestation & Peat Smoldering'
  | 'Subtropical Bushfire & Pyrocumulonimbus';

export interface RegionDefinition {
  id: string;
  name: string;
  stateCountry: string;
  bounds: [[number, number], [number, number]]; // Leaflet [[south, west], [north, east]]
  center: [number, number];
  zoom: number;
  fireRegime: FireRegimeType;
  primaryPeakMonths: number[]; // 1-12
  baselineAlphaRatio: number; // VIIRS / MODIS cell-day scaling ratio (empirical)
  description: string;
  scientificContext: string;
  knownMegaFireYears: number[];
}

export interface MonthlyFireRecord {
  year: number;
  month: number; // 1-12
  isObserved: boolean;
  observationStatus?: string;
  modisRawHotspots: number | null;
  viirsRawHotspots: number | null;
  modisCellDays: number | null; // A_{M,m}
  viirsCellDays: number | null; // A_{V,m}
  
  // Harmonized Satellite-Detected Fire Activity Index (HSFAI)
  hsfai: number | null;
  hsfaiLowerCi: number | null;
  hsfaiUpperCi: number | null;
  
  sensorCoverage: 'UNOBSERVED' | 'MODIS_ONLY' | 'OVERLAP' | 'VIIRS_ONLY';
  modelApplied: 'B0_RAW' | 'B1_SCALED' | 'B2_SEASONAL_REGULARIZED';
  
  historicalMedian: number | null;
  anomalyAbsolute: number | null; // hsfai - historicalMedian
  anomalyPercent: number | null; // (anomalyAbsolute / historicalMedian) * 100
  
  cloudCoverPercent: number;
  observationPassCount: number;
  notableEvent?: string;
}

export type ColorRampType = 'magma' | 'cividis' | 'viridis' | 'divergent_anomaly';
export type CalendarMetricMode = 'hsfai' | 'raw_modis' | 'raw_viirs' | 'anomaly_abs' | 'anomaly_pct';

export interface CalibrationModelResult {
  id: 'B0' | 'B1' | 'B2';
  name: string;
  description: string;
  equation: string;
  alpha: number;
  intercept?: number;
  seasonalFactors?: Record<number, number>;
  trainPeriod: [number, number];
  testPeriod: [number, number];
  metrics: {
    trainMAE: number;
    trainRMSE: number;
    trainR2: number;
    heldoutMAE: number;
    heldoutRMSE: number;
    heldoutR2: number;
    heldoutMAPE: number;
    relativeMapeReductionVsB0?: number;
    relativeRmseReductionVsB0?: number;
  };
}

export type EvidenceGateStatus = 'PASS' | 'WARNING' | 'FAIL' | 'NOT_EVALUATED';
export type EvidenceOverallVerdict = 'SUPPORTED' | 'QUALIFIED' | 'INSUFFICIENT_EVIDENCE';

export interface EvidenceGateItem {
  id: string;
  name: string;
  status: EvidenceGateStatus;
  title: string;
  finding: string;
  metricLabel: string;
  measuredValue: string;
  thresholdLabel: string;
  scientificImplication: string;
  inputData?: string;
  calculation?: string;
  thresholdJustification?: string;
  limitations?: string;
  physicalMechanism?: string;
  recommendedAction?: string;
}

export interface EvidenceAuditReport {
  id: string;
  claimStatement: string;
  targetRegion: RegionDefinition;
  yearA: number;
  monthA?: number;
  yearB: number;
  monthB?: number;
  claimDirection: 'INCREASE' | 'DECREASE' | 'STABLE';
  rawDifferencePercent: number;
  harmonizedDifferencePercent: number;
  overallVerdict: EvidenceOverallVerdict;
  verdictSummary: string;
  gates: EvidenceGateItem[];
  stabilityScore: number; // 0 - 100%
  coverageScore: number; // 0 - 100%
  actionableRecommendations: string[];
  reproducibilityHash: string;
  timestamp: string;
}
