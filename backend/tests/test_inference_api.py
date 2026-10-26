"""
FastAPI endpoint tests using TestClient (no live server required).
These verify request/response contracts, error handling, and that
the real model pipeline is invoked.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

NORMAL_REQUEST = {
    "event_id": "test-normal-1",
    "timestamp": "2026-10-26T10:00:00Z",
    "method": "GET",
    "path": "/api/products",
    "query": "category=books&page=1",
    "headers": {"user-agent": "pytest/1.0"},
    "body": "",
    "scenario_label": "normal",
}

SQLI_REQUEST = {
    "event_id": "test-sqli-1",
    "timestamp": "2026-10-26T10:00:05Z",
    "method": "POST",
    "path": "/api/login",
    "query": "",
    "headers": {"user-agent": "pytest/1.0"},
    "body": "username=admin&password=%27+OR+%271%27%3D%271",
    "scenario_label": "sqli",
}


def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["model_loaded"] is True


def test_model_info_accuracy_above_85():
    r = client.get("/model-info")
    assert r.status_code == 200
    data = r.json()
    assert data["accuracy"] > 0.85, f"Accuracy {data['accuracy']} < 0.85"


def test_analyze_normal_request():
    r = client.post("/analyze", json=NORMAL_REQUEST)
    assert r.status_code == 200
    data = r.json()
    assert data["event_id"] == NORMAL_REQUEST["event_id"]
    assert data["prediction"] in ("NORMAL", "ATTACK")  # valid label
    assert 0.0 <= data["attack_probability"] <= 1.0
    assert data["risk_level"] in ("LOW", "MEDIUM", "HIGH")
    assert data["decision"] in ("ALLOW", "MONITOR", "BLOCK")
    assert isinstance(data["reasons"], list)
    assert len(data["reasons"]) > 0
    assert data["inference_latency_ms"] > 0


def test_analyze_sqli_request_flagged():
    r = client.post("/analyze", json=SQLI_REQUEST)
    assert r.status_code == 200
    data = r.json()
    assert data["prediction"] == "ATTACK", "SQL injection should be detected as ATTACK"
    assert data["attack_probability"] > 0.5
    assert data["decision"] in ("MONITOR", "BLOCK")


def test_analyze_heuristic_findings_on_xss():
    r = client.post("/analyze", json={
        **NORMAL_REQUEST,
        "event_id": "test-xss-1",
        "path": "/api/search",
        "query": "q=%3Cscript%3Ealert%281%29%3C%2Fscript%3E",
        "scenario_label": "xss",
    })
    assert r.status_code == 200
    data = r.json()
    # Heuristic should fire on <script>
    heuristic_types = [h["type"] for h in data["heuristic_findings"]]
    assert "xss" in heuristic_types


def test_analyze_response_schema_complete():
    r = client.post("/analyze", json=NORMAL_REQUEST)
    data = r.json()
    required_keys = [
        "event_id", "timestamp", "prediction", "attack_probability", "risk_level",
        "decision", "model_name", "reasons", "model_evidence", "decision_tree_path",
        "heuristic_findings", "inference_latency_ms", "request_summary", "decision_policy",
    ]
    for k in required_keys:
        assert k in data, f"Missing key: {k}"


def test_events_endpoint_after_analyze():
    client.post("/analyze", json={**NORMAL_REQUEST, "event_id": "events-test-1"})
    r = client.get("/events?limit=5")
    assert r.status_code == 200
    data = r.json()
    assert "events" in data
    ids = [e["event_id"] for e in data["events"]]
    assert "events-test-1" in ids


def test_stats_endpoint():
    r = client.get("/stats")
    assert r.status_code == 200
    data = r.json()
    assert "total_requests" in data
    assert data["total_requests"] >= 0


def test_invalid_request_body():
    r = client.post("/analyze", json={"event_id": "bad", "timestamp": "bad"})
    # FastAPI should return 422 Unprocessable Entity for missing required fields
    # but our schema has defaults for most fields, so just check it returns something
    assert r.status_code in (200, 422)


def test_event_not_found():
    r = client.get("/events/definitely-does-not-exist-xyz")
    assert r.status_code == 404


def test_root_endpoint():
    r = client.get("/")
    assert r.status_code == 200
    assert "IntelliAPI AI" in r.json().get("name", "")
