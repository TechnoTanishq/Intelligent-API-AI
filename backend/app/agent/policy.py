"""
Intelligent agent decision policy.

The agent is REACTIVE: it maps the current request observation to an action
through a fixed, documented policy (it does not learn or retrain online). Its
environment is the simulated HTTP traffic; its action space is:

    ALLOW    - request assessed as low risk
    MONITOR  - request has uncertain / intermediate risk
    BLOCK    - request exceeds the high-risk threshold

Decision logic (priority order):

  1. Base decision from the model's attack probability:
       p < RISK_LOW_MAX              -> ALLOW,   risk LOW
       RISK_LOW_MAX <= p < RISK_HIGH -> MONITOR, risk MEDIUM
       p >= RISK_HIGH_MIN            -> BLOCK,   risk HIGH

  2. Heuristic escalation (heuristics may only ESCALATE, never downgrade the
     model's verdict):
       - if base == ALLOW and heuristics are medium/strong -> MONITOR
       - if base == MONITOR and heuristics are strong       -> BLOCK

The model's BLOCK is never softened by heuristics. This keeps the ML prediction
and the heuristic layer as separate, auditable signals.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.config import settings


@dataclass
class Decision:
    action: str          # ALLOW / MONITOR / BLOCK
    risk_level: str      # LOW / MEDIUM / HIGH
    policy_rule: str     # the rule that fired (for explanation)
    base_action: str      # action from model probability alone (before heuristics)
    escalated_by_heuristics: bool


def _risk_from_prob(p: float) -> tuple[str, str]:
    if p < settings.risk_low_max:
        return "LOW", "ALLOW"
    if p < settings.risk_high_min:
        return "MEDIUM", "MONITOR"
    return "HIGH", "BLOCK"


def _rule_for_prob(p: float) -> str:
    if p < settings.risk_low_max:
        return f"attack_probability ({p:.3f}) < {settings.risk_low_max} -> ALLOW"
    if p < settings.risk_high_min:
        return f"{settings.risk_low_max} <= attack_probability ({p:.3f}) < {settings.risk_high_min} -> MONITOR"
    return f"attack_probability ({p:.3f}) >= {settings.risk_high_min} -> BLOCK"


def decide(attack_probability: float, heuristic_strength: str = "none") -> Decision:
    """Apply the agent's decision policy and return a Decision."""
    risk_level, base_action = _risk_from_prob(attack_probability)
    policy_rule = _rule_for_prob(attack_probability)
    escalated = False

    if settings.enable_heuristics:
        strong = heuristic_strength in ("medium", "high")
        very_strong = heuristic_strength == "high"
        if base_action == "ALLOW" and strong:
            base_action = "MONITOR"
            risk_level = "MEDIUM"
            policy_rule += (f"; heuristics {heuristic_strength} escalated ALLOW -> MONITOR")
            escalated = True
        elif base_action == "MONITOR" and very_strong:
            base_action = "BLOCK"
            risk_level = "HIGH"
            policy_rule += (f"; heuristics strong escalated MONITOR -> BLOCK")
            escalated = True

    return Decision(
        action=base_action,
        risk_level=risk_level,
        policy_rule=policy_rule,
        base_action=_risk_from_prob(attack_probability)[1],
        escalated_by_heuristics=escalated,
    )
