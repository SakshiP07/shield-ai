"""Rule Engine — evaluates fraud rules against transaction context."""

from dataclasses import asdict, dataclass

from app.services.velocity import VelocityResult

# Configurable rule thresholds (move to DB/config in production)
RULES = {
    "velocity_count_threshold": 5,
    "velocity_amount_threshold": 10000.0,
    "high_amount_threshold": 25000.0,
    "low_merchant_trust_threshold": 30.0,
    "blocked_keywords": ("lottery", "kyc expired", "bit.ly", "urgent", "winner"),
}


@dataclass
class RuleResult:
    rule_id: str
    name: str
    triggered: bool
    severity: str  # low, medium, high
    score_contribution: float
    detail: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class RuleEvaluation:
    results: list[RuleResult]
    total_rule_score: float
    any_high_severity: bool

    def to_dict(self) -> dict:
        return {
            "results": [r.to_dict() for r in self.results],
            "total_rule_score": self.total_rule_score,
            "any_high_severity": self.any_high_severity,
        }


def evaluate_rules(
    *,
    user_id: str,  # noqa: ARG001 — reserved for future per-user rule overrides
    amount: float,
    content: str,
    channel: str,
    merchant_trust: float,
    behaviour_flags: list[str],
    velocity: VelocityResult,
) -> RuleEvaluation:
    results: list[RuleResult] = []
    content_lower = content.lower()

    results.append(
        RuleResult(
            rule_id="R001",
            name="velocity_check",
            triggered=velocity.is_suspicious,
            severity="high" if velocity.is_suspicious else "low",
            score_contribution=0.35 if velocity.is_suspicious else 0.0,
            detail=velocity.reason or "within_limits",
        )
    )

    keyword_hit = any(kw in content_lower for kw in RULES["blocked_keywords"])
    results.append(
        RuleResult(
            rule_id="R002",
            name="phishing_keywords",
            triggered=keyword_hit,
            severity="high" if keyword_hit else "low",
            score_contribution=0.3 if keyword_hit else 0.0,
            detail="suspicious_keywords_found" if keyword_hit else "clean",
        )
    )

    high_amount = amount >= RULES["high_amount_threshold"]
    results.append(
        RuleResult(
            rule_id="R003",
            name="high_amount",
            triggered=high_amount,
            severity="medium" if high_amount else "low",
            score_contribution=0.2 if high_amount else 0.0,
            detail=f"amount={amount}",
        )
    )

    low_trust = merchant_trust < RULES["low_merchant_trust_threshold"]
    results.append(
        RuleResult(
            rule_id="R004",
            name="merchant_trust",
            triggered=low_trust,
            severity="medium" if low_trust else "low",
            score_contribution=0.15 if low_trust else 0.0,
            detail=f"trust_score={merchant_trust}",
        )
    )

    behaviour_risk = len(behaviour_flags) > 0
    results.append(
        RuleResult(
            rule_id="R005",
            name="behaviour_anomaly",
            triggered=behaviour_risk,
            severity="medium" if behaviour_risk else "low",
            score_contribution=0.1 * len(behaviour_flags) if behaviour_risk else 0.0,
            detail=",".join(behaviour_flags) if behaviour_flags else "normal",
        )
    )

    high_risk_channels = channel in ("sms", "link", "phone")
    results.append(
        RuleResult(
            rule_id="R006",
            name="high_risk_channel",
            triggered=high_risk_channels,
            severity="low",
            score_contribution=0.08 if high_risk_channels else 0.0,
            detail=channel,
        )
    )

    total = min(sum(r.score_contribution for r in results), 1.0)
    any_high = any(r.triggered and r.severity == "high" for r in results)

    return RuleEvaluation(results=results, total_rule_score=round(total, 4), any_high_severity=any_high)
