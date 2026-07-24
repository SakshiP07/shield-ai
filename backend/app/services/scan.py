from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.pipeline import process_transaction


def analyze_scan(
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
    return process_transaction(
        db,
        user,
        scan_type=scan_type,
        content=content,
        amount=amount,
        device_info=device_info,
        sender=sender,
        append_ledger=append_ledger,
    )
