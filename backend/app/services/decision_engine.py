"""Decision Engine — maps risk score to Approve / OTP / Hold / Block."""

from dataclasses import asdict, dataclass

DECISION_THRESHOLDS = {
    "approve": 25,
    "otp": 50,
    "hold": 75,
    # >= 75 → block
}


@dataclass
class Decision:
    action: str  # approve, otp, hold, block
    status: str  # safe, warning, danger, blocked
    reason: str
    requires_otp: bool

    def to_dict(self) -> dict:
        return asdict(self)


def decide(*, risk_score: float, any_high_severity_rule: bool) -> Decision:
    score = risk_score
    if any_high_severity_rule and score < DECISION_THRESHOLDS["otp"]:
        score = DECISION_THRESHOLDS["otp"]  # bump for high-severity rule hits

    if score < DECISION_THRESHOLDS["approve"]:
        return Decision(
            action="approve",
            status="safe",
            reason="Risk within acceptable limits",
            requires_otp=False,
        )
    if score < DECISION_THRESHOLDS["otp"]:
        return Decision(
            action="otp",
            status="warning",
            reason="Elevated risk — step-up OTP verification required",
            requires_otp=True,
        )
    if score < DECISION_THRESHOLDS["hold"]:
        return Decision(
            action="hold",
            status="warning",
            reason="Transaction held for manual review",
            requires_otp=False,
        )
    return Decision(
        action="block",
        status="blocked",
        reason="High fraud risk — transaction blocked",
        requires_otp=False,
    )
