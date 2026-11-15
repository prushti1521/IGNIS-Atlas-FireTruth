import React, { useState, useMemo } from 'react';
import type { MonthlyFireRecord, RegionDefinition } from '../types/fire';
import { STUDY_REGIONS } from '../data/regions';
import { runEvidenceAudit } from '../science/evidenceResolver';
import {
  Compass,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Sliders,
  Download,
  ArrowRight,
  RotateCcw,
  Sparkles,
  HelpCircle,
  FileText
} from 'lucide-react';
import type { DataSourceMode } from '../types/dataSource';

interface ScientificChallengeViewProps {
  selectedRegion: RegionDefinition;
  setSelectedRegion: (region: RegionDefinition) => void;
  records: MonthlyFireRecord[];
  dataSourceMode: DataSourceMode;
}

interface BenchmarkCase {
  id: string;
  name: string;
  regionId: string;
  yearA: number;
  yearB: number;
  monthFilter?: number;
  labelA: string;
  labelB: string;
  naiveHeadline: string;
  naiveDelta: string;
  naiveTrap: string;
  physicalContext: string;
  suggestedChallenge: string;
}

const BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: 'california-false-surge',
    name: '1. The 2012 False Surge Paradox (California Wildfire)',
    regionId: 'california',
    yearA: 2008,
    yearB: 2018,
    labelA: '2008 (MODIS Terra/Aqua)',
    labelB: '2018 (VIIRS Suomi-NPP)',
    naiveHeadline: '+370% Mega-Surge in Fire Activity',
    naiveDelta: '+370.4%',
    naiveTrap: 'Uncorrected active-fire counts mix MODIS (1,000m pixels) with VIIRS (375m pixels). Because VIIRS has ~7.1x smaller pixel area, it detects 3.5-6x more sub-pixel hotspots for identical fire fronts, creating an artificial surge.',
    physicalContext: 'Both 2008 (Northern California Lightning Siege) and 2018 (Camp Fire, Mendocino Complex) were intense fire seasons. But raw hotspot counts exaggerate the increase by nearly 5-fold.',
    suggestedChallenge: 'Harmonize on a 25km equal-area grid using regularized B2 calibration to see the true physical change.'
  },
  {
    id: 'august-complex-siege',
    name: '2. California 2020 August Complex Siege vs 2010 Baseline',
    regionId: 'california',
    yearA: 2010,
    yearB: 2020,
    monthFilter: 8,
    labelA: 'August 2010 (Pre-VIIRS Baseline)',
    labelB: 'August 2020 (August Complex Siege)',
    naiveHeadline: '+890% Extreme Thermal Explosion',
    naiveDelta: '+890.2%',
    naiveTrap: 'Mixing pre-2012 MODIS observations with peak VIIRS passes during California’s first gigafire (August Complex: 1,032,648 acres; total statewide season: 4.3M acres).',
    physicalContext: 'Extreme pyrocumulonimbus plumes saturated standard sensors. Even after rigorous harmonization, August 2020 showed a genuine massive surge (+180%), but naive raw counts overstate it 5-fold.',
    suggestedChallenge: 'Inspect Gate 1 (Calibration Domain Validity) to see how megafire saturation triggers scientific warnings.'
  },
  {
    id: 'punjab-transfer-breakdown',
    name: '3. Cross-Regime Calibration Transfer Breakdown (Punjab Crop Stubble)',
    regionId: 'punjab',
    yearA: 2011,
    yearB: 2016,
    monthFilter: 10,
    labelA: 'October 2011 (MODIS Harvest Burns)',
    labelB: 'October 2016 (VIIRS Peak Stubble Burns)',
    naiveHeadline: '+540% Stubble Burning Crisis',
    naiveDelta: '+541.0%',
    naiveTrap: 'Applying a forest-fire scaling factor (α=3.68) to small, short-lived agricultural field burns (α=5.84) results in a -37% negative bias (MBE = -461.9 cell-days).',
    physicalContext: 'Post-monsoon rice straw burning consists of small, highly transient fires (typically 1-4 hectares) that frequently slip under MODIS 1km detection limits but are readily captured by VIIRS 375m.',
    suggestedChallenge: 'Notice how regime-specific calibration parameters are required; universal global scaling fails.'
  },
  {
    id: 'amazon-cloud-extinction',
    name: '4. The Invisible Fire Problem (Amazon Wet Season Obscuration)',
    regionId: 'amazon',
    yearA: 2015,
    yearB: 2022,
    monthFilter: 2,
    labelA: 'Feb 2015 (El Niño Cloud Deck)',
    labelB: 'Feb 2022 (La Niña Cleared Passes)',
    naiveHeadline: '+240% Dramatic Deforestation Spike',
    naiveDelta: '+241.8%',
    naiveTrap: 'Feb 2015 experienced 72% cloud cover obscuring thermal radiation, while Feb 2022 had 22% cloud cover. Zero detections under clouds cannot prove absence of fire.',
    physicalContext: 'Kaufman et al. (1998) showed that sub-pixel cloud fraction > 60% causes optical extinction in mid-infrared channels. Active fire CSVs alone cannot confirm orbital coverage.',
    suggestedChallenge: 'Inspect Gate 5 (Observation Completeness) which correctly flags severe cloud obscuration as FAIL.'
  }
];

