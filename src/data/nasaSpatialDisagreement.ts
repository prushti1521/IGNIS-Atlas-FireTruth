export type SpatialCategory =
  | 'SHARED_CELL_MONTH'
  | 'MODIS_ONLY_CELL_MONTH'
  | 'VIIRS_ONLY_CELL_MONTH';

export interface SpatialCell {
  cell_id: string;
  grid_x_km: number;
  grid_y_km: number;
  center: number[];
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  nominal_area_km2: number;
}

export interface SpatialCellMonth {
  cell_id: string;
  year: number;
  month: number;
  modis_active_cell_days: number;
  viirs_active_cell_days: number;
  same_utc_day_matches: number;
  window_matches: number;
  temporal_window_days: number;
  category: SpatialCategory;
  coverage_interpretation: string;
}

export interface SpatialDisagreementArtifact {
  artifact_id: string;
  artifact_version: string;
  data_mode: 'NASA_OBSERVATIONAL';
  study_region: string;
  source_products: {
    modis: { product: string; batch_count: number; raw_observation_count: number; qualified_cell_day_count: number };
    viirs: { product: string; batch_count: number; raw_observation_count: number; qualified_cell_day_count: number };
  };
  processing: {
    start_date: string;
    end_date: string;
    bbox: { south: number; west: number; north: number; east: number };
    grid: { projection: string; earth_radius_authalic_km: number; cell_size_km: number };
    confidence_policy: string;
    temporal_methods: Record<string, string>;
  };
  provenance: {
    input_manifests: Array<{ path: string; sha256: string }>;
    raw_files_remain_external: boolean;
    limitations: string[];
  };
  summary: {
    cell_count: number;
    cell_month_count: number;
    modis_only_cell_months: number;
    viirs_only_cell_months: number;
    shared_cell_months: number;
    same_utc_day_matches: number;
    window_matches: number;
  };
  cells: SpatialCell[];
  cell_months: SpatialCellMonth[];
}

const SPATIAL_ARTIFACT_URL = '/data/nasaSpatialDisagreement.json';
let artifactPromise: Promise<SpatialDisagreementArtifact> | null = null;
let cachedArtifact: SpatialDisagreementArtifact | null = null;

export async function loadSpatialArtifact(forceReload = false): Promise<SpatialDisagreementArtifact> {
  if (forceReload) {
    artifactPromise = null;
    cachedArtifact = null;
  }
  if (cachedArtifact) return cachedArtifact;
  if (!artifactPromise) {
    artifactPromise = fetch(SPATIAL_ARTIFACT_URL, { headers: { Accept: 'application/json' } })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Spatial artifact request failed (${response.status}).`);
        }
        return response.json() as Promise<SpatialDisagreementArtifact>;
      })
      .then(artifact => {
        if (artifact.data_mode !== 'NASA_OBSERVATIONAL' || !Array.isArray(artifact.cells) || !Array.isArray(artifact.cell_months)) {
          throw new Error('Spatial artifact failed schema validation.');
        }
        cachedArtifact = artifact;
        return artifact;
      })
      .catch(error => {
        artifactPromise = null;
        throw error;
      });
  }
  return artifactPromise;
}

export function getSpatialCell(artifact: SpatialDisagreementArtifact, cellId: string): SpatialCell | undefined {
  return artifact.cells.find(cell => cell.cell_id === cellId);
}

export function getSpatialCellMonths(
  artifact: SpatialDisagreementArtifact,
  year: number,
  month: number
): SpatialCellMonth[] {
  return artifact.cell_months.filter(
    record => record.year === year && record.month === month
  );
}
