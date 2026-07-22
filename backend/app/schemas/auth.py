from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class OTPRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)


class OTPVerify(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    otp: str = Field(..., min_length=4, max_length=8)
    intent: Literal["login", "signup", "continue"] = "continue"


class LinkPhoneVerifyRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    otp: str = Field(..., min_length=4, max_length=8)
    password: str | None = Field(None, min_length=8, max_length=128)
    confirm_password: str | None = Field(None, min_length=8, max_length=128)

    @model_validator(mode="after")
    def passwords_match(self) -> "LinkPhoneVerifyRequest":
        if self.password or self.confirm_password:
            if not self.password or not self.confirm_password:
                raise ValueError("Password and confirmation are required together")
            if self.password != self.confirm_password:
                raise ValueError("Passwords do not match")
        return self


class OTPResponse(BaseModel):
    message: str
    expires_in: int
    sms_sent: bool = False
    delivery_channel: str = "console"
    dev_otp: str | None = None


class PasswordSignupStartRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: str = Field(..., min_length=5, max_length=255)
    phone: str = Field(..., min_length=10, max_length=20)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name must contain at least 2 non-space characters")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value or "." not in value.split("@")[-1]:
            raise ValueError("Enter a valid email address")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters")
        return value

    @model_validator(mode="after")
    def passwords_match(self) -> "PasswordSignupStartRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class PasswordSignupVerifyRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=20)
    otp: str = Field(..., min_length=4, max_length=8)


class PhonePasswordLoginRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=20)
    password: str = Field(..., min_length=1, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    phone: str | None = None
    email: str | None = None
    google_id: str | None = None
    avatar_url: str | None = None
    plan: str
    profile_completed: bool = False
    auth_provider: str = "password"
    phone_verified: bool = False
    email_verified: bool = False


class AuthResponse(BaseModel):
    success: bool = True
    isNewUser: bool = False
    access_token: str
    token: str = ""
    token_type: str = "bearer"
    user: UserResponse
    needs_profile: bool = False


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    avatar_url: str | None = Field(default=None, max_length=512)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name must contain at least 2 non-space characters")
        return value


class GoogleAuthRequest(BaseModel):
    """Supabase Auth access token from Google OAuth (`signInWithOAuth`)."""

    access_token: str = Field(..., min_length=20)
    intent: Literal["login", "signup", "continue"] = "continue"


class AuthConfigResponse(BaseModel):
    google_enabled: bool
    google_redirect_ready: bool = False
    google_redirect_uri: str = ""
    sms_enabled: bool
    otp_delivery: str = "console"


class DashboardStats(BaseModel):
    security_score: int
    threats_blocked: int
    items_scanned: int
    safe_items: int
    risk_level: str
    last_scan_at: datetime | None
    blocked_count: int = 0
    warning_count: int = 0
    safe_count: int = 0
    blocked_scans_count: int = 0
    score_breakdown: list[str] = Field(default_factory=list)


class ActivityItem(BaseModel):
    id: UUID
    title: str
    time: datetime
    amount: Decimal | None = None
    sub: str | None = None
    badge: str


class AlertItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    severity: str
    alert_type: str
    is_read: bool
    created_at: datetime
    transaction_id: UUID | None = None
    source: str = "scanner"
    fraud_score: float = 0.0


class AlertReadResponse(BaseModel):
    ok: bool
    is_read: bool


class UnreadCountResponse(BaseModel):
    count: int


class AlertDetail(BaseModel):
    id: UUID
    title: str
    description: str
    severity: str
    alert_type: str
    is_read: bool
    created_at: datetime
    transaction_id: UUID | None = None
    source: str = "scanner"
    fraud_score: float = 0.0
    risk_score: float = 0.0
    risk_level: str = ""
    decision: str = ""
    full_message: str = ""
    recommendation: str = ""
    flagged_reasons: list[str] = Field(default_factory=list)
    behaviour: dict | None = None
    rules: dict | None = None
    ml_prediction: dict | None = None
    pipeline: dict | None = None
    scan_reference: str | None = None


class ScanRequest(BaseModel):
    scan_type: str = Field(..., pattern="^(qr|sms|upi|phone|link)$")
    content: str = Field(..., min_length=1)
    amount: Decimal | None = None
    device_info: dict | None = None
    sender: str | None = Field(default=None, max_length=120)


class ScanResult(BaseModel):
    status: str
    decision: str
    fraud_score: float
    risk_score: float
    risk_level: str
    title: str
    message: str
    requires_otp: bool = False
    transaction_id: UUID | None = None
    alert_id: UUID | None = None


class SmsScanItem(BaseModel):
    id: UUID
    sender: str
    text: str
    time: datetime
    badge: str
    decision: str
    status: str
    fraud_score: float
    risk_score: float
    risk_level: str


class SmsScanDetail(BaseModel):
    id: UUID
    sender: str
    text: str
    time: datetime
    badge: str
    decision: str
    status: str
    fraud_score: float
    risk_score: float
    risk_level: str
    alert_id: UUID | None = None
    flagged_reasons: list[str] = Field(default_factory=list)
    behaviour: dict | None = None
    rules: dict | None = None
    ml_prediction: dict | None = None
    pipeline: dict | None = None
