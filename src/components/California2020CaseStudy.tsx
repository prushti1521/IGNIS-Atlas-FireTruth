import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { AlertTriangle, ExternalLink, Map, ShieldCheck } from 'lucide-react';
import { loadCalifornia2020Reference, type California2020ReferenceArtifact } from '../data/california2020Reference';
import { NASA_OBSERVATIONAL_ARTIFACT } from '../data/nasaObservationalData';

interface California2020CaseStudyProps {
  onOpenExplorer: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const California2020CaseStudy: React.FC<California2020CaseStudyProps> = ({ onOpenExplorer }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [artifact, setArtifact] = useState<California2020ReferenceArtifact | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCalifornia2020Reference().then(setArtifact).catch(reason => {
      setError(reason instanceof Error ? reason.message : 'Unable to load the California reference artifact.');
    });
  }, []);

  useEffect(() => {
    if (!mapRef.current || !artifact || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { center: [38.5, -120], zoom: 6, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    L.geoJSON(artifact.display_perimeters as GeoJSON.GeoJsonObject, {
      style: { color: '#f97316', weight: 1, fillColor: '#f97316', fillOpacity: 0.16 }
    }).addTo(map);
    mapInstanceRef.current = map;
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [artifact]);

  const referenceMetrics = artifact?.metrics.sensor_union;
  const maxActivity = Math.max(...(artifact?.monthly_activity_2020.map(row => row.viirs_active_cell_days) ?? [1]));

  return (
    <section style={{ padding: '28px 24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em' }}>
          EXTERNAL VALIDATION · CALIFORNIA 2020
        </div>
        <h2 style={{ margin: '8px 0', fontSize: '2rem' }}>A real fire season, with honest evidence boundaries</h2>
        <p style={{ maxWidth: '850px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          This case study compares authentic NASA MODIS/VIIRS active-fire cell activity with CAL FIRE final
          perimeters. The perimeter reference is authoritative and useful for spatial context, but it is
          incomplete, final-perimeter-only, and not ground truth.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '18px' }}>
        <article className="glass-panel" style={{ padding: '16px' }}>
          <strong>1 · Historical context</strong>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>The 2020 season supplies an authentic held-out window from July–December, including the extreme late-summer activity peak.</p>
        </article>
        <article className="glass-panel" style={{ padding: '16px' }}>
          <strong>2 · NASA observations</strong>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>MODIS and VIIRS are compared as active-fire sensors on the shared 25 km grid. VIIRS is not ground truth.</p>
        </article>
        <article className="glass-panel" style={{ padding: '16px' }}>
          <strong>3 · Spatial disagreement</strong>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>Use the Fire Explorer for monthly shared and sensor-only cell categories derived only from NASA detections.</p>
          <button className="btn-secondary" onClick={onOpenExplorer} style={{ marginTop: '4px' }}>Open spatial explorer <Map size={14} /></button>
        </article>
        <article className="glass-panel" style={{ padding: '16px' }}>
          <strong>4 · What harmonization changed</strong>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
            B1/B2 change the monthly activity index and improve MODIS–VIIRS agreement in the stored holdout.
            They do not create a predicted perimeter or burned-area map.
          </p>
        </article>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(280px, 0.7fr)', gap: '18px' }}>
        <article className="glass-panel" style={{ minHeight: '420px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <strong>5 · CAL FIRE 2020 final perimeters</strong>
            <span style={{ display: 'block', color: 'var(--text-dim)', fontSize: '0.76rem', marginTop: '4px' }}>
              {artifact ? `${artifact.reference.feature_count_california} California features · display geometry simplified for browser rendering` : 'Loading reference geometry…'}
            </span>
          </div>
          {error ? (
            <div role="alert" style={{ padding: '18px', color: '#fca5a5' }}>{error}</div>
          ) : <div ref={mapRef} style={{ height: '360px' }} />}
        </article>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <article className="glass-panel" style={{ padding: '16px' }}>
            <strong>NASA activity index · 2020</strong>
            <div style={{ display: 'flex', alignItems: 'end', gap: '5px', height: '130px', marginTop: '18px' }}>
              {(artifact?.monthly_activity_2020 ?? []).map(row => (
                <div key={row.month} title={`${MONTHS[row.month - 1]}: ${row.viirs_active_cell_days} VIIRS cell-days`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'end', height: '100%' }}>
                  <div style={{ height: `${Math.max(3, row.viirs_active_cell_days / maxActivity * 100)}%`, background: '#22d3ee', borderRadius: '3px 3px 0 0' }} />
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '4px' }}>{MONTHS[row.month - 1]}</span>
                </div>
              ))}
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.76rem', lineHeight: 1.4 }}>
              Monthly activity is descriptive active-fire cell-days, not burned area or fire size.
            </p>
          </article>
          <article className="glass-panel" style={{ padding: '16px' }}>
            <strong>External spatial comparison</strong>
            {referenceMetrics && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px', fontSize: '0.82rem' }}>
              <span>Reference cells <b>{referenceMetrics.reference_cells}</b></span>
              <span>Union overlap <b>{referenceMetrics.intersection_cells}</b></span>
              <span>Union IoU <b>{referenceMetrics.iou?.toFixed(3)}</b></span>
              <span>Union recall <b>{referenceMetrics.recall?.toFixed(3)}</b></span>
            </div>}
            <small style={{ display: 'block', color: 'var(--text-dim)', lineHeight: 1.4, marginTop: '12px' }}>
              These are descriptive overlaps under a 1% cell-area intersection rule. They are not detection accuracy.
            </small>
          </article>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginTop: '18px' }}>
        <article className="glass-panel" style={{ padding: '16px' }}>
          <ShieldCheck size={18} color="#34d399" />
          <strong style={{ display: 'block', marginTop: '8px' }}>What this supports</strong>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 0 }}>NASA activity and final-perimeter geography overlap in the 2020 annual comparison, supporting spatial context for the observed season.</p>
        </article>
        <article className="glass-panel" style={{ padding: '16px' }}>
          <AlertTriangle size={18} color="#fbbf24" />
          <strong style={{ display: 'block', marginTop: '8px' }}>What remains uncertain</strong>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 0 }}>The reference has no daily progression dates, incomplete coverage, and different measurement semantics. B1/B2 do not generate spatial perimeters.</p>
        </article>
      </div>

      {artifact && <p style={{ color: 'var(--text-dim)', fontSize: '0.74rem', marginTop: '18px' }}>
        Source: {artifact.reference.publisher} · {artifact.reference.dataset} · SHA-256 {artifact.reference.retrieval_sha256} ·
        <a href={artifact.reference.service_url} target="_blank" rel="noreferrer" style={{ marginLeft: '4px' }}>official service <ExternalLink size={12} /></a>
        {' '}· NASA artifact: {NASA_OBSERVATIONAL_ARTIFACT.artifactId}
      </p>}
    </section>
  );
};
