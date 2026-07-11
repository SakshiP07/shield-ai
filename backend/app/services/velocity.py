import json
from dataclasses import dataclass
from datetime import UTC, datetime

from app.core.redis_client import RedisKeys, redis_client


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


def record_transaction(user_id: str, tx_id: str, amount: float) -> int:
    """Track recent transactions in Redis for velocity checks. Returns count in last hour."""
    key = RedisKeys.recent_transactions(user_id)
    payload = json.dumps({"id": tx_id, "amount": amount, "at": datetime.now(UTC).isoformat()})
    redis_client.lpush(key, payload)
    redis_client.ltrim(key, 0, 49)
    redis_client.expire(key, 3600)
    return redis_client.llen(key)


def check_velocity(
    user_id: str, amount: float, threshold_count: int = 5, threshold_amount: float = 10000
) -> VelocityResult:
    key = RedisKeys.recent_transactions(user_id)
    entries = redis_client.lrange(key, 0, -1)
    count = len(entries)
    total_amount = 0.0
    for raw in entries:
        data = json.loads(raw)
        total_amount += float(data.get("amount", 0))

    total_amount += amount
    count += 1

    velocity_key = RedisKeys.velocity(user_id)
    redis_client.setex(
        velocity_key,
        3600,
        json.dumps({"count": count, "total_amount": total_amount, "checked_at": datetime.now(UTC).isoformat()}),
    )

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
