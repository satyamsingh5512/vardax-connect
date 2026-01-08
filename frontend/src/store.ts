// Zustand store for VARDAx Dashboard state management
import { create } from 'zustand';
import type { RuleRecommendation, RuleStatus } from './types';

// Types
export interface TrafficStats {
  requestsPerSecond: number;
  anomalyRate: number;
  totalRequests: number;
  threatsBlocked: number;
  activeThreats: number;
  avgResponseTime: number;
}

export interface SystemHealth {
  cpu: number;
  memory: number;
  network: number;
  services: {
    mlEngine: 'healthy' | 'warning' | 'critical';
    wafGateway: 'healthy' | 'warning' | 'critical';
    analytics: 'healthy' | 'warning' | 'critical';
    database: 'healthy' | 'warning' | 'critical';
  };
}

export interface Anomaly {
  id: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  source: string;
  description: string;
  blocked: boolean;
  confidence: number;
  status?: 'new' | 'reviewed' | 'resolved';
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

export interface TrafficMetrics {
  requests_per_second: number;
  anomaly_rate: number;
  total_requests: number;
  threats_blocked: number;
  anomalies_per_minute: number;
  blocked_requests: number;
}

export interface ModelHealth {
  model_name: string;
  status: 'healthy' | 'warning' | 'critical';
  accuracy: number;
  last_updated: string;
  avg_inference_time_ms: number;
  anomaly_rate_24h: number;
}

interface AppState {
  // Connection
  isConnected: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  lastUpdate: Date | null;
  wsConnected: boolean;
  
  // Data
  stats: TrafficStats;
  systemHealth: SystemHealth;
  recentAnomalies: Anomaly[];
  anomalies: AnomalySummary[]; // For backward compatibility
  pendingRules: RuleRecommendation[];
  trafficMetrics: TrafficMetrics | null;
  modelHealth: ModelHealth[];
  selectedAnomaly: Anomaly | null;
  
  // UI State
  sidebarCollapsed: boolean;
  currentPage: string;
  notifications: any[];
  activeTab: 'overview' | 'traffic' | 'anomalies' | 'rules' | 'models' | 'replay' | 'heatmap' | 'simulate' | 'settings';
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setConnectionStatus: (status: 'connected' | 'connecting' | 'disconnected') => void;
  updateStats: (stats: Partial<TrafficStats>) => void;
  updateSystemHealth: (health: Partial<SystemHealth>) => void;
  addAnomaly: (anomaly: Anomaly) => void;
  addRule: (rule: RuleRecommendation) => void;
  updateRule: (id: string, updates: Partial<RuleRecommendation>) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCurrentPage: (page: string) => void;
  addNotification: (notification: any) => void;
  removeNotification: (id: string) => void;
  
  // Backward compatibility actions
  setAnomalies: (anomalies: AnomalySummary[]) => void;
  setSelectedAnomaly: (anomaly: Anomaly | null) => void;
  setPendingRules: (rules: RuleRecommendation[]) => void;
  updateRuleStatus: (ruleId: string, status: RuleStatus) => void;
  setTrafficMetrics: (metrics: TrafficMetrics) => void;
  setModelHealth: (health: ModelHealth[]) => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setWsConnected: (connected: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  // Initial state
  isConnected: true,
  connectionStatus: 'connected',
  lastUpdate: new Date(),
  wsConnected: false,
  
  stats: {
    requestsPerSecond: 1247.5,
    anomalyRate: 2.3,
    totalRequests: 2400000,
    threatsBlocked: 1247,
    activeThreats: 23,
    avgResponseTime: 3.2
  },
  
  systemHealth: {
    cpu: 23,
    memory: 67,
    network: 45,
    services: {
      mlEngine: 'healthy',
      wafGateway: 'healthy',
      analytics: 'healthy',
      database: 'warning'
    }
  },
  
  recentAnomalies: [],
  anomalies: [], // For backward compatibility
  pendingRules: [],
  trafficMetrics: null,
  modelHealth: [],
  selectedAnomaly: null,
  sidebarCollapsed: false,
  currentPage: 'dashboard',
  notifications: [],
  activeTab: 'overview',
  isLoading: false,
  error: null,
  
  // Actions
  setConnectionStatus: (status) => set({ 
    connectionStatus: status, 
    isConnected: status === 'connected',
    lastUpdate: new Date()
  }),
  
  updateStats: (newStats) => set((state) => ({
    stats: { ...state.stats, ...newStats },
    lastUpdate: new Date()
  })),
  
  updateSystemHealth: (newHealth) => set((state) => ({
    systemHealth: { ...state.systemHealth, ...newHealth },
    lastUpdate: new Date()
  })),
  
  addAnomaly: (anomaly) => set((state) => {
    const anomalySummary: AnomalySummary = {
      anomaly_id: anomaly.id,
      timestamp: anomaly.timestamp.toISOString(),
      client_ip: anomaly.source,
      uri: '/', // Default value
      severity: anomaly.severity,
      confidence: anomaly.confidence,
      attack_category: anomaly.type,
      top_explanation: anomaly.description,
      status: anomaly.status || 'new'
    };
    return {
      recentAnomalies: [anomaly, ...state.recentAnomalies].slice(0, 50),
      anomalies: [anomalySummary, ...state.anomalies].slice(0, 100),
      lastUpdate: new Date()
    };
  }),
  
  addRule: (rule) => set((state) => ({
    pendingRules: [rule, ...state.pendingRules],
    lastUpdate: new Date()
  })),
  
  updateRule: (id, updates) => set((state) => ({
    pendingRules: state.pendingRules.map(rule => 
      rule.rule_id === id ? { ...rule, ...updates } : rule
    ),
    lastUpdate: new Date()
  })),
  
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  
  setCurrentPage: (page) => set({ currentPage: page }),
  
  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications]
  })),
  
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),
  
  // Backward compatibility actions
  setAnomalies: (anomalies) => set({ 
    anomalies,
    recentAnomalies: anomalies.map(a => ({
      id: a.anomaly_id,
      timestamp: new Date(a.timestamp),
      severity: a.severity,
      type: a.attack_category,
      source: a.client_ip,
      description: a.top_explanation,
      blocked: false,
      confidence: a.confidence,
      status: a.status as 'new' | 'reviewed' | 'resolved'
    })).slice(0, 50)
  }),
  
  setSelectedAnomaly: (anomaly) => set({ selectedAnomaly: anomaly }),
  
  setPendingRules: (rules) => set({ 
    pendingRules: rules
  }),
  
  updateRuleStatus: (ruleId, status) => set((state) => ({
    pendingRules: state.pendingRules.map((r) =>
      r.rule_id === ruleId ? { ...r, status } : r
    )
  })),
  
  setTrafficMetrics: (metrics) => set({ trafficMetrics: metrics }),
  
  setModelHealth: (health) => set({ modelHealth: health }),
  
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error }),
  
  setWsConnected: (connected) => set({ wsConnected: connected }),
}));

// Legacy store for backward compatibility
export const useDashboardStore = useStore;