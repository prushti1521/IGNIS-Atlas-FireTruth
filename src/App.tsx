import React, { useState } from 'react';
import { DEFAULT_REGION, STUDY_REGIONS } from './data/regions';
import { REGIONAL_DATA_CACHE } from './data/historicalFireData';
import type { MonthlyFireRecord, RegionDefinition } from './types/fire';
import { Header } from './components/Header';
import { ExplorerMap } from './components/ExplorerMap';
import { BurningCalendar } from './components/BurningCalendar';
import { HarmonizationLab } from './components/HarmonizationLab';
import { EvidenceResolverView } from './components/EvidenceResolverView';
import { ScienceExplainer } from './components/ScienceExplainer';
import { EvidenceReportModal } from './components/EvidenceReportModal';
import { Flame } from 'lucide-react';

export const App: React.FC = () => {
  const [selectedRegion, setSelectedRegion] = useState<RegionDefinition>(DEFAULT_REGION);
  const [activeTab, setActiveTab] = useState<string>('resolver'); // Start on the signature innovation!
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // Cross-component audit state
  const [auditParams, setAuditParams] = useState<{ yearA: number; yearB: number; month?: number }>({
    yearA: 2008,
    yearB: 2018
  });

  // Fetch cached or calculated records for current region
  const currentRecords: MonthlyFireRecord[] = REGIONAL_DATA_CACHE[selectedRegion.id] || REGIONAL_DATA_CACHE.california;

  // Handle cell click in calendar to audit
  const handleAuditMonth = (year: number, month: number) => {
    setAuditParams({
      yearA: year < 2012 ? year : 2008,
      yearB: year >= 2012 ? year : 2020,
      month
    });
    setActiveTab('resolver');
  };

  // Handle Evaluator Scenario Tours
  const handleSelectScenario = (scenarioId: string) => {
    if (scenarioId === 'false_surge') {
      setSelectedRegion(STUDY_REGIONS[0]); // California
      setAuditParams({ yearA: 2008, yearB: 2018, month: undefined });
      setActiveTab('resolver');
    } else if (scenarioId === 'punjab_transfer') {
      setSelectedRegion(STUDY_REGIONS[1]); // Punjab
      setActiveTab('lab');
    } else if (scenarioId === 'cloud_mask') {
      setSelectedRegion(STUDY_REGIONS[2]); // Amazon
      setActiveTab('calendar');
    } else if (scenarioId === 'record_siege') {
      setSelectedRegion(STUDY_REGIONS[0]); // California
      setAuditParams({ yearA: 2010, yearB: 2020, month: 8 });
      setActiveTab('resolver');
    }
  };

  // CSV Exporter
  const handleExportCsv = () => {
    const headers = [
      'region_id',
      'region_name',
      'year',
      'month',
      'modis_raw_hotspots',
      'viirs_raw_hotspots',
      'modis_cell_days_A_Mm',
      'viirs_cell_days_A_Vm',
      'harmonized_hsfai',
      'hsfai_lower_95ci',
      'hsfai_upper_95ci',
      'sensor_coverage_era',
      'harmonization_model',
      'historical_monthly_median',
      'anomaly_absolute',
      'anomaly_percent',
      'cloud_cover_percent',
      'satellite_passes',
      'notable_fire_event'
    ];

    const rows = currentRecords.map(r => [
      selectedRegion.id,
      `"${selectedRegion.name}"`,
      r.year,
      r.month,
      r.modisRawHotspots,
      r.viirsRawHotspots,
      r.modisCellDays,
      r.viirsCellDays,
      r.hsfai,
      r.hsfaiLowerCi,
      r.hsfaiUpperCi,
      r.sensorCoverage,
      r.modelApplied,
      r.historicalMedian,
      r.anomalyAbsolute,
      r.anomalyPercent,
      r.cloudCoverPercent,
      r.observationPassCount,
      `"${r.notableEvent || ''}"`
    ]);

    const csvContent = [
      `# IGNIS Atlas — FireTruth NASA FIRMS Harmonized Fire Activity Dataset`,
      `# Study Region: ${selectedRegion.name} (${selectedRegion.fireRegime})`,
      `# Empirical VIIRS/MODIS Alpha Ratio: ${selectedRegion.baselineAlphaRatio}`,
      `# Date Generated: ${new Date().toISOString()}`,
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ignis_atlas_firms_harmonized_${selectedRegion.id}_2000_2025.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-deep)' }}>
      {/* Top Navigation & App Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedRegion={selectedRegion}
        setSelectedRegion={setSelectedRegion}
        onOpenReport={() => setIsReportModalOpen(true)}
        onExportCsv={handleExportCsv}
        onSelectScenario={handleSelectScenario}
      />

      {/* Main Tab View Switcher */}
      <main style={{ flex: 1 }}>
        {activeTab === 'explorer' && (
          <ExplorerMap selectedRegion={selectedRegion} />
        )}

        {activeTab === 'calendar' && (
          <BurningCalendar
            records={currentRecords}
            selectedRegion={selectedRegion}
            onAuditMonth={handleAuditMonth}
          />
        )}

        {activeTab === 'lab' && (
          <HarmonizationLab
            records={currentRecords}
            selectedRegion={selectedRegion}
          />
        )}

        {activeTab === 'resolver' && (
          <EvidenceResolverView
            records={currentRecords}
            selectedRegion={selectedRegion}
            initialYearA={auditParams.yearA}
            initialYearB={auditParams.yearB}
            initialMonth={auditParams.month}
            onOpenReport={() => setIsReportModalOpen(true)}
          />
        )}

        {activeTab === 'science' && (
          <ScienceExplainer />
        )}
      </main>

      {/* Scientific Evidence Report Modal */}
      <EvidenceReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        selectedRegion={selectedRegion}
        records={currentRecords}
        onDownloadCsv={handleExportCsv}
      />

      {/* Scientific Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'rgba(8, 12, 22, 0.95)',
        padding: '16px 24px',
        fontSize: '0.78rem',
        color: 'var(--text-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Flame size={15} color="var(--accent-fire)" />
          <strong style={{ color: 'var(--text-muted)' }}>IGNIS Atlas — FireTruth</strong>
          <span>• Earth Observation Satellite Fire Harmonization & Evidence System</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>Authoritative Source: <strong>NASA FIRMS EOSDIS</strong></span>
          <span>Algorithms: <strong>Standardized Common-Grid B1/B2 Regularized Models</strong></span>
          <span className="badge badge-cyan" style={{ fontSize: '0.68rem' }}>100% Client-Side Reproducible</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
