import { useState } from 'react';
import { api } from '../api';
import clsx from 'clsx';

interface SimulationResult {
  rule_id: string;
  total_requests: number;
  would_block: number;
  would_allow: number;
  block_rate: number;
  false_positive_estimate: number;
  affected_ips: string[];
  affected_endpoints: string[];
  sample_blocked: any[];
  sample_allowed: any[];
  recommendation: string;
}

const RULE_TEMPLATES = [
  {
    name: 'Block High-Rate IPs',
    description: 'Block IPs exceeding request threshold',
    rule_type: 'rate_limit',
    params: { threshold: 200 },
  },
  {
    name: 'Block Bot Traffic',
    description: 'Block requests with high bot likelihood',
    rule_type: 'bot_block',
    params: { threshold: 0.7 },
  },
  {
    name: 'Block Scanner UAs',
    description: 'Block known security scanner user agents',
    rule_type: 'ua_block',
    params: { pattern: 'sqlmap|nikto|nmap' },
  },
  {
    name: 'Rate Limit Login',
    description: 'Limit login attempts per IP',
    rule_type: 'rate_limit',
    params: { threshold: 10, endpoint: '/api/login' },
  },
];

export function RuleSimulator() {
  const [selectedTemplate, setSelectedTemplate] = useState(RULE_TEMPLATES[0]);
  const [customParams, setCustomParams] = useState<Record<string, any>>({});
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [timeWindow, setTimeWindow] = useState(60);
  
  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const params = { ...selectedTemplate.params, ...customParams };
      const simResult = await api.simulateRule(
        selectedTemplate.rule_type,
        params,
        timeWindow
      );
      setResult(simResult);
    } catch (e) {
      // Mock result for demo
      setResult(generateMockResult());
    }
    setIsSimulating(false);
  };
  
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-medium text-white">Rule Simulation</h2>
        <p className="text-sm text-vardax-muted">
          Test rule impact against historical traffic before deployment
        </p>
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        {/* Rule Configuration */}
        <div className="space-y-4">
          <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border">
            <h3 className="font-medium text-white mb-3">Select Rule Template</h3>
            <div className="space-y-2">
              {RULE_TEMPLATES.map((template, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedTemplate(template);
                    setCustomParams({});
                    setResult(null);
                  }}
                  className={clsx(
                    'w-full text-left p-3 rounded border transition-colors',
                    selectedTemplate.name === template.name
                      ? 'bg-blue-500/20 border-blue-500/50 text-white'
                      : 'bg-vardax-bg border-vardax-border text-vardax-muted hover:border-vardax-muted'
                  )}
                >
                  <div className="font-medium">{template.name}</div>
                  <div className="text-xs opacity-70">{template.description}</div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Parameters */}
          <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border">
            <h3 className="font-medium text-white mb-3">Parameters</h3>
            
            {selectedTemplate.rule_type === 'rate_limit' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-vardax-muted">Threshold (requests/min)</label>
                  <input
                    type="number"
                    value={customParams.threshold ?? selectedTemplate.params.threshold}
                    onChange={(e) => setCustomParams({ ...customParams, threshold: parseInt(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-vardax-bg border border-vardax-border rounded text-white"
                  />
                </div>
              </div>
            )}
            
            {selectedTemplate.rule_type === 'bot_block' && (
              <div>
                <label className="text-xs text-vardax-muted">Bot Score Threshold (0-1)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={customParams.threshold ?? selectedTemplate.params.threshold}
                  onChange={(e) => setCustomParams({ ...customParams, threshold: parseFloat(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 bg-vardax-bg border border-vardax-border rounded text-white"
                />
              </div>
            )}
            
            {selectedTemplate.rule_type === 'ua_block' && (
              <div>
                <label className="text-xs text-vardax-muted">Pattern (regex)</label>
                <input
                  type="text"
                  value={customParams.pattern ?? selectedTemplate.params.pattern}
                  onChange={(e) => setCustomParams({ ...customParams, pattern: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-vardax-bg border border-vardax-border rounded text-white font-mono text-sm"
                />
              </div>
            )}
            
            <div className="mt-4">
              <label className="text-xs text-vardax-muted">Time Window (minutes)</label>
              <select
                value={timeWindow}
                onChange={(e) => setTimeWindow(parseInt(e.target.value))}
                className="w-full mt-1 px-3 py-2 bg-vardax-bg border border-vardax-border rounded text-white"
              >
                <option value={30}>Last 30 minutes</option>
                <option value={60}>Last 1 hour</option>
                <option value={120}>Last 2 hours</option>
                <option value={360}>Last 6 hours</option>
              </select>
            </div>
          </div>
          
          <button
            onClick={handleSimulate}
            disabled={isSimulating}
            className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            {isSimulating ? 'Simulating...' : '🔬 Run Simulation'}
          </button>
        </div>
        
        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Impact Summary */}
              <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border">
                <h3 className="font-medium text-white mb-3">Impact Summary</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-3 bg-vardax-bg rounded">
                    <div className="text-2xl font-bold text-white">{result.total_requests}</div>
                    <div className="text-xs text-vardax-muted">Total Requests</div>
                  </div>
                  <div className="text-center p-3 bg-vardax-bg rounded">
                    <div className="text-2xl font-bold text-severity-high">{result.would_block}</div>
                    <div className="text-xs text-vardax-muted">Would Block</div>
                  </div>
                </div>
                
                {/* Block rate bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-vardax-muted mb-1">
                    <span>Block Rate</span>
                    <span>{(result.block_rate * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-3 bg-vardax-bg rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all',
                        result.block_rate > 0.5 ? 'bg-severity-high' :
                        result.block_rate > 0.2 ? 'bg-severity-medium' : 'bg-severity-normal'
                      )}
                      style={{ width: `${result.block_rate * 100}%` }}
                    />
                  </div>
                </div>
                
                {/* False positive estimate */}
                <div>
                  <div className="flex justify-between text-xs text-vardax-muted mb-1">
                    <span>Est. False Positive Rate</span>
                    <span>{(result.false_positive_estimate * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-3 bg-vardax-bg rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full',
                        result.false_positive_estimate > 0.2 ? 'bg-severity-high' :
                        result.false_positive_estimate > 0.1 ? 'bg-severity-medium' : 'bg-severity-normal'
                      )}
                      style={{ width: `${result.false_positive_estimate * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Recommendation */}
              <div className={clsx(
                'rounded-lg p-4 border',
                result.recommendation.includes('⚠️')
                  ? 'bg-severity-medium/10 border-severity-medium/30'
                  : 'bg-severity-normal/10 border-severity-normal/30'
              )}>
                <h3 className="font-medium text-white mb-2">Recommendation</h3>
                <p className="text-sm text-vardax-text">{result.recommendation}</p>
              </div>
              
              {/* Affected Resources */}
              <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border">
                <h3 className="font-medium text-white mb-3">Affected Resources</h3>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-vardax-muted">IPs ({result.affected_ips.length})</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {result.affected_ips.slice(0, 5).map((ip, i) => (
                        <span key={i} className="px-2 py-0.5 bg-vardax-bg rounded text-xs font-mono text-vardax-text">
                          {ip}
                        </span>
                      ))}
                      {result.affected_ips.length > 5 && (
                        <span className="px-2 py-0.5 text-xs text-vardax-muted">
                          +{result.affected_ips.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-xs text-vardax-muted">Endpoints ({result.affected_endpoints.length})</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {result.affected_endpoints.slice(0, 5).map((ep, i) => (
                        <span key={i} className="px-2 py-0.5 bg-vardax-bg rounded text-xs font-mono text-vardax-text">
                          {ep}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3">
                <button className="flex-1 py-2 bg-severity-normal text-white rounded font-medium hover:bg-severity-normal/80">
                  ✓ Deploy Rule
                </button>
                <button className="flex-1 py-2 bg-vardax-border text-vardax-text rounded font-medium hover:bg-vardax-muted/30">
                  Modify & Re-test
                </button>
              </div>
            </>
          ) : (
            <div className="bg-vardax-card rounded-lg p-8 border border-vardax-border text-center">
              <div className="text-4xl mb-4">🔬</div>
              <h3 className="font-medium text-white mb-2">No Simulation Results</h3>
              <p className="text-sm text-vardax-muted">
                Select a rule template and click "Run Simulation" to see the impact
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function generateMockResult(): SimulationResult {
  return {
    rule_id: 'sim-001',
    total_requests: 5420,
    would_block: 342,
    would_allow: 5078,
    block_rate: 0.063,
    false_positive_estimate: 0.08,
    affected_ips: ['192.168.1.100', '10.0.0.50', '172.16.0.25', '192.168.2.200'],
    affected_endpoints: ['/api/login', '/api/auth', '/api/users'],
    sample_blocked: [],
    sample_allowed: [],
    recommendation: '✅ LOW IMPACT: Rule is very targeted. Safe to deploy.',
  };
}
