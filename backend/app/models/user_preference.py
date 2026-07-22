import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserPreference(Base):
    __tablename__ = "user_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True
    )
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    push_alerts: Mapped[bool] = mapped_column(Boolean, default=True)
    email_alerts: Mapped[bool] = mapped_column(Boolean, default=False)
    sms_alerts: Mapped[bool] = mapped_column(Boolean, default=False)
    android_sms_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_sensitivity: Mapped[str] = mapped_column(String(20), default="balanced")
    privacy_level: Mapped[str] = mapped_column(String(20), default="standard")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user = relationship("User", back_populates="preferences")
