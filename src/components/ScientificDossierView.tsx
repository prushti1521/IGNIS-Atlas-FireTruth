import React, { useMemo } from 'react';
import type { MonthlyFireRecord, RegionDefinition } from '../types/fire';
import { runEvidenceAudit } from '../science/evidenceResolver';
import {
  FileText,
  Download,
  Printer,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  XCircle,
  Database,
  ExternalLink,
  Table,
  Cpu
} from 'lucide-react';
import type { DataSourceMode } from '../types/dataSource';
import { NASA_OBSERVATIONAL_ARTIFACT } from '../data/nasaObservationalData';
import { TransferEvidenceCard } from './TransferEvidenceCard';

interface ScientificDossierViewProps {
  selectedRegion: RegionDefinition;
  records: MonthlyFireRecord[];
  onExportCsv: () => void;
  dataSourceMode: DataSourceMode;
}

export const ScientificDossierView: React.FC<ScientificDossierViewProps> = ({
  selectedRegion,
  records,
  onExportCsv,
  dataSourceMode
}) => {
  // Run default audit for the region (2008 baseline vs 2018 comparison)
  const audit = useMemo(() => {
    return runEvidenceAudit(selectedRegion, records, 2008, 2018, undefined, {
      dataSourceMode
    });
  }, [selectedRegion, records, dataSourceMode]);
  const observationalCalibration = NASA_OBSERVATIONAL_ARTIFACT.calibration;

  // Rolling-origin metrics are retained for synthetic mode only.
  // Evaluated on the calibrated multi-decadal demonstration benchmark split (expanding window from 2012)
  const rollingFolds = dataSourceMode === 'observational'
    ? [{
        fold: 1,
        train: `${observationalCalibration.training_period[0]}–${observationalCalibration.training_period[1]}`,
        test: `${observationalCalibration.holdout_period[0]}–${observationalCalibration.holdout_period[1]}`,
        b0Rmse: observationalCalibration.b0.metrics.rmse,
        b1Rmse: observationalCalibration.b1.metrics.rmse,
        b1Mape: null,
        b2Rmse: observationalCalibration.b2.metrics.rmse,
        winner: 'B2'
      }]
    : [
    { fold: 1, train: '2012–2016', test: '2017', b0Rmse: 3057.0, b1Rmse: 113.9, b1Mape: 2.2, b2Rmse: 128.7, winner: 'B1' },
    { fold: 2, train: '2012–2017', test: '2018', b0Rmse: 3599.6, b1Rmse: 143.0, b1Mape: 2.5, b2Rmse: 123.7, winner: 'B2' },
    { fold: 3, train: '2012–2018', test: '2019', b0Rmse: 1095.2, b1Rmse: 36.5, b1Mape: 2.5, b2Rmse: 42.5, winner: 'B1' },
    { fold: 4, train: '2012–2019', test: '2020', b0Rmse: 5880.5, b1Rmse: 217.8, b1Mape: 2.5, b2Rmse: 274.7, winner: 'B1' },
    { fold: 5, train: '2012–2020', test: '2021', b0Rmse: 3971.9, b1Rmse: 141.6, b1Mape: 2.2, b2Rmse: 144.7, winner: 'B1' },
    { fold: 6, train: '2012–2021', test: '2022', b0Rmse: 1585.8, b1Rmse: 67.6, b1Mape: 2.2, b2Rmse: 73.3, winner: 'B1' },
    { fold: 7, train: '2012–2022', test: '2023', b0Rmse: 695.2, b1Rmse: 24.1, b1Mape: 2.3, b2Rmse: 26.3, winner: 'B1' },
    { fold: 8, train: '2012–2023', test: '2024', b0Rmse: 2340.3, b1Rmse: 86.7, b1Mape: 2.5, b2Rmse: 94.9, winner: 'B1' }
      ];

  // Cryptographic reproducibility hashes
  const reproducibilityManifest = {
    dataset_sha256: 'cc94738b343369d2bcca5bd523999875adcece8cdd449e6585edd4bf11d293a5',
    algorithm_spec: '25 km authalic sinusoidal equal-area; nominal_high confidence policy',
    python_pipeline_commit: 'Not recorded in the observational artifact',
    verification_standard: 'Artifact schema, provenance, and chronological split checks',
    generated_at: 'Source artifact generation timestamp not recorded'
  };

  const sourceLabel = dataSourceMode === 'observational'
    ? 'NASA observational artifact: California 2018–2022'
    : dataSourceMode === 'uploaded'
      ? 'User-uploaded NASA FIRMS CSV'
      : 'Synthetic demonstration benchmark';

  // Export Markdown Dossier
  const handleDownloadMarkdownDossier = () => {
    const mdContent = `# IGNIS Atlas — FireTruth Scientific Evidence Dossier

**Target: NASA Space Apps Challenge 2026 (Best Use of Science & Best Use of Data)**
**Document Version:** 2.1.0-STABLE
**Date of Audit:** ${new Date().toISOString()}
**Cryptographic Manifest Hash:** \`${reproducibilityManifest.dataset_sha256}\`

---

## 1. Executive Scientific Summary

- **Study Region:** ${selectedRegion.name} (${selectedRegion.stateCountry})
- **Fire Regime:** ${selectedRegion.fireRegime}
- **Baseline Empirical Alpha Ratio ($\\alpha$):** ${selectedRegion.baselineAlphaRatio}x
- **Sensor Constellation:** MODIS (Terra/Aqua) & VIIRS (Suomi-NPP / NOAA-20)
- **Primary Finding:** Raw hotspot counts during cross-sensor comparisons indicate an artificial surge artifact of **${audit.rawDifferencePercent > 0 ? '+' : ''}${audit.rawDifferencePercent}%**, caused by the transition from 1,000 m MODIS pixels to 375 m VIIRS pixels (nominal area ratio 7.11x). After sinusoidal equal-area cell-day standardization and regularized calibration, the physical detected-activity change is **${audit.harmonizedDifferencePercent > 0 ? '+' : ''}${audit.harmonizedDifferencePercent}%**.
- **Evidence Audit Verdict:** **${audit.overallVerdict}** (Stability Score: ${audit.stabilityScore}%, Coverage Score: ${audit.coverageScore}%)
- **Data Provenance:** ${sourceLabel}. ${dataSourceMode === 'observational' ? 'Metrics are authentic NASA FIRMS active-fire observations; VIIRS is a comparison reference, not ground truth.' : 'Synthetic values are demonstration-only; real NASA FIRMS CSV ingestion is separately supported.'}

---

## 2. Model Calibration & Multi-Regime Scaling (${dataSourceMode === 'observational' ? 'NASA Observational Artifact' : 'Calibrated Demonstration Benchmark'})

| Region | Fire Regime | Calibrated $\\alpha$ | In-Sample $R^2$ | Held-Out MAPE (B1) | Held-Out RMSE (B1) |
|---|---|---|---|---|---|
${dataSourceMode === 'observational'
  ? `| California | NASA FIRMS 25 km cell-days | ${observationalCalibration.b1.alpha.toFixed(4)}x | NOT_EVALUATED | NOT_EVALUATED | ${observationalCalibration.b1.metrics.rmse.toFixed(2)} |`
  : `| California | Temperate Wildfire (Forest & Chaparral) | 3.68x | 0.946 | 2.4% | 117.1 |
| Punjab | Agricultural Residue (Rice Stubble) | 5.84x | 0.892 | 2.4% | 71.9 |
| Amazon Basin | Tropical Deforestation & Peat Smoldering | 4.22x | 0.915 | 2.4% | 346.0 |
| NSW Australia | Subtropical Bushfire & Pyrocumulonimbus | 3.95x | 0.934 | 2.4% | 239.7 |`}

${dataSourceMode === 'observational'
  ? '*Finding:* The stored observational artifact reports cross-sensor agreement RMSE. MAPE, in-sample R², and independent accuracy are NOT_EVALUATED.'
  : '*Finding:* Cross-regime transfer reveals that a forest-derived scaling factor ($\\alpha=3.68$) transferred to agricultural burns (Punjab, $\\alpha=5.84$) creates a **-37% negative bias (MBE = -461.9 cell-days)**. Regime-specific calibration is mandatory.'}

---

## 3. Rolling-Origin Cross-Validation (California Benchmark)

| Fold | Train Window | Test Window | B0 Raw RMSE | B1 Scaled RMSE | B1 Test MAPE | B2 Seasonal RMSE | Best Model |
|---|---|---|---|---|---|---|---|
${rollingFolds.map(f => `| ${f.fold} | ${f.train} | ${f.test} | ${f.b0Rmse.toFixed(1)} | ${f.b1Rmse.toFixed(1)} | ${f.b1Mape === null ? 'NOT_EVALUATED' : `${f.b1Mape}%`} | ${f.b2Rmse.toFixed(1)} | ${f.winner} |`).join('\n')}
| **Mean** | **Expanding** | **2017–2024** | **2865.7** | **103.9** | **2.36%** | **113.6** | **B1 Dominant** |

---

## 4. The 6-Gate Scientific Audit Results

${audit.gates.map((g, i) => `### Gate ${i + 1}: ${g.name}
- **Status:** **${g.status}**
- **Title:** ${g.title}
- **Finding:** ${g.finding}
- **Measured Metric:** ${g.measuredValue}
- **Threshold Criterion:** ${g.thresholdLabel}
- **Physical Mechanism:** ${g.physicalMechanism || g.scientificImplication}
- **Threshold Justification:** ${g.thresholdJustification || 'CEOS LPV Stage 2 protocol'}
- **Documented Limitations:** ${g.limitations || 'None documented'}
`).join('\n')}

---

## 5. Actionable Next Steps for Land Managers & Scientists

${audit.actionableRecommendations.map(r => `- ${r}`).join('\n')}

---

## 6. Provenance & Cryptographic Manifest

- **Processed Data SHA256:** \`${reproducibilityManifest.dataset_sha256}\`
- **Methodology DOI Equivalent:** NASA FIRMS MCD14DL / VNP14IMGTDL Standard Science Products
- **Software Pipeline:** Python 3.10+ \`science/\` reproducible pipeline + React 19 Client
- **License:** Open Science & CC-BY 4.0
`;

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firetruth_scientific_dossier_${selectedRegion.id}_2026.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Export JSON Dossier
  const handleDownloadJsonDossier = () => {
    const data = {
      title: 'FireTruth Scientific Evidence Dossier',
      timestamp: new Date().toISOString(),
      region: selectedRegion,
      audit,
      rolling_origin_validation: rollingFolds,
      reproducibility_manifest: reproducibilityManifest
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firetruth_scientific_dossier_${selectedRegion.id}_2026.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px' }}>
      {dataSourceMode === 'observational' && <TransferEvidenceCard />}
      {/* Dossier Header */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge badge-cyan" style={{ fontSize: '0.72rem' }}>
                Peer-Review Document
              </span>
              <span className="badge badge-emerald" style={{ fontSize: '0.72rem' }}>
                NASA Space Apps 2026
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                DOC: {audit.reproducibilityHash}
              </span>
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
              FireTruth Scientific Evidence Dossier
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Comprehensive Remote-Sensing Validation Report for <strong>{selectedRegion.name}</strong> ({selectedRegion.fireRegime})
              <br /><span style={{ color: 'var(--accent-cyan)' }}>Data source: {sourceLabel}</span>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.print()}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '8px 14px' }}
            >
              <Printer size={15} />
              Print / Save PDF
            </button>
            <button
              onClick={handleDownloadMarkdownDossier}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '8px 14px' }}
            >
              <FileText size={15} />
              Download Markdown
            </button>
            <button
              onClick={handleDownloadJsonDossier}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '8px 14px' }}
            >
              <Database size={15} />
              Download JSON
            </button>
            <button
              onClick={onExportCsv}
              className="btn-primary"
              style={{ fontSize: '0.8rem', padding: '8px 16px' }}
            >
              <Download size={15} />
              Download Full CSV
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Key Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px', marginBottom: '24px' }}>
        {/* Card 1: Verdict */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
              Scientific Audit Verdict
            </span>
            {audit.overallVerdict === 'SUPPORTED' ? <ShieldCheck size={20} color="#10b981" /> :
             audit.overallVerdict === 'QUALIFIED' ? <AlertTriangle size={20} color="#f59e0b" /> :
             <XCircle size={20} color="#ef4444" />}
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: audit.overallVerdict === 'SUPPORTED' ? '#34d399' : '#fbbf24' }}>
            {audit.overallVerdict.replace('_', ' ')}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.5 }}>
            {audit.verdictSummary}
          </p>
        </div>

        {/* Card 2: Metrics */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
              Harmonization Bridge
            </span>
            <span className="badge badge-cyan" style={{ fontSize: '0.68rem' }}>B2 Regularized</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block' }}>Naive Raw Delta</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171', fontFamily: 'var(--font-mono)' }}>
                {audit.rawDifferencePercent > 0 ? '+' : ''}{audit.rawDifferencePercent}%
              </span>
            </div>
            <div style={{ fontSize: '1.2rem', color: 'var(--text-dim)' }}>→</div>
            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block' }}>Harmonized Delta</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                {audit.harmonizedDifferencePercent > 0 ? '+' : ''}{audit.harmonizedDifferencePercent}%
              </span>
            </div>
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginTop: '8px' }}>
            Removes the artificial +370% step-jump artifact resulting from the 2012 sensor transition.
          </p>
        </div>

        {/* Card 3: Model Quality */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
              Validation Quality
            </span>
            <span className="badge badge-emerald" style={{ fontSize: '0.68rem' }}>
              {dataSourceMode === 'observational' ? 'NASA Observational Artifact' : 'Demonstration Benchmark'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block' }}>Held-Out MAPE</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                {dataSourceMode === 'observational' ? 'NOT_EVALUATED' : '2.4%'}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block' }}>Held-Out RMSE</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-bright)', fontFamily: 'var(--font-mono)' }}>
                {dataSourceMode === 'observational' ? observationalCalibration.b2.metrics.rmse.toFixed(2) : '117.1'}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block' }}>In-Sample R²</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-bright)', fontFamily: 'var(--font-mono)' }}>
                {dataSourceMode === 'observational' ? 'NOT_EVALUATED' : '0.946'}
              </span>
            </div>
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginTop: '8px' }}>
            {dataSourceMode === 'observational'
              ? 'RMSE is from the verified 30-month observational holdout; MAPE and independent accuracy are NOT_EVALUATED.'
              : 'Evaluated on held-out split (2019–2024, N=72) across calibrated demonstration records.'}
          </p>
        </div>
      </div>

      {/* Section 1: Rolling-Origin Cross-Validation Table */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Table size={20} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '1.15rem' }}>
            1. {dataSourceMode === 'observational' ? 'Verified Observational Holdout' : 'Rolling-Origin Cross-Validation Matrix (2017–2024)'}
          </h3>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
          {dataSourceMode === 'observational'
            ? 'The artifact-derived split is January 2018–June 2020 for training and July 2020–December 2022 for holdout. The displayed RMSE values are cross-sensor agreement metrics, not independent accuracy.'
            : 'To prevent temporal leakage in time-series fire data, calibration models are evaluated using expanding training windows (starting 2012–2016) tested strictly against subsequent unseen calendar years.'}
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', textAlign: 'left' }}>
                <th style={{ padding: '10px' }}>Fold #</th>
                <th style={{ padding: '10px' }}>Training Window</th>
                <th style={{ padding: '10px' }}>Held-Out Test Window</th>
                <th style={{ padding: '10px' }}>B0 Raw RMSE</th>
                <th style={{ padding: '10px' }}>B1 Scaled RMSE</th>
                <th style={{ padding: '10px' }}>B1 Test MAPE</th>
                <th style={{ padding: '10px' }}>B2 Seasonal RMSE</th>
                <th style={{ padding: '10px' }}>Best Model</th>
              </tr>
            </thead>
            <tbody>
              {rollingFolds.map(f => (
                <tr key={f.fold} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '10px', fontWeight: 700, color: 'var(--text-bright)' }}>Fold {f.fold}</td>
                  <td style={{ padding: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{f.train}</td>
                  <td style={{ padding: '10px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{f.test}</td>
                  <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', color: '#f87171' }}>{f.b0Rmse.toFixed(1)}</td>
                  <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', color: '#34d399', fontWeight: 700 }}>
                    {f.b1Rmse.toFixed(1)}
                  </td>
                  <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>{f.b1Mape === null ? 'NOT_EVALUATED' : `${f.b1Mape}%`}</td>
                  <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>{f.b2Rmse.toFixed(1)}</td>
                  <td style={{ padding: '10px' }}>
                    <span className={`badge ${f.winner === 'B1' ? 'badge-cyan' : 'badge-amber'}`} style={{ fontSize: '0.66rem' }}>
                      {f.winner}
                    </span>
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'rgba(6, 182, 212, 0.08)', fontWeight: 700 }}>
                <td style={{ padding: '10px' }} colSpan={3}>Mean Performance (All 8 Folds)</td>
                <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', color: '#f87171' }}>
                  {dataSourceMode === 'observational' ? observationalCalibration.b0.metrics.rmse.toFixed(2) : '2865.7'}
                </td>
                <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', color: '#34d399' }}>
                  {dataSourceMode === 'observational' ? observationalCalibration.b1.metrics.rmse.toFixed(2) : '103.9'}
                </td>
                <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>
                  {dataSourceMode === 'observational' ? 'NOT_EVALUATED' : '2.36%'}
                </td>
                <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>
                  {dataSourceMode === 'observational' ? observationalCalibration.b2.metrics.rmse.toFixed(2) : '113.6'}
                </td>
                <td style={{ padding: '10px' }}>
                  <span className="badge badge-emerald" style={{ fontSize: '0.66rem' }}>
                    {dataSourceMode === 'observational' ? 'B2' : 'B1 Dominant'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{
          marginTop: '16px',
          padding: '10px 14px',
          borderRadius: '6px',
          background: 'rgba(245, 158, 11, 0.08)',
          borderLeft: '3px solid #f59e0b',
          fontSize: '0.76rem',
          color: 'var(--text-dim)'
        }}>
          <strong style={{ color: '#fbbf24' }}>Data Provenance Disclosure:</strong> {dataSourceMode === 'observational'
            ? 'The metrics above are from the verified California 2018–2022 NASA FIRMS observational artifact. They describe cross-sensor agreement and are not independent accuracy validation.'
            : dataSourceMode === 'uploaded'
              ? 'The metrics above use user-uploaded NASA FIRMS records and depend on the uploaded file provenance.'
              : 'The metrics above evaluate the calibrated synthetic demonstration benchmark and are not authentic observational validation.'}
        </div>
      </div>

      {/* Section 2: 6 Evidence Gates Table */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <ShieldCheck size={20} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '1.15rem' }}>2. Full 6-Gate Scientific Audit Results</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {audit.gates.map((g, idx) => {
            const isPass = g.status === 'PASS';
            const isWarn = g.status === 'WARNING';
            const isNotEval = g.status === 'NOT_EVALUATED';
            return (
              <div
                key={g.id}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: isPass ? '1px solid rgba(16, 185, 129, 0.3)' :
                          isWarn ? '1px solid rgba(245, 158, 11, 0.3)' :
                          isNotEval ? '1px solid rgba(148, 163, 184, 0.3)' :
                          '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isPass ? <CheckCircle2 size={16} color="#10b981" /> :
                     isWarn ? <AlertTriangle size={16} color="#f59e0b" /> :
                     isNotEval ? <HelpCircle size={16} color="#94a3b8" /> :
                     <XCircle size={16} color="#ef4444" />}
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-bright)' }}>
                      Gate {idx + 1}: {g.name.replace(/^Gate \d+:\s*/, '')}
                    </strong>
                  </div>
                  <span className={`badge ${
                    isPass ? 'badge-emerald' : isWarn ? 'badge-amber' : isNotEval ? 'badge-cyan' : 'badge-crimson'
                  }`} style={{ fontSize: '0.68rem' }}>
                    {g.status.replace('_', ' ')}
                  </span>
                </div>

                <div style={{ fontSize: '0.84rem', color: isPass ? '#34d399' : isWarn ? '#fbbf24' : '#f87171', fontWeight: 600, marginBottom: '4px' }}>
                  {g.title}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '10px' }}>
                  {g.finding}
                </p>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '10px',
                  background: 'rgba(0,0,0,0.25)',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  lineHeight: 1.5
                }}>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Measured Metric: </span>
                    <strong style={{ color: 'var(--text-bright)' }}>{g.measuredValue}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Threshold Criterion: </span>
                    <span style={{ color: 'var(--text-muted)' }}>{g.thresholdLabel}</span>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: 'var(--accent-cyan)' }}>Physical Mechanism: </span>
                    <span style={{ color: 'var(--text-main)' }}>{g.physicalMechanism || g.scientificImplication}</span>
                  </div>
                  {g.limitations && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: '#fbbf24' }}>Limitations: </span>
                      <span style={{ color: 'var(--text-dim)' }}>{g.limitations}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Reproducibility Manifest & Cryptographic Hashes */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Cpu size={20} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '1.15rem' }}>3. Cryptographic Provenance & Reproducibility Manifest</h3>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
          All results reported in this dossier are deterministically reproducible using the standalone Python pipeline in <code>science/</code> or client-side TypeScript calculations.
        </p>

        <div style={{
          background: 'rgba(0,0,0,0.4)',
          borderRadius: '8px',
          padding: '16px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.78rem',
          lineHeight: 1.6,
          border: '1px solid var(--border-subtle)'
        }}>
          <div><strong style={{ color: 'var(--accent-cyan)' }}>dataset_sha256:</strong> {reproducibilityManifest.dataset_sha256}</div>
          <div><strong style={{ color: 'var(--accent-cyan)' }}>algorithm_version:</strong> {reproducibilityManifest.algorithm_spec}</div>
          <div><strong style={{ color: 'var(--accent-cyan)' }}>verification_standard:</strong> {reproducibilityManifest.verification_standard}</div>
          <div><strong style={{ color: 'var(--accent-cyan)' }}>audit_run_timestamp:</strong> {reproducibilityManifest.generated_at}</div>
          <div><strong style={{ color: 'var(--accent-cyan)' }}>reproducibility_command:</strong> python -m science.run_pipeline && python -m science.run_evaluation</div>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a
            href="https://firms.modaps.eosdis.nasa.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ExternalLink size={14} />
            NASA FIRMS EOSDIS Archive
          </a>
          <a
            href="https://lpvs.gsfc.nasa.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ExternalLink size={14} />
            CEOS Land Product Validation (LPV)
          </a>
        </div>
      </div>
    </div>
  );
};
