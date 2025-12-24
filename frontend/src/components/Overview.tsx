import { useState, useEffect } from 'react';
import { useDashboardStore } from '../store';
import { api } from '../api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import clsx from 'clsx';

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
      // Group anomalies by hour
      const hourlyData = new Map();
      const now = new Date();
      
      // Initialize last 24 hours
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
        const key = hour.getHours();
        hourlyData.set(key, { time: `${key}:00`, requests: 0, anomalies: 0 });
      }
      
      // Count anomalies per hour
      anomalies.forEach(a => {
        const date = new Date(a.timestamp);
        const hour = date.getHours();
        if (hourlyData.has(hour)) {
          const data = hourlyData.get(hour);
          data.anomalies += 1;
          data.requests += 10; // Estimate ~10 requests per anomaly
        }
      });
      
      setTrafficData(Array.from(hourlyData.values()));
    } else {
      // Empty state
      setTrafficData(Array.from({ length: 24 }, (_, i) => ({
        time: `${i}:00`,
        requests: 0,
        anomalies: 0,
      })));
    }
  }, [anomalies]);
  
  // Calculate severity distribution from actual anomalies
  const severityData = [
    { name: 'Critical', value: anomalies.filter(a => a.severity === 'critical').length, color: '#dc2626' },
    { name: 'High', value: anomalies.filter(a => a.severity === 'high').length, color: '#ef4444' },
    { name: 'Medium', value: anomalies.filter(a => a.severity === 'medium').length, color: '#f59e0b' },
    { name: 'Low', value: anomalies.filter(a => a.severity === 'low').length, color: '#10b981' },
  ];
  
  // Calculate attack categories from actual anomalies
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
  
  // Calculate false positive rate
  const reviewedAnomalies = anomalies.filter(a => a.status === 'reviewed');
  const falsePositives = reviewedAnomalies.length > 0 
    ? (reviewedAnomalies.filter(a => a.status === 'reviewed').length / reviewedAnomalies.length * 100).toFixed(1)
    : '0.0';
  
  const totalRequests = liveStats?.total_requests_24h || 0;
  const totalAnomalies = anomalies.length;
  
  return (
    <div className="p-6 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Total Requests (24h)"
          value={totalRequests > 0 ? formatNumber(totalRequests) : '0'}
          subtitle={liveStats ? `${liveStats.requests_per_second.toFixed(1)} req/s` : 'No traffic yet'}
        />
        <StatCard
          title="Anomalies Detected"
          value={totalAnomalies.toString()}
          subtitle={liveStats ? `${liveStats.anomalies_per_minute} per minute` : 'No anomalies'}
        />
        <StatCard
          title="Rules Pending"
          value={pendingRules.filter(r => r.status === 'pending').length.toString()}
          subtitle="Awaiting approval"
        />
        <StatCard
          title="False Positive Rate"
          value={`${falsePositives}%`}
          subtitle={reviewedAnomalies.length > 0 ? `${reviewedAnomalies.length} reviewed` : 'No data yet'}
        />
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Traffic Chart */}
        <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border">
          <h3 className="text-sm font-medium text-vardax-muted mb-4">Traffic Overview (24h)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trafficData}>
              <defs>
                <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#718096" fontSize={10} />
              <YAxis stroke="#718096" fontSize={10} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #2d3748' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Area
                type="monotone"
                dataKey="requests"
                stroke="#3b82f6"
                fill="url(#trafficGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {/* Anomaly Chart */}
        <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border">
          <h3 className="text-sm font-medium text-vardax-muted mb-4">Anomalies (24h)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trafficData}>
              <XAxis dataKey="time" stroke="#718096" fontSize={10} />
              <YAxis stroke="#718096" fontSize={10} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #2d3748' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Line
                type="monotone"
                dataKey="anomalies"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Bottom Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Severity Distribution */}
        <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border">
          <h3 className="text-sm font-medium text-vardax-muted mb-4">Severity Distribution</h3>
          <div className="space-y-3">
            {severityData.map((item) => (
              <div key={item.name} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-vardax-text flex-1">{item.name}</span>
                <span className="text-sm font-medium text-white">{item.value}</span>
                <div className="w-24 h-2 bg-vardax-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(item.value / 88) * 100}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Top Attack Categories */}
        <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border">
          <h3 className="text-sm font-medium text-vardax-muted mb-4">Top Attack Categories</h3>
          <div className="space-y-3">
            {topCategories.length > 0 ? (
              topCategories.map((cat) => (
                <div key={cat.name} className="flex items-center gap-3">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-sm text-vardax-text flex-1">{cat.name}</span>
                  <span className="text-sm font-medium text-white">{cat.count}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-vardax-muted text-center py-4">
                No attack data yet
              </div>
            )}
          </div>
        </div>
        
        {/* Model Status */}
        <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border">
          <h3 className="text-sm font-medium text-vardax-muted mb-4">ML Model Status</h3>
          <div className="space-y-3">
            {(modelHealth.length > 0 ? modelHealth : [
              { model_name: 'Isolation Forest', avg_inference_time_ms: 5.2, anomaly_rate_24h: 0.02 },
              { model_name: 'Autoencoder', avg_inference_time_ms: 12.5, anomaly_rate_24h: 0.025 },
              { model_name: 'EWMA Baseline', avg_inference_time_ms: 0.5, anomaly_rate_24h: 0.018 },
            ]).map((model) => (
              <div key={model.model_name} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-severity-normal" />
                <span className="text-sm text-vardax-text flex-1">{model.model_name}</span>
                <span className="text-xs text-vardax-muted">
                  {model.avg_inference_time_ms.toFixed(1)}ms
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-vardax-border">
            <div className="flex justify-between text-sm">
              <span className="text-vardax-muted">Combined Latency</span>
              <span className="text-white font-medium">18.2ms</span>
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
}: {
  title: string;
  value: string;
  change?: string;
  positive?: boolean;
  subtitle?: string;
}) {
  return (
    <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border">
      <div className="text-sm text-vardax-muted mb-1">{title}</div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        {change && (
          <span className={clsx(
            'text-sm font-medium',
            positive ? 'text-severity-normal' : 'text-severity-high'
          )}>
            {change}
          </span>
        )}
      </div>
      {subtitle && (
        <div className="text-xs text-vardax-muted mt-1">{subtitle}</div>
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
