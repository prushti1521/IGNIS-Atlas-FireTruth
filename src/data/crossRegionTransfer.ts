export interface TransferMonthlyObservation {
  year: number;
  month: number;
  period: string;
  modis_cell_days: number;
  viirs_cell_days: number;
  training_observation: boolean;
}

export interface TransferModelMetrics {
  mae: number;
  rmse: number;
  bias: number;
  sample_size_months: number;
}

export interface TransferResidual {
  year: number;
  month: number;
  modis_cell_days: number;
  viirs_cell_days: number;
  b0_prediction: number;
  b1_prediction: number;
  b2_prediction: number;
  b0_error: number;
  b1_error: number;
  b2_error: number;
  training_observation: boolean;
}

export interface CrossRegionTransferArtifact {
  artifact_version: string;
  study_region: string;
  boundary: {
    type: string;
    west: number;
    south: number;
    east: number;
    north: number;
    definition: string;
  };
  source_products: {
    modis: string;
    viirs: string;
    reference_role: string;
  };
  provenance: {
    modis_raw_rows_in_period: number;
    viirs_raw_rows_in_period: number;
    confidence_policy: string;
    grid: string;
    modis_manifests: Array<{ file: string; sha256: string; complete: boolean }>;
    viirs_manifests: Array<{ file: string; sha256: string; complete: boolean }>;
  };
  evaluation: {
    training_period: [string, string];
    holdout_period: [string, string];
    reference_sensor: string;
    complete_overlap_months: number;
    training_months: number;
    training_rows_used_for_local_fit: number;
    holdout_rows_excluded_from_local_fit: number;
    fit_rule: string;
  };
  frozen_california_models: {
    source_artifact: string;
    source_sha256: string;
    b1_alpha: number;
    b2_seasonal_factors: Record<string, number>;
  };
  local_training_models: {
    b1_alpha: number;
    b2_seasonal_factors: Record<string, number>;
  };
  monthly_observations: TransferMonthlyObservation[];
  zero_shot_transfer: {
    status: string;
    holdout_months: number;
    models: Record<string, TransferModelMetrics>;
    monthly_residuals: TransferResidual[];
  };
  local_calibration_benchmark: {
    status: string;
    holdout_months: number;
    models: Record<string, TransferModelMetrics>;
    monthly_residuals: TransferResidual[];
  };
  failure_analysis: {
    zero_shot_metrics_recomputed: Record<string, TransferModelMetrics>;
    largest_absolute_error_months: Array<Record<string, string | number | boolean>>;
    seasonal_residuals: Array<Record<string, number>>;
    months_where_zero_shot_b1_worse_than_b0: string[];
    months_where_zero_shot_b2_worse_than_b0: string[];
    extreme_month_sensitivity: {
      excluded_month: string;
      criterion: string;
      models: Record<string, TransferModelMetrics>;
    };
    local_b2_largest_month_absolute_error_share: number;
    interpretation: string[];
  };
  limitations: string[];
}

const TRANSFER_ARTIFACT_URL = '/data/crossRegionTransfer.json';
let artifactPromise: Promise<CrossRegionTransferArtifact> | null = null;
let cachedArtifact: CrossRegionTransferArtifact | null = null;

export function loadCrossRegionTransfer(forceReload = false): Promise<CrossRegionTransferArtifact> {
  if (forceReload) {
    artifactPromise = null;
    cachedArtifact = null;
  }
  if (cachedArtifact) return Promise.resolve(cachedArtifact);
  if (!artifactPromise) {
    artifactPromise = fetch(TRANSFER_ARTIFACT_URL, { headers: { Accept: 'application/json' } })
      .then(response => {
        if (!response.ok) throw new Error(`Transfer artifact request failed (${response.status}).`);
        return response.json() as Promise<CrossRegionTransferArtifact>;
      })
      .then(artifact => {
        if (
          artifact.artifact_version !== '1.0.0' ||
          artifact.source_products.reference_role === 'ground truth' ||
          artifact.monthly_observations.length !== 60
        ) {
          throw new Error('Transfer artifact failed scientific schema validation.');
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
