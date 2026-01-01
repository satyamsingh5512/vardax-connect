import { useEffect, useState } from 'react';
import { useDashboardStore } from './store';
import { api, connectWebSocket } from './api';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { Overview } from './components/Overview';
import { LiveTraffic } from './components/LiveTraffic';
import { AnomalyList } from './components/AnomalyList';
import { RuleApproval } from './components/RuleApproval';
import { ModelHealth } from './components/ModelHealth';
import { ReplayTimeline } from './components/ReplayTimeline';
import { TrafficHeatmap } from './components/TrafficHeatmap';
import { GeoMap } from './components/GeoMap';
import { RuleSimulator } from './components/RuleSimulator';
import { Settings } from './components/Settings';
import { LoadingScreen } from './components/LoadingScreen';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const {
    activeTab,
    setAnomalies,
    addAnomaly,
    setPendingRules,
    setTrafficMetrics,
    setModelHealth,
    setWsConnected,
  } = useDashboardStore();
  
  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [anomalies, rules, metrics, health] = await Promise.all([
          api.getAnomalies(),
          api.getPendingRules(),
          api.getTrafficMetrics(),
          api.getModelHealth(),
        ]);
        
        setAnomalies(anomalies);
        setPendingRules(rules);
        setTrafficMetrics(metrics);
        setModelHealth(health);
      } catch (e) {
        console.error('Failed to load initial data:', e);
        // Use mock data for demo
        setAnomalies(generateMockAnomalies());
        setPendingRules(generateMockRules());
      }
    };
    
    loadData();
    
    // Refresh metrics every 5 seconds
    const interval = setInterval(async () => {
      try {
        const metrics = await api.getTrafficMetrics();
        setTrafficMetrics(metrics);
      } catch (e) {
        // Ignore errors for periodic refresh
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Connect WebSocket for real-time updates
  useEffect(() => {
    const ws = connectWebSocket(
      (anomaly) => addAnomaly(anomaly),
      () => setWsConnected(true),
      () => setWsConnected(false)
    );
    
    return () => ws.close();
  }, []);
  
  return (
    <>
      {isLoading && <LoadingScreen onLoadComplete={() => setIsLoading(false)} />}
      
      <div className="dashboard-layout">
        <Header />
        <Navigation />
        <main className="dashboard-main">
          {activeTab === 'overview' && <Overview />}
          {activeTab === 'traffic' && <LiveTraffic />}
          {activeTab === 'anomalies' && <AnomalyList />}
          {activeTab === 'rules' && <RuleApproval />}
          {activeTab === 'models' && <ModelHealth />}
          {activeTab === 'replay' && <ReplayTimeline />}
          {activeTab === 'heatmap' && (
            <div className="p-6 grid grid-cols-2 gap-6" style={{ background: 'var(--bg-primary)', height: '100%', overflow: 'auto' }}>
              <TrafficHeatmap />
              <GeoMap />
            </div>
          )}
          {activeTab === 'simulate' && <RuleSimulator />}
          {activeTab === 'settings' && <Settings />}
        </main>
      </div>
    </>
  );
}

// Mock data generators for demo
function generateMockAnomalies() {
  const severities = ['low', 'medium', 'high', 'critical'] as const;
  const categories = ['rate_abuse', 'bot_attack', 'credential_stuffing', 'reconnaissance', 'injection_attempt'];
  const explanations = [
    'Request rate 340% above baseline',
    'Bot-like behavior detected (score: 0.85)',
    'Unusual API call sequence',
    'High entropy in query parameters',
    'Session accessed 47 unique endpoints',
    'Authentication failure spike',
  ];
  
  return Array.from({ length: 25 }, (_, i) => ({
    anomaly_id: `anom-${Date.now()}-${i}`,
    timestamp: new Date(Date.now() - i * 60000).toISOString(),
    client_ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    uri: `/api/v1/${['users', 'products', 'orders', 'auth/login'][Math.floor(Math.random() * 4)]}`,
    severity: severities[Math.floor(Math.random() * severities.length)],
    confidence: 0.5 + Math.random() * 0.5,
    attack_category: categories[Math.floor(Math.random() * categories.length)],
    top_explanation: explanations[Math.floor(Math.random() * explanations.length)],
    status: i < 5 ? 'new' : 'reviewed',
  }));
}

function generateMockRules() {
  return [
    {
      rule_id: 'vardax-rate-abc123',
      created_at: new Date().toISOString(),
      source_anomaly_ids: ['anom-1', 'anom-2', 'anom-3'],
      anomaly_count: 12,
      rule_type: 'rate_limit',
      rule_content: `SecRule REQUEST_URI "@rx ^/api/v1/login" \\
    "id:9900001,phase:1,deny,status:429,\\
    msg:'VARDAx: Rate limit exceeded'"`,
      rule_description: 'Rate limit /api/v1/login to 10 requests per minute',
      confidence: 0.87,
      false_positive_estimate: 0.05,
      status: 'pending' as const,
    },
    {
      rule_id: 'vardax-ip-def456',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      source_anomaly_ids: ['anom-4', 'anom-5'],
      anomaly_count: 47,
      rule_type: 'ip_block',
      rule_content: `SecRule REMOTE_ADDR "@ipMatch 192.168.1.100" \\
    "id:9900002,phase:1,deny,status:403,\\
    msg:'VARDAx: Suspicious IP blocked'"`,
      rule_description: 'Block IP 192.168.1.100 - 47 anomalies detected',
      confidence: 0.92,
      false_positive_estimate: 0.02,
      status: 'pending' as const,
    },
  ];
}

export default App;
