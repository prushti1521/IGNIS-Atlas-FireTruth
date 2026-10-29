import type { CalibrationModelResult, MonthlyFireRecord, RegionDefinition } from '../types/fire';

export interface CalibrationParams {
  trainStartYear: number;
  trainEndYear: number;
  testStartYear: number;
  testEndYear: number;
  gridSizeDeg: number; // e.g. 0.1, 0.25, 0.5
  confidenceFilter: 'all' | 'nominal_high' | 'high_only';
}

export const DEFAULT_CALIBRATION_PARAMS: CalibrationParams = {
  trainStartYear: 2012,
  trainEndYear: 2018,
  testStartYear: 2019,
  testEndYear: 2024,
  gridSizeDeg: 0.25, // Standard ~25km equal-area cell
  confidenceFilter: 'nominal_high'
};

/**
 * Computes calibration metrics (MAE, RMSE, R2, MAPE) between observed VIIRS cell-days
 * and predicted VIIRS cell-days from MODIS cell-days.
 */
export function evaluateCalibrationModels(
  records: MonthlyFireRecord[],
  region: RegionDefinition,
  params: CalibrationParams = DEFAULT_CALIBRATION_PARAMS
): {
  b0: CalibrationModelResult;
  b1: CalibrationModelResult;
  b2: CalibrationModelResult;
  scatterPoints: Array<{ modis: number; viirs: number; year: number; month: number; isTest: boolean }>;
} {
  // Filter records within the overlap era (2012+) with valid VIIRS and MODIS cell-days
  const overlapRecords = records.filter(
    r => r.year >= 2012 && r.modisCellDays > 0 && r.viirsCellDays > 0
  );

  const trainSet = overlapRecords.filter(
    r => r.year >= params.trainStartYear && r.year <= params.trainEndYear
  );
  
  const testSet = overlapRecords.filter(
    r => r.year >= params.testStartYear && r.year <= params.testEndYear
  );

  // Scatter points for plotting
  const scatterPoints = overlapRecords.map(r => ({
    modis: r.modisCellDays,
    viirs: r.viirsCellDays,
    year: r.year,
    month: r.month,
    isTest: r.year >= params.testStartYear && r.year <= params.testEndYear
  }));

  // ==========================================
  // MODEL B0: Raw Uncorrected Baseline (\hat{A}_V = A_M)
  // ==========================================
  const b0TrainPreds = trainSet.map(r => r.modisCellDays);
  const b0TestPreds = testSet.map(r => r.modisCellDays);
  const b0Metrics = computeFitMetrics(
    trainSet.map(r => r.viirsCellDays),
    b0TrainPreds,
    testSet.map(r => r.viirsCellDays),
    b0TestPreds
  );

  const b0: CalibrationModelResult = {
    id: 'B0',
    name: 'B0 — Raw Common-Grid Count',
    description: 'No correction applied. Assumes 1 MODIS cell-day = 1 VIIRS cell-day. Causes severe step-jump artifact in 2012.',
    equation: 'Â_{V,m} = A_{M,m}',
    alpha: 1.0,
    trainPeriod: [params.trainStartYear, params.trainEndYear],
    testPeriod: [params.testStartYear, params.testEndYear],
    metrics: b0Metrics
  };

  // ==========================================
  // MODEL B1: Simple Global Scaling (\hat{A}_V = \alpha * A_M)
  // Fitted on training set via least-squares through origin
  // ==========================================
  let sumMV = 0;
  let sumMM = 0;
  for (const r of trainSet) {
    sumMV += r.modisCellDays * r.viirsCellDays;
    sumMM += r.modisCellDays * r.modisCellDays;
  }
  const b1Alpha = sumMM > 0 ? Number((sumMV / sumMM).toFixed(3)) : region.baselineAlphaRatio;

  const b1TrainPreds = trainSet.map(r => Math.round(r.modisCellDays * b1Alpha));
  const b1TestPreds = testSet.map(r => Math.round(r.modisCellDays * b1Alpha));
  const b1Metrics = computeFitMetrics(
    trainSet.map(r => r.viirsCellDays),
    b1TrainPreds,
    testSet.map(r => r.viirsCellDays),
    b1TestPreds
  );

  const b1: CalibrationModelResult = {
    id: 'B1',
    name: 'B1 — Empirical Proportional Scaling',
    description: 'Linear scaling ratio trained on 2012-2018 overlap. Bridges spatial resolution disparity across instruments.',
    equation: `Â_{V,m} = ${b1Alpha} × A_{M,m}`,
    alpha: b1Alpha,
    trainPeriod: [params.trainStartYear, params.trainEndYear],
    testPeriod: [params.testStartYear, params.testEndYear],
    metrics: b1Metrics
  };

  // ==========================================
  // MODEL B2: Regularized Seasonal & Regime Calibration
  // \hat{A}_V = \alpha_k + \beta_k * A_M with seasonal shrink
  // ==========================================
  const seasonalFactors: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    const monthTrain = trainSet.filter(r => r.month === m);
    if (monthTrain.length > 0) {
      let mSumMV = 0;
      let mSumMM = 0;
      for (const r of monthTrain) {
        mSumMV += r.modisCellDays * r.viirsCellDays;
        mSumMM += r.modisCellDays * r.modisCellDays;
      }
      // Shrinkage towards global B1 alpha to prevent overfitting (L2 Regularization)
      const rawMonthRatio = mSumMM > 0 ? mSumMV / mSumMM : b1Alpha;
      const regularizedRatio = 0.7 * rawMonthRatio + 0.3 * b1Alpha;
      seasonalFactors[m] = Number(regularizedRatio.toFixed(3));
    } else {
      seasonalFactors[m] = b1Alpha;
    }
  }

  const b2TrainPreds = trainSet.map(r => Math.round(r.modisCellDays * (seasonalFactors[r.month] || b1Alpha)));
  const b2TestPreds = testSet.map(r => Math.round(r.modisCellDays * (seasonalFactors[r.month] || b1Alpha)));
  const b2Metrics = computeFitMetrics(
    trainSet.map(r => r.viirsCellDays),
    b2TrainPreds,
    testSet.map(r => r.viirsCellDays),
    b2TestPreds
  );

  const b2: CalibrationModelResult = {
    id: 'B2',
    name: 'B2 — Regularized Seasonal Calibration',
    description: 'Seasonally adjusted scaling with L2 shrinkage toward global mean. Accounts for fire size variation across seasons.',
    equation: 'Â_{V,m} = α_k × A_{M,m} (with seasonal L2 shrinkage)',
    alpha: b1Alpha,
    seasonalFactors,
    trainPeriod: [params.trainStartYear, params.trainEndYear],
    testPeriod: [params.testStartYear, params.testEndYear],
    metrics: b2Metrics
  };

  return { b0, b1, b2, scatterPoints };
}

