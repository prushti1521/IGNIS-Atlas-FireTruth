import {
  type SpatialDisagreementArtifact,
  getSpatialCell,
  type SpatialCellMonth
} from '../data/nasaSpatialDisagreement';

export function buildSpatialCsv(artifact: SpatialDisagreementArtifact, records: SpatialCellMonth[]): string {
  return [
    '# IGNIS Atlas spatial disagreement export',
    `# Source: ${artifact.artifact_id}`,
    'cell_id,year,month,category,modis_active_cell_days,viirs_active_cell_days,same_utc_day_matches,window_matches',
    ...records.map(record => [
      record.cell_id, record.year, record.month, record.category,
      record.modis_active_cell_days, record.viirs_active_cell_days,
      record.same_utc_day_matches, record.window_matches
    ].join(','))
  ].join('\n');
}

export function buildSpatialGeoJson(artifact: SpatialDisagreementArtifact, records: SpatialCellMonth[]): string {
  return JSON.stringify({
    type: 'FeatureCollection',
    source_artifact: artifact.artifact_id,
    features: records.map(record => ({
      type: 'Feature',
      geometry: getSpatialCell(artifact, record.cell_id)?.geometry,
      properties: record
    }))
  }, null, 2);
}
