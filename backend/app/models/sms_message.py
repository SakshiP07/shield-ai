import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SmsMessage(Base):
    """Android SMS inbox rows synced to Shield AI (append/upsert by android_sms_id)."""

    __tablename__ = "sms_messages"
    __table_args__ = (
        UniqueConstraint("user_id", "android_sms_id", name="uq_sms_messages_user_android_id"),
        Index("ix_sms_messages_user_id_received_at", "user_id", "received_at"),
        Index("ix_sms_messages_user_id_is_read", "user_id", "is_read"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    android_sms_id: Mapped[str] = mapped_column(String(64), nullable=False)
    address: Mapped[str] = mapped_column(String(64), nullable=False)  # phone / short code
    sender: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_otp: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    otp_code: Mapped[str | None] = mapped_column(String(16), nullable=True)
    thread_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True
    )
    fraud_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_level: Mapped[str | None] = mapped_column(String(30), nullable=True)
    decision: Mapped[str | None] = mapped_column(String(30), nullable=True)
    badge: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
