import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, MapPin, Shield } from 'lucide-react';

interface Threat {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  location: string;
  timestamp: Date;
  blocked: boolean;
}

const RecentThreats: React.FC = () => {
  const threats: Threat[] = [
    {
      id: '1',
      type: 'SQL Injection',
      severity: 'critical',
      source: '192.168.1.100',
      location: 'China',
      timestamp: new Date(Date.now() - 2 * 60 * 1000),
      blocked: true
    },
    {
      id: '2',
      type: 'XSS Attack',
      severity: 'high',
      source: '10.0.0.45',
      location: 'Russia',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      blocked: true
    },
    {
      id: '3',
      type: 'Brute Force',
      severity: 'medium',
      source: '172.16.0.23',
      location: 'Brazil',
      timestamp: new Date(Date.now() - 8 * 60 * 1000),
      blocked: false
    },
    {
      id: '4',
      type: 'Path Traversal',
      severity: 'high',
      source: '203.0.113.5',
      location: 'India',
      timestamp: new Date(Date.now() - 12 * 60 * 1000),
      blocked: true
    }
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-severity-critical bg-severity-critical/10 border-severity-critical/20';
      case 'high': return 'text-severity-high bg-severity-high/10 border-severity-high/20';
      case 'medium': return 'text-severity-medium bg-severity-medium/10 border-severity-medium/20';
      case 'low': return 'text-severity-low bg-severity-low/10 border-severity-low/20';
      default: return 'text-enterprise-text-muted bg-enterprise-card border-enterprise-border-light';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    return `${diffInHours}h ago`;
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
          <div className="w-10 h-10 bg-status-error/10 border border-status-error/20 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-status-error" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-enterprise-text">Recent Threats</h3>
            <p className="text-sm text-enterprise-text-muted">Latest security incidents</p>
          </div>
        </div>
        
        <button className="text-sm text-brand-primary hover:text-brand-primary-hover transition-colors duration-200">
          View All
        </button>
      </div>

      {/* Threats List */}
      <div className="space-y-3">
        {threats.map((threat, index) => (
          <motion.div
            key={threat.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-enterprise-elevated border border-enterprise-border-light rounded-lg p-4 hover:bg-enterprise-hover transition-colors duration-200 cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* Threat Type and Severity */}
                <div className="flex items-center space-x-3 mb-2">
                  <h4 className="font-semibold text-enterprise-text">{threat.type}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(threat.severity)}`}>
                    {threat.severity.toUpperCase()}
                  </span>
                  {threat.blocked && (
                    <div className="flex items-center space-x-1">
                      <Shield className="w-3 h-3 text-status-success" />
                      <span className="text-xs text-status-success font-medium">BLOCKED</span>
                    </div>
                  )}
                </div>

                {/* Source and Location */}
                <div className="flex items-center space-x-4 text-sm text-enterprise-text-muted mb-2">
                  <div className="flex items-center space-x-1">
                    <span>Source:</span>
                    <code className="bg-enterprise-card px-2 py-0.5 rounded text-xs font-mono text-enterprise-text">
                      {threat.source}
                    </code>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-3 h-3" />
                    <span>{threat.location}</span>
                  </div>
                </div>

                {/* Timestamp */}
                <div className="flex items-center space-x-1 text-xs text-enterprise-text-muted">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimeAgo(threat.timestamp)}</span>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex-shrink-0 ml-4">
                <div className={`w-3 h-3 rounded-full ${
                  threat.blocked ? 'bg-status-success' : 'bg-status-warning'
                } animate-pulse`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-enterprise-border-light">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-status-success">
              {threats.filter(t => t.blocked).length}
            </div>
            <div className="text-xs text-enterprise-text-muted">Blocked</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-status-warning">
              {threats.filter(t => !t.blocked).length}
            </div>
            <div className="text-xs text-enterprise-text-muted">Investigating</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default RecentThreats;