from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
import logging

from app.api.deps import get_current_user
from app.api.routes.websocket import broadcast_alert
from app.core.database import get_db
from app.models.fraud_log import FraudLog
from app.models.user import User
from app.schemas.android_sms import (
    AndroidSmsClientAuditRequest,
    AndroidSmsConnectRequest,
    AndroidSmsConnectionResponse,
    AndroidSmsInboxItem,
    AndroidSmsInboxResponse,
    AndroidSmsIngestItem,
    AndroidSmsIngestRequest,
    AndroidSmsIngestResponse,
    AndroidSmsIngestResultItem,
)
from app.services.android_sms_service import AndroidSmsService
from uuid import UUID

router = APIRouter(prefix="/sms", tags=["android-sms"])
logger = logging.getLogger(__name__)


@router.get("/connection", response_model=AndroidSmsConnectionResponse)
def sms_connection(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AndroidSmsConnectionResponse:
    return AndroidSmsConnectionResponse(**AndroidSmsService.get_connection(db, user))


@router.post("/connect", response_model=AndroidSmsConnectionResponse)
def sms_connect(
    payload: AndroidSmsConnectRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AndroidSmsConnectionResponse:
    """Mark Android SMS inbox as connected (READ_SMS granted on device)."""
    device_info = payload.device_info if payload else None
    return AndroidSmsConnectionResponse(
        **AndroidSmsService.connect(db, user, device_info=device_info)
    )


@router.post("/disconnect", response_model=AndroidSmsConnectionResponse)
def sms_disconnect(
    payload: AndroidSmsConnectRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AndroidSmsConnectionResponse:
    """Disconnect Android SMS sync (observer should stop on device)."""
    device_info = payload.device_info if payload else None
    return AndroidSmsConnectionResponse(
        **AndroidSmsService.disconnect(db, user, device_info=device_info)
    )


@router.post("/client-audit", status_code=status.HTTP_204_NO_CONTENT)
def sms_client_audit(
    payload: AndroidSmsClientAuditRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Append-only audit events emitted by the React Native Android client."""
    try:
        AndroidSmsService.record_client_event(
            db,
            user,
            event_type=payload.event_type,
            description=payload.description,
            metadata=payload.metadata,
            sms_id=payload.sms_id,
            status=payload.status or "success",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/ingest", response_model=AndroidSmsIngestResponse)
async def sms_ingest(
    payload: AndroidSmsIngestRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AndroidSmsIngestResponse:
    """Receive parsed SMS from Android Content Provider and auto-scan via fraud pipeline."""
    valid_messages: list[AndroidSmsIngestItem] = []
    for index, raw in enumerate(payload.messages):
        try:
            valid_messages.append(AndroidSmsIngestItem.model_validate(raw))
        except ValidationError as exc:
            logger.warning(
                "sms_ingest skip invalid message[%s] user=%s: %s",
                index,
                user.id,
                exc.errors(),
            )

    if not valid_messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid SMS messages in payload",
        )

    try:
        result = AndroidSmsService.ingest(
            db,
            user,
            [m.model_dump() for m in valid_messages],
            device_info=payload.device_info,
            auto_scan=payload.auto_scan,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to ingest SMS messages",
        ) from exc

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
    sms_type: str | None = Query(default=None, max_length=30),
    badge: str | None = Query(default=None, max_length=20),
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
            sms_type=sms_type,
            badge=badge,
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
            sms_type=row.sms_type,
            transaction_id=row.transaction_id,
            fraud_score=row.fraud_score,
            risk_score=row.risk_score,
            risk_level=row.risk_level,
            confidence=row.confidence,
            processing_time_ms=row.processing_time_ms,
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
