// Zustand store for VARDAx Dashboard state management
import { create } from 'zustand';
import type { Anomaly, AnomalySummary, RuleRecommendation, TrafficMetrics, ModelHealth } from './types';

interface DashboardState {
  // Data
  anomalies: AnomalySummary[];
  selectedAnomaly: Anomaly | null;
  pendingRules: RuleRecommendation[];
  trafficMetrics: TrafficMetrics | null;
  modelHealth: ModelHealth[];
  
  // UI State
  activeTab: 'overview' | 'traffic' | 'anomalies' | 'rules' | 'models' | 'replay' | 'heatmap' | 'simulate' | 'settings';
  isLoading: boolean;
  error: string | null;
  
  // WebSocket
  wsConnected: boolean;
  
  // Actions
  setAnomalies: (anomalies: AnomalySummary[]) => void;
  addAnomaly: (anomaly: AnomalySummary) => void;
  setSelectedAnomaly: (anomaly: Anomaly | null) => void;
  setPendingRules: (rules: RuleRecommendation[]) => void;
  updateRuleStatus: (ruleId: string, status: RuleRecommendation['status']) => void;
  setTrafficMetrics: (metrics: TrafficMetrics) => void;
  setModelHealth: (health: ModelHealth[]) => void;
  setActiveTab: (tab: DashboardState['activeTab']) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setWsConnected: (connected: boolean) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  // Initial state
  anomalies: [],
  selectedAnomaly: null,
  pendingRules: [],
  trafficMetrics: null,
  modelHealth: [],
  activeTab: 'overview',
  isLoading: false,
  error: null,
  wsConnected: false,
  
  // Actions
  setAnomalies: (anomalies) => set({ anomalies }),
  
  addAnomaly: (anomaly) => set((state) => ({
    anomalies: [anomaly, ...state.anomalies].slice(0, 100)
  })),
  
  setSelectedAnomaly: (anomaly) => set({ selectedAnomaly: anomaly }),
  
  setPendingRules: (rules) => set({ pendingRules: rules }),
  
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
