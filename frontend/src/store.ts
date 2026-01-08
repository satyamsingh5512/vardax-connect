// Zustand store for VARDAx Dashboard state management
import { create } from 'zustand';

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
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'active';
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  approvedAt?: Date;
  content: string;
}

interface AppState {
  // Connection
  isConnected: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  lastUpdate: Date | null;
  
  // Data
  stats: TrafficStats;
  systemHealth: SystemHealth;
  recentAnomalies: Anomaly[];
  pendingRules: Rule[];
  
  // UI State
  sidebarCollapsed: boolean;
  currentPage: string;
  notifications: any[];
  
  // Actions
  setConnectionStatus: (status: 'connected' | 'connecting' | 'disconnected') => void;
  updateStats: (stats: Partial<TrafficStats>) => void;
  updateSystemHealth: (health: Partial<SystemHealth>) => void;
  addAnomaly: (anomaly: Anomaly) => void;
  addRule: (rule: Rule) => void;
  updateRule: (id: string, updates: Partial<Rule>) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCurrentPage: (page: string) => void;
  addNotification: (notification: any) => void;
  removeNotification: (id: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  isConnected: true,
  connectionStatus: 'connected',
  lastUpdate: new Date(),
  
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
  pendingRules: [],
  sidebarCollapsed: false,
  currentPage: 'dashboard',
  notifications: [],
  
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
  
  addAnomaly: (anomaly) => set((state) => ({
    recentAnomalies: [anomaly, ...state.recentAnomalies].slice(0, 50), // Keep last 50
    lastUpdate: new Date()
  })),
  
  addRule: (rule) => set((state) => ({
    pendingRules: [rule, ...state.pendingRules],
    lastUpdate: new Date()
  })),
  
  updateRule: (id, updates) => set((state) => ({
    pendingRules: state.pendingRules.map(rule => 
      rule.id === id ? { ...rule, ...updates } : rule
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
  }))
}));

// Legacy store for backward compatibility
export const useDashboardStore = useStore;
