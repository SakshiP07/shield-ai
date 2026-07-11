"""Behaviour Engine — analyzes user transaction history and profile baselines."""

from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.behaviour_profile import BehaviourProfile
from app.models.transaction import Transaction
from app.models.user import User


@dataclass
class BehaviourAnalysis:
    security_score: int
    items_scanned: int
    threats_blocked: int
    avg_transaction_amount: float
    typical_channels: list[str]
    risk_level: str
    recent_tx_count_24h: int
    recent_avg_amount: float
    deviation_score: float  # 0-1 how much this tx deviates from baseline
    flags: list[str]

    def to_dict(self) -> dict:
        return asdict(self)


def analyze_behaviour(
    db: Session,
    user: User,
    profile: BehaviourProfile,
    *,
    amount: float,
    channel: str,
) -> BehaviourAnalysis:
    since = datetime.now(UTC) - timedelta(hours=24)
    recent = (
        db.query(Transaction)
        .filter(Transaction.user_id == user.id, Transaction.created_at >= since)
        .all()
    )
    recent_count = len(recent)
    recent_avg = (
        float(db.query(func.avg(Transaction.amount)).filter(Transaction.user_id == user.id).scalar() or 0)
    )
    if recent:
        recent_avg = sum(float(tx.amount) for tx in recent) / len(recent)

    typical = [c.strip() for c in profile.typical_channels.split(",") if c.strip()]
    flags: list[str] = []

    deviation = 0.0
    if profile.avg_transaction_amount > 0 and amount > profile.avg_transaction_amount * 3:
        deviation += 0.4
        flags.append("amount_spike")
    if channel not in typical and profile.items_scanned > 5:
        deviation += 0.25
        flags.append("unusual_channel")
    if recent_count >= 4:
        deviation += 0.2
        flags.append("high_recent_activity")
    if profile.risk_level == "high":
        deviation += 0.15
        flags.append("elevated_user_risk")

    deviation = min(deviation, 1.0)

    return BehaviourAnalysis(
        security_score=profile.security_score,
        items_scanned=profile.items_scanned,
        threats_blocked=profile.threats_blocked,
        avg_transaction_amount=profile.avg_transaction_amount,
        typical_channels=typical,
        risk_level=profile.risk_level,
        recent_tx_count_24h=recent_count,
        recent_avg_amount=round(recent_avg, 2),
        deviation_score=round(deviation, 4),
        flags=flags,
    )
