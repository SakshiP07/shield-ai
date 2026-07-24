from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.audit import AuditLogEntry, AuditLogListResponse, AuditLogUser
from app.services.audit_query_service import list_audit_logs
from app.services.audit_service import AuditEventType

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])

_VALID_EVENT_TYPES = {e.value for e in AuditEventType}


@router.get("", response_model=AuditLogListResponse)
def get_audit_logs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    # Search
    search: str | None = Query(
        default=None,
        max_length=255,
        description="Search across user id, name, email, phone, and request id",
    ),
    user_id: UUID | None = Query(default=None, description="Exact user id"),
    user_name: str | None = Query(default=None, max_length=120, description="User name contains"),
    email: str | None = Query(default=None, max_length=255, description="Email contains"),
    phone: str | None = Query(default=None, max_length=20, description="Phone contains"),
    request_id: str | None = Query(default=None, max_length=64, description="Request id contains"),
    # Filters
    event_type: str | None = Query(
        default=None,
        max_length=64,
        description="Exact event type (e.g. login, scan, fraud_detected)",
    ),
    date_from: datetime | None = Query(default=None, description="Inclusive start of date range (ISO 8601)"),
    date_to: datetime | None = Query(default=None, description="Inclusive end of date range (ISO 8601)"),
    platform: str | None = Query(default=None, max_length=64),
    device: str | None = Query(default=None, max_length=128),
    entity_type: str | None = Query(default=None, max_length=64),
    entity_id: str | None = Query(default=None, max_length=64),
    entity: str | None = Query(
        default=None,
        max_length=128,
        description="Match entity_type or entity_id (contains)",
    ),
    # Sorting & pagination
    sort: str = Query(
        default="desc",
        pattern="^(asc|desc)$",
        description="Sort by timestamp: asc or desc (default newest first)",
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> AuditLogListResponse:
    """Read-only paginated audit trail. Append-only writes are not exposed here."""
    _ = user  # authenticated access required

    if event_type is not None:
        normalized = event_type.strip().lower()
        if normalized not in _VALID_EVENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid event_type. Allowed: {', '.join(sorted(_VALID_EVENT_TYPES))}",
            )
        event_type = normalized

    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date_from must be before or equal to date_to",
        )

    try:
        rows, total = list_audit_logs(
            db,
            user_id=user_id,
            user_name=user_name,
            email=email,
            phone=phone,
            request_id=request_id,
            search=search,
            event_type=event_type,
            date_from=date_from,
            date_to=date_to,
            platform=platform,
            device=device,
            entity_type=entity_type,
            entity_id=entity_id,
            entity=entity,
            sort=sort,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load audit logs",
        ) from exc

    total_pages = max(1, (total + page_size - 1) // page_size) if total else 1
    items: list[AuditLogEntry] = []
    for log, log_user in rows:
        items.append(
            AuditLogEntry(
                id=log.id,
                user=AuditLogUser.model_validate(log_user) if log_user is not None else None,
                timestamp=log.created_at,
                event_type=log.event_type,
                action=log.action,
                description=log.description,
                sms_id=log.sms_id,
                transaction_id=log.transaction_id,
                status=log.status,
                metadata=log.metadata_json,
                device_id=log.device_id,
                device_model=log.device_model,
                manufacturer=log.manufacturer,
                android_version=log.android_version,
                app_version=log.app_version,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                previous_value=log.previous_value,
                new_value=log.new_value,
                ip_address=log.ip_address,
                device=log.device,
                platform=log.platform,
                request_id=log.request_id,
                user_agent=log.user_agent,
            )
        )

    return AuditLogListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
