import { useState } from 'react';
import { useDashboardStore } from '../store';
import { api } from '../api';
import type { RuleRecommendation, RuleStatus } from '../types';
import { format } from 'date-fns';

const statusStyles: Record<RuleStatus, { bg: string; color: string; border: string; glow: string }> = {
  pending: { 
    bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(251, 191, 36, 0.1))', 
    color: '#f59e0b', 
    border: '#f59e0b',
    glow: '0 0 15px rgba(245, 158, 11, 0.3)'
  },
  approved: { 
    bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.1))', 
    color: '#10b981', 
    border: '#10b981',
    glow: '0 0 15px rgba(16, 185, 129, 0.3)'
  },
  rejected: { 
    bg: 'linear-gradient(135deg, rgba(107, 114, 128, 0.15), rgba(75, 85, 99, 0.1))', 
    color: '#6b7280', 
    border: '#6b7280',
    glow: '0 0 10px rgba(107, 114, 128, 0.2)'
  },
  rolled_back: { 
    bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.1))', 
    color: '#ef4444', 
    border: '#ef4444',
    glow: '0 0 15px rgba(239, 68, 68, 0.3)'
  },
};

export function RuleApproval() {
  const { pendingRules, setPendingRules, updateRuleStatus } = useDashboardStore();
  const [selectedRule, setSelectedRule] = useState<RuleRecommendation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  
  const handleGenerateRules = async () => {
    setIsGenerating(true);
    try {
      const newRules = await api.generateRules();
      setPendingRules([...newRules, ...pendingRules]);
    } catch (e) {
      console.error('Failed to generate rules:', e);
    }
    setIsGenerating(false);
  };
  
  const handleApprove = async (ruleId: string) => {
    try {
      await api.approveRule(ruleId, 'approve');
      updateRuleStatus(ruleId, 'approved');
    } catch (e) {
      console.error('Failed to approve rule:', e);
    }
  };
  
  const handleReject = async (ruleId: string) => {
    try {
      await api.approveRule(ruleId, 'reject');
      updateRuleStatus(ruleId, 'rejected');
    } catch (e) {
      console.error('Failed to reject rule:', e);
    }
  };
  
  const pending = pendingRules.filter(r => r.status === 'pending');
  const approved = pendingRules.filter(r => r.status === 'approved');
  const rejected = pendingRules.filter(r => r.status === 'rejected');
  
  const displayRules = activeTab === 'pending' ? pending : activeTab === 'approved' ? approved : rejected;
  
  return (
    <div className="flex h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* Rule List */}
      <div 
        className={`flex-1 flex flex-col ${selectedRule ? 'border-r' : ''}`}
        style={{ borderColor: 'var(--border-primary)' }}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Rule Recommendations</h2>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              ML-generated rules require human approval before deployment
            </p>
          </div>
          <button
            onClick={handleGenerateRules}
            disabled={isGenerating}
            className="btn btn-primary"
          >
            {isGenerating ? 'Generating...' : 'Generate Rules'}
          </button>
        </div>
        
        {/* Tabs */}
        <div className="dashboard-nav" style={{ padding: '0 16px' }}>
          <div className="nav-tabs">
            <button 
              className={`nav-tab ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              Pending
              {pending.length > 0 && <span className="nav-badge">{pending.length}</span>}
            </button>
            <button 
              className={`nav-tab ${activeTab === 'approved' ? 'active' : ''}`}
              onClick={() => setActiveTab('approved')}
            >
              Approved ({approved.length})
            </button>
            <button 
              className={`nav-tab ${activeTab === 'rejected' ? 'active' : ''}`}
              onClick={() => setActiveTab('rejected')}
            >
              Rejected ({rejected.length})
            </button>
          </div>
        </div>
        
        {/* Rule Cards */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {displayRules.length === 0 ? (
            <div className="empty-state h-64">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-text">
                {activeTab === 'pending' ? 'No pending rules' : `No ${activeTab} rules`}
              </div>
              {activeTab === 'pending' && (
                <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
                  Generate rules from recent anomalies
                </p>
              )}
            </div>
          ) : (
            displayRules.map((rule) => (
              <RuleCard
                key={rule.rule_id}
                rule={rule}
                onSelect={() => setSelectedRule(rule)}
                onApprove={() => handleApprove(rule.rule_id)}
                onReject={() => handleReject(rule.rule_id)}
                isSelected={selectedRule?.rule_id === rule.rule_id}
              />
            ))
          )}
        </div>
      </div>
      
      {/* Detail Panel */}
      {selectedRule && (
        <RuleDetail
          rule={selectedRule}
          onClose={() => setSelectedRule(null)}
          onApprove={() => handleApprove(selectedRule.rule_id)}
          onReject={() => handleReject(selectedRule.rule_id)}
        />
      )}
    </div>
  );
}

function RuleCard({
  rule,
  onSelect,
  onApprove,
  onReject,
  isSelected,
}: {
  rule: RuleRecommendation;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  isSelected: boolean;
}) {
  const style = statusStyles[rule.status];
  
  return (
    <div
      className="card cursor-pointer transition-all"
      style={{ 
        borderColor: isSelected ? 'var(--accent-blue)' : 'var(--border-primary)',
        boxShadow: isSelected ? 'var(--shadow-glow-blue)' : 'none'
      }}
      onClick={onSelect}
    >
      <div className="card-body">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span 
                className="px-2 py-0.5 text-xs rounded"
                style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
              >
                {rule.status.toUpperCase()}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {rule.rule_type.replace('_', ' ')}
              </span>
            </div>
            <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>{rule.rule_description}</h3>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {(rule.confidence * 100).toFixed(0)}%
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>confidence</div>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-tertiary)' }}>
          <div>Based on {rule.anomaly_count} anomalies</div>
          <div>Est. FP rate: {(rule.false_positive_estimate * 100).toFixed(1)}%</div>
        </div>
        
        {rule.status === 'pending' && (
          <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={onApprove} className="btn btn-success flex-1 btn-sm">
              ✓ Approve & Deploy
            </button>
            <button onClick={onReject} className="btn btn-ghost flex-1 btn-sm">
              ✕ Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RuleDetail({
  rule,
  onClose,
  onApprove,
  onReject,
}: {
  rule: RuleRecommendation;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const style = statusStyles[rule.status];
  
  return (
    <div className="detail-panel animate-slide-in" style={{ width: '500px' }}>
      {/* Header */}
      <div className="detail-header">
        <h3 className="detail-title">Rule Details</h3>
        <button onClick={onClose} className="detail-close">✕</button>
      </div>
      
      {/* Content */}
      <div className="detail-body space-y-4">
        {/* Status & Confidence */}
        <div className="flex items-center gap-3">
          <span 
            className="px-3 py-1 text-sm rounded"
            style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
          >
            {rule.status.toUpperCase()}
          </span>
          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {(rule.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
        
        {/* Description */}
        <div className="detail-section">
          <h4 className="detail-section-title">Description</h4>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{rule.rule_description}</p>
        </div>
        
        {/* Metadata */}
        <div className="detail-section">
          <h4 className="detail-section-title">Metadata</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Rule Type</div>
              <div style={{ color: 'var(--text-secondary)' }}>{rule.rule_type.replace('_', ' ')}</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Source Anomalies</div>
              <div style={{ color: 'var(--text-secondary)' }}>{rule.anomaly_count}</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Est. False Positive Rate</div>
              <div style={{ color: 'var(--text-secondary)' }}>{(rule.false_positive_estimate * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Created</div>
              <div style={{ color: 'var(--text-secondary)' }}>{format(new Date(rule.created_at), 'PPp')}</div>
            </div>
          </div>
        </div>
        
        {/* Rule Content */}
        <div className="detail-section">
          <h4 className="detail-section-title">ModSecurity Rule</h4>
          <pre 
            className="p-4 rounded-lg text-xs overflow-x-auto font-mono"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--accent-cyan)', border: '1px solid var(--border-primary)' }}
          >
            {rule.rule_content}
          </pre>
        </div>
        
        {/* Warning */}
        <div 
          className="p-3 rounded-lg"
          style={{ 
            background: 'rgba(255, 165, 2, 0.1)',
            border: '1px solid rgba(255, 165, 2, 0.3)'
          }}
        >
          <div className="flex items-start gap-2">
            <span style={{ color: 'var(--accent-yellow)' }}>⚠️</span>
            <div className="text-sm" style={{ color: 'var(--accent-yellow)' }}>
              <strong>Review carefully before approving.</strong> This rule will be deployed to your WAF and may block legitimate traffic.
            </div>
          </div>
        </div>
        
        {/* Actions */}
        {rule.status === 'pending' && (
          <div className="flex gap-2">
            <button onClick={onApprove} className="btn btn-success flex-1">
              ✓ Approve & Deploy
            </button>
            <button onClick={onReject} className="btn btn-ghost flex-1">
              ✕ Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
