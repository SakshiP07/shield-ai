"""Append-only system audit logging.

Never update or delete audit rows from application code.
"""

from __future__ import annotations

import logging
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.request_context import RequestAuditContext, get_request_audit_context
from app.models.audit_log import AuditLog

logger = logging.getLogger("shieldai.audit")


class AuditEventType(StrEnum):
    LOGIN = "login"
    LOGOUT = "logout"
    SCAN = "scan"
    FRAUD_DETECTED = "fraud_detected"
    PROFILE_UPDATED = "profile_updated"
    SMS_CONNECTED = "sms_connected"
    SMS_DISCONNECTED = "sms_disconnected"
    ALERT_GENERATED = "alert_generated"
    TRANSACTION_COMPLETED = "transaction_completed"


class AuditService:
    """Write-only audit trail. No update/delete APIs."""

    @staticmethod
    def append(
        db: Session,
        *,
        event_type: AuditEventType | str,
        user_id: UUID | str | None = None,
        entity_type: str | None = None,
        entity_id: UUID | str | None = None,
        previous_value: dict[str, Any] | None = None,
        new_value: dict[str, Any] | None = None,
        context: RequestAuditContext | None = None,
    ) -> AuditLog:
        ctx = context or get_request_audit_context()
        event = event_type.value if isinstance(event_type, AuditEventType) else str(event_type)

        row = AuditLog(
            user_id=UUID(str(user_id)) if user_id else None,
            event_type=event,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            previous_value=previous_value,
            new_value=new_value,
            ip_address=ctx.ip_address if ctx else None,
            device=ctx.device if ctx else None,
            platform=ctx.platform if ctx else None,
            request_id=ctx.request_id if ctx else None,
            user_agent=ctx.user_agent if ctx else None,
        )
        db.add(row)
        db.flush()
        logger.info(
            "audit_event type=%s user_id=%s entity=%s/%s request_id=%s",
            event,
            user_id,
            entity_type,
            entity_id,
            row.request_id,
        )
        return row
