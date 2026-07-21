from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.transaction import Transaction


@dataclass
class VelocityResult:
    count: int
    total_amount: float
    is_suspicious: bool
    reason: str | None

    def to_dict(self) -> dict:
        return {
            "count": self.count,
            "total_amount": self.total_amount,
            "is_suspicious": self.is_suspicious,
            "reason": self.reason,
        }


def check_velocity(
    db: Session,
    user_id: str | UUID,
    amount: float,
    threshold_count: int = 5,
    threshold_amount: float = 10000,
) -> VelocityResult:
    """
    Velocity check via indexed PostgreSQL lookup on transactions(user_id, created_at).
    Replaces Redis recent_tx:{user_id} / velocity:{user_id} lists.
    """
    since = datetime.now(UTC) - timedelta(hours=1)
    uid = UUID(str(user_id)) if not isinstance(user_id, UUID) else user_id

    row = (
        db.query(
            func.count(Transaction.id).label("count"),
            func.coalesce(func.sum(Transaction.amount), 0).label("total_amount"),
        )
        .filter(Transaction.user_id == uid, Transaction.created_at >= since)
        .one()
    )

    count = int(row.count) + 1  # include the in-flight transaction
    total_amount = float(row.total_amount) + amount

    is_suspicious = count >= threshold_count or total_amount >= threshold_amount
    reason = (
        "high_frequency"
        if count >= threshold_count
        else "high_amount"
        if is_suspicious
        else None
    )
    return VelocityResult(
        count=count,
        total_amount=total_amount,
        is_suspicious=is_suspicious,
        reason=reason,
    )
