import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import clsx from 'clsx';

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

  // Connect to live traffic WebSocket
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

    // Load initial data
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
      // Generate mock data for demo
      setEvents(generateMockTraffic(50));
    }
  };

  const filteredEvents = events.filter(e => {
    if (filter === 'anomalies') return e.is_anomaly;
    if (filter === 'blocked') return e.severity === 'critical';
    return true;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-500/10';
      case 'high': return 'text-red-400 bg-red-400/10';
      case 'medium': return 'text-amber-400 bg-amber-400/10';
      case 'low': return 'text-yellow-400 bg-yellow-400/10';
      default: return 'text-green-400 bg-green-400/10';
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'text-blue-400';
      case 'POST': return 'text-green-400';
      case 'PUT': return 'text-amber-400';
      case 'DELETE': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with live stats */}
      <div className="bg-vardax-card border-b border-vardax-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className={clsx(
                'w-2 h-2 rounded-full',
                isPaused ? 'bg-amber-500' : 'bg-green-500 animate-pulse'
              )} />
              Live Traffic Stream
            </h2>
            
            {/* Live counters */}
            <div className="flex items-center gap-6 ml-6">
              <div className="text-center">
                <div className="text-xl font-bold text-white">{stats.rps}</div>
                <div className="text-xs text-vardax-muted">req/sec</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-400">{stats.total}</div>
                <div className="text-xs text-vardax-muted">total</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-amber-400">{stats.anomalies}</div>
                <div className="text-xs text-vardax-muted">anomalies</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-red-400">{stats.blocked}</div>
                <div className="text-xs text-vardax-muted">blocked</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter buttons */}
            <div className="flex bg-vardax-bg rounded-lg p-1">
              {(['all', 'anomalies', 'blocked'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={clsx(
                    'px-3 py-1 text-sm rounded-md transition-colors',
                    filter === f
                      ? 'bg-blue-600 text-white'
                      : 'text-vardax-muted hover:text-white'
                  )}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Pause/Resume */}
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                isPaused
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              )}
            >
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>

            {/* Clear */}
            <button
              onClick={() => setEvents([])}
              className="px-4 py-2 bg-vardax-border hover:bg-vardax-card rounded-lg text-sm text-vardax-muted"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Traffic table */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto" ref={containerRef}>
          <table className="w-full text-sm">
            <thead className="bg-vardax-card sticky top-0 z-10">
              <tr className="text-left text-vardax-muted border-b border-vardax-border">
                <th className="px-4 py-3 w-24">Time</th>
                <th className="px-4 py-3 w-16">Method</th>
                <th className="px-4 py-3">URI</th>
                <th className="px-4 py-3 w-32">Client IP</th>
                <th className="px-4 py-3 w-20">Status</th>
                <th className="px-4 py-3 w-20">Latency</th>
                <th className="px-4 py-3 w-24">ML Score</th>
                <th className="px-4 py-3 w-24">Severity</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event, idx) => (
                <tr
                  key={event.request_id + idx}
                  onClick={() => setSelectedEvent(event)}
                  className={clsx(
                    'border-b border-vardax-border/50 cursor-pointer transition-colors',
                    event.is_anomaly ? 'bg-red-500/5' : 'hover:bg-vardax-card/50',
                    selectedEvent?.request_id === event.request_id && 'bg-blue-500/10'
                  )}
                >
                  <td className="px-4 py-2 text-vardax-muted font-mono text-xs">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </td>
                  <td className={clsx('px-4 py-2 font-mono font-medium', getMethodColor(event.method))}>
                    {event.method}
                  </td>
                  <td className="px-4 py-2 text-white truncate max-w-xs" title={event.uri}>
                    {event.uri}
                  </td>
                  <td className="px-4 py-2 text-vardax-muted font-mono">
                    {event.client_ip}
                  </td>
                  <td className={clsx(
                    'px-4 py-2 font-mono',
                    event.status_code >= 400 ? 'text-red-400' : 'text-green-400'
                  )}>
                    {event.status_code}
                  </td>
                  <td className="px-4 py-2 text-vardax-muted">
                    {event.response_time_ms.toFixed(1)}ms
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-vardax-border rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            'h-full rounded-full',
                            event.anomaly_score > 0.7 ? 'bg-red-500' :
                            event.anomaly_score > 0.4 ? 'bg-amber-500' : 'bg-green-500'
                          )}
                          style={{ width: `${event.anomaly_score * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-vardax-muted">
                        {(event.anomaly_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={clsx(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      getSeverityColor(event.severity)
                    )}>
                      {event.severity.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredEvents.length === 0 && (
            <div className="flex items-center justify-center h-64 text-vardax-muted">
              {isPaused ? 'Stream paused' : 'Waiting for traffic...'}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedEvent && (
          <div className="w-96 border-l border-vardax-border bg-vardax-card overflow-auto">
            <div className="p-4 border-b border-vardax-border flex items-center justify-between">
              <h3 className="font-semibold text-white">Request Details</h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-vardax-muted hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Request info */}
              <div>
                <div className="text-xs text-vardax-muted mb-1">Request</div>
                <div className="bg-vardax-bg rounded p-3 font-mono text-sm">
                  <span className={getMethodColor(selectedEvent.method)}>{selectedEvent.method}</span>
                  <span className="text-white ml-2">{selectedEvent.uri}</span>
                </div>
              </div>

              {/* Client info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-vardax-muted mb-1">Client IP</div>
                  <div className="text-white font-mono">{selectedEvent.client_ip}</div>
                </div>
                <div>
                  <div className="text-xs text-vardax-muted mb-1">Country</div>
                  <div className="text-white">{selectedEvent.country || 'Unknown'}</div>
                </div>
              </div>

              {/* Response info */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-vardax-muted mb-1">Status</div>
                  <div className={clsx(
                    'font-mono',
                    selectedEvent.status_code >= 400 ? 'text-red-400' : 'text-green-400'
                  )}>
                    {selectedEvent.status_code}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-vardax-muted mb-1">Latency</div>
                  <div className="text-white">{selectedEvent.response_time_ms.toFixed(1)}ms</div>
                </div>
                <div>
                  <div className="text-xs text-vardax-muted mb-1">Size</div>
                  <div className="text-white">{selectedEvent.content_length}B</div>
                </div>
              </div>

              {/* User Agent */}
              <div>
                <div className="text-xs text-vardax-muted mb-1">User Agent</div>
                <div className="text-white text-sm break-all">{selectedEvent.user_agent}</div>
              </div>

              {/* ML Analysis */}
              <div className="border-t border-vardax-border pt-4">
                <div className="text-xs text-vardax-muted mb-2">ML Analysis</div>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-vardax-muted">Anomaly Score</span>
                      <span className="text-white">{(selectedEvent.anomaly_score * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-vardax-border rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all',
                          selectedEvent.anomaly_score > 0.7 ? 'bg-red-500' :
                          selectedEvent.anomaly_score > 0.4 ? 'bg-amber-500' : 'bg-green-500'
                        )}
                        style={{ width: `${selectedEvent.anomaly_score * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-vardax-muted text-sm">Severity</span>
                    <span className={clsx(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      getSeverityColor(selectedEvent.severity)
                    )}>
                      {selectedEvent.severity.toUpperCase()}
                    </span>
                  </div>

                  {selectedEvent.attack_category && (
                    <div className="flex justify-between">
                      <span className="text-vardax-muted text-sm">Attack Type</span>
                      <span className="text-amber-400 text-sm">{selectedEvent.attack_category}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {selectedEvent.is_anomaly && (
                <div className="border-t border-vardax-border pt-4 flex gap-2">
                  <button className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm text-white">
                    Block IP
                  </button>
                  <button className="flex-1 px-3 py-2 bg-vardax-border hover:bg-vardax-card rounded text-sm text-white">
                    False Positive
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Generate mock traffic for demo
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
