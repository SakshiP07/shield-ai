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
    PROFILE_PHONE_UPDATED = "profile_phone_updated"
    SMS_CONNECTED = "sms_connected"
    SMS_DISCONNECTED = "sms_disconnected"
    SMS_PERMISSION_GRANTED = "sms_permission_granted"
    SMS_PERMISSION_DENIED = "sms_permission_denied"
    SMS_PERMISSION_REVOKED = "sms_permission_revoked"
    SMS_SYNC_STARTED = "sms_sync_started"
    SMS_SYNC_COMPLETED = "sms_sync_completed"
    SMS_INCOMING_DETECTED = "sms_incoming_detected"
    SMS_UPLOADED = "sms_uploaded"
    SMS_CONNECTION_LOST = "sms_connection_lost"
    SMS_DELETED_FROM_DEVICE = "sms_deleted_from_device"
    FRAUD_ANALYSIS_STARTED = "fraud_analysis_started"
    FRAUD_ANALYSIS_COMPLETED = "fraud_analysis_completed"
    OTP_DETECTED = "otp_detected"
    BANK_SMS_DETECTED = "bank_sms_detected"
    UPI_SMS_DETECTED = "upi_sms_detected"
    SMS_BACKEND_ERROR = "sms_backend_error"
    SMS_API_FAILURE = "sms_api_failure"
    SMS_RETRY_ATTEMPT = "sms_retry_attempt"
    ALERT_GENERATED = "alert_generated"
    TRANSACTION_COMPLETED = "transaction_completed"


_EVENT_ACTIONS: dict[str, str] = {
    AuditEventType.SMS_CONNECTED.value: "SMS Connected",
    AuditEventType.SMS_DISCONNECTED.value: "SMS Disconnected",
    AuditEventType.SMS_PERMISSION_GRANTED.value: "SMS Permission Granted",
    AuditEventType.SMS_PERMISSION_DENIED.value: "SMS Permission Denied",
    AuditEventType.SMS_PERMISSION_REVOKED.value: "Permission Revoked",
    AuditEventType.SMS_SYNC_STARTED.value: "SMS Sync Started",
    AuditEventType.SMS_SYNC_COMPLETED.value: "SMS Sync Completed",
    AuditEventType.SMS_INCOMING_DETECTED.value: "Incoming SMS Detected",
    AuditEventType.SMS_UPLOADED.value: "SMS Uploaded",
    AuditEventType.SMS_CONNECTION_LOST.value: "SMS Connection Lost",
    AuditEventType.SMS_DELETED_FROM_DEVICE.value: "SMS Deleted From Device",
    AuditEventType.FRAUD_ANALYSIS_STARTED.value: "Fraud Analysis Started",
    AuditEventType.FRAUD_ANALYSIS_COMPLETED.value: "Fraud Analysis Completed",
    AuditEventType.OTP_DETECTED.value: "OTP Detected",
    AuditEventType.BANK_SMS_DETECTED.value: "Bank SMS Detected",
    AuditEventType.UPI_SMS_DETECTED.value: "UPI SMS Detected",
    AuditEventType.SMS_BACKEND_ERROR.value: "Backend Error",
    AuditEventType.SMS_API_FAILURE.value: "API Failure",
    AuditEventType.SMS_RETRY_ATTEMPT.value: "Retry Attempt",
    AuditEventType.PROFILE_PHONE_UPDATED.value: "Profile Phone Updated",
    AuditEventType.TRANSACTION_COMPLETED.value: "Transaction Completed",
    AuditEventType.FRAUD_DETECTED.value: "Fraud Detected",
    AuditEventType.ALERT_GENERATED.value: "Alert Generated",
    AuditEventType.SCAN.value: "Scan",
    AuditEventType.LOGIN.value: "Login",
    AuditEventType.LOGOUT.value: "Logout",
    AuditEventType.PROFILE_UPDATED.value: "Profile Updated",
}


