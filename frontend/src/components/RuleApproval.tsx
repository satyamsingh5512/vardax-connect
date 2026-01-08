import { useState } from 'react';
import { useDashboardStore } from '../store';
import { api } from '../api';
import type { RuleRecommendation, RuleStatus } from '../types';
import { format } from 'date-fns';

const statusConfig: Record<RuleStatus, { color: string; bg: string; border: string }> = {
  pending: {
    color: 'var(--status-warning)',
    bg: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.2)'
  },
  approved: {
    color: 'var(--status-success)',
    bg: 'rgba(16, 185, 129, 0.1)',
    border: 'rgba(16, 185, 129, 0.2)'
  },
  rejected: {
    color: 'var(--text-tertiary)',
    bg: 'rgba(148, 163, 184, 0.1)',
    border: 'rgba(148, 163, 184, 0.2)'
  },
  rolled_back: {
    color: 'var(--status-danger)',
    bg: 'rgba(239, 68, 68, 0.1)',
    border: 'rgba(239, 68, 68, 0.2)'
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
      if (selectedRule?.rule_id === ruleId) {
        setSelectedRule((prev: RuleRecommendation | null) => prev ? { ...prev, status: 'approved' } : null);
      }
    } catch (e) {
      console.error('Failed to approve rule:', e);
    }
  };

  const handleReject = async (ruleId: string) => {
    try {
      await api.approveRule(ruleId, 'reject');
      updateRuleStatus(ruleId, 'rejected');
      if (selectedRule?.rule_id === ruleId) {
        setSelectedRule((prev: RuleRecommendation | null) => prev ? { ...prev, status: 'rejected' } : null);
      }
    } catch (e) {
      console.error('Failed to reject rule:', e);
    }
  };

  const pending = pendingRules.filter(r => r.status === 'pending');
  const approved = pendingRules.filter(r => r.status === 'approved');
  const rejected = pendingRules.filter(r => r.status === 'rejected');

  const displayRules = activeTab === 'pending' ? pending : activeTab === 'approved' ? approved : rejected;

  return (
    <div className="flex h-full">
      {/* Rule List */}
      <div className={`flex-1 flex flex-col ${selectedRule ? 'border-r border-slate-800' : ''}`}>
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div>
            <h2 className="font-semibold text-lg text-white">Rule Recommendations</h2>
            <p className="text-sm text-slate-400 mt-1">
              ML-generated rules require human approval before deployment
            </p>
          </div>
          <button
            onClick={handleGenerateRules}
            disabled={isGenerating}
            className="btn btn-primary"
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <span className="spinner w-3 h-3 border-2" /> Generating...
              </span>
            ) : 'Generate Rules'}
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-800 bg-slate-900/30 px-6">
          <div className="nav-tabs p-0">
            <button
              className={`nav-tab ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              Pending
              {pending.length > 0 && (
                <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-xs ml-2 border border-amber-500/20">
                  {pending.length}
                </span>
              )}
            </button>
            <button
              className={`nav-tab ${activeTab === 'approved' ? 'active' : ''}`}
              onClick={() => setActiveTab('approved')}
            >
              Approved <span className="text-slate-500 ml-1">{approved.length}</span>
            </button>
            <button
              className={`nav-tab ${activeTab === 'rejected' ? 'active' : ''}`}
              onClick={() => setActiveTab('rejected')}
            >
              Rejected <span className="text-slate-500 ml-1">{rejected.length}</span>
            </button>
          </div>
        </div>

        {/* Rule Cards */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {displayRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-800 rounded-lg">
              <div className="text-4xl mb-4 opacity-20">📋</div>
              <div className="text-slate-500 font-medium">
                {activeTab === 'pending' ? 'No pending rules' : `No ${activeTab} rules`}
              </div>
              {activeTab === 'pending' && (
                <p className="text-sm text-slate-600 mt-2">
                  Generate rules from recent anomalies to see recommendations here
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
  const style = statusConfig[rule.status] || statusConfig.pending;

  return (
    <div
      className={`card cursor-pointer transition-all hover:border-slate-600 ${isSelected ? 'ring-1 ring-blue-500 border-blue-500' : ''
        }`}
      onClick={onSelect}
    >
      <div className="card-body p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 text-xs font-semibold rounded uppercase tracking-wider"
                style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
              >
                {rule.status}
              </span>
              <span className="text-xs font-mono text-slate-500 uppercase">
                {rule.rule_type.replace('_', ' ')}
              </span>
            </div>
            <h3 className="font-medium text-slate-100">{rule.rule_description}</h3>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-white">
              {(rule.confidence * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">confidence</div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-slate-400 mt-4 border-t border-slate-800 pt-3">
          <div>
            <span className="text-slate-500 mr-2">Anomalies Detected:</span>
            <span className="text-slate-300 font-mono">{rule.anomaly_count}</span>
          </div>
          <div>
            <span className="text-slate-500 mr-2">Est. False Positive:</span>
            <span className="text-slate-300 font-mono">{(rule.false_positive_estimate * 100).toFixed(1)}%</span>
          </div>
        </div>

        {rule.status === 'pending' && (
          <div className="flex gap-3 mt-4 pt-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onApprove}
              className="btn btn-primary btn-sm flex-1 bg-emerald-600 hover:bg-emerald-700 border-emerald-500"
            >
              Approve
            </button>
            <button
              onClick={onReject}
              className="btn btn-ghost btn-sm flex-1 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30"
            >
              Reject
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
  const style = statusConfig[rule.status];

  return (
    <div className="w-[500px] bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl animate-slide-in">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <h3 className="font-semibold text-white">Rule Details</h3>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">✕</button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Status & Confidence */}
        <div className="flex items-center justify-between">
          <span
            className="px-3 py-1 text-xs font-bold rounded uppercase tracking-wider"
            style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
          >
            {rule.status}
          </span>
          <span className="text-sm text-slate-400">
            Created {format(new Date(rule.created_at), 'MMM d, HH:mm')}
          </span>
        </div>

        {/* Description */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Description</h4>
          <p className="text-sm text-slate-300 leading-relaxed">{rule.rule_description}</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800/50 p-4 rounded border border-slate-800">
            <div className="text-xs text-slate-500 mb-1">Confidence Score</div>
            <div className="text-xl font-bold text-white">{(rule.confidence * 100).toFixed(1)}%</div>
          </div>
          <div className="bg-slate-800/50 p-4 rounded border border-slate-800">
            <div className="text-xs text-slate-500 mb-1">False Positive Est.</div>
            <div className={`text-xl font-bold ${rule.false_positive_estimate > 0.05 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {(rule.false_positive_estimate * 100).toFixed(2)}%
            </div>
          </div>
          <div className="bg-slate-800/50 p-4 rounded border border-slate-800">
            <div className="text-xs text-slate-500 mb-1">Source Anomalies</div>
            <div className="text-xl font-bold text-white">{rule.anomaly_count}</div>
          </div>
          <div className="bg-slate-800/50 p-4 rounded border border-slate-800">
            <div className="text-xs text-slate-500 mb-1">Attack Type</div>
            <div className="text-xl font-bold text-white capitalize">{rule.rule_type.replace('_', ' ')}</div>
          </div>
        </div>

        {/* Rule Content */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Generated SecRule</h4>
          <pre className="p-4 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-400 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed shadow-inner">
            {rule.rule_content}
          </pre>
        </div>

        {/* Warning */}
        <div className="p-4 rounded bg-amber-900/10 border border-amber-900/20 flex gap-3">
          <span className="text-amber-500 text-xl">⚠️</span>
          <div className="text-xs text-amber-200/80 leading-relaxed">
            <strong className="text-amber-500 block mb-1">Verification Required</strong>
            This rule was automatically generated based on pattern matching. Review the regex pattern carefully before approving to prevent legitimate traffic blocking.
          </div>
        </div>
      </div>

      {/* Actions */}
      {rule.status === 'pending' && (
        <div className="p-6 border-t border-slate-800 flex gap-4 bg-slate-900">
          <button onClick={onApprove} className="btn btn-primary flex-1 bg-emerald-600 hover:bg-emerald-700 border-none py-3">
            Approve & Deploy
          </button>
          <button onClick={onReject} className="btn btn-ghost flex-1 hover:bg-slate-800 py-3">
            Reject Rule
          </button>
        </div>
      )}
    </div>
  );
}
