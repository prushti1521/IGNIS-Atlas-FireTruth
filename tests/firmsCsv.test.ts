import { describe, expect, it } from 'vitest';
import { applyFirmsUpload, parseFirmsCsv } from '../src/science/firmsCsv';
import type { MonthlyFireRecord } from '../src/types/fire';

const csv = [
  'latitude,longitude,acq_date,acq_time,satellite,instrument,confidence,frp',
  '"37.2500","-119.7500","2024-08-15","1930","Aqua","MODIS","85","42.5"',
  '37.2510,-119.7510,2024-08-15,1940,N,VIIRS,nominal,18.4',
  '37.2510,-119.7510,2024-08-15,1940,N,VIIRS,nominal,18.4',
  '37.2520,-119.7520,2024-10-25,0815,N,VIIRS,high,16.4',
  '91,-119.75,2024-08-15,1930,Aqua,MODIS,85,42.5',
  '37.25,-119.75,not-a-date,1930,Aqua,MODIS,85,42.5',
  '37.25,-119.75,2024-08-15,1930,Unknown,THERMAL,high,42.5'
].join('\n');

describe('FIRMS CSV parser', () => {
  it('parses quoted fields and identifies MODIS and VIIRS sensors', () => {
    const result = parseFirmsCsv(csv);
    expect(result.validRecordCount).toBe(4);
    expect(result.rejectedRecordCount).toBe(3);
    expect(result.hotspots.map(hotspot => hotspot.instrument)).toEqual(['MODIS', 'VIIRS', 'VIIRS', 'VIIRS']);
  });

  it('rejects invalid coordinates, dates, and unknown sensor metadata', () => {
    const result = parseFirmsCsv(csv);
    expect(result.rejectedRecordCount).toBe(3);
  });

  it('deduplicates duplicate sensor cell-days while preserving raw counts', () => {
    const result = parseFirmsCsv(csv);
    const august = result.months.find(month => month.year === 2024 && month.month === 8);
    expect(august).toMatchObject({
      modisRawHotspots: 1,
      viirsRawHotspots: 2,
      modisCellDays: 1,
      viirsCellDays: 1
    });
  });

  it('keeps months absent from the source unavailable', () => {
    const records: MonthlyFireRecord[] = [8, 9, 10].map(month => ({
      year: 2024,
      month,
      isObserved: true,
      observationStatus: 'DEMO',
      modisRawHotspots: 10,
      viirsRawHotspots: 10,
      modisCellDays: 10,
      viirsCellDays: 10,
      hsfai: 10,
      hsfaiLowerCi: 8,
      hsfaiUpperCi: 12,
      sensorCoverage: 'OVERLAP',
      modelApplied: 'B2_SEASONAL_REGULARIZED',
      historicalMedian: 10,
      anomalyAbsolute: 0,
      anomalyPercent: 0,
      cloudCoverPercent: 0,
      observationPassCount: 1
    }));
    const applied = applyFirmsUpload(records, parseFirmsCsv(csv), 3.68);
    expect(applied.find(record => record.month === 8)?.observationStatus).toBe('LIVE_OBSERVED_PARTIAL_COVERAGE');
    expect(applied.find(record => record.month === 9)?.observationStatus).toBe('NOT_IN_UPLOADED_SOURCE');
    expect(applied.find(record => record.month === 9)?.historicalMedian).toBeNull();
    expect(applied.find(record => record.month === 10)?.observationStatus).toBe('LIVE_OBSERVED_PARTIAL_COVERAGE');
  });

  it('does not make a month with detections look fully covered', () => {
    const record: MonthlyFireRecord = {
      year: 2024,
      month: 8,
      isObserved: true,
      observationStatus: 'DEMO',
      modisRawHotspots: 1,
      viirsRawHotspots: 1,
      modisCellDays: 1,
      viirsCellDays: 1,
      hsfai: 1,
      hsfaiLowerCi: 0,
      hsfaiUpperCi: 2,
      sensorCoverage: 'OVERLAP',
      modelApplied: 'B2_SEASONAL_REGULARIZED',
      historicalMedian: 10,
      anomalyAbsolute: -9,
      anomalyPercent: -90,
      cloudCoverPercent: 0,
      observationPassCount: 1
    };
    const applied = applyFirmsUpload([record], parseFirmsCsv(csv), 3.68);
    expect(applied[0].observationStatus).toBe('LIVE_OBSERVED_PARTIAL_COVERAGE');
    expect(applied[0].observationPassCount).toBe(0);
    expect(applied[0].hsfaiLowerCi).toBeNull();
  });
});
