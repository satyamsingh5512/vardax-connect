import { useState } from 'react';
import { useDashboardStore } from '../store';
import { api } from '../api';
import type { RuleRecommendation, RuleStatus } from '../types';
import clsx from 'clsx';
import { format } from 'date-fns';

const statusColors: Record<RuleStatus, string> = {
  pending: 'bg-severity-medium/20 text-severity-medium border-severity-medium/30',
  approved: 'bg-severity-normal/20 text-severity-normal border-severity-normal/30',
  rejected: 'bg-vardax-muted/20 text-vardax-muted border-vardax-muted/30',
  rolled_back: 'bg-severity-high/20 text-severity-high border-severity-high/30',
};

export function RuleApproval() {
  const { pendingRules, setPendingRules, updateRuleStatus } = useDashboardStore();
  const [selectedRule, setSelectedRule] = useState<RuleRecommendation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
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
  
  return (
    <div className="flex h-full">
      {/* Rule List */}
      <div className={clsx(
        'flex-1 flex flex-col',
        selectedRule ? 'border-r border-vardax-border' : ''
      )}>
        {/* Header */}
        <div className="p-4 border-b border-vardax-border flex items-center justify-between">
          <div>
            <h2 className="font-medium text-white">Rule Recommendations</h2>
            <p className="text-sm text-vardax-muted">
              ML-generated rules require human approval before deployment
            </p>
          </div>
          <button
            onClick={handleGenerateRules}
            disabled={isGenerating}
            className="px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : 'Generate Rules'}
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-vardax-border">
          <TabButton label={`Pending (${pending.length})`} active count={pending.length} />
          <TabButton label={`Approved (${approved.length})`} count={approved.length} />
          <TabButton label={`Rejected (${rejected.length})`} count={rejected.length} />
        </div>
        
        {/* Rule Cards */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-vardax-muted">
              <div className="text-4xl mb-4">📋</div>
              <div>No pending rules</div>
              <div className="text-sm">Generate rules from recent anomalies</div>
            </div>
          ) : (
            pending.map((rule) => (
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

function TabButton({ label, active, count }: { label: string; active?: boolean; count: number }) {
  return (
    <button
      className={clsx(
        'px-4 py-2 text-sm border-b-2 transition-colors',
        active
          ? 'border-blue-500 text-blue-400'
          : 'border-transparent text-vardax-muted hover:text-white'
      )}
    >
      {label}
    </button>
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
  return (
    <div
      className={clsx(
        'bg-vardax-card rounded-lg border p-4 cursor-pointer transition-colors',
        isSelected ? 'border-blue-500' : 'border-vardax-border hover:border-vardax-muted'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={clsx(
              'px-2 py-0.5 text-xs rounded border',
              statusColors[rule.status]
            )}>
              {rule.status.toUpperCase()}
            </span>
            <span className="text-xs text-vardax-muted">
              {rule.rule_type.replace('_', ' ')}
            </span>
          </div>
          <h3 className="font-medium text-white">{rule.rule_description}</h3>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-white">
            {(rule.confidence * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-vardax-muted">confidence</div>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-sm">
        <div className="text-vardax-muted">
          Based on {rule.anomaly_count} anomalies
        </div>
        <div className="text-vardax-muted">
          Est. FP rate: {(rule.false_positive_estimate * 100).toFixed(1)}%
        </div>
      </div>
      
      {rule.status === 'pending' && (
        <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onApprove}
            className="flex-1 px-3 py-2 text-sm bg-severity-normal/20 text-severity-normal border border-severity-normal/30 rounded hover:bg-severity-normal/30"
          >
            ✓ Approve & Deploy
          </button>
          <button
            onClick={onReject}
            className="flex-1 px-3 py-2 text-sm bg-vardax-border text-vardax-muted border border-vardax-border rounded hover:bg-vardax-muted/20"
          >
            ✕ Reject
          </button>
        </div>
      )}
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
  return (
    <div className="w-[500px] flex flex-col bg-vardax-bg">
      {/* Header */}
      <div className="p-4 border-b border-vardax-border flex items-center justify-between">
        <h3 className="font-medium text-white">Rule Details</h3>
        <button
          onClick={onClose}
          className="text-vardax-muted hover:text-white"
        >
          ✕
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Status & Confidence */}
        <div className="flex items-center gap-3">
          <span className={clsx(
            'px-3 py-1 text-sm rounded border',
            statusColors[rule.status]
          )}>
            {rule.status.toUpperCase()}
          </span>
          <span className="text-sm text-vardax-muted">
            {(rule.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
        
        {/* Description */}
        <div>
          <h4 className="text-xs font-medium text-vardax-muted mb-1">Description</h4>
          <p className="text-sm text-vardax-text">{rule.rule_description}</p>
        </div>
        
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-vardax-muted">Rule Type</span>
            <div className="text-vardax-text">{rule.rule_type.replace('_', ' ')}</div>
          </div>
          <div>
            <span className="text-vardax-muted">Source Anomalies</span>
            <div className="text-vardax-text">{rule.anomaly_count}</div>
          </div>
          <div>
            <span className="text-vardax-muted">Est. False Positive Rate</span>
            <div className="text-vardax-text">{(rule.false_positive_estimate * 100).toFixed(1)}%</div>
          </div>
          <div>
            <span className="text-vardax-muted">Created</span>
            <div className="text-vardax-text">
              {format(new Date(rule.created_at), 'PPp')}
            </div>
          </div>
        </div>
        
        {/* Rule Content */}
        <div>
          <h4 className="text-xs font-medium text-vardax-muted mb-2">ModSecurity Rule</h4>
          <pre className="bg-vardax-card rounded-lg p-4 border border-vardax-border text-xs text-vardax-text overflow-x-auto">
            {rule.rule_content}
          </pre>
        </div>
        
        {/* Warning */}
        <div className="bg-severity-medium/10 border border-severity-medium/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <span className="text-severity-medium">⚠️</span>
            <div className="text-sm text-severity-medium">
              <strong>Review carefully before approving.</strong> This rule will be deployed to your WAF and may block legitimate traffic if the false positive estimate is incorrect.
            </div>
          </div>
        </div>
        
        {/* Actions */}
        {rule.status === 'pending' && (
          <div className="flex gap-2">
            <button
              onClick={onApprove}
              className="flex-1 px-4 py-2 bg-severity-normal text-white rounded hover:bg-severity-normal/80"
            >
              ✓ Approve & Deploy
            </button>
            <button
              onClick={onReject}
              className="flex-1 px-4 py-2 bg-vardax-border text-vardax-text rounded hover:bg-vardax-muted/20"
            >
              ✕ Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
