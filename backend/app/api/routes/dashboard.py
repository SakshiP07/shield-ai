from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.fraud_log import FraudLog
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.auth import ActivityItem, DashboardStats
from app.services.dashboard_service import build_dashboard_stats
from app.services.transaction_helpers import get_or_create_profile

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _short_ref(value: str | None, limit: int = 40) -> str:
    text = " ".join((value or "").strip().split())
    if not text:
        return ""
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip() + "…"


def _activity_from_tx(tx: Transaction) -> dict:
    channel = (tx.channel or "scan").upper()
    snippet = _short_ref(tx.reference)
    if tx.merchant and tx.merchant.name:
        title = f"{channel} · {tx.merchant.name} — {tx.status}"
    elif snippet:
        title = f"{channel} · {snippet} — {tx.status}"
    else:
        title = f"{channel} scan — {tx.status}"
    return {
        "id": tx.id,
        "title": title,
        "time": tx.created_at,
        "amount": tx.amount if tx.amount and tx.amount > 0 else None,
        "sub": tx.reference,
        "badge": tx.status,
    }


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DashboardStats:
    profile = get_or_create_profile(db, user)
    return DashboardStats(**build_dashboard_stats(db, user.id, profile))


@router.get("/activity", response_model=list[ActivityItem])
def recent_activity(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ActivityItem]:
    txs = (
        db.query(Transaction)
        .options(joinedload(Transaction.merchant))
        .filter(Transaction.user_id == user.id)
        .order_by(Transaction.created_at.desc())
        .limit(20)
        .all()
    )
    items: list[ActivityItem] = []
    for tx in txs:
        items.append(ActivityItem(**_activity_from_tx(tx)))
    return items


@router.get("/blocked-scans", response_model=list[ActivityItem])
def blocked_scans(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ActivityItem]:
    txs = (
        db.query(Transaction)
        .options(joinedload(Transaction.merchant))
        .filter(
            Transaction.user_id == user.id,
            Transaction.decision.in_(["block", "hold"]),
        )
        .order_by(Transaction.created_at.desc())
        .limit(50)
        .all()
    )
    items: list[ActivityItem] = []
    for tx in txs:
        items.append(ActivityItem(**_activity_from_tx(tx)))
    return items


@router.get("/scam-alerts")
def scam_alerts(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    logs = (
        db.query(FraudLog)
        .filter(FraudLog.user_id == user.id, FraudLog.severity.in_(["danger", "warning", "blocked"]))
        .order_by(FraudLog.created_at.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "id": str(log.id),
            "title": log.title,
            "time": log.created_at.isoformat(),
            "badge": log.severity,
        }
        for log in logs
    ]
