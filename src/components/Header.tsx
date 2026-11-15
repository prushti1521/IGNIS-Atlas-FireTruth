import React, { useState, useRef } from 'react';
import {
  Flame,
  Satellite,
  ShieldCheck,
  Download,
  FileText,
  Sparkles,
  MapPin,
  Sliders,
  Calendar,
  Microscope,
  Upload,
  AlertCircle,
  X,
  Compass,
  CheckCircle2,
  MapPinned
} from 'lucide-react';
import type { RegionDefinition } from '../types/fire';
import { STUDY_REGIONS } from '../data/regions';
import type { DataSourceMode } from '../types/dataSource';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedRegion: RegionDefinition;
  setSelectedRegion: (region: RegionDefinition) => void;
  onOpenReport: () => void;
  onExportCsv: () => void;
  onSelectScenario: (scenarioId: string) => void;
  isDemonstrationActive?: boolean;
  dataSourceMode: DataSourceMode;
  onDataSourceChange: (mode: DataSourceMode) => void;
  onUploadCsv?: (file: File) => void;
  uploadedRecordCount?: number | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  selectedRegion,
  setSelectedRegion,
  onOpenReport,
  onExportCsv,
  onSelectScenario,
  isDemonstrationActive = true,
  dataSourceMode,
  onDataSourceChange,
  onUploadCsv,
  uploadedRecordCount = null
}) => {
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && onUploadCsv) {
      onUploadCsv(e.target.files[0]);
    }
  };

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
        fontSize: '0.76rem',
        color: 'var(--text-muted)',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="pulse-dot pulse-dot-emerald"></span>
            <strong style={{ color: '#38bdf8', letterSpacing: '0.03em' }}>NASA EOSDIS / FIRMS</strong>
          </span>
          <span style={{ color: 'var(--border-strong)' }}>|</span>
          <span style={{ color: 'var(--text-muted)' }}>
            Constellation: <strong style={{ color: 'var(--text-bright)' }}>Terra & Aqua (MODIS) • Suomi-NPP & NOAA-20 (VIIRS)</strong>
          </span>
          <span style={{ color: 'var(--border-strong)' }}>|</span>
          <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>
            Collection 6.1 & VNP14IMG Synchronized (2000–2025)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={13} color="#f59e0b" />
            <span style={{ color: '#fbbf24', fontWeight: 600 }}>Benchmark Dilemmas:</span>
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
                padding: '2px 8px',
                fontSize: '0.74rem',
                cursor: 'pointer'
              }}
            >
              <option value="" disabled>Select Evaluation Scenario...</option>
              <option value="false_surge">1. The 2012 False Surge Paradox (California)</option>
              <option value="punjab_transfer">2. Cross-Regime Calibration Breakdown (Punjab)</option>
              <option value="cloud_mask">3. The Invisible Fire Problem (Amazon Wet Season)</option>
              <option value="record_siege">4. 2020 Historic Megafire Siege vs 2010 Baseline (1.03M-acre August Complex)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Prominent Synthetic Demonstration Fixture Banner */}
      {isDemonstrationActive && !isBannerDismissed && (
        <div style={{
          padding: '8px 24px',
          background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.22) 0%, rgba(217, 119, 6, 0.28) 100%)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.8rem',
          color: '#fef3c7',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={16} color="#fbbf24" />
            <span>
              <strong style={{ color: '#fde047', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Synthetic Demonstration Fixtures Active:
              </strong>{' '}
              Currently displaying pre-computed demonstration records calibrated from NASA FIRMS archives.
              You may upload raw NASA FIRMS CSV files at any time to evaluate real observational data.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                color: '#ffffff',
                border: '1px solid rgba(254, 243, 199, 0.4)',
                borderRadius: '6px',
                padding: '3px 10px',
                fontSize: '0.74rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer'
              }}
            >
              <Upload size={12} />
              Upload Real NASA FIRMS CSV
            </button>
            <button
              onClick={() => setIsBannerDismissed(true)}
              title="Dismiss banner"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fef3c7',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Real Uploaded Data Banner */}
      {dataSourceMode === 'observational' && (
        <div style={{
          padding: '8px 24px',
          background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.2) 0%, rgba(16, 185, 129, 0.18) 100%)',
          borderBottom: '1px solid rgba(6, 182, 212, 0.4)',
          fontSize: '0.8rem',
          color: '#cffafe'
        }}>
          <strong style={{ color: '#67e8f9' }}>NASA OBSERVATIONAL DATA ACTIVE:</strong>{' '}
          California MODIS/VIIRS standard-processing observations, January 2018–December 2022.
          Metrics are active-fire detections and cell-days; positive detections do not establish complete orbital coverage.
        </div>
      )}

      {!isDemonstrationActive && uploadedRecordCount !== null && (
        <div style={{
          padding: '8px 24px',
          background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
          borderBottom: '1px solid rgba(16, 185, 129, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.8rem',
          color: '#d1fae5'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="#34d399" />
            <span>
              <strong style={{ color: '#6ee7b7' }}>UPLOADED FIRMS RECORDS LOADED:</strong>{' '}
              Successfully ingested and projected {uploadedRecordCount.toLocaleString()} user-supplied FIRMS records into the equal-area grid.
              Verify the source file provenance before treating them as authentic NASA observations.
            </span>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary"
            style={{ fontSize: '0.72rem', padding: '3px 8px' }}
          >
            Upload Another CSV
          </button>
        </div>
      )}

      {/* Hidden File Input for Real FIRMS CSV */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv,.txt"
        style={{ display: 'none' }}
      />

      {/* Main Header Row */}
      <div style={{
        padding: '12px 24px',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: 'linear-gradient(90deg, #38bdf8, #fbbf24)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 800,
                fontSize: '1.4rem',
                letterSpacing: '-0.02em',
                lineHeight: 1
              }}>
                FireTruth
              </span>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.92rem', fontWeight: 600 }}>by IGNIS Atlas</span>
              <span className="badge badge-fire" style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
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

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-surface-elevated)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.78rem'
          }}>
            <Satellite size={15} color="var(--accent-cyan)" />
            <span style={{ color: 'var(--text-dim)' }}>Data source:</span>
            <select
              aria-label="Data source"
              value={dataSourceMode}
              onChange={e => onDataSourceChange(e.target.value as DataSourceMode)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-bright)',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="observational" style={{ background: '#0e1526' }}>NASA Observational Data — California 2018–2022</option>
              <option value="synthetic" style={{ background: '#0e1526' }}>Synthetic Demonstration</option>
              <option value="uploaded" style={{ background: '#0e1526' }}>Uploaded NASA FIRMS CSV</option>
            </select>
          </label>

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary"
            title="Upload local NASA FIRMS CSV dataset to process in equal-area grid"
            style={{ fontSize: '0.82rem', padding: '7px 12px' }}
          >
            <Upload size={14} />
            Upload NASA CSV
          </button>

          {/* Export CSV button */}
          <button
            onClick={onExportCsv}
            className="btn-secondary"
            title="Download full standardized CSV dataset with metadata and calibration parameters"
            style={{ fontSize: '0.82rem', padding: '7px 12px' }}
          >
            <Download size={14} />
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

      {/* 8-Tab Navigation Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: '4px',
        borderTop: '1px solid var(--border-subtle)',
        overflowX: 'auto'
      }}>
        <TabButton
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          icon={<Flame size={15} />}
          label="1. Overview"
          badge="Mission"
        />
        <TabButton
          active={activeTab === 'explorer'}
          onClick={() => setActiveTab('explorer')}
          icon={<Satellite size={15} />}
          label="2. Fire Explorer"
          badge="FIRMS Map"
        />
        <TabButton
          active={activeTab === 'calendar'}
          onClick={() => setActiveTab('calendar')}
          icon={<Calendar size={15} />}
          label="3. Burning Calendar"
          badge="2000–2025"
        />
        <TabButton
          active={activeTab === 'lab'}
          onClick={() => setActiveTab('lab')}
          icon={<Sliders size={15} />}
          label="4. Harmonization Lab"
          badge="B0 vs B1 vs B2"
        />
        <TabButton
          active={activeTab === 'challenge'}
          onClick={() => setActiveTab('challenge')}
          icon={<Compass size={15} />}
          label="5. Scientific Challenge"
          badge="6 Steps"
          highlight
        />
        <TabButton
          active={activeTab === 'resolver'}
          onClick={() => setActiveTab('resolver')}
          icon={<ShieldCheck size={15} />}
          label="6. Evidence Resolver"
          badge="6 Gates"
          highlight
        />
        <TabButton
          active={activeTab === 'dossier'}
          onClick={() => setActiveTab('dossier')}
          icon={<FileText size={15} />}
          label="7. Scientific Dossier"
          badge="Peer-Review"
        />
        <TabButton
          active={activeTab === 'science'}
          onClick={() => setActiveTab('science')}
          icon={<Microscope size={15} />}
          label="8. Explain the Science"
        />
        <TabButton
          active={activeTab === 'case-study'}
          onClick={() => setActiveTab('case-study')}
          icon={<MapPin size={15} />}
          label="9. California 2020 Case Study"
          badge="Physics"
        />
        <TabButton
          active={activeTab === 'transfer'}
          onClick={() => setActiveTab('transfer')}
          icon={<MapPinned size={15} />}
          label="10. Cross-Region Transfer Lab"
          badge="Phase 3"
          highlight
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
        gap: '7px',
        padding: '11px 14px',
        fontSize: '0.84rem',
        fontWeight: active ? 600 : 500,
        color: active ? 'var(--text-bright)' : 'var(--text-muted)',
        borderBottom: active 
          ? (highlight ? '2px solid var(--accent-fire)' : '2px solid var(--accent-cyan)') 
          : '2px solid transparent',
        background: active 
          ? (highlight ? 'rgba(255, 87, 34, 0.08)' : 'rgba(6, 182, 212, 0.06)') 
          : 'transparent',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        cursor: 'pointer'
      }}
    >
      <span style={{ color: active ? (highlight ? 'var(--accent-fire)' : 'var(--accent-cyan)') : 'inherit' }}>
        {icon}
      </span>
      <span>{label}</span>
      {badge && (
        <span style={{
          fontSize: '0.66rem',
          padding: '1px 5px',
          borderRadius: '4px',
          background: active 
            ? (highlight ? 'rgba(255, 87, 34, 0.25)' : 'rgba(6, 182, 212, 0.25)') 
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