function computeFitMetrics(
  trainActual: number[],
  trainPred: number[],
  testActual: number[],
  testPred: number[]
) {
  const calc = (actual: number[], pred: number[]) => {
    if (actual.length === 0) return { mae: 0, rmse: 0, r2: 0, mape: 0 };
    
    let sumAbsErr = 0;
    let sumSqErr = 0;
    let sumPctErr = 0;
    let sumActual = 0;

    for (let i = 0; i < actual.length; i++) {
      const a = actual[i];
      const p = pred[i];
      const err = p - a;
      sumAbsErr += Math.abs(err);
      sumSqErr += err * err;
      sumActual += a;
      if (a > 0) {
        sumPctErr += Math.abs(err / a);
      }
    }

    const n = actual.length;
    const meanActual = sumActual / n;
    let sumTot = 0;
    for (let i = 0; i < n; i++) {
      const diff = actual[i] - meanActual;
      sumTot += diff * diff;
    }

    const mae = sumAbsErr / n;
    const rmse = Math.sqrt(sumSqErr / n);
    const r2 = sumTot > 0 ? Math.max(0, 1 - (sumSqErr / sumTot)) : 0;
    const mape = (sumPctErr / n) * 100;

    return {
      mae: Number(mae.toFixed(1)),
      rmse: Number(rmse.toFixed(1)),
      r2: Number(r2.toFixed(3)),
      mape: Number(mape.toFixed(1))
    };
  };

  const trainRes = calc(trainActual, trainPred);
  const testRes = calc(testActual, testPred);

  return {
    trainMAE: trainRes.mae,
    trainRMSE: trainRes.rmse,
    trainR2: trainRes.r2,
    heldoutMAE: testRes.mae,
    heldoutRMSE: testRes.rmse,
    heldoutR2: testRes.r2,
    heldoutMAPE: testRes.mape
  };
}
