import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, MapPin, AlertTriangle, Shield } from 'lucide-react';

interface ThreatLocation {
  id: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
  threatCount: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  lastSeen: Date;
}

const ThreatMap: React.FC = () => {
  const [threats] = useState<ThreatLocation[]>([
    {
      id: '1',
      country: 'China',
      city: 'Beijing',
      lat: 39.9042,
      lng: 116.4074,
      threatCount: 156,
      severity: 'critical',
      lastSeen: new Date(Date.now() - 2 * 60 * 1000)
    },
    {
      id: '2',
      country: 'Russia',
      city: 'Moscow',
      lat: 55.7558,
      lng: 37.6176,
      threatCount: 89,
      severity: 'high',
      lastSeen: new Date(Date.now() - 5 * 60 * 1000)
    },
    {
      id: '3',
      country: 'Brazil',
      city: 'São Paulo',
      lat: -23.5505,
      lng: -46.6333,
      threatCount: 67,
      severity: 'medium',
      lastSeen: new Date(Date.now() - 10 * 60 * 1000)
    },
    {
      id: '4',
      country: 'India',
      city: 'Mumbai',
      lat: 19.0760,
      lng: 72.8777,
      threatCount: 45,
      severity: 'high',
      lastSeen: new Date(Date.now() - 15 * 60 * 1000)
    }
  ]);

  const [selectedThreat, setSelectedThreat] = useState<ThreatLocation | null>(null);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-severity-critical';
      case 'high': return 'bg-severity-high';
      case 'medium': return 'bg-severity-medium';
      case 'low': return 'bg-severity-low';
      default: return 'bg-enterprise-text-muted';
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
            <Globe className="w-5 h-5 text-status-error" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-enterprise-text">Global Threat Map</h3>
            <p className="text-sm text-enterprise-text-muted">Real-time threat origins</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 text-sm text-enterprise-text-muted">
          <Shield className="w-4 h-4" />
          <span>{threats.length} active sources</span>
        </div>
      </div>

      {/* Map Visualization (Simplified) */}
      <div className="relative h-64 bg-gradient-to-br from-enterprise-surface to-enterprise-hover rounded-lg border border-enterprise-border-light overflow-hidden mb-4">
        {/* World Map Background (Simplified SVG or CSS representation) */}
        <div className="absolute inset-0 bg-gradient-mesh opacity-20" />
        
        {/* Threat Points */}
        {threats.map((threat, index) => (
          <motion.div
            key={threat.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.2 }}
            className="absolute cursor-pointer"
            style={{
              left: `${((threat.lng + 180) / 360) * 100}%`,
              top: `${((90 - threat.lat) / 180) * 100}%`,
              transform: 'translate(-50%, -50%)'
            }}
            onClick={() => setSelectedThreat(threat)}
          >
            {/* Pulse Animation */}
            <motion.div
              className={`absolute inset-0 rounded-full ${getSeverityColor(threat.severity)} opacity-30`}
              animate={{
                scale: [1, 2, 1],
                opacity: [0.3, 0.1, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            
            {/* Threat Point */}
            <div className={`w-4 h-4 rounded-full ${getSeverityColor(threat.severity)} border-2 border-white shadow-lg`} />
            
            {/* Threat Count Badge */}
            <div className="absolute -top-2 -right-2 w-5 h-5 bg-enterprise-elevated border border-enterprise-border-light rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-enterprise-text">{threat.threatCount}</span>
            </div>
          </motion.div>
        ))}

        {/* Grid Lines */}
        <div className="absolute inset-0 opacity-10">
          {[...Array(5)].map((_, i) => (
            <div
              key={`h-${i}`}
              className="absolute w-full h-px bg-enterprise-text"
              style={{ top: `${(i + 1) * 20}%` }}
            />
          ))}
          {[...Array(9)].map((_, i) => (
            <div
              key={`v-${i}`}
              className="absolute h-full w-px bg-enterprise-text"
              style={{ left: `${(i + 1) * 10}%` }}
            />
          ))}
        </div>
      </div>

      {/* Threat Details */}
      <AnimatePresence mode="wait">
        {selectedThreat ? (
          <motion.div
            key="selected"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-enterprise-elevated border border-enterprise-border-light rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <MapPin className={`w-5 h-5 ${
                  selectedThreat.severity === 'critical' ? 'text-severity-critical' :
                  selectedThreat.severity === 'high' ? 'text-severity-high' :
                  selectedThreat.severity === 'medium' ? 'text-severity-medium' :
                  'text-severity-low'
                }`} />
                <div>
                  <h4 className="font-semibold text-enterprise-text">
                    {selectedThreat.city}, {selectedThreat.country}
                  </h4>
                  <p className="text-sm text-enterprise-text-muted">
                    {selectedThreat.threatCount} threats detected
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedThreat(null)}
                className="text-enterprise-text-muted hover:text-enterprise-text"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-enterprise-text-muted">Severity:</span>
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                  selectedThreat.severity === 'critical' ? 'bg-severity-critical/20 text-severity-critical' :
                  selectedThreat.severity === 'high' ? 'bg-severity-high/20 text-severity-high' :
                  selectedThreat.severity === 'medium' ? 'bg-severity-medium/20 text-severity-medium' :
                  'bg-severity-low/20 text-severity-low'
                }`}>
                  {selectedThreat.severity.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-enterprise-text-muted">Last Seen:</span>
                <span className="ml-2 text-enterprise-text">{formatTimeAgo(selectedThreat.lastSeen)}</span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="default"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-4"
          >
            <AlertTriangle className="w-8 h-8 text-enterprise-text-muted mx-auto mb-2" />
            <p className="text-sm text-enterprise-text-muted">
              Click on a threat location to view details
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-enterprise-border-light">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-severity-critical rounded-full" />
            <span className="text-xs text-enterprise-text-muted">Critical</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-severity-high rounded-full" />
            <span className="text-xs text-enterprise-text-muted">High</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-severity-medium rounded-full" />
            <span className="text-xs text-enterprise-text-muted">Medium</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-severity-low rounded-full" />
            <span className="text-xs text-enterprise-text-muted">Low</span>
          </div>
        </div>
        
        <div className="text-xs text-enterprise-text-muted">
          Total: {threats.reduce((sum, threat) => sum + threat.threatCount, 0)} threats
        </div>
      </div>
    </motion.div>
  );
};

export default ThreatMap;