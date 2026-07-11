import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BehaviourProfile(Base):
    __tablename__ = "behaviour_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, index=True
    )
    security_score: Mapped[int] = mapped_column(Integer, default=75)
    threats_blocked: Mapped[int] = mapped_column(Integer, default=0)
    items_scanned: Mapped[int] = mapped_column(Integer, default=0)
    safe_items: Mapped[int] = mapped_column(Integer, default=0)
    avg_transaction_amount: Mapped[float] = mapped_column(Float, default=0.0)
    typical_channels: Mapped[str] = mapped_column(String(120), default="upi,qr")
    risk_level: Mapped[str] = mapped_column(String(20), default="low")  # low, medium, high
    last_scan_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user = relationship("User", back_populates="behaviour_profile")
