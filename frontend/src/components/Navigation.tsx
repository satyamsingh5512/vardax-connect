import { useDashboardStore } from '../store';
import clsx from 'clsx';

const tabs = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'traffic', label: 'Live Traffic', icon: '📡' },
  { id: 'anomalies', label: 'Anomalies', icon: '⚠️' },
  { id: 'rules', label: 'Rules', icon: '📋' },
  { id: 'replay', label: 'Replay', icon: '⏪' },
  { id: 'heatmap', label: 'Heatmap & Map', icon: '🗺️' },
  { id: 'simulate', label: 'Simulate', icon: '🔬' },
  { id: 'models', label: 'ML Health', icon: '🧠' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
] as const;

export function Navigation() {
  const { activeTab, setActiveTab, anomalies, pendingRules } = useDashboardStore();
  
  const anomalyCount = anomalies.filter(a => a.status === 'new').length;
  const pendingCount = pendingRules.filter(r => r.status === 'pending').length;
  
  return (
    <nav className="bg-vardax-card border-b border-vardax-border">
      <div className="flex px-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-vardax-muted hover:text-white'
            )}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            
            {/* Badge for anomalies */}
            {tab.id === 'anomalies' && anomalyCount > 0 && (
              <span className="bg-severity-high text-white text-xs px-2 py-0.5 rounded-full">
                {anomalyCount}
              </span>
            )}
            
            {/* Badge for pending rules */}
            {tab.id === 'rules' && pendingCount > 0 && (
              <span className="bg-severity-medium text-white text-xs px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
