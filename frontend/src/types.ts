// VARDAx Dashboard Types

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type RuleStatus = 'pending' | 'approved' | 'rejected' | 'rolled_back';
export type FeedbackType = 'true_positive' | 'false_positive' | 'needs_review';

export interface AnomalyScore {
  isolation_forest: number;
  autoencoder: number;
  ewma: number;
  ensemble: number;
}

export interface AnomalyExplanation {
  feature_name: string;
  feature_value: number;
  baseline_value: number;
  deviation_percent: number;
  description: string;
}

export interface Anomaly {
  anomaly_id: string;
  request_id: string;
  timestamp: string;
  client_ip: string;
  uri: string;
  method: string;
  scores: AnomalyScore;
  severity: SeverityLevel;
  confidence: number;
  explanations: AnomalyExplanation[];
  attack_category: string;
  status: string;
}

export interface AnomalySummary {
  anomaly_id: string;
  timestamp: string;
  client_ip: string;
  uri: string;
  severity: SeverityLevel;
  confidence: number;
  attack_category: string;
  top_explanation: string;
  status: string;
}

export interface RuleRecommendation {
  rule_id: string;
  created_at: string;
  source_anomaly_ids: string[];
  anomaly_count: number;
  rule_type: string;
  rule_content: string;
  rule_description: string;
  confidence: number;
  false_positive_estimate: number;
  status: RuleStatus;
  approved_by?: string;
  approved_at?: string;
}

export interface TrafficMetrics {
  timestamp: string;
  requests_per_second: number;
  anomalies_per_minute: number;
  blocked_requests: number;
  avg_response_time_ms: number;
  error_rate: number;
  unique_ips: number;
  top_endpoints: { endpoint: string; count: number }[];
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
