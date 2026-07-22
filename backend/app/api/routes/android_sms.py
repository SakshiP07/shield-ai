from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routes.websocket import broadcast_alert
from app.core.database import get_db
from app.models.fraud_log import FraudLog
from app.models.user import User
from app.schemas.android_sms import (
    AndroidSmsConnectionResponse,
    AndroidSmsInboxItem,
    AndroidSmsInboxResponse,
    AndroidSmsIngestRequest,
    AndroidSmsIngestResponse,
    AndroidSmsIngestResultItem,
)
from app.services.android_sms_service import AndroidSmsService
from uuid import UUID

router = APIRouter(prefix="/sms", tags=["android-sms"])


@router.get("/connection", response_model=AndroidSmsConnectionResponse)
def sms_connection(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AndroidSmsConnectionResponse:
    return AndroidSmsConnectionResponse(**AndroidSmsService.get_connection(db, user))


@router.post("/connect", response_model=AndroidSmsConnectionResponse)
def sms_connect(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AndroidSmsConnectionResponse:
    """Mark Android SMS inbox as connected (READ_SMS granted on device)."""
    return AndroidSmsConnectionResponse(**AndroidSmsService.connect(db, user))


@router.post("/disconnect", response_model=AndroidSmsConnectionResponse)
def sms_disconnect(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AndroidSmsConnectionResponse:
    """Disconnect Android SMS sync (observer should stop on device)."""
    return AndroidSmsConnectionResponse(**AndroidSmsService.disconnect(db, user))


@router.post("/ingest", response_model=AndroidSmsIngestResponse)
async def sms_ingest(
    payload: AndroidSmsIngestRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AndroidSmsIngestResponse:
    """Receive parsed SMS from Android Content Provider and auto-scan via fraud pipeline."""
    try:
        result = AndroidSmsService.ingest(
            db,
            user,
            [m.model_dump() for m in payload.messages],
            device_info=payload.device_info,
            auto_scan=payload.auto_scan,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to ingest SMS messages",
        ) from exc

    # Broadcast any newly created fraud alerts
    for item in result.get("items", []):
        tx_id = item.get("transaction_id")
        if not tx_id:
            continue
        alert = (
            db.query(FraudLog)
            .filter(FraudLog.transaction_id == UUID(str(tx_id)), FraudLog.user_id == user.id)
            .order_by(FraudLog.created_at.desc())
            .first()
        )
        if alert and not alert.is_read:
            await broadcast_alert(str(user.id), alert)

    return AndroidSmsIngestResponse(
        created=result["created"],
        updated=result["updated"],
        scanned=result["scanned"],
        items=[AndroidSmsIngestResultItem(**item) for item in result["items"]],
    )


@router.get("/inbox", response_model=AndroidSmsInboxResponse)
def sms_inbox(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    search: str | None = Query(default=None, max_length=255),
    unread_only: bool | None = Query(default=None),
    otp_only: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> AndroidSmsInboxResponse:
    """Paginated Android SMS inbox (newest first) with search."""
    conn = AndroidSmsService.get_connection(db, user)
    try:
        rows, total = AndroidSmsService.list_inbox(
            db,
            user.id,
            search=search,
            unread_only=unread_only,
            otp_only=otp_only,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load SMS inbox",
        ) from exc

    total_pages = max(1, (total + page_size - 1) // page_size) if total else 1
    items = [
        AndroidSmsInboxItem(
            id=row.id,
            android_sms_id=row.android_sms_id,
            address=row.address,
            phone_number=row.address,
            sender=row.sender,
            body=row.body,
            received_at=row.received_at,
            timestamp=row.received_at,
            is_read=row.is_read,
            unread=not row.is_read,
            is_otp=row.is_otp,
            otp_code=row.otp_code,
            transaction_id=row.transaction_id,
            fraud_score=row.fraud_score,
            risk_score=row.risk_score,
            risk_level=row.risk_level,
            decision=row.decision,
            badge=row.badge,
        )
        for row in rows
    ]
    return AndroidSmsInboxResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        connected=bool(conn["connected"]),
    )
