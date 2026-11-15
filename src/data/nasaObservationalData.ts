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
