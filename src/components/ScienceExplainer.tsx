import React, { useState } from 'react';
import { Microscope, Layers, CloudRain, Flame, Check, X, Sparkles } from 'lucide-react';

export const ScienceExplainer: React.FC = () => {
  const [fireSizeSqM, setFireSizeSqM] = useState<number>(65); // 65 m² default
  const [cloudCoverFrac, setCloudCoverFrac] = useState<number>(10); // 10%
  const [isOffNadir, setIsOffNadir] = useState<boolean>(false);

  // Sensor pixel areas (m²)
  // At nadir: MODIS 1000m x 1000m = 1,000,000 m²
  // VIIRS I-band: 375m x 375m = 140,625 m²
  const modisArea = isOffNadir ? 4800000 : 1000000; // 5x expansion at swath edge!
  const viirsArea = isOffNadir ? 210000 : 140625;   // Constrained by 3:1 aggregation!

  // Detection thresholds
  // VIIRS I4 band detects flaming fires as small as ~40-50 m²
  // MODIS 1km typically requires ~100-300 m² under clear conditions
  const modisDetected = fireSizeSqM >= (isOffNadir ? 280 : 120) && cloudCoverFrac < 65;
  const viirsDetected = fireSizeSqM >= (isOffNadir ? 60 : 45) && cloudCoverFrac < 75;

  const modisFraction = (fireSizeSqM / modisArea) * 100;
  const viirsFraction = (fireSizeSqM / viirsArea) * 100;

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Title */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Microscope size={24} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem' }}>Explain the Science: Sensor Physics & Detection Biases</h2>
          <span className="badge badge-cyan">Remote Sensing Core Fundamentals</span>
        </div>
        <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Why MODIS and VIIRS can never be compared directly without harmonization, and why zero detected hotspots
          does not guarantee an absence of burning.
        </p>
      </div>

      {/* Main Interactive Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Column: Interactive Sensor Footprint Simulator */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={18} color="var(--accent-fire)" />
              Pixel Footprint & Sub-Pixel Dilution Simulator
            </h3>
            <span className="badge badge-amber">Interactive Laboratory</span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Adjust the physical fire flaming area and atmospheric conditions to observe how the two sensors respond.
          </p>

          {/* Sliders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            {/* Fire Size Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>Active Flaming Fire Size:</span>
                <span style={{ color: '#fbbf24', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {fireSizeSqM} m² {fireSizeSqM < 80 ? '(Small Ag / Campfire)' : fireSizeSqM < 250 ? '(Flank Fire)' : '(Canopy Wildfire)'}
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={500}
                value={fireSizeSqM}
                onChange={e => setFireSizeSqM(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-fire)' }}
              />
            </div>

            {/* Cloud Cover Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>Cloud & Thick Smoke Obscuration:</span>
                <span style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {cloudCoverFrac}% {cloudCoverFrac > 60 ? '(Heavy Cloud Deck)' : '(Permeable)'}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={95}
                value={cloudCoverFrac}
                onChange={e => setCloudCoverFrac(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
              />
            </div>

            {/* Off-Nadir Swath Edge Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', padding: '10px 14px', borderRadius: '8px' }}>
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-bright)', display: 'block' }}>
                  Viewing Geometry (Swath Edge vs Nadir)
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  Simulates the infamous "Bow-Tie Effect" at swath edges.
                </span>
              </div>
              <button
                onClick={() => setIsOffNadir(!isOffNadir)}
                className={isOffNadir ? 'btn-accent' : 'btn-secondary'}
                style={{ fontSize: '0.75rem', padding: '5px 12px' }}
              >
                {isOffNadir ? 'Off-Nadir (Edge)' : 'Nadir (Sub-Satellite)'}
              </button>
            </div>
          </div>

          {/* Live Sensor Detector Visualizer */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '20px'
          }}>
            {/* MODIS Pixel Box */}
            <div style={{
              background: modisDetected ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.02)',
              border: modisDetected ? '2px solid #f59e0b' : '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '16px',
              textAlign: 'center',
              position: 'relative'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fbbf24', marginBottom: '4px' }}>
                MODIS (Terra/Aqua)
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '12px' }}>
                Pixel: {isOffNadir ? '2.0 × 4.8 km (Expanded)' : '1000 × 1000 m'}
              </div>

              {/* Graphic Pixel Representation */}
              <div style={{
                width: '120px',
                height: '120px',
                border: '2px dashed rgba(245, 158, 11, 0.5)',
                margin: '0 auto 12px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.4)'
              }}>
                {/* Fire Dot */}
                <div style={{
                  width: `${Math.max(4, Math.min(40, fireSizeSqM / 10))}px`,
                  height: `${Math.max(4, Math.min(40, fireSizeSqM / 10))}px`,
                  borderRadius: '50%',
                  background: '#ff5722',
                  boxShadow: '0 0 10px #ff5722'
                }} />
                <span style={{ position: 'absolute', bottom: '4px', right: '4px', fontSize: '0.62rem', color: 'var(--text-dim)' }}>
                  1 km²
                </span>
              </div>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.8rem',
                background: modisDetected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: modisDetected ? '#34d399' : '#f87171'
              }}>
                {modisDetected ? <Check size={14} /> : <X size={14} />}
                {modisDetected ? 'HOTSPOT DETECTED' : 'UNDETECTED (Signal Diluted)'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '8px' }}>
                Sub-pixel area fraction: <strong>{modisFraction.toFixed(4)}%</strong>
              </div>
            </div>

            {/* VIIRS Pixel Box */}
            <div style={{
              background: viirsDetected ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255, 255, 255, 0.02)',
              border: viirsDetected ? '2px solid #06b6d4' : '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '16px',
              textAlign: 'center',
              position: 'relative'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>
                VIIRS (S-NPP / NOAA-20)
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '12px' }}>
                Pixel: {isOffNadir ? '500 × 420 m (Aggregated)' : '375 × 375 m'}
              </div>

              {/* Graphic Pixel Representation */}
              <div style={{
                width: '65px',
                height: '65px',
                border: '2px dashed rgba(6, 182, 212, 0.7)',
                margin: '27px auto 40px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.4)'
              }}>
                {/* Fire Dot */}
                <div style={{
                  width: `${Math.max(4, Math.min(30, fireSizeSqM / 10))}px`,
                  height: `${Math.max(4, Math.min(30, fireSizeSqM / 10))}px`,
                  borderRadius: '50%',
                  background: '#ff5722',
                  boxShadow: '0 0 10px #ff5722'
                }} />
                <span style={{ position: 'absolute', bottom: '2px', right: '2px', fontSize: '0.58rem', color: 'var(--text-dim)' }}>
                  0.14 km²
                </span>
              </div>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.8rem',
                background: viirsDetected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: viirsDetected ? '#34d399' : '#f87171'
              }}>
                {viirsDetected ? <Check size={14} /> : <X size={14} />}
                {viirsDetected ? 'HOTSPOT DETECTED' : 'UNDETECTED'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '8px' }}>
                Sub-pixel area fraction: <strong>{viirsFraction.toFixed(4)}%</strong> (7.1× higher!)
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(0,0,0,0.3)',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            lineHeight: 1.5,
            color: 'var(--text-muted)'
          }}>
            <strong style={{ color: 'var(--accent-cyan)' }}>Key Physical Insight:</strong> Because a VIIRS 375m pixel has a nominal surface area approximately 7.11 times smaller than a MODIS 1000m pixel ((1,000 m)² / (375 m)² ≈ 7.11), a sub-pixel fire experiences substantially less thermal dilution. However, under real orbital conditions, point spread functions, off-nadir optical expansion, and regional fuel regimes dictate empirical detection ratios (e.g. California α = 3.68× vs Punjab α = 5.84×) rather than a uniform 7.11× scaling.
          </div>
        </div>

        {/* Right Column: Educational Explanations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Card 1: What is a Hotspot vs What is a Fire? */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.98rem', color: 'var(--text-bright)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={17} color="var(--accent-amber)" />
              1. What A Satellite Hotspot Actually Is (And Isn't)
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              A <strong>hotspot</strong> is NOT a count of individual fire ignitions, nor is it a direct measurement of burned area. A hotspot represents a satellite detector pixel containing an active thermal anomaly that exceeds a contextual brightness temperature threshold.
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: '8px' }}>
              A single large wildfire can trigger 500 contiguous VIIRS hotspots during an overpass, while a small agricultural burn triggers only 1.
            </p>
          </div>

          {/* Card 2: The Bow-Tie Effect */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.98rem', color: 'var(--text-bright)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={17} color="var(--accent-cyan)" />
              2. The "Bow-Tie Effect" & Pixel Growth
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              As satellite scan mirrors rotate towards the edge of the swath, oblique viewing angles distort the ground footprint.
            </p>
            <ul style={{ paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.5 }}>
              <li><strong>MODIS:</strong> Pixels expand from 1 km² at nadir to nearly 10 km² at swath edge, causing substantial adjacent pixel overlap and duplicate detections.</li>
              <li><strong>VIIRS:</strong> Features innovative on-board 3:1 pixel aggregation that limits pixel growth to only ~1.5x at the edge, maintaining crisp detection resolution.</li>
            </ul>
          </div>

          {/* Card 3: Zero Hotspots != Zero Fires */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.98rem', color: '#f87171', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CloudRain size={17} color="#f87171" />
              3. Why Zero Hotspots ≠ Zero Fires
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Thermal infrared cannot penetrate liquid water clouds or deep smoke decks. In tropical regions like the Amazon during the wet season, cloud cover exceeds 85%. Peat smoldering or understory burns continue undetected beneath the canopy.
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', lineHeight: 1.4, marginTop: '8px' }}>
              This is why FireTruth's <strong>Observation Completeness Gate</strong> strictly flags cloud-obscured months as <em>INSUFFICIENT EVIDENCE</em> rather than falsely reporting that fires ceased.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
