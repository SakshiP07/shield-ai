from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.ledger import LedgerEntry, LedgerListResponse
from app.services.ledger_service import list_ledger

router = APIRouter(prefix="/ledger", tags=["ledger"])


@router.get("", response_model=LedgerListResponse)
def get_ledger(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    phone: str | None = Query(default=None, description="Search by phone number"),
    upi: str | None = Query(default=None, description="Search by UPI ID"),
    status: str | None = Query(
        default=None,
        pattern="^(succeeded|failed|pending)$",
        description="Filter: succeeded | failed | pending",
    ),
    risk_level: str | None = Query(
        default=None,
        pattern="^(high|medium|low)$",
        description="Filter: high | medium | low",
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> LedgerListResponse:
    rows, total = list_ledger(
        db,
        user.id,
        phone=phone,
        upi=upi,
        status=status,
        risk_level=risk_level,
        page=page,
        page_size=page_size,
    )
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 1
    return LedgerListResponse(
        items=[LedgerEntry.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
