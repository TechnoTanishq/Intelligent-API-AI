import type { EventRecord, Stats } from "../types";

/** Compute dashboard statistics from the buffered live events. */
export function computeStats(events: EventRecord[]): Stats {
  const n = events.length;
  if (n === 0) {
    return {
      total_requests: 0, detected_attacks: 0, allowed_requests: 0,
      monitored_requests: 0, blocked_requests: 0, attack_rate: 0,
      avg_inference_latency_ms: 0, attack_type_distribution: {},
      decision_distribution: {}, risk_distribution: {},
    };
  }
  let attacks = 0, allowed = 0, monitored = 0, blocked = 0, latSum = 0;
  const atk: Record<string, number> = {};
  const dec: Record<string, number> = {};
  const risk: Record<string, number> = {};
  for (const e of events) {
    if (e.prediction === "ATTACK") attacks++;
    if (e.decision === "ALLOW") allowed++;
    else if (e.decision === "MONITOR") monitored++;
    else if (e.decision === "BLOCK") blocked++;
    latSum += e.inference_latency_ms || 0;
    const at = e.attack_type || "none";
    atk[at] = (atk[at] || 0) + 1;
    dec[e.decision] = (dec[e.decision] || 0) + 1;
    risk[e.risk_level] = (risk[e.risk_level] || 0) + 1;
  }
  return {
    total_requests: n,
    detected_attacks: attacks,
    allowed_requests: allowed,
    monitored_requests: monitored,
    blocked_requests: blocked,
    attack_rate: attacks / n,
    avg_inference_latency_ms: latSum / n,
    attack_type_distribution: atk,
    decision_distribution: dec,
    risk_distribution: risk,
  };
}

/** Bucket events into time windows for the request-volume-over-time chart. */
export function buildVolumeSeries(events: EventRecord[], buckets = 20): { t: string; total: number; attacks: number; normal: number }[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const start = new Date(sorted[0].timestamp).getTime();
  const end = new Date(sorted[sorted.length - 1].timestamp).getTime();
  const span = Math.max(end - start, 1000);
  const width = span / buckets;
  const series = Array.from({ length: buckets }, (_, i) => ({
    t: new Date(start + i * width).toLocaleTimeString(),
    total: 0, attacks: 0, normal: 0,
  }));
  for (const e of sorted) {
    const idx = Math.min(buckets - 1, Math.floor((new Date(e.timestamp).getTime() - start) / width));
    series[idx].total++;
    if (e.prediction === "ATTACK") series[idx].attacks++;
    else series[idx].normal++;
  }
  return series;
}

/** Risk-score (attack probability) trend in arrival order (newest last for the chart). */
export function buildRiskSeries(events: EventRecord[]): { idx: number; prob: number; decision: string }[] {
  return [...events].reverse().map((e, i) => ({
    idx: i + 1,
    prob: e.attack_probability,
    decision: e.decision,
  }));
}
