import React, { useState } from 'react';
import { type CalibrationParams, DEFAULT_CALIBRATION_PARAMS, evaluateCalibrationModels } from '../science/harmonizationEngine';
import type { MonthlyFireRecord, RegionDefinition } from '../types/fire';
import { Sliders, TrendingUp, BarChart3, Database } from 'lucide-react';

interface HarmonizationLabProps {
  records: MonthlyFireRecord[];
  selectedRegion: RegionDefinition;
}

export const HarmonizationLab: React.FC<HarmonizationLabProps> = ({
  records,
  selectedRegion
}) => {
  const [params, setParams] = useState<CalibrationParams>(DEFAULT_CALIBRATION_PARAMS);
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  // Compute calibration models and held-out validation results
  const { b0, b1, b2, scatterPoints } = evaluateCalibrationModels(records, selectedRegion, params);

  // Determine winning model on held-out data
  const bestModel = b2.metrics.heldoutRMSE <= b1.metrics.heldoutRMSE ? b2 : b1;

  // Scatter plot dimensions
  const plotWidth = 520;
  const plotHeight = 340;
  const padding = 45;

  const maxVal = Math.max(
    ...scatterPoints.map(p => Math.max(p.modis, p.viirs)),
    100
  );

  const scaleX = (val: number) => padding + ((val / maxVal) * (plotWidth - padding * 2));
  const scaleY = (val: number) => plotHeight - padding - ((val / maxVal) * (plotHeight - padding * 2));

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Module Title Banner */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem' }}>Sensor Harmonization Lab</h2>
          <span className="badge badge-amber">Empirical Calibration & Held-Out Testing</span>
        </div>
        <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Resolving sensor discrepancy during the 2012–2025 overlap period. Testing whether regularized calibration
          generalizes out-of-sample and comparing models against the raw B0 baseline.
        </p>
      </div>

      {/* Main Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) 1.5fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Interactive Calibration Controls & Formulations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Scientific Parameter Workbench */}
          <div className="glass-panel" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Database size={16} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '0.98rem' }}>Calibration Split & Settings</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.82rem' }}>
              {/* Training Years Range */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Training Period (In-Sample):</span>
                  <strong style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                    {params.trainStartYear} – {params.trainEndYear}
                  </strong>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="range"
                    min={2012}
                    max={2020}
                    value={params.trainEndYear}
                    onChange={e => {
                      const end = Number(e.target.value);
                      setParams(prev => ({
                        ...prev,
                        trainEndYear: end,
                        testStartYear: end + 1
                      }));
                    }}
                    style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  Used exclusively to fit calibration parameters α and β.
                </span>
              </div>

              {/* Held-Out Evaluation Years */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Held-Out Test Period (Out-of-Sample):</span>
                  <strong style={{ color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
                    {params.testStartYear} – {params.testEndYear}
                  </strong>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  Strictly held-out to evaluate out-of-sample generalization error and detect overfitting.
                </span>
              </div>

              {/* Grid Size Selection */}
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Common Equal-Area Spatial Grid (I_{'{s,g,d}'}):
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[0.1, 0.25, 0.5].map(sz => (
                    <button
                      key={sz}
                      onClick={() => setParams(prev => ({ ...prev, gridSizeDeg: sz }))}
                      style={{
                        flex: 1,
                        padding: '6px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: params.gridSizeDeg === sz ? 'rgba(6, 182, 212, 0.2)' : 'var(--bg-surface-elevated)',
                        color: params.gridSizeDeg === sz ? '#38bdf8' : 'var(--text-dim)',
                        border: params.gridSizeDeg === sz ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)'
                      }}
                    >
                      {sz}° (~{Math.round(sz * 110)}km)
                    </button>
                  ))}
                </div>
              </div>

              {/* Confidence Filter */}
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  FIRMS Confidence Policy:
                </span>
                <select
                  value={params.confidenceFilter}
                  onChange={e => setParams(prev => ({ ...prev, confidenceFilter: e.target.value as any }))}
                  style={{ width: '100%', fontSize: '0.78rem' }}
                >
                  <option value="nominal_high">Standard Science (Nominal + High)</option>
                  <option value="all">All Detections (incl. Low)</option>
                  <option value="high_only">High Confidence Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Mathematical Formulations Card */}
          <div className="glass-panel" style={{ padding: '18px' }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '10px' }}>Harmonization Formulations</h3>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px', fontFamily: 'var(--font-mono)' }}>
                <strong>Common-Grid Cell-Day:</strong><br />
                A_{'{s,m}'} = ∑_{'{g}'} ∑_{'{d ∈ m}'} I_{'{s,g,d}'}
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px', fontFamily: 'var(--font-mono)' }}>
                <strong>B1 Model:</strong> Â_{'{V,m}'} = α × A_{'{M,m}'}<br />
                <strong>B2 Model:</strong> Â_{'{V,m}'} = α_k × A_{'{M,m}'} (with seasonal L2 shrinkage)
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                *Notice: Cell-day aggregation reduces multi-detection clustering within a single satellite pass while preserving regional fire persistence.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Model Scorecard Table & Overlap Scatter Plot */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Models Scorecard Table */}
          <div className="glass-panel" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={16} color="var(--accent-cyan)" />
                <h3 style={{ fontSize: '1rem' }}>Held-Out Validation Benchmark (2019–2024)</h3>
              </div>
              <span className="badge badge-emerald">
                Recommended: {bestModel.id} ({bestModel.name.split('—')[1]})
              </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 6px' }}>MODEL</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px' }}>EQUATION</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px' }}>TRAIN R²</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px' }}>TEST MAE</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', color: '#fbbf24' }}>TEST RMSE</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', color: '#38bdf8' }}>TEST MAPE</th>
                </tr>
              </thead>
              <tbody>
                {[b0, b1, b2].map(m => {
                  const isBest = m.id === bestModel.id;
                  const isB0 = m.id === 'B0';

                  return (
                    <tr
                      key={m.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        background: isBest ? 'rgba(16, 185, 129, 0.06)' : isB0 ? 'rgba(239, 68, 68, 0.04)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '10px 6px', fontWeight: 700, color: isBest ? '#34d399' : isB0 ? '#f87171' : 'var(--text-bright)' }}>
                        {m.id}
                        {isBest && <span style={{ marginLeft: '4px', fontSize: '0.65rem', color: '#34d399' }}>★ WINNER</span>}
                        {isB0 && <span style={{ marginLeft: '4px', fontSize: '0.65rem', color: '#f87171' }}>⚠️ NAIVE</span>}
                      </td>
                      <td style={{ padding: '10px 6px', fontFamily: 'var(--font-mono)', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                        {m.equation}
                      </td>
                      <td style={{ textAlign: 'right', padding: '10px 6px', fontFamily: 'var(--font-mono)' }}>
                        {m.metrics.trainR2}
                      </td>
                      <td style={{ textAlign: 'right', padding: '10px 6px', fontFamily: 'var(--font-mono)' }}>
                        {m.metrics.heldoutMAE}
                      </td>
                      <td style={{ textAlign: 'right', padding: '10px 6px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: isB0 ? '#f87171' : '#fbbf24' }}>
                        {m.metrics.heldoutRMSE}
                      </td>
                      <td style={{ textAlign: 'right', padding: '10px 6px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: isB0 ? '#f87171' : '#38bdf8' }}>
                        {m.metrics.heldoutMAPE}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: '12px', fontSize: '0.74rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
              *Scientific takeaway: Raw count model <strong>B0</strong> suffers catastrophic out-of-sample error ({b0.metrics.heldoutMAPE}% MAPE) because it ignores the 375m pixel sensitivity shift.
              Calibrated model <strong>{bestModel.id}</strong> drops held-out error to {bestModel.metrics.heldoutMAPE}%, making multi-decadal comparisons scientifically defensible.
            </div>
          </div>

          {/* Interactive Scatter Plot */}
          <div className="glass-panel" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={16} color="var(--accent-cyan)" />
                <h4 style={{ fontSize: '0.95rem' }}>MODIS vs VIIRS Overlap Concordance (2012–2025)</h4>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.72rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Train ({params.trainStartYear}–{params.trainEndYear})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Held-Out Test ({params.testStartYear}–{params.testEndYear})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '16px', height: '2px', background: 'var(--accent-fire)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Fitted (α={b1.alpha}x)</span>
                </div>
              </div>
            </div>

            {/* SVG Canvas Scatter */}
            <div style={{ position: 'relative', width: '100%', height: `${plotHeight}px`, background: 'rgba(0,0,0,0.25)', borderRadius: '8px' }}>
              <svg width="100%" height={plotHeight} viewBox={`0 0 ${plotWidth} ${plotHeight}`} style={{ overflow: 'visible' }}>
                {/* Axes */}
                <line x1={padding} y1={plotHeight - padding} x2={plotWidth - padding} y2={plotHeight - padding} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                <line x1={padding} y1={padding} x2={padding} y2={plotHeight - padding} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />

                {/* Grid ticks */}
                {[0.25, 0.5, 0.75, 1.0].map(frac => {
                  const val = Math.round(maxVal * frac);
                  const x = scaleX(val);
                  const y = scaleY(val);
                  return (
                    <g key={frac}>
                      {/* Vertical grid line */}
                      <line x1={x} y1={padding} x2={x} y2={plotHeight - padding} stroke="rgba(255,255,255,0.04)" strokeDasharray="2,2" />
                      <text x={x} y={plotHeight - padding + 16} fill="var(--text-dim)" fontSize="9" textAnchor="middle" fontFamily="var(--font-mono)">
                        {val}
                      </text>
                      {/* Horizontal grid line */}
                      <line x1={padding} y1={y} x2={plotWidth - padding} y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="2,2" />
                      <text x={padding - 8} y={y + 3} fill="var(--text-dim)" fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* 1:1 Parity line (B0 uncalibrated reference) */}
                <line
                  x1={padding}
                  y1={plotHeight - padding}
                  x2={scaleX(maxVal)}
                  y2={scaleY(maxVal)}
                  stroke="rgba(239, 68, 68, 0.5)"
                  strokeDasharray="4,4"
                  strokeWidth={1.5}
                />

                {/* Fitted calibration line (B1: y = alpha * x) */}
                <line
                  x1={padding}
                  y1={plotHeight - padding}
                  x2={scaleX(maxVal / b1.alpha)}
                  y2={scaleY(maxVal)}
                  stroke="var(--accent-fire)"
                  strokeWidth={2}
                />

                {/* Scatter Points */}
                {scatterPoints.map((pt, idx) => {
                  const cx = scaleX(pt.modis);
                  const cy = scaleY(pt.viirs);
                  const isHovered = hoveredPoint?.idx === idx;

                  return (
                    <circle
                      key={idx}
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 6 : pt.isTest ? 4.5 : 3.5}
                      fill={pt.isTest ? '#fbbf24' : '#38bdf8'}
                      stroke="#ffffff"
                      strokeWidth={isHovered ? 2 : 0.7}
                      opacity={isHovered ? 1 : 0.85}
                      style={{ cursor: 'pointer', transition: 'r 0.1s ease' }}
                      onMouseEnter={() => setHoveredPoint({ ...pt, idx })}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  );
                })}
              </svg>

              {/* Axis Titles */}
              <div style={{ position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                MODIS Cell-Days (A_M,m)
              </div>
              <div style={{ position: 'absolute', top: '50%', left: '4px', transform: 'translateY(-50%) rotate(-90deg)', transformOrigin: 'left top', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                VIIRS Cell-Days (A_V,m)
              </div>

              {/* Hovered Point Card */}
              {hoveredPoint && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'rgba(14, 21, 38, 0.95)',
                  border: '1px solid var(--accent-cyan)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  boxShadow: 'var(--shadow-md)'
                }}>
                  <div style={{ fontWeight: 700, color: hoveredPoint.isTest ? '#fbbf24' : '#38bdf8' }}>
                    {hoveredPoint.year} - Month {hoveredPoint.month} ({hoveredPoint.isTest ? 'Held-Out Test' : 'Train'})
                  </div>
                  <div>MODIS: {hoveredPoint.modis} cell-days</div>
                  <div>VIIRS: {hoveredPoint.viirs} cell-days</div>
                  <div>Ratio: {(hoveredPoint.viirs / hoveredPoint.modis).toFixed(2)}x</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
