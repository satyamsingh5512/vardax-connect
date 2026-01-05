import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

interface TrafficEvent {
  request_id: string;
  timestamp: string;
  client_ip: string;
  method: string;
  uri: string;
  status_code: number;
  response_time_ms: number;
  user_agent: string;
  content_length: number;
  is_anomaly: boolean;
  anomaly_score: number;
  severity: 'normal' | 'low' | 'medium' | 'high' | 'critical';
  attack_category?: string;
  country?: string;
}

export function LiveTraffic() {
  const [events, setEvents] = useState<TrafficEvent[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<'all' | 'anomalies' | 'blocked'>('all');
  const [selectedEvent, setSelectedEvent] = useState<TrafficEvent | null>(null);
  const [stats, setStats] = useState({ total: 0, anomalies: 0, blocked: 0, rps: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/ws/traffic`;
    
    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (isPaused) return;
        
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'traffic') {
            setEvents(prev => [data.event, ...prev].slice(0, 500));
            setStats(prev => ({
              total: prev.total + 1,
              anomalies: prev.anomalies + (data.event.is_anomaly ? 1 : 0),
              blocked: prev.blocked + (data.event.severity === 'critical' ? 1 : 0),
              rps: data.rps || prev.rps
            }));
          } else if (data.type === 'stats') {
            setStats(data.stats);
          }
        } catch (e) {
          console.error('Traffic WS error:', e);
        }
      };

      ws.onclose = () => {
        setTimeout(connect, 3000);
      };
    };

    connect();
    loadRecentTraffic();

    return () => {
      wsRef.current?.close();
    };
  }, [isPaused]);

  const loadRecentTraffic = async () => {
    try {
      const data = await api.getReplayTimeline(5);
      const mapped = data.map((e: any) => ({
        request_id: e.request_id || `req-${Date.now()}-${Math.random()}`,
        timestamp: e.timestamp,
        client_ip: e.client_ip,
        method: e.method || 'GET',
        uri: e.uri,
        status_code: e.status_code || 200,
        response_time_ms: e.response_time_ms || Math.random() * 50,
        user_agent: e.user_agent || 'Unknown',
        content_length: e.content_length || 0,
        is_anomaly: e.is_anomaly || e.severity !== 'normal',
        anomaly_score: e.anomaly_score || e.confidence || 0,
        severity: e.severity || 'normal',
        attack_category: e.attack_category,
        country: e.country
      }));
      setEvents(mapped);
    } catch (e) {
      setEvents(generateMockTraffic(50));
    }
  };

  const filteredEvents = events.filter(e => {
    if (filter === 'anomalies') return e.is_anomaly;
    if (filter === 'blocked') return e.severity === 'critical';
    return true;
  });

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'var(--accent-blue)';
      case 'POST': return 'var(--accent-green)';
      case 'PUT': return 'var(--accent-yellow)';
      case 'DELETE': return 'var(--accent-red)';
      default: return 'var(--text-tertiary)';
    }
  };

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Header with live stats */}
      <div className="p-4" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span 
                className="w-2 h-2 rounded-full"
                style={{ 
                  backgroundColor: isPaused ? '#f59e0b' : '#10b981',
                  boxShadow: isPaused ? '0 0 10px rgba(245, 158, 11, 0.5)' : '0 0 15px rgba(16, 185, 129, 0.6), 0 0 30px rgba(16, 185, 129, 0.3)',
                  animation: isPaused ? 'none' : 'pulse 2s ease-in-out infinite'
                }}
              />
              Live Traffic Stream
            </h2>
            
            {/* Live counters */}
            <div className="flex items-center gap-6 ml-6">
              <div className="header-stat">
                <div className="header-stat-value gradient-text-vibrant" style={{ fontSize: '20px' }}>{stats.rps}</div>
                <div className="header-stat-label">req/sec</div>
              </div>
              <div className="header-stat">
                <div className="header-stat-value" style={{ fontSize: '20px', color: '#3b82f6' }}>{stats.total}</div>
                <div className="header-stat-label">total</div>
              </div>
              <div className="header-stat">
                <div className="header-stat-value" style={{ fontSize: '20px', color: '#f59e0b' }}>{stats.anomalies}</div>
                <div className="header-stat-label">anomalies</div>
              </div>
              <div className="header-stat">
                <div className="header-stat-value" style={{ fontSize: '20px', color: '#ef4444' }}>{stats.blocked}</div>
                <div className="header-stat-label">blocked</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter buttons */}
            <div className="filter-group">
              {(['all', 'anomalies', 'blocked'] as const).map((f) => {
                const colors = {
                  all: { bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(168, 85, 247, 0.1))', border: '#3b82f6', glow: 'rgba(59, 130, 246, 0.3)' },
                  anomalies: { bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(251, 191, 36, 0.1))', border: '#f59e0b', glow: 'rgba(245, 158, 11, 0.3)' },
                  blocked: { bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.1))', border: '#ef4444', glow: 'rgba(239, 68, 68, 0.3)' },
                };
                const isActive = filter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`filter-pill ${isActive ? 'active' : ''}`}
                    style={isActive ? {
                      background: colors[f].bg,
                      borderColor: colors[f].border,
                      color: colors[f].border,
                      boxShadow: `0 0 15px ${colors[f].glow}`,
                    } : undefined}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                );
              })}
            </div>

            {/* Pause/Resume */}
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`btn ${isPaused ? 'btn-success' : 'btn-ghost'}`}
              style={isPaused ? {} : { borderColor: 'var(--accent-yellow)', color: 'var(--accent-yellow)' }}
            >
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>

            {/* Clear */}
            <button
              onClick={() => setEvents([])}
              className="btn btn-ghost"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Traffic table */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto" ref={containerRef}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '96px' }}>Time</th>
                <th style={{ width: '64px' }}>Method</th>
                <th>URI</th>
                <th style={{ width: '128px' }}>Client IP</th>
                <th style={{ width: '80px' }}>Status</th>
                <th style={{ width: '80px' }}>Latency</th>
                <th style={{ width: '96px' }}>ML Score</th>
                <th style={{ width: '96px' }}>Severity</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event, idx) => (
                <tr
                  key={event.request_id + idx}
                  onClick={() => setSelectedEvent(event)}
                  className={`cursor-pointer ${event.is_anomaly ? 'anomaly' : ''} ${selectedEvent?.request_id === event.request_id ? 'selected' : ''}`}
                >
                  <td className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="font-mono font-medium" style={{ color: getMethodColor(event.method) }}>
                    {event.method}
                  </td>
                  <td className="truncate max-w-xs" style={{ color: 'var(--text-primary)' }} title={event.uri}>
                    {event.uri}
                  </td>
                  <td className="font-mono" style={{ color: 'var(--text-tertiary)' }}>
                    {event.client_ip}
                  </td>
                  <td className="font-mono" style={{ color: event.status_code >= 400 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                    {event.status_code}
                  </td>
                  <td style={{ color: 'var(--text-tertiary)' }}>
                    {event.response_time_ms.toFixed(1)}ms
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="progress-bar w-16">
                        <div
                          className={`progress-fill ${
                            event.anomaly_score > 0.7 ? 'red' :
                            event.anomaly_score > 0.4 ? 'yellow' : 'green'
                          }`}
                          style={{ width: `${event.anomaly_score * 100}%` }}
                        />
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {(event.anomaly_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`severity-badge ${event.severity}`}>
                      <span className={`severity-dot ${event.severity}`} />
                      {event.severity.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredEvents.length === 0 && (
            <div className="empty-state h-64">
              <div className="empty-state-icon">{isPaused ? '⏸' : '📡'}</div>
              <div className="empty-state-text">{isPaused ? 'Stream paused' : 'Waiting for traffic...'}</div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedEvent && (
          <div className="detail-panel animate-slide-in">
            <div className="detail-header">
              <h3 className="detail-title">Request Details</h3>
              <button onClick={() => setSelectedEvent(null)} className="detail-close">✕</button>
            </div>
            
            <div className="detail-body space-y-4">
              {/* Request info */}
              <div className="detail-section">
                <div className="detail-section-title">Request</div>
                <div className="p-3 rounded font-mono text-sm" style={{ background: 'var(--bg-tertiary)' }}>
                  <span style={{ color: getMethodColor(selectedEvent.method) }}>{selectedEvent.method}</span>
                  <span className="ml-2" style={{ color: 'var(--text-primary)' }}>{selectedEvent.uri}</span>
                </div>
              </div>

              {/* Client info */}
              <div className="detail-section">
                <div className="detail-section-title">Client</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>IP Address</div>
                    <div className="font-mono" style={{ color: 'var(--text-primary)' }}>{selectedEvent.client_ip}</div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Country</div>
                    <div style={{ color: 'var(--text-primary)' }}>{selectedEvent.country || 'Unknown'}</div>
                  </div>
                </div>
              </div>

              {/* Response info */}
              <div className="detail-section">
                <div className="detail-section-title">Response</div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Status</div>
                    <div className="font-mono" style={{ color: selectedEvent.status_code >= 400 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                      {selectedEvent.status_code}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Latency</div>
                    <div style={{ color: 'var(--text-primary)' }}>{selectedEvent.response_time_ms.toFixed(1)}ms</div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Size</div>
                    <div style={{ color: 'var(--text-primary)' }}>{selectedEvent.content_length}B</div>
                  </div>
                </div>
              </div>

              {/* User Agent */}
              <div className="detail-section">
                <div className="detail-section-title">User Agent</div>
                <div className="text-sm break-all" style={{ color: 'var(--text-secondary)' }}>{selectedEvent.user_agent}</div>
              </div>

              {/* ML Analysis */}
              <div className="detail-section">
                <div className="detail-section-title">ML Analysis</div>
                <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="card-body space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span style={{ color: 'var(--text-tertiary)' }}>Anomaly Score</span>
                        <span style={{ color: 'var(--text-primary)' }}>{(selectedEvent.anomaly_score * 100).toFixed(1)}%</span>
                      </div>
                      <div className="progress-bar h-2">
                        <div
                          className={`progress-fill ${
                            selectedEvent.anomaly_score > 0.7 ? 'red' :
                            selectedEvent.anomaly_score > 0.4 ? 'yellow' : 'green'
                          }`}
                          style={{ width: `${selectedEvent.anomaly_score * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Severity</span>
                      <span className={`severity-badge ${selectedEvent.severity}`}>
                        {selectedEvent.severity.toUpperCase()}
                      </span>
                    </div>

                    {selectedEvent.attack_category && (
                      <div className="detail-row">
                        <span className="detail-label">Attack Type</span>
                        <span style={{ color: 'var(--accent-yellow)' }}>{selectedEvent.attack_category}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {selectedEvent.is_anomaly && (
                <div className="flex gap-2">
                  <button className="btn btn-danger flex-1">Block IP</button>
                  <button className="btn btn-ghost flex-1">False Positive</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function generateMockTraffic(count: number): TrafficEvent[] {
  const methods = ['GET', 'POST', 'PUT', 'DELETE'];
  const uris = [
    '/api/v1/users', '/api/v1/products', '/api/v1/orders', '/api/v1/auth/login',
    '/api/v1/search', '/api/v1/cart', '/api/v1/checkout', '/api/v1/profile'
  ];
  const severities: TrafficEvent['severity'][] = ['normal', 'normal', 'normal', 'low', 'medium', 'high', 'critical'];
  const categories = ['rate_abuse', 'bot_attack', 'credential_stuffing', 'reconnaissance', 'injection_attempt'];

  return Array.from({ length: count }, (_, i) => {
    const isAnomaly = Math.random() > 0.85;
    const severity = isAnomaly ? severities[Math.floor(Math.random() * 4) + 3] : 'normal';
    
    return {
      request_id: `req-${Date.now()}-${i}`,
      timestamp: new Date(Date.now() - i * 1000).toISOString(),
      client_ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      method: methods[Math.floor(Math.random() * methods.length)],
      uri: uris[Math.floor(Math.random() * uris.length)],
      status_code: Math.random() > 0.9 ? 403 : Math.random() > 0.95 ? 500 : 200,
      response_time_ms: Math.random() * 100,
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      content_length: Math.floor(Math.random() * 5000),
      is_anomaly: isAnomaly,
      anomaly_score: isAnomaly ? 0.5 + Math.random() * 0.5 : Math.random() * 0.3,
      severity,
      attack_category: isAnomaly ? categories[Math.floor(Math.random() * categories.length)] : undefined,
      country: ['US', 'CN', 'RU', 'DE', 'BR', 'IN'][Math.floor(Math.random() * 6)]
    };
  });
}
