// Shared types for the IntelliAPI AI traffic simulator.

export type ScenarioLabel =
  | "normal"
  | "sqli"
  | "xss"
  | "path_traversal"
  | "cmd_injection";

export interface SimRequest {
  event_id: string;
  timestamp: string;
  method: string;
  path: string;
  query: string;
  headers: { "user-agent": string; [k: string]: string };
  body: string;
  scenario_label: ScenarioLabel;
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
  model_evidence: { feature: string; importance: number; present: boolean }[];
  decision_tree_path: {
    node: number;
    feature?: string;
    threshold?: number;
    direction?: string;
    leaf?: boolean;
    prediction?: string;
  }[];
  heuristic_findings: {
    type: string;
    pattern: string;
    evidence: string;
    description: string;
  }[];
  inference_latency_ms: number;
  request_summary: Record<string, unknown>;
  decision_policy: string;
}

export type SimState = "stopped" | "running" | "paused";

export interface TrafficMix {
  normal: number;
  sqli: number;
  xss: number;
  path_traversal: number;
  cmd_injection: number;
}

export interface SimStats {
  total: number;
  byScenario: Record<ScenarioLabel, number>;
  errors: number;
  matches: number; // model prediction agrees with scenario ground truth
  mismatches: number;
}
