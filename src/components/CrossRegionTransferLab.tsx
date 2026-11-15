import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, BarChart3, Database, MapPinned, ShieldCheck } from 'lucide-react';
import { loadCrossRegionTransfer, type CrossRegionTransferArtifact, type TransferModelMetrics } from '../data/crossRegionTransfer';

const formatMetric = (value: number) => value.toFixed(2);

const MetricRow: React.FC<{ label: string; metrics: TransferModelMetrics }> = ({ label, metrics }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, minmax(70px, 0.6fr))', gap: '8px', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
    <strong>{label}</strong>
    <span className="mono">{formatMetric(metrics.mae)}</span>
    <span className="mono">{formatMetric(metrics.rmse)}</span>
    <span className="mono">{formatMetric(metrics.bias)}</span>
  </div>
);

export const CrossRegionTransferLab: React.FC = () => {
  const [artifact, setArtifact] = useState<CrossRegionTransferArtifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllMonths, setShowAllMonths] = useState(false);

  useEffect(() => {
    loadCrossRegionTransfer().then(setArtifact).catch(err => {
      console.error('Failed to load cross-region transfer artifact:', err);
      setError(err instanceof Error ? err.message : 'Transfer artifact could not be loaded.');
    });
  }, []);

  const chartRows = useMemo(
    () => artifact?.zero_shot_transfer.monthly_residuals.slice(showAllMonths ? 0 : -18) ?? [],
    [artifact, showAllMonths]
  );

  if (error) {
    return <div style={{ padding: '24px' }}><div className="glass-panel" style={{ padding: '20px', borderColor: 'var(--accent-crimson)' }}><strong>Transfer artifact unavailable:</strong> {error}</div></div>;
  }
  if (!artifact) {
    return <div style={{ padding: '24px' }}><div className="glass-panel" style={{ padding: '20px' }}>Loading authentic cross-region transfer artifact…</div></div>;
  }

  const zeroShot = artifact.zero_shot_transfer.models;
  const local = artifact.local_calibration_benchmark.models;
  const maxError = Math.max(...chartRows.map(row => Math.max(Math.abs(row.b0_error), Math.abs(row.b1_error), Math.abs(row.b2_error)), 1));

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
          <MapPinned size={24} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem' }}>Cross-Region Transfer Lab</h2>
          <span className="badge badge-cyan">Authentic NASA FIRMS</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '5px' }}>
          Frozen California calibration transferred to the fixed Oregon/Washington acquisition boundary, then compared with a destination-local training-only benchmark.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '16px', marginBottom: '18px', borderColor: 'rgba(245, 158, 11, 0.45)' }}>
        <strong style={{ color: '#fbbf24' }}>Interpretation guard:</strong> VIIRS is the comparison sensor, not ground truth. These are MODIS–VIIRS agreement metrics, not fire-detection accuracy or burned-area validation.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        {[
          ['Study boundary', artifact.boundary.definition],
          ['Products', `${artifact.source_products.modis} + ${artifact.source_products.viirs}`],
          ['Training / holdout', `${artifact.evaluation.training_period.join(' – ')} / ${artifact.evaluation.holdout_period.join(' – ')}`],
          ['Coverage', `${artifact.evaluation.complete_overlap_months} months · ${artifact.zero_shot_transfer.holdout_months} holdout`]
        ].map(([label, value]) => <div key={label} className="glass-panel" style={{ padding: '14px' }}><div style={{ color: 'var(--text-dim)', fontSize: '0.7rem', textTransform: 'uppercase' }}>{label}</div><strong style={{ fontSize: '0.84rem' }}>{value}</strong></div>)}
      </div>

      <div className="glass-panel" style={{ padding: '18px', marginBottom: '18px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}><BarChart3 size={18} color="var(--accent-cyan)" /> Holdout agreement metrics</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, minmax(70px, 0.6fr))', gap: '8px', color: 'var(--text-dim)', fontSize: '0.7rem', textTransform: 'uppercase' }}><span>Model</span><span>MAE</span><span>RMSE</span><span>Bias</span></div>
        <MetricRow label="B0 raw" metrics={zeroShot.b0} />
        <MetricRow label="B1 California zero-shot" metrics={zeroShot.b1} />
        <MetricRow label="B2 California zero-shot" metrics={zeroShot.b2} />
        <MetricRow label="B1 destination-local" metrics={local.b1} />
        <MetricRow label="B2 destination-local" metrics={local.b2} />
      </div>

      <div className="glass-panel" style={{ padding: '18px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <h3><ArrowRight size={18} color="var(--accent-fire)" /> Monthly zero-shot residuals</h3>
          <button className="btn-secondary" onClick={() => setShowAllMonths(value => !value)}>{showAllMonths ? 'Show recent 18' : 'Show all 30 holdout months'}</button>
        </div>
        <div style={{ display: 'grid', gap: '7px', marginTop: '14px' }}>
          {chartRows.map(row => <div key={`${row.year}-${row.month}`} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: '8px', alignItems: 'center', fontSize: '0.72rem' }}>
            <span className="mono">{row.year}-{String(row.month).padStart(2, '0')}</span>
            <div style={{ display: 'flex', gap: '3px', height: '16px' }} title={`B0 ${formatMetric(row.b0_error)} · B1 ${formatMetric(row.b1_error)} · B2 ${formatMetric(row.b2_error)}`}>
              {[row.b0_error, row.b1_error, row.b2_error].map((value, index) => <span key={index} style={{ flex: Math.max(Math.abs(value) / maxError, 0.015), background: ['#64748b', '#38bdf8', '#fb923c'][index], opacity: value < 0 ? 0.55 : 1, borderRadius: '2px' }} />)}
            </div>
          </div>)}
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginTop: '10px' }}>Bars show absolute residual magnitude; opacity indicates negative signed error. Hover a row for exact B0/B1/B2 residuals.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px' }}>
        <div className="glass-panel" style={{ padding: '18px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={18} color="var(--accent-amber)" /> Five largest zero-shot B2 failures</h3>
          {artifact.failure_analysis.largest_absolute_error_months.map(failure => <div key={String(failure.period)} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.78rem' }}><strong>{failure.period}</strong> · B2 error <span className="mono">{Number(failure.zero_shot_b2_error).toFixed(1)}</span><div style={{ color: 'var(--text-dim)' }}>{failure.reason}</div></div>)}
        </div>
        <div className="glass-panel" style={{ padding: '18px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldCheck size={18} color="var(--accent-emerald)" /> Parameter provenance</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px' }}>California B1 α = <strong>{artifact.frozen_california_models.b1_alpha.toFixed(4)}</strong>. Destination-local B1 α = <strong>{artifact.local_training_models.b1_alpha.toFixed(4)}</strong>.</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Local fitting used {artifact.evaluation.training_rows_used_for_local_fit} training months; {artifact.evaluation.holdout_rows_excluded_from_local_fit} later months were excluded from fitting.</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>The largest local B2 error contributes {((artifact.failure_analysis.local_b2_largest_month_absolute_error_share) * 100).toFixed(1)}% of total absolute holdout error.</p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '18px', marginTop: '18px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Database size={18} color="var(--accent-cyan)" /> Reproducibility and limitations</h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>Raw rows: MODIS {artifact.provenance.modis_raw_rows_in_period.toLocaleString()} · VIIRS {artifact.provenance.viirs_raw_rows_in_period.toLocaleString()}. Grid: {artifact.provenance.grid}. Confidence: {artifact.provenance.confidence_policy}.</p>
        <ul style={{ margin: '10px 0 0 18px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{artifact.limitations.map(limitation => <li key={limitation}>{limitation}</li>)}</ul>
      </div>
    </div>
  );
};
