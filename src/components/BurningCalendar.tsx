import React, { useState } from 'react';
import type { CalendarMetricMode, ColorRampType, MonthlyFireRecord, RegionDefinition } from '../types/fire';
import { Calendar, Eye, Sparkles, ShieldCheck, Info } from 'lucide-react';

interface BurningCalendarProps {
  records: MonthlyFireRecord[];
  selectedRegion: RegionDefinition;
  onAuditMonth: (year: number, month: number) => void;
}

export const BurningCalendar: React.FC<BurningCalendarProps> = ({
  records,
  selectedRegion,
  onAuditMonth
}) => {
  const [metricMode, setMetricMode] = useState<CalendarMetricMode>('hsfai');
  const [colorRamp, setColorRamp] = useState<ColorRampType>('magma');
  const [selectedCell, setSelectedCell] = useState<MonthlyFireRecord | null>(null);

  // Years from 2000 to 2025
  const years = Array.from(new Set(records.map(r => r.year))).sort((a, b) => b - a); // newest to oldest
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Calculate dynamic maximums for normalization
  const maxHsfai = Math.max(...records.map(r => r.hsfai), 10);
  const maxModis = Math.max(...records.map(r => r.modisCellDays), 10);
  const maxViirs = Math.max(...records.map(r => r.viirsCellDays), 10);
  const maxAbsAnomaly = Math.max(...records.map(r => Math.abs(r.anomalyAbsolute)), 10);

  // Color Mapping functions
  const getCellColor = (record: MonthlyFireRecord): { background: string; textColor: string } => {
    let normalized = 0;

    if (metricMode === 'hsfai') {
      normalized = Math.min(1, Math.max(0, record.hsfai / maxHsfai));
    } else if (metricMode === 'raw_modis') {
      normalized = Math.min(1, Math.max(0, record.modisCellDays / maxModis));
    } else if (metricMode === 'raw_viirs') {
      if (record.year < 2012) {
        return { background: 'rgba(255, 255, 255, 0.02)', textColor: 'var(--text-dim)' };
      }
      normalized = Math.min(1, Math.max(0, record.viirsCellDays / maxViirs));
    } else if (metricMode === 'anomaly_abs' || metricMode === 'anomaly_pct') {
      // Divergent anomaly scale: blue (negative) -> neutral dark -> crimson red (positive)
      const val = record.anomalyAbsolute;
      const ratio = Math.min(1, Math.abs(val) / maxAbsAnomaly);
      if (val > 0) {
        // Positive fire anomaly (more fire than median)
        return {
          background: `rgba(239, 68, 68, ${0.15 + ratio * 0.82})`,
          textColor: ratio > 0.4 ? '#ffffff' : '#fca5a5'
        };
      } else {
        // Negative fire anomaly (less fire than median)
        return {
          background: `rgba(59, 130, 246, ${0.12 + ratio * 0.75})`,
          textColor: ratio > 0.4 ? '#ffffff' : '#93c5fd'
        };
      }
    }

    // Apply color ramps
    if (colorRamp === 'magma') {
      // Thermal infrared: black -> dark purple -> fire orange -> bright yellow
      if (normalized < 0.05) return { background: '#0b0f19', textColor: 'var(--text-dim)' };
      if (normalized < 0.25) return { background: '#3b1443', textColor: '#e9d5ff' };
      if (normalized < 0.50) return { background: '#8c2950', textColor: '#fce7f3' };
      if (normalized < 0.75) return { background: '#db5627', textColor: '#ffffff' };
      return { background: '#f6b432', textColor: '#000000' };
    } else if (colorRamp === 'cividis') {
      // Color-vision deficiency optimized: dark blue -> slate -> gold
      if (normalized < 0.05) return { background: '#00204d', textColor: '#93c5fd' };
      if (normalized < 0.30) return { background: '#264264', textColor: '#bfdbfe' };
      if (normalized < 0.60) return { background: '#596970', textColor: '#f8fafc' };
      if (normalized < 0.85) return { background: '#a5975d', textColor: '#000000' };
      return { background: '#ffea46', textColor: '#000000' };
    } else if (colorRamp === 'viridis') {
      // Classic remote sensing: deep purple -> teal -> yellow-green
      if (normalized < 0.05) return { background: '#440154', textColor: '#e9d5ff' };
      if (normalized < 0.30) return { background: '#3b528b', textColor: '#dbeafe' };
      if (normalized < 0.60) return { background: '#21918c', textColor: '#ffffff' };
      if (normalized < 0.85) return { background: '#5ec962', textColor: '#000000' };
      return { background: '#fde725', textColor: '#000000' };
    } else {
      // Divergent anomaly fallback
      const ratio = normalized;
      return {
        background: `rgba(245, 158, 11, ${0.1 + ratio * 0.85})`,
        textColor: ratio > 0.4 ? '#ffffff' : '#fef3c7'
      };
    }
  };

  const getDisplayedValue = (record: MonthlyFireRecord): string => {
    if (metricMode === 'hsfai') return record.hsfai.toLocaleString();
    if (metricMode === 'raw_modis') return record.modisCellDays.toLocaleString();
    if (metricMode === 'raw_viirs') {
      if (record.year < 2012) return '—';
      return record.viirsCellDays.toLocaleString();
    }
    if (metricMode === 'anomaly_abs') {
      const prefix = record.anomalyAbsolute > 0 ? '+' : '';
      return `${prefix}${record.anomalyAbsolute}`;
    }
    if (metricMode === 'anomaly_pct') {
      const prefix = record.anomalyPercent > 0 ? '+' : '';
      return `${prefix}${record.anomalyPercent}%`;
    }
    return '';
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Module Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={22} color="var(--accent-cyan)" />
            <h2 style={{ fontSize: '1.4rem' }}>Historical Burning Activity Calendar</h2>
            <span className="badge badge-cyan">2000–2025 Multi-Decadal Matrix</span>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Unified time series harmonizing 25+ years of active fire hotspots on an equal-area common grid.
            Select any cell to inspect satellite passes and evaluate evidence.
          </p>
        </div>

        {/* Calendar Control Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Metric Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Metric Mode:</span>
            <select
              value={metricMode}
              onChange={e => setMetricMode(e.target.value as CalendarMetricMode)}
              style={{ fontSize: '0.82rem', fontWeight: 600, padding: '6px 10px' }}
            >
              <option value="hsfai">Harmonized HSFAI (Standardized Cell-Days)</option>
              <option value="raw_modis">Raw MODIS Only (Terra/Aqua 1km)</option>
              <option value="raw_viirs">Raw VIIRS Only (S-NPP 375m, 2012+)</option>
              <option value="anomaly_abs">Historical Median Anomaly (Δ Cell-Days)</option>
              <option value="anomaly_pct">Relative Anomaly (% vs Multi-Year Median)</option>
            </select>
          </div>

          {/* Color Ramp Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Palette:</span>
            <select
              value={colorRamp}
              onChange={e => setColorRamp(e.target.value as ColorRampType)}
              style={{ fontSize: '0.82rem', padding: '6px 10px' }}
            >
              <option value="magma">NASA Magma (Thermal IR)</option>
              <option value="cividis">Cividis (Accessible CVD-Friendly)</option>
              <option value="viridis">Viridis (Remote Sensing)</option>
              <option value="divergent_anomaly">Divergent Fire Anomaly (Blue/Red)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid Card */}
      <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto' }}>
        {/* Table Container */}
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '3px', fontSize: '0.78rem' }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-dim)', fontWeight: 700, width: '70px' }}>
                YEAR
              </th>
              {monthLabels.map((m, idx) => (
                <th key={m} style={{
                  padding: '8px 4px',
                  textAlign: 'center',
                  color: selectedRegion.primaryPeakMonths.includes(idx + 1) ? '#fbbf24' : 'var(--text-dim)',
                  fontWeight: selectedRegion.primaryPeakMonths.includes(idx + 1) ? 700 : 500,
                  fontSize: '0.8rem'
                }}>
                  {m}
                  {selectedRegion.primaryPeakMonths.includes(idx + 1) && (
                    <span style={{ display: 'block', fontSize: '0.62rem', color: '#fbbf24' }}>● Peak</span>
                  )}
                </th>
              ))}
              <th style={{ padding: '8px 8px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                ANNUAL HSFAI
              </th>
              <th style={{ padding: '8px 8px', textAlign: 'left', color: 'var(--text-dim)', fontWeight: 600 }}>
                HISTORICAL CONTEXT
              </th>
            </tr>
          </thead>
          <tbody>
            {years.map(yr => {
              const yearRecs = records.filter(r => r.year === yr).sort((a, b) => a.month - b.month);
              const totalAnnualHsfai = yearRecs.reduce((sum, r) => sum + r.hsfai, 0);
              const notableYearEvent = yearRecs.find(r => r.notableEvent)?.notableEvent;
              const isPreViirs = yr < 2012;

              return (
                <tr key={yr}>
                  {/* Year Label */}
                  <td style={{
                    padding: '6px 10px',
                    fontWeight: 700,
                    color: yr === 2020 || yr === 2018 ? '#fbbf24' : 'var(--text-bright)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    {yr}
                    {isPreViirs && (
                      <span title="Pre-2012 MODIS-only era: Translated to VIIRS-equivalent scale via calibration" style={{
                        fontSize: '0.62rem',
                        padding: '1px 4px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#fbbf24',
                        borderRadius: '3px'
                      }}>
                        MODIS
                      </span>
                    )}
                  </td>

                  {/* 12 Month Cells */}
                  {yearRecs.map(rec => {
                    const { background, textColor } = getCellColor(rec);
                    const val = getDisplayedValue(rec);
                    const isSelected = selectedCell?.year === rec.year && selectedCell?.month === rec.month;
                    const hasNotableEvent = Boolean(rec.notableEvent);

                    return (
                      <td
                        key={rec.month}
                        onClick={() => setSelectedCell(rec)}
                        title={`${yr}-${monthLabels[rec.month - 1]}: ${val} (${rec.notableEvent || 'Nominal'})`}
                        style={{
                          background,
                          color: textColor,
                          textAlign: 'center',
                          padding: '7px 4px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: rec.anomalyPercent > 70 ? 700 : 500,
                          fontSize: '0.74rem',
                          fontFamily: 'var(--font-mono)',
                          position: 'relative',
                          border: isSelected 
                            ? '2px solid #ffffff' 
                            : hasNotableEvent 
                              ? '1px dashed rgba(255, 255, 255, 0.6)' 
                              : '1px solid rgba(255, 255, 255, 0.03)',
                          transition: 'transform 0.12s ease, box-shadow 0.12s ease'
                        }}
                      >
                        {val}
                        {hasNotableEvent && (
                          <span style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            background: '#ff5722'
                          }} />
                        )}
                      </td>
                    );
                  })}

                  {/* Annual Sum */}
                  <td style={{
                    textAlign: 'center',
                    padding: '6px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: totalAnnualHsfai > 3000 ? '#fbbf24' : 'var(--text-bright)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '4px'
                  }}>
                    {totalAnnualHsfai.toLocaleString()}
                  </td>

                  {/* Historical Event Tag */}
                  <td style={{
                    padding: '6px 10px',
                    fontSize: '0.72rem',
                    color: notableYearEvent ? '#fde047' : 'var(--text-dim)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '240px'
                  }}>
                    {notableYearEvent ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Sparkles size={12} color="#fbbf24" />
                        {notableYearEvent}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Selected Cell Deep Dive Drawer */}
      {selectedCell && (
        <div className="glass-panel" style={{
          marginTop: '20px',
          padding: '20px',
          border: '1px solid var(--accent-cyan)',
          boxShadow: 'var(--shadow-glow-cyan)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(6, 182, 212, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Eye size={20} color="var(--accent-cyan)" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem' }}>
                  {monthLabels[selectedCell.month - 1]} {selectedCell.year} Detailed Observation Dossier
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Region: {selectedRegion.name} | Era: {selectedCell.year >= 2012 ? 'Concurrent Overlap (MODIS + VIIRS)' : 'MODIS-Only Era (Harmonized Translation)'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => onAuditMonth(selectedCell.year, selectedCell.month)}
                className="btn-accent"
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
              >
                <ShieldCheck size={15} />
                Audit Month in Evidence Resolver
              </button>
              <button
                onClick={() => setSelectedCell(null)}
                className="btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
              >
                Close
              </button>
            </div>
          </div>

          {/* Metrics Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block' }}>Harmonized Index (HSFAI)</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                {selectedCell.hsfai.toLocaleString()}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                95% CI: [{selectedCell.hsfaiLowerCi.toLocaleString()} – {selectedCell.hsfaiUpperCi.toLocaleString()}]
              </span>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block' }}>Historical Monthly Median</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-bright)', fontFamily: 'var(--font-mono)' }}>
                {selectedCell.historicalMedian.toLocaleString()}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Multi-year baseline (2000–2025)
              </span>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block' }}>Anomaly vs Median</span>
              <div style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: selectedCell.anomalyAbsolute > 0 ? '#ef4444' : '#38bdf8',
                fontFamily: 'var(--font-mono)'
              }}>
                {selectedCell.anomalyAbsolute > 0 ? '+' : ''}{selectedCell.anomalyAbsolute.toLocaleString()} ({selectedCell.anomalyPercent > 0 ? '+' : ''}{selectedCell.anomalyPercent}%)
              </div>
              <span style={{ fontSize: '0.72rem', color: selectedCell.anomalyAbsolute > 0 ? '#fca5a5' : '#93c5fd' }}>
                {selectedCell.anomalyAbsolute > 0 ? 'Burning significantly above median' : 'Subdued fire activity'}
              </span>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block' }}>Satellite Observation Quality</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{selectedCell.observationPassCount} Passes</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: selectedCell.cloudCoverPercent > 40 ? '#f59e0b' : 'var(--accent-emerald)' }}>
                Cloud Cover: {selectedCell.cloudCoverPercent}% {selectedCell.cloudCoverPercent > 40 ? '(Partial Obscuration)' : '(Clear Skies)'}
              </span>
            </div>
          </div>

          {/* Raw Sensor Breakdown Comparison */}
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            lineHeight: 1.6
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Info size={15} color="var(--accent-cyan)" />
              <strong style={{ color: 'var(--text-bright)' }}>Instrument Contribution & Provenance:</strong>
            </div>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', color: 'var(--text-muted)' }}>
              <span>MODIS Cell-Days (A_M,m): <strong style={{ color: '#fbbf24' }}>{selectedCell.modisCellDays}</strong> ({selectedCell.modisRawHotspots} raw detections)</span>
              <span>VIIRS Cell-Days (A_V,m): <strong style={{ color: '#38bdf8' }}>{selectedCell.year >= 2012 ? selectedCell.viirsCellDays : 'N/A (Pre-launch)'}</strong> ({selectedCell.viirsRawHotspots} raw detections)</span>
              <span>Harmonization Method: <strong style={{ color: '#34d399' }}>{selectedCell.year >= 2012 ? 'Direct Synchronized Reference' : `Model B2 Translated (α=${selectedRegion.baselineAlphaRatio})`}</strong></span>
            </div>
            {selectedCell.notableEvent && (
              <div style={{ marginTop: '8px', color: '#fde047', fontWeight: 600 }}>
                Historical Benchmark: {selectedCell.notableEvent}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
