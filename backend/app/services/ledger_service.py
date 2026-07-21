"""Append-only transaction ledger service (PostgreSQL only — no Redis)."""

from __future__ import annotations

import re
import uuid
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.transaction_ledger import TransactionLedger

MODEL_VERSION = "rf-v1"

SCAN_SOURCE_MAP = {
    "sms": "SMS",
    "qr": "QR",
    "upi": "Manual",
    "phone": "Manual",
    "link": "Manual",
}


def map_scan_source(scan_type: str) -> str:
    return SCAN_SOURCE_MAP.get(scan_type, "Manual")


def map_outcome_status(decision_action: str) -> str:
    """succeeded | failed | pending from pipeline decision."""
    if decision_action == "approve":
        return "succeeded"
    if decision_action == "block":
        return "failed"
    return "pending"  # otp, hold, etc.


def map_risk_level(level: str) -> str:
    """Normalize to low | medium | high for filters."""
    if level in ("high", "critical"):
        return "high"
    if level == "medium":
        return "medium"
    return "low"


def extract_upi_id(content: str, merchant_upi: str | None = None) -> str | None:
    if merchant_upi:
        return merchant_upi.strip().lower()[:120]
    text = (content or "").strip()
    if "@" in text and " " not in text.split("@")[0]:
        # likely UPI VPA
        return text.lower()[:120]
    match = re.search(r"[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}", text)
    if match:
        return match.group(0).lower()[:120]
    return None


def extract_phone(content: str, user_phone: str | None) -> str | None:
    if user_phone:
        return user_phone
    digits = "".join(c for c in (content or "") if c.isdigit())
    if len(digits) >= 10:
        return digits[-10:]
    return None


def extract_device_id(device_info: dict | None) -> str | None:
    if not device_info:
        return None
    for key in ("device_id", "deviceId", "id"):
        value = device_info.get(key)
        if value:
            return str(value)[:128]
    # Stable-ish fallback from browser metadata
    ua = device_info.get("userAgent") or device_info.get("user_agent")
    platform = device_info.get("platform")
    if ua or platform:
        return f"{platform or 'web'}:{str(ua)[:80]}"[:128]
    return None


def append_ledger_entry(
    db: Session,
    *,
    transaction_id: uuid.UUID,
    user_id: uuid.UUID,
    phone_number: str | None,
    upi_id: str | None,
    fraud_score: float,
    risk_level: str,
    status: str,
    reason: str,
    processing_time_ms: int,
    device_id: str | None,
    scan_source: str,
    model_version: str = MODEL_VERSION,
) -> TransactionLedger:
    """Insert a new immutable ledger row. Never updates existing rows."""
    row = TransactionLedger(
        transaction_id=transaction_id,
        user_id=user_id,
        phone_number=phone_number,
        upi_id=upi_id,
        fraud_score=float(fraud_score),
        risk_level=map_risk_level(risk_level),
        status=status,
        reason=(reason or "")[:2000],
        model_version=model_version,
        processing_time_ms=max(0, int(processing_time_ms)),
        device_id=device_id,
        scan_source=scan_source,
    )
    db.add(row)
    return row


def list_ledger(
    db: Session,
    user_id: UUID,
    *,
    phone: str | None = None,
    upi: str | None = None,
    status: str | None = None,
    risk_level: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[TransactionLedger], int]:
    """Newest-first paginated ledger from PostgreSQL."""
    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    query = db.query(TransactionLedger).filter(TransactionLedger.user_id == user_id)

    if phone:
        digits = "".join(c for c in phone if c.isdigit())
        if digits:
            query = query.filter(TransactionLedger.phone_number.ilike(f"%{digits}%"))
    if upi:
        query = query.filter(TransactionLedger.upi_id.ilike(f"%{upi.strip().lower()}%"))
    if status:
        query = query.filter(TransactionLedger.status == status.lower())
    if risk_level:
        query = query.filter(TransactionLedger.risk_level == risk_level.lower())

    total = query.with_entities(func.count(TransactionLedger.id)).scalar() or 0
    rows = (
        query.order_by(TransactionLedger.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return rows, int(total)
