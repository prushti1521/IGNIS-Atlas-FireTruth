import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as L from 'leaflet';
import type { FireHotspot, RegionDefinition } from '../types/fire';
import { SAMPLE_HOTSPOTS } from '../data/sampleHotspots';
import { Play, Pause, RotateCcw, Eye, Zap, Flame, Satellite } from 'lucide-react';
import type { DataSourceMode } from '../types/dataSource';
import {
  loadSpatialArtifact,
  getSpatialCell,
  getSpatialCellMonths,
  type SpatialDisagreementArtifact,
  type SpatialCellMonth
} from '../data/nasaSpatialDisagreement';
import { buildSpatialCsv, buildSpatialGeoJson } from '../science/spatialExports';

interface ExplorerMapProps {
  selectedRegion: RegionDefinition;
  uploadedHotspots?: FireHotspot[] | null;
  dataSourceMode: DataSourceMode;
}

export const ExplorerMap: React.FC<ExplorerMapProps> = ({ selectedRegion, uploadedHotspots = null, dataSourceMode }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const spatialLayerRef = useRef<L.LayerGroup | null>(null);

  // Filters
  const [sensorFilter, setSensorFilter] = useState<'ALL' | 'MODIS' | 'VIIRS'>('ALL');
  const [confidenceFilter, setConfidenceFilter] = useState<'ALL' | 'NOMINAL_HIGH' | 'HIGH'>('NOMINAL_HIGH');
  const [dayNightFilter, setDayNightFilter] = useState<'ALL' | 'D' | 'N'>('ALL');
  const [activeMonth, setActiveMonth] = useState<number>(8); // August default
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedHotspot, setSelectedHotspot] = useState<FireHotspot | null>(null);
  const [selectedSpatialCell, setSelectedSpatialCell] = useState<SpatialCellMonth | null>(null);
  const [activeYear, setActiveYear] = useState<number>(2022);
  const [spatialLayer, setSpatialLayer] = useState<'MODIS' | 'VIIRS' | 'SHARED' | 'DISAGREEMENT'>('DISAGREEMENT');
  const [spatialArtifact, setSpatialArtifact] = useState<SpatialDisagreementArtifact | null>(null);
  const [spatialLoadState, setSpatialLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [spatialLoadError, setSpatialLoadError] = useState<string | null>(null);

  // Derived BBox coordinates from active region
  const customBbox = {
    south: selectedRegion.bounds[0][0],
    west: selectedRegion.bounds[0][1],
    north: selectedRegion.bounds[1][0],
    east: selectedRegion.bounds[1][1]
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: selectedRegion.center,
        zoom: selectedRegion.zoom,
        zoomControl: true,
        attributionControl: false
      });

      // OpenStreetMap tiles require no API key; NASA FIRMS remains the data source.
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Add custom NASA FIRMS attribution
      L.control.attribution({ position: 'bottomright' })
        .addAttribution('NASA FIRMS / MODIS & VIIRS active fire')
        .addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      spatialLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.flyTo(selectedRegion.center, selectedRegion.zoom, { duration: 1.2 });
    }
  }, [selectedRegion]);

  // Timeline animation
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setActiveMonth(prev => (prev >= 12 ? 1 : prev + 1));
      }, 1200);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Filter hotspots for current region and settings
  const sourceHotspots = dataSourceMode === 'observational'
    ? []
    : uploadedHotspots ?? SAMPLE_HOTSPOTS;
  const filteredHotspots = sourceHotspots.filter(h => {
    if (h.regionId !== selectedRegion.id) return false;
    if (Number(h.acq_date.slice(5, 7)) !== activeMonth) return false;
    if (sensorFilter !== 'ALL' && h.instrument !== sensorFilter) return false;
    if (confidenceFilter === 'HIGH' && h.confidence !== 'high') return false;
    if (confidenceFilter === 'NOMINAL_HIGH' && h.confidence === 'low') return false;
    if (dayNightFilter !== 'ALL' && h.daynight !== dayNightFilter) return false;
    return true;
  });

  useEffect(() => {
    if (dataSourceMode !== 'observational' || spatialArtifact || spatialLoadState === 'error') return;
    loadSpatialArtifact()
      .then(setSpatialArtifact)
      .then(() => setSpatialLoadState('ready'))
      .catch(error => {
        setSpatialLoadError(error instanceof Error ? error.message : 'Unable to load the NASA spatial artifact.');
        setSpatialLoadState('error');
      });
  }, [dataSourceMode, spatialArtifact, spatialLoadState]);
  const isSpatialLoading = dataSourceMode === 'observational' && !spatialArtifact && spatialLoadState !== 'error';

  const spatialRecords = useMemo(() => (
    dataSourceMode === 'observational' && spatialArtifact
      ? getSpatialCellMonths(spatialArtifact, activeYear, activeMonth)
      : []
  ), [activeMonth, activeYear, dataSourceMode, spatialArtifact]);
  const visibleSpatialRecords = useMemo(() => spatialRecords.filter(record => {
    if (spatialLayer === 'MODIS') return record.modis_active_cell_days > 0;
    if (spatialLayer === 'VIIRS') return record.viirs_active_cell_days > 0;
    if (spatialLayer === 'SHARED') return record.category === 'SHARED_CELL_MONTH';
    return record.category !== 'SHARED_CELL_MONTH';
  }), [spatialRecords, spatialLayer]);
  const spatialSummary = useMemo(() => ({
    modis: spatialRecords.filter(record => record.modis_active_cell_days > 0).length,
    viirs: spatialRecords.filter(record => record.viirs_active_cell_days > 0).length,
    shared: spatialRecords.filter(record => record.category === 'SHARED_CELL_MONTH').length,
    modisOnly: spatialRecords.filter(record => record.category === 'MODIS_ONLY_CELL_MONTH').length,
    viirsOnly: spatialRecords.filter(record => record.category === 'VIIRS_ONLY_CELL_MONTH').length
  }), [spatialRecords]);

  // Calculate summary stats
  const totalHotspots = filteredHotspots.length;
  const totalFrp = Math.round(filteredHotspots.reduce((sum, h) => sum + h.frp, 0));
  const modisCount = filteredHotspots.filter(h => h.instrument === 'MODIS').length;
  const viirsCount = filteredHotspots.filter(h => h.instrument === 'VIIRS').length;
  const avgBrightness = totalHotspots > 0 
    ? Math.round(filteredHotspots.reduce((sum, h) => sum + h.brightness, 0) / totalHotspots) 
    : 0;

  // Render Hotspot markers on Leaflet
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();

    filteredHotspots.forEach(hotspot => {
      const isModis = hotspot.instrument === 'MODIS';
      const markerColor = isModis ? '#f59e0b' : '#06b6d4';
      const radius = Math.min(22, Math.max(7, Math.round(Math.sqrt(hotspot.frp) * 1.5)));

      const circle = L.circleMarker([hotspot.latitude, hotspot.longitude], {
        radius,
        fillColor: markerColor,
        color: '#ffffff',
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.75
      });

      circle.on('click', () => {
        setSelectedHotspot(hotspot);
      });

      circle.bindTooltip(`
        <div style="font-family: var(--font-sans); padding: 4px;">
          <div style="font-weight: 700; color: ${markerColor};">
            ${hotspot.instrument} (${hotspot.satellite})
          </div>
          <div>FRP: <strong>${hotspot.frp} MW</strong></div>
          <div>Brightness: <strong>${hotspot.brightness} K</strong></div>
          <div>Footprint: ${hotspot.scan} × ${hotspot.track} km</div>
        </div>
      `, { direction: 'top', offset: [0, -6] });

      circle.addTo(group);
    });
  }, [filteredHotspots]);

  useEffect(() => {
    const group = spatialLayerRef.current;
    if (!group) return;
    group.clearLayers();
    if (dataSourceMode !== 'observational') return;

    visibleSpatialRecords.forEach(record => {
      const cell = spatialArtifact ? getSpatialCell(spatialArtifact, record.cell_id) : undefined;
      if (!cell) return;
      const categoryColor = record.category === 'SHARED_CELL_MONTH'
        ? '#22c55e'
        : record.category === 'MODIS_ONLY_CELL_MONTH' ? '#f59e0b' : '#06b6d4';
      const layerColor = spatialLayer === 'MODIS' ? '#f59e0b'
        : spatialLayer === 'VIIRS' ? '#06b6d4' : categoryColor;
      const polygon = L.polygon(cell.geometry.coordinates[0].map(([lon, lat]) => [lat, lon] as L.LatLngExpression), {
        color: layerColor,
        fillColor: layerColor,
        weight: 1,
        fillOpacity: 0.18 + Math.min(0.55, (record.modis_active_cell_days + record.viirs_active_cell_days) / 50)
      });
      polygon.on('click', () => setSelectedSpatialCell(record));
      polygon.bindTooltip(`${record.cell_id} · ${record.category.replaceAll('_', ' ')}`);
      polygon.addTo(group);
    });
  }, [dataSourceMode, spatialArtifact, spatialLayer, visibleSpatialRecords]);

  const downloadSpatialExport = (format: 'csv' | 'geojson') => {
    if (dataSourceMode !== 'observational') return;
    if (!spatialArtifact) return;
    const content = format === 'csv'
      ? buildSpatialCsv(spatialArtifact, visibleSpatialRecords)
      : buildSpatialGeoJson(spatialArtifact, visibleSpatialRecords);
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ignis_spatial_${activeYear}-${String(activeMonth).padStart(2, '0')}.${format === 'csv' ? 'csv' : 'geojson'}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: '600px' }}>
      {/* Control Bar */}
      <div style={{
        padding: '12px 24px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        zIndex: 10
      }}>
        {/* Filters Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {dataSourceMode === 'observational' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Year:</span>
                <select value={activeYear} onChange={e => setActiveYear(Number(e.target.value))} style={{ fontSize: '0.78rem', padding: '4px 8px' }}>
                  {[2018, 2019, 2020, 2021, 2022].map(year => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Layer:</span>
                <select value={spatialLayer} onChange={e => setSpatialLayer(e.target.value as typeof spatialLayer)} style={{ fontSize: '0.78rem', padding: '4px 8px' }}>
                  <option value="DISAGREEMENT">Disagreement</option>
                  <option value="MODIS">MODIS activity</option>
                  <option value="VIIRS">VIIRS activity</option>
                  <option value="SHARED">Shared activity</option>
                </select>
              </div>
              <button className="btn-secondary" onClick={() => downloadSpatialExport('csv')} style={{ padding: '5px 8px', fontSize: '0.75rem' }}>
                CSV
              </button>
              <button className="btn-secondary" onClick={() => downloadSpatialExport('geojson')} style={{ padding: '5px 8px', fontSize: '0.75rem' }}>
                GeoJSON
              </button>
            </>
          )}
          {/* Sensor Toggle */}
          {dataSourceMode !== 'observational' && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Satellite size={15} color="var(--accent-cyan)" />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Sensor:</span>
            <div style={{
              display: 'flex',
              background: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px',
              border: '1px solid var(--border-subtle)'
            }}>
              {(['ALL', 'MODIS', 'VIIRS'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSensorFilter(s)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '4px',
                    background: sensorFilter === s ? (s === 'MODIS' ? 'rgba(245, 158, 11, 0.25)' : s === 'VIIRS' ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255,255,255,0.12)') : 'transparent',
                    color: sensorFilter === s ? (s === 'MODIS' ? '#fbbf24' : s === 'VIIRS' ? '#38bdf8' : '#ffffff') : 'var(--text-dim)'
                  }}
                >
                  {s === 'ALL' ? 'All (MODIS+VIIRS)' : s === 'MODIS' ? 'MODIS (1km)' : 'VIIRS (375m)'}
                </button>
              ))}
            </div>
          </div>}

          {/* Confidence Filter */}
          {dataSourceMode !== 'observational' && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Confidence:</span>
            <select
              value={confidenceFilter}
              onChange={e => setConfidenceFilter(e.target.value as any)}
              style={{ fontSize: '0.78rem', padding: '4px 8px' }}
            >
              <option value="ALL">All Detections (incl. Low)</option>
              <option value="NOMINAL_HIGH">Nominal + High (Standard Science)</option>
              <option value="HIGH">High Confidence Only</option>
            </select>
          </div>}

          {/* Day / Night Filter */}
          {dataSourceMode !== 'observational' && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Pass:</span>
            <select
              value={dayNightFilter}
              onChange={e => setDayNightFilter(e.target.value as any)}
              style={{ fontSize: '0.78rem', padding: '4px 8px' }}
            >
              <option value="ALL">Day & Night (24h)</option>
              <option value="D">Day Passes Only (D)</option>
              <option value="N">Night Passes Only (N)</option>
            </select>
          </div>}
        </div>

        {/* Timeline Playback Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={isPlaying ? 'btn-accent' : 'btn-primary'}
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? 'Pause' : 'Play Timeline'}
          </button>
          
          <button
            onClick={() => { setActiveMonth(8); setIsPlaying(false); }}
            className="btn-secondary"
            title="Reset to peak fire month"
            style={{ padding: '6px 8px' }}
          >
            <RotateCcw size={14} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="range"
              min={1}
              max={12}
              value={activeMonth}
              onChange={e => setActiveMonth(Number(e.target.value))}
              style={{ width: '110px', accentColor: 'var(--accent-cyan)' }}
            />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-cyan)', minWidth: '85px' }}>
              {monthNames[activeMonth - 1]}
            </span>
          </div>
        </div>
      </div>

      {/* Map Body Container */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Leaflet DOM Node */}
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

        {/* Floating Quick Stats HUD */}
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 400,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '320px'
        }}>
          <div className="glass-panel" style={{ padding: '12px 16px' }}>
            {dataSourceMode === 'observational' && spatialLoadState !== 'ready' && (
              <div role="status" style={{ marginBottom: '10px', fontSize: '0.78rem', color: spatialLoadState === 'error' ? '#fca5a5' : 'var(--text-dim)' }}>
                {isSpatialLoading && 'Loading authentic NASA spatial artifact…'}
                {spatialLoadState === 'error' && (
                  <>
                    {spatialLoadError} <button className="btn-secondary" onClick={() => {
                      setSpatialArtifact(null);
                      setSpatialLoadState('idle');
                    }} style={{ marginLeft: '6px', padding: '3px 6px', fontSize: '0.7rem' }}>Retry</button>
                  </>
                )}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Flame size={16} color="var(--accent-fire)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                  Active Hotspot Layer
                </span>
              </div>
              <span className="badge badge-fire" style={{ fontSize: '0.65rem' }}>
                {dataSourceMode === 'observational' ? `${visibleSpatialRecords.length} cells` : `${totalHotspots} Detected`}
              </span>
            </div>

            {dataSourceMode === 'observational' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '6px 8px', borderRadius: '4px' }}>
                  <span style={{ color: '#fbbf24', display: 'block', fontWeight: 600 }}>MODIS-active cells</span>
                  <span style={{ fontWeight: 700 }}>{spatialSummary.modis}</span>
                </div>
                <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '6px 8px', borderRadius: '4px' }}>
                  <span style={{ color: '#38bdf8', display: 'block', fontWeight: 600 }}>VIIRS-active cells</span>
                  <span style={{ fontWeight: 700 }}>{spatialSummary.viirs}</span>
                </div>
                <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '6px 8px', borderRadius: '4px' }}>
                  <span style={{ color: '#4ade80', display: 'block', fontWeight: 600 }}>Shared cells</span>
                  <span style={{ fontWeight: 700 }}>{spatialSummary.shared}</span>
                </div>
                <div style={{ background: 'rgba(248, 113, 113, 0.1)', padding: '6px 8px', borderRadius: '4px' }}>
                  <span style={{ color: '#fca5a5', display: 'block', fontWeight: 600 }}>Sensor-only cells</span>
                  <span style={{ fontWeight: 700 }}>{spatialSummary.modisOnly + spatialSummary.viirsOnly}</span>
                </div>
              </div>
            ) : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 8px', borderRadius: '4px' }}>
                <span style={{ color: 'var(--text-dim)', display: 'block' }}>Total FRP</span>
                <span style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.92rem' }}>
                  {totalFrp} MW
                </span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 8px', borderRadius: '4px' }}>
                <span style={{ color: 'var(--text-dim)', display: 'block' }}>Avg Temp</span>
                <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.92rem' }}>
                  {avgBrightness} K
                </span>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <span style={{ color: '#fbbf24', display: 'block', fontWeight: 600 }}>MODIS (1km)</span>
                <span style={{ fontWeight: 700, color: '#ffffff' }}>{modisCount} pts</span>
              </div>
              <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                <span style={{ color: '#38bdf8', display: 'block', fontWeight: 600 }}>VIIRS (375m)</span>
                <span style={{ fontWeight: 700, color: '#ffffff' }}>{viirsCount} pts</span>
              </div>
            </div>
            }

            <div style={{ marginTop: '10px', fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.3 }}>
              Bounding Box: [{customBbox.south.toFixed(1)}°S, {customBbox.west.toFixed(1)}°W] to [{customBbox.north.toFixed(1)}°N, {customBbox.east.toFixed(1)}°E]<br />
              {dataSourceMode === 'observational'
                ? `* Authentic ${activeYear}-${String(activeMonth).padStart(2, '0')} 25 km cell-month layer. Sensor-only cells do not prove missed detections.`
                : '* Notice: VIIRS provides 3x–6x higher point density over the same fire perimeter due to 375m I-band spatial resolution vs MODIS 1000m.'}
            </div>
          </div>
        </div>

        {/* Legend / Sensor Color Keys */}
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '16px',
          zIndex: 400
        }}>
          <div className="glass-panel" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
              <span style={{ color: 'var(--text-muted)' }}>MODIS (Terra/Aqua 1km)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#06b6d4', display: 'inline-block' }}></span>
              <span style={{ color: 'var(--text-muted)' }}>VIIRS (S-NPP/NOAA-20 375m)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={12} color="#fbbf24" />
              <span style={{ color: 'var(--text-dim)' }}>Radius = √FRP</span>
            </div>
          </div>
        </div>

        {/* Selected Hotspot Detail Drawer */}
        {selectedSpatialCell && dataSourceMode === 'observational' && (
          <div style={{ position: 'absolute', top: '16px', right: '16px', width: '340px', zIndex: 400 }}>
            <div className="glass-panel" style={{ padding: '16px', border: '1px solid #22c55e' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-bright)' }}>Authentic cell-month detail</span>
                <button onClick={() => setSelectedSpatialCell(null)} style={{ color: 'var(--text-dim)', fontSize: '1rem', padding: '0 4px' }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                <div><strong>Cell:</strong> {selectedSpatialCell.cell_id}</div>
                <div><strong>Period:</strong> {selectedSpatialCell.year}-{String(selectedSpatialCell.month).padStart(2, '0')}</div>
                <div><strong>Category:</strong> {selectedSpatialCell.category.replaceAll('_', ' ')}</div>
                <div><strong>MODIS active cell-days:</strong> {selectedSpatialCell.modis_active_cell_days}</div>
                <div><strong>VIIRS active cell-days:</strong> {selectedSpatialCell.viirs_active_cell_days}</div>
                <div><strong>Same UTC-day matches:</strong> {selectedSpatialCell.same_utc_day_matches}</div>
                <div><strong>±{selectedSpatialCell.temporal_window_days}-day one-to-one matches:</strong> {selectedSpatialCell.window_matches}</div>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}>{selectedSpatialCell.coverage_interpretation}</p>
              </div>
            </div>
          </div>
        )}
        {selectedHotspot && (
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '320px',
            zIndex: 400
          }}>
            <div className="glass-panel" style={{ padding: '16px', border: '1px solid var(--accent-cyan)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Eye size={16} color="var(--accent-cyan)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                    NASA FIRMS Observation
                  </span>
                </div>
                <button
                  onClick={() => setSelectedHotspot(null)}
                  style={{ color: 'var(--text-dim)', fontSize: '1rem', padding: '0 4px' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Instrument & Satellite:</span>
                  <span style={{ fontWeight: 600, color: selectedHotspot.instrument === 'MODIS' ? '#fbbf24' : '#38bdf8' }}>
                    {selectedHotspot.instrument} ({selectedHotspot.satellite})
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Coordinates:</span>
                  <span className="mono" style={{ fontWeight: 500 }}>
                    {selectedHotspot.latitude.toFixed(4)}°, {selectedHotspot.longitude.toFixed(4)}°
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Fire Radiative Power (FRP):</span>
                  <span style={{ fontWeight: 700, color: '#f59e0b' }}>
                    {selectedHotspot.frp} MW
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Brightness Temp:</span>
                  <span style={{ fontWeight: 600 }}>{selectedHotspot.brightness} K</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Acquisition Time (UTC):</span>
                  <span className="mono">{selectedHotspot.acq_date} {selectedHotspot.acq_time}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Ground Footprint (Scan×Track):</span>
                  <span>{selectedHotspot.scan} km × {selectedHotspot.track} km</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Processing Collection:</span>
                  <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {selectedHotspot.version}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Detection Confidence:</span>
                  <span className={`badge ${selectedHotspot.confidence === 'high' ? 'badge-emerald' : 'badge-amber'}`}>
                    {selectedHotspot.confidence}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
