"""
Unit tests for feature extraction (app.features.extract).
These ensure the same feature function used at training time works identically
at inference time — a key engineering requirement.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.features.extract import extract_features, url_decode, NUMERIC_FEATURES


def test_extract_features_returns_all_keys():
    f = extract_features("GET", "/api/products", "category=books", "")
    assert "text" in f
    assert "method" in f
    for name in NUMERIC_FEATURES:
        assert name in f, f"Missing numeric feature: {name}"


def test_extract_method_normalised():
    f = extract_features("get", "/api", "", "")
    assert f["method"] == "GET"
    f2 = extract_features(None, "/api", "", "")
    assert f2["method"] == "GET"  # default


def test_url_decode_sql_injection():
    # Classic %27 = single quote
    decoded = url_decode("id%3D1%27%20OR%20%271%27%3D%271")
    assert "'" in decoded
    assert "OR" in decoded


def test_url_decode_double_encoding():
    # Double-encoded: %2527 -> %27 -> '
    decoded = url_decode("%2527")
    assert "'" in decoded


def test_special_char_count():
    f = extract_features("GET", "/api", "x='1' OR '1'='1'", "")
    assert f["quote_count"] >= 4


def test_angle_brackets_xss():
    f = extract_features("GET", "/api", "q=<script>alert(1)</script>", "")
    assert f["angle_bracket_count"] >= 2


def test_text_is_lowercase():
    f = extract_features("POST", "/API/Login", "User=ADMIN", "Password=SECRET")
    assert f["text"] == f["text"].lower()


def test_none_and_nan_handled():
    import math
    f = extract_features(None, None, float("nan"), None)
    assert f["method"] == "GET"
    assert isinstance(f["text"], str)
    assert all(isinstance(f[name], (int, float)) for name in NUMERIC_FEATURES)


def test_numeric_feature_count():
    assert len(NUMERIC_FEATURES) == 12
