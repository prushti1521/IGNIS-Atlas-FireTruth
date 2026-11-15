/**
 * IGNIS Atlas — FireTruth JavaScript/Node Parity Verification
 * Tests that Node.js math produces identical equal-area projected coordinates
 * to the shared calibration fixture and Python science engine.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

const fixturePath = path.resolve('./tests/fixtures/shared_calibration_fixture.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

const EARTH_RADIUS_AUTHALIC_KM = 6371.0088;

function projectWgs84ToEqualArea(lat, lon, lon0 = 0.0) {
  const phi = (lat * Math.PI) / 180.0;
  const lam = ((lon - lon0) * Math.PI) / 180.0;
  const x = EARTH_RADIUS_AUTHALIC_KM * lam * Math.cos(phi);
  const y = EARTH_RADIUS_AUTHALIC_KM * phi;
  return { x, y };
}

function snapToEqualAreaGrid(lat, lon, cellSizeKm = 25.0) {
  const { x, y } = projectWgs84ToEqualArea(lat, lon);
  const gx = Math.floor(x / cellSizeKm);
  const gy = Math.floor(y / cellSizeKm);
  const signX = gx >= 0 ? `+${gx}` : `${gx}`;
  const signY = gy >= 0 ? `+${gy}` : `${gy}`;
  return `EA_${cellSizeKm.toFixed(0)}km_${signX}_${signY}`;
}

console.log('Testing Node.js spatial projection against shared fixture...');
for (const sample of fixture.spatial_projection_samples) {
  const { x, y } = projectWgs84ToEqualArea(sample.lat, sample.lon);
  const cellId = snapToEqualAreaGrid(sample.lat, sample.lon, fixture.metadata.cell_size_km);

  assert(Math.abs(x - sample.expected_x_km) < 0.5, `${sample.name}: X coordinate mismatch`);
  assert(Math.abs(y - sample.expected_y_km) < 0.5, `${sample.name}: Y coordinate mismatch`);
  assert.strictEqual(cellId, sample.expected_cell_id, `${sample.name}: cellId mismatch`);
  console.log(`  ✓ ${sample.name}: x=${x.toFixed(2)}, y=${y.toFixed(2)}, cell=${cellId}`);
}

console.log('Testing linear calibration scaling...');
for (const c of fixture.calibration_translation_cases) {
  const pred = c.modis_cell_days * c.alpha;
  assert(Math.abs(pred - c.expected_b1_hsfai) < 1e-4);
  console.log(`  ✓ Region ${c.region_id}: predicted ${pred} vs expected ${c.expected_b1_hsfai}`);
}

console.log('\nAll Node.js cross-language tests passed successfully!');

