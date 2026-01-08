import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Activity, 
  Download
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer 
} from 'recharts';
import { DataTable } from '../components/advanced/DataTable';
import { Modal } from '../components/advanced/ModalSystem';
import { showToast } from '../components/advanced/NotificationSystem';
import type { ColumnDef } from '@tanstack/react-table';

interface AnalyticsData {
  timestamp: string;
  requests: number;
  threats: number;
  blocked: number;
  anomalies: number;
  responseTime: number;
  bandwidth: number;
}

interface TopEndpoint {
  endpoint: string;
  requests: number;
  threats: number;
  avgResponseTime: number;
  status: 'safe' | 'suspicious' | 'blocked';
}

interface SecurityMetric {
  name: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'critical';
}

interface AttackPattern {
  type: string;
  count: number;
  percentage: number;
  trend: number;
  color: string;
}

const Analytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [topEndpoints, setTopEndpoints] = useState<TopEndpoint[]>([]);
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetric[]>([]);
  const [attackPatterns, setAttackPatterns] = useState<AttackPattern[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<SecurityMetric | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Generate mock analytics data
  const generateAnalyticsData = (range: string): AnalyticsData[] => {
    const points = range === '1h' ? 60 : range === '24h' ? 24 : range === '7d' ? 7 : 30;
    const baseRequests = 1000;
    
    return Array.from({ length: points }, (_, i) => {
      const variance = Math.random() * 0.3 + 0.85; // 85-115% variance
      const threatSpike = Math.random() > 0.9 ? 3 : 1; // Occasional threat spikes
      
      return {
        timestamp: range === '1h' 
          ? `${String(i).padStart(2, '0')}:00`
          : range === '24h'
          ? `${String(i).padStart(2, '0')}:00`
          : range === '7d'
          ? `Day ${i + 1}`
          : `Week ${i + 1}`,
        requests: Math.floor(baseRequests * variance),
        threats: Math.floor(Math.random() * 50 * threatSpike),
        blocked: Math.floor(Math.random() * 30 * threatSpike),
        anomalies: Math.floor(Math.random() * 20),
        responseTime: Math.random() * 200 + 50,
        bandwidth: Math.random() * 100 + 20
      };
    });
  };

  const generateTopEndpoints = (): TopEndpoint[] => {
    const endpoints = [
      '/api/login', '/api/users', '/api/data', '/admin/dashboard', 
      '/api/upload', '/api/search', '/api/orders', '/api/payments'
    ];
    
    return endpoints.map(endpoint => ({
      endpoint,
      requests: Math.floor(Math.random() * 10000) + 1000,
      threats: Math.floor(Math.random() * 100),
      avgResponseTime: Math.random() * 500 + 50,
      status: (Math.random() > 0.8 ? 'blocked' : Math.random() > 0.6 ? 'suspicious' : 'safe') as 'blocked' | 'safe' | 'suspicious'
    })).sort((a, b) => b.requests - a.requests);
  };

  const generateSecurityMetrics = (): SecurityMetric[] => {
    return [
      {
        name: 'Threat Detection Rate',
        value: 94.7,
        change: 2.3,
        trend: 'up',
        status: 'good'
      },
      {
        name: 'False Positive Rate',
        value: 3.2,
        change: -0.8,
        trend: 'down',
        status: 'good'
      },
      {
        name: 'Response Time',
        value: 127,
        change: 15,
        trend: 'up',
        status: 'warning'
      },
      {
        name: 'Blocked Attacks',
        value: 1247,
        change: 89,
        trend: 'up',
        status: 'good'
      },
      {
        name: 'System Uptime',
        value: 99.97,
        change: 0.02,
        trend: 'stable',
        status: 'good'
      },
      {
        name: 'Active Rules',
        value: 342,
        change: 12,
        trend: 'up',
        status: 'good'
      }
    ];
  };

  const generateAttackPatterns = (): AttackPattern[] => {
    const patterns = [
      { type: 'SQL Injection', color: '#ef4444' },
      { type: 'XSS Attack', color: '#f97316' },
      { type: 'DDoS', color: '#eab308' },
      { type: 'Brute Force', color: '#22c55e' },
      { type: 'Malware', color: '#3b82f6' },
      { type: 'Phishing', color: '#8b5cf6' },
      { type: 'Other', color: '#6b7280' }
    ];

    const total = patterns.reduce((sum, _) => sum + Math.random() * 100, 0);
    
    return patterns.map(pattern => {
      const count = Math.floor(Math.random() * 100) + 10;
      return {
        ...pattern,
        count,
        percentage: (count / total) * 100,
        trend: Math.random() > 0.5 ? Math.random() * 20 : -Math.random() * 20
      };
    });
  };

  // Load data based on time range
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setAnalyticsData(generateAnalyticsData(timeRange));
      setTopEndpoints(generateTopEndpoints());
      setSecurityMetrics(generateSecurityMetrics());
      setAttackPatterns(generateAttackPatterns());
      setIsLoading(false);
    };

    loadData();
  }, [timeRange]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Activity className="w-4 h-4 text-slate-400" />;
  };

  const endpointColumns: ColumnDef<TopEndpoint>[] = [
    {
      accessorKey: 'endpoint',
      header: 'Endpoint',
      cell: ({ row }) => (
        <span className="font-mono text-sm text-cyan-400">{row.original.endpoint}</span>
      ),
    },
    {
      accessorKey: 'requests',
      header: 'Requests',
      cell: ({ row }) => (
        <span className="text-white font-medium">{row.original.requests.toLocaleString()}</span>
      ),
    },
    {
      accessorKey: 'threats',
      header: 'Threats',
      cell: ({ row }) => (
        <span className="text-red-400 font-medium">{row.original.threats}</span>
      ),
    },
    {
      accessorKey: 'avgResponseTime',
      header: 'Avg Response',
      cell: ({ row }) => (
        <span className="text-slate-300">{row.original.avgResponseTime.toFixed(0)}ms</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const colors = {
          safe: 'text-green-400 bg-green-400/10 border-green-400/20',
          suspicious: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
          blocked: 'text-red-400 bg-red-400/10 border-red-400/20'
        };
        return (
          <span className={`px-2 py-1 text-xs font-semibold rounded border ${colors[row.original.status]}`}>
            {row.original.status.toUpperCase()}
          </span>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-400" />
            Security Analytics
          </h1>
          <p className="text-slate-400 mt-1">Comprehensive security metrics and insights</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button
            onClick={() => showToast.info('Export functionality coming soon')}
            className="btn btn-ghost"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Security Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {securityMetrics.map((metric, index) => (
          <motion.div
            key={metric.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="card cursor-pointer hover:border-slate-600 transition-colors"
            onClick={() => setSelectedMetric(metric)}
          >
            <div className="card-body p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-400">{metric.name}</h3>
                {getTrendIcon(metric.trend)}
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className={`text-2xl font-bold ${getStatusColor(metric.status)}`}>
                    {metric.name.includes('Rate') || metric.name.includes('Uptime') 
                      ? `${metric.value}%` 
                      : metric.value.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {metric.change > 0 ? '+' : ''}{metric.change}
                    {metric.name.includes('Rate') || metric.name.includes('Uptime') ? '%' : ''}
                    {' '}from last period
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic & Threats Chart */}
        <div className="card">
          <div className="card-body p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Traffic & Threats Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="timestamp" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="requests" stroke="#3b82f6" name="Requests" strokeWidth={2} />
                <Line type="monotone" dataKey="threats" stroke="#ef4444" name="Threats" strokeWidth={2} />
                <Line type="monotone" dataKey="blocked" stroke="#22c55e" name="Blocked" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attack Patterns Pie Chart */}
        <div className="card">
          <div className="card-body p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Attack Patterns Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={attackPatterns}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                  label={({ type, percentage }) => `${type}: ${percentage.toFixed(1)}%`}
                >
                  {attackPatterns.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Response Time & Bandwidth Chart */}
      <div className="card">
        <div className="card-body p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Performance Metrics</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analyticsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="timestamp" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="responseTime" 
                stackId="1" 
                stroke="#8b5cf6" 
                fill="#8b5cf6" 
                fillOpacity={0.3}
                name="Response Time (ms)"
              />
              <Area 
                type="monotone" 
                dataKey="bandwidth" 
                stackId="2" 
                stroke="#06b6d4" 
                fill="#06b6d4" 
                fillOpacity={0.3}
                name="Bandwidth (MB/s)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Endpoints Table */}
      <div className="card">
        <div className="card-body p-0">
          <DataTable
            data={topEndpoints}
            columns={endpointColumns}
            title="Top Endpoints Analysis"
            subtitle={`${topEndpoints.length} endpoints analyzed`}
            searchPlaceholder="Search endpoints..."
            pageSize={10}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Attack Patterns Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {attackPatterns.slice(0, 4).map((pattern, index) => (
          <motion.div
            key={pattern.type}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="card"
          >
            <div className="card-body p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-white">{pattern.type}</h4>
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: pattern.color }}
                />
              </div>
              <p className="text-2xl font-bold text-white mb-1">{pattern.count}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{pattern.percentage.toFixed(1)}%</span>
                <span className={`flex items-center gap-1 ${pattern.trend > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {pattern.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(pattern.trend).toFixed(1)}%
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Metric Detail Modal */}
      <Modal
        isOpen={!!selectedMetric}
        onClose={() => setSelectedMetric(null)}
        title={`${selectedMetric?.name} Details`}
        size="md"
      >
        {selectedMetric && (
          <div className="space-y-4">
            <div className="text-center">
              <p className={`text-4xl font-bold ${getStatusColor(selectedMetric.status)} mb-2`}>
                {selectedMetric.name.includes('Rate') || selectedMetric.name.includes('Uptime') 
                  ? `${selectedMetric.value}%` 
                  : selectedMetric.value.toLocaleString()}
              </p>
              <p className="text-slate-400">Current Value</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-400">Change</p>
                <p className={`text-lg font-semibold ${selectedMetric.change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {selectedMetric.change > 0 ? '+' : ''}{selectedMetric.change}
                  {selectedMetric.name.includes('Rate') || selectedMetric.name.includes('Uptime') ? '%' : ''}
                </p>
              </div>
              <div className="text-center p-4 bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-400">Status</p>
                <p className={`text-lg font-semibold ${getStatusColor(selectedMetric.status)}`}>
                  {selectedMetric.status.toUpperCase()}
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-slate-800 rounded-lg">
              <h4 className="text-sm font-medium text-white mb-2">Description</h4>
              <p className="text-sm text-slate-400">
                {selectedMetric.name === 'Threat Detection Rate' && 'Percentage of threats successfully detected by the system.'}
                {selectedMetric.name === 'False Positive Rate' && 'Percentage of legitimate requests incorrectly flagged as threats.'}
                {selectedMetric.name === 'Response Time' && 'Average response time for security rule processing in milliseconds.'}
                {selectedMetric.name === 'Blocked Attacks' && 'Total number of malicious requests blocked by the WAF.'}
                {selectedMetric.name === 'System Uptime' && 'Percentage of time the security system has been operational.'}
                {selectedMetric.name === 'Active Rules' && 'Number of security rules currently active and monitoring traffic.'}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Analytics;