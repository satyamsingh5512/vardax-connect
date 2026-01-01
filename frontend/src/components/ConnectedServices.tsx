import { useEffect, useState } from 'react';
import { api } from '../api';

interface ConnectedService {
  service_id: string;
  name: string;
  host: string;
  port: number;
  environment: string;
  version: string;
  framework: string;
  registered_at: string;
  last_heartbeat: string;
  status: 'online' | 'degraded' | 'offline';
  requests_total: number;
  anomalies_total: number;
  mode: 'monitor' | 'protect';
}

export function ConnectedServices() {
  const [services, setServices] = useState<ConnectedService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServices();
    const interval = setInterval(loadServices, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const loadServices = async () => {
    try {
      const data = await api.getConnectedServices();
      setServices(data);
    } catch (e) {
      console.error('Failed to load services:', e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'var(--accent-green)';
      case 'degraded': return 'var(--accent-yellow)';
      case 'offline': return 'var(--accent-red)';
      default: return 'var(--text-tertiary)';
    }
  };

  const getModeColor = (mode: string) => {
    return mode === 'protect' ? 'var(--accent-blue)' : 'var(--accent-purple)';
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString();
  };

  const getTimeSince = (isoString: string) => {
    const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">Connected Services</span>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <span className="loading-status-text">Loading services...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Connected Services</span>
        <span style={{ 
          fontSize: '12px', 
          color: 'var(--text-tertiary)',
          background: 'var(--bg-tertiary)',
          padding: '4px 8px',
          borderRadius: 'var(--radius-sm)'
        }}>
          {services.length} {services.length === 1 ? 'service' : 'services'}
        </span>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {services.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
            <div style={{ fontSize: '32px', marginBottom: 'var(--space-md)', opacity: 0.5 }}>🔌</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
              No services connected
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              Use vardax-connect to protect your applications
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {services.map((service) => (
              <div
                key={service.service_id}
                style={{
                  padding: 'var(--space-md) var(--space-lg)',
                  borderBottom: '1px solid var(--border-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-lg)',
                  transition: 'background var(--transition-fast)'
                }}
                className="glass-hover"
              >
                {/* Status indicator */}
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: getStatusColor(service.status),
                      boxShadow: service.status === 'online' 
                        ? `0 0 8px ${getStatusColor(service.status)}` 
                        : 'none'
                    }}
                  />
                  {service.status === 'online' && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: '-4px',
                        borderRadius: '50%',
                        border: `2px solid ${getStatusColor(service.status)}`,
                        opacity: 0.3,
                        animation: 'pulse 2s ease-in-out infinite'
                      }}
                    />
                  )}
                </div>

                {/* Service info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {service.name}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: getModeColor(service.mode),
                        color: 'white',
                        textTransform: 'uppercase',
                        fontWeight: 600
                      }}
                    >
                      {service.mode}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-tertiary)',
                        textTransform: 'uppercase'
                      }}
                    >
                      {service.environment}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    {service.host}:{service.port} • {service.framework} v{service.version}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 'var(--space-xl)', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {service.requests_total.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                      Requests
                    </div>
                  </div>
                  <div>
                    <div style={{ 
                      fontSize: '18px', 
                      fontWeight: 700, 
                      color: service.anomalies_total > 0 ? 'var(--accent-yellow)' : 'var(--text-primary)' 
                    }}>
                      {service.anomalies_total.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                      Anomalies
                    </div>
                  </div>
                </div>

                {/* Last seen */}
                <div style={{ textAlign: 'right', minWidth: '80px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {getTimeSince(service.last_heartbeat)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    {formatTime(service.last_heartbeat)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
