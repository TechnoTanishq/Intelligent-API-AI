"""
Loads the trained sklearn pipelines + metadata at service startup.

The saved artifacts were produced by backend/training/train.py. Loading here
is identical to how training/evaluate.py loads them, guaranteeing the same
preprocessing pipeline is used offline and online.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Optional

import joblib

from app.config import settings

logger = logging.getLogger("intelliapi.model")


@dataclass
class ModelBundle:
    primary_model: object = None          # RandomForest pipeline (PRIMARY)
    baseline_model: object = None          # Decision Tree pipeline (interpretable)
    metrics: dict = field(default_factory=dict)
    training_config: dict = field(default_factory=dict)
    feature_importance: list = field(default_factory=list)
    artifacts_dir: str = ""
    loaded: bool = False

    @property
    def primary_model_name(self) -> str:
        return self.metrics.get("primary_model", "RandomForest")

    @property
    def accuracy(self) -> float:
        return self.metrics.get("random_forest", {}).get("accuracy", 0.0)

    def get_thresholds(self) -> dict[str, float]:
        return {
            "risk_low_max": settings.risk_low_max,
            "risk_high_min": settings.risk_high_min,
        }


_bundle: Optional[ModelBundle] = None


def _resolve_artifacts_dir() -> str:
    """Resolve the artifacts dir relative to the backend root (cwd) or absolute."""
    if os.path.isabs(settings.artifacts_dir):
        return settings.artifacts_dir
    # backend/ is three levels up from app/services/model_loader.py.
    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(backend_root, settings.artifacts_dir)


def _force_single_threaded(pipeline) -> None:
    """Set n_jobs=1 on the loaded pipeline's classifier for fast single-row inference."""
    try:
        clf = pipeline.named_steps.get("clf")
        if clf is not None and hasattr(clf, "n_jobs"):
            clf.n_jobs = 1
    except Exception as e:
        logger.warning("Could not set n_jobs=1 on model: %s", e)


def load_model() -> ModelBundle:
    """Load all artifacts into the module-level singleton."""
    global _bundle
    artifacts_dir = _resolve_artifacts_dir()
    bundle = ModelBundle(artifacts_dir=artifacts_dir)

    rf_path = os.path.join(artifacts_dir, settings.primary_model_file)
    dt_path = os.path.join(artifacts_dir, settings.baseline_model_file)
    metrics_path = os.path.join(artifacts_dir, settings.metrics_file)
    config_path = os.path.join(artifacts_dir, settings.config_file)
    fi_path = os.path.join(artifacts_dir, "feature_importance.json")

    if not os.path.exists(rf_path):
        raise FileNotFoundError(
            f"Primary model artifact not found: {rf_path}. "
            "Run the training pipeline first: python -m training.train (from backend/)."
        )

    logger.info("Loading model artifacts from %s", artifacts_dir)
    bundle.primary_model = joblib.load(rf_path)
    # The RandomForest was trained with n_jobs=-1 for fast training. For per-request
    # inference that overhead spins up/tears down a process pool on every call
    # (~200ms). Single-row prediction gets no benefit from parallelism, so force
    # n_jobs=1 here to keep inference fast (~15-30ms).
    _force_single_threaded(bundle.primary_model)
    logger.info("Loaded primary model: %s", settings.primary_model_file)

    if os.path.exists(dt_path):
        bundle.baseline_model = joblib.load(dt_path)
        logger.info("Loaded baseline model: %s", settings.baseline_model_file)
    else:
        logger.warning("Baseline model not found at %s", dt_path)

    if os.path.exists(metrics_path):
        with open(metrics_path, encoding="utf-8") as f:
            bundle.metrics = json.load(f)
    if os.path.exists(config_path):
        with open(config_path, encoding="utf-8") as f:
            bundle.training_config = json.load(f)
    if os.path.exists(fi_path):
        with open(fi_path, encoding="utf-8") as f:
            bundle.feature_importance = json.load(f)

    bundle.loaded = True
    _bundle = bundle
    logger.info("Model loaded. Primary=%s accuracy=%.4f",
                bundle.primary_model_name, bundle.accuracy)
    return bundle


def get_model_bundle() -> ModelBundle:
    """Return the loaded bundle, loading lazily if needed."""
    global _bundle
    if _bundle is None or not _bundle.loaded:
        load_model()
    return _bundle
