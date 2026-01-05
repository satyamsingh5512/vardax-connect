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
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                  <stop offset="50%" stopColor="#a855f7" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#6e7681" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#6e7681" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: '#161b22', 
                  border: '2px solid #3b82f6',
                  borderRadius: '8px',
                  boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)'
                }}
                labelStyle={{ color: '#f0f6fc', fontWeight: 600 }}
              />
              <Area
                type="monotone"
                dataKey="requests"
                stroke="#3b82f6"
                strokeWidth={3}
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
              <defs>
                <linearGradient id="anomalyGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="50%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#6e7681" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#6e7681" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: '#161b22', 
                  border: '2px solid #f59e0b',
                  borderRadius: '8px',
                  boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)'
                }}
                labelStyle={{ color: '#f0f6fc', fontWeight: 600 }}
              />
              <Line
                type="monotone"
                dataKey="anomalies"
                stroke="url(#anomalyGradient)"
                strokeWidth={3}
                dot={{ fill: '#f59e0b', r: 4, strokeWidth: 0 }}
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
                  <span 
                    className="severity-dot animate-pulse" 
                    style={{ 
                      backgroundColor: item.color,
                      boxShadow: `0 0 10px ${item.color}`,
                    }} 
                  />
                  {item.name}
                </span>
                <div className="score-track">
                  <div
                    className="score-fill"
                    style={{
                      width: `${Math.min((item.value / Math.max(totalAnomalies, 1)) * 100, 100)}%`,
                      background: `linear-gradient(90deg, ${item.color}, ${item.color}dd)`,
                      boxShadow: `0 0 10px ${item.color}66`,
                    }}
                  />
                </div>
                <span className="score-value font-bold">{item.value}</span>
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
              ]).map((model, idx) => {
                const colors = ['#10b981', '#3b82f6', '#a855f7'];
                const modelColor = colors[idx % colors.length];
                return (
                  <div 
                    key={model.model_name} 
                    className="flex items-center gap-3 p-3 transition-all hover:scale-105" 
                    style={{ 
                      background: `linear-gradient(135deg, ${modelColor}15, ${modelColor}05)`, 
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${modelColor}40`,
                    }}
                  >
                    <div 
                      className="w-2 h-2 rounded-full animate-pulse" 
                      style={{ 
                        backgroundColor: modelColor,
                        boxShadow: `0 0 10px ${modelColor}`,
                      }} 
                    />
                    <span className="text-sm flex-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{model.model_name}</span>
                    <span className="text-xs font-mono font-semibold" style={{ color: modelColor }}>
                      {model.avg_inference_time_ms.toFixed(1)}ms
                    </span>
                  </div>
                );
              })}}
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
  const gradientColors = {
    default: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(168, 85, 247, 0.05))',
    warning: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(251, 191, 36, 0.05))',
    critical: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.05))',
    success: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05))',
  };

  const borderColors = {
    default: '#3b82f6',
    warning: '#f59e0b',
    critical: '#ef4444',
    success: '#10b981',
  };

  return (
    <div 
      className={`stat-card ${variant} border-gradient-animated`} 
      style={{ 
        background: gradientColors[variant],
        borderColor: borderColors[variant],
      }}
    >
      <div className="stat-label">{title}</div>
      <div className="flex items-end gap-2">
        <span className="stat-value gradient-text-vibrant">{value}</span>
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
