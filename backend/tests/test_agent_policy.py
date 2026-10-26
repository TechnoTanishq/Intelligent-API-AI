"""Unit tests for the intelligent agent decision policy."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.agent.policy import decide


def test_low_probability_allow():
    d = decide(0.10, "none")
    assert d.action == "ALLOW"
    assert d.risk_level == "LOW"


def test_medium_probability_monitor():
    d = decide(0.55, "none")
    assert d.action == "MONITOR"
    assert d.risk_level == "MEDIUM"


def test_high_probability_block():
    d = decide(0.90, "none")
    assert d.action == "BLOCK"
    assert d.risk_level == "HIGH"


def test_heuristic_escalates_allow_to_monitor():
    d = decide(0.20, "medium")  # prob is ALLOW, heuristic is medium -> escalate
    assert d.action == "MONITOR"
    assert d.escalated_by_heuristics is True


def test_heuristic_escalates_monitor_to_block():
    d = decide(0.50, "high")  # prob is MONITOR, heuristic is high -> escalate
    assert d.action == "BLOCK"
    assert d.escalated_by_heuristics is True


def test_heuristic_never_downgrade_block():
    d = decide(0.95, "none")  # prob already BLOCK, no heuristic; stays BLOCK
    assert d.action == "BLOCK"


def test_no_escalation_weak_heuristic():
    d = decide(0.20, "low")  # heuristic is low strength, no escalation
    assert d.action == "ALLOW"
    assert d.escalated_by_heuristics is False


def test_policy_rule_contains_threshold():
    d = decide(0.10, "none")
    assert "0.10" in d.policy_rule or "0.1" in d.policy_rule
