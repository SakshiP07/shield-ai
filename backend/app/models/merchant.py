import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    upi_id: Mapped[str] = mapped_column(String(120), unique=True, nullable=True, index=True)
    phone: Mapped[str] = mapped_column(String(20), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(80), nullable=True)
    trust_score: Mapped[float] = mapped_column(Float, default=50.0)
    report_count: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    transactions = relationship("Transaction", back_populates="merchant")
