import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import type { FireHotspot, RegionDefinition } from '../types/fire';
import { SAMPLE_HOTSPOTS } from '../data/sampleHotspots';
import { Play, Pause, RotateCcw, Eye, Zap, Flame, Satellite } from 'lucide-react';

interface ExplorerMapProps {
  selectedRegion: RegionDefinition;
}

export const ExplorerMap: React.FC<ExplorerMapProps> = ({ selectedRegion }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Filters
  const [sensorFilter, setSensorFilter] = useState<'ALL' | 'MODIS' | 'VIIRS'>('ALL');
  const [confidenceFilter, setConfidenceFilter] = useState<'ALL' | 'NOMINAL_HIGH' | 'HIGH'>('NOMINAL_HIGH');
  const [dayNightFilter, setDayNightFilter] = useState<'ALL' | 'D' | 'N'>('ALL');
  const [activeMonth, setActiveMonth] = useState<number>(8); // August default
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedHotspot, setSelectedHotspot] = useState<FireHotspot | null>(null);

  // Custom BBox coordinates
  const [customBbox, setCustomBbox] = useState({
    south: selectedRegion.bounds[0][0],
    west: selectedRegion.bounds[0][1],
    north: selectedRegion.bounds[1][0],
    east: selectedRegion.bounds[1][1]
  });

  // Keep bbox synced when region changes
  useEffect(() => {
    setCustomBbox({
      south: selectedRegion.bounds[0][0],
      west: selectedRegion.bounds[0][1],
      north: selectedRegion.bounds[1][0],
      east: selectedRegion.bounds[1][1]
    });
  }, [selectedRegion]);

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

      // CartoDB Dark Matter tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      // Add custom NASA FIRMS attribution
      L.control.attribution({ position: 'bottomright' })
        .addAttribution('NASA FIRMS / MODIS & VIIRS active fire')
        .addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
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
  const filteredHotspots = SAMPLE_HOTSPOTS.filter(h => {
    if (h.regionId !== selectedRegion.id) return false;
    if (sensorFilter !== 'ALL' && h.instrument !== sensorFilter) return false;
    if (confidenceFilter === 'HIGH' && h.confidence !== 'high') return false;
    if (confidenceFilter === 'NOMINAL_HIGH' && h.confidence === 'low') return false;
    if (dayNightFilter !== 'ALL' && h.daynight !== dayNightFilter) return false;
    return true;
  });

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
          {/* Sensor Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
          </div>

          {/* Confidence Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
          </div>

          {/* Day / Night Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
          </div>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Flame size={16} color="var(--accent-fire)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                  Active Hotspot Layer
                </span>
              </div>
              <span className="badge badge-fire" style={{ fontSize: '0.65rem' }}>
                {totalHotspots} Detected
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
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

            <div style={{ marginTop: '10px', fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.3 }}>
              Bounding Box: [{customBbox.south.toFixed(1)}°S, {customBbox.west.toFixed(1)}°W] to [{customBbox.north.toFixed(1)}°N, {customBbox.east.toFixed(1)}°E]<br />
              *Notice: VIIRS provides 3x–6x higher point density over the same fire perimeter due to 375m I-band spatial resolution vs MODIS 1000m.
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
