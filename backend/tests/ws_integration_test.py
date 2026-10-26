"""
WebSocket + HTTP integration test for IntelliAPI AI.

Connects to the WebSocket endpoint, sends N requests to POST /analyze,
and verifies every event is broadcast over the WebSocket connection.
Also validates /health, /model-info, /events, and /stats.
"""
import asyncio
import json
import sys
import urllib.request

import websockets  # pip install websockets

BASE = "http://127.0.0.1:8000"
WS = "ws://127.0.0.1:8000/ws"

TEST_CASES = [
    {
        "event_id": "int-test-1", "timestamp": "2026-10-26T10:00:00Z",
        "method": "GET", "path": "/api/products", "query": "category=books",
        "headers": {"user-agent": "IntelliAPI-AI-Simulator/1.0"}, "body": "",
        "scenario_label": "normal",
    },
    {
        "event_id": "int-test-2", "timestamp": "2026-10-26T10:00:04Z",
        "method": "POST", "path": "/api/login", "query": "",
        "headers": {"user-agent": "IntelliAPI-AI-Simulator/1.0"},
        "body": "username=admin&password=%27+OR+%271%27%3D%271",
        "scenario_label": "sqli",
    },
    {
        "event_id": "int-test-3", "timestamp": "2026-10-26T10:00:08Z",
        "method": "GET", "path": "/api/search", "query": "q=%3Cscript%3Ealert%281%29%3C%2Fscript%3E",
        "headers": {"user-agent": "IntelliAPI-AI-Simulator/1.0"}, "body": "",
        "scenario_label": "xss",
    },
    {
        "event_id": "int-test-4", "timestamp": "2026-10-26T10:00:12Z",
        "method": "GET", "path": "/api/files", "query": "name=..%2F..%2Fetc%2Fpasswd",
        "headers": {"user-agent": "IntelliAPI-AI-Simulator/1.0"}, "body": "",
        "scenario_label": "path_traversal",
    },
]


def http_get(path: str) -> dict:
    req = urllib.request.Request(f"{BASE}{path}")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def http_post(path: str, body: dict) -> dict:
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{BASE}{path}", data=data,
        headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


async def run() -> bool:
    passed = True

    # ---- 1. Health check ----------------------------------------------------
    health = http_get("/health")
    assert health["model_loaded"], "FAIL: model not loaded"
    print(f"[PASS] /health: model_loaded={health['model_loaded']} model={health['model_name']}")

    # ---- 2. Model info check ------------------------------------------------
    mi = http_get("/model-info")
    assert mi["accuracy"] > 0.85, f"FAIL: accuracy {mi['accuracy']:.4f} < 0.85"
    print(f"[PASS] /model-info: accuracy={mi['accuracy']*100:.2f}% f1={mi['f1']:.4f}")

    # ---- 3. WebSocket + /analyze pipeline -----------------------------------
    received_ids = []
    async with websockets.connect(WS) as ws:
        print("[PASS] /ws connected")

        for tc in TEST_CASES:
            resp = http_post("/analyze", tc)
            gt = tc["scenario_label"]
            pred = resp["prediction"]
            match = "MATCH" if (pred == "ATTACK") == (gt != "normal") else "MISMATCH"
            print(f"  [HTTP] {tc['event_id']} scenario={gt} prediction={pred} "
                  f"prob={resp['attack_probability']:.3f} decision={resp['decision']} "
                  f"latency={resp['inference_latency_ms']:.1f}ms  [{match}]")

        # Collect WS events with 5s timeout each
        for _ in range(len(TEST_CASES)):
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
                msg = json.loads(raw)
                if msg.get("type") == "event":
                    eid = msg["data"]["event_id"]
                    received_ids.append(eid)
                    print(f"  [WS]  received event_id={eid}")
            except asyncio.TimeoutError:
                print("  [WS]  timeout — no message received in 5s")
                passed = False

    sent_ids = [tc["event_id"] for tc in TEST_CASES]
    ws_ok = sorted(received_ids) == sorted(sent_ids)
    if ws_ok:
        print(f"[PASS] WebSocket: all {len(sent_ids)} events received")
    else:
        print(f"[FAIL] WebSocket: expected {sent_ids}, got {received_ids}")
        passed = False

    # ---- 4. /events endpoint -----------------------------------------------
    events = http_get("/events?limit=10")
    assert events["count"] >= len(TEST_CASES), "FAIL: /events count too low"
    print(f"[PASS] /events: count={events['count']}")

    # ---- 5. /stats endpoint ------------------------------------------------
    stats = http_get("/stats")
    assert stats["total_requests"] >= len(TEST_CASES), "FAIL: stats total_requests too low"
    print(f"[PASS] /stats: total={stats['total_requests']} "
          f"attacks={stats['detected_attacks']} rate={stats['attack_rate']:.2f}")

    return passed


if __name__ == "__main__":
    ok = asyncio.run(run())
    print()
    print("ALL TESTS PASSED" if ok else "SOME TESTS FAILED")
    sys.exit(0 if ok else 1)
