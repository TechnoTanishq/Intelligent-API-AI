// REST helpers for the IntelliAPI AI dashboard.
import type { EventRecord, ModelInfo, Stats } from "../types";

const DEFAULT_API = "http://127.0.0.1:8000";

function base(apiBase?: string): string {
  return (apiBase || DEFAULT_API).replace(/\/$/, "");
}

export async function fetchModelInfo(apiBase?: string): Promise<ModelInfo> {
  const res = await fetch(`${base(apiBase)}/model-info`);
  if (!res.ok) throw new Error(`model-info HTTP ${res.status}`);
  return res.json();
}

export async function fetchStats(apiBase?: string): Promise<Stats> {
  const res = await fetch(`${base(apiBase)}/stats`);
  if (!res.ok) throw new Error(`stats HTTP ${res.status}`);
  return res.json();
}

export async function fetchRecentEvents(apiBase?: string, limit = 100): Promise<EventRecord[]> {
  const res = await fetch(`${base(apiBase)}/events?limit=${limit}`);
  if (!res.ok) throw new Error(`events HTTP ${res.status}`);
  const data = await res.json();
  return data.events as EventRecord[];
}

export async function fetchEvent(apiBase: string, id: string): Promise<EventRecord> {
  const res = await fetch(`${base(apiBase)}/events/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`event HTTP ${res.status}`);
  return res.json();
}

export async function clearEvents(apiBase?: string): Promise<void> {
  await fetch(`${base(apiBase)}/events/clear`, { method: "POST" });
}

export function wsUrl(apiBase?: string): string {
  const b = base(apiBase);
  return b.replace(/^http/, "ws") + "/ws";
}
