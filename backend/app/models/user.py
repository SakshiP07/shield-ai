import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=True)
    google_id: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=True)
    google_given_name: Mapped[str] = mapped_column(String(120), nullable=True)
    google_family_name: Mapped[str] = mapped_column(String(120), nullable=True)
    google_email_verified: Mapped[bool] = mapped_column(Boolean, nullable=True)
    google_locale: Mapped[str] = mapped_column(String(35), nullable=True)
    google_hosted_domain: Mapped[str] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str] = mapped_column(String(512), nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(20), default="phone")  # phone | google | linked
    profile_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    plan: Mapped[str] = mapped_column(String(50), default="Free Shield")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    behaviour_profile = relationship(
        "BehaviourProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    fraud_logs = relationship("FraudLog", back_populates="user", cascade="all, delete-orphan")
    webauthn_credentials = relationship(
        "WebAuthnCredential", back_populates="user", cascade="all, delete-orphan"
    )
    preferences = relationship(
        "UserPreference", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
