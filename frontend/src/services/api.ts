/**
 * API Service for VARDAx Dashboard
 * Fetches real data from the backend API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1';

export interface LiveStats {
  timestamp: string;
  requests_per_second: number;
  anomalies_last_minute: number;
  anomalies_last_hour: number;
  threats_blocked: number;
  pending_rules: number;
  severity_breakdown: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  model_status: string;
  inference_latency_ms: number;
}

export interface TrafficMetrics {
  timestamp: string;
  requests_per_second: number;
  anomalies_per_minute: number;
  blocked_requests: number;
  avg_response_time_ms: number;
  error_rate: number;
  unique_ips: number;
  top_endpoints: Array<{
    endpoint: string;
    count: number;
  }>;
}

export interface AnomalySummary {
  anomaly_id: string;
  timestamp: string;
  client_ip: string;
  uri: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  attack_category: string;
  top_explanation: string;
  status: string;
}

export interface ModelHealth {
  model_name: string;
  version: string;
  last_trained: string;
  training_samples: number;
  inference_count_24h: number;
  avg_inference_time_ms: number;
  anomaly_rate_24h: number;
  false_positive_rate: number;
}

export interface ConnectedService {
  service_id: string;
  name: string;
  host: string;
  port: number;
  environment: string;
  version: string;
  framework: string;
  registered_at: string;
  last_heartbeat: string;
  status: 'online' | 'offline' | 'degraded';
  requests_total: number;
  anomalies_total: number;
  mode: string;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Live Statistics
  async getLiveStats(): Promise<LiveStats> {
    return this.request<LiveStats>('/stats/live');
  }

  // Traffic Metrics
  async getTrafficMetrics(): Promise<TrafficMetrics> {
    return this.request<TrafficMetrics>('/metrics/traffic');
  }

  // Anomalies
  async getAnomalies(params?: {
    limit?: number;
    severity?: string;
    since_minutes?: number;
    from_db?: boolean;
  }): Promise<AnomalySummary[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.severity) searchParams.set('severity', params.severity);
    if (params?.since_minutes) searchParams.set('since_minutes', params.since_minutes.toString());
    if (params?.from_db) searchParams.set('from_db', params.from_db.toString());

    const query = searchParams.toString();
    return this.request<AnomalySummary[]>(`/anomalies${query ? `?${query}` : ''}`);
  }

  // Model Health
  async getModelHealth(): Promise<ModelHealth[]> {
    return this.request<ModelHealth[]>('/ml/health');
  }

  // Connected Services
  async getConnectedServices(): Promise<ConnectedService[]> {
    return this.request<ConnectedService[]>('/services');
  }

  // Database Stats
  async getDatabaseStats(): Promise<any> {
    return this.request<any>('/admin/db-stats');
  }

  // Health Check
  async getHealth(): Promise<any> {
    return this.request<any>('/../health');
  }

  // WebSocket connection
  createWebSocket(endpoint: string): WebSocket {
    const wsUrl = this.baseUrl.replace('http', 'ws') + endpoint;
    return new WebSocket(wsUrl);
  }
}

export const apiService = new ApiService();
export default apiService;