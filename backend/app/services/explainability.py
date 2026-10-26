"""
Per-request explainability for IntelliAPI AI.

Two complementary, HONEST explanation channels are produced:

1. Model evidence (Random Forest): the globally most-important features are
   checked against THIS request to report which important patterns the model
   relies on are actually present. This is grounded in the request, not a
   generic "SQL injection detected" claim.

2. Decision Tree decision path (interpretable baseline): the textual sequence
   of feature/threshold tests the baseline tree followed for this request.

These are presented separately from heuristic findings (services/heuristics.py)
so the UI can clearly distinguish ML evidence from rule-based signals.
"""
from __future__ import annotations

import logging

import numpy as np
import scipy.sparse as sp

from app.features.extract import extract_features
from app.services.model_loader import get_model_bundle

logger = logging.getLogger("intelliapi.explain")


def model_evidence_for_request(method: str, path: str, query: str, body: str,
                               top_n: int = 8) -> list[dict]:
    """
    Return the top-N globally important features, flagging which are present in
    this request. For TF-IDF (char n-gram) features, 'present' means the n-gram
    substring occurs in the request's decoded, lower-cased text.
    """
    bundle = get_model_bundle()
    top_feats = bundle.feature_importance or []
    if not top_feats:
        return []

    feats = extract_features(method, path, query, body)
    text = feats["text"]  # already lower-cased + URL-decoded
    method = feats["method"]

    evidence: list[dict] = []
    for f in top_feats[:max(top_n * 2, top_n)]:
        name = f.get("name", "")
        importance = float(f.get("importance", 0.0))
        present = False
        # TF-IDF char n-gram feature, named like "text__<ngram>"
        if name.startswith("text__"):
            ngram = name[len("text__"):]
            present = ngram in text
        elif name.startswith("method__"):
            present = name.endswith(f"__{method}")
        elif name.startswith("num__"):
            present = True  # numeric features always have a real value
        else:
            present = name in text
        if present or len(evidence) < top_n:
            evidence.append({"feature": name, "importance": importance, "present": present})
        if len(evidence) >= top_n:
            break
    # Sort: present ones first, then by importance.
    evidence.sort(key=lambda e: (not e["present"], -e["importance"]))
    return evidence[:top_n]


def decision_tree_path(method: str, path: str, query: str, body: str,
                       max_steps: int = 12) -> list[dict]:
    """
    Trace the interpretable Decision Tree baseline's decision path for this
    request. Returns a list of human-readable steps. Falls back to [] if the
    baseline model or feature names are unavailable.
    """
    bundle = get_model_bundle()
    dt = bundle.baseline_model
    if dt is None:
        return []

    try:
        from app.services.inference import build_request_frame

        X = build_request_frame(method, path, query, body)
        ct = dt.named_steps["features"]
        clf = dt.named_steps["clf"]
        feature_names = list(ct.get_feature_names_out())

        Xt = ct.transform(X)
        if sp.issparse(Xt):
            Xt_dense = Xt.toarray()
        else:
            Xt_dense = np.asarray(Xt)

        dp = clf.decision_path(Xt)
        node_indices = list(dp.indices)
        tree = clf.tree_

        steps: list[dict] = []
        for i, node in enumerate(node_indices):
            if len(steps) >= max_steps:
                break
            is_leaf = tree.children_left[node] == -1
            if is_leaf or i == len(node_indices) - 1:
                value = tree.value[node][0]
                pred = int(np.argmax(value))
                steps.append({
                    "node": int(node),
                    "leaf": True,
                    "prediction": "ATTACK" if pred == 1 else "NORMAL",
                })
            else:
                feat_idx = int(tree.feature[node])
                threshold = float(tree.threshold[node])
                val = float(Xt_dense[0, feat_idx])
                feat_name = (feature_names[feat_idx]
                             if feat_idx < len(feature_names) else f"feature_{feat_idx}")
                steps.append({
                    "node": int(node),
                    "feature": feat_name,
                    "threshold": round(threshold, 4),
                    "direction": "<=" if val <= threshold else ">",
                    "value": round(val, 4),
                })
        return steps
    except Exception as e:  # explanation is best-effort, never break inference
        logger.warning("Decision tree path explanation failed: %s", e)
        return []
