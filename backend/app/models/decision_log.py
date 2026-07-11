import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DecisionLog(Base):
    __tablename__ = "decision_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transactions.id"), index=True
    )
    decision: Mapped[str] = mapped_column(String(20), nullable=False)  # approve, otp, hold, block
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    fraud_score: Mapped[float] = mapped_column(Float, nullable=False)
    pipeline_snapshot_json: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
