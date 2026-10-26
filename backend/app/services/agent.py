"""
The IntelliAPI AI intelligent agent.

This is the reactive agent's control loop for a single request:

    OBSERVE      -> the incoming HTTP request representation
    EXTRACT      -> shared feature extraction (same as training)
    INTERPRET    -> trained RandomForest predicts NORMAL/ATTACK + probability
    EVALUATE     -> transparent heuristics flag known malicious patterns
    DECIDE       -> documented decision policy selects ALLOW / MONITOR / BLOCK
    EXPLAIN      -> model evidence + decision-tree path + heuristic findings
    PUBLISH      -> structured result returned to caller (and broadcast via WS)

The agent does NOT learn online and does NOT retrain; it maps each observation
to an action through the fixed policy in agent/policy.py.
"""
from __future__ import annotations

import logging
import time

from app.agent.policy import decide
from app.config import settings
from app.features.extract import extract_features
from app.services.explainability import decision_tree_path, model_evidence_for_request
from app.services.heuristics import analyze_text, heuristic_strength, infer_attack_type
from app.services.inference import predict

logger = logging.getLogger("intelliapi.agent")


def _build_reasons(prediction: str, attack_probability: float, decision: str,
                    risk_level: str, policy_rule: str, model_evidence: list[dict],
                    heuristic_findings: list[dict]) -> list[str]:
    """Compose human-readable reasons for the chosen action."""
    reasons: list[str] = []
    reasons.append(
        f"The model predicted {prediction} with attack probability "
        f"{attack_probability:.3f} (risk {risk_level})."
    )
    present_ev = [e for e in model_evidence if e.get("present")]
    if present_ev:
        names = ", ".join(e["feature"] for e in present_ev[:5])
        reasons.append(f"Request features that influenced the model: {names}.")
    elif model_evidence:
        reasons.append("No high-importance suspicious model features were present in this request.")
    if heuristic_findings:
        cats = sorted({f["type"] for f in heuristic_findings})
        reasons.append(
            f"Heuristic layer flagged {len(heuristic_findings)} indicator(s): "
            f"{', '.join(cats)}."
        )
    else:
        reasons.append("No heuristic indicators (SQLi/XSS/path traversal/command injection) were triggered.")
    reasons.append(f"Decision policy: {policy_rule} -> action {decision}.")
    return reasons


def act(request) -> dict:
    """
    Run the full agent loop on an AnalyzeRequest and return the structured
    AnalyzeResponse as a dict.
    """
    t0 = time.perf_counter()

    method = request.method or "GET"
    path = request.path or ""
    query = request.query or ""
    body = request.body or ""

    # 1-2. Predict with the model.
    pred = predict(method, path, query, body)
    prediction = pred["prediction"]
    attack_probability = pred["attack_probability"]
    model_name = pred["model_name"]

    # 3. Heuristic evaluation (separate layer).
    feats = extract_features(method, path, query, body)
    # Run heuristics on the decoded text for readable matches.
    decoded = feats["text"]
    heuristic_findings = analyze_text(decoded) if settings.enable_heuristics else []
    strength = heuristic_strength(heuristic_findings)
    attack_type = infer_attack_type(heuristic_findings) if prediction == "ATTACK" else None

    # 4. Decision policy.
    decision = decide(attack_probability, strength)

    # 5. Explainability.
    model_evidence = model_evidence_for_request(method, path, query, body, top_n=8)
    dt_path = decision_tree_path(method, path, query, body)

    latency_ms = (time.perf_counter() - t0) * 1000.0

    # 6. Compose reasons.
    reasons = _build_reasons(
        prediction, attack_probability, decision.action, decision.risk_level,
        decision.policy_rule, model_evidence, heuristic_findings,
    )

    response = {
        "event_id": request.event_id,
        "timestamp": request.timestamp,
        "prediction": prediction,
        "attack_type": attack_type,
        "attack_probability": round(float(attack_probability), 4),
        "risk_level": decision.risk_level,
        "decision": decision.action,
        "model_name": model_name,
        "reasons": reasons,
        "model_evidence": model_evidence,
        "decision_tree_path": dt_path,
        "heuristic_findings": heuristic_findings,
        "inference_latency_ms": round(float(latency_ms), 3),
        "request_summary": {
            "method": method,
            "path": path[:200],
            "query": query[:200],
            "body_length": len(body),
        },
        "decision_policy": decision.policy_rule,
        "base_action": decision.base_action,
        "escalated_by_heuristics": decision.escalated_by_heuristics,
    }
    return response
