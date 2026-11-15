import React from 'react';
import type { RegionDefinition } from '../types/fire';
import {
  ShieldCheck,
  Compass,
  Calendar,
  Sliders,
  FileText,
  AlertTriangle,
  ArrowRight,
  Satellite
} from 'lucide-react';
import type { DataSourceMode } from '../types/dataSource';

interface ExecutiveOverviewProps {
  selectedRegion: RegionDefinition;
  setActiveTab: (tab: string) => void;
  onOpenReport: () => void;
  dataSourceMode: DataSourceMode;
}

export const ExecutiveOverview: React.FC<ExecutiveOverviewProps> = ({
  selectedRegion,
  setActiveTab,
  onOpenReport,
  dataSourceMode
}) => {
  return (
    <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '24px' }}>
      {/* Hero Banner */}
      <div className="glass-panel" style={{
        padding: '32px',
        marginBottom: '28px',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(8, 14, 28, 0.95) 0%, rgba(13, 22, 45, 0.9) 100%)',
        border: '1px solid rgba(6, 182, 212, 0.3)'
      }}>
        <div style={{
          position: 'absolute',
          top: '-60px',
          right: '-60px',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(255, 87, 34, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ maxWidth: '850px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <span className="badge badge-fire" style={{ fontSize: '0.74rem', padding: '3px 9px' }}>
              NASA Space Apps Challenge 2026
            </span>
            <span className="badge badge-cyan" style={{ fontSize: '0.74rem', padding: '3px 9px' }}>
              {dataSourceMode === 'observational' ? 'NASA Observational Mode' : dataSourceMode === 'uploaded' ? 'Uploaded FIRMS Mode' : 'Synthetic Demonstration Mode'}
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              Active Focus: {selectedRegion.name} ({selectedRegion.fireRegime})
            </span>
          </div>

          <h1 style={{
            fontSize: '2.4rem',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            marginBottom: '12px',
            background: 'linear-gradient(90deg, #ffffff 30%, #38bdf8 70%, #fbbf24 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            IGNIS Atlas — FireTruth
          </h1>

          <p style={{ fontSize: '1.2rem', color: '#94a3b8', fontWeight: 500, marginBottom: '16px' }}>
            <em>One Planet. Multiple Fire Sensors. A Clearer View of the Evidence.</em>
          </p>

          <p style={{ fontSize: '0.94rem', color: 'var(--text-main)', lineHeight: 1.65, marginBottom: '24px' }}>
            Explore authentic NASA MODIS and VIIRS active-fire observations, investigate why sensor counts diverge, and see where harmonization succeeds—and where it fails.
            FireTruth replaces raw counting with <strong>authalic sinusoidal equal-area cell-days</strong>, explicit calibration, and a transparent <strong>6-Gate Scientific Evidence Resolver</strong>.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('story')}
              className="btn-secondary"
              style={{ fontSize: '0.9rem', padding: '10px 20px' }}
            >
              Explore the Evidence <ArrowRight size={16} />
            </button>
            <button
              onClick={() => setActiveTab('challenge')}
              className="btn-primary"
              style={{ fontSize: '0.9rem', padding: '10px 22px' }}
            >
              Launch Scientific Challenge Mode <ArrowRight size={16} />
            </button>
            <button
              onClick={() => setActiveTab('resolver')}
              className="btn-secondary"
              style={{ fontSize: '0.9rem', padding: '10px 20px' }}
            >
              <ShieldCheck size={16} color="var(--accent-cyan)" />
              Inspect 6 Evidence Gates
            </button>
            <button
              onClick={onOpenReport}
              className="btn-secondary"
              style={{ fontSize: '0.9rem', padding: '10px 20px' }}
            >
              <FileText size={16} />
              Open Scientific Dossier
            </button>
          </div>
        </div>
      </div>

      {/* The 3 Pillars of FireTruth Innovation */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SparklesIcon />
          Why FireTruth Stands Apart: Evidence Over Feature-Count
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Pillar 1 */}
          <div className="glass-panel" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)' }}>
                <AlertTriangle size={20} color="#ef4444" />
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                1. The 7.11× Resolution Trap
              </h4>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              A nominal 1,000 m MODIS pixel spans 1,000,000 m²; a 375 m VIIRS pixel spans 140,625 m²:
              <br />
              <code style={{ color: 'var(--accent-cyan)', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '6px' }}>
                1,000² / 375² ≈ 7.11× nominal area ratio
              </code>
              <br />
              Raw detection counts cannot be concatenated into a single time series without generating phantom mega-surges.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="glass-panel" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.15)' }}>
                <Compass size={20} color="var(--accent-cyan)" />
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                2. Authalic Equal-Area Grid
              </h4>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Angular grids (0.1°, 0.25°) distort cell area by cos(latitude). FireTruth projects all active hotspots into a
              <strong> Sinusoidal Authalic Equal-Area Grid</strong> (R = 6,371.0088 km), ensuring cells have identical surface area globally and deduplicating detections to active <strong>cell-days</strong>.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="glass-panel" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)' }}>
                <ShieldCheck size={20} color="#10b981" />
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                3. The 6 Evidence Gates
              </h4>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Instead of producing unchecked numbers, our <strong>Evidence Resolver</strong> audits every historical statement against 6 independent remote-sensing gates: calibration domain, stability, uncertainty bounds, sensitivity invariance, cloud coverage limits, and burned-area concordance.
            </p>
          </div>
        </div>
      </div>

      {/* Guided Exploration Tour Cards */}
      <div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>
          Explore the Scientific Architecture
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <TourCard
            icon={<Compass size={20} color="var(--accent-cyan)" />}
            title="Global Fire Explorer"
            description="Interactive 3D/2D satellite map showing active MODIS & VIIRS hotspots with local CSV upload."
            tab="explorer"
            onClick={() => setActiveTab('explorer')}
          />
          <TourCard
            icon={<Calendar size={20} color="#f59e0b" />}
            title="26-Year Calendar"
            description="Multi-decadal monthly matrix (2000–2025) comparing raw counts, HSFAI, and historical anomalies."
            tab="calendar"
            onClick={() => setActiveTab('calendar')}
          />
          <TourCard
            icon={<Sliders size={20} color="#34d399" />}
            title="Harmonization Lab"
            description="Empirical overlap learning (B0 raw vs B1 linear vs B2 regularized) with rolling-origin folds."
            tab="lab"
            onClick={() => setActiveTab('lab')}
          />
          <TourCard
            icon={<ShieldCheck size={20} color="var(--accent-fire)" />}
            title="Evidence Resolver"
            description="Signature innovation: 6 physical gates auditing user claims for land managers and researchers."
            tab="resolver"
            onClick={() => setActiveTab('resolver')}
            badge="Signature"
          />
          <TourCard
            icon={<Satellite size={20} color="#38bdf8" />}
            title="Challenge Mode"
            description="6-step guided walkthrough solving real historical dilemmas with interactive stress tests."
            tab="challenge"
            onClick={() => setActiveTab('challenge')}
            badge="Guided"
          />
          <TourCard
            icon={<FileText size={20} color="#a78bfa" />}
            title="Scientific Dossier"
            description="Complete peer-review validation report with rolling-origin metrics and cryptographic hashes."
            tab="dossier"
            onClick={() => setActiveTab('dossier')}
          />
        </div>
      </div>
    </div>
  );
};

const SparklesIcon = () => (
  <span style={{ color: '#fbbf24', display: 'inline-flex', alignItems: 'center' }}>✨</span>
);

const TourCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  tab: string;
  badge?: string;
  onClick: () => void;
}> = ({ icon, title, description, badge, onClick }) => {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        padding: '18px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent-cyan)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          {icon}
          {badge && <span className="badge badge-fire" style={{ fontSize: '0.65rem' }}>{badge}</span>}
        </div>
        <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-bright)', marginBottom: '6px' }}>
          {title}
        </h4>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {description}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px', fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
        Open Module <ArrowRight size={13} />
      </div>
    </div>
  );
};
