"""
Pydantic schemas for the IntelliAPI AI inference API.

The request is a validated representation of an HTTP request (NOT a raw raw
capture). The response separates the model's prediction from the agent's final
decision and the heuristic findings, matching the project's explainability
requirements.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    """An HTTP request representation sent for security analysis."""
    event_id: str = Field(..., description="Unique identifier for this request event")
    timestamp: str = Field(..., description="ISO-8601 timestamp of the request")
    method: str = Field("GET", description="HTTP method")
    path: str = Field("", description="Request path, e.g. /api/products")
    query: str = Field("", description="Raw query string, e.g. id=1&category=books")
    headers: dict[str, str] = Field(default_factory=dict, description="Request headers")
    body: str = Field("", description="Request body (form or raw text)")
    scenario_label: Optional[str] = Field(
        None,
        description="Optional simulator ground-truth label (e.g. sqli). Stored for "
                    "evaluation/display only and NEVER used as a model input feature.",
    )

    model_config = {"json_schema_extra": {
        "example": {
            "event_id": "event-0001",
            "timestamp": "2026-10-26T10:00:00Z",
            "method": "GET",
            "path": "/api/products",
            "query": "category=books",
            "headers": {"user-agent": "IntelliAPI-AI-Simulator/1.0"},
            "body": "",
        }
    }}


class HeuristicFinding(BaseModel):
    type: str = Field(..., description="Heuristic category, e.g. sqli / xss / path_traversal")
    pattern: str = Field(..., description="Regex pattern that matched")
    evidence: str = Field(..., description="The matched substring / observed evidence")
    description: str = Field(..., description="Human-readable explanation")


class ModelEvidence(BaseModel):
    feature: str = Field(..., description="Model feature name that contributed")
    importance: float = Field(..., description="Global importance weight")
    present: bool = Field(..., description="Whether this feature is active in this request")


class DecisionTreeStep(BaseModel):
    """One step of the interpretable Decision Tree decision path (baseline)."""
    node: int
    feature: Optional[str] = None
    threshold: Optional[float] = None
    direction: Optional[str] = None  # "<=" or ">"
    leaf: bool = False
    prediction: Optional[str] = None


class AnalyzeResponse(BaseModel):
    """The full structured analysis returned by the intelligent agent."""
    event_id: str
    timestamp: str
    prediction: str = Field(..., description="Model class: NORMAL or ATTACK")
    attack_type: Optional[str] = Field(None, description="Inferred attack type from heuristics (not a model label)")
    attack_probability: float = Field(..., description="Model-estimated probability of an attack")
    risk_level: str = Field(..., description="LOW / MEDIUM / HIGH")
    decision: str = Field(..., description="Agent action: ALLOW / MONITOR / BLOCK")
    model_name: str
    reasons: list[str] = Field(default_factory=list, description="Why the agent chose this action")
    model_evidence: list[ModelEvidence] = Field(default_factory=list)
    decision_tree_path: list[DecisionTreeStep] = Field(default_factory=list)
    heuristic_findings: list[HeuristicFinding] = Field(default_factory=list)
    inference_latency_ms: float
    request_summary: dict = Field(default_factory=dict, description="Non-sensitive request summary")
    decision_policy: str = Field(..., description="The policy rule that fired")

    model_config = {"json_schema_extra": {
        "example": {
            "event_id": "event-0001",
            "timestamp": "2026-10-26T10:00:00Z",
            "prediction": "NORMAL",
            "attack_type": None,
            "attack_probability": 0.04,
            "risk_level": "LOW",
            "decision": "ALLOW",
            "model_name": "RandomForest",
            "reasons": ["The model assigned a low attack probability (0.04)"],
            "model_evidence": [],
            "decision_tree_path": [],
            "heuristic_findings": [],
            "inference_latency_ms": 12.0,
            "request_summary": {"method": "GET", "path": "/api/products", "query": "category=books"},
            "decision_policy": "attack_probability < 0.35 -> ALLOW",
        }
    }}


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_name: str
    version: str


class ModelInfoResponse(BaseModel):
    model_name: str
    model_version: str
    primary_model: str
    accuracy: float
    precision: float
    recall: float
    f1: float
    false_positive_rate: float
    false_negative_rate: float
    confusion_matrix: list[list[int]]
    feature_importance: list[dict]
    risk_thresholds: dict[str, float]
    label_names: dict[str, str]
    training_composition: dict


class StatsResponse(BaseModel):
    total_requests: int
    detected_attacks: int
    allowed_requests: int
    monitored_requests: int
    blocked_requests: int
    attack_rate: float
    avg_inference_latency_ms: float
    attack_type_distribution: dict[str, int]
    decision_distribution: dict[str, int]
    risk_distribution: dict[str, int]


class EventRecord(BaseModel):
    """A stored analysed event (used by /events and WebSocket)."""
    event_id: str
    timestamp: str
    method: str
    path: str
    query: str
    prediction: str
    attack_type: Optional[str]
    attack_probability: float
    risk_level: str
    decision: str
    inference_latency_ms: float
    scenario_label: Optional[str] = None
    result: dict  # full AnalyzeResponse as dict
