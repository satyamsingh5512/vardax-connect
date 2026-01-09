import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  Globe, 
  Zap,
  Server
} from 'lucide-react';

// Components
import MetricCard from '../components/dashboard/MetricCard';
import ThreatMap from '../components/dashboard/ThreatMap';
import ActivityChart from '../components/dashboard/ActivityChart';
import RecentThreats from '../components/dashboard/RecentThreats';
import SystemHealth from '../components/dashboard/SystemHealth';
import QuickActions from '../components/dashboard/QuickActions';

// Services
import { apiService } from '../services/api';
import type { LiveStats, TrafficMetrics } from '../services/api';

// Store
import { useStore } from '../store';

// Types
interface DashboardMetric {
  id: string;
  title: string;
  value: string | number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  color: 'primary' | 'success' | 'warning' | 'error';
  description: string;
}

const Dashboard: React.FC = () => {
  const { setConnectionStatus, setLoading, setError } = useStore();
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [metrics, setMetrics] = useState<DashboardMetric[]>([]);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [trafficMetrics, setTrafficMetrics] = useState<TrafficMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch real data from API
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setConnectionStatus('connecting');

      // Fetch live stats and traffic metrics in parallel
      const [liveStatsData, trafficData] = await Promise.all([
        apiService.getLiveStats(),
        apiService.getTrafficMetrics()
      ]);

      setLiveStats(liveStatsData);
      setTrafficMetrics(trafficData);

      // Convert API data to dashboard metrics
      const dashboardMetrics: DashboardMetric[] = [
        {
          id: 'threats-blocked',
          title: 'Threats Blocked',
          value: liveStatsData.threats_blocked,
          change: 0, // No historical data for change calculation yet
          changeType: 'neutral',
          icon: Shield,
          color: 'success',
          description: 'Total threats blocked in the last 24h'
        },
        {
          id: 'requests-analyzed',
          title: 'Requests/Second',
          value: Math.round(liveStatsData.requests_per_second),
          change: 0,
          changeType: 'neutral',
          icon: Activity,
          color: 'primary',
          description: 'Current requests per second'
        },
        {
          id: 'active-threats',
          title: 'Active Threats',
          value: liveStatsData.anomalies_last_minute,
          change: 0,
          changeType: 'neutral',
          icon: AlertTriangle,
          color: 'warning',
          description: 'Anomalies detected in the last minute'
        },
        {
          id: 'response-time',
          title: 'ML Inference Time',
          value: `${liveStatsData.inference_latency_ms.toFixed(1)}ms`,
          change: 0,
          changeType: 'neutral',
          icon: Zap,
          color: 'success',
          description: 'Average ML inference response time'
        }
      ];

      setMetrics(dashboardMetrics);
      setConnectionStatus('connected');
      setError(null);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setConnectionStatus('disconnected');
      setError('Failed to connect to VARDAx backend');
      
      // Set empty metrics on error
      setMetrics([
        {
          id: 'threats-blocked',
          title: 'Threats Blocked',
          value: 0,
          change: 0,
          changeType: 'neutral',
          icon: Shield,
          color: 'error',
          description: 'No data available'
        },
        {
          id: 'requests-analyzed',
          title: 'Requests/Second',
          value: 0,
          change: 0,
          changeType: 'neutral',
          icon: Activity,
          color: 'error',
          description: 'No data available'
        },
        {
          id: 'active-threats',
          title: 'Active Threats',
          value: 0,
          change: 0,
          changeType: 'neutral',
          icon: AlertTriangle,
          color: 'error',
          description: 'No data available'
        },
        {
          id: 'response-time',
          title: 'ML Inference Time',
          value: 'N/A',
          change: 0,
          changeType: 'neutral',
          icon: Zap,
          color: 'error',
          description: 'No data available'
        }
      ]);
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  if (isLoading) {
    return (
      <div className="min-h-full bg-gradient-to-br from-enterprise-bg via-enterprise-surface/30 to-enterprise-bg p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-enterprise-text-muted">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-enterprise-bg via-enterprise-surface/30 to-enterprise-bg p-6">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-enterprise-text mb-2">
              Security Overview
            </h1>
            <p className="text-enterprise-text-secondary">
              Real-time monitoring and threat intelligence dashboard
            </p>
          </div>
          
          {/* Time Range Selector */}
          <div className="flex items-center space-x-2 mt-4 sm:mt-0">
            <span className="text-sm text-enterprise-text-muted">Time Range:</span>
            <div className="flex bg-enterprise-card rounded-lg border border-enterprise-border-light p-1">
              {(['1h', '24h', '7d', '30d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                    timeRange === range
                      ? 'bg-brand-primary text-white shadow-glow-primary'
                      : 'text-enterprise-text-secondary hover:text-enterprise-text hover:bg-enterprise-hover'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Key Metrics */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.id}
              variants={itemVariants}
              transition={{ delay: index * 0.1 }}
            >
              <MetricCard metric={metric} />
            </motion.div>
          ))}
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Charts and Analytics */}
          <div className="lg:col-span-2 space-y-6">
            {/* Activity Chart */}
            <motion.div variants={itemVariants}>
              <ActivityChart timeRange={timeRange} />
            </motion.div>

            {/* Threat Map */}
            <motion.div variants={itemVariants}>
              <ThreatMap />
            </motion.div>
          </div>

          {/* Right Column - Sidebar Content */}
          <div className="space-y-6">
            {/* System Health */}
            <motion.div variants={itemVariants}>
              <SystemHealth />
            </motion.div>

            {/* Recent Threats */}
            <motion.div variants={itemVariants}>
              <RecentThreats />
            </motion.div>

            {/* Quick Actions */}
            <motion.div variants={itemVariants}>
              <QuickActions />
            </motion.div>
          </div>
        </div>

        {/* Real-time Stats Row */}
        {liveStats && (
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Severity Distribution */}
            <div className="bg-enterprise-card/50 backdrop-blur-sm border border-enterprise-border-light rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-enterprise-text">Severity Distribution</h3>
                <AlertTriangle className="w-5 h-5 text-enterprise-text-muted" />
              </div>
              <div className="space-y-3">
                {Object.entries(liveStats.severity_breakdown).map(([severity, count]) => (
                  <div key={severity} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        severity === 'critical' ? 'bg-severity-critical' :
                        severity === 'high' ? 'bg-severity-high' :
                        severity === 'medium' ? 'bg-severity-medium' :
                        'bg-severity-low'
                      }`} />
                      <span className="text-sm text-enterprise-text capitalize">{severity}</span>
                    </div>
                    <span className="text-sm font-medium text-enterprise-text-secondary">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Model Status */}
            <div className="bg-enterprise-card/50 backdrop-blur-sm border border-enterprise-border-light rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-enterprise-text">ML Model Status</h3>
                <Server className="w-5 h-5 text-enterprise-text-muted" />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-enterprise-text-muted">Status</span>
                  <span className={`text-sm font-medium ${
                    liveStats.model_status === 'healthy' ? 'text-status-success' : 'text-status-error'
                  }`}>
                    {liveStats.model_status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-enterprise-text-muted">Inference Time</span>
                  <span className="text-sm font-medium text-enterprise-text">
                    {liveStats.inference_latency_ms.toFixed(1)}ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-enterprise-text-muted">Pending Rules</span>
                  <span className="text-sm font-medium text-enterprise-text">
                    {liveStats.pending_rules}
                  </span>
                </div>
              </div>
            </div>

            {/* Traffic Summary */}
            {trafficMetrics && (
              <div className="bg-enterprise-card/50 backdrop-blur-sm border border-enterprise-border-light rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-enterprise-text">Traffic Summary</h3>
                  <Globe className="w-5 h-5 text-enterprise-text-muted" />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-enterprise-text-muted">Unique IPs</span>
                    <span className="text-sm font-medium text-enterprise-text">
                      {trafficMetrics.unique_ips.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-enterprise-text-muted">Error Rate</span>
                    <span className="text-sm font-medium text-enterprise-text">
                      {(trafficMetrics.error_rate * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-enterprise-text-muted">Avg Response</span>
                    <span className="text-sm font-medium text-enterprise-text">
                      {trafficMetrics.avg_response_time_ms.toFixed(1)}ms
                    </span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default Dashboard;