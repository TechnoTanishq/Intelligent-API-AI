// Thin HTTP client for the IntelliAPI AI inference API.
import type { AnalyzeResponse, SimRequest } from "../types";

export async function analyzeRequest(apiBase: string, req: SimRequest): Promise<AnalyzeResponse> {
  const res = await fetch(`${apiBase.replace(/\/$/, "")}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as AnalyzeResponse;
}

export async function checkHealth(apiBase: string): Promise<{ status: string; model_loaded: boolean; model_name: string }> {
  const res = await fetch(`${apiBase.replace(/\/$/, "")}/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
