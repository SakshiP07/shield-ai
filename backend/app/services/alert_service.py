import json
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.decision_log import DecisionLog
from app.models.fraud_log import FraudLog
from app.models.transaction import Transaction


def _threat_filter():
    """Only surface real threats in the Pro Alerts feed (not OTP noise / safe scans)."""
    return or_(
        FraudLog.severity.in_(("blocked", "danger")),
        FraudLog.description.ilike("[BLOCK]%"),
        FraudLog.description.ilike("[HOLD]%"),
        FraudLog.alert_type.ilike("%_threat"),
    )


class AlertService:
    @staticmethod
    def list_alerts(db: Session, user_id: UUID, *, limit: int = 50) -> list[FraudLog]:
        return (
            db.query(FraudLog)
            .filter(FraudLog.user_id == user_id)
            .filter(_threat_filter())
            .filter(~FraudLog.description.ilike("[OTP]%"))
            .filter(~FraudLog.description.ilike("[APPROVE]%"))
            .order_by(FraudLog.created_at.desc())
            .limit(limit)
            .all()
        )

    @staticmethod
    def unread_count(db: Session, user_id: UUID) -> int:
        return (
            db.query(FraudLog)
            .filter(FraudLog.user_id == user_id, FraudLog.is_read.is_(False))
            .filter(_threat_filter())
            .filter(~FraudLog.description.ilike("[OTP]%"))
            .count()
        )

    @staticmethod
    def mark_read(db: Session, user_id: UUID, alert_id: UUID) -> FraudLog | None:
        alert = (
            db.query(FraudLog)
            .filter(FraudLog.id == alert_id, FraudLog.user_id == user_id)
            .first()
        )
        if alert is None:
            return None
        alert.is_read = True
        db.commit()
        db.refresh(alert)
        return alert

    @staticmethod
    def mark_all_read(db: Session, user_id: UUID) -> int:
        count = (
            db.query(FraudLog)
            .filter(FraudLog.user_id == user_id, FraudLog.is_read.is_(False))
            .filter(_threat_filter())
            .update({"is_read": True}, synchronize_session=False)
        )
        db.commit()
        return count

    @staticmethod
    def get_alert_detail(db: Session, user_id: UUID, alert_id: UUID) -> dict | None:
        alert = (
            db.query(FraudLog)
            .filter(FraudLog.id == alert_id, FraudLog.user_id == user_id)
            .first()
        )
        if alert is None:
            return None

        tx: Transaction | None = None
        decision_log: DecisionLog | None = None
        pipeline: dict = {}
        behaviour = None
        rules = None
        risk_score = 0.0
        risk_level = alert.severity
        decision = ""
        full_message = alert.description
        recommendation = ""
        flagged_reasons: list[str] = []
        scan_reference = None

        if alert.transaction_id:
            tx = (
                db.query(Transaction)
                .filter(Transaction.id == alert.transaction_id, Transaction.user_id == user_id)
                .first()
            )
            if tx:
                scan_reference = tx.reference
                risk_score = tx.risk_score
                decision = tx.decision
                meta = json.loads(tx.metadata_json) if tx.metadata_json else {}
                full_message = meta.get("message_body") or tx.reference or alert.description
                decision_log = (
                    db.query(DecisionLog)
                    .filter(DecisionLog.transaction_id == tx.id)
                    .order_by(DecisionLog.created_at.desc())
                    .first()
                )
                if decision_log and decision_log.pipeline_snapshot_json:
                    pipeline = json.loads(decision_log.pipeline_snapshot_json)
                behaviour = (
                    json.loads(tx.behaviour_snapshot_json)
                    if tx.behaviour_snapshot_json
                    else pipeline.get("behaviour")
                )
                rules = (
                    json.loads(tx.rule_results_json) if tx.rule_results_json else pipeline.get("rules")
                )
                risk_level = pipeline.get("risk", {}).get("level") or tx.status
                recommendation = pipeline.get("decision", {}).get("reason", "")

        if rules:
            for rule in rules.get("results", []):
                if rule.get("triggered"):
                    flagged_reasons.append(
                        f"{rule.get('rule_id', 'RULE')}: {rule.get('name', 'Triggered')} — {rule.get('detail', '')}"
                    )
        if behaviour and behaviour.get("flags"):
            flagged_reasons.extend(behaviour["flags"])

        if not recommendation and " — " in alert.description:
            recommendation = alert.description.split(" — ", 1)[0].replace("[", "").replace("]", "").strip()

        return {
            "id": alert.id,
            "title": alert.title,
            "description": alert.description,
            "severity": alert.severity,
            "alert_type": alert.alert_type,
            "is_read": alert.is_read,
            "created_at": alert.created_at,
            "transaction_id": alert.transaction_id,
            "source": alert.source,
            "fraud_score": alert.fraud_score,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "decision": decision,
            "full_message": full_message,
            "recommendation": recommendation,
            "flagged_reasons": flagged_reasons,
            "behaviour": behaviour,
            "rules": rules,
            "ml_prediction": {
                "fraud_score": alert.fraud_score,
                "risk_score": risk_score,
                "risk_level": risk_level,
            },
            "pipeline": pipeline or None,
            "scan_reference": scan_reference,
        }
