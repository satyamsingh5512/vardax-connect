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
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-white">Settings & Database</h2>
      
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-4 text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Database Stats */}
      <div className="bg-vardax-card rounded-lg border border-vardax-border p-6">
        <h3 className="text-lg font-medium text-white mb-4">Database Statistics</h3>
        
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
          <p className="text-vardax-muted">Loading stats...</p>
        )}
      </div>

      {/* Data Management */}
      <div className="bg-vardax-card rounded-lg border border-vardax-border p-6">
        <h3 className="text-lg font-medium text-white mb-4">Data Management</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-vardax-bg rounded-lg">
            <div>
              <p className="text-white font-medium">Load from Database</p>
              <p className="text-sm text-vardax-muted">Restore anomalies and rules from database into memory cache</p>
            </div>
            <button
              onClick={handleLoadFromDb}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load Data'}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-red-900/20 border border-red-800 rounded-lg">
            <div>
              <p className="text-white font-medium">Clear All Data</p>
              <p className="text-sm text-red-400">Permanently delete all anomalies, rules, events, and feedback</p>
            </div>
            <button
              onClick={handleClearData}
              disabled={loading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Clearing...' : 'Clear All'}
            </button>
          </div>
        </div>
      </div>

      {/* Database Configuration */}
      <div className="bg-vardax-card rounded-lg border border-vardax-border p-6">
        <h3 className="text-lg font-medium text-white mb-4">Database Configuration</h3>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-vardax-muted">Database Type:</span>
            <span className="text-white">SQLite (default)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-vardax-muted">Location:</span>
            <span className="text-white font-mono">./vardax.db</span>
          </div>
          <div className="mt-4 p-3 bg-vardax-bg rounded text-vardax-muted">
            <p className="font-medium text-white mb-2">PostgreSQL Configuration</p>
            <p>Set <code className="bg-black/30 px-1 rounded">VARDAX_DATABASE_URL</code> environment variable:</p>
            <code className="block mt-2 text-xs bg-black/30 p-2 rounded">
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
    <div className="bg-vardax-bg p-4 rounded-lg">
      <p className="text-vardax-muted text-sm">{label}</p>
      <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
    </div>
  );
}