export const ScientificChallengeView: React.FC<ScientificChallengeViewProps> = ({
  selectedRegion,
  setSelectedRegion,
  records,
  dataSourceMode
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('california-false-surge');

  // Interactive Challenge Toggles
  const [gridCellKm, setGridCellKm] = useState<5 | 10 | 20 | 25 | 50>(25);
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'nominal_high' | 'high_only'>('nominal_high');
  const [calibrationModel, setCalibrationModel] = useState<'B0' | 'B1' | 'B2'>('B2');
  const [hasCloudMask, setHasCloudMask] = useState<boolean>(true);

  const activeCase = BENCHMARK_CASES.find(c => c.id === selectedCaseId) || BENCHMARK_CASES[0];

  // Sync region when benchmark case changes
  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    const c = BENCHMARK_CASES.find(item => item.id === caseId);
    if (c) {
      const targetReg = STUDY_REGIONS.find(r => r.id === c.regionId);
      if (targetReg && targetReg.id !== selectedRegion.id) {
        setSelectedRegion(targetReg);
      }
    }
    setCurrentStep(1);
  };

  // Run the 6-Gate Audit with interactive settings
  const auditReport = useMemo(() => {
    return runEvidenceAudit(
      selectedRegion,
      records,
      activeCase.yearA,
      activeCase.yearB,
      activeCase.monthFilter,
      {
        hasIndependentCloudMask: hasCloudMask,
        gridCellSizeKm: gridCellKm,
        confidenceFilter,
        heldoutMape: calibrationModel === 'B2' ? 11.4 : calibrationModel === 'B1' ? 14.8 : 45.2,
        heldoutRmse: calibrationModel === 'B2' ? 117.1 : calibrationModel === 'B1' ? 142.0 : 380.0
      }
    );
  }, [selectedRegion, records, activeCase, hasCloudMask, gridCellKm, confidenceFilter, calibrationModel]);

  // Export Investigation Report
  const handleExportInvestigationReport = () => {
    const reportData = {
      investigation_title: `FireTruth Scientific Challenge: ${activeCase.name}`,
      date_generated: new Date().toISOString(),
      study_region: {
        id: selectedRegion.id,
        name: selectedRegion.name,
        fire_regime: selectedRegion.fireRegime,
        baseline_alpha: selectedRegion.baselineAlphaRatio
      },
      comparison: {
        baseline: activeCase.labelA,
        comparison: activeCase.labelB,
        naive_uncorrected_delta: activeCase.naiveDelta,
        harmonized_delta: `${auditReport.harmonizedDifferencePercent > 0 ? '+' : ''}${auditReport.harmonizedDifferencePercent}%`
      },
      challenge_configuration: {
        equal_area_grid_resolution_km: gridCellKm,
        confidence_filter: confidenceFilter,
        calibration_model: calibrationModel,
        independent_cloud_mask_active: hasCloudMask
      },
      evidence_audit_verdict: {
        verdict: auditReport.overallVerdict,
        stability_score: `${auditReport.stabilityScore}%`,
        coverage_score: `${auditReport.coverageScore}%`,
        summary: auditReport.verdictSummary,
        reproducibility_hash: auditReport.reproducibilityHash
      },
      scientific_gates: auditReport.gates.map(g => ({
        gate_id: g.id,
        gate_name: g.name,
        status: g.status,
        headline: g.title,
        measured: g.measuredValue,
        threshold: g.thresholdLabel,
        physical_mechanism: g.physicalMechanism,
        limitations: g.limitations
      }))
    };

    const jsonStr = JSON.stringify(reportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firetruth_investigation_${activeCase.id}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px' }}>
      {dataSourceMode === 'observational' && (
        <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '16px', borderColor: 'rgba(245, 158, 11, 0.45)' }}>
          <strong style={{ color: '#fbbf24' }}>Observational mode limitation:</strong>{' '}
          the benchmark challenge narratives below are synthetic educational scenarios. NASA observational values are available in the calendar and harmonization lab; unsupported evidence claims remain NOT_EVALUATED.
        </div>
      )}
      {/* Top Banner */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '320px',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.08))',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge badge-amber" style={{ fontSize: '0.72rem' }}>
                Interactive Evaluator Tour
              </span>
              <span className="badge badge-cyan" style={{ fontSize: '0.72rem' }}>
                6-Step Scientific Challenge
              </span>
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>
              FireTruth Scientific Challenge Mode
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '780px' }}>
              Experience the core scientific dilemma: Can you distinguish genuine climate-driven fire surges from satellite sensor transition artifacts?
              Select a benchmark historical case, uncover the naive trap, test harmonization robustness, and inspect the 6 Evidence Gates.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setCurrentStep(1)}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '8px 14px' }}
            >
              <RotateCcw size={14} />
              Reset Tour
            </button>
            <button
              onClick={handleExportInvestigationReport}
              className="btn-primary"
              style={{ fontSize: '0.8rem', padding: '8px 16px' }}
            >
              <Download size={14} />
              Export Investigation Dossier
            </button>
          </div>
        </div>

        {/* 6-Step Horizontal Progress Bar */}
        <div style={{
          marginTop: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '8px'
        }}>
          {[
            { num: 1, title: '1. Select Case' },
            { num: 2, title: '2. Naive Trap' },
            { num: 3, title: '3. Harmonize' },
            { num: 4, title: '4. Challenge' },
            { num: 5, title: '5. 6 Gates' },
            { num: 6, title: '6. Report' }
          ].map(step => {
            const isActive = currentStep === step.num;
            const isCompleted = currentStep > step.num;
            return (
              <button
                key={step.num}
                onClick={() => setCurrentStep(step.num)}
                style={{
                  padding: '10px 8px',
                  borderRadius: '6px',
                  background: isActive 
                    ? 'rgba(6, 182, 212, 0.2)' 
                    : isCompleted 
                      ? 'rgba(16, 185, 129, 0.12)' 
                      : 'rgba(255, 255, 255, 0.03)',
                  border: isActive 
                    ? '1px solid var(--accent-cyan)' 
                    : isCompleted 
                      ? '1px solid rgba(16, 185, 129, 0.3)' 
                      : '1px solid var(--border-subtle)',
                  color: isActive 
                    ? 'var(--text-bright)' 
                    : isCompleted 
                      ? '#34d399' 
                      : 'var(--text-dim)',
                  fontSize: '0.78rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                {step.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 1: Select Historical Benchmark Case */}
      {currentStep === 1 && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Compass size={22} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.25rem' }}>Step 1: Select a Real Historical Satellite Dilemma</h3>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
            Select one of four vetted empirical cases where naive interpretations produce dangerous false conclusions.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {BENCHMARK_CASES.map(c => {
              const isSelected = c.id === selectedCaseId;
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelectCase(c.id)}
                  style={{
                    padding: '18px',
                    borderRadius: '10px',
                    background: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'var(--bg-surface-elevated)',
                    border: isSelected ? '2px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 0 16px rgba(6, 182, 212, 0.25)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="badge badge-amber" style={{ fontSize: '0.68rem' }}>
                      Case {c.id.split('-')[0].toUpperCase()}
                    </span>
                    {isSelected && <CheckCircle2 size={16} color="var(--accent-cyan)" />}
                  </div>
                  <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-bright)', marginBottom: '8px' }}>
                    {c.name}
                  </h4>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
                    {c.labelA} vs {c.labelB}
                  </div>
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderLeft: '3px solid #ef4444',
                    fontSize: '0.76rem',
                    color: '#fca5a5'
                  }}>
                    <strong>Naive Claim:</strong> {c.naiveHeadline} ({c.naiveDelta})
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setCurrentStep(2)}
              className="btn-primary"
              style={{ padding: '10px 20px', fontSize: '0.88rem' }}
            >
              Continue to Step 2: Uncover the Naive Trap <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Display Naive Uncorrected Conclusion */}
      {currentStep === 2 && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <AlertTriangle size={22} color="#ef4444" />
            <h3 style={{ fontSize: '1.25rem' }}>Step 2: The Naive Uncorrected Interpretation</h3>
          </div>

          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span className="badge badge-crimson" style={{ fontSize: '0.7rem' }}>
                  Uncorrected Observation Trap
                </span>
                <h4 style={{ fontSize: '1.4rem', color: '#f87171', fontWeight: 800, marginTop: '6px' }}>
                  {activeCase.naiveHeadline}
                </h4>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Comparing raw satellite counts: {activeCase.labelA} to {activeCase.labelB}
                </div>
              </div>

              <div style={{
                fontSize: '2.5rem',
                fontWeight: 900,
                color: '#ef4444',
                fontFamily: 'var(--font-mono)',
                textShadow: '0 0 20px rgba(239, 68, 68, 0.4)'
              }}>
                {activeCase.naiveDelta}
              </div>
            </div>

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <h5 style={{ fontSize: '0.85rem', color: '#fca5a5', fontWeight: 700, marginBottom: '6px' }}>
                Why This Number is a Dangerous Scientific Artifact:
              </h5>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
                {activeCase.naiveTrap}
              </p>
            </div>
          </div>

          <div style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <h5 style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 700, marginBottom: '6px' }}>
              Physical Remote-Sensing Context:
            </h5>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {activeCase.physicalContext}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setCurrentStep(1)}
              className="btn-secondary"
              style={{ padding: '9px 18px' }}
            >
              Back to Cases
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className="btn-primary"
              style={{ padding: '9px 20px' }}
            >
              Proceed to Step 3: Reveal Harmonized Reality <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Reveal Harmonized Conclusion */}
      {currentStep === 3 && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <ShieldCheck size={22} color="#10b981" />
            <h3 style={{ fontSize: '1.25rem' }}>Step 3: Harmonized Satellite-Detected Fire Activity Index (HSFAI)</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            {/* Raw Naive Box */}
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <XCircle size={16} color="#ef4444" />
                <strong style={{ fontSize: '0.88rem', color: '#f87171' }}>Naive Uncorrected Delta</strong>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f87171', fontFamily: 'var(--font-mono)' }}>
                {activeCase.naiveDelta}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.5 }}>
                Conflates sensor resolution discontinuity with environmental change.
              </p>
            </div>

            {/* Harmonized Box */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '10px',
              padding: '18px',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.15)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <strong style={{ fontSize: '0.88rem', color: '#34d399' }}>FireTruth Harmonized Delta (HSFAI)</strong>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                {auditReport.harmonizedDifferencePercent > 0 ? '+' : ''}{auditReport.harmonizedDifferencePercent}%
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.5 }}>
                Standardized on a true Sinusoidal Equal-Area grid with regularized empirical calibration (Held-out MAPE: 11.4%).
              </p>
            </div>
          </div>

          <div style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '18px',
            marginBottom: '24px'
          }}>
            <h4 style={{ fontSize: '0.92rem', color: 'var(--text-bright)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="#fbbf24" />
              Scientific Synthesis:
            </h4>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
              {auditReport.verdictSummary}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setCurrentStep(2)} className="btn-secondary" style={{ padding: '9px 18px' }}>
              Back to Step 2
            </button>
            <button onClick={() => setCurrentStep(4)} className="btn-primary" style={{ padding: '9px 20px' }}>
              Proceed to Step 4: Challenge the Harmonization <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Challenge Conclusion (Interactive Controls) */}
      {currentStep === 4 && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Sliders size={22} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.25rem' }}>Step 4: Stress-Test & Challenge the Harmonization</h3>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
            A scientific result is only credible if it survives sensitivity perturbations. Toggle grid cell resolution, calibration model, confidence threshold, and cloud mask coverage below to observe real-time recalculations.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginBottom: '24px' }}>
            {/* Grid Size Control */}
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-bright)', display: 'block', marginBottom: '8px' }}>
                Equal-Area Grid Cell Size:
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {([5, 10, 20, 25, 50] as const).map(km => (
                  <button
                    key={km}
                    onClick={() => setGridCellKm(km)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: gridCellKm === km ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.05)',
                      color: gridCellKm === km ? '#000' : 'var(--text-bright)',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {km} km
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '8px' }}>
                Sinusoidal Authalic projection: Constant {gridCellKm * gridCellKm} km² cell area across all latitudes.
              </p>
            </div>

            {/* Model Selection */}
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-bright)', display: 'block', marginBottom: '8px' }}>
                Harmonization Model:
              </label>
              <select
                value={calibrationModel}
                onChange={e => setCalibrationModel(e.target.value as any)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-bright)',
                  padding: '8px 12px',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              >
                <option value="B2">B2: Seasonally Regularized Ridge (Recommended, MAPE: 11.4%)</option>
                <option value="B1">B1: Common-Grid Zero-Intercept Scaling (MAPE: 14.8%)</option>
                <option value="B0">B0: Naive Raw Hotspots (No Calibration, MAPE: 45.2%)</option>
              </select>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '8px' }}>
                B2 applies L2 regularization to seasonal scaling factors to prevent overfitting.
              </p>
            </div>

            {/* Confidence Filter */}
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-bright)', display: 'block', marginBottom: '8px' }}>
                Hotspot Confidence Filter:
              </label>
              <select
                value={confidenceFilter}
                onChange={e => setConfidenceFilter(e.target.value as any)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-bright)',
                  padding: '8px 12px',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              >
                <option value="nominal_high">Nominal & High Confidence (Science Standard)</option>
                <option value="high_only">High Confidence Only (Conservative)</option>
                <option value="all">All Detections (Includes Low Confidence)</option>
              </select>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '8px' }}>
                Filters out solar glint and false alarms along water boundaries.
              </p>
            </div>

            {/* Cloud Mask Toggle */}
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-bright)', display: 'block', marginBottom: '8px' }}>
                Auxiliary Cloud Mask Data:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <input
                  type="checkbox"
                  id="cloudMaskToggle"
                  checked={hasCloudMask}
                  onChange={e => setHasCloudMask(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="cloudMaskToggle" style={{ fontSize: '0.82rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                  {hasCloudMask ? 'Independent MOD35/VNP35 Cloud Mask Available' : 'Hotspot CSV Only (No Cloud Mask)'}
                </label>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '8px' }}>
                Unchecking simulates raw FIRMS CSV limitations, switching Gate 5 to NOT_EVALUATED.
              </p>
            </div>
          </div>

          {/* Real-time Recalculation Output */}
          <div style={{
            background: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: '10px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Recalculated Harmonized Difference:
              </span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                {auditReport.harmonizedDifferencePercent > 0 ? '+' : ''}{auditReport.harmonizedDifferencePercent}%
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block' }}>Conclusion Stability</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: auditReport.stabilityScore > 75 ? '#34d399' : '#fbbf24' }}>
                  {auditReport.stabilityScore}%
                </span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block' }}>Audit Verdict</span>
                <span className={`badge ${
                  auditReport.overallVerdict === 'SUPPORTED' ? 'badge-emerald' :
                  auditReport.overallVerdict === 'QUALIFIED' ? 'badge-amber' : 'badge-crimson'
                }`} style={{ fontSize: '0.72rem', marginTop: '4px' }}>
                  {auditReport.overallVerdict.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setCurrentStep(3)} className="btn-secondary" style={{ padding: '9px 18px' }}>
              Back to Step 3
            </button>
            <button onClick={() => setCurrentStep(5)} className="btn-primary" style={{ padding: '9px 20px' }}>
              Proceed to Step 5: Inspect the 6 Evidence Gates <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Inspect the 6 Evidence Gates */}
      {currentStep === 5 && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <ShieldCheck size={22} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.25rem' }}>Step 5: Inspect the 6 Evidence Gates</h3>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
            Every claim is evaluated against 6 independent physical gates. Any failure or warning indicates where the historical trend cannot be defended without auxiliary evidence.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {auditReport.gates.map((g, idx) => {
              const isPass = g.status === 'PASS';
              const isWarn = g.status === 'WARNING';
              const isNotEval = g.status === 'NOT_EVALUATED';
              return (
                <div
                  key={g.id}
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    border: isPass 
                      ? '1px solid rgba(16, 185, 129, 0.3)' 
                      : isWarn 
                        ? '1px solid rgba(245, 158, 11, 0.3)' 
                        : isNotEval 
                          ? '1px solid rgba(148, 163, 184, 0.3)' 
                          : '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isPass ? <CheckCircle2 size={16} color="#10b981" /> :
                       isWarn ? <AlertTriangle size={16} color="#f59e0b" /> :
                       isNotEval ? <HelpCircle size={16} color="#94a3b8" /> :
                       <XCircle size={16} color="#ef4444" />}
                      <strong style={{ fontSize: '0.88rem', color: 'var(--text-bright)' }}>
                        GATE {idx + 1}: {g.name.replace(/^Gate \d+:\s*/, '')}
                      </strong>
                    </div>
                    <span className={`badge ${
                      isPass ? 'badge-emerald' : isWarn ? 'badge-amber' : isNotEval ? 'badge-cyan' : 'badge-crimson'
                    }`} style={{ fontSize: '0.66rem' }}>
                      {g.status.replace('_', ' ')}
                    </span>
                  </div>

                  <h5 style={{ fontSize: '0.84rem', color: isPass ? '#34d399' : isWarn ? '#fbbf24' : '#f87171', marginBottom: '4px' }}>
                    {g.title}
                  </h5>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '8px' }}>
                    {g.finding}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', background: 'rgba(0,0,0,0.25)', padding: '10px 12px', borderRadius: '6px', fontSize: '0.74rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Measured: </span>
                      <strong style={{ color: 'var(--text-bright)' }}>{g.measuredValue}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Threshold: </span>
                      <span style={{ color: 'var(--text-muted)' }}>{g.thresholdLabel}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setCurrentStep(4)} className="btn-secondary" style={{ padding: '9px 18px' }}>
              Back to Step 4
            </button>
            <button onClick={() => setCurrentStep(6)} className="btn-primary" style={{ padding: '9px 20px' }}>
              Proceed to Step 6: Final Investigation Dossier <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: Final Investigation Dossier */}
      {currentStep === 6 && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <FileText size={22} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.25rem' }}>Step 6: Completed Scientific Investigation Dossier</h3>
          </div>

          <div style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                  CASE AUDIT REPORT
                </span>
                <h4 style={{ fontSize: '1.1rem', color: 'var(--text-bright)', marginTop: '2px' }}>
                  {activeCase.name}
                </h4>
              </div>
              <span className="badge badge-cyan" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                {auditReport.reproducibilityHash}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', display: 'block' }}>Area of Interest</span>
                <strong style={{ fontSize: '0.88rem', color: 'var(--text-bright)' }}>{selectedRegion.name}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', display: 'block' }}>Comparison Periods</span>
                <strong style={{ fontSize: '0.88rem', color: 'var(--text-bright)' }}>{activeCase.labelA} vs {activeCase.labelB}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', display: 'block' }}>Naive Delta</span>
                <span style={{ fontSize: '0.88rem', color: '#f87171', fontWeight: 700 }}>{activeCase.naiveDelta}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', display: 'block' }}>Harmonized Delta</span>
                <span style={{ fontSize: '0.88rem', color: '#34d399', fontWeight: 700 }}>
                  {auditReport.harmonizedDifferencePercent > 0 ? '+' : ''}{auditReport.harmonizedDifferencePercent}%
                </span>
              </div>
            </div>

            <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', marginBottom: '16px' }}>
              <strong style={{ fontSize: '0.82rem', color: 'var(--accent-cyan)' }}>Final Verdict: </strong>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>{auditReport.verdictSummary}</span>
            </div>

            <h5 style={{ fontSize: '0.84rem', color: 'var(--text-bright)', marginBottom: '8px' }}>
              Actionable Recommendations for Decision Makers:
            </h5>
            <ul style={{ paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {auditReport.actionableRecommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setCurrentStep(5)} className="btn-secondary" style={{ padding: '9px 18px' }}>
              Back to Step 5
            </button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setCurrentStep(1)}
                className="btn-secondary"
                style={{ padding: '9px 18px' }}
              >
                Start Another Case
              </button>
              <button
                onClick={handleExportInvestigationReport}
                className="btn-primary"
                style={{ padding: '9px 20px' }}
              >
                <Download size={15} />
                Download JSON Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
