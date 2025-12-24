import { useState } from 'react';
import { useDashboardStore } from '../store';
import { api } from '../api';
import type { Anomaly, SeverityLevel } from '../types';
import clsx from 'clsx';
import { format } from 'date-fns';

const severityColors: Record<SeverityLevel, string> = {
  low: 'bg-severity-low',
  medium: 'bg-severity-medium',
  high: 'bg-severity-high',
  critical: 'bg-severity-critical',
};

const severityBadgeColors: Record<SeverityLevel, string> = {
  low: 'bg-severity-low/20 text-severity-low border-severity-low/30',
  medium: 'bg-severity-medium/20 text-severity-medium border-severity-medium/30',
  high: 'bg-severity-high/20 text-severity-high border-severity-high/30',
  critical: 'bg-severity-critical/20 text-severity-critical border-severity-critical/30',
};

export function AnomalyList() {
  const { anomalies, selectedAnomaly, setSelectedAnomaly } = useDashboardStore();
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
    <div className="flex h-full">
      {/* Anomaly Table */}
      <div className={clsx(
        'flex-1 flex flex-col',
        detailAnomaly ? 'border-r border-vardax-border' : ''
      )}>
        {/* Filters */}
        <div className="p-4 border-b border-vardax-border flex items-center gap-4">
          <span className="text-sm text-vardax-muted">Filter by severity:</span>
          <div className="flex gap-2">
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setFilter(sev)}
                className={clsx(
                  'px-3 py-1 text-xs rounded-full border transition-colors',
                  filter === sev
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    : 'bg-vardax-card text-vardax-muted border-vardax-border hover:border-vardax-muted'
                )}
              >
                {sev.charAt(0).toUpperCase() + sev.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <span className="text-sm text-vardax-muted">
            {filteredAnomalies.length} anomalies
          </span>
        </div>
        
        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-vardax-card sticky top-0">
              <tr className="text-left text-xs text-vardax-muted">
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Client IP</th>
                <th className="px-4 py-3 font-medium">URI</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium">Explanation</th>
              </tr>
            </thead>
            <tbody>
              {filteredAnomalies.map((anomaly) => (
                <tr
                  key={anomaly.anomaly_id}
                  onClick={() => handleRowClick(anomaly.anomaly_id)}
                  className={clsx(
                    'border-b border-vardax-border cursor-pointer transition-colors',
                    detailAnomaly?.anomaly_id === anomaly.anomaly_id
                      ? 'bg-blue-500/10'
                      : 'hover:bg-vardax-card'
                  )}
                >
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'px-2 py-1 text-xs rounded border',
                      severityBadgeColors[anomaly.severity]
                    )}>
                      {anomaly.severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-vardax-text">
                    {format(new Date(anomaly.timestamp), 'HH:mm:ss')}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-vardax-text">
                    {anomaly.client_ip}
                  </td>
                  <td className="px-4 py-3 text-sm text-vardax-text max-w-xs truncate">
                    {anomaly.uri}
                  </td>
                  <td className="px-4 py-3 text-sm text-vardax-muted">
                    {anomaly.attack_category?.replace('_', ' ') || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-vardax-border rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            'h-full rounded-full',
                            anomaly.confidence > 0.8 ? 'bg-severity-high' :
                            anomaly.confidence > 0.5 ? 'bg-severity-medium' : 'bg-severity-low'
                          )}
                          style={{ width: `${anomaly.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-vardax-muted">
                        {(anomaly.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-vardax-muted max-w-xs truncate">
                    {anomaly.top_explanation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredAnomalies.length === 0 && (
            <div className="flex items-center justify-center h-64 text-vardax-muted">
              No anomalies found
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
    <div className="w-96 flex flex-col bg-vardax-bg">
      {/* Header */}
      <div className="p-4 border-b border-vardax-border flex items-center justify-between">
        <h3 className="font-medium text-white">Anomaly Details</h3>
        <button
          onClick={onClose}
          className="text-vardax-muted hover:text-white"
        >
          ✕
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Severity Badge */}
        <div className="flex items-center gap-3">
          <span className={clsx(
            'px-3 py-1 text-sm rounded border',
            severityBadgeColors[anomaly.severity]
          )}>
            {anomaly.severity.toUpperCase()}
          </span>
          <span className="text-sm text-vardax-muted">
            {(anomaly.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
        
        {/* Basic Info */}
        <div className="space-y-2">
          <InfoRow label="Time" value={format(new Date(anomaly.timestamp), 'PPpp')} />
          <InfoRow label="Client IP" value={anomaly.client_ip} mono />
          <InfoRow label="Method" value={anomaly.method} />
          <InfoRow label="URI" value={anomaly.uri} mono />
          <InfoRow label="Category" value={anomaly.attack_category?.replace('_', ' ') || 'Unknown'} />
        </div>
        
        {/* Scores */}
        <div className="bg-vardax-card rounded-lg p-3 border border-vardax-border">
          <h4 className="text-xs font-medium text-vardax-muted mb-3">ML Scores</h4>
          <div className="space-y-2">
            <ScoreBar label="Isolation Forest" value={anomaly.scores.isolation_forest} />
            <ScoreBar label="Autoencoder" value={anomaly.scores.autoencoder} />
            <ScoreBar label="EWMA Baseline" value={anomaly.scores.ewma} />
            <div className="pt-2 border-t border-vardax-border">
              <ScoreBar label="Ensemble" value={anomaly.scores.ensemble} highlight />
            </div>
          </div>
        </div>
        
        {/* Explanations */}
        <div className="bg-vardax-card rounded-lg p-3 border border-vardax-border">
          <h4 className="text-xs font-medium text-vardax-muted mb-3">Why This Is Anomalous</h4>
          <div className="space-y-2">
            {anomaly.explanations.map((exp, i) => (
              <div key={i} className="text-sm">
                <div className="text-vardax-text">{exp.description}</div>
                {exp.deviation_percent !== 0 && (
                  <div className="text-xs text-vardax-muted mt-1">
                    Value: {exp.feature_value.toFixed(2)} | Baseline: {exp.baseline_value.toFixed(2)} | 
                    Deviation: {exp.deviation_percent > 0 ? '+' : ''}{exp.deviation_percent.toFixed(0)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Feedback */}
        <div className="bg-vardax-card rounded-lg p-3 border border-vardax-border">
          <h4 className="text-xs font-medium text-vardax-muted mb-3">Analyst Feedback</h4>
          {feedback ? (
            <div className="text-sm text-severity-normal">
              ✓ Feedback recorded: {feedback.replace('_', ' ')}
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => handleFeedback('true_positive')}
                className="flex-1 px-3 py-2 text-xs bg-severity-high/20 text-severity-high border border-severity-high/30 rounded hover:bg-severity-high/30"
              >
                True Positive
              </button>
              <button
                onClick={() => handleFeedback('false_positive')}
                className="flex-1 px-3 py-2 text-xs bg-severity-normal/20 text-severity-normal border border-severity-normal/30 rounded hover:bg-severity-normal/30"
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

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-vardax-muted">{label}</span>
      <span className={clsx('text-vardax-text', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}

function ScoreBar({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-vardax-muted w-28">{label}</span>
      <div className="flex-1 h-1.5 bg-vardax-border rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full',
            highlight ? 'bg-blue-500' :
            value > 0.7 ? 'bg-severity-high' :
            value > 0.4 ? 'bg-severity-medium' : 'bg-severity-low'
          )}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span className={clsx(
        'text-xs w-10 text-right',
        highlight ? 'text-blue-400 font-medium' : 'text-vardax-muted'
      )}>
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}
