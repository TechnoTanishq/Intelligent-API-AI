"""
Re-evaluate saved IntelliAPI AI artifacts on the held-out test set.

This reloads the joblib pipelines exactly as the inference service does,
rebuilds the SAME test split (same random_state) and reprints metrics. It
verifies that:
  * artifacts load successfully, and
  * inference through the saved pipeline reproduces the training metrics.

Usage (run from backend/):
    python -m training.evaluate [path/to/csic_database.csv]
"""
from __future__ import annotations

import json
import os
import sys
import time

import joblib
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
sys.path.insert(0, BACKEND)
sys.path.insert(0, HERE)

from preprocess import load_dataset, prepare_train_test, to_feature_df  # noqa: E402
from synthetic import generate_synthetic_dataset  # noqa: E402


def main(csv_path: str | None = None) -> None:
    csv_path = csv_path or os.environ.get(
        "CSIC_CSV_PATH", "../../csic_database.csv~1/csic_database.csv"
    )
    artifacts_dir = os.path.join(BACKEND, "artifacts")

    print("=" * 70)
    print("INTELLIAPI AI - ARTIFACT RE-EVALUATION")
    print("=" * 70)

    # Load artifacts exactly like the service.
    rf = joblib.load(os.path.join(artifacts_dir, "pipeline_rf.joblib"))
    dt = joblib.load(os.path.join(artifacts_dir, "pipeline_dt.joblib"))

    # Rebuild the SAME combined dataset + split used during training so the
    # re-evaluation reproduces the saved metrics (random_state matches train.py).
    csic = load_dataset(csv_path)
    csic["source"] = "csic"
    csic["attack_type"] = ""
    synth = generate_synthetic_dataset(n_normal=3000, n_attack=6000, seed=42)
    synth["source"] = "synthetic"
    combined = pd.concat([csic, synth], ignore_index=True)
    _, test_df = prepare_train_test(combined, test_size=0.2, random_state=42)
    X_test = to_feature_df(test_df)
    y_test = test_df["label"].to_numpy()

    for name, pipe in [("DecisionTree", dt), ("RandomForest", rf)]:
        t0 = time.perf_counter()
        preds = pipe.predict(X_test)
        elapsed = (time.perf_counter() - t0) * 1000.0
        acc = (preds == y_test).mean()
        print(f"\n[{name}] accuracy on test set = {acc*100:.2f}%  "
              f"(latency {elapsed/max(len(y_test),1):.3f} ms/req)")
        if hasattr(pipe, "predict_proba"):
            proba = pipe.predict_proba(X_test)
            classes = list(pipe.classes_)
            attack_idx = classes.index(1)
            print(f"[{name}] sample attack probabilities: "
                  f"{[round(float(p),3) for p in proba[:5, attack_idx]]}")

    metrics_path = os.path.join(artifacts_dir, "metrics.json")
    if os.path.exists(metrics_path):
        with open(metrics_path, encoding="utf-8") as f:
            m = json.load(f)
        print("\nSaved metrics.json summary:")
        print(f"  RandomForest accuracy : {m['random_forest']['accuracy']*100:.2f}%")
        print(f"  RandomForest F1       : {m['random_forest']['f1']:.4f}")
        print(f"  RandomForest FPR      : {m['random_forest']['false_positive_rate']:.4f}")
        print(f"  RandomForest FNR      : {m['random_forest']['false_negative_rate']:.4f}")
        print("\nConfusion matrix (RandomForest) [TN FP; FN TP]:")
        cm = m["random_forest"]["confusion_matrix_grid"]
        print(f"  {cm}")
    else:
        print("\nNo metrics.json found - run training.train first.")


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    main(arg)
