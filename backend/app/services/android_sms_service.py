"""Android SMS inbox sync — Content Provider payloads only (no Twilio / SMS gateways)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.sms_message import SmsMessage
from app.models.user import User
from app.services.audit_service import AuditEventType, AuditService
from app.services.otp_detect import detect_otp
from app.services.preference_service import PreferenceService
from app.services.scan import analyze_scan
from app.services.sms_classify import classify_sms, should_append_ledger
from app.services.sms_service import badge_from_decision


def _as_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


class AndroidSmsService:
    @staticmethod
    def get_connection(db: Session, user: User) -> dict:
        prefs = PreferenceService.get_or_create(db, user)
        total = (
            db.query(func.count(SmsMessage.id)).filter(SmsMessage.user_id == user.id).scalar() or 0
        )
        last_sync = (
            db.query(func.max(SmsMessage.updated_at))
            .filter(SmsMessage.user_id == user.id)
            .scalar()
        )
        return {
            "connected": bool(prefs.android_sms_connected),
            "platform": "android",
            "ios_supported": False,
            "total_messages": int(total),
            "last_sync_at": last_sync.isoformat() if last_sync else None,
        }

    @staticmethod
    def connect(db: Session, user: User, *, device_info: dict | None = None) -> dict:
        prefs = PreferenceService.get_or_create(db, user)
        previous = prefs.android_sms_connected
        prefs.android_sms_connected = True
        if not previous:
            AuditService.append(
                db,
                event_type=AuditEventType.SMS_CONNECTED,
                user_id=user.id,
                action="SMS Connected",
                description="Android SMS Shield connected",
                entity_type="android_sms",
                entity_id=user.id,
                status="success",
                device_info=device_info,
                previous_value={"android_sms_connected": False},
                new_value={"android_sms_connected": True, "device_info": device_info or {}},
                metadata={"device_info": device_info or {}},
            )
        db.commit()
        db.refresh(prefs)
        return AndroidSmsService.get_connection(db, user)

    @staticmethod
    def disconnect(db: Session, user: User, *, device_info: dict | None = None) -> dict:
        prefs = PreferenceService.get_or_create(db, user)
        previous = prefs.android_sms_connected
        prefs.android_sms_connected = False
        if previous:
            AuditService.append(
                db,
                event_type=AuditEventType.SMS_DISCONNECTED,
                user_id=user.id,
                action="SMS Disconnected",
                description="Android SMS Shield disconnected",
                entity_type="android_sms",
                entity_id=user.id,
                status="success",
                device_info=device_info,
                previous_value={"android_sms_connected": True},
                new_value={"android_sms_connected": False, "device_info": device_info or {}},
                metadata={"device_info": device_info or {}},
            )
        db.commit()
        db.refresh(prefs)
        return AndroidSmsService.get_connection(db, user)

    @staticmethod
    def record_client_event(
        db: Session,
        user: User,
        *,
        event_type: str,
        description: str | None = None,
        metadata: dict | None = None,
        sms_id: str | None = None,
        status: str = "success",
    ) -> None:
        """Append-only audit from the React Native client (permissions, retries, etc.)."""
        allowed = {
            AuditEventType.SMS_PERMISSION_GRANTED.value,
            AuditEventType.SMS_PERMISSION_DENIED.value,
            AuditEventType.SMS_PERMISSION_REVOKED.value,
            AuditEventType.SMS_SYNC_STARTED.value,
            AuditEventType.SMS_SYNC_COMPLETED.value,
            AuditEventType.SMS_INCOMING_DETECTED.value,
            AuditEventType.SMS_CONNECTION_LOST.value,
            AuditEventType.SMS_DELETED_FROM_DEVICE.value,
            AuditEventType.SMS_API_FAILURE.value,
            AuditEventType.SMS_RETRY_ATTEMPT.value,
            AuditEventType.SMS_BACKEND_ERROR.value,
            AuditEventType.PROFILE_PHONE_UPDATED.value,
        }
        if event_type not in allowed:
            raise ValueError(f"Unsupported SMS audit event: {event_type}")
        failure_events = {
            AuditEventType.SMS_PERMISSION_DENIED.value,
            AuditEventType.SMS_PERMISSION_REVOKED.value,
            AuditEventType.SMS_CONNECTION_LOST.value,
            AuditEventType.SMS_API_FAILURE.value,
            AuditEventType.SMS_BACKEND_ERROR.value,
        }
        AuditService.append(
            db,
            event_type=event_type,
            user_id=user.id,
            description=description,
            sms_id=sms_id,
            status="failure" if event_type in failure_events else status,
            metadata=metadata or {},
            device_info=metadata if isinstance(metadata, dict) else None,
            entity_type="android_sms",
            entity_id=sms_id or user.id,
            new_value={"description": description, "metadata": metadata or {}},
        )
        db.commit()

    @staticmethod
    def ingest(
        db: Session,
        user: User,
        messages: list[dict],
        *,
        device_info: dict | None = None,
        auto_scan: bool = True,
    ) -> dict:
        """Upsert parsed Android SMS rows and optionally run the fraud pipeline."""
        prefs = PreferenceService.get_or_create(db, user)
        if not prefs.android_sms_connected:
            prefs.android_sms_connected = True
            AuditService.append(
                db,
                event_type=AuditEventType.SMS_CONNECTED,
                user_id=user.id,
                action="SMS Connected",
                description="Auto-connected on ingest",
                entity_type="android_sms",
                entity_id=user.id,
                device_info=device_info,
                previous_value={"android_sms_connected": False},
                new_value={"android_sms_connected": True},
            )

        AuditService.append(
            db,
            event_type=AuditEventType.SMS_SYNC_STARTED,
            user_id=user.id,
            action="SMS Sync Started",
            description=f"Ingesting {len(messages)} SMS",
            entity_type="android_sms",
            entity_id=user.id,
            device_info=device_info,
            metadata={"count": len(messages), "device_info": device_info or {}},
            new_value={"count": len(messages), "device_info": device_info or {}},
        )

        created = 0
        updated = 0
        scanned = 0
        ledgered = 0
        results: list[dict] = []

        for raw in messages:
            android_id = str(raw["android_sms_id"]).strip()
            address = str(raw.get("address") or "").strip()[:64] or "unknown"
            body = str(raw.get("body") or "")
            sender = str(raw.get("sender") or address).strip()[:120] or address
            received_at = _as_aware(raw["received_at"])
            is_read = bool(raw.get("is_read", False))
            thread_id = raw.get("thread_id")
            thread_id = str(thread_id)[:64] if thread_id is not None else None
            folder = str(raw.get("folder") or "inbox")[:20]

            is_otp, otp_code = detect_otp(body)
            if raw.get("is_otp") is True:
                is_otp = True
            if raw.get("otp_code"):
                otp_code = str(raw["otp_code"])[:16]
                is_otp = True

            sms_type = classify_sms(body, is_otp=is_otp)
            if raw.get("sms_type"):
                sms_type = str(raw["sms_type"])[:30]

            row = (
                db.query(SmsMessage)
                .filter(SmsMessage.user_id == user.id, SmsMessage.android_sms_id == android_id)
                .first()
            )
            is_new = row is None
            if is_new:
                row = SmsMessage(
                    user_id=user.id,
                    android_sms_id=android_id,
                    address=address,
                    sender=sender,
                    body=body,
                    received_at=received_at,
                    is_read=is_read,
                    is_otp=is_otp,
                    otp_code=otp_code,
                    thread_id=thread_id,
                    sms_type=sms_type,
                    folder=folder,
                )
                db.add(row)
                created += 1
                AuditService.append(
                    db,
                    event_type=AuditEventType.SMS_UPLOADED,
                    user_id=user.id,
                    action="SMS Uploaded",
                    description=f"Uploaded SMS from {sender}",
                    sms_id=android_id,
                    entity_type="sms_message",
                    entity_id=android_id,
                    device_info=device_info,
                    metadata={
                        "android_sms_id": android_id,
                        "sms_type": sms_type,
                        "is_otp": is_otp,
                        "sender": sender,
                    },
                    new_value={
                        "android_sms_id": android_id,
                        "sms_type": sms_type,
                        "is_otp": is_otp,
                        "sender": sender,
                    },
                )
                if is_otp:
                    AuditService.append(
                        db,
                        event_type=AuditEventType.OTP_DETECTED,
                        user_id=user.id,
                        action="OTP Detected",
                        description="OTP pattern detected in SMS body",
                        sms_id=android_id,
                        entity_type="sms_message",
                        entity_id=android_id,
                        device_info=device_info,
                        metadata={"otp_code_len": len(otp_code or "")},
                        new_value={"otp_code_len": len(otp_code or "")},
                    )
                if sms_type == "banking":
                    AuditService.append(
                        db,
                        event_type=AuditEventType.BANK_SMS_DETECTED,
                        user_id=user.id,
                        action="Bank SMS Detected",
                        description="Banking SMS classified",
                        sms_id=android_id,
                        entity_type="sms_message",
                        entity_id=android_id,
                        device_info=device_info,
                        metadata={"sender": sender},
                        new_value={"sender": sender},
                    )
                if sms_type == "upi":
                    AuditService.append(
                        db,
                        event_type=AuditEventType.UPI_SMS_DETECTED,
                        user_id=user.id,
                        action="UPI SMS Detected",
                        description="UPI SMS classified",
                        sms_id=android_id,
                        entity_type="sms_message",
                        entity_id=android_id,
                        device_info=device_info,
                        metadata={"sender": sender},
                        new_value={"sender": sender},
                    )
            else:
                row.address = address
                row.sender = sender
                row.body = body
                row.received_at = received_at
                row.is_read = is_read
                row.is_otp = is_otp
                row.otp_code = otp_code
                row.thread_id = thread_id
                row.sms_type = sms_type
                row.folder = folder
                updated += 1

            db.flush()

            scan_result = None
            # Every SMS runs fraud pipeline; ledger only for financial / transaction types.
            should_scan = auto_scan and (is_new or row.transaction_id is None)
            if should_scan and body.strip():
                ledger = should_append_ledger(sms_type)
                AuditService.append(
                    db,
                    event_type=AuditEventType.FRAUD_ANALYSIS_STARTED,
                    user_id=user.id,
                    action="Fraud Analysis Started",
                    description="Fraud pipeline started for SMS",
                    sms_id=android_id,
                    entity_type="sms_message",
                    entity_id=android_id,
                    device_info=device_info,
                )
                scan_result = analyze_scan(
                    db,
                    user,
                    scan_type="sms",
                    content=body,
                    device_info={
                        **(device_info or {}),
                        "platform": "android",
                        "android_sms_id": android_id,
                        "address": address,
                        "is_otp": is_otp,
                        "otp_code": otp_code,
                        "sms_type": sms_type,
                    },
                    sender=sender,
                    append_ledger=ledger,
                )
                scanned += 1
                if ledger:
                    ledgered += 1
                row.transaction_id = scan_result.get("transaction_id")
                row.fraud_score = float(scan_result.get("fraud_score") or 0)
                row.risk_score = float(scan_result.get("risk_score") or 0)
                row.risk_level = str(scan_result.get("risk_level") or "")
                row.confidence = float(scan_result.get("confidence") or 0)
                row.processing_time_ms = int(scan_result.get("processing_time_ms") or 0)
                row.decision = str(scan_result.get("decision") or "")
                row.badge = badge_from_decision(row.decision)
                AuditService.append(
                    db,
                    event_type=AuditEventType.FRAUD_ANALYSIS_COMPLETED,
                    user_id=user.id,
                    action="Fraud Analysis Completed",
                    description=f"Risk={row.risk_level} score={row.fraud_score}",
                    sms_id=android_id,
                    transaction_id=row.transaction_id,
                    entity_type="sms_message",
                    entity_id=android_id,
                    device_info=device_info,
                    metadata={
                        "fraud_score": row.fraud_score,
                        "risk_level": row.risk_level,
                        "confidence": row.confidence,
                        "processing_time_ms": row.processing_time_ms,
                        "decision": row.decision,
                        "ledger_appended": ledger,
                    },
                    new_value={
                        "fraud_score": row.fraud_score,
                        "risk_level": row.risk_level,
                        "confidence": row.confidence,
                        "processing_time_ms": row.processing_time_ms,
                        "decision": row.decision,
                        "transaction_id": str(row.transaction_id) if row.transaction_id else None,
                        "ledger_appended": ledger,
                    },
                )

            results.append(
                {
                    "id": row.id,
                    "android_sms_id": android_id,
                    "is_otp": row.is_otp,
                    "otp_code": row.otp_code,
                    "sms_type": row.sms_type,
                    "transaction_id": row.transaction_id,
                    "badge": row.badge,
                    "decision": row.decision,
                    "fraud_score": row.fraud_score,
                    "risk_level": row.risk_level,
                    "confidence": row.confidence,
                    "processing_time_ms": row.processing_time_ms,
                    "scanned": scan_result is not None,
                }
            )

        AuditService.append(
            db,
            event_type=AuditEventType.SMS_SYNC_COMPLETED,
            user_id=user.id,
            action="SMS Sync Completed",
            description=f"created={created} updated={updated} scanned={scanned}",
            entity_type="android_sms",
            entity_id=user.id,
            device_info=device_info,
            metadata={
                "created": created,
                "updated": updated,
                "scanned": scanned,
                "ledgered": ledgered,
            },
            new_value={
                "created": created,
                "updated": updated,
                "scanned": scanned,
                "ledgered": ledgered,
            },
        )

        db.commit()
        return {
            "created": created,
            "updated": updated,
            "scanned": scanned,
            "ledgered": ledgered,
            "items": results,
        }

    @staticmethod
    def list_inbox(
        db: Session,
        user_id: UUID,
        *,
        search: str | None = None,
        unread_only: bool | None = None,
        otp_only: bool | None = None,
        sms_type: str | None = None,
        badge: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[SmsMessage], int]:
        page = max(1, page)
        page_size = min(max(1, page_size), 100)

        query = db.query(SmsMessage).filter(SmsMessage.user_id == user_id)

        if search:
            term = search.strip()
            if term:
                query = query.filter(
                    or_(
                        SmsMessage.address.ilike(f"%{term}%"),
                        SmsMessage.sender.ilike(f"%{term}%"),
                        SmsMessage.body.ilike(f"%{term}%"),
                        SmsMessage.otp_code.ilike(f"%{term}%"),
                    )
                )

        if unread_only is True:
            query = query.filter(SmsMessage.is_read.is_(False))
        if otp_only is True:
            query = query.filter(SmsMessage.is_otp.is_(True))
        if sms_type:
            query = query.filter(SmsMessage.sms_type == sms_type)
        if badge:
            query = query.filter(SmsMessage.badge == badge)

        total = query.with_entities(func.count(SmsMessage.id)).scalar() or 0
        rows = (
            query.order_by(SmsMessage.received_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return rows, int(total)
