"""
Runtime model inference for a single HTTP request.

Uses the SAME feature extraction (app.features.extract) as training, builds a
one-row DataFrame with the exact column layout the trained ColumnTransformer
expects, and returns the predicted class + attack probability.
"""
from __future__ import annotations

import logging

import pandas as pd

from app.features.extract import NUMERIC_FEATURES, extract_features
from app.services.model_loader import get_model_bundle

logger = logging.getLogger("intelliapi.inference")

# Class index of the attack class. For our trained models, classes_ is [0, 1].
ATTACK_CLASS = 1


def build_request_frame(method: str, path: str, query: str, body: str) -> pd.DataFrame:
    """Build a one-row DataFrame matching the training feature layout."""
    feats = extract_features(method, path, query, body)
    row = {"text": feats["text"], "method": feats["method"]}
    for name in NUMERIC_FEATURES:
        row[name] = feats[name]
    return pd.DataFrame([row])


def predict(method: str, path: str, query: str, body: str) -> dict:
    """Run the primary model and return prediction + probability."""
    bundle = get_model_bundle()
    model = bundle.primary_model
    X = build_request_frame(method, path, query, body)

    pred_label = int(model.predict(X)[0])
    classes = list(model.classes_)
    attack_proba = 0.0
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(X)[0]
        if ATTACK_CLASS in classes:
            attack_proba = float(proba[classes.index(ATTACK_CLASS)])
        else:
            attack_proba = float(proba[1]) if len(proba) > 1 else float(proba[0])
    else:
        attack_proba = 1.0 if pred_label == ATTACK_CLASS else 0.0

    prediction_name = "ATTACK" if pred_label == ATTACK_CLASS else "NORMAL"
    return {
        "prediction": prediction_name,
        "attack_probability": attack_proba,
        "model_name": bundle.primary_model_name,
    }
