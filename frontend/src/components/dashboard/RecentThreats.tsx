import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, MapPin, Shield, Eye } from 'lucide-react';
import { apiService } from '../../services/api';
import type { AnomalySummary } from '../../services/api';

const RecentThreats: React.FC = () => {
  const [threats, setThreats] = useState<AnomalySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch real threats from API
  const fetchThreats = async () => {
    try {
      setError(null);
      const anomalies = await apiService.getAnomalies({
        limit: 10,
        since_minutes: 60,
        from_db: true
      });
      setThreats(anomalies);
    } catch (err) {
      console.error('Failed to fetch threats:', err);
      setError('Failed to load threats');
      setThreats([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchThreats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchThreats, 30000);
    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-severity-critical bg-severity-critical/10 border-severity-critical/20';
      case 'high':
        return 'text-severity-high bg-severity-high/10 border-severity-high/20';
      case 'medium':
        return 'text-severity-medium bg-severity-medium/10 border-severity-medium/20';
      case 'low':
        return 'text-severity-low bg-severity-low/10 border-severity-low/20';
      default:
        return 'text-enterprise-text-muted bg-enterprise-hover/10 border-enterprise-border-light';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const threatTime = new Date(timestamp);
    const diffMs = now.getTime() - threatTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (isLoading) {
    return (
      <div className="bg-enterprise-card/50 backdrop-blur-sm border border-enterprise-border-light rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-status-error/10 border border-status-error/20 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-status-error" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-enterprise-text">Recent Threats</h3>
            <p className="text-sm text-enterprise-text-muted">Latest security incidents</p>
          </div>
        </div>
        
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-16 bg-enterprise-hover/20 rounded-lg"></div>
            </div>
          ))}
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
          <div className="w-10 h-10 bg-status-error/10 border border-status-error/20 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-status-error" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-enterprise-text">Recent Threats</h3>
            <p className="text-sm text-enterprise-text-muted">Latest security incidents</p>
          </div>
        </div>
        
        <button 
          onClick={fetchThreats}
          className="text-xs text-brand-primary hover:text-brand-primary-hover"
        >
          Refresh
        </button>
      </div>

      {/* Threats List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {error ? (
          <div className="text-center py-8">
            <p className="text-sm text-status-error mb-2">{error}</p>
            <button 
              onClick={fetchThreats}
              className="text-xs text-brand-primary hover:text-brand-primary-hover"
            >
              Retry
            </button>
          </div>
        ) : threats.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="w-12 h-12 text-status-success mx-auto mb-3 opacity-50" />
            <p className="text-sm text-enterprise-text-muted">No recent threats detected</p>
            <p className="text-xs text-enterprise-text-muted mt-1">Your system is secure</p>
          </div>
        ) : (
          <AnimatePresence>
            {threats.map((threat, index) => (
              <motion.div
                key={threat.anomaly_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.1 }}
                className="bg-enterprise-elevated/30 border border-enterprise-border-light rounded-lg p-4 hover:bg-enterprise-elevated/50 transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Severity Badge */}
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(threat.severity)}`}>
                        {threat.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-enterprise-text-muted">
                        {threat.attack_category || 'Unknown'}
                      </span>
                    </div>

                    {/* Threat Details */}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-sm">
                        <MapPin className="w-3 h-3 text-enterprise-text-muted flex-shrink-0" />
                        <span className="text-enterprise-text font-mono truncate">
                          {threat.client_ip}
                        </span>
                        <span className="text-enterprise-text-muted">→</span>
                        <span className="text-enterprise-text-muted truncate">
                          {threat.uri}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-xs text-enterprise-text-muted">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span>{formatTimeAgo(threat.timestamp)}</span>
                        <span>•</span>
                        <span>{Math.round(threat.confidence * 100)}% confidence</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-enterprise-text-muted mt-2 line-clamp-2">
                      {threat.top_explanation}
                    </p>
                  </div>

                  {/* Action Button */}
                  <button className="ml-3 p-2 text-enterprise-text-muted hover:text-enterprise-text hover:bg-enterprise-hover rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-enterprise-border-light">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    threat.status === 'new' ? 'bg-status-warning/10 text-status-warning' :
                    threat.status === 'reviewed' ? 'bg-status-info/10 text-status-info' :
                    'bg-status-success/10 text-status-success'
                  }`}>
                    {threat.status}
                  </span>
                  
                  <div className="text-xs text-enterprise-text-muted">
                    ID: {threat.anomaly_id.slice(-8)}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      {threats.length > 0 && (
        <div className="mt-4 pt-4 border-t border-enterprise-border-light">
          <div className="flex items-center justify-between text-xs text-enterprise-text-muted">
            <span>Showing {threats.length} recent threats</span>
            <button className="text-brand-primary hover:text-brand-primary-hover">
              View all →
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default RecentThreats;