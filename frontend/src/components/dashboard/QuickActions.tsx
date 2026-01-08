import React from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Settings, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  Play,
  Pause,
  BarChart3
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'primary' | 'success' | 'warning' | 'error';
  description: string;
  onClick: () => void;
}

const QuickActions: React.FC = () => {
  const actions: QuickAction[] = [
    {
      id: 'emergency-block',
      label: 'Emergency Block',
      icon: Shield,
      color: 'error',
      description: 'Block all suspicious traffic',
      onClick: () => console.log('Emergency block activated')
    },
    {
      id: 'generate-report',
      label: 'Generate Report',
      icon: Download,
      color: 'primary',
      description: 'Export security report',
      onClick: () => console.log('Generating report')
    },
    {
      id: 'refresh-rules',
      label: 'Refresh Rules',
      icon: RefreshCw,
      color: 'success',
      description: 'Update WAF rules',
      onClick: () => console.log('Refreshing rules')
    },
    {
      id: 'system-scan',
      label: 'System Scan',
      icon: AlertCircle,
      color: 'warning',
      description: 'Run security scan',
      onClick: () => console.log('Starting system scan')
    }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'primary':
        return {
          bg: 'bg-brand-primary/10 hover:bg-brand-primary/20',
          border: 'border-brand-primary/20 hover:border-brand-primary/30',
          icon: 'text-brand-primary',
          text: 'text-brand-primary'
        };
      case 'success':
        return {
          bg: 'bg-status-success/10 hover:bg-status-success/20',
          border: 'border-status-success/20 hover:border-status-success/30',
          icon: 'text-status-success',
          text: 'text-status-success'
        };
      case 'warning':
        return {
          bg: 'bg-status-warning/10 hover:bg-status-warning/20',
          border: 'border-status-warning/20 hover:border-status-warning/30',
          icon: 'text-status-warning',
          text: 'text-status-warning'
        };
      case 'error':
        return {
          bg: 'bg-status-error/10 hover:bg-status-error/20',
          border: 'border-status-error/20 hover:border-status-error/30',
          icon: 'text-status-error',
          text: 'text-status-error'
        };
      default:
        return {
          bg: 'bg-enterprise-card hover:bg-enterprise-hover',
          border: 'border-enterprise-border-light',
          icon: 'text-enterprise-text-muted',
          text: 'text-enterprise-text'
        };
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
          <div className="w-10 h-10 bg-brand-primary/10 border border-brand-primary/20 rounded-lg flex items-center justify-center">
            <Settings className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-enterprise-text">Quick Actions</h3>
            <p className="text-sm text-enterprise-text-muted">Common security tasks</p>
          </div>
        </div>
      </div>

      {/* Actions Grid */}
      <div className="space-y-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          const colorClasses = getColorClasses(action.color);
          
          return (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={action.onClick}
              className={`
                w-full p-4 rounded-lg border transition-all duration-200
                ${colorClasses.bg} ${colorClasses.border}
                focus:outline-none focus:ring-2 focus:ring-brand-primary/50
              `}
            >
              <div className="flex items-center space-x-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses.bg} border ${colorClasses.border}`}>
                  <Icon className={`w-5 h-5 ${colorClasses.icon}`} />
                </div>
                
                <div className="flex-1 text-left">
                  <h4 className={`font-semibold text-sm ${colorClasses.text}`}>
                    {action.label}
                  </h4>
                  <p className="text-xs text-enterprise-text-muted mt-1">
                    {action.description}
                  </p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* System Controls */}
      <div className="mt-6 pt-4 border-t border-enterprise-border-light">
        <h4 className="text-sm font-semibold text-enterprise-text mb-3">System Controls</h4>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center space-x-2 px-3 py-2 bg-status-success/10 border border-status-success/20 rounded-lg text-status-success hover:bg-status-success/20 transition-colors duration-200"
            >
              <Play className="w-4 h-4" />
              <span className="text-sm font-medium">Start</span>
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center space-x-2 px-3 py-2 bg-status-warning/10 border border-status-warning/20 rounded-lg text-status-warning hover:bg-status-warning/20 transition-colors duration-200"
            >
              <Pause className="w-4 h-4" />
              <span className="text-sm font-medium">Pause</span>
            </motion.button>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center space-x-2 px-3 py-2 bg-brand-primary/10 border border-brand-primary/20 rounded-lg text-brand-primary hover:bg-brand-primary/20 transition-colors duration-200"
          >
            <BarChart3 className="w-4 h-4" />
            <span className="text-sm font-medium">Analytics</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default QuickActions;