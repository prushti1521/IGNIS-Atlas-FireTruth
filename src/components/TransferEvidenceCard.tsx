import React, { useEffect, useState } from 'react';
import { loadCrossRegionTransfer, type CrossRegionTransferArtifact } from '../data/crossRegionTransfer';

export const TransferEvidenceCard: React.FC = () => {
  const [artifact, setArtifact] = useState<CrossRegionTransferArtifact | null>(null);

  useEffect(() => {
    loadCrossRegionTransfer().then(setArtifact).catch(error => {
      console.error('Failed to load transfer evidence summary:', error);
    });
  }, []);

  if (!artifact) return null;
  const zeroShot = artifact.zero_shot_transfer.models;
  const local = artifact.local_calibration_benchmark.models;

  return (
    <div className="glass-panel" style={{ padding: '16px', marginBottom: '18px', borderColor: 'rgba(6, 182, 212, 0.35)' }}>
      <strong style={{ color: '#67e8f9' }}>Phase 3 cross-region evidence:</strong>{' '}
      California parameters were frozen before applying them to {artifact.study_region}. The local benchmark used training months only ({artifact.evaluation.training_period.join('–')}); the {artifact.evaluation.holdout_period.join('–')} holdout was evaluation-only.
      <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <span>Zero-shot B2 RMSE: <strong>{zeroShot.b2.rmse.toFixed(2)}</strong></span>
        <span>Local B2 RMSE: <strong>{local.b2.rmse.toFixed(2)}</strong></span>
        <span>VIIRS role: <strong>comparison sensor, not ground truth</strong></span>
      </div>
    </div>
  );
};
