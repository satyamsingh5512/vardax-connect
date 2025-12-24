import { useState, useEffect } from 'react';
import { api } from '../api';
import clsx from 'clsx';

interface GeoPoint {
  lat: number;
  lng: number;
  country: string;
  count: number;
  anomaly_count: number;
  unique_ips: number;
}

/**
 * IP Geolocation Map Component
 * 
 * Shows global distribution of traffic with threat highlighting.
 * Uses a simple SVG world map for hackathon (no Leaflet dependency).
 * 
 * Privacy note: Shows country-level aggregation, not precise locations.
 */
export function GeoMap() {
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<GeoPoint | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'threats'>('all');
  
  useEffect(() => {
    const loadGeoData = async () => {
      try {
        const data = await api.getGeoThreats();
        setPoints(data);
      } catch (e) {
        setPoints(generateMockGeoData());
      }
    };
    
    loadGeoData();
    const interval = setInterval(loadGeoData, 30000);
    return () => clearInterval(interval);
  }, []);
  
  const filteredPoints = viewMode === 'threats'
    ? points.filter(p => p.anomaly_count > 0)
    : points;
  
  // Convert lat/lng to SVG coordinates (simple equirectangular projection)
  const toSvgCoords = (lat: number, lng: number) => ({
    x: ((lng + 180) / 360) * 800,
    y: ((90 - lat) / 180) * 400,
  });
  
  return (
    <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-medium text-white">Global Threat Map</h3>
          <p className="text-xs text-vardax-muted">
            Geographic distribution of traffic sources
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('all')}
            className={clsx(
              'px-3 py-1 text-xs rounded',
              viewMode === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-vardax-border text-vardax-muted'
            )}
          >
            All Traffic
          </button>
          <button
            onClick={() => setViewMode('threats')}
            className={clsx(
              'px-3 py-1 text-xs rounded',
              viewMode === 'threats'
                ? 'bg-severity-high text-white'
                : 'bg-vardax-border text-vardax-muted'
            )}
          >
            Threats Only
          </button>
        </div>
      </div>
      
      {/* SVG World Map */}
      <div className="relative bg-vardax-bg rounded-lg overflow-hidden">
        <svg
          viewBox="0 0 800 400"
          className="w-full h-64"
          style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a1f2e 100%)' }}
        >
          {/* Simple world outline */}
          <WorldOutline />
          
          {/* Grid lines */}
          {[...Array(7)].map((_, i) => (
            <line
              key={`h-${i}`}
              x1="0"
              y1={i * 66.67}
              x2="800"
              y2={i * 66.67}
              stroke="#2d3748"
              strokeWidth="0.5"
              strokeDasharray="4,4"
            />
          ))}
          {[...Array(9)].map((_, i) => (
            <line
              key={`v-${i}`}
              x1={i * 100}
              y1="0"
              x2={i * 100}
              y2="400"
              stroke="#2d3748"
              strokeWidth="0.5"
              strokeDasharray="4,4"
            />
          ))}
          
          {/* Data points */}
          {filteredPoints.map((point, i) => {
            const { x, y } = toSvgCoords(point.lat, point.lng);
            const hasAnomalies = point.anomaly_count > 0;
            const radius = Math.min(Math.max(point.count / 10, 4), 20);
            
            return (
              <g key={i}>
                {/* Pulse animation for threats */}
                {hasAnomalies && (
                  <circle
                    cx={x}
                    cy={y}
                    r={radius + 5}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    opacity="0.5"
                    className="animate-ping"
                  />
                )}
                
                {/* Main point */}
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={hasAnomalies ? '#ef4444' : '#10b981'}
                  opacity={0.8}
                  className="cursor-pointer hover:opacity-100 transition-opacity"
                  onClick={() => setSelectedPoint(point)}
                />
                
                {/* Count label for large points */}
                {point.count > 50 && (
                  <text
                    x={x}
                    y={y + 4}
                    textAnchor="middle"
                    fill="white"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    {point.count}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        
        {/* Stats overlay */}
        <div className="absolute top-2 left-2 bg-vardax-card/90 rounded px-2 py-1 text-xs">
          <span className="text-vardax-muted">Sources: </span>
          <span className="text-white font-medium">{points.length}</span>
          <span className="text-vardax-muted ml-2">Threats: </span>
          <span className="text-severity-high font-medium">
            {points.filter(p => p.anomaly_count > 0).length}
          </span>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-3 text-xs text-vardax-muted">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-severity-normal" />
          <span>Normal Traffic</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-severity-high animate-pulse" />
          <span>Threat Source</span>
        </div>
      </div>
      
      {/* Selected point detail */}
      {selectedPoint && (
        <div className="mt-4 p-3 bg-vardax-bg rounded border border-vardax-border">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium text-white">{selectedPoint.country}</h4>
              <p className="text-xs text-vardax-muted">
                {selectedPoint.lat.toFixed(1)}°, {selectedPoint.lng.toFixed(1)}°
              </p>
            </div>
            <button
              onClick={() => setSelectedPoint(null)}
              className="text-vardax-muted hover:text-white"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
            <div>
              <span className="text-vardax-muted">Requests</span>
              <div className="text-white font-medium">{selectedPoint.count}</div>
            </div>
            <div>
              <span className="text-vardax-muted">Anomalies</span>
              <div className={clsx(
                'font-medium',
                selectedPoint.anomaly_count > 0 ? 'text-severity-high' : 'text-severity-normal'
              )}>
                {selectedPoint.anomaly_count}
              </div>
            </div>
            <div>
              <span className="text-vardax-muted">Unique IPs</span>
              <div className="text-white font-medium">{selectedPoint.unique_ips}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple world map outline (simplified continents)
function WorldOutline() {
  return (
    <g fill="none" stroke="#3b82f6" strokeWidth="0.5" opacity="0.3">
      {/* North America */}
      <path d="M 50 80 Q 100 60 150 80 L 180 120 Q 160 180 100 200 L 50 160 Z" />
      {/* South America */}
      <path d="M 120 220 Q 150 240 160 300 L 140 360 Q 100 380 90 340 L 100 260 Z" />
      {/* Europe */}
      <path d="M 350 80 Q 400 60 450 80 L 460 120 Q 440 140 380 130 Z" />
      {/* Africa */}
      <path d="M 380 160 Q 420 150 460 180 L 450 280 Q 400 320 360 280 L 370 200 Z" />
      {/* Asia */}
      <path d="M 480 60 Q 600 40 700 80 L 720 160 Q 680 200 580 180 L 500 140 Z" />
      {/* Australia */}
      <path d="M 620 280 Q 680 260 720 300 L 700 340 Q 640 360 620 320 Z" />
    </g>
  );
}

function generateMockGeoData(): GeoPoint[] {
  return [
    { lat: 40.7, lng: -74.0, country: 'United States', count: 150, anomaly_count: 12, unique_ips: 45 },
    { lat: 51.5, lng: -0.1, country: 'United Kingdom', count: 80, anomaly_count: 3, unique_ips: 28 },
    { lat: 35.7, lng: 139.7, country: 'Japan', count: 60, anomaly_count: 0, unique_ips: 22 },
    { lat: 52.5, lng: 13.4, country: 'Germany', count: 45, anomaly_count: 5, unique_ips: 18 },
    { lat: 55.8, lng: 37.6, country: 'Russia', count: 90, anomaly_count: 25, unique_ips: 35 },
    { lat: 31.2, lng: 121.5, country: 'China', count: 120, anomaly_count: 18, unique_ips: 50 },
    { lat: -33.9, lng: 151.2, country: 'Australia', count: 30, anomaly_count: 1, unique_ips: 12 },
    { lat: 19.4, lng: -99.1, country: 'Mexico', count: 25, anomaly_count: 8, unique_ips: 10 },
    { lat: -23.5, lng: -46.6, country: 'Brazil', count: 40, anomaly_count: 6, unique_ips: 15 },
    { lat: 28.6, lng: 77.2, country: 'India', count: 70, anomaly_count: 4, unique_ips: 30 },
  ];
}
