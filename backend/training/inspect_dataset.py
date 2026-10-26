"""
Inspect the CSIC 2010 dataset and print a structured summary.

Usage (run from backend/):
    python -m training.inspect_dataset [path/to/csic_database.csv]

This does NOT train anything; it only reports shape, columns, label and method
distributions, missing values, and a few sample normal/anomalous requests so
the preprocessing decisions in preprocess.py are auditable.
"""
from __future__ import annotations

import os
import sys

import pandas as pd

# Allow `from training.preprocess import ...` and `from app... import ...`
HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
sys.path.insert(0, BACKEND)
sys.path.insert(0, HERE)

from preprocess import load_dataset, parse_request_line, LABEL_NAMES  # noqa: E402


def main(csv_path: str | None = None) -> None:
    csv_path = csv_path or os.environ.get(
        "CSIC_CSV_PATH", "../../csic_database.csv~1/csic_database.csv"
    )

    raw = pd.read_csv(csv_path)
    print("=" * 70)
    print("INTELLIAPI AI - DATASET INSPECTION (CSIC 2010 HTTP)")
    print("=" * 70)
    print(f"Path:  {csv_path}")
    print(f"Shape: {raw.shape[0]} rows x {raw.shape[1]} columns")
    print(f"Columns: {list(raw.columns)}")
    print()

    first_col = raw.columns[0]
    print("--- Label column (first unnamed col) ---")
    print(raw[first_col].value_counts(dropna=False).to_string())
    print()
    print("--- classification column ---")
    print(raw["classification"].value_counts(dropna=False).to_string())
    print()
    print("--- Method ---")
    print(raw["Method"].value_counts(dropna=False).to_string())
    print()
    print("--- Missing values per column ---")
    print(raw.isna().sum().to_string())
    print()

    df = load_dataset(csv_path)
    print("--- After load_dataset() (parsed path/query/body) ---")
    print(f"Rows: {len(df)}")
    print("Label counts:", df["label"].value_counts().to_dict())
    print("Method counts:", df["method"].value_counts().to_dict())
    print()

    print("--- 3 NORMAL examples ---")
    for _, r in df[df["label"] == 0].head(3).iterrows():
        print(f"  [{r['method']}] {r['path']}?{r['query'][:80]} | body={r['body'][:60]!r}")
    print()
    print("--- 3 ATTACK examples ---")
    for _, r in df[df["label"] == 1].head(3).iterrows():
        print(f"  [{r['method']}] {r['path']}?{r['query'][:80]} | body={r['body'][:60]!r}")
    print()
    print("Label names:", LABEL_NAMES)


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    main(arg)
