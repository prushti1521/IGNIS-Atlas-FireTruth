import type { MonthlyFireRecord } from '../types/fire';

const EARTH_RADIUS_AUTHALIC_KM = 6371.0088;

export interface UploadedFirmsMonth {
  year: number;
  month: number;
  modisRawHotspots: number;
  viirsRawHotspots: number;
  modisCellDays: number;
  viirsCellDays: number;
}

export interface FirmsUploadResult {
  months: UploadedFirmsMonth[];
  hotspots: ParsedFirmsHotspot[];
  validRecordCount: number;
  rejectedRecordCount: number;
}

export interface ParsedFirmsHotspot {
  latitude: number;
  longitude: number;
  acq_date: string;
  acq_time: string;
  satellite: string;
  instrument: 'MODIS' | 'VIIRS';
  confidence: 'low' | 'nominal' | 'high';
  frp: number;
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }
  values.push(value.trim());
  return values;
}

function equalAreaCellId(latitude: number, longitude: number): string {
  const phi = latitude * Math.PI / 180;
  const lambda = longitude * Math.PI / 180;
  const gridX = Math.floor((EARTH_RADIUS_AUTHALIC_KM * lambda * Math.cos(phi)) / 25);
  const gridY = Math.floor((EARTH_RADIUS_AUTHALIC_KM * phi) / 25);
  return `EA_25km_${gridX >= 0 ? '+' : ''}${gridX}_${gridY >= 0 ? '+' : ''}${gridY}`;
}

export function parseFirmsCsv(text: string): FirmsUploadResult {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must contain a header and at least one data row.');
  }

  const headers = splitCsvLine(lines[0]).map(header => header.toLowerCase().replace(/^"|"$/g, ''));
  const latitudeIndex = headers.indexOf('latitude');
  const longitudeIndex = headers.indexOf('longitude');
  const dateIndex = headers.indexOf('acq_date');
  const satelliteIndex = headers.indexOf('satellite');
  const instrumentIndex = headers.indexOf('instrument');
  const scanIndex = headers.indexOf('scan');

  if (latitudeIndex < 0 || longitudeIndex < 0 || dateIndex < 0) {
    throw new Error('Required NASA FIRMS columns "latitude", "longitude", and "acq_date" are missing.');
  }

  const monthMap = new Map<string, {
    year: number;
    month: number;
    modisRawHotspots: number;
    viirsRawHotspots: number;
    modisCellDays: Set<string>;
    viirsCellDays: Set<string>;
  }>();
  let validRecordCount = 0;
  let rejectedRecordCount = 0;
  const hotspots: ParsedFirmsHotspot[] = [];

  for (const line of lines.slice(1)) {
    const columns = splitCsvLine(line).map(value => value.replace(/^"|"$/g, ''));
    const latitude = Number(columns[latitudeIndex]);
    const longitude = Number(columns[longitudeIndex]);
    const dateText = columns[dateIndex] || '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateText) ? new Date(`${dateText}T00:00:00Z`) : null;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 ||
        !date || Number.isNaN(date.getTime())) {
      rejectedRecordCount += 1;
      continue;
    }

    const instrument = instrumentIndex >= 0 ? (columns[instrumentIndex] || '').toUpperCase() : '';
    const satellite = satelliteIndex >= 0 ? (columns[satelliteIndex] || '').toUpperCase() : '';
    const scan = scanIndex >= 0 ? Number(columns[scanIndex]) : Number.NaN;
    const knownSatellite = ['TERRA', 'AQUA', 'N', 'SNPP', 'S-NPP', 'NOAA-20', 'NOAA20'].includes(satellite);
    if (instrument !== '' && instrument !== 'MODIS' && instrument !== 'VIIRS') {
      rejectedRecordCount += 1;
      continue;
    }
    if (satellite !== '' && !knownSatellite) {
      rejectedRecordCount += 1;
      continue;
    }
    if (instrument === '' && !knownSatellite && !Number.isFinite(scan)) {
      rejectedRecordCount += 1;
      continue;
    }
    const isViirs = instrument === 'VIIRS' || satellite === 'N' ||
      satellite.includes('NPP') || satellite.includes('NOAA-20') || satellite.includes('NOAA20') ||
      (instrument === '' && Number.isFinite(scan) && scan < 0.5);
    const normalizedInstrument: 'MODIS' | 'VIIRS' = isViirs ? 'VIIRS' : 'MODIS';
    const rawConfidence = headers.indexOf('confidence') >= 0
      ? (columns[headers.indexOf('confidence')] || '').toLowerCase()
      : 'nominal';
    const confidence: 'low' | 'nominal' | 'high' =
      rawConfidence === 'high' || (normalizedInstrument === 'MODIS' && Number(rawConfidence) >= 80)
        ? 'high'
        : rawConfidence === 'low' || (normalizedInstrument === 'MODIS' && Number(rawConfidence) < 30)
          ? 'low'
          : 'nominal';
    const frpIndex = headers.indexOf('frp');
    hotspots.push({
      latitude,
      longitude,
      acq_date: dateText,
      acq_time: columns[headers.indexOf('acq_time')] || '',
      satellite: columns[satelliteIndex] || (isViirs ? 'N' : 'MODIS'),
      instrument: normalizedInstrument,
      confidence,
      frp: frpIndex >= 0 && Number.isFinite(Number(columns[frpIndex])) ? Number(columns[frpIndex]) : 0
    });
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const key = `${year}-${month}`;
    const monthData = monthMap.get(key) || {
      year,
      month,
      modisRawHotspots: 0,
      viirsRawHotspots: 0,
      modisCellDays: new Set<string>(),
      viirsCellDays: new Set<string>()
    };
    const cellDay = `${equalAreaCellId(latitude, longitude)}-${dateText}`;
    if (isViirs) {
      monthData.viirsRawHotspots += 1;
      monthData.viirsCellDays.add(cellDay);
    } else {
      monthData.modisRawHotspots += 1;
      monthData.modisCellDays.add(cellDay);
    }
    monthMap.set(key, monthData);
    validRecordCount += 1;
  }

  return {
    validRecordCount,
    rejectedRecordCount,
    hotspots,
    months: Array.from(monthMap.values())
      .map(month => ({
        year: month.year,
        month: month.month,
        modisRawHotspots: month.modisRawHotspots,
        viirsRawHotspots: month.viirsRawHotspots,
        modisCellDays: month.modisCellDays.size,
        viirsCellDays: month.viirsCellDays.size
      }))
      .sort((a, b) => a.year - b.year || a.month - b.month)
  };
}

