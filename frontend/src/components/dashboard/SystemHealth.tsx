import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Server, Cpu, HardDrive, Wifi, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { apiService } from '../../services/api';

interface SystemHealthData {
  cpu: number;
  memory: number;
  network: number;
  services: {
    mlEngine: 'healthy' | 'warning' | 'critical';
    wafGateway: 'healthy' | 'warning' | 'critical';
    analytics: 'healthy' | 'warning' | 'critical';
    database: 'healthy' | 'warning' | 'critical';
  };
}

const SystemHealth: React.FC = () => {
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch real system health data
  const fetchHealthData = async () => {
    try {
      setError(null);
      
      // Get health check and database stats
      const [healthCheck] = await Promise.all([
        apiService.getHealth(),
        apiService.getDatabaseStats()
      ]);

      // Convert API data to component format
      const systemHealth: SystemHealthData = {
        cpu: 0, // Health endpoint doesn't provide CPU data yet
        memory: 0, // Health endpoint doesn't provide memory data yet  
        network: 0, // Health endpoint doesn't provide network data yet
        services: {
          mlEngine: healthCheck.components?.ml_models === 'loaded' ? 'healthy' : 'warning',
          wafGateway: healthCheck.components?.api === 'up' ? 'healthy' : 'critical',
          analytics: healthCheck.components?.feature_extractor === 'ready' ? 'healthy' : 'warning',
          database: healthCheck.components?.database === 'connected' ? 'healthy' : 'critical'
        }
      };

      setHealthData(systemHealth);
    } catch (err) {
      console.error('Failed to fetch health data:', err);
      setError('Failed to load system health');
      
      // Set default error state
      setHealthData({
        cpu: 0,
        memory: 0,
        network: 0,
        services: {
          mlEngine: 'critical',
          wafGateway: 'critical',
          analytics: 'critical',
          database: 'critical'
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-status-success" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-status-warning" />;
      case 'critical':
        return <XCircle className="w-4 h-4 text-status-error" />;
      default:
        return <AlertCircle className="w-4 h-4 text-enterprise-text-muted" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-status-success';
      case 'warning':
        return 'text-status-warning';
      case 'critical':
        return 'text-status-error';
      default:
        return 'text-enterprise-text-muted';
    }
  };

  const getProgressColor = (value: number) => {
    if (value > 80) return 'bg-status-error';
    if (value > 60) return 'bg-status-warning';
    return 'bg-status-success';
  };

  if (isLoading) {
    return (
      <div className="bg-enterprise-card/50 backdrop-blur-sm border border-enterprise-border-light rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-status-success/10 border border-status-success/20 rounded-lg flex items-center justify-center">
            <Server className="w-5 h-5 text-status-success" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-enterprise-text">System Health</h3>
            <p className="text-sm text-enterprise-text-muted">Infrastructure status</p>
          </div>
        </div>
        
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-8 bg-enterprise-hover/20 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!healthData) {
    return (
      <div className="bg-enterprise-card/50 backdrop-blur-sm border border-enterprise-border-light rounded-xl p-6">
        <div className="text-center py-8">
          <p className="text-sm text-status-error mb-2">{error || 'No health data available'}</p>
          <button 
            onClick={fetchHealthData}
            className="text-xs text-brand-primary hover:text-brand-primary-hover"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-enterprise-card/50 backdrop-blur-sm border border-enterprise-border-light rounded-xl p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-status-success/10 border border-status-success/20 rounded-lg flex items-center justify-center">
            <Server className="w-5 h-5 text-status-success" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-enterprise-text">System Health</h3>
            <p className="text-sm text-enterprise-text-muted">Infrastructure status</p>
          </div>
        </div>
        
        <button 
          onClick={fetchHealthData}
          className="text-xs text-brand-primary hover:text-brand-primary-hover"
        >
          Refresh
        </button>
      </div>

      {/* Resource Usage - Only show if we have data */}
      {(healthData.cpu > 0 || healthData.memory > 0 || healthData.network > 0) && (
        <div className="space-y-4 mb-6">
          {/* CPU Usage */}
          {healthData.cpu > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-enterprise-text-muted" />
                  <span className="text-sm text-enterprise-text">CPU Usage</span>
                </div>
                <span className="text-sm font-medium text-enterprise-text">{healthData.cpu}%</span>
              </div>
              <div className="w-full h-2 bg-enterprise-hover rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${getProgressColor(healthData.cpu)}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${healthData.cpu}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
            </div>
          )}

          {/* Memory Usage */}
          {healthData.memory > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <HardDrive className="w-4 h-4 text-enterprise-text-muted" />
                  <span className="text-sm text-enterprise-text">Memory Usage</span>
                </div>
                <span className="text-sm font-medium text-enterprise-text">{healthData.memory}%</span>
              </div>
              <div className="w-full h-2 bg-enterprise-hover rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${getProgressColor(healthData.memory)}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${healthData.memory}%` }}
                  transition={{ duration: 1, delay: 0.2 }}
                />
              </div>
            </div>
          )}

          {/* Network I/O */}
          {healthData.network > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Wifi className="w-4 h-4 text-enterprise-text-muted" />
                  <span className="text-sm text-enterprise-text">Network I/O</span>
                </div>
                <span className="text-sm font-medium text-enterprise-text">{healthData.network}%</span>
              </div>
              <div className="w-full h-2 bg-enterprise-hover rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${getProgressColor(healthData.network)}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${healthData.network}%` }}
                  transition={{ duration: 1, delay: 0.4 }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Services Status */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-enterprise-text mb-3">Services</h4>
        
        {Object.entries(healthData.services).map(([service, status], index) => (
          <motion.div
            key={service}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center justify-between p-3 bg-enterprise-elevated/30 border border-enterprise-border-light rounded-lg"
          >
            <div className="flex items-center space-x-3">
              {getStatusIcon(status)}
              <span className="text-sm text-enterprise-text capitalize">
                {service.replace(/([A-Z])/g, ' $1').trim()}
              </span>
            </div>
            <span className={`text-xs font-medium uppercase ${getStatusColor(status)}`}>
              {status}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Overall Status */}
      <div className="mt-6 pt-4 border-t border-enterprise-border-light">
        <div className="flex items-center justify-center space-x-2">
          {Object.values(healthData.services).every(status => status === 'healthy') ? (
            <>
              <CheckCircle className="w-5 h-5 text-status-success" />
              <span className="text-sm font-medium text-status-success">All Systems Operational</span>
            </>
          ) : Object.values(healthData.services).some(status => status === 'critical') ? (
            <>
              <XCircle className="w-5 h-5 text-status-error" />
              <span className="text-sm font-medium text-status-error">Critical Issues Detected</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 text-status-warning" />
              <span className="text-sm font-medium text-status-warning">Some Issues Detected</span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default SystemHealth;