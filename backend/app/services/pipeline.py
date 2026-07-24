"""Full fraud detection pipeline orchestrator."""

import json
import time
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.ml.random_forest_model import fraud_model
from app.models.behaviour_profile import BehaviourProfile
from app.models.decision_log import DecisionLog
from app.models.fraud_log import FraudLog
from app.models.merchant import Merchant
from app.models.transaction import Transaction
from app.models.user import User
from app.services.behaviour_engine import analyze_behaviour
from app.services.decision_engine import decide
from app.services.ledger_service import (
    MODEL_VERSION,
    append_ledger_entry,
    extract_device_id,
    extract_phone,
    extract_upi_id,
    map_outcome_status,
    map_scan_source,
)
from app.services.audit_service import AuditEventType, AuditService
from app.services.risk_score_engine import calculate_risk_score
from app.services.rule_engine import evaluate_rules
from app.services.transaction_helpers import find_merchant, get_or_create_profile
from app.services.velocity import check_velocity


def _short_text(value: str | None, limit: int = 48) -> str:
    text = " ".join((value or "").strip().split())
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip() + "…"


def transaction_subject(
    *,
    scan_type: str,
    content: str,
    merchant: Merchant | None,
    amount: float,
    sender: str | None,
) -> str:
    """Human-readable counterparty / payload so alerts are not all identical."""
    if merchant and merchant.name:
        base = merchant.name
    elif scan_type == "sms" and sender:
        base = sender
    elif scan_type == "upi":
        base = extract_upi_id(content) or _short_text(content, 40) or "UPI payment"
    elif scan_type == "phone":
        base = extract_phone(content) or _short_text(content, 20) or "Phone number"
    elif scan_type == "qr":
        base = _short_text(content, 48) or "QR code"
    elif scan_type == "sms":
        base = _short_text(content, 56) or "SMS"
    else:
        base = _short_text(content, 48) or scan_type.upper()

    if amount > 0:
        return f"{base} · ₹{amount:,.0f}"
    return base


