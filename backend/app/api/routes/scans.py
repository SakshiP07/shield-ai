from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routes.websocket import broadcast_alert
from app.core.database import get_db
from app.models.fraud_log import FraudLog
from app.models.user import User
from app.schemas.auth import (
    AlertDetail,
    AlertItem,
    AlertReadResponse,
    ScanRequest,
    ScanResult,
    SmsScanDetail,
    SmsScanItem,
    UnreadCountResponse,
)
from app.services.alert_service import AlertService
from app.services.scan import analyze_scan
from app.services.sms_service import SmsService

router = APIRouter(tags=["scans", "alerts"])


def _alert_to_item(alert: FraudLog) -> AlertItem:
    return AlertItem(
        id=alert.id,
        title=alert.title,
        description=alert.description,
        severity=alert.severity,
        alert_type=alert.alert_type,
        is_read=alert.is_read,
        created_at=alert.created_at,
        transaction_id=alert.transaction_id,
        source=alert.source,
        fraud_score=alert.fraud_score,
    )


@router.post("/scans/analyze", response_model=ScanResult)
async def analyze(
    payload: ScanRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ScanResult:
    result = analyze_scan(
        db,
        user,
        scan_type=payload.scan_type,
        content=payload.content,
        amount=payload.amount,
        device_info=payload.device_info,
        sender=payload.sender,
    )
    alert_id = result.get("alert_id")
    if alert_id:
        alert = db.get(FraudLog, UUID(str(alert_id)))
        if alert:
            await broadcast_alert(str(user.id), alert)
    return ScanResult(**result)


@router.get("/sms/scans", response_model=list[SmsScanItem])
def sms_scans(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[SmsScanItem]:
    txs = SmsService.list_scans(db, user.id)
    return [SmsScanItem(**SmsService.to_list_item(tx)) for tx in txs]


@router.get("/sms/scans/{transaction_id}", response_model=SmsScanDetail)
def sms_scan_detail(
    transaction_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SmsScanDetail:
    detail = SmsService.get_scan_detail(db, user.id, transaction_id)
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SMS scan not found")
    return SmsScanDetail(**detail)


@router.get("/alerts", response_model=list[AlertItem])
def list_alerts(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[AlertItem]:
    alerts = AlertService.list_alerts(db, user.id)
    return [_alert_to_item(alert) for alert in alerts]


@router.get("/alerts/unread-count", response_model=UnreadCountResponse)
def unread_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UnreadCountResponse:
    return UnreadCountResponse(count=AlertService.unread_count(db, user.id))


@router.post("/alerts/mark-all-read")
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    count = AlertService.mark_all_read(db, user.id)
    return {"ok": True, "updated": count}


@router.get("/alerts/{alert_id}", response_model=AlertDetail)
def alert_detail(
    alert_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AlertDetail:
    detail = AlertService.get_alert_detail(db, user.id, alert_id)
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return AlertDetail(**detail)


@router.patch("/alerts/{alert_id}/read", response_model=AlertReadResponse)
def mark_alert_read(
    alert_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AlertReadResponse:
    alert = AlertService.mark_read(db, user.id, alert_id)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return AlertReadResponse(ok=True, is_read=alert.is_read)
