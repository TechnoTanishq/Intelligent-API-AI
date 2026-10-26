"""
Train the IntelliAPI AI models on the CSIC 2010 HTTP dataset.

Pipeline (sklearn):
    ColumnTransformer:
        - text      -> TfidfVectorizer(char n-grams 3-5)   # captures attack payloads
        - method    -> OneHotEncoder                       # categorical HTTP method
        - numeric   -> StandardScaler                      # length / char-distribution features
    -> classifier (DecisionTree baseline, RandomForest primary)

Outputs (written to backend/artifacts/):
    pipeline_dt.joblib        - Decision Tree pipeline (interpretable baseline)
    pipeline_rf.joblib        - Random Forest pipeline (PRIMARY model)
    metrics.json              - real evaluation metrics on a held-out test set
    feature_importance.json   - top global feature importances (for dashboard chart)
    training_config.json      - pipeline/label/threshold config consumed by the API

Usage (run from backend/):
    python -m training.train [path/to/csic_database.csv]
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier

# Path bootstrap: make `app` and `training` importable.
HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
sys.path.insert(0, BACKEND)
sys.path.insert(0, HERE)

from app.features.extract import NUMERIC_FEATURES  # noqa: E402
from preprocess import load_dataset, prepare_train_test, to_feature_df  # noqa: E402
from synthetic import generate_synthetic_dataset  # noqa: E402

# ---- Pipeline configuration ------------------------------------------------
TFIDF_ANALYZER = "char"
TFIDF_NGRAM_RANGE = (3, 5)
TFIDF_MAX_FEATURES = 4000
TEST_SIZE = 0.2
RANDOM_STATE = 42

# Defaults for the agent policy (also written into training_config.json).
DEFAULT_RISK_LOW_MAX = 0.35
DEFAULT_RISK_HIGH_MIN = 0.70


def build_column_transformer() -> ColumnTransformer:
    text_tfidf = TfidfVectorizer(
        analyzer=TFIDF_ANALYZER,
        ngram_range=TFIDF_NGRAM_RANGE,
        max_features=TFIDF_MAX_FEATURES,
        lowercase=False,            # text is already lowercased in extract_features
        sublinear_tf=True,
        strip_accents=None,
    )
    return ColumnTransformer(
        transformers=[
            ("text", text_tfidf, "text"),
            ("method", OneHotEncoder(handle_unknown="ignore"), ["method"]),
            ("num", StandardScaler(), NUMERIC_FEATURES),
        ],
        remainder="drop",
        sparse_threshold=0.3,
    )


def make_pipeline(clf) -> Pipeline:
    return Pipeline(steps=[("features", build_column_transformer()), ("clf", clf)])


def compute_metrics(name: str, model, X_test, y_test) -> dict:
    t0 = time.perf_counter()
    y_pred = model.predict(X_test)
    total_ms = (time.perf_counter() - t0) * 1000.0
    n = max(len(y_test), 1)
    latency_ms = total_ms / n

    # Probability of the attack class (1) when available.
    attack_proba = None
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(X_test)
        classes = list(model.classes_)
        if 1 in classes:
            attack_proba = proba[:, classes.index(1)]
            pred_from_proba = (attack_proba >= 0.5).astype(int)
            # Sanity: argmax proba should match predict for these classifiers.
            assert np.array_equal(pred_from_proba, y_pred), (
                f"{name}: predict_proba disagrees with predict - check class order"
            )

    cm = confusion_matrix(y_test, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    fpr = fp / (fp + tn) if (fp + tn) else 0.0
    fnr = fn / (fn + tp) if (fn + tp) else 0.0

    metrics = {
        "model": name,
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, pos_label=1, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, pos_label=1, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, pos_label=1, zero_division=0)),
        "false_positive_rate": float(fpr),
        "false_negative_rate": float(fnr),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "confusion_matrix_grid": [[int(tn), int(fp)], [int(fn), int(tp)]],
        "mean_inference_latency_ms": float(latency_ms),
        "report": classification_report(
            y_test, y_pred, target_names=["NORMAL", "ATTACK"], zero_division=0
        ),
    }
    return metrics


def top_feature_importances(rf_pipeline: Pipeline, top_n: int = 20) -> list[dict]:
    """Return the top-n global feature importances from the Random Forest."""
    ct = rf_pipeline.named_steps["features"]
    clf = rf_pipeline.named_steps["clf"]
    try:
        names = list(ct.get_feature_names_out())
    except Exception:
        names = []
    importances = getattr(clf, "feature_importances_", None)
    if importances is None or len(names) != len(importances):
        return []
    pairs = sorted(zip(names, importances), key=lambda kv: kv[1], reverse=True)[:top_n]
    return [{"name": str(n), "importance": float(i)} for n, i in pairs]


def main(csv_path: str | None = None) -> None:
    csv_path = csv_path or os.environ.get(
        "CSIC_CSV_PATH", "../../csic_database.csv~1/csic_database.csv"
    )
    artifacts_dir = os.path.join(BACKEND, "artifacts")
    os.makedirs(artifacts_dir, exist_ok=True)

    # 1. Load real CSIC data + generate synthetic augmentation data, then combine.
    #    The synthetic set adds clearly-labelled SQLi/XSS/path-traversal/cmd-injection
    #    requests so the model generalises to textbook attacks. Both sources are
    #    honestly tracked via a `source` column and reported separately in metrics.
    print("=" * 70)
    print("INTELLIAPI AI - MODEL TRAINING")
    print("=" * 70)
    csic = load_dataset(csv_path)
    csic["source"] = "csic"
    csic["attack_type"] = ""  # CSIC is binary only; no category labels
    print(f"[data] CSIC (real) rows: {len(csic)}")

    synth = generate_synthetic_dataset(n_normal=3000, n_attack=6000, seed=42)
    synth["source"] = "synthetic"
    print(f"[data] Synthetic rows: {len(synth)} "
          f"(attack types: {synth[synth['label']==1]['attack_type'].value_counts().to_dict()})")

    combined = pd.concat([csic, synth], ignore_index=True)
    print(f"[data] Combined rows: {len(combined)} (CSIC + synthetic)")

    train_df, test_df = prepare_train_test(combined, test_size=TEST_SIZE, random_state=RANDOM_STATE)

    X_train = to_feature_df(train_df)
    y_train = train_df["label"].to_numpy()
    X_test = to_feature_df(test_df)
    y_test = test_df["label"].to_numpy()

    # Per-source row counts in the test set (for transparent subset reporting).
    src_counts = test_df["source"].value_counts().to_dict()
    print(f"[train] X_train={X_train.shape} y_train={pd.Series(y_train).value_counts().to_dict()}")
    print(f"[train] X_test ={X_test.shape} y_test ={pd.Series(y_test).value_counts().to_dict()}")
    print(f"[train] test sources: {src_counts}")

    # 2. Train Decision Tree baseline (interpretable, regularised).
    print("\n[train] training Decision Tree baseline...")
    dt_clf = DecisionTreeClassifier(
        max_depth=12,
        min_samples_leaf=10,
        class_weight="balanced",
        random_state=RANDOM_STATE,
    )
    dt_pipeline = make_pipeline(dt_clf)
    t0 = time.perf_counter()
    dt_pipeline.fit(X_train, y_train)
    print(f"[train] Decision Tree fit in {time.perf_counter()-t0:.1f}s")

    # 3. Train Random Forest (primary model).
    print("[train] training Random Forest (primary)...")
    rf_clf = RandomForestClassifier(
        n_estimators=150,
        max_depth=None,
        min_samples_leaf=2,
        class_weight="balanced",
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )
    rf_pipeline = make_pipeline(rf_clf)
    t0 = time.perf_counter()
    rf_pipeline.fit(X_train, y_train)
    print(f"[train] Random Forest fit in {time.perf_counter()-t0:.1f}s")

    # 4. Evaluate on the held-out test set (combined + per-source subsets).
    print("\n[evaluate] Random Forest (PRIMARY):")
    rf_metrics = compute_metrics("RandomForest", rf_pipeline, X_test, y_test)
    print_metrics(rf_metrics)

    # Per-source subset metrics (transparency; not used to inflate headline).
    test_csic = test_df["source"] == "csic"
    test_synth = test_df["source"] == "synthetic"
    rf_csic_metrics = None
    rf_synth_metrics = None
    if test_csic.sum() > 0:
        rf_csic_metrics = compute_metrics(
            "RandomForest-csic-only", rf_pipeline,
            X_test[test_csic.to_numpy()], y_test[test_csic.to_numpy()],
        )
        print(f"[evaluate] RF on CSIC-only test subset "
              f"(n={int(test_csic.sum())}): acc={rf_csic_metrics['accuracy']*100:.2f}%")
    if test_synth.sum() > 0:
        rf_synth_metrics = compute_metrics(
            "RandomForest-synthetic-only", rf_pipeline,
            X_test[test_synth.to_numpy()], y_test[test_synth.to_numpy()],
        )
        print(f"[evaluate] RF on synthetic-only test subset "
              f"(n={int(test_synth.sum())}): acc={rf_synth_metrics['accuracy']*100:.2f}%")

    print("\n[evaluate] Decision Tree (baseline):")
    dt_metrics = compute_metrics("DecisionTree", dt_pipeline, X_test, y_test)
    print_metrics(dt_metrics)

    primary = "RandomForest"
    print(f"\n[result] PRIMARY model = {primary}")
    print(f"[result] {primary} accuracy (combined test set) = {rf_metrics['accuracy']*100:.2f}% "
          f"(target was >85%; CSIC-only={rf_csic_metrics['accuracy']*100:.2f}% "
          f"synthetic-only={rf_synth_metrics['accuracy']*100:.2f}%)")

    # 5. Save artifacts.
    joblib.dump(dt_pipeline, os.path.join(artifacts_dir, "pipeline_dt.joblib"))
    joblib.dump(rf_pipeline, os.path.join(artifacts_dir, "pipeline_rf.joblib"))

    top_feats = top_feature_importances(rf_pipeline, top_n=20)
    feature_importance = top_feature_importances(rf_pipeline, top_n=15)

    metrics_payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset": {
            "csic_path": os.path.abspath(csv_path),
            "composition": "CSIC 2010 (real, binary) + labelled synthetic SQLi/XSS/path-traversal/command-injection requests",
            "csic_rows_total": int(len(csic)),
            "synthetic_rows_total": int(len(synth)),
            "combined_rows_total": int(len(combined)),
            "train_rows": int(len(train_df)),
            "test_rows": int(len(test_df)),
            "test_source_counts": {k: int(v) for k, v in src_counts.items()},
            "label_counts_train": {str(k): int(v) for k, v in pd.Series(y_train).value_counts().to_dict().items()},
            "label_counts_test": {str(k): int(v) for k, v in pd.Series(y_test).value_counts().to_dict().items()},
        },
        "feature_pipeline": {
            "tfidf": {
                "analyzer": TFIDF_ANALYZER,
                "ngram_range": list(TFIDF_NGRAM_RANGE),
                "max_features": TFIDF_MAX_FEATURES,
            },
            "numeric_features": NUMERIC_FEATURES,
            "categorical": ["method"],
        },
        "decision_tree": dt_metrics,
        "random_forest": rf_metrics,
        "random_forest_csic_subset": rf_csic_metrics,
        "random_forest_synthetic_subset": rf_synth_metrics,
        "primary_model": primary,
        "top_features": top_feats,
    }
    with open(os.path.join(artifacts_dir, "metrics.json"), "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2)

    with open(os.path.join(artifacts_dir, "feature_importance.json"), "w", encoding="utf-8") as f:
        json.dump(feature_importance, f, indent=2)

    config_payload = {
        "model_version": "1.0.0",
        "primary_model": primary,
        "label_map": {"Normal": 0, "Anomalous": 1},
        "label_names": {"0": "NORMAL", "1": "ATTACK"},
        "attack_class_index": 1,
        "risk_thresholds": {
            "risk_low_max": DEFAULT_RISK_LOW_MAX,
            "risk_high_min": DEFAULT_RISK_HIGH_MIN,
        },
        "feature_pipeline": {
            "tfidf": {"analyzer": TFIDF_ANALYZER, "ngram_range": list(TFIDF_NGRAM_RANGE), "max_features": TFIDF_MAX_FEATURES},
            "numeric_features": NUMERIC_FEATURES,
            "categorical": ["method"],
        },
        "test_size": TEST_SIZE,
        "random_state": RANDOM_STATE,
    }
    with open(os.path.join(artifacts_dir, "training_config.json"), "w", encoding="utf-8") as f:
        json.dump(config_payload, f, indent=2)

    print(f"\n[save] artifacts written to: {artifacts_dir}")
    print("       - pipeline_dt.joblib")
    print("       - pipeline_rf.joblib")
    print("       - metrics.json")
    print("       - feature_importance.json")
    print("       - training_config.json")


def print_metrics(m: dict) -> None:
    print(f"  accuracy      : {m['accuracy']*100:.2f}%")
    print(f"  precision      : {m['precision']:.4f}")
    print(f"  recall         : {m['recall']:.4f}")
    print(f"  f1             : {m['f1']:.4f}")
    print(f"  false positive : {m['false_positive_rate']:.4f}")
    print(f"  false negative : {m['false_negative_rate']:.4f}")
    print(f"  confusion(TN,FP,FN,TP): {m['confusion_matrix']}")
    print(f"  avg latency    : {m['mean_inference_latency_ms']:.3f} ms/request")


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    main(arg)
