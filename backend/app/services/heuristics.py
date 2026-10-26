"""
Transparent heuristic detection layer.

This is intentionally SEPARATE from the ML model. It uses readable regular
expressions to flag well-known malicious patterns (SQL injection, XSS, path
traversal, command injection). Its output is shown in the UI under
`heuristic_findings` and used to infer an `attack_type`, but it never replaces
or silently overwrites the model's prediction.

The heuristics can only ESCALATE the agent's decision (e.g. ALLOW -> MONITOR)
when strong evidence is present; they never downgrade the model's verdict.
"""
from __future__ import annotations

import re

# Each rule: (category, compiled regex, description, human-readable label)
RULES: list[tuple[str, "re.Pattern", str]] = [
    # --- SQL injection -----------------------------------------------------
    ("sqli", re.compile(r"(?i)\b(or|and)\b\s+['\"]?\d*['\"]?\s*=\s*['\"]?\d*['\"]?"), "Boolean-based SQL injection (OR/AND =)"),
    ("sqli", re.compile(r"(?i)union\s+select"), "UNION-based SQL injection"),
    ("sqli", re.compile(r"(?i)drop\s+table"), "DROP TABLE statement"),
    ("sqli", re.compile(r"(?i)delete\s+from"), "DELETE FROM statement"),
    ("sqli", re.compile(r"(?i)insert\s+into"), "INSERT INTO statement"),
    ("sqli", re.compile(r"(?i)select\s+.*\s+from"), "SELECT ... FROM statement"),
    ("sqli", re.compile(r"(?i)waitfor\s+delay"), "Time-based SQL injection (WAITFOR DELAY)"),
    ("sqli", re.compile(r"(?i)sleep\s*\(\s*\d+\s*\)"), "Time-based SQL injection (SLEEP)"),
    ("sqli", re.compile(r"(?i)xp_cmdshell"), "SQL Server shell execution"),
    ("sqli", re.compile(r"(?i)@@version"), "DB version disclosure attempt"),
    ("sqli", re.compile(r"--\s*$"), "SQL comment terminator (--)"),
    ("sqli", re.compile(r"'\s*;"), "Quote-semicolon statement break"),
    # --- XSS ---------------------------------------------------------------
    ("xss", re.compile(r"(?i)<\s*script"), "<script> tag"),
    ("xss", re.compile(r"(?i)on(error|load|click|mouseover|toggle)\s*="), "Event-handler attribute (on*)"),
    ("xss", re.compile(r"(?i)javascript\s*:"), "javascript: URI"),
    ("xss", re.compile(r"(?i)<\s*img[^>]+src\s*="), "<img> with source"),
    ("xss", re.compile(r"(?i)<\s*(svg|iframe|body|details|object)\b"), "Dangerous HTML element"),
    ("xss", re.compile(r"(?i)alert\s*\("), "alert() call"),
    ("xss", re.compile(r"(?i)document\.cookie"), "Cookie theft attempt"),
    # --- Path traversal ----------------------------------------------------
    ("path_traversal", re.compile(r"\.\./|\.\.\\\\|\.\.%2f|\.\.%5c", re.IGNORECASE), "Parent-directory sequence (..)"),
    ("path_traversal", re.compile(r"(?i)/etc/(passwd|shadow|hosts)"), "Sensitive Unix file access"),
    ("path_traversal", re.compile(r"(?i)(boot|win)\.ini|/windows/system32"), "Sensitive Windows file access"),
    ("path_traversal", re.compile(r"%2e%2e|%252e%252e", re.IGNORECASE), "Encoded traversal sequence"),
    # --- Command injection -------------------------------------------------
    ("cmd_injection", re.compile(r";\s*(ls|cat|rm|id|whoami|uname|ping|wget|curl|nc)\b", re.IGNORECASE), "Shell command after semicolon"),
    ("cmd_injection", re.compile(r"\|\s*(cat|ls|nc|bash|sh)\b", re.IGNORECASE), "Piped shell command"),
    ("cmd_injection", re.compile(r"\$\(|`"), "Command substitution $(...) or backticks"),
    ("cmd_injection", re.compile(r"(?i)/bin/(ba)?sh"), "Shell binary reference"),
    ("cmd_injection", re.compile(r"(?i)nc\s+-e"), "Netcat reverse shell"),
]


def analyze_text(text: str) -> list[dict]:
    """Run all heuristic rules against decoded request text, return findings."""
    findings: list[dict] = []
    if not text:
        return findings
    for category, pattern, description in RULES:
        m = pattern.search(text)
        if m:
            evidence = m.group(0)
            # Trim long matches for display safety.
            if len(evidence) > 80:
                evidence = evidence[:80] + "..."
            findings.append({
                "type": category,
                "pattern": pattern.pattern,
                "evidence": evidence,
                "description": description,
            })
    return findings


def infer_attack_type(findings: list[dict]) -> str | None:
    """Pick the most specific attack type from heuristic findings."""
    if not findings:
        return None
    # Priority order for display when multiple match.
    priority = ["sqli", "xss", "path_traversal", "cmd_injection"]
    present = {f["type"] for f in findings}
    for t in priority:
        if t in present:
            return t
    return findings[0]["type"]


def heuristic_strength(findings: list[dict]) -> str:
    """Coarse strength rating used by the agent policy for escalation."""
    n = len(findings)
    if n == 0:
        return "none"
    if n <= 2:
        return "low"
    if n <= 4:
        return "medium"
    return "high"
