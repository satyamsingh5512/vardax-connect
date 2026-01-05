import { useState } from 'react';
import { useDashboardStore } from '../store';
import { api } from '../api';
import type { Anomaly, SeverityLevel } from '../types';
import { format } from 'date-fns';

export function AnomalyList() {
  const { anomalies } = useDashboardStore();
  const [filter, setFilter] = useState<SeverityLevel | 'all'>('all');
  const [detailAnomaly, setDetailAnomaly] = useState<Anomaly | null>(null);
  
  const filteredAnomalies = filter === 'all'
    ? anomalies
    : anomalies.filter(a => a.severity === filter);
  
  const handleRowClick = async (anomalyId: string) => {
    try {
      const detail = await api.getAnomalyDetail(anomalyId);
      setDetailAnomaly(detail);
    } catch (e) {
      console.error('Failed to load anomaly detail:', e);
    }
  };
  
  return (
    <div className="flex h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* Anomaly Table */}
      <div className={`flex-1 flex flex-col ${detailAnomaly ? 'border-r' : ''}`} style={{ borderColor: 'var(--border-primary)' }}>
        {/* Filters */}
        <div className="p-4 flex items-center gap-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Filter by severity:</span>
          <div className="filter-group">
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => {
              const colors = {
                all: { bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(168, 85, 247, 0.1))', border: '#3b82f6', glow: 'rgba(59, 130, 246, 0.3)' },
                critical: { bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.1))', border: '#ef4444', glow: 'rgba(239, 68, 68, 0.3)' },
                high: { bg: 'linear-gradient(135deg, rgba(255, 82, 82, 0.15), rgba(239, 68, 68, 0.1))', border: '#ff5252', glow: 'rgba(255, 82, 82, 0.3)' },
                medium: { bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(251, 191, 36, 0.1))', border: '#f59e0b', glow: 'rgba(245, 158, 11, 0.3)' },
                low: { bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.1))', border: '#10b981', glow: 'rgba(16, 185, 129, 0.3)' },
              };
              const isActive = filter === sev;
              return (
                <button
                  key={sev}
                  onClick={() => setFilter(sev)}
                  className={`filter-pill ${isActive ? 'active' : ''}`}
                  style={isActive ? {
                    background: colors[sev].bg,
                    borderColor: colors[sev].border,
                    color: colors[sev].border,
                    boxShadow: `0 0 15px ${colors[sev].glow}`,
                  } : undefined}
                >
                  {sev.charAt(0).toUpperCase() + sev.slice(1)}
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {filteredAnomalies.length} anomalies
          </span>
        </div>
        
        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Time</th>
                <th>Client IP</th>
                <th>URI</th>
                <th>Category</th>
                <th>Confidence</th>
                <th>Explanation</th>
              </tr>
            </thead>
            <tbody>
              {filteredAnomalies.map((anomaly) => (
                <tr
                  key={anomaly.anomaly_id}
                  onClick={() => handleRowClick(anomaly.anomaly_id)}
                  className={`cursor-pointer ${detailAnomaly?.anomaly_id === anomaly.anomaly_id ? 'selected' : ''} ${anomaly.severity === 'critical' || anomaly.severity === 'high' ? 'anomaly' : ''}`}
                >
                  <td>
                    <span className={`severity-badge ${anomaly.severity}`} style={{
                      boxShadow: anomaly.severity === 'critical' ? '0 0 15px rgba(239, 68, 68, 0.4)' :
                                 anomaly.severity === 'high' ? '0 0 15px rgba(255, 82, 82, 0.4)' :
                                 anomaly.severity === 'medium' ? '0 0 15px rgba(245, 158, 11, 0.4)' : 'none'
                    }}>
                      <span className={`severity-dot ${anomaly.severity} animate-pulse`} style={{
                        boxShadow: `0 0 10px currentColor`
                      }} />
                      {anomaly.severity.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {format(new Date(anomaly.timestamp), 'HH:mm:ss')}
                  </td>
                  <td className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {anomaly.client_ip}
                  </td>
                  <td className="max-w-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                    {anomaly.uri}
                  </td>
                  <td style={{ color: 'var(--text-tertiary)' }}>
                    {anomaly.attack_category?.replace('_', ' ') || '-'}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="progress-bar w-16">
                        <div
                          className={`progress-fill ${
                            anomaly.confidence > 0.8 ? 'red' :
                            anomaly.confidence > 0.5 ? 'yellow' : 'green'
                          }`}
                          style={{ width: `${anomaly.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {(anomaly.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="max-w-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                    {anomaly.top_explanation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredAnomalies.length === 0 && (
            <div className="empty-state h-64">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-text">No anomalies found</div>
            </div>
          )}
        </div>
      </div>
      
      {/* Detail Panel */}
      {detailAnomaly && (
        <AnomalyDetail
          anomaly={detailAnomaly}
          onClose={() => setDetailAnomaly(null)}
        />
      )}
    </div>
  );
}

function AnomalyDetail({ anomaly, onClose }: { anomaly: Anomaly; onClose: () => void }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  
  const handleFeedback = async (type: string) => {
    try {
      await api.submitFeedback(anomaly.anomaly_id, type);
      setFeedback(type);
    } catch (e) {
      console.error('Failed to submit feedback:', e);
    }
  };
  
  return (
    <div className="detail-panel animate-slide-in">
      {/* Header */}
      <div className="detail-header">
        <h3 className="detail-title">Anomaly Details</h3>
        <button onClick={onClose} className="detail-close">✕</button>
      </div>
      
      {/* Content */}
      <div className="detail-body space-y-4">
        {/* Severity Badge */}
        <div className="flex items-center gap-3">
          <span className={`severity-badge ${anomaly.severity}`}>
            <span className={`severity-dot ${anomaly.severity}`} />
            {anomaly.severity.toUpperCase()}
          </span>
          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {(anomaly.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
        
        {/* Basic Info */}
        <div className="detail-section">
          <h4 className="detail-section-title">Request Info</h4>
          <div className="space-y-2">
            <div className="detail-row">
              <span className="detail-label">Time</span>
              <span className="detail-value">{format(new Date(anomaly.timestamp), 'PPpp')}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Client IP</span>
              <span className="detail-value font-mono text-xs">{anomaly.client_ip}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Method</span>
              <span className="detail-value">{anomaly.method}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">URI</span>
              <span className="detail-value font-mono text-xs truncate max-w-[200px]">{anomaly.uri}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Category</span>
              <span className="detail-value">{anomaly.attack_category?.replace('_', ' ') || 'Unknown'}</span>
            </div>
          </div>
        </div>
        
        {/* Scores */}
        <div className="detail-section">
          <h4 className="detail-section-title">ML Scores</h4>
          <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
            <div className="card-body space-y-3">
              <ScoreBar label="Isolation Forest" value={anomaly.scores.isolation_forest} />
              <ScoreBar label="Autoencoder" value={anomaly.scores.autoencoder} />
              <ScoreBar label="EWMA Baseline" value={anomaly.scores.ewma} />
              <div className="pt-3 mt-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
                <ScoreBar label="Ensemble" value={anomaly.scores.ensemble} highlight />
              </div>
            </div>
          </div>
        </div>
        
        {/* Explanations */}
        <div className="detail-section">
          <h4 className="detail-section-title">Why This Is Anomalous</h4>
          <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
            <div className="card-body space-y-3">
              {anomaly.explanations.map((exp, i) => (
                <div key={i}>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{exp.description}</div>
                  {exp.deviation_percent !== 0 && (
                    <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      Value: {exp.feature_value.toFixed(2)} | Baseline: {exp.baseline_value.toFixed(2)} | 
                      Deviation: {exp.deviation_percent > 0 ? '+' : ''}{exp.deviation_percent.toFixed(0)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Feedback */}
        <div className="detail-section">
          <h4 className="detail-section-title">Analyst Feedback</h4>
          {feedback ? (
            <div className="text-sm" style={{ color: 'var(--accent-green)' }}>
              ✓ Feedback recorded: {feedback.replace('_', ' ')}
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => handleFeedback('true_positive')}
                className="btn btn-danger flex-1"
              >
                True Positive
              </button>
              <button
                onClick={() => handleFeedback('false_positive')}
                className="btn btn-success flex-1"
              >
                False Positive
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  const getColor = () => {
    if (highlight) return 'var(--accent-blue)';
    if (value > 0.7) return 'var(--accent-red)';
    if (value > 0.4) return 'var(--accent-yellow)';
    return 'var(--accent-green)';
  };
  
  return (
    <div className="score-bar">
      <span className="score-label">{label}</span>
      <div className="score-track">
        <div
          className="score-fill"
          style={{ 
            width: `${value * 100}%`,
            backgroundColor: getColor()
          }}
        />
      </div>
      <span 
        className="score-value"
        style={{ color: highlight ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}
      >
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}
