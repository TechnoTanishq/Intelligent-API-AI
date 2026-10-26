"""
Shared HTTP request feature extraction.

This module is the SINGLE source of truth for how an HTTP request is turned
into model input. Both the offline training pipeline (backend/training/) and
the online inference service (backend/app/services/inference.py) import from
here, which guarantees that the preprocessing used at training time is exactly
the preprocessing used at inference time (see engineering requirement #5).

Two feature groups are produced for the model:
  * `text`  - URL-decoded, lower-cased concatenation of method/path/query/body,
              consumed by a TF-IDF vectorizer (char n-grams) inside the sklearn
              ColumnTransformer.
  * numeric - length and character-distribution counts, consumed by a
              StandardScaler inside the same ColumnTransformer.
  * `method` - categorical, consumed by a OneHotEncoder.

The heuristic layer (services/heuristics.py) is intentionally separate and does
NOT feed the model; it produces human-readable findings used for explanation.
"""
from __future__ import annotations

import math
from urllib.parse import unquote

# Ordered list of numeric feature names. Referenced by training (to build the
# numeric DataFrame in a fixed column order) and by inference (to assemble a
# single-row DataFrame with the same column order). Order matters.
NUMERIC_FEATURES: list[str] = [
    "path_len",
    "query_len",
    "body_len",
    "special_char_count",
    "digit_count",
    "non_alnum_count",
    "equals_count",
    "semicolon_count",
    "slash_count",
    "quote_count",
    "angle_bracket_count",
    "paren_count",
]

# Characters we treat as "special" for the special_char_count feature.
SPECIAL_CHARS: str = "'\"<>;\\=*/()%!-+#&|"


def _clean(value) -> str:
    """Coerce any incoming value to a string, treating NaN/None as empty."""
    if value is None:
        return ""
    if isinstance(value, float):
        if math.isnan(value):
            return ""
        return str(int(value)) if value.is_integer() else str(value)
    return str(value)


def url_decode(value) -> str:
    """URL-decode a string, handling (single) double-encoding defensively."""
    raw = _clean(value)
    if not raw:
        return ""
    try:
        decoded = unquote(raw)
        # One extra pass catches double-encoded payloads (e.g. %2527 -> %27 -> ').
        if decoded != raw:
            decoded = unquote(decoded)
        return decoded
    except Exception:
        return raw


def extract_features(method, path, query, body) -> dict:
    """
    Build the full feature dict for one request.

    Returns a dict with keys: 'text', 'method' and every name in NUMERIC_FEATURES.
    This dict is converted to a one-row DataFrame at inference time and to a
    DataFrame column-by-column at training time.
    """
    method_s = _clean(method).upper() or "GET"
    path_d = url_decode(path)
    query_d = url_decode(query)
    body_d = url_decode(body)

    text = f"{method_s} {path_d} {query_d} {body_d}".strip().lower()
    combined = f"{path_d} {query_d} {body_d}"

    features = {
        "text": text,
        "method": method_s,
        "path_len": len(path_d),
        "query_len": len(query_d),
        "body_len": len(body_d),
        "special_char_count": sum(combined.count(c) for c in SPECIAL_CHARS),
        "digit_count": sum(c.isdigit() for c in combined),
        "non_alnum_count": sum((not c.isalnum()) and (not c.isspace()) for c in combined),
        "equals_count": combined.count("="),
        "semicolon_count": combined.count(";"),
        "slash_count": combined.count("/"),
        "quote_count": combined.count("'") + combined.count('"'),
        "angle_bracket_count": combined.count("<") + combined.count(">"),
        "paren_count": combined.count("(") + combined.count(")"),
    }
    return features


def build_features_frame(rows: list[dict]) -> "dict[str, list]":
    """
    Helper used by the training pipeline to convert many raw request dicts
    into column-oriented arrays for building a pandas DataFrame.

    Each `row` is expected to have: method, path, query, body.
    """
    out = {"text": [], "method": []}
    for name in NUMERIC_FEATURES:
        out[name] = []
    for row in rows:
        f = extract_features(row.get("method"), row.get("path"),
                             row.get("query"), row.get("body"))
        out["text"].append(f["text"])
        out["method"].append(f["method"])
        for name in NUMERIC_FEATURES:
            out[name].append(f[name])
    return out
