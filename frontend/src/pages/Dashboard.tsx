import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  Globe, 
  Zap,
  Eye,
  Server
} from 'lucide-react';

// Components
import MetricCard from '../components/dashboard/MetricCard';
import ThreatMap from '../components/dashboard/ThreatMap';
import ActivityChart from '../components/dashboard/ActivityChart';
import RecentThreats from '../components/dashboard/RecentThreats';
import SystemHealth from '../components/dashboard/SystemHealth';
import QuickActions from '../components/dashboard/QuickActions';

// Store
// import { useStore } from '../store';

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
  // const { connectionStatus } = useStore();
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  // Mock real-time metrics (in production, these would come from your store/API)
  const [metrics, setMetrics] = useState<DashboardMetric[]>([
    {
      id: 'threats-blocked',
      title: 'Threats Blocked',
      value: 1247,
      change: 12.5,
      changeType: 'increase',
      icon: Shield,
      color: 'success',
      description: 'Total threats blocked in the last 24h'
    },
    {
      id: 'requests-analyzed',
      title: 'Requests Analyzed',
      value: '2.4M',
      change: 8.2,
      changeType: 'increase',
      icon: Activity,
      color: 'primary',
      description: 'HTTP requests processed and analyzed'
    },
    {
      id: 'active-threats',
      title: 'Active Threats',
      value: 23,
      change: -15.3,
      changeType: 'decrease',
      icon: AlertTriangle,
      color: 'warning',
      description: 'Currently active threat indicators'
    },
    {
      id: 'response-time',
      title: 'Avg Response Time',
      value: '3.2ms',
      change: -5.1,
      changeType: 'decrease',
      icon: Zap,
      color: 'success',
      description: 'Average ML inference response time'
    }
  ]);

  // Update metrics periodically (simulate real-time updates)
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => prev.map(metric => ({
        ...metric,
        value: typeof metric.value === 'number' 
          ? metric.value + Math.floor(Math.random() * 10) - 5
          : metric.value,
        change: metric.change + (Math.random() - 0.5) * 2
      })));
    }, 5000);

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

        {/* Additional Stats Row */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Geographic Distribution */}
          <div className="bg-enterprise-card/50 backdrop-blur-sm border border-enterprise-border-light rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-enterprise-text">Geographic Distribution</h3>
              <Globe className="w-5 h-5 text-enterprise-text-muted" />
            </div>
            <div className="space-y-3">
              {[
                { country: 'United States', percentage: 45, threats: 156 },
                { country: 'China', percentage: 23, threats: 89 },
                { country: 'Russia', percentage: 18, threats: 67 },
                { country: 'Brazil', percentage: 14, threats: 45 }
              ].map((item, index) => (
                <div key={item.country} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary" />
                    <span className="text-sm text-enterprise-text">{item.country}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-enterprise-text-muted">{item.threats}</span>
                    <div className="w-16 h-2 bg-enterprise-hover rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary"
                        initial={{ width: 0 }}
                        animate={{ width: `${item.percentage}%` }}
                        transition={{ duration: 1, delay: index * 0.2 }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Attack Types */}
          <div className="bg-enterprise-card/50 backdrop-blur-sm border border-enterprise-border-light rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-enterprise-text">Top Attack Types</h3>
              <Eye className="w-5 h-5 text-enterprise-text-muted" />
            </div>
            <div className="space-y-3">
              {[
                { type: 'SQL Injection', count: 234, severity: 'critical' },
                { type: 'XSS', count: 189, severity: 'high' },
                { type: 'CSRF', count: 156, severity: 'medium' },
                { type: 'Path Traversal', count: 98, severity: 'high' }
              ].map((attack) => (
                <div key={attack.type} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      attack.severity === 'critical' ? 'bg-severity-critical' :
                      attack.severity === 'high' ? 'bg-severity-high' :
                      'bg-severity-medium'
                    }`} />
                    <span className="text-sm text-enterprise-text">{attack.type}</span>
                  </div>
                  <span className="text-sm font-medium text-enterprise-text-secondary">{attack.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-enterprise-card/50 backdrop-blur-sm border border-enterprise-border-light rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-enterprise-text">Performance</h3>
              <Server className="w-5 h-5 text-enterprise-text-muted" />
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-enterprise-text-muted">CPU Usage</span>
                  <span className="text-enterprise-text">23%</span>
                </div>
                <div className="w-full h-2 bg-enterprise-hover rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-status-success"
                    initial={{ width: 0 }}
                    animate={{ width: '23%' }}
                    transition={{ duration: 1 }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-enterprise-text-muted">Memory</span>
                  <span className="text-enterprise-text">67%</span>
                </div>
                <div className="w-full h-2 bg-enterprise-hover rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-status-warning"
                    initial={{ width: 0 }}
                    animate={{ width: '67%' }}
                    transition={{ duration: 1, delay: 0.2 }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-enterprise-text-muted">Network I/O</span>
                  <span className="text-enterprise-text">45%</span>
                </div>
                <div className="w-full h-2 bg-enterprise-hover rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-brand-primary"
                    initial={{ width: 0 }}
                    animate={{ width: '45%' }}
                    transition={{ duration: 1, delay: 0.4 }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Dashboard;