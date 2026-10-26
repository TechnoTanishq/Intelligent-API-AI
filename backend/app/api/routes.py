"""
HTTP + WebSocket API routes for IntelliAPI AI.

Endpoints:
    GET  /health         - service + model health
    GET  /model-info     - loaded model metadata, metrics, feature importance, thresholds
    POST /analyze        - analyse one HTTP request representation (the intelligent agent)
    GET  /events         - recent analysed events
    GET  /events/{id}    - a single event with full explanation
    GET  /stats          - aggregate dashboard statistics
    WS   /ws             - live event stream for the dashboard
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool

from app import __version__
from app.config import settings
from app.schemas.analyze import (
    AnalyzeRequest,
    AnalyzeResponse,
    HealthResponse,
    ModelInfoResponse,
    StatsResponse,
)
from app.services import agent
from app.services.model_loader import get_model_bundle
from app.storage.event_store import get_store
from app.websocket.manager import manager

logger = logging.getLogger("intelliapi.api")
router = APIRouter()


def _build_event_record(request: AnalyzeRequest, response: dict) -> dict:
    """Compact stored event + the full response for the investigation panel."""
    return {
        "event_id": response["event_id"],
        "timestamp": response["timestamp"],
        "received_at": datetime.now(timezone.utc).isoformat(),
        "method": request.method or "GET",
        "path": request.path or "",
        "query": request.query or "",
        "prediction": response["prediction"],
        "attack_type": response.get("attack_type"),
        "attack_probability": response["attack_probability"],
        "risk_level": response["risk_level"],
        "decision": response["decision"],
        "inference_latency_ms": response["inference_latency_ms"],
        "scenario_label": request.scenario_label,
        "result": response,
    }


# ---------------------------------------------------------------------------
# Health & metadata
# ---------------------------------------------------------------------------
@router.get("/health", response_model=HealthResponse, tags=["meta"])
def health() -> HealthResponse:
    bundle = get_model_bundle()
    return HealthResponse(
        status="ok" if bundle.loaded else "model_not_loaded",
        model_loaded=bundle.loaded,
        model_name=bundle.primary_model_name,
        version=__version__,
    )


@router.get("/model-info", response_model=ModelInfoResponse, tags=["meta"])
def model_info() -> ModelInfoResponse:
    bundle = get_model_bundle()
    m = bundle.metrics.get("random_forest", {})
    cm = m.get("confusion_matrix_grid", [[0, 0], [0, 0]])
    composition = {
        "composition": bundle.metrics.get("dataset", {}).get("composition", ""),
        "train_rows": bundle.metrics.get("dataset", {}).get("train_rows", 0),
        "test_rows": bundle.metrics.get("dataset", {}).get("test_rows", 0),
        "test_source_counts": bundle.metrics.get("dataset", {}).get("test_source_counts", {}),
        "csic_subset_accuracy": (bundle.metrics.get("random_forest_csic_subset") or {}).get("accuracy"),
        "synthetic_subset_accuracy": (bundle.metrics.get("random_forest_synthetic_subset") or {}).get("accuracy"),
    }
    label_names = bundle.training_config.get("label_names", {"0": "NORMAL", "1": "ATTACK"})
    return ModelInfoResponse(
        model_name=bundle.primary_model_name,
        model_version=bundle.training_config.get("model_version", __version__),
        primary_model=bundle.primary_model_name,
        accuracy=m.get("accuracy", 0.0),
        precision=m.get("precision", 0.0),
        recall=m.get("recall", 0.0),
        f1=m.get("f1", 0.0),
        false_positive_rate=m.get("false_positive_rate", 0.0),
        false_negative_rate=m.get("false_negative_rate", 0.0),
        confusion_matrix=cm,
        feature_importance=bundle.feature_importance,
        risk_thresholds=settings.get_thresholds() if hasattr(settings, "get_thresholds")
        else {"risk_low_max": settings.risk_low_max, "risk_high_min": settings.risk_high_min},
        label_names=label_names,
        training_composition=composition,
    )


# ---------------------------------------------------------------------------
# The intelligent agent endpoint
# ---------------------------------------------------------------------------
@router.post("/analyze", response_model=AnalyzeResponse, tags=["agent"])
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    # Run the (CPU-bound, ~1ms) agent loop in a worker thread so the event loop
    # stays responsive for WebSocket broadcasts.
    response = await run_in_threadpool(agent.act, request)

    # Store + broadcast the resulting event.
    event = _build_event_record(request, response)
    get_store().add(event)
    await manager.broadcast({"type": "event", "data": event})

    return AnalyzeResponse(**response)


# ---------------------------------------------------------------------------
# Events & stats
# ---------------------------------------------------------------------------
@router.get("/events", tags=["events"])
def list_events(limit: int = 50) -> dict:
    limit = max(1, min(limit, settings.max_events_stored))
    return {"events": get_store().recent(limit), "count": len(get_store().recent(limit))}


@router.get("/events/{event_id}", tags=["events"])
def get_event(event_id: str) -> dict:
    event = get_store().get(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="event not found")
    return event


@router.get("/stats", response_model=StatsResponse, tags=["events"])
def stats() -> StatsResponse:
    s = get_store().stats()
    return StatsResponse(**s)


@router.post("/events/clear", tags=["events"])
def clear_events() -> dict:
    get_store().clear()
    return {"status": "cleared"}


# ---------------------------------------------------------------------------
# WebSocket live stream
# ---------------------------------------------------------------------------
@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        while True:
            # We primarily send events; we still read to detect disconnects.
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)
