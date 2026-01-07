import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import AlertStream from './components/AlertStream';
import ShapPlot from './components/ShapPlot';

// Sentinelas Dashboard - Main Application
// Provides real-time visibility into WAF decisions with SHAP explanations

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws/alerts';

interface Stats {
    total_inferences: number;
    avg_inference_time_ms: number;
    models_loaded: {
        autoencoder: boolean;
        classifier: boolean;
    };
}

interface Alert {
    alert_id: string;
    timestamp: number;
    request_id: string;
    source_ip: string;
    attack_type: string;
    severity: number;
    description: string;
    uri: string;
    shap_data?: any;
}

function App() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch stats
    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/v1/stats`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
                setError(null);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    }, []);

    // Fetch recent alerts
    const fetchAlerts = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/v1/alerts?limit=50`);
            if (res.ok) {
                const data = await res.json();
                setAlerts(data.alerts || []);
            }
        } catch (err) {
            console.error('Failed to fetch alerts:', err);
        }
    }, []);

    // WebSocket connection for real-time alerts
    useEffect(() => {
        let ws: WebSocket | null = null;
        let reconnectTimeout: NodeJS.Timeout;

        const connect = () => {
            try {
                ws = new WebSocket(WS_URL);

                ws.onopen = () => {
                    console.log('WebSocket connected');
                    setConnected(true);
                    setError(null);
                };

                ws.onmessage = (event) => {
                    const alert: Alert = JSON.parse(event.data);
                    setAlerts((prev) => [alert, ...prev.slice(0, 99)]);
                };

                ws.onclose = () => {
                    console.log('WebSocket disconnected, reconnecting...');
                    setConnected(false);
                    reconnectTimeout = setTimeout(connect, 5000);
                };

                ws.onerror = (err) => {
                    console.error('WebSocket error:', err);
                    setError('WebSocket connection failed');
                };
            } catch (err) {
                console.error('Failed to create WebSocket:', err);
                reconnectTimeout = setTimeout(connect, 5000);
            }
        };

        connect();
        fetchStats();
        fetchAlerts();

        // Poll stats every 5 seconds
        const statsInterval = setInterval(fetchStats, 5000);

        return () => {
            if (ws) ws.close();
            clearTimeout(reconnectTimeout);
            clearInterval(statsInterval);
        };
    }, [fetchStats, fetchAlerts]);

    return (
        <div className="app">
            <header className="header">
                <div className="header-content">
                    <h1 className="logo">
                        <span className="logo-icon">🛡️</span>
                        Sentinelas
                    </h1>
                    <div className="header-status">
                        <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
                            {connected ? '● Live' : '○ Offline'}
                        </span>
                        {error && <span className="error-badge">{error}</span>}
                    </div>
                </div>
            </header>

            <main className="main">
                {/* Stats Dashboard */}
                <section className="stats-section">
                    <h2 className="section-title">System Status</h2>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-value">{stats?.total_inferences.toLocaleString() || '0'}</div>
                            <div className="stat-label">Total Inferences</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats?.avg_inference_time_ms.toFixed(2) || '0.00'}ms</div>
                            <div className="stat-label">Avg Latency</div>
                        </div>
                        <div className="stat-card">
                            <div className={`stat-value ${stats?.models_loaded.autoencoder ? 'status-ok' : 'status-error'}`}>
                                {stats?.models_loaded.autoencoder ? '✓' : '✗'}
                            </div>
                            <div className="stat-label">Autoencoder</div>
                        </div>
                        <div className="stat-card">
                            <div className={`stat-value ${stats?.models_loaded.classifier ? 'status-ok' : 'status-error'}`}>
                                {stats?.models_loaded.classifier ? '✓' : '✗'}
                            </div>
                            <div className="stat-label">Classifier</div>
                        </div>
                    </div>
                </section>

                <div className="content-grid">
                    {/* Alert Stream */}
                    <section className="alerts-section">
                        <h2 className="section-title">
                            Recent Alerts
                            <span className="alert-count">{alerts.length}</span>
                        </h2>
                        <AlertStream
                            alerts={alerts}
                            onSelectAlert={setSelectedAlert}
                            selectedAlertId={selectedAlert?.alert_id}
                        />
                    </section>

                    {/* SHAP Explanation */}
                    <section className="explanation-section">
                        <h2 className="section-title">Explanation</h2>
                        {selectedAlert ? (
                            <ShapPlot alert={selectedAlert} />
                        ) : (
                            <div className="placeholder">
                                <p>Select an alert to view SHAP explanation</p>
                            </div>
                        )}
                    </section>
                </div>
            </main>

            <footer className="footer">
                <p>Sentinelas ML-WAF · Indigenous · Offline-Capable · XAI-Powered</p>
            </footer>
        </div>
    );
}

export default App;