def _pick_str(data: dict[str, Any] | None, *keys: str, max_len: int = 128) -> str | None:
    if not data:
        return None
    for key in keys:
        value = data.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text[:max_len]
    return None


def _as_uuid(value: UUID | str | None) -> UUID | None:
    if value is None:
        return None
    try:
        return UUID(str(value))
    except (TypeError, ValueError):
        return None


class AuditService:
    """Write-only audit trail. No update/delete APIs."""

    @staticmethod
    def append(
        db: Session,
        *,
        event_type: AuditEventType | str,
        user_id: UUID | str | None = None,
        action: str | None = None,
        description: str | None = None,
        sms_id: str | None = None,
        transaction_id: UUID | str | None = None,
        status: str = "success",
        metadata: dict[str, Any] | None = None,
        device_info: dict[str, Any] | None = None,
        entity_type: str | None = None,
        entity_id: UUID | str | None = None,
        previous_value: dict[str, Any] | None = None,
        new_value: dict[str, Any] | None = None,
        context: RequestAuditContext | None = None,
    ) -> AuditLog:
        ctx = context or get_request_audit_context()
        event = event_type.value if isinstance(event_type, AuditEventType) else str(event_type)
        meta = dict(metadata or {})
        info = dict(device_info or {})
        # Allow device fields nested under metadata from the RN client.
        nested = meta.get("device_info") if isinstance(meta.get("device_info"), dict) else {}
        merged_device = {**nested, **info, **{k: meta[k] for k in (
            "device_id",
            "device_model",
            "manufacturer",
            "android_version",
            "app_version",
            "platform",
        ) if k in meta}}

        resolved_action = (action or _EVENT_ACTIONS.get(event) or event.replace("_", " ").title())[:120]
        resolved_description = description
        if resolved_description is None and isinstance(new_value, dict):
            resolved_description = _pick_str(new_value, "description", max_len=500)
        if resolved_description is None and isinstance(meta, dict):
            resolved_description = _pick_str(meta, "description", max_len=500)

        resolved_sms_id = (sms_id or _pick_str(meta, "sms_id", "android_sms_id", max_len=64)
                           or (str(entity_id)[:64] if entity_type in ("sms_message", "android_sms") and entity_id else None))
        resolved_tx = _as_uuid(transaction_id) or _as_uuid(
            meta.get("transaction_id") if meta else None
        ) or _as_uuid(new_value.get("transaction_id") if isinstance(new_value, dict) else None)

        row = AuditLog(
            user_id=UUID(str(user_id)) if user_id else None,
            event_type=event,
            action=resolved_action,
            description=(resolved_description or "")[:2000] or None,
            sms_id=resolved_sms_id,
            transaction_id=resolved_tx,
            status=(status or "success")[:32],
            metadata_json=meta or None,
            device_id=_pick_str(merged_device, "device_id", "deviceId", "id"),
            device_model=_pick_str(merged_device, "device_model", "deviceModel", "model"),
            manufacturer=_pick_str(merged_device, "manufacturer", "Manufacturer"),
            android_version=_pick_str(merged_device, "android_version", "androidVersion", max_len=32),
            app_version=_pick_str(merged_device, "app_version", "appVersion", max_len=32),
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            previous_value=previous_value,
            new_value=new_value,
            ip_address=ctx.ip_address if ctx else None,
            device=_pick_str(merged_device, "device_model", "device") or (ctx.device if ctx else None),
            platform=_pick_str(merged_device, "platform") or (ctx.platform if ctx else None),
            request_id=ctx.request_id if ctx else None,
            user_agent=ctx.user_agent if ctx else None,
        )
        db.add(row)
        db.flush()
        logger.info(
            "audit_event type=%s action=%s user_id=%s sms_id=%s tx=%s status=%s request_id=%s",
            event,
            resolved_action,
            user_id,
            resolved_sms_id,
            resolved_tx,
            status,
            row.request_id,
        )
        return row
