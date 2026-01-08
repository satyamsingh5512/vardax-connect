import React from 'react';
import { motion } from 'framer-motion';
import { Server, Cpu, HardDrive, Wifi, CheckCircle, AlertCircle } from 'lucide-react';

interface SystemMetric {
  id: string;
  name: string;
  value: number;
  status: 'healthy' | 'warning' | 'critical';
  icon: React.ComponentType<{ className?: string }>;
}

const SystemHealth: React.FC = () => {
  const metrics: SystemMetric[] = [
    {
      id: 'cpu',
      name: 'CPU Usage',
      value: 23,
      status: 'healthy',
      icon: Cpu
    },
    {
      id: 'memory',
      name: 'Memory',
      value: 67,
      status: 'warning',
      icon: HardDrive
    },
    {
      id: 'network',
      name: 'Network I/O',
      value: 45,
      status: 'healthy',
      icon: Wifi
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-status-success';
      case 'warning': return 'text-status-warning';
      case 'critical': return 'text-status-error';
      default: return 'text-enterprise-text-muted';
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-status-success';
      case 'warning': return 'bg-status-warning';
      case 'critical': return 'bg-status-error';
      default: return 'bg-enterprise-text-muted';
    }
  };

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
            <p className="text-sm text-enterprise-text-muted">Infrastructure monitoring</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-status-success" />
          <span className="text-sm text-status-success">All Systems Operational</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={metric.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center space-x-4"
            >
              <div className="flex-shrink-0">
                <Icon className={`w-5 h-5 ${getStatusColor(metric.status)}`} />
              </div>
              
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-enterprise-text">{metric.name}</span>
                  <span className="text-sm text-enterprise-text-secondary">{metric.value}%</span>
                </div>
                
                <div className="w-full h-2 bg-enterprise-hover rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${getProgressColor(metric.status)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.value}%` }}
                    transition={{ duration: 1, delay: index * 0.2 }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Services Status */}
      <div className="mt-6 pt-4 border-t border-enterprise-border-light">
        <h4 className="text-sm font-semibold text-enterprise-text mb-3">Services</h4>
        <div className="space-y-2">
          {[
            { name: 'ML Engine', status: 'healthy' },
            { name: 'WAF Gateway', status: 'healthy' },
            { name: 'Analytics', status: 'healthy' },
            { name: 'Database', status: 'warning' }
          ].map((service, index) => (
            <motion.div
              key={service.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="flex items-center justify-between"
            >
              <span className="text-sm text-enterprise-text">{service.name}</span>
              <div className="flex items-center space-x-2">
                {service.status === 'healthy' ? (
                  <CheckCircle className="w-4 h-4 text-status-success" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-status-warning" />
                )}
                <span className={`text-xs font-medium ${getStatusColor(service.status)}`}>
                  {service.status.toUpperCase()}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default SystemHealth;