import { useDashboardStore } from '../store';

const tabs = [
  { id: 'overview', label: 'Overview', icon: '📊', color: '#3b82f6' },
  { id: 'traffic', label: 'Live Traffic', icon: '📡', color: '#10b981' },
  { id: 'anomalies', label: 'Anomalies', icon: '⚠️', color: '#f59e0b' },
  { id: 'rules', label: 'Rules', icon: '📋', color: '#a855f7' },
  { id: 'replay', label: 'Replay', icon: '⏪', color: '#06b6d4' },
  { id: 'heatmap', label: 'Heatmap & Map', icon: '🗺️', color: '#ec4899' },
  { id: 'simulate', label: 'Simulate', icon: '🔬', color: '#8b5cf6' },
  { id: 'models', label: 'ML Health', icon: '🧠', color: '#14b8a6' },
  { id: 'settings', label: 'Settings', icon: '⚙️', color: '#6b7280' },
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
            style={activeTab === tab.id ? { 
              color: tab.color,
              background: `linear-gradient(135deg, ${tab.color}15, ${tab.color}05)`,
            } : undefined}
          >
            <span className="nav-tab-icon" style={activeTab === tab.id ? { filter: 'drop-shadow(0 0 4px currentColor)' } : undefined}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
            
            {/* Badge for anomalies */}
            {tab.id === 'anomalies' && anomalyCount > 0 && (
              <span className="nav-badge glow-red" style={{ animation: 'pulse 2s ease-in-out infinite' }}>
                {anomalyCount}
              </span>
            )}
            
            {/* Badge for pending rules */}
            {tab.id === 'rules' && pendingCount > 0 && (
              <span className="nav-badge warning glow-purple" style={{ animation: 'pulse 2s ease-in-out infinite' }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
