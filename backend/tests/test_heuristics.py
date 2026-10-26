"""Unit tests for the heuristic detection layer."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.heuristics import analyze_text, infer_attack_type, heuristic_strength


def test_no_findings_on_normal_text():
    findings = analyze_text("get /api/products category=books")
    assert len(findings) == 0


def test_sqli_detected():
    findings = analyze_text("post /api/login username=admin&password=admin' OR '1'='1")
    types = {f["type"] for f in findings}
    assert "sqli" in types


def test_xss_detected():
    findings = analyze_text("get /api/search q=<script>alert(1)</script>")
    types = {f["type"] for f in findings}
    assert "xss" in types


def test_path_traversal_detected():
    findings = analyze_text("get /api/files/../../../etc/passwd")
    types = {f["type"] for f in findings}
    assert "path_traversal" in types


def test_cmd_injection_detected():
    findings = analyze_text("get /api/cmd ; cat /etc/passwd")
    types = {f["type"] for f in findings}
    assert "cmd_injection" in types


def test_infer_attack_type_empty():
    assert infer_attack_type([]) is None


def test_infer_attack_type_sqli():
    findings = analyze_text("' OR 1=1 --")
    assert infer_attack_type(findings) == "sqli"


def test_heuristic_strength_none():
    assert heuristic_strength([]) == "none"


def test_heuristic_strength_high():
    findings = analyze_text("' OR 1=1 -- ; DROP TABLE users; UNION SELECT * FROM sys; <script>alert(1)</script>; ../../../etc/passwd")
    assert heuristic_strength(findings) in ("medium", "high")
