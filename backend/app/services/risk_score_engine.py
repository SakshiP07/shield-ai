"""Risk Score Engine — weighted combination of behaviour, rules, and ML outputs."""

from dataclasses import asdict, dataclass

WEIGHTS = {
    "ml": 0.45,
    "rules": 0.30,
    "behaviour": 0.25,
}


@dataclass
class RiskScore:
    risk_score: float  # 0-100
    ml_component: float
    rule_component: float
    behaviour_component: float
    level: str  # low, medium, high, critical

    def to_dict(self) -> dict:
        return asdict(self)


def calculate_risk_score(
    *,
    ml_fraud_probability: float,
    rule_score: float,
    behaviour_deviation: float,
) -> RiskScore:
    ml_component = ml_fraud_probability * WEIGHTS["ml"] * 100
    rule_component = rule_score * WEIGHTS["rules"] * 100
    behaviour_component = behaviour_deviation * WEIGHTS["behaviour"] * 100

    total = min(ml_component + rule_component + behaviour_component, 100.0)

    if total >= 75:
        level = "critical"
    elif total >= 50:
        level = "high"
    elif total >= 25:
        level = "medium"
    else:
        level = "low"

    return RiskScore(
        risk_score=round(total, 2),
        ml_component=round(ml_component, 2),
        rule_component=round(rule_component, 2),
        behaviour_component=round(behaviour_component, 2),
        level=level,
    )
