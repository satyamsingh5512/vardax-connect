import { useDashboardStore } from '../store';
import clsx from 'clsx';

export function Header() {
  const { wsConnected, trafficMetrics } = useDashboardStore();
  
  return (
    <header className="bg-vardax-card border-b border-vardax-border px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <img 
            src="/vardax-icon.svg" 
            alt="VARDAx Logo" 
            className="w-12 h-12 hover:scale-110 transition-transform duration-300"
          />
          <div>
            <h1 className="text-xl font-bold gradient-text-cyan-purple">VARDAx</h1>
            <p className="text-xs text-vardax-muted">ML-Powered WAF Protection</p>
          </div>
        </div>
        
        {/* Live Stats */}
        <div className="flex items-center gap-6">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div className={clsx(
              'w-2 h-2 rounded-full',
              wsConnected ? 'bg-severity-normal live-indicator' : 'bg-red-500'
            )} />
            <span className="text-sm text-vardax-muted">
              {wsConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
          
          {/* Traffic Counter */}
          {trafficMetrics && (
            <>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {trafficMetrics.requests_per_second.toFixed(0)}
                </div>
                <div className="text-xs text-vardax-muted">req/sec</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-severity-medium">
                  {trafficMetrics.anomalies_per_minute}
                </div>
                <div className="text-xs text-vardax-muted">anomalies/min</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-severity-high">
                  {trafficMetrics.blocked_requests}
                </div>
                <div className="text-xs text-vardax-muted">blocked</div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
