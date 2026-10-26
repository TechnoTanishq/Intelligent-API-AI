"""
Dataset loading, cleaning, URL parsing and leakage-controlled splitting.

The CSIC 2010 CSV stores the full request line in the `URL` column
(e.g. `http://localhost:8080/tienda1/publico/anadir.jsp?id=... HTTP/1.1`).
We parse it into `path` and `query`, use `content` as the body, and normalise
the label into a 0/1 integer (Normal=0, Anomalous=1).

Leakage control: the same request signature (method + decoded text) can appear
many times in the raw data (e.g. the same product page hit repeatedly, differing
only by the JSESSIONID cookie, which we exclude from the model input). To avoid
near-duplicate requests leaking across the train/test boundary we:

  1. Compute a request signature = (method, lowercased decoded text).
  2. Deduplicate to one row per signature, keeping the MAJORITY label per
     signature (this also resolves the rare conflicting-label cases where the
     same base path is labelled both Normal and Anomalous).
  3. Perform a stratified train/test split on the deduplicated set.

Counts before/after are printed so the reduction is transparent.
"""
from __future__ import annotations

import os
import re
from typing import Tuple

import pandas as pd

# Label mapping. CSIC uses "Normal" / "Anomalous".
LABEL_MAP = {"Normal": 0, "Anomalous": 1}
LABEL_NAMES = {0: "NORMAL", 1: "ATTACK"}


def _clean_scalar(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float):
        if v != v:  # NaN
            return ""
        return str(int(v)) if v.is_integer() else str(v)
    return str(v)


def parse_request_line(url_field) -> Tuple[str, str]:
    """
    Parse the CSIC `URL` field into (path, query).

    Input examples:
      http://localhost:8080/tienda1/publico/anadir.jsp?id=2&nombre=... HTTP/1.1
      http://localhost:8080/asf-logo-wide.gif~ HTTP/1.1
    Returns:
      ("/tienda1/publico/anadir.jsp", "id=2&nombre=...")
    """
    s = _clean_scalar(url_field).strip()
    # Drop trailing protocol marker like " HTTP/1.1".
    s = re.sub(r"\s+HTTP/\d\.\d\s*$", "", s).strip()
    # Drop scheme.
    if "://" in s:
        s = s.split("://", 1)[1]
    # Separate host from path+query.
    slash = s.find("/")
    if slash == -1:
        return "", ""
    rest = s[slash + 1:]  # everything after the first '/'
    if "?" in rest:
        path, query = rest.split("?", 1)
    else:
        path, query = rest, ""
    return "/" + path, query


def load_dataset(csv_path: str) -> pd.DataFrame:
    """Load the CSIC CSV and return a tidy DataFrame with model-relevant columns."""
    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"Dataset not found at: {csv_path}\n"
            "Set CSIC_CSV_PATH in .env to point at the CSIC CSV file."
        )

    df = pd.read_csv(csv_path)

    # The first (unnamed) column holds the label.
    df = df.rename(columns={df.columns[0]: "label"})
    df["label"] = df["label"].map(LABEL_MAP)
    bad_labels = df["label"].isna().sum()
    if bad_labels:
        print(f"[preprocess] dropping {bad_labels} rows with unknown labels")
        df = df.dropna(subset=["label"])
    df["label"] = df["label"].astype(int)

    # Parse URL -> path, query
    parsed = df["URL"].apply(parse_request_line)
    df["path"] = parsed.apply(lambda p: p[0])
    df["query"] = parsed.apply(lambda p: p[1])

    # Body from content (NaN for GET requests)
    df["body"] = df["content"].apply(_clean_scalar)
    df["method"] = df["Method"].apply(lambda m: _clean_scalar(m).upper() or "GET")

    # Drop rows with no usable signal at all (no path and no body).
    empty_mask = (df["path"].str.len() == 0) & (df["query"].str.len() == 0) & (df["body"].str.len() == 0)
    if empty_mask.sum():
        print(f"[preprocess] dropping {int(empty_mask.sum())} completely-empty requests")
        df = df[~empty_mask]

    return df[["label", "method", "path", "query", "body"]].reset_index(drop=True)


def deduplicate(df: pd.DataFrame) -> pd.DataFrame:
    """
    Collapse exact-duplicate requests to a single row, keeping the FIRST
    occurrence and its ACTUAL label.

    The request signature is (method, lowercased URL-decoded text). Rows that
    are identical after this normalisation (e.g. the same product page hit many
    times, differing only by the JSESSIONID cookie which we exclude from model
    input) are collapsed to one. Each surviving row keeps its own real label
    rather than an invented majority label, which keeps the feature/label
    alignment intact and avoids fabricating labels.

    Because every signature becomes a single unique row before the split, no
    signature can appear in both the train and test sets (verified downstream as
    shared_signatures == 0), which prevents exact-duplicate leakage.
    """
    from app.features.extract import extract_features

    sigs = []
    for _, row in df.iterrows():
        f = extract_features(row["method"], row["path"], row["query"], row["body"])
        sigs.append(f"{row['method']}::{f['text']}")

    df = df.copy()
    df["__sig"] = sigs
    n_before = len(df)
    out = (
        df.drop_duplicates("__sig", keep="first")
        .drop(columns=["__sig"])
        .reset_index(drop=True)
    )
    # Report any signatures that carried conflicting labels (kept one real label).
    conflict_sigs = df.groupby("__sig")["label"].nunique()
    n_conflicting = int((conflict_sigs > 1).sum())
    print(f"[preprocess] dedup: {n_before} -> {len(out)} rows "
          f"(removed {n_before - len(out)} exact-duplicate signatures; "
          f"{n_conflicting} signatures had mixed labels, kept first row's real label)")
    return out


def prepare_train_test(
    df: pd.DataFrame,
    test_size: float = 0.2,
    random_state: int = 42,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Deduplicate then perform a stratified train/test split.

    Returns (train_df, test_df) each with columns: label, method, path, query, body.
    """
    from sklearn.model_selection import train_test_split

    deduped = deduplicate(df)
    train_df, test_df = train_test_split(
        deduped, test_size=test_size, random_state=random_state, stratify=deduped["label"]
    )
    print(f"[preprocess] split: train={len(train_df)} test={len(test_df)} "
          f"(test_size={test_size}, stratified)")
    print(f"[preprocess] train labels: {train_df['label'].value_counts().to_dict()}")
    print(f"[preprocess] test  labels: {test_df['label'].value_counts().to_dict()}")
    return train_df.reset_index(drop=True), test_df.reset_index(drop=True)


def to_feature_df(df: pd.DataFrame):
    """
    Build the model-input DataFrame (text, method, numeric features) from a
    preprocessed DataFrame. Used identically by training and the evaluation
    script so the column layout never drifts.
    """
    from app.features.extract import build_features_frame

    rows = df[["method", "path", "query", "body"]].to_dict("records")
    data = build_features_frame(rows)
    return pd.DataFrame(data)


if __name__ == "__main__":
    # Quick self-test when run directly.
    import sys
    csv_path = sys.argv[1] if len(sys.argv) > 1 else os.environ.get(
        "CSIC_CSV_PATH", "../../csic_database.csv~1/csic_database.csv"
    )
    df = load_dataset(csv_path)
    print("Loaded rows:", len(df))
    print("Label counts:", df["label"].value_counts().to_dict())
    print("Method counts:", df["method"].value_counts().to_dict())
    print("\nFirst 3 parsed rows:")
    print(df.head(3).to_string())
    train_df, test_df = prepare_train_test(df)
    print("\nSample train feature frame:")
    print(to_feature_df(train_df.head(2)).to_string())