def process_transaction(
    db: Session,
    user: User,
    *,
    scan_type: str,
    content: str,
    amount: Decimal | None = None,
    device_info: dict | None = None,
    sender: str | None = None,
    append_ledger: bool = True,
) -> dict:
    started = time.perf_counter()
    profile = get_or_create_profile(db, user)
    merchant = find_merchant(db, scan_type, content)
    merchant_trust = merchant.trust_score if merchant else 50.0
    amount_val = float(amount or 0)
    velocity = check_velocity(db, user.id, amount_val)

    # Stage 1: Behaviour Engine
    behaviour = analyze_behaviour(db, user, profile, amount=amount_val, channel=scan_type)

    # Stage 2: Rule Engine
    rules = evaluate_rules(
        user_id=str(user.id),
        amount=amount_val,
        content=content,
        channel=scan_type,
        merchant_trust=merchant_trust,
        behaviour_flags=behaviour.flags,
        velocity=velocity,
    )

    # Stage 3: ML Fraud Detection
    ml_score, _ml_status = fraud_model.predict(
        scan_type=scan_type,
        content=content,
        amount=amount_val,
        velocity_count=velocity.count,
        merchant_trust=merchant_trust,
    )

    # Stage 4: Risk Score Engine
    risk = calculate_risk_score(
        ml_fraud_probability=ml_score,
        rule_score=rules.total_rule_score,
        behaviour_deviation=behaviour.deviation_score,
    )

    # Apply user AI sensitivity preference (standard = fewer alerts, high = stricter).
    from app.services.preference_service import PreferenceService

    prefs = PreferenceService.get_or_create(db, user)
    sensitivity = (prefs.ai_sensitivity or "balanced").lower()
    adjusted_risk = float(risk.risk_score)
    if sensitivity == "high":
        adjusted_risk = min(100.0, adjusted_risk + 12.0)
    elif sensitivity == "standard":
        adjusted_risk = max(0.0, adjusted_risk - 12.0)

    # Stage 5: Decision Engine
    decision = decide(risk_score=adjusted_risk, any_high_severity_rule=rules.any_high_severity)

    # Persist transaction
    metadata = dict(device_info or {})
    if scan_type == "sms":
        from app.services.sms_service import build_sms_metadata

        metadata = build_sms_metadata(content, device_info, sender=sender)

    tx = Transaction(
        user_id=user.id,
        merchant_id=merchant.id if merchant else None,
        amount=Decimal(str(amount_val)),
        channel=scan_type,
        reference=content[:255],
        status=decision.status,
        fraud_score=ml_score,
        risk_score=risk.risk_score,
        decision=decision.action,
        behaviour_snapshot_json=json.dumps(behaviour.to_dict()),
        rule_results_json=json.dumps(rules.to_dict()),
        metadata_json=json.dumps(metadata),
    )
    db.add(tx)
    db.flush()

    # Decision log
    db.add(
        DecisionLog(
            user_id=user.id,
            transaction_id=tx.id,
            decision=decision.action,
            risk_score=risk.risk_score,
            fraud_score=ml_score,
            pipeline_snapshot_json=json.dumps(
                {
                    "behaviour": behaviour.to_dict(),
                    "rules": rules.to_dict(),
                    "risk": risk.to_dict(),
                    "decision": decision.to_dict(),
                    "ml_score": ml_score,
                }
            ),
        )
    )

    subject = transaction_subject(
        scan_type=scan_type,
        content=content,
        merchant=merchant,
        amount=amount_val,
        sender=sender,
    )
    channel_label = scan_type.upper()

    alert: FraudLog | None = None
    # Pro Threat Center: only raise alerts for real threats (block / hold).
    # OTP step-ups and approvals stay in SMS / scan history — they are not alerts.
    if decision.action in ("block", "hold"):
        title_map = {
            "hold": f"Review needed · {subject}",
            "block": f"Threat blocked · {subject}",
        }
        alert = FraudLog(
            user_id=user.id,
            transaction_id=tx.id,
            alert_type=f"{scan_type}_threat",
            severity=decision.status,
            title=title_map.get(decision.action, f"Threat · {subject}")[:200],
            description=f"[{decision.action.upper()}] {decision.reason} — {subject} — {_short_text(content, 100)}",
            source="pipeline",
            fraud_score=ml_score,
        )
        db.add(alert)

    # Append-only ledger entry (never updates existing rows).
    # For SMS: only bank / card / UPI / wallet / transaction / suspicious types.
    processing_ms = int((time.perf_counter() - started) * 1000)
    if append_ledger:
        append_ledger_entry(
            db,
            transaction_id=tx.id,
            user_id=user.id,
            phone_number=extract_phone(content, user.phone),
            upi_id=extract_upi_id(content, merchant.upi_id if merchant else None),
            fraud_score=ml_score,
            risk_level=risk.level,
            status=map_outcome_status(decision.action),
            reason=f"[{channel_label}] {decision.reason} — {subject}"[:2000],
            processing_time_ms=processing_ms,
            device_id=extract_device_id(device_info),
            scan_source=map_scan_source(scan_type),
            model_version=MODEL_VERSION,
        )

    # Update behaviour profile
    profile.items_scanned += 1
    profile.last_scan_at = datetime.now(UTC)
    if decision.action == "approve":
        profile.safe_items += 1
    else:
        profile.threats_blocked += 1
        profile.security_score = max(0, profile.security_score - 2)
    if risk.level in ("high", "critical"):
        profile.risk_level = "high"
    elif risk.level == "medium" and profile.risk_level == "low":
        profile.risk_level = "medium"
    if profile.items_scanned > 0:
        profile.avg_transaction_amount = (
            (profile.avg_transaction_amount * (profile.items_scanned - 1) + amount_val)
            / profile.items_scanned
        )

    AuditService.append(
        db,
        event_type=AuditEventType.SCAN,
        user_id=user.id,
        entity_type="transaction",
        entity_id=tx.id,
        new_value={
            "scan_type": scan_type,
            "decision": decision.action,
            "fraud_score": ml_score,
            "risk_score": risk.risk_score,
            "risk_level": risk.level,
        },
    )
    AuditService.append(
        db,
        event_type=AuditEventType.TRANSACTION_COMPLETED,
        user_id=user.id,
        entity_type="transaction",
        entity_id=tx.id,
        new_value={
            "status": decision.status,
            "decision": decision.action,
            "amount": amount_val,
            "channel": scan_type,
        },
    )
    if decision.action in ("block", "hold") or risk.level in ("high", "critical"):
        AuditService.append(
            db,
            event_type=AuditEventType.FRAUD_DETECTED,
            user_id=user.id,
            entity_type="transaction",
            entity_id=tx.id,
            new_value={
                "decision": decision.action,
                "fraud_score": ml_score,
                "risk_level": risk.level,
                "reason": decision.reason,
            },
        )
    if alert is not None:
        AuditService.append(
            db,
            event_type=AuditEventType.ALERT_GENERATED,
            user_id=user.id,
            entity_type="fraud_log",
            entity_id=alert.id,
            new_value={
                "title": alert.title,
                "severity": alert.severity,
                "alert_type": alert.alert_type,
                "transaction_id": str(tx.id),
                "fraud_score": alert.fraud_score,
            },
        )

    db.commit()
    db.refresh(tx)
    if alert:
        db.refresh(alert)

    return {
        "status": decision.status,
        "decision": decision.action,
        "fraud_score": ml_score,
        "risk_score": risk.risk_score,
        "risk_level": risk.level,
        "title": decision.reason,
        "message": f"Decision: {decision.action.upper()} — {decision.reason}",
        "requires_otp": decision.requires_otp,
        "transaction_id": tx.id,
        "alert_id": alert.id if alert else None,
        "confidence": round(min(1.0, max(0.0, abs(float(ml_score) - 0.5) * 2)), 4),
        "processing_time_ms": processing_ms,
        "pipeline": {
            "behaviour": behaviour.to_dict(),
            "rules": rules.to_dict(),
            "risk": risk.to_dict(),
            "decision": decision.to_dict(),
        },
    }
