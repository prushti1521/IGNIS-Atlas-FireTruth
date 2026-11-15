import { beforeAll, describe, expect, it, vi } from 'vitest';
import { NASA_OBSERVATIONAL_EVALUATION } from '../src/data/nasaObservationalData';
import { getSpatialCell, getSpatialCellMonths, loadSpatialArtifact, type SpatialDisagreementArtifact } from '../src/data/nasaSpatialDisagreement';
import { runEvidenceAudit } from '../src/science/evidenceResolver';
import { NASA_OBSERVATIONAL_RECORDS } from '../src/data/nasaObservationalData';
import { DEFAULT_CALIBRATION_PARAMS, evaluateCalibrationModels } from '../src/science/harmonizationEngine';
import { DEFAULT_REGION } from '../src/data/regions';
import { buildSpatialCsv, buildSpatialGeoJson } from '../src/science/spatialExports';
import { readFileSync } from 'node:fs';

let spatialArtifact: SpatialDisagreementArtifact;

beforeAll(async () => {
  const json = readFileSync(new URL('../public/data/nasaSpatialDisagreement.json', import.meta.url), 'utf-8');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(json, {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })));
  spatialArtifact = await loadSpatialArtifact();
});

describe('authentic spatial artifact', () => {
  it('contains provenance, real counts, geometry, and documented categories', () => {
    expect(spatialArtifact.data_mode).toBe('NASA_OBSERVATIONAL');
    expect(spatialArtifact.source_products.modis.raw_observation_count).toBe(136743);
    expect(spatialArtifact.source_products.viirs.raw_observation_count).toBe(613099);
    expect(spatialArtifact.summary.cell_count).toBe(918);
    expect(spatialArtifact.summary.cell_month_count).toBe(13439);
    expect(spatialArtifact.provenance.raw_files_remain_external).toBe(true);
    const record = getSpatialCellMonths(spatialArtifact, 2022, 8)[0];
    expect(record).toBeDefined();
    expect(getSpatialCell(spatialArtifact, record.cell_id)?.geometry.type).toBe('Polygon');
  });

  it('keeps sensor-only categories distinct from shared activity', () => {
    const rows = spatialArtifact.cell_months;
    expect(rows.some(row => row.category === 'MODIS_ONLY_CELL_MONTH')).toBe(true);
    expect(rows.some(row => row.category === 'VIIRS_ONLY_CELL_MONTH')).toBe(true);
    expect(rows.some(row => row.category === 'SHARED_CELL_MONTH')).toBe(true);
    expect(rows.every(row => row.coverage_interpretation.includes('not') || row.category === 'SHARED_CELL_MONTH')).toBe(true);
  });

  it('serializes authentic CSV and GeoJSON export contents', () => {
    const records = getSpatialCellMonths(spatialArtifact, 2022, 8).slice(0, 2);
    const csv = buildSpatialCsv(spatialArtifact, records);
    const geoJson = JSON.parse(buildSpatialGeoJson(spatialArtifact, records)) as {
      type: string;
      features: Array<{ geometry: { type: string }; properties: { cell_id: string } }>;
    };
    expect(csv).toContain('# Source: ignis-atlas-california-spatial-disagreement-2018-2022');
    expect(csv.split('\n')).toHaveLength(records.length + 3);
    expect(geoJson.type).toBe('FeatureCollection');
    expect(geoJson.features).toHaveLength(records.length);
    expect(geoJson.features[0].geometry.type).toBe('Polygon');
    expect(geoJson.features[0].properties.cell_id).toBe(records[0].cell_id);
  });
});

describe('observational evidence isolation', () => {
  it('does not inject synthetic MAPE, RMSE, or cloud assumptions', () => {
    const report = runEvidenceAudit(
      DEFAULT_REGION,
      NASA_OBSERVATIONAL_RECORDS,
      2018,
      2022,
      undefined,
      { dataSourceMode: 'observational' }
    );
    const calibration = report.gates.find(gate => gate.id === 'gate-2-calibration');
    const coverage = report.gates.find(gate => gate.id === 'gate-5-observation');
    const independent = report.gates.find(gate => gate.id === 'gate-6-independent');
    expect(calibration?.status).toBe('NOT_EVALUATED');
    expect(calibration?.finding).not.toContain('11.4');
    expect(calibration?.finding).not.toContain('117.1');
    expect(coverage?.status).toBe('NOT_EVALUATED');
    expect(independent?.status).toBe('NOT_EVALUATED');
  });
});

describe('observational evaluation split', () => {
  it('derives the exact verified training and holdout periods from the artifact', () => {
    expect(NASA_OBSERVATIONAL_EVALUATION.trainingStart).toBe('2018-01');
    expect(NASA_OBSERVATIONAL_EVALUATION.trainingEnd).toBe('2020-06');
    expect(NASA_OBSERVATIONAL_EVALUATION.holdoutStart).toBe('2020-07');
    expect(NASA_OBSERVATIONAL_EVALUATION.holdoutEnd).toBe('2022-12');
    expect(NASA_OBSERVATIONAL_EVALUATION.holdoutMonths).toBe(30);
    const result = evaluateCalibrationModels(NASA_OBSERVATIONAL_RECORDS, DEFAULT_REGION, {
      ...DEFAULT_CALIBRATION_PARAMS,
      trainStartYear: 2018,
      trainEndYear: 2020,
      testStartYear: 2020,
      testEndYear: 2022,
      trainStartMonth: 1,
      trainEndMonth: 6,
      testStartMonth: 7,
      testEndMonth: 12
    });
    expect(result.evaluationStatus).toBe('EVALUATED');
    expect(result.scatterPoints.filter(point => point.isTest)).toHaveLength(30);
  });
});
