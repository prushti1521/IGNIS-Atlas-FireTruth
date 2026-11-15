import React, { useState } from 'react';
import type { CalendarMetricMode, ColorRampType, MonthlyFireRecord, RegionDefinition } from '../types/fire';
import { Calendar, Eye, Sparkles, ShieldCheck } from 'lucide-react';

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

  // Calculate dynamic maximums for normalization with safe null-filtering
  const validHsfai = records.map(r => r.hsfai).filter((v): v is number => v !== null);
  const maxHsfai = validHsfai.length > 0 ? Math.max(...validHsfai, 10) : 10;

  const validModis = records.map(r => r.modisCellDays).filter((v): v is number => v !== null);
  const maxModis = validModis.length > 0 ? Math.max(...validModis, 10) : 10;

  const validViirs = records.map(r => r.viirsCellDays).filter((v): v is number => v !== null);
  const maxViirs = validViirs.length > 0 ? Math.max(...validViirs, 10) : 10;

  const validAnom = records.map(r => r.anomalyAbsolute).filter((v): v is number => v !== null);
  const maxAbsAnomaly = validAnom.length > 0 ? Math.max(...validAnom.map(Math.abs), 10) : 10;

  // Color Mapping functions
  const getCellColor = (record: MonthlyFireRecord): { background: string; textColor: string } => {
    if (!record.isObserved || record.hsfai === null) {
      return { background: 'rgba(255, 255, 255, 0.02)', textColor: 'var(--text-dim)' };
    }

    let normalized = 0;

    if (metricMode === 'hsfai') {
      normalized = Math.min(1, Math.max(0, record.hsfai / maxHsfai));
    } else if (metricMode === 'raw_modis') {
      const mVal = record.modisCellDays ?? 0;
      normalized = Math.min(1, Math.max(0, mVal / maxModis));
    } else if (metricMode === 'raw_viirs') {
      if (record.year < 2012 || record.viirsCellDays === null) {
        return { background: 'rgba(255, 255, 255, 0.02)', textColor: 'var(--text-dim)' };
      }
      normalized = Math.min(1, Math.max(0, record.viirsCellDays / maxViirs));
    } else if (metricMode === 'anomaly_abs' || metricMode === 'anomaly_pct') {
      const val = record.anomalyAbsolute ?? 0;
      const ratio = Math.min(1, Math.abs(val) / maxAbsAnomaly);
      if (val > 0) {
        return {
          background: `rgba(239, 68, 68, ${0.15 + ratio * 0.82})`,
          textColor: ratio > 0.4 ? '#ffffff' : '#fca5a5'
        };
      } else {
        return {
          background: `rgba(59, 130, 246, ${0.12 + ratio * 0.75})`,
          textColor: ratio > 0.4 ? '#ffffff' : '#93c5fd'
        };
      }
    }

    // Apply color ramps
    if (colorRamp === 'magma') {
      if (normalized < 0.05) return { background: '#0b0f19', textColor: 'var(--text-dim)' };
      if (normalized < 0.25) return { background: '#3b1443', textColor: '#e9d5ff' };
      if (normalized < 0.50) return { background: '#8c2950', textColor: '#fce7f3' };
      if (normalized < 0.75) return { background: '#db5627', textColor: '#ffffff' };
      return { background: '#f6b432', textColor: '#000000' };
    } else if (colorRamp === 'cividis') {
      if (normalized < 0.05) return { background: '#00204d', textColor: '#93c5fd' };
      if (normalized < 0.30) return { background: '#264264', textColor: '#bfdbfe' };
      if (normalized < 0.60) return { background: '#596970', textColor: '#f8fafc' };
      if (normalized < 0.85) return { background: '#a5975d', textColor: '#000000' };
      return { background: '#ffea46', textColor: '#000000' };
    } else if (colorRamp === 'viridis') {
      if (normalized < 0.05) return { background: '#440154', textColor: '#e9d5ff' };
      if (normalized < 0.30) return { background: '#3b528b', textColor: '#dbeafe' };
      if (normalized < 0.60) return { background: '#21918c', textColor: '#ffffff' };
      if (normalized < 0.85) return { background: '#5ec962', textColor: '#000000' };
      return { background: '#fde725', textColor: '#000000' };
    } else {
      const ratio = normalized;
      return {
        background: `rgba(245, 158, 11, ${0.1 + ratio * 0.85})`,
        textColor: ratio > 0.4 ? '#ffffff' : '#fef3c7'
      };
    }
  };

  const getDisplayedValue = (record: MonthlyFireRecord): string => {
    if (!record.isObserved || record.hsfai === null) return '—';
    if (metricMode === 'hsfai') return record.hsfai.toLocaleString();
    if (metricMode === 'raw_modis') return (record.modisCellDays ?? 0).toLocaleString();
    if (metricMode === 'raw_viirs') {
      if (record.year < 2012 || record.viirsCellDays === null) return '—';
      return record.viirsCellDays.toLocaleString();
    }
    if (metricMode === 'anomaly_abs') {
      if (record.anomalyAbsolute === null) return '—';
      const prefix = record.anomalyAbsolute > 0 ? '+' : '';
      return `${prefix}${record.anomalyAbsolute}`;
    }
    if (metricMode === 'anomaly_pct') {
      if (record.anomalyPercent === null) return '—';
      const prefix = record.anomalyPercent > 0 ? '+' : '';
      return `${prefix}${record.anomalyPercent}%`;
    }
    return '';
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Module Banner */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={22} color="var(--accent-fire)" />
            <h2 style={{ fontSize: '1.4rem' }}>Burning Activity Matrix (2000–2025)</h2>
            <span className="badge badge-fire">26-Year Multi-Decadal Time Series</span>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Harmonized satellite active-fire history for <strong>{selectedRegion.name}</strong>.
            Click any month to inspect calibration parameters, uncertainty bounds, and trigger an automated Evidence Audit.
          </p>
        </div>
      </div>

      {/* Control Bar: Metric Selector & Accessible Color Ramps */}
      <div className="glass-panel" style={{
        padding: '14px 18px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Metric Mode Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>VIEW METRIC:</span>
          
          <button
            onClick={() => setMetricMode('hsfai')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.76rem',
              fontWeight: 600,
              background: metricMode === 'hsfai' ? 'rgba(6, 182, 212, 0.2)' : 'var(--bg-surface-elevated)',
              color: metricMode === 'hsfai' ? '#38bdf8' : 'var(--text-muted)',
              border: metricMode === 'hsfai' ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)'
            }}
          >
            ★ Harmonized Index (HSFAI)
          </button>

          <button
            onClick={() => setMetricMode('anomaly_pct')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.76rem',
              fontWeight: 600,
              background: metricMode === 'anomaly_pct' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-surface-elevated)',
              color: metricMode === 'anomaly_pct' ? '#f87171' : 'var(--text-muted)',
              border: metricMode === 'anomaly_pct' ? '1px solid var(--accent-fire)' : '1px solid var(--border-subtle)'
            }}
          >
            Detected Activity Anomaly (%)
          </button>

          <button
            onClick={() => setMetricMode('raw_modis')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.76rem',
              fontWeight: 600,
              background: metricMode === 'raw_modis' ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-surface-elevated)',
              color: metricMode === 'raw_modis' ? '#fbbf24' : 'var(--text-dim)',
              border: metricMode === 'raw_modis' ? '1px solid #f59e0b' : '1px solid var(--border-subtle)'
            }}
          >
            Raw MODIS (1km)
          </button>

          <button
            onClick={() => setMetricMode('raw_viirs')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.76rem',
              fontWeight: 600,
              background: metricMode === 'raw_viirs' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-surface-elevated)',
              color: metricMode === 'raw_viirs' ? '#34d399' : 'var(--text-dim)',
              border: metricMode === 'raw_viirs' ? '1px solid #10b981' : '1px solid var(--border-subtle)'
            }}
          >
            Raw VIIRS (375m, 2012+)
          </button>
        </div>

        {/* Color Palette Toggle (Color-Vision Accessibility) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>PALETTE:</span>
          <select
            value={colorRamp}
            onChange={e => setColorRamp(e.target.value as ColorRampType)}
            style={{ fontSize: '0.76rem', padding: '5px 10px' }}
          >
            <option value="magma">Magma (Thermal IR)</option>
            <option value="cividis">Cividis (Color-Blind Safe)</option>
            <option value="viridis">Viridis (NASA Remote Sensing)</option>
            <option value="divergent_anomaly">Divergent Anomaly (Blue-Red)</option>
          </select>
        </div>
      </div>

      {/* Main 26-Year Calendar Grid Table */}
      <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto', marginBottom: '24px' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '3px', fontSize: '0.8rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px', color: 'var(--text-dim)', width: '80px' }}>YEAR</th>
              {monthLabels.map((lbl, idx) => (
                <th key={idx} style={{ textAlign: 'center', padding: '8px 4px', color: 'var(--text-dim)', minWidth: '55px' }}>
                  {lbl}
                </th>
              ))}
              <th style={{ textAlign: 'right', padding: '8px', color: 'var(--text-dim)', minWidth: '90px' }}>ANNUAL</th>
              <th style={{ textAlign: 'left', padding: '8px', color: 'var(--text-dim)', minWidth: '220px' }}>NOTABLE EVENT / HISTORIC CONTEXT</th>
            </tr>
          </thead>
          <tbody>
            {years.map(yr => {
              const yearRecs = records.filter(r => r.year === yr).sort((a, b) => a.month - b.month);
              const observedAnnualValues = yearRecs
                .map(r => r.hsfai)
                .filter((value): value is number => value !== null);
              const totalAnnualHsfai = observedAnnualValues.reduce((sum, value) => sum + value, 0);
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
                    const anomPct = rec.anomalyPercent ?? 0;

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
                          fontWeight: anomPct > 70 ? 700 : 500,
                          fontSize: '0.74rem',
                          fontFamily: 'var(--font-mono)',
                          position: 'relative',
                          border: isSelected 
                            ? '2px solid #ffffff' 
                            : hasNotableEvent 
                              ? '1px dashed rgba(255, 255, 255, 0.6)' 
                              : '1px solid rgba(255, 255, 255, 0.03)',
                          transition: 'transform 0.1s ease',
                        }}
                      >
                        {val}
                        {hasNotableEvent && (
                          <div style={{
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
                    textAlign: 'right',
                    padding: '6px 10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: totalAnnualHsfai > 3000 ? '#fbbf24' : 'var(--text-muted)'
                  }}>
                    {observedAnnualValues.length > 0 ? totalAnnualHsfai.toLocaleString() : '—'}
                  </td>

                  {/* Notable Event Tag */}
                  <td style={{ padding: '6px 10px', fontSize: '0.76rem', color: notableYearEvent ? '#fca5a5' : 'var(--text-dim)' }}>
                    {notableYearEvent ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Sparkles size={12} color="#ff5722" />
                        {notableYearEvent}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Interactive Detail Drawer for Selected Month */}
      {selectedCell && (
        <div className="glass-panel" style={{
          padding: '20px',
          border: '1px solid rgba(6, 182, 212, 0.4)',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Eye size={20} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '1.15rem' }}>
                Observation Detail: {selectedCell.year} – {monthLabels[selectedCell.month - 1]} ({selectedRegion.name})
              </h3>
              {selectedCell.notableEvent && (
                <span className="badge badge-fire">{selectedCell.notableEvent}</span>
              )}
            </div>

            <button
              onClick={() => onAuditMonth(selectedCell.year, selectedCell.month)}
              className="btn-primary"
              style={{ fontSize: '0.8rem', padding: '6px 14px' }}
            >
              <ShieldCheck size={14} />
              Launch Evidence Audit for this Month
            </button>
          </div>

          {/* 4 Diagnostic Metrics Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block' }}>Harmonized Index (HSFAI)</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                {selectedCell.hsfai !== null ? selectedCell.hsfai.toLocaleString() : 'Unobserved'}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {selectedCell.hsfaiLowerCi !== null && selectedCell.hsfaiUpperCi !== null
                  ? `Nominal uncertainty range (heuristic): [${selectedCell.hsfaiLowerCi.toLocaleString()} – ${selectedCell.hsfaiUpperCi.toLocaleString()}]`
                  : 'Prior to instrument commissioning'}
              </span>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block' }}>Historical Monthly Median</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-bright)', fontFamily: 'var(--font-mono)' }}>
                {selectedCell.historicalMedian !== null ? selectedCell.historicalMedian.toLocaleString() : '—'}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Multi-year baseline (2000–2025)
              </span>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block' }}>Detected Activity Anomaly vs Median</span>
              <div style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: (selectedCell.anomalyAbsolute ?? 0) > 0 ? '#ef4444' : '#38bdf8',
                fontFamily: 'var(--font-mono)'
              }}>
                {selectedCell.anomalyAbsolute !== null && selectedCell.anomalyPercent !== null
                  ? `${selectedCell.anomalyAbsolute > 0 ? '+' : ''}${selectedCell.anomalyAbsolute.toLocaleString()} (${selectedCell.anomalyPercent > 0 ? '+' : ''}${selectedCell.anomalyPercent}%)`
                  : '—'}
              </div>
              <span style={{ fontSize: '0.72rem', color: (selectedCell.anomalyAbsolute ?? 0) > 0 ? '#fca5a5' : '#93c5fd' }}>
                {selectedCell.anomalyAbsolute !== null && selectedCell.anomalyAbsolute > 0
                  ? 'Detected activity significantly above median'
                  : 'Subdued fire activity'}
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '0.78rem'
          }}>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>RAW MODIS CELL-DAYS (A_Mm): </span>
              <strong style={{ color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
                {selectedCell.modisCellDays !== null ? selectedCell.modisCellDays.toLocaleString() : 'Unobserved'}
              </strong>
            </div>

            <div>
              <span style={{ color: 'var(--text-dim)' }}>RAW VIIRS CELL-DAYS (A_Vm): </span>
              <strong style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                {selectedCell.viirsCellDays !== null ? selectedCell.viirsCellDays.toLocaleString() : 'Prior to 2012 Launch'}
              </strong>
            </div>

            <div>
              <span style={{ color: 'var(--text-dim)' }}>CONSTELLATION ERA: </span>
              <strong style={{ color: 'var(--text-bright)' }}>{selectedCell.sensorCoverage}</strong>
            </div>

            <div>
              <span style={{ color: 'var(--text-dim)' }}>CALIBRATION MODEL: </span>
              <strong style={{ color: 'var(--accent-cyan)' }}>{selectedCell.modelApplied}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
