import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Activity, TrendingUp } from 'lucide-react';
import { apiService } from '../../services/api';

interface ActivityChartProps {
  timeRange: '1h' | '24h' | '7d' | '30d';
}

interface ChartDataPoint {
  time: string;
  requests: number;
  threats: number;
  blocked: number;
}

const ActivityChart: React.FC<ActivityChartProps> = ({ timeRange }) => {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch real traffic data from API
  const fetchChartData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // For now, we'll use the current metrics as a single data point
      // In a full implementation, you'd have a time-series endpoint
      const trafficMetrics = await apiService.getTrafficMetrics();
      const liveStats = await apiService.getLiveStats();

      // Create a single data point with current values
      // In production, you'd fetch historical time-series data
      const currentDataPoint: ChartDataPoint = {
        time: new Date().toLocaleTimeString(),
        requests: Math.round(trafficMetrics.requests_per_second * 60), // Convert to requests per minute
        threats: liveStats.anomalies_last_minute,
        blocked: liveStats.threats_blocked
      };

      setData([currentDataPoint]);
    } catch (err) {
      console.error('Failed to fetch chart data:', err);
      setError('Failed to load chart data');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchChartData, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-enterprise-elevated border border-enterprise-border-light rounded-lg p-3 shadow-enterprise-lg">
          <p className="text-sm font-medium text-enterprise-text mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center space-x-2 text-xs">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-enterprise-text-muted">{entry.name}:</span>
              <span className="text-enterprise-text font-medium">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="bg-enterprise-card/50 backdrop-blur-sm border border-enterprise-border-light rounded-xl p-6">
        <div className="flex items-center justify-center h-80">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-enterprise-text-muted">Loading chart data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-enterprise-card/50 backdrop-blur-sm border border-enterprise-border-light rounded-xl p-6">
        <div className="flex items-center justify-center h-80">
          <div className="text-center">
            <p className="text-sm text-status-error mb-2">{error}</p>
            <button 
              onClick={fetchChartData}
              className="text-xs text-brand-primary hover:text-brand-primary-hover"
            >
              Retry
            </button>
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
            <Activity className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-enterprise-text">Traffic Activity</h3>
            <p className="text-sm text-enterprise-text-muted">Real-time request monitoring</p>
          </div>
        </div>
        
        {data.length > 0 && (
          <div className="flex items-center space-x-2 text-sm text-status-success">
            <TrendingUp className="w-4 h-4" />
            <span>Live Data</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-80">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-enterprise-text-muted">No traffic data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0066ff" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#0066ff" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="threatsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e84393" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#e84393" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="blockedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00b894" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00b894" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#2d323c" 
                opacity={0.3}
              />
              <XAxis 
                dataKey="time" 
                stroke="#8892a6"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#8892a6"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              
              <Area
                type="monotone"
                dataKey="requests"
                stroke="#0066ff"
                strokeWidth={2}
                fill="url(#requestsGradient)"
                name="Requests"
              />
              <Area
                type="monotone"
                dataKey="threats"
                stroke="#e84393"
                strokeWidth={2}
                fill="url(#threatsGradient)"
                name="Threats"
              />
              <Area
                type="monotone"
                dataKey="blocked"
                stroke="#00b894"
                strokeWidth={2}
                fill="url(#blockedGradient)"
                name="Blocked"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 mt-4 pt-4 border-t border-enterprise-border-light">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-brand-primary rounded-full" />
          <span className="text-sm text-enterprise-text-muted">Total Requests</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-status-error rounded-full" />
          <span className="text-sm text-enterprise-text-muted">Threats Detected</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-status-success rounded-full" />
          <span className="text-sm text-enterprise-text-muted">Threats Blocked</span>
        </div>
      </div>
    </motion.div>
  );
};

export default ActivityChart;