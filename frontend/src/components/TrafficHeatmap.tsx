import { useState, useEffect } from 'react';
import { api } from '../api';
import clsx from 'clsx';

interface HeatmapCell {
  time: string;
  endpoint: string;
  count: number;
  intensity: number;
}

export function TrafficHeatmap() {
  const [data, setData] = useState<HeatmapCell[]>([]);
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);
  const [timeRange, setTimeRange] = useState(60);
  
  useEffect(() => {
    const loadHeatmap = async () => {
      try {
        const heatmapData = await api.getHeatmap(timeRange);
        setData(heatmapData);
      } catch (e) {
        // Use mock data
        setData(generateMockHeatmap());
      }
    };
    
    loadHeatmap();
    const interval = setInterval(loadHeatmap, 10000);
    return () => clearInterval(interval);
  }, [timeRange]);
  
  // Group by endpoint for Y-axis
  const endpoints = [...new Set(data.map(d => d.endpoint))].slice(0, 10);
  const times = [...new Set(data.map(d => d.time))].sort();
  
  // Create grid
  const grid: Record<string, Record<string, HeatmapCell>> = {};
  for (const cell of data) {
    if (!grid[cell.endpoint]) grid[cell.endpoint] = {};
    grid[cell.endpoint][cell.time] = cell;
  }
  
  return (
    <div className="bg-vardax-card rounded-lg p-4 border border-vardax-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-medium text-white">Traffic Heatmap</h3>
          <p className="text-xs text-vardax-muted">
            Request intensity by endpoint and time
          </p>
        </div>
        
        {/* Time range selector */}
        <div className="flex gap-2">
          {[30, 60, 120].map(mins => (
            <button
              key={mins}
              onClick={() => setTimeRange(mins)}
              className={clsx(
                'px-2 py-1 text-xs rounded',
                timeRange === mins
                  ? 'bg-blue-500 text-white'
                  : 'bg-vardax-border text-vardax-muted'
              )}
            >
              {mins}m
            </button>
          ))}
        </div>
      </div>
      
      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Time labels */}
          <div className="flex mb-1 ml-32">
            {times.map(time => (
              <div key={time} className="w-8 text-xs text-vardax-muted text-center">
                {time}
              </div>
            ))}
          </div>
          
          {/* Grid rows */}
          {endpoints.map(endpoint => (
            <div key={endpoint} className="flex items-center mb-1">
              {/* Endpoint label */}
              <div className="w-32 text-xs text-vardax-muted truncate pr-2" title={endpoint}>
                {endpoint}
              </div>
              
              {/* Cells */}
              <div className="flex gap-0.5">
                {times.map(time => {
                  const cell = grid[endpoint]?.[time];
                  const intensity = cell?.intensity || 0;
                  
                  return (
                    <div
                      key={`${endpoint}-${time}`}
                      onClick={() => cell && setSelectedCell(cell)}
                      className={clsx(
                        'w-7 h-7 rounded cursor-pointer transition-all duration-300',
                        'hover:ring-1 hover:ring-white/50',
                        cell && selectedCell?.time === time && selectedCell?.endpoint === endpoint && 'ring-2 ring-white'
                      )}
                      style={{
                        backgroundColor: intensity > 0.7
                          ? `rgba(239, 68, 68, ${intensity})`  // Red for high
                          : intensity > 0.3
                            ? `rgba(245, 158, 11, ${intensity})` // Amber for medium
                            : `rgba(16, 185, 129, ${Math.max(intensity, 0.1)})`, // Green for low
                      }}
                      title={cell ? `${cell.count} requests` : 'No data'}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-vardax-muted">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-severity-normal/30" />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-severity-medium/70" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-severity-high/90" />
          <span>High</span>
        </div>
      </div>
      
      {/* Selected cell detail */}
      {selectedCell && (
        <div className="mt-4 p-3 bg-vardax-bg rounded border border-vardax-border">
          <div className="flex justify-between text-sm">
            <span className="text-vardax-muted">Endpoint:</span>
            <span className="text-vardax-text font-mono">{selectedCell.endpoint}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-vardax-muted">Time:</span>
            <span className="text-vardax-text">{selectedCell.time}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-vardax-muted">Requests:</span>
            <span className="text-vardax-text">{selectedCell.count}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-vardax-muted">Intensity:</span>
            <span className={clsx(
              selectedCell.intensity > 0.7 ? 'text-severity-high' :
              selectedCell.intensity > 0.3 ? 'text-severity-medium' : 'text-severity-normal'
            )}>
              {(selectedCell.intensity * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function generateMockHeatmap(): HeatmapCell[] {
  const endpoints = ['/api/users', '/api/products', '/api/orders', '/api/login', '/api/search'];
  const cells: HeatmapCell[] = [];
  
  for (let h = 0; h < 12; h++) {
    const time = `${String(h).padStart(2, '0')}:00`;
    for (const endpoint of endpoints) {
      const isLoginSpike = endpoint === '/api/login' && (h === 3 || h === 7);
      const intensity = isLoginSpike ? 0.8 + Math.random() * 0.2 : Math.random() * 0.5;
      
      cells.push({
        time,
        endpoint,
        count: Math.floor(intensity * 100),
        intensity,
      });
    }
  }
  
  return cells;
}
