import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Activity, TrendingUp } from 'lucide-react';

interface ActivityChartProps {
  timeRange: '1h' | '24h' | '7d' | '30d';
}

// Mock data - in production this would come from your API
const generateMockData = (timeRange: string) => {
  const dataPoints = timeRange === '1h' ? 60 : timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : 30;
  const data = [];
  
  for (let i = 0; i < dataPoints; i++) {
    data.push({
      time: timeRange === '1h' ? `${i}m` : 
            timeRange === '24h' ? `${i}:00` :
            timeRange === '7d' ? `Day ${i + 1}` :
            `Week ${i + 1}`,
      requests: Math.floor(Math.random() * 1000) + 500,
      threats: Math.floor(Math.random() * 50) + 10,
      blocked: Math.floor(Math.random() * 30) + 5,
    });
  }
  
  return data;
};

const ActivityChart: React.FC<ActivityChartProps> = ({ timeRange }) => {
  const data = generateMockData(timeRange);

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
        
        <div className="flex items-center space-x-2 text-sm text-status-success">
          <TrendingUp className="w-4 h-4" />
          <span>+12.5% from last period</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
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