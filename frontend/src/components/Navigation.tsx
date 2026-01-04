import { useDashboardStore } from '../store';

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
    <nav className="dashboard-nav">
      <div className="nav-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
          >
            <span className="nav-tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
            
            {/* Badge for anomalies */}
            {tab.id === 'anomalies' && anomalyCount > 0 && (
              <span className="nav-badge">{anomalyCount}</span>
            )}
            
            {/* Badge for pending rules */}
            {tab.id === 'rules' && pendingCount > 0 && (
              <span className="nav-badge warning">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
