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
from app.services.sms_service import badge_from_decision


def _as_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


class AndroidSmsService:
    @staticmethod
    def get_connection(db: Session, user: User) -> dict:
        prefs = PreferenceService.get_or_create(db, user)
        return {
            "connected": bool(prefs.android_sms_connected),
            "platform": "android",
            "ios_supported": False,
        }

    @staticmethod
    def connect(db: Session, user: User) -> dict:
        prefs = PreferenceService.get_or_create(db, user)
        previous = prefs.android_sms_connected
        prefs.android_sms_connected = True
        if not previous:
            AuditService.append(
                db,
                event_type=AuditEventType.SMS_CONNECTED,
                user_id=user.id,
                entity_type="android_sms",
                entity_id=user.id,
                previous_value={"android_sms_connected": False},
                new_value={"android_sms_connected": True},
            )
        db.commit()
        db.refresh(prefs)
        return AndroidSmsService.get_connection(db, user)

    @staticmethod
    def disconnect(db: Session, user: User) -> dict:
        prefs = PreferenceService.get_or_create(db, user)
        previous = prefs.android_sms_connected
        prefs.android_sms_connected = False
        if previous:
            AuditService.append(
                db,
                event_type=AuditEventType.SMS_DISCONNECTED,
                user_id=user.id,
                entity_type="android_sms",
                entity_id=user.id,
                previous_value={"android_sms_connected": True},
                new_value={"android_sms_connected": False},
            )
        db.commit()
        db.refresh(prefs)
        return AndroidSmsService.get_connection(db, user)

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
                entity_type="android_sms",
                entity_id=user.id,
                previous_value={"android_sms_connected": False},
                new_value={"android_sms_connected": True},
            )

        created = 0
        updated = 0
        scanned = 0
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

            is_otp, otp_code = detect_otp(body)
            if raw.get("is_otp") is True:
                is_otp = True
            if raw.get("otp_code"):
                otp_code = str(raw["otp_code"])[:16]
                is_otp = True

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
                )
                db.add(row)
                created += 1
            else:
                row.address = address
                row.sender = sender
                row.body = body
                row.received_at = received_at
                row.is_read = is_read
                row.is_otp = is_otp
                row.otp_code = otp_code
                row.thread_id = thread_id
                updated += 1

            db.flush()

            scan_result = None
            should_scan = auto_scan and (is_new or row.transaction_id is None)
            if should_scan and body.strip():
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
                    },
                    sender=sender,
                )
                scanned += 1
                row.transaction_id = scan_result.get("transaction_id")
                row.fraud_score = float(scan_result.get("fraud_score") or 0)
                row.risk_score = float(scan_result.get("risk_score") or 0)
                row.risk_level = str(scan_result.get("risk_level") or "")
                row.decision = str(scan_result.get("decision") or "")
                row.badge = badge_from_decision(row.decision)

            results.append(
                {
                    "id": row.id,
                    "android_sms_id": android_id,
                    "is_otp": row.is_otp,
                    "otp_code": row.otp_code,
                    "transaction_id": row.transaction_id,
                    "badge": row.badge,
                    "decision": row.decision,
                    "scanned": scan_result is not None,
                }
            )

        db.commit()
        return {
            "created": created,
            "updated": updated,
            "scanned": scanned,
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

        total = query.with_entities(func.count(SmsMessage.id)).scalar() or 0
        rows = (
            query.order_by(SmsMessage.received_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return rows, int(total)
