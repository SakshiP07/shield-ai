import json
import re
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.decision_log import DecisionLog
from app.models.fraud_log import FraudLog
from app.models.transaction import Transaction


def parse_sms_sender(content: str) -> str:
    """Best-effort sender extraction from pasted SMS text."""
    patterns = [
        r"(?:from|sender)\s*:\s*([A-Za-z0-9\-]{3,20})",
        r"^([A-Z]{2,3}-[A-Z0-9]{4,8})\b",
        r"^([A-Z]{4,12})\s*[-:]\s",
        r"^\+?\d{10,13}\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, content.strip(), re.IGNORECASE | re.MULTILINE)
        if match:
            return match.group(1).strip()
    first_line = content.strip().split("\n", 1)[0].strip()
    if len(first_line) <= 20 and first_line:
        return first_line
    return "Unknown"


def build_sms_metadata(content: str, device_info: dict | None, sender: str | None = None) -> dict:
    resolved_sender = sender or parse_sms_sender(content)
    return {
        "sender": resolved_sender,
        "message_body": content,
        **(device_info or {}),
    }


def badge_from_decision(decision: str) -> str:
    if decision == "approve":
        return "safe"
    if decision in ("otp", "hold"):
        return "warning"
    return "danger"


class SmsService:
    @staticmethod
    def list_scans(db: Session, user_id: UUID, *, limit: int = 50) -> list[Transaction]:
        return (
            db.query(Transaction)
            .filter(Transaction.user_id == user_id, Transaction.channel == "sms")
            .order_by(Transaction.created_at.desc())
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_scan_detail(db: Session, user_id: UUID, transaction_id: UUID) -> dict | None:
        tx = (
            db.query(Transaction)
            .filter(Transaction.id == transaction_id, Transaction.user_id == user_id, Transaction.channel == "sms")
            .first()
        )
        if tx is None:
            return None

        meta = json.loads(tx.metadata_json) if tx.metadata_json else {}
        sender = meta.get("sender") or parse_sms_sender(tx.reference or "")
        message_body = meta.get("message_body") or tx.reference or ""

        decision_log = (
            db.query(DecisionLog)
            .filter(DecisionLog.transaction_id == tx.id)
            .order_by(DecisionLog.created_at.desc())
            .first()
        )
        pipeline = json.loads(decision_log.pipeline_snapshot_json) if decision_log and decision_log.pipeline_snapshot_json else {}
        behaviour = json.loads(tx.behaviour_snapshot_json) if tx.behaviour_snapshot_json else pipeline.get("behaviour")
        rules = json.loads(tx.rule_results_json) if tx.rule_results_json else pipeline.get("rules")

        alert = db.query(FraudLog).filter(FraudLog.transaction_id == tx.id).first()
        risk_level = pipeline.get("risk", {}).get("level") or tx.status

        flagged_reasons: list[str] = []
        if rules:
            for rule in rules.get("results", []):
                if rule.get("triggered"):
                    flagged_reasons.append(
                        f"{rule.get('rule_id', 'RULE')}: {rule.get('name', 'Triggered')} — {rule.get('detail', '')}"
                    )
        if behaviour and behaviour.get("flags"):
            flagged_reasons.extend(behaviour["flags"])

        return {
            "id": tx.id,
            "sender": sender,
            "text": message_body,
            "time": tx.created_at,
            "badge": badge_from_decision(tx.decision),
            "decision": tx.decision,
            "status": tx.status,
            "fraud_score": tx.fraud_score,
            "risk_score": tx.risk_score,
            "risk_level": risk_level,
            "alert_id": alert.id if alert else None,
            "flagged_reasons": flagged_reasons,
            "behaviour": behaviour,
            "rules": rules,
            "ml_prediction": {
                "fraud_score": tx.fraud_score,
                "risk_score": tx.risk_score,
                "risk_level": risk_level,
            },
            "pipeline": pipeline,
        }

    @staticmethod
    def to_list_item(tx: Transaction) -> dict:
        meta = json.loads(tx.metadata_json) if tx.metadata_json else {}
        sender = meta.get("sender") or parse_sms_sender(tx.reference or "")
        message_body = meta.get("message_body") or tx.reference or ""
        pipeline = {}
        if tx.rule_results_json:
            try:
                pipeline = json.loads(tx.rule_results_json)
            except json.JSONDecodeError:
                pipeline = {}
        risk_level = tx.status
        return {
            "id": tx.id,
            "sender": sender,
            "text": message_body[:500],
            "time": tx.created_at,
            "badge": badge_from_decision(tx.decision),
            "decision": tx.decision,
            "status": tx.status,
            "fraud_score": tx.fraud_score,
            "risk_score": tx.risk_score,
            "risk_level": risk_level,
        }
