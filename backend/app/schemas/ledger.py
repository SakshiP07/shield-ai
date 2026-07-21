from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class LedgerEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    transaction_id: UUID
    phone_number: str | None = None
    upi_id: str | None = None
    created_at: datetime
    fraud_score: float
    risk_level: str
    status: str
    reason: str
    model_version: str
    processing_time_ms: int
    device_id: str | None = None
    scan_source: str


class LedgerListResponse(BaseModel):
    items: list[LedgerEntry]
    total: int
    page: int
    page_size: int
    total_pages: int
