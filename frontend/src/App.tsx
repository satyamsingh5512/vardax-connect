import { useEffect, useState } from 'react';
import { useDashboardStore } from './store';
import { api, connectWebSocket } from './api';
import { ThemeProvider } from './contexts/ThemeContext';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { Overview } from './components/Overview';
import { LiveTraffic } from './components/LiveTraffic';
import { AnomalyList } from './components/AnomalyList';
import { RuleApproval } from './components/RuleApproval';
import { ModelHealth } from './components/ModelHealth';
import { ReplayTimeline } from './components/ReplayTimeline';
import { TrafficHeatmap } from './components/TrafficHeatmap';
import { GeoMap } from './components/GeoMap';
import { RuleSimulator } from './components/RuleSimulator';
import { Settings } from './components/Settings';
import { LoadingScreen } from './components/LoadingScreen';

function AppContent() {
  const [isLoading, setIsLoading] = useState(true);
  const {
    activeTab,
    setAnomalies,
    addAnomaly,
    setPendingRules,
    setTrafficMetrics,
    setModelHealth,
    setWsConnected,
  } = useDashboardStore();

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [anomalies, rules, metrics, health] = await Promise.all([
          api.getAnomalies(),
          api.getPendingRules(),
          api.getTrafficMetrics(),
          api.getModelHealth(),
        ]);

        setAnomalies(anomalies);
        setPendingRules(rules);
        setTrafficMetrics(metrics);
        setModelHealth(health);
      } catch (e) {
        console.error('Failed to load initial data:', e);
        // Initialize with empty data - will show "No data" states
        setAnomalies([]);
        setPendingRules([]);
      }
    };

    loadData();

    // Refresh metrics every 5 seconds
    const interval = setInterval(async () => {
      try {
        const metrics = await api.getTrafficMetrics();
        setTrafficMetrics(metrics);
      } catch (e) {
        // Ignore errors for periodic refresh
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Connect WebSocket for real-time updates
  useEffect(() => {
    const ws = connectWebSocket(
      (anomaly) => addAnomaly(anomaly),
      () => setWsConnected(true),
      () => setWsConnected(false)
    );

    return () => ws.close();
  }, []);

  return (
    <>
      {isLoading && <LoadingScreen onLoadComplete={() => setIsLoading(false)} />}

      <div className="dashboard-layout">
        <Header />
        <Navigation />
        <main className="dashboard-main">
          {activeTab === 'overview' && <Overview />}
          {activeTab === 'traffic' && <LiveTraffic />}
          {activeTab === 'anomalies' && <AnomalyList />}
          {activeTab === 'rules' && <RuleApproval />}
          {activeTab === 'models' && <ModelHealth />}
          {activeTab === 'replay' && <ReplayTimeline />}
          {activeTab === 'heatmap' && (
            <div className="p-6 grid grid-cols-2 gap-6" style={{ background: 'var(--bg-primary)', height: '100%', overflow: 'auto' }}>
              <TrafficHeatmap />
              <GeoMap />
            </div>
          )}
          {activeTab === 'simulate' && <RuleSimulator />}
          {activeTab === 'settings' && <Settings />}
        </main>
      </div>
    </>
  );
}

import { LandingPage } from './components/LandingPage';

function App() {
  const [showLanding, setShowLanding] = useState(true);

  return (
    <ThemeProvider>
      {showLanding ? (
        <LandingPage onLaunch={() => setShowLanding(false)} />
      ) : (
        <AppContent />
      )}
    </ThemeProvider>
  );
}

export default App;
