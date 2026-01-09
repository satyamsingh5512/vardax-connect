import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, MapPin, Shield } from 'lucide-react';

const ThreatMap: React.FC = () => {
  const [geoData, setGeoData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch real geographic threat data
  const fetchGeoData = async () => {
    try {
      setError(null);
      // Note: This endpoint may not exist yet in the backend
      // For now, we'll show a "no data" state
      setGeoData([]);
    } catch (err) {
      console.error('Failed to fetch geo data:', err);
      setError('Geographic data not available');
      setGeoData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGeoData();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchGeoData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-enterprise-card/50 backdrop-blur-sm border border-enterprise-border-light rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-brand-primary/10 border border-brand-primary/20 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-enterprise-text">Threat Map</h3>
            <p className="text-sm text-enterprise-text-muted">Geographic threat distribution</p>
          </div>
        </div>
        
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-enterprise-text-muted">Loading map data...</p>
          </div>
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
          <div className="w-10 h-10 bg-brand-primary/10 border border-brand-primary/20 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-enterprise-text">Threat Map</h3>
            <p className="text-sm text-enterprise-text-muted">Geographic threat distribution</p>
          </div>
        </div>
        
        <button 
          onClick={fetchGeoData}
          className="text-xs text-brand-primary hover:text-brand-primary-hover"
        >
          Refresh
        </button>
      </div>

      {/* Map Content */}
      <div className="h-64 flex items-center justify-center">
        {error ? (
          <div className="text-center">
            <MapPin className="w-12 h-12 text-enterprise-text-muted mx-auto mb-3 opacity-50" />
            <p className="text-sm text-enterprise-text-muted mb-2">{error}</p>
            <button 
              onClick={fetchGeoData}
              className="text-xs text-brand-primary hover:text-brand-primary-hover"
            >
              Retry
            </button>
          </div>
        ) : geoData.length === 0 ? (
          <div className="text-center">
            <Shield className="w-12 h-12 text-status-success mx-auto mb-3 opacity-50" />
            <p className="text-sm text-enterprise-text-muted">No geographic threat data available</p>
            <p className="text-xs text-enterprise-text-muted mt-1">
              Geographic data will appear when traffic is processed
            </p>
          </div>
        ) : (
          // This would contain the actual map visualization when data is available
          <div className="w-full h-full bg-enterprise-hover/20 rounded-lg flex items-center justify-center">
            <p className="text-sm text-enterprise-text-muted">Map visualization would appear here</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-enterprise-border-light">
        <div className="flex items-center justify-between text-xs text-enterprise-text-muted">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-severity-low rounded-full"></div>
              <span>Low</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-severity-medium rounded-full"></div>
              <span>Medium</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-severity-high rounded-full"></div>
              <span>High</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-severity-critical rounded-full"></div>
              <span>Critical</span>
            </div>
          </div>
          <span>Real-time threat locations</span>
        </div>
      </div>
    </motion.div>
  );
};

export default ThreatMap;