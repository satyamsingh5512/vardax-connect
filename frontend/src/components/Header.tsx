import { useDashboardStore } from '../store';
import { useTheme } from '../contexts/ThemeContext';

// Sun icon for light mode
function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

// Moon icon for dark mode
function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function Header() {
  const { wsConnected, trafficMetrics } = useDashboardStore();
  const { theme, toggleTheme } = useTheme();
  
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
        
        {/* Theme Toggle */}
        <button 
          className="theme-toggle" 
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        
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
