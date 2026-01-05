import { useState, useEffect } from 'react';
import { api } from '../api';

interface DbStats {
  traffic_events: number;
  anomalies: number;
  rules: number;
  feedback: number;
  in_memory_anomalies: number;
  in_memory_rules: number;
  ws_connections: number;
}

export function Settings() {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStats = async () => {
    try {
      const data = await api.getDatabaseStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to clear ALL data? This cannot be undone.')) return;
    
    setLoading(true);
    try {
      await api.clearAllData();
      setMessage({ type: 'success', text: 'All data cleared successfully' });
      fetchStats();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to clear data' });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadFromDb = async () => {
    setLoading(true);
    try {
      const result = await api.loadFromDatabase();
      setMessage({ 
        type: 'success', 
        text: `Loaded ${result.anomalies_loaded} anomalies and ${result.rules_loaded} rules from database` 
      });
      fetchStats();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load from database' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full" style={{ background: 'var(--bg-primary)' }}>
      <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Settings & Database</h2>
      
      {message && (
        <div 
          className="p-4 rounded-lg flex items-center justify-between"
          style={{ 
            background: message.type === 'success' 
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.1))' 
              : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.1))',
            border: `2px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
            boxShadow: message.type === 'success' 
              ? '0 0 20px rgba(16, 185, 129, 0.3)' 
              : '0 0 20px rgba(239, 68, 68, 0.3)',
            color: message.type === 'success' ? '#10b981' : '#ef4444'
          }}
        >
          <span className="font-medium">{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-sm underline opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Database Stats */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Database Statistics</h3>
        </div>
        <div className="card-body">
          {stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Traffic Events" value={stats.traffic_events} />
              <StatCard label="Anomalies (DB)" value={stats.anomalies} />
              <StatCard label="Rules (DB)" value={stats.rules} />
              <StatCard label="Feedback Records" value={stats.feedback} />
              <StatCard label="Anomalies (Memory)" value={stats.in_memory_anomalies} />
              <StatCard label="Rules (Memory)" value={stats.in_memory_rules} />
              <StatCard label="WebSocket Connections" value={stats.ws_connections} />
            </div>
          ) : (
            <p style={{ color: 'var(--text-tertiary)' }}>Loading stats...</p>
          )}
        </div>
      </div>

      {/* Data Management */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Data Management</h3>
        </div>
        <div className="card-body space-y-4">
          <div 
            className="flex items-center justify-between p-4 rounded-lg"
            style={{ background: 'var(--bg-tertiary)' }}
          >
            <div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Load from Database</p>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Restore anomalies and rules from database into memory cache</p>
            </div>
            <button
              onClick={handleLoadFromDb}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Loading...' : 'Load Data'}
            </button>
          </div>

          <div 
            className="flex items-center justify-between p-4 rounded-lg"
            style={{ 
              background: 'rgba(248, 81, 73, 0.1)',
              border: '1px solid rgba(248, 81, 73, 0.3)'
            }}
          >
            <div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Clear All Data</p>
              <p className="text-sm" style={{ color: 'var(--accent-red)' }}>Permanently delete all anomalies, rules, events, and feedback</p>
            </div>
            <button
              onClick={handleClearData}
              disabled={loading}
              className="btn btn-danger"
            >
              {loading ? 'Clearing...' : 'Clear All'}
            </button>
          </div>
        </div>
      </div>

      {/* Database Configuration */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Database Configuration</h3>
        </div>
        <div className="card-body space-y-3 text-sm">
          <div className="detail-row">
            <span className="detail-label">Database Type</span>
            <span className="detail-value">SQLite (default)</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Location</span>
            <span className="detail-value font-mono">./vardax.db</span>
          </div>
          <div 
            className="mt-4 p-4 rounded-lg"
            style={{ background: 'var(--bg-tertiary)' }}
          >
            <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>PostgreSQL Configuration</p>
            <p style={{ color: 'var(--text-tertiary)' }}>
              Set <code className="px-1 rounded" style={{ background: 'var(--bg-primary)' }}>VARDAX_DATABASE_URL</code> environment variable:
            </p>
            <code 
              className="block mt-2 text-xs p-3 rounded font-mono"
              style={{ background: 'var(--bg-primary)', color: 'var(--accent-cyan)' }}
            >
              VARDAX_DATABASE_URL=postgresql://user:pass@host:5432/vardax
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value.toLocaleString()}</p>
    </div>
  );
}
