import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TransactionLedger(Base):
    """Append-only fraud-scan ledger. Never update rows — insert only."""

    __tablename__ = "transaction_ledger"
    __table_args__ = (
        Index("ix_transaction_ledger_user_id_created_at", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transactions.id"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    upi_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    fraud_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # low|medium|high
    # Outcome: succeeded | failed | pending
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    model_version: Mapped[str] = mapped_column(String(40), nullable=False, default="rf-v1")
    processing_time_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    device_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    # Scan source: SMS | QR | Manual
    scan_source: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
