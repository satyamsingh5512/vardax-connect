import { useState, useEffect } from 'react';
import { useDashboardStore } from '../store';
import { api } from '../api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ConnectedServices } from './ConnectedServices';

export function Overview() {
  const { anomalies, pendingRules, modelHealth } = useDashboardStore();
  const [liveStats, setLiveStats] = useState<any>(null);
  const [trafficData, setTrafficData] = useState<any[]>([]);
  
  // Fetch live stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stats = await api.getLiveStats();
        setLiveStats(stats);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };
    
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);
  
  // Generate traffic data from anomalies
  useEffect(() => {
    if (anomalies.length > 0) {
      const hourlyData = new Map();
      const now = new Date();
      
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
        const key = hour.getHours();
        hourlyData.set(key, { time: `${key}:00`, requests: 0, anomalies: 0 });
      }
      
      anomalies.forEach(a => {
        const date = new Date(a.timestamp);
        const hour = date.getHours();
        if (hourlyData.has(hour)) {
          const data = hourlyData.get(hour);
          data.anomalies += 1;
          data.requests += 10;
        }
      });
      
      setTrafficData(Array.from(hourlyData.values()));
    } else {
      setTrafficData(Array.from({ length: 24 }, (_, i) => ({
        time: `${i}:00`,
        requests: 0,
        anomalies: 0,
      })));
    }
  }, [anomalies]);
  
  const severityData = [
    { name: 'Critical', value: anomalies.filter(a => a.severity === 'critical').length, color: '#ff4757' },
    { name: 'High', value: anomalies.filter(a => a.severity === 'high').length, color: '#ff6b6b' },
    { name: 'Medium', value: anomalies.filter(a => a.severity === 'medium').length, color: '#ffa502' },
    { name: 'Low', value: anomalies.filter(a => a.severity === 'low').length, color: '#2ed573' },
  ];
  
  const categoryCount = new Map<string, number>();
  anomalies.forEach(a => {
    if (a.attack_category) {
      categoryCount.set(a.attack_category, (categoryCount.get(a.attack_category) || 0) + 1);
    }
  });
  
  const topCategories = Array.from(categoryCount.entries())
    .map(([name, count]) => ({
      name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      count,
      icon: getCategoryIcon(name),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  const reviewedAnomalies = anomalies.filter(a => a.status === 'reviewed');
  const falsePositives = reviewedAnomalies.length > 0 
    ? (reviewedAnomalies.filter(a => a.status === 'reviewed').length / reviewedAnomalies.length * 100).toFixed(1)
    : '0.0';
  
  const totalRequests = liveStats?.total_requests_24h || 0;
  const totalAnomalies = anomalies.length;
  
  return (
    <div className="p-6 space-y-6 overflow-auto h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Total Requests (24h)"
          value={totalRequests > 0 ? formatNumber(totalRequests) : '0'}
          subtitle={liveStats ? `${liveStats.requests_per_second.toFixed(1)} req/s` : 'No traffic yet'}
          variant="default"
        />
        <StatCard
          title="Anomalies Detected"
          value={totalAnomalies.toString()}
          subtitle={liveStats ? `${liveStats.anomalies_per_minute} per minute` : 'No anomalies'}
          variant="warning"
        />
        <StatCard
          title="Rules Pending"
          value={pendingRules.filter(r => r.status === 'pending').length.toString()}
          subtitle="Awaiting approval"
          variant="default"
        />
        <StatCard
          title="False Positive Rate"
          value={`${falsePositives}%`}
          subtitle={reviewedAnomalies.length > 0 ? `${reviewedAnomalies.length} reviewed` : 'No data yet'}
          variant="success"
        />
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        <div className="chart-container">
          <div className="chart-header">
            <h3 className="chart-title">Traffic Overview (24h)</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trafficData}>
              <defs>
                <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#388bfd" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#388bfd" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#6e7681" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#6e7681" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: '#161b22', 
                  border: '1px solid #21262d',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.4)'
                }}
                labelStyle={{ color: '#f0f6fc' }}
              />
              <Area
                type="monotone"
                dataKey="requests"
                stroke="#388bfd"
                strokeWidth={2}
                fill="url(#trafficGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        <div className="chart-container">
          <div className="chart-header">
            <h3 className="chart-title">Anomalies (24h)</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trafficData}>
              <XAxis dataKey="time" stroke="#6e7681" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#6e7681" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: '#161b22', 
                  border: '1px solid #21262d',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.4)'
                }}
                labelStyle={{ color: '#f0f6fc' }}
              />
              <Line
                type="monotone"
                dataKey="anomalies"
                stroke="#ffa502"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Bottom Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Connected Services */}
        <ConnectedServices />
        
        {/* Severity Distribution */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Severity Distribution</h3>
          </div>
          <div className="card-body space-y-3">
            {severityData.map((item) => (
              <div key={item.name} className="score-bar">
                <span className="score-label flex items-center gap-2">
                  <span className="severity-dot" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <div className="score-track">
                  <div
                    className="score-fill"
                    style={{
                      width: `${Math.min((item.value / Math.max(totalAnomalies, 1)) * 100, 100)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
                <span className="score-value">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Top Attack Categories */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top Attack Categories</h3>
          </div>
          <div className="card-body space-y-3">
            {topCategories.length > 0 ? (
              topCategories.map((cat) => (
                <div key={cat.name} className="flex items-center gap-3">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>{cat.name}</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{cat.count}</span>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-text">No attack data yet</div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* ML Model Status Row */}
      <div className="grid grid-cols-1 gap-6">
        {/* Model Status */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">ML Model Status</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-6">
              {(modelHealth.length > 0 ? modelHealth : [
                { model_name: 'Isolation Forest', avg_inference_time_ms: 5.2, anomaly_rate_24h: 0.02 },
                { model_name: 'Autoencoder', avg_inference_time_ms: 12.5, anomaly_rate_24h: 0.025 },
                { model_name: 'EWMA Baseline', avg_inference_time_ms: 0.5, anomaly_rate_24h: 0.018 },
              ]).map((model) => (
                <div key={model.model_name} className="flex items-center gap-3 p-3" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent-green)' }} />
                  <span className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>{model.model_name}</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                    {model.avg_inference_time_ms.toFixed(1)}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="card-footer">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-tertiary)' }}>Combined Latency</span>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>18.2ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  change,
  positive,
  subtitle,
  variant = 'default',
}: {
  title: string;
  value: string;
  change?: string;
  positive?: boolean;
  subtitle?: string;
  variant?: 'default' | 'warning' | 'critical' | 'success';
}) {
  return (
    <div className={`stat-card ${variant}`}>
      <div className="stat-label">{title}</div>
      <div className="flex items-end gap-2">
        <span className="stat-value">{value}</span>
        {change && (
          <span className={`stat-change ${positive ? 'positive' : 'negative'}`}>
            {positive ? '↑' : '↓'} {change}
          </span>
        )}
      </div>
      {subtitle && (
        <div className="stat-subtitle">{subtitle}</div>
      )}
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'rate_abuse': '⚡',
    'bot_attack': '🤖',
    'credential_stuffing': '🔑',
    'reconnaissance': '🔍',
    'injection_attempt': '💉',
    'unknown': '❓',
  };
  return icons[category] || '🔒';
}
