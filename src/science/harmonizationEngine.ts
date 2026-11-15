import type { CalibrationModelResult, MonthlyFireRecord, RegionDefinition } from '../types/fire';

export interface CalibrationParams {
  trainStartYear: number;
  trainEndYear: number;
  testStartYear: number;
  testEndYear: number;
  cellKm: number; // Equal-Area cell size in km: 10, 25, 50
  confidenceFilter: 'all' | 'nominal_high' | 'high_only';
}

export const DEFAULT_CALIBRATION_PARAMS: CalibrationParams = {
  trainStartYear: 2012,
  trainEndYear: 2018,
  testStartYear: 2019,
  testEndYear: 2024,
  cellKm: 25, // Standard ~25km equal-area cell (~625 km²)
  confidenceFilter: 'nominal_high'
};

/**
 * Computes calibration metrics (MAE, RMSE, R2, MAPE) between observed VIIRS cell-days
 * and predicted VIIRS cell-days from MODIS cell-days on strictly held-out data (2019-2024).
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
  // Filter records within the overlap era (2012+) with valid non-null VIIRS and MODIS cell-days
  const overlapRecords = records.filter(
    (r): r is MonthlyFireRecord & { modisCellDays: number; viirsCellDays: number } =>
      r.isObserved &&
      r.year >= 2012 &&
      r.modisCellDays !== null &&
      r.viirsCellDays !== null &&
      r.modisCellDays > 0 &&
      r.viirsCellDays > 0
  );

  const trainSet = overlapRecords.filter(
    r => r.year >= params.trainStartYear && r.year <= params.trainEndYear
  );
  
  const testSet = overlapRecords.filter(
    r => r.year >= params.testStartYear && r.year <= params.testEndYear
  );

  // Scatter points for plotting (guaranteed non-null numbers)
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
    name: 'B0 — Raw Equal-Area Cell-Day Count',
    description: 'No correction applied. Assumes 1 MODIS cell-day = 1 VIIRS cell-day. Causes severe step-jump artifact in 2012.',
    equation: 'Â_{V,m} = A_{M,m}',
    alpha: 1.0,
    trainPeriod: [params.trainStartYear, params.trainEndYear],
    testPeriod: [params.testStartYear, params.testEndYear],
    metrics: {
      ...b0Metrics,
      relativeMapeReductionVsB0: 0,
      relativeRmseReductionVsB0: 0
    }
  };

  // ==========================================
  // MODEL B1: Simple Proportional Scaling (\hat{A}_V = \alpha * A_M)
  // Fitted on training set via least-squares through origin
  // ==========================================
  let sumMV = 0;
  let sumMM = 0;
  for (const r of trainSet) {
    sumMV += r.modisCellDays * r.viirsCellDays;
    sumMM += r.modisCellDays * r.modisCellDays;
  }
  const b1Alpha = sumMM > 0 ? Number((sumMV / sumMM).toFixed(3)) : region.baselineAlphaRatio;

  const b1TrainPreds = trainSet.map(r => r.modisCellDays * b1Alpha);
  const b1TestPreds = testSet.map(r => r.modisCellDays * b1Alpha);
  const b1Metrics = computeFitMetrics(
    trainSet.map(r => r.viirsCellDays),
    b1TrainPreds,
    testSet.map(r => r.viirsCellDays),
    b1TestPreds
  );

  const b1RelMape = b0Metrics.heldoutMAPE > 0 ? Number((((b0Metrics.heldoutMAPE - b1Metrics.heldoutMAPE) / b0Metrics.heldoutMAPE) * 100).toFixed(1)) : 0;
  const b1RelRmse = b0Metrics.heldoutRMSE > 0 ? Number((((b0Metrics.heldoutRMSE - b1Metrics.heldoutRMSE) / b0Metrics.heldoutRMSE) * 100).toFixed(1)) : 0;

  const b1: CalibrationModelResult = {
    id: 'B1',
    name: 'B1 — Empirical Proportional Scaling',
    description: 'Linear scaling ratio trained on 2012-2018 overlap. Bridges spatial resolution disparity across instruments.',
    equation: `Â_{V,m} = ${b1Alpha} × A_{M,m}`,
    alpha: b1Alpha,
    trainPeriod: [params.trainStartYear, params.trainEndYear],
    testPeriod: [params.testStartYear, params.testEndYear],
    metrics: {
      ...b1Metrics,
      relativeMapeReductionVsB0: b1RelMape,
      relativeRmseReductionVsB0: b1RelRmse
    }
  };

  // ==========================================
  // MODEL B2: Regularized Seasonal & Regime Calibration
  // \hat{A}_V = \alpha_k * A_M with seasonal L2 shrinkage toward global alpha
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
      const rawMonthRatio = mSumMM > 0 ? mSumMV / mSumMM : b1Alpha;
      const regularizedRatio = 0.65 * rawMonthRatio + 0.35 * b1Alpha;
      seasonalFactors[m] = Number(regularizedRatio.toFixed(3));
    } else {
      seasonalFactors[m] = b1Alpha;
    }
  }

  const b2TrainPreds = trainSet.map(r => r.modisCellDays * (seasonalFactors[r.month] || b1Alpha));
  const b2TestPreds = testSet.map(r => r.modisCellDays * (seasonalFactors[r.month] || b1Alpha));
  const b2Metrics = computeFitMetrics(
    trainSet.map(r => r.viirsCellDays),
    b2TrainPreds,
    testSet.map(r => r.viirsCellDays),
    b2TestPreds
  );

  const b2RelMape = b0Metrics.heldoutMAPE > 0 ? Number((((b0Metrics.heldoutMAPE - b2Metrics.heldoutMAPE) / b0Metrics.heldoutMAPE) * 100).toFixed(1)) : 0;
  const b2RelRmse = b0Metrics.heldoutRMSE > 0 ? Number((((b0Metrics.heldoutRMSE - b2Metrics.heldoutRMSE) / b0Metrics.heldoutRMSE) * 100).toFixed(1)) : 0;

  const b2: CalibrationModelResult = {
    id: 'B2',
    name: 'B2 — Regularized Seasonal Calibration',
    description: 'Seasonally adjusted scaling with L2 shrinkage toward global mean. Accounts for fire size variation across seasons.',
    equation: 'Â_{V,m} = α_k × A_{M,m} (with seasonal L2 shrinkage)',
    alpha: b1Alpha,
    seasonalFactors,
    trainPeriod: [params.trainStartYear, params.trainEndYear],
    testPeriod: [params.testStartYear, params.testEndYear],
    metrics: {
      ...b2Metrics,
      relativeMapeReductionVsB0: b2RelMape,
      relativeRmseReductionVsB0: b2RelRmse
    }
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
    let countPct = 0;
    let sumActual = 0;

    for (let i = 0; i < actual.length; i++) {
      const a = actual[i];
      const p = pred[i];
      const err = p - a;
      sumAbsErr += Math.abs(err);
      sumSqErr += err * err;
      sumActual += a;
      // Stable percentage error: minimum activity floor of 5 cell-days
      if (a >= 5) {
        sumPctErr += Math.abs(err / a);
        countPct++;
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
    const mape = countPct > 0 ? (sumPctErr / countPct) * 100 : 0;

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
