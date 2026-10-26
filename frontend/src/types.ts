// Shared types for the IntelliAPI AI dashboard.

export interface ModelEvidence {
  feature: string;
  importance: number;
  present: boolean;
}

export interface DecisionTreeStep {
  node: number;
  feature?: string;
  threshold?: number;
  direction?: string;
  value?: number;
  leaf?: boolean;
  prediction?: string;
}

export interface HeuristicFinding {
  type: string;
  pattern: string;
  evidence: string;
  description: string;
}

export interface AnalyzeResponse {
  event_id: string;
  timestamp: string;
  prediction: "NORMAL" | "ATTACK";
  attack_type: string | null;
  attack_probability: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  decision: "ALLOW" | "MONITOR" | "BLOCK";
  model_name: string;
  reasons: string[];
  model_evidence: ModelEvidence[];
  decision_tree_path: DecisionTreeStep[];
  heuristic_findings: HeuristicFinding[];
  inference_latency_ms: number;
  request_summary: Record<string, unknown>;
  decision_policy: string;
  base_action?: string;
  escalated_by_heuristics?: boolean;
}

// Event record as stored by the backend (event broadcast over WebSocket).
export interface EventRecord {
  event_id: string;
  timestamp: string;
  received_at: string;
  method: string;
  path: string;
  query: string;
  prediction: "NORMAL" | "ATTACK";
  attack_type: string | null;
  attack_probability: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  decision: "ALLOW" | "MONITOR" | "BLOCK";
  inference_latency_ms: number;
  scenario_label?: string | null;
  result: AnalyzeResponse;
}

export interface ModelInfo {
  model_name: string;
  model_version: string;
  primary_model: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  false_positive_rate: number;
  false_negative_rate: number;
  confusion_matrix: number[][];
  feature_importance: { name: string; importance: number }[];
  risk_thresholds: { risk_low_max: number; risk_high_min: number };
  label_names: Record<string, string>;
  training_composition: {
    composition: string;
    train_rows: number;
    test_rows: number;
    test_source_counts: Record<string, number>;
    csic_subset_accuracy: number | null;
    synthetic_subset_accuracy: number | null;
  };
}

export interface Stats {
  total_requests: number;
  detected_attacks: number;
  allowed_requests: number;
  monitored_requests: number;
  blocked_requests: number;
  attack_rate: number;
  avg_inference_latency_ms: number;
  attack_type_distribution: Record<string, number>;
  decision_distribution: Record<string, number>;
  risk_distribution: Record<string, number>;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface Filters {
  prediction: "ALL" | "NORMAL" | "ATTACK";
  risk: "ALL" | "LOW" | "MEDIUM" | "HIGH";
  action: "ALL" | "ALLOW" | "MONITOR" | "BLOCK";
  attackType: "ALL" | string;
}
