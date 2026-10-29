import React from 'react';
import { Flame, Satellite, ShieldCheck, Download, FileText, Sparkles, MapPin, Sliders, Calendar, Microscope } from 'lucide-react';
import type { RegionDefinition } from '../types/fire';
import { STUDY_REGIONS } from '../data/regions';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedRegion: RegionDefinition;
  setSelectedRegion: (region: RegionDefinition) => void;
  onOpenReport: () => void;
  onExportCsv: () => void;
  onSelectScenario: (scenarioId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  selectedRegion,
  setSelectedRegion,
  onOpenReport,
  onExportCsv,
  onSelectScenario
}) => {
  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(10, 15, 29, 0.85)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      {/* Top NASA Metadata Strip */}
      <div style={{
        padding: '6px 24px',
        background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.1) 0%, rgba(245, 158, 11, 0.08) 50%, rgba(239, 68, 68, 0.08) 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.78rem',
        color: 'var(--text-muted)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="pulse-dot pulse-dot-emerald"></span>
            <strong style={{ color: '#38bdf8', letterSpacing: '0.03em' }}>NASA EOSDIS / FIRMS</strong>
          </span>
          <span style={{ color: 'var(--border-strong)' }}>|</span>
          <span style={{ color: 'var(--text-muted)' }}>
            Constellation: <strong style={{ color: 'var(--text-bright)' }}>Terra & Aqua (MODIS) • Suomi-NPP & NOAA-20 (VIIRS)</strong>
          </span>
          <span style={{ color: 'var(--border-strong)' }}>|</span>
          <span style={{ color: 'var(--text-dim)', fontSize: '0.74rem' }}>
            Collection 6.1 & VNP14IMG Synchronized (2000–2025)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={13} color="#f59e0b" />
            <span style={{ color: '#fbbf24', fontWeight: 600 }}>Benchmark Scenarios:</span>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onSelectScenario(e.target.value);
                  e.target.value = '';
                }
              }}
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#fef3c7',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              <option value="" disabled>Select Evaluation Scenario...</option>
              <option value="false_surge">1. The 2012 False Surge Paradox (California)</option>
              <option value="punjab_transfer">2. Cross-Regime Calibration Breakdown (Punjab)</option>
              <option value="cloud_mask">3. The Invisible Fire Problem (Amazon Wet Season)</option>
              <option value="record_siege">4. 2020 Historic Megafire Siege vs 2010 Baseline</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Header Row */}
      <div style={{
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Logo and Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 50%, #f59e0b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)'
          }}>
            <Flame size={24} color="#ffffff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
                IGNIS Atlas
              </h1>
              <span style={{
                background: 'linear-gradient(90deg, #06b6d4, #f59e0b)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 700,
                fontSize: '1.15rem'
              }}>
                FireTruth
              </span>
              <span className="badge badge-cyan" style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                Evidence-Gated
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              One Fire History. Multiple Satellites. Evidence You Can Trust.
            </p>
          </div>
        </div>

        {/* Region Selector & Primary Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Region Picker */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-surface-elevated)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}>
            <MapPin size={16} color="var(--accent-cyan)" />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontWeight: 500 }}>Area of Interest:</span>
            <select
              value={selectedRegion.id}
              onChange={(e) => {
                const found = STUDY_REGIONS.find(r => r.id === e.target.value);
                if (found) setSelectedRegion(found);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-bright)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                outline: 'none',
                padding: '0 4px'
              }}
            >
              {STUDY_REGIONS.map(reg => (
                <option key={reg.id} value={reg.id} style={{ background: '#0e1526', color: '#f1f5f9' }}>
                  {reg.name} ({reg.fireRegime.split(' ')[0]})
                </option>
              ))}
            </select>
            <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>
              α={selectedRegion.baselineAlphaRatio}x
            </span>
          </div>

          {/* Export CSV button */}
          <button
            onClick={onExportCsv}
            className="btn-secondary"
            title="Download full standardized CSV dataset with metadata and calibration parameters"
            style={{ fontSize: '0.82rem', padding: '7px 12px' }}
          >
            <Download size={15} />
            Export CSV
          </button>

          {/* Dossier Report button */}
          <button
            onClick={onOpenReport}
            className="btn-primary"
            style={{ fontSize: '0.82rem', padding: '7px 14px' }}
          >
            <FileText size={15} />
            Scientific Dossier
          </button>
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: '4px',
        borderTop: '1px solid var(--border-subtle)',
        overflowX: 'auto'
      }}>
        <TabButton
          active={activeTab === 'explorer'}
          onClick={() => setActiveTab('explorer')}
          icon={<Satellite size={16} />}
          label="1. Global Fire Explorer"
          badge="NASA Hotspots"
        />
        <TabButton
          active={activeTab === 'calendar'}
          onClick={() => setActiveTab('calendar')}
          icon={<Calendar size={16} />}
          label="2. Burning Calendar"
          badge="2000–2025 Matrix"
        />
        <TabButton
          active={activeTab === 'lab'}
          onClick={() => setActiveTab('lab')}
          icon={<Sliders size={16} />}
          label="3. Sensor Harmonization Lab"
          badge="B0 vs B1 vs B2"
        />
        <TabButton
          active={activeTab === 'resolver'}
          onClick={() => setActiveTab('resolver')}
          icon={<ShieldCheck size={16} />}
          label="4. Evidence Resolver"
          badge="Signature Innovation"
          highlight
        />
        <TabButton
          active={activeTab === 'science'}
          onClick={() => setActiveTab('science')}
          icon={<Microscope size={16} />}
          label="5. Explain the Science"
          badge="Sensor Physics"
        />
      </div>
    </header>
  );
};

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  highlight?: boolean;
}> = ({ active, onClick, icon, label, badge, highlight }) => {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        fontSize: '0.86rem',
        fontWeight: active ? 600 : 500,
        color: active ? 'var(--text-bright)' : 'var(--text-muted)',
        borderBottom: active 
          ? (highlight ? '2px solid var(--accent-fire)' : '2px solid var(--accent-cyan)') 
          : '2px solid transparent',
        background: active 
          ? (highlight ? 'rgba(255, 87, 34, 0.08)' : 'rgba(6, 182, 212, 0.06)') 
          : 'transparent',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap'
      }}
    >
      <span style={{ color: active ? (highlight ? 'var(--accent-fire)' : 'var(--accent-cyan)') : 'inherit' }}>
        {icon}
      </span>
      <span>{label}</span>
      {badge && (
        <span style={{
          fontSize: '0.68rem',
          padding: '1px 6px',
          borderRadius: '4px',
          background: active 
            ? (highlight ? 'rgba(255, 87, 34, 0.2)' : 'rgba(6, 182, 212, 0.2)') 
            : 'rgba(255, 255, 255, 0.06)',
          color: active 
            ? (highlight ? '#ff8a65' : '#38bdf8') 
            : 'var(--text-dim)',
          fontWeight: 600
        }}>
          {badge}
        </span>
      )}
    </button>
  );
};