export function applyFirmsUpload(
  currentRecords: MonthlyFireRecord[],
  upload: FirmsUploadResult,
  alphaRatio: number
): MonthlyFireRecord[] {
  const uploadedMonths = new Map(upload.months.map(month => [`${month.year}-${month.month}`, month]));
  return currentRecords.map(record => {
    const month = uploadedMonths.get(`${record.year}-${record.month}`);
    if (!month) {
      return {
        ...record,
        isObserved: false,
        observationStatus: 'NOT_IN_UPLOADED_SOURCE',
        modisRawHotspots: null,
        viirsRawHotspots: null,
        modisCellDays: null,
        viirsCellDays: null,
        hsfai: null,
        hsfaiLowerCi: null,
        hsfaiUpperCi: null,
        sensorCoverage: 'UNOBSERVED',
        historicalMedian: null,
        anomalyAbsolute: null,
        anomalyPercent: null,
        cloudCoverPercent: 0,
        observationPassCount: 0,
        notableEvent: undefined
      };
    }

    const hasModis = month.modisRawHotspots > 0;
    const hasViirs = month.viirsRawHotspots > 0;
    const hsfai = hasViirs ? month.viirsCellDays : month.modisCellDays * alphaRatio;
    return {
      ...record,
      isObserved: true,
      observationStatus: 'LIVE_OBSERVED_PARTIAL_COVERAGE',
      modisRawHotspots: month.modisRawHotspots,
      viirsRawHotspots: month.viirsRawHotspots,
      modisCellDays: month.modisCellDays,
      viirsCellDays: month.viirsCellDays,
      hsfai: Math.round(hsfai),
      hsfaiLowerCi: null,
      hsfaiUpperCi: null,
      sensorCoverage: hasModis && hasViirs ? 'OVERLAP' : hasModis ? 'MODIS_ONLY' : 'VIIRS_ONLY',
      historicalMedian: null,
      anomalyAbsolute: null,
      anomalyPercent: null,
      cloudCoverPercent: 0,
      observationPassCount: 0,
      notableEvent: undefined
    };
  });
}
