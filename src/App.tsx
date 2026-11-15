import React, { useState } from 'react';
import { DEFAULT_REGION, STUDY_REGIONS } from './data/regions';
import { REGIONAL_DATA_CACHE } from './data/historicalFireData';
import type { MonthlyFireRecord, RegionDefinition } from './types/fire';
import type { FireHotspot } from './types/fire';
import { Header } from './components/Header';
import { ExecutiveOverview } from './components/ExecutiveOverview';
import { ExplorerMap } from './components/ExplorerMap';
import { BurningCalendar } from './components/BurningCalendar';
import { HarmonizationLab } from './components/HarmonizationLab';
import { ScientificChallengeView } from './components/ScientificChallengeView';
import { EvidenceResolverView } from './components/EvidenceResolverView';
import { ScientificDossierView } from './components/ScientificDossierView';
import { ScienceExplainer } from './components/ScienceExplainer';
import { EvidenceReportModal } from './components/EvidenceReportModal';
import { Flame } from 'lucide-react';
import { applyFirmsUpload, parseFirmsCsv } from './science/firmsCsv';
import {
  NASA_OBSERVATIONAL_ARTIFACT,
  NASA_OBSERVATIONAL_RECORDS,
  NASA_OBSERVATIONAL_REGION_ID
} from './data/nasaObservationalData';
import type { DataSourceMode } from './types/dataSource';

export const App: React.FC = () => {
  const [selectedRegion, setSelectedRegion] = useState<RegionDefinition>(DEFAULT_REGION);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>('observational');
  const [uploadedRecordCount, setUploadedRecordCount] = useState<number | null>(null);
  const [uploadedRegionId, setUploadedRegionId] = useState<string | null>(null);
  const [uploadedHotspots, setUploadedHotspots] = useState<FireHotspot[] | null>(null);

  // Custom uploaded dataset per region (if uploaded by user)
  const [customRecords, setCustomRecords] = useState<MonthlyFireRecord[] | null>(null);

  // Cross-component audit state
  const [auditParams, setAuditParams] = useState<{ yearA: number; yearB: number; month?: number }>({
    yearA: 2008,
    yearB: 2018
  });

  // Authoritative records for active region: either custom user-uploaded or cached baseline
  const currentRecords: MonthlyFireRecord[] = (
    dataSourceMode === 'uploaded' && customRecords && uploadedRegionId === selectedRegion.id
      ? customRecords
      : dataSourceMode === 'observational' && selectedRegion.id === NASA_OBSERVATIONAL_REGION_ID
        ? NASA_OBSERVATIONAL_RECORDS
        : (REGIONAL_DATA_CACHE[selectedRegion.id] || REGIONAL_DATA_CACHE.california)
  );

  const isDemonstrationActive = dataSourceMode === 'synthetic';

  const handleDataSourceChange = (mode: DataSourceMode) => {
    if (mode === 'observational') {
      setSelectedRegion(DEFAULT_REGION);
      setDataSourceMode(mode);
      return;
    }
    if (mode === 'uploaded' && !customRecords) {
      alert('Upload a NASA FIRMS CSV before selecting uploaded-data mode.');
      return;
    }
    setDataSourceMode(mode);
  };

  const handleRegionChange = (region: RegionDefinition) => {
    setSelectedRegion(region);
    setUploadedRecordCount(uploadedRegionId === region.id ? uploadedRecordCount : null);
  };

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
      setActiveTab('challenge');
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

  // Handle User CSV Upload (NASA FIRMS format)
  const handleUploadCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) return;
        const upload = parseFirmsCsv(text);
        if (upload.validRecordCount === 0) {
          throw new Error('No valid FIRMS observations were found after coordinate and date validation.');
        }
        const newRecords = applyFirmsUpload(currentRecords, upload, selectedRegion.baselineAlphaRatio);

        setCustomRecords(newRecords);
        setUploadedRegionId(selectedRegion.id);
        setUploadedHotspots(upload.hotspots.map((hotspot, index) => ({
          ...hotspot,
          id: `uploaded-${selectedRegion.id}-${index}`,
          regionId: selectedRegion.id,
          satellite: hotspot.satellite === 'Terra' || hotspot.satellite === 'Aqua' ||
            hotspot.satellite === 'NOAA-20' || hotspot.satellite === 'S-NPP'
            ? hotspot.satellite
            : hotspot.instrument === 'VIIRS' ? 'S-NPP' : 'Terra',
          brightness: 0,
          scan: 0,
          track: 0,
          version: 'USER_UPLOADED_FIRMS',
          bright_t31: undefined,
          daynight: 'D'
        })));
        setUploadedRecordCount(upload.validRecordCount);
        setDataSourceMode('uploaded');
      } catch (err) {
        console.error('Failed to parse uploaded CSV:', err);
        alert('Could not parse CSV. Please verify it is a valid NASA FIRMS comma-separated file.');
      }
    };
    reader.readAsText(file);
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
      `# Data source: ${dataSourceMode === 'observational' ? 'NASA FIRMS observational artifact' : dataSourceMode === 'uploaded' ? 'User-uploaded NASA FIRMS CSV' : 'Synthetic demonstration'}`,
      dataSourceMode === 'observational'
        ? `# Artifact: ${NASA_OBSERVATIONAL_ARTIFACT.artifactId} | Version: ${NASA_OBSERVATIONAL_ARTIFACT.artifactVersion}`
        : '',
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
        setSelectedRegion={handleRegionChange}
        onOpenReport={() => setIsReportModalOpen(true)}
        onExportCsv={handleExportCsv}
        onSelectScenario={handleSelectScenario}
        isDemonstrationActive={isDemonstrationActive}
        dataSourceMode={dataSourceMode}
        onDataSourceChange={handleDataSourceChange}
        onUploadCsv={handleUploadCsv}
        uploadedRecordCount={uploadedRecordCount}
      />

      {/* Main Tab View Switcher */}
      <main style={{ flex: 1 }}>
        {activeTab === 'overview' && (
          <ExecutiveOverview
            selectedRegion={selectedRegion}
            setActiveTab={setActiveTab}
            onOpenReport={() => setIsReportModalOpen(true)}
            dataSourceMode={dataSourceMode}
          />
        )}

        {activeTab === 'explorer' && (
          <ExplorerMap
            selectedRegion={selectedRegion}
            uploadedHotspots={uploadedRegionId === selectedRegion.id ? uploadedHotspots : null}
            dataSourceMode={dataSourceMode}
          />
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
            dataSourceMode={dataSourceMode}
          />
        )}

        {activeTab === 'challenge' && (
          <ScientificChallengeView
            selectedRegion={selectedRegion}
            setSelectedRegion={handleRegionChange}
            records={currentRecords}
            dataSourceMode={dataSourceMode}
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
            dataSourceMode={dataSourceMode}
          />
        )}

        {activeTab === 'dossier' && (
          <ScientificDossierView
            selectedRegion={selectedRegion}
            records={currentRecords}
            onExportCsv={handleExportCsv}
            dataSourceMode={dataSourceMode}
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
          <span>Authoritative Source: <strong>NASA FIRMS EOSDIS (MCD14DL & VNP14IMGTDL)</strong></span>
          <span>Projection: <strong>Sinusoidal Authalic Equal-Area</strong></span>
          <span>Harmonization: <strong>B2 Seasonally-Regularized Ridge</strong></span>
          <span className="badge badge-cyan" style={{ fontSize: '0.68rem' }}>100% Client-Side Reproducible</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
