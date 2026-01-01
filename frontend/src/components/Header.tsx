import { useDashboardStore } from '../store';

export function Header() {
  const { wsConnected, trafficMetrics } = useDashboardStore();
  
  return (
    <header className="dashboard-header">
      {/* Brand */}
      <div className="header-brand">
        <div className="header-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h1 className="header-title">VARDAx</h1>
          <p className="header-subtitle">ML-Powered WAF Protection</p>
        </div>
      </div>
      
      {/* Live Stats */}
      <div className="header-stats">
        {trafficMetrics && (
          <>
            <div className="header-stat">
              <div className="header-stat-value" style={{ color: 'var(--text-primary)' }}>
                {trafficMetrics.requests_per_second.toFixed(0)}
              </div>
              <div className="header-stat-label">Requests/sec</div>
            </div>
            
            <div className="header-stat">
              <div className="header-stat-value" style={{ color: 'var(--accent-yellow)' }}>
                {trafficMetrics.anomalies_per_minute}
              </div>
              <div className="header-stat-label">Anomalies/min</div>
            </div>
            
            <div className="header-stat">
              <div className="header-stat-value" style={{ color: 'var(--accent-red)' }}>
                {trafficMetrics.blocked_requests}
              </div>
              <div className="header-stat-label">Blocked</div>
            </div>
          </>
        )}
        
        {/* Connection Status */}
        <div className="header-status">
          <div className={`status-dot ${wsConnected ? 'connected' : 'disconnected'}`} />
          <span style={{ color: wsConnected ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {wsConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>
    </header>
  );
}
