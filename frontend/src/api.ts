// API client for VARDAx backend
import type { AnomalySummary, Anomaly, RuleRecommendation, TrafficMetrics, ModelHealth } from './types';

const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

const WS_BASE = import.meta.env.VITE_WS_URL || '';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}

export const api = {
  // Anomalies
  getAnomalies: (limit = 100, severity?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (severity) params.append('severity', severity);
    return fetchApi<AnomalySummary[]>(`/anomalies?${params}`);
  },
  
  getAnomalyDetail: (id: string) => 
    fetchApi<Anomaly>(`/anomalies/${id}`),
  
  // Rules
  getPendingRules: () => 
    fetchApi<RuleRecommendation[]>('/rules/pending'),
  
  generateRules: () => 
    fetchApi<RuleRecommendation[]>('/rules/generate', { method: 'POST' }),
  
  approveRule: (ruleId: string, action: 'approve' | 'reject' | 'rollback') =>
    fetchApi<RuleRecommendation>('/rules/approve', {
      method: 'POST',
      body: JSON.stringify({ rule_id: ruleId, action }),
    }),
  
  // Metrics
  getTrafficMetrics: () => 
    fetchApi<TrafficMetrics>('/metrics/traffic'),
  
  getLiveStats: () =>
    fetchApi<any>('/stats/live'),
  
  // ML Health
  getModelHealth: () => 
    fetchApi<ModelHealth[]>('/ml/health'),
  
  // Feedback
  submitFeedback: (anomalyId: string, feedbackType: string, notes?: string) =>
    fetchApi<{ status: string }>('/feedback', {
      method: 'POST',
      body: JSON.stringify({
        anomaly_id: anomalyId,
        feedback_type: feedbackType,
        analyst_id: 'admin',
        notes,
      }),
    }),
  
  // Replay
  getReplayTimeline: (sinceMinutes = 60, severity?: string, ip?: string) => {
    const params = new URLSearchParams({ since_minutes: String(sinceMinutes) });
    if (severity) params.append('severity', severity);
    if (ip) params.append('ip', ip);
    return fetchApi<any[]>(`/replay/timeline?${params}`);
  },
  
  getAttackSequence: (ip: string) =>
    fetchApi<any[]>(`/replay/sequence/${ip}`),
  
  // Heatmap
  getHeatmap: (sinceMinutes = 60, bucketMinutes = 5) =>
    fetchApi<any[]>(`/heatmap/traffic?since_minutes=${sinceMinutes}&bucket_minutes=${bucketMinutes}`),
  
  // Geo
  getGeoThreats: () =>
    fetchApi<any[]>('/geo/threats'),
  
  // Simulation
  simulateRule: (ruleType: string, ruleParams: any, timeWindowMinutes = 60) =>
    fetchApi<any>('/rules/simulate', {
      method: 'POST',
      body: JSON.stringify({
        rule_type: ruleType,
        rule_params: ruleParams,
        time_window_minutes: timeWindowMinutes,
      }),
    }),
  
  getSimulationScenarios: () =>
    fetchApi<any[]>('/rules/simulation-scenarios'),
  
  // Admin
  clearAllData: () =>
    fetchApi<{ status: string; message: string }>('/admin/clear-data', { method: 'POST' }),
  
  getDatabaseStats: () =>
    fetchApi<{
      traffic_events: number;
      anomalies: number;
      rules: number;
      feedback: number;
      in_memory_anomalies: number;
      in_memory_rules: number;
      ws_connections: number;
    }>('/admin/db-stats'),
  
  loadFromDatabase: () =>
    fetchApi<{ status: string; anomalies_loaded: number; rules_loaded: number }>('/admin/load-from-db', { method: 'POST' }),
  
  // Connected Services
  getConnectedServices: () =>
    fetchApi<any[]>('/services'),
  
  unregisterService: (serviceId: string) =>
    fetchApi<{ status: string; service_id: string }>(`/services/${serviceId}`, { method: 'DELETE' }),
};

// WebSocket connection for real-time updates
export function connectWebSocket(
  onAnomaly: (anomaly: AnomalySummary) => void,
  onConnect: () => void,
  onDisconnect: () => void
) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = WS_BASE 
    ? `${WS_BASE}/api/v1/ws/anomalies`
    : `${protocol}//${window.location.host}/api/v1/ws/anomalies`;
  
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    onConnect();
  };
  
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'anomaly') {
        onAnomaly(message.data);
      }
    } catch (e) {
      console.error('WebSocket message error:', e);
    }
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    onDisconnect();
    // Reconnect after 5 seconds
    setTimeout(() => connectWebSocket(onAnomaly, onConnect, onDisconnect), 5000);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  return ws;
}
