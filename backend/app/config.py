"""
Application configuration loaded from environment variables / .env.

A small manual loader is used (python-dotenv + os.environ) so the project does
not depend on pydantic-settings. All values have documented defaults.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

try:
    from dotenv import load_dotenv
    # .env lives at the backend root (one level above the app package).
    _env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.exists(_env_path):
        load_dotenv(_env_path)
except Exception:
    pass  # .env is optional; env vars may be set directly.


def _get(key: str, default: str) -> str:
    return os.getenv(key, default)


def _get_float(key: str, default: float) -> float:
    try:
        return float(os.getenv(key, default))
    except (TypeError, ValueError):
        return default


def _get_int(key: str, default: int) -> int:
    try:
        return int(os.getenv(key, default))
    except (TypeError, ValueError):
        return default


def _get_bool(key: str, default: bool) -> bool:
    v = os.getenv(key, str(default)).strip().lower()
    return v in ("1", "true", "yes", "on")


@dataclass
class Settings:
    # Server
    host: str = field(default_factory=lambda: _get("HOST", "127.0.0.1"))
    port: int = field(default_factory=lambda: _get_int("PORT", 8000))
    cors_origins: list[str] = field(
        default_factory=lambda: [
            o.strip() for o in _get("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174").split(",")
            if o.strip()
        ]
    )
    log_level: str = field(default_factory=lambda: _get("LOG_LEVEL", "INFO"))

    # Artifacts
    artifacts_dir: str = field(default_factory=lambda: _get("MODEL_DIR", "artifacts"))
    primary_model_file: str = field(default_factory=lambda: _get("PRIMARY_MODEL", "pipeline_rf.joblib"))
    baseline_model_file: str = field(default_factory=lambda: _get("BASELINE_MODEL", "pipeline_dt.joblib"))
    metrics_file: str = field(default_factory=lambda: _get("METRICS_FILE", "metrics.json"))
    config_file: str = field(default_factory=lambda: _get("CONFIG_FILE", "training_config.json"))

    # Agent decision policy thresholds (on attack probability)
    risk_low_max: float = field(default_factory=lambda: _get_float("RISK_LOW_MAX", 0.35))
    risk_high_min: float = field(default_factory=lambda: _get_float("RISK_HIGH_MIN", 0.70))

    # Heuristic layer
    enable_heuristics: bool = field(default_factory=lambda: _get_bool("ENABLE_HEURISTICS", True))

    # Event store
    max_events_stored: int = field(default_factory=lambda: _get_int("MAX_EVENTS_STORED", 2000))

    # Storage backend
    storage_backend: str = field(default_factory=lambda: _get("STORAGE_BACKEND", "memory"))
    mongo_uri: str = field(default_factory=lambda: _get("MONGO_URI", ""))
    mongo_db: str = field(default_factory=lambda: _get("MONGO_DB", "intelliapi_ai"))
    mongo_collection: str = field(default_factory=lambda: _get("MONGO_COLLECTION", "events"))

    app_name: str = "IntelliAPI AI"
    app_version: str = "1.0.0"


settings = Settings()
