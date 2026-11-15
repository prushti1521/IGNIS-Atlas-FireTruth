import rawArtifact from './nasaObservationalData.json';
import type { MonthlyFireRecord } from '../types/fire';

type ObservationalArtifact = typeof rawArtifact;

const artifact = rawArtifact as ObservationalArtifact & {
  monthlyObservations: Array<MonthlyFireRecord>;
};

export const NASA_OBSERVATIONAL_ARTIFACT = artifact;

export const NASA_OBSERVATIONAL_RECORDS: MonthlyFireRecord[] =
  artifact.monthlyObservations.map(record => ({
    ...record,
    sensorCoverage: record.sensorCoverage as MonthlyFireRecord['sensorCoverage'],
    modelApplied: record.modelApplied as MonthlyFireRecord['modelApplied'],
    notableEvent: record.notableEvent ?? undefined,
    cloudCoverPercent: record.cloudCoverPercent ?? 0,
    observationPassCount: record.observationPassCount ?? 0
  }));

export const NASA_OBSERVATIONAL_REGION_ID = 'california';

export const NASA_OBSERVATIONAL_LABEL =
  'NASA Observational Data — California 2018–2022';

export interface ObservationalEvaluationConfig {
  trainingStart: string;
  trainingEnd: string;
  holdoutStart: string;
  holdoutEnd: string;
  holdoutMonths: number;
  referenceSensor: 'VIIRS';
}

export const NASA_OBSERVATIONAL_EVALUATION: ObservationalEvaluationConfig = {
  trainingStart: NASA_OBSERVATIONAL_ARTIFACT.calibration.training_period?.[0] ?? '2018-01',
  trainingEnd: NASA_OBSERVATIONAL_ARTIFACT.calibration.training_period?.[1] ?? '2020-06',
  holdoutStart: NASA_OBSERVATIONAL_ARTIFACT.calibration.holdout_period?.[0] ?? '2020-07',
  holdoutEnd: NASA_OBSERVATIONAL_ARTIFACT.calibration.holdout_period?.[1] ?? '2022-12',
  holdoutMonths: NASA_OBSERVATIONAL_ARTIFACT.calibration.holdout_sample_size_months ?? 30,
  referenceSensor: 'VIIRS'
};
