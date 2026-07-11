"""Dashboard stats with computed security score breakdown."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.behaviour_profile import BehaviourProfile
from app.models.transaction import Transaction


def _plural(n: int, singular: str, plural_form: str | None = None) -> str:
    word = singular if n == 1 else (plural_form or f"{singular}s")
    return f"{n} {word}"


def build_dashboard_stats(db: Session, user_id: UUID, profile: BehaviourProfile) -> dict:
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)

    txs: list[Transaction] = (
        db.query(Transaction).filter(Transaction.user_id == user_id).order_by(Transaction.created_at.desc()).all()
    )

    blocked_count = sum(1 for tx in txs if tx.decision == "block")
    warning_count = sum(1 for tx in txs if tx.decision in ("otp", "hold"))
    safe_count = sum(1 for tx in txs if tx.decision == "approve")
    blocked_scans_count = sum(1 for tx in txs if tx.decision in ("block", "hold"))

    breakdown: list[str] = []

    if blocked_count > 0:
        breakdown.append(f"{_plural(blocked_count, 'blocked scam attempt')}")

    suspicious_sms = sum(
        1 for tx in txs if tx.channel == "sms" and tx.decision in ("otp", "hold", "block")
    )
    if suspicious_sms > 0:
        breakdown.append(f"{_plural(suspicious_sms, 'suspicious SMS', 'suspicious SMS')} detected")

    high_risk_today = [
        tx
        for tx in txs
        if tx.created_at >= today_start and tx.risk_score >= 0.5 and tx.decision != "approve"
    ]
    if high_risk_today:
        link_today = any(tx.channel == "link" for tx in high_risk_today)
        if link_today:
            breakdown.append("High-risk link scanned today")
        else:
            channels = sorted({tx.channel for tx in high_risk_today})
            if len(channels) == 1:
                breakdown.append(f"High-risk {channels[0]} scan today")
            else:
                breakdown.append(f"{len(high_risk_today)} high-risk scans today")

    safe_recent = sum(1 for tx in txs if tx.decision == "approve" and tx.created_at >= week_start)
    if safe_recent == 0 and profile.items_scanned > 0:
        breakdown.append("No recent safe activity")
    elif safe_recent > 0:
        breakdown.append(f"{_plural(safe_recent, 'safe scan')} this week")

    if not breakdown:
        if profile.items_scanned == 0:
            breakdown.append("No scans yet — run a scan to build your score")
        else:
            breakdown.append("All recent activity looks safe")

    return {
        "security_score": profile.security_score,
        "threats_blocked": profile.threats_blocked,
        "items_scanned": profile.items_scanned,
        "safe_items": profile.safe_items,
        "risk_level": profile.risk_level,
        "last_scan_at": profile.last_scan_at,
        "blocked_count": blocked_count,
        "warning_count": warning_count,
        "safe_count": safe_count,
        "blocked_scans_count": blocked_scans_count,
        "score_breakdown": breakdown,
    }
