import React, { useState } from 'react';
import { runEvidenceAudit } from '../science/evidenceResolver';
import type { MonthlyFireRecord, RegionDefinition } from '../types/fire';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Sparkles,
  FileSpreadsheet,
  Compass,
  FileText,
  ChevronDown,
  ChevronUp,
  BookOpen,
  HelpCircle
} from 'lucide-react';
import type { DataSourceMode } from '../types/dataSource';
import { TransferEvidenceCard } from './TransferEvidenceCard';

interface EvidenceResolverViewProps {
  records: MonthlyFireRecord[];
  selectedRegion: RegionDefinition;
  initialYearA?: number;
  initialYearB?: number;
  initialMonth?: number;
  onOpenReport: () => void;
  dataSourceMode: DataSourceMode;
}

export const EvidenceResolverView: React.FC<EvidenceResolverViewProps> = ({
  records,
  selectedRegion,
  initialYearA = 2008,
  initialYearB = 2018,
  initialMonth,
  onOpenReport,
  dataSourceMode
}) => {
  const [yearA, setYearA] = useState<number>(dataSourceMode === 'observational' ? 2018 : initialYearA);
  const [yearB, setYearB] = useState<number>(dataSourceMode === 'observational' ? 2022 : initialYearB);
  const [monthFilter, setMonthFilter] = useState<number | undefined>(initialMonth);
  const [expandedGates, setExpandedGates] = useState<Record<string, boolean>>({
    'gate-1-domain': false,
    'gate-2-calibration': true, // Keep key gate expanded by default for judges
    'gate-3-uncertainty': false,
    'gate-4-sensitivity': false,
    'gate-5-observation': false,
    'gate-6-independent': false
  });

  const toggleGate = (id: string) => {
    setExpandedGates(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    setExpandedGates({
      'gate-1-domain': true,
      'gate-2-calibration': true,
      'gate-3-uncertainty': true,
      'gate-4-sensitivity': true,
      'gate-5-observation': true,
      'gate-6-independent': true
    });
  };

  const collapseAll = () => {
    setExpandedGates({
      'gate-1-domain': false,
      'gate-2-calibration': false,
      'gate-3-uncertainty': false,
      'gate-4-sensitivity': false,
      'gate-5-observation': false,
      'gate-6-independent': false
    });
  };

  // Run the 5-Gate Evidence Audit
  const audit = runEvidenceAudit(selectedRegion, records, yearA, yearB, monthFilter, {
    dataSourceMode
  });

  const monthNames = [
    'All Months (Annual Aggregate)',
    '1 - January', '2 - February', '3 - March', '4 - April',
    '5 - May', '6 - June', '7 - July', '8 - August',
    '9 - September', '10 - October', '11 - November', '12 - December'
  ];

  // Presets for Hackathon Judges
  const applyPreset = (presetKey: string) => {
    if (presetKey === 'false_surge') {
      setYearA(2008);
      setYearB(2018);
      setMonthFilter(undefined);
    } else if (presetKey === 'august_complex') {
      setYearA(2010);
      setYearB(2020);
      setMonthFilter(8); // August
    } else if (presetKey === 'atmospheric_river') {
      setYearA(2020);
      setYearB(2023);
      setMonthFilter(undefined);
    } else if (presetKey === 'recent_siege') {
      setYearA(2021);
      setYearB(2024);
      setMonthFilter(7); // July (Park Fire)
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {dataSourceMode === 'observational' && (
        <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '16px', borderColor: 'rgba(245, 158, 11, 0.45)' }}>
          <strong style={{ color: '#fbbf24' }}>NASA observational evidence qualification:</strong>{' '}
          this artifact contains positive active-fire detections and cell-days, not complete orbital coverage or independent ground truth. Coverage-dependent claims are NOT_EVALUATED.
        </div>
      )}
      {dataSourceMode === 'observational' && <TransferEvidenceCard />}
      {/* Banner */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={24} color="#ff5722" />
            <h2 style={{ fontSize: '1.4rem' }}>FireTruth Evidence Resolver</h2>
            <span className="badge badge-fire">Flagship Verification Engine</span>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Evidence-Gated Fire Intelligence: Formulate any historical hypothesis and audit it against 5 concrete scientific gates.
            Distinguishes authentic physical burning shifts from sensor resolution discontinuities, cloud voids, and calibration instability.
          </p>
        </div>
        <button
          onClick={onOpenReport}
          className="btn-primary"
          style={{ fontSize: '0.82rem', padding: '7px 14px' }}
        >
          <FileText size={15} />
          Generate NASA Evidence Dossier
        </button>
      </div>

      {/* Preset Quick-Buttons for Evaluators */}
      <div style={{
        background: 'var(--bg-surface)',
        padding: '12px 18px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="#fbbf24" />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fbbf24' }}>Judge Case Study Scenarios:</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => applyPreset('false_surge')}
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '5px 10px' }}
          >
            1. The 2012 False Surge Paradox (2008 vs 2018)
          </button>
          <button
            onClick={() => applyPreset('august_complex')}
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '5px 10px' }}
          >
            2. 2020 August Megafire Siege vs 2010 Baseline
          </button>
          <button
            onClick={() => applyPreset('atmospheric_river')}
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '5px 10px' }}
          >
            3. Atmospheric River Suppression (2020 vs 2023)
          </button>
          <button
            onClick={() => applyPreset('recent_siege')}
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '5px 10px' }}
          >
            4. 2024 Park Fire (429k ac) vs 2021 Dixie Fire
          </button>
        </div>
      </div>

      {/* Hypothesis Builder Inputs */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Compass size={18} color="var(--accent-cyan)" />
          Formulate Historical Hypothesis to Audit ({selectedRegion.name})
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'center' }}>
          {/* Baseline Period A */}
          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-dim)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
              PERIOD A (BASELINE YEAR):
            </label>
            <select
              value={yearA}
              onChange={e => setYearA(Number(e.target.value))}
              style={{ width: '100%', fontSize: '0.85rem', fontWeight: 600 }}
            >
              {Array.from({ length: 26 }, (_, i) => 2000 + i).map(yr => (
                <option key={yr} value={yr}>
                  {yr} {yr < 2012 ? '(MODIS Era)' : '(Concurrent Overlap)'}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-dim)', paddingTop: '16px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>COMPARED AGAINST</span>
          </div>

          {/* Comparison Period B */}
          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-dim)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
              PERIOD B (COMPARISON YEAR):
            </label>
            <select
              value={yearB}
              onChange={e => setYearB(Number(e.target.value))}
              style={{ width: '100%', fontSize: '0.85rem', fontWeight: 600 }}
            >
              {Array.from({ length: 26 }, (_, i) => 2000 + i).map(yr => (
                <option key={yr} value={yr}>
                  {yr} {yr < 2012 ? '(MODIS Era)' : '(Concurrent Overlap)'}
                </option>
              ))}
            </select>
          </div>

          {/* Temporal Stratum (Month Filter) */}
          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-dim)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
              TEMPORAL STRATUM:
            </label>
            <select
              value={monthFilter ?? 0}
              onChange={e => {
                const val = Number(e.target.value);
                setMonthFilter(val === 0 ? undefined : val);
              }}
              style={{ width: '100%', fontSize: '0.85rem' }}
            >
              {monthNames.map((name, idx) => (
                <option key={idx} value={idx}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Evidence Audit Results Card */}
      <div className="glass-panel" style={{
        padding: '24px',
        marginBottom: '24px',
        border: audit.overallVerdict === 'SUPPORTED'
          ? '1px solid rgba(16, 185, 129, 0.4)'
          : audit.overallVerdict === 'QUALIFIED'
            ? '1px solid rgba(245, 158, 11, 0.4)'
            : '1px solid rgba(239, 68, 68, 0.4)'
      }}>
        {/* Top Verdict Banner */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '18px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '12px',
              background: audit.overallVerdict === 'SUPPORTED'
                ? 'rgba(16, 185, 129, 0.15)'
                : audit.overallVerdict === 'QUALIFIED'
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: audit.overallVerdict === 'SUPPORTED' ? 'var(--shadow-glow-cyan)' : 'var(--shadow-glow-fire)'
            }}>
              {audit.overallVerdict === 'SUPPORTED' ? (
                <ShieldCheck size={32} color="#10b981" />
              ) : audit.overallVerdict === 'QUALIFIED' ? (
                <AlertTriangle size={30} color="#f59e0b" />
              ) : (
                <XCircle size={30} color="#ef4444" />
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                  SCIENTIFIC AUDIT VERDICT:
                </span>
                <span className={`badge ${
                  audit.overallVerdict === 'SUPPORTED' ? 'badge-emerald' :
                  audit.overallVerdict === 'QUALIFIED' ? 'badge-amber' : 'badge-crimson'
                }`}>
                  {audit.overallVerdict.replace('_', ' ')}
                </span>
              </div>
              <h3 style={{ fontSize: '1.25rem', marginTop: '2px' }}>
                Comparison between {yearA} and {yearB} {monthFilter ? `(Month ${monthFilter})` : ''}
              </h3>
            </div>
          </div>

          {/* Scores */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.3)', padding: '8px 16px', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'block' }}>Conclusion Stability</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: audit.stabilityScore > 75 ? '#34d399' : '#fbbf24', fontFamily: 'var(--font-mono)' }}>
                {audit.stabilityScore}%
              </span>
            </div>
            <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.3)', padding: '8px 16px', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'block' }}>Observation Coverage</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: audit.coverageScore > 70 ? '#38bdf8' : '#f87171', fontFamily: 'var(--font-mono)' }}>
                {audit.coverageScore}%
              </span>
            </div>
          </div>
        </div>

        {/* Verdict Summary Narrative */}
        <p style={{ fontSize: '0.92rem', color: 'var(--text-main)', lineHeight: 1.6, marginBottom: '20px' }}>
          {audit.verdictSummary}
        </p>

        {/* Crucial Side-by-Side: Naive Raw Count vs FireTruth Harmonized Index */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {/* Naive Raw Count Interpretation */}
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <XCircle size={15} color="#ef4444" />
              <strong style={{ fontSize: '0.85rem', color: '#f87171' }}>Naive Uncorrected Interpretation</strong>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fca5a5', fontFamily: 'var(--font-mono)' }}>
              {audit.rawDifferencePercent > 0 ? '+' : ''}{audit.rawDifferencePercent}%
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Treats raw satellite detections as directly comparable. Ignores the transition from MODIS 1000m to VIIRS 375m pixels in 2012, producing a false artifact surge.
            </p>
          </div>

          {/* FireTruth Harmonized Interpretation */}
          <div style={{
            background: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: '8px',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <CheckCircle2 size={15} color="#06b6d4" />
              <strong style={{ fontSize: '0.85rem', color: '#38bdf8' }}>FireTruth Harmonized Index (HSFAI)</strong>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
              {audit.harmonizedDifferencePercent > 0 ? '+' : ''}{audit.harmonizedDifferencePercent}%
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Standardized on a common equal-area 25km spatial grid with regularized empirical calibration. Reflects detected-activity changes supported by verifiable evidence.
            </p>
          </div>
        </div>

        {/* Gate Header with Expand / Collapse Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h4 style={{ fontSize: '0.92rem', color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={16} color="var(--accent-cyan)" />
            The 6 Scientific Validation Gates (Click to Inspect Evidence & Justification):
          </h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={expandAll} className="btn-secondary" style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
              Expand All
            </button>
            <button onClick={collapseAll} className="btn-secondary" style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
              Collapse All
            </button>
          </div>
        </div>

        {/* The 6 Expandable Scientific Evidence Gates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {audit.gates.map((gate, idx) => {
            const isPass = gate.status === 'PASS';
            const isWarn = gate.status === 'WARNING';
            const isNotEval = gate.status === 'NOT_EVALUATED';
            const isLimited = gate.status === 'LIMITED_COVERAGE';
            const isInsufficient = gate.status === 'INSUFFICIENT_EVIDENCE';
            const isExpanded = Boolean(expandedGates[gate.id]);

            return (
              <div
                key={gate.id}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: isPass 
                    ? '1px solid rgba(16, 185, 129, 0.25)' 
                    : isWarn 
                      ? '1px solid rgba(245, 158, 11, 0.25)' 
                      : isNotEval || isLimited
                        ? '1px solid rgba(148, 163, 184, 0.25)'
                        : '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  transition: 'border 0.15s ease'
                }}
              >
                {/* Gate Header Row (Clickable) */}
                <div
                  onClick={() => toggleGate(gate.id)}
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                    <div style={{ marginTop: '2px' }}>
                      {isPass ? (
                        <CheckCircle2 size={18} color="#10b981" />
                      ) : isWarn ? (
                        <AlertTriangle size={18} color="#f59e0b" />
                      ) : isNotEval || isLimited ? (
                        <HelpCircle size={18} color="#94a3b8" />
                      ) : (
                        <XCircle size={18} color="#ef4444" />
                      )}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                          GATE {idx + 1}: {gate.name.replace(/^Gate \d+:\s*/, '').toUpperCase()}
                        </span>
                        <span className={`badge ${
                          isPass ? 'badge-emerald' : 
                          isWarn ? 'badge-amber' : 
                          isNotEval ? 'badge-cyan' : isLimited ? 'badge-amber' : isInsufficient ? 'badge-crimson' : 'badge-crimson'
                        }`} style={{ fontSize: '0.62rem' }}>
                          {gate.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-bright)', marginTop: '2px' }}>
                        {gate.title}
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {gate.finding}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      background: 'rgba(0,0,0,0.25)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem'
                    }}>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>{gate.metricLabel}</div>
                      <div style={{ fontWeight: 700, color: isPass ? '#34d399' : isWarn ? '#fbbf24' : '#f87171' }}>
                        {gate.measuredValue}
                      </div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.66rem' }}>Target: {gate.thresholdLabel}</div>
                    </div>
                    <div style={{ color: 'var(--text-dim)' }}>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                {/* Expandable Drill-Down Details */}
                {isExpanded && (
                  <div style={{
                    padding: '14px 18px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    fontSize: '0.78rem',
                    lineHeight: 1.55,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    {gate.inputData && (
                      <div>
                        <strong style={{ color: 'var(--accent-cyan)' }}>Input Observations & Settings:</strong>
                        <div style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', marginTop: '2px' }}>
                          {gate.inputData}
                        </div>
                      </div>
                    )}

                    {gate.calculation && (
                      <div>
                        <strong style={{ color: '#fbbf24' }}>Mathematical Formulation & Evaluation:</strong>
                        <div style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', marginTop: '2px' }}>
                          {gate.calculation}
                        </div>
                      </div>
                    )}

                    {gate.thresholdJustification && (
                      <div>
                        <strong style={{ color: '#38bdf8' }}>Scientific Threshold Justification & NASA Literature:</strong>
                        <p style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                          {gate.thresholdJustification}
                        </p>
                      </div>
                    )}

                    <div>
                      <strong style={{ color: 'var(--text-bright)' }}>Physical Remote Sensing Mechanism:</strong>
                      <p style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                        {gate.physicalMechanism || gate.scientificImplication}
                      </p>
                    </div>

                    {gate.recommendedAction && (
                      <div>
                        <strong style={{ color: 'var(--accent-fire)' }}>Recommended Investigation Action:</strong>
                        <p style={{ color: 'var(--text-bright)', marginTop: '2px' }}>
                          {gate.recommendedAction}
                        </p>
                      </div>
                    )}

                    {gate.limitations && (
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: 'rgba(245, 158, 11, 0.06)',
                        borderLeft: '3px solid #f59e0b'
                      }}>
                        <strong style={{ color: '#fbbf24' }}>Documented Limitations & Caveats:</strong>
                        <p style={{ color: 'var(--text-dim)', marginTop: '2px', fontSize: '0.74rem' }}>
                          {gate.limitations}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actionable Recommendations for Land Managers & Scientists */}
        <div style={{
          marginTop: '24px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '8px',
          padding: '16px',
          borderLeft: '4px solid var(--accent-cyan)'
        }}>
          <h4 style={{ fontSize: '0.88rem', color: 'var(--accent-cyan)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileSpreadsheet size={16} />
            Actionable Next Steps for Land Managers & Scientists:
          </h4>
          <ul style={{ paddingLeft: '18px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {audit.actionableRecommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
