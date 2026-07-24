from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AndroidSmsConnectionResponse(BaseModel):
    connected: bool
    platform: str = "android"
    ios_supported: bool = False
    total_messages: int = 0
    last_sync_at: str | None = None


class AndroidSmsConnectRequest(BaseModel):
    device_info: dict | None = None


class AndroidSmsIngestItem(BaseModel):
    """One row from Android Telephony.Sms / Content Provider."""

    android_sms_id: str = Field(..., min_length=1, max_length=64)
    address: str = Field(..., min_length=1, max_length=256, description="Phone number or short code")
    body: str = Field(..., min_length=0, max_length=10000)
    sender: str | None = Field(default=None, max_length=120)
    received_at: datetime
    is_read: bool = False
    thread_id: str | None = Field(default=None, max_length=64)
    is_otp: bool | None = None
    otp_code: str | None = Field(default=None, max_length=16)
    sms_type: str | None = Field(default=None, max_length=30)
    folder: str | None = Field(default="inbox", max_length=20)

    @field_validator("body", mode="before")
    @classmethod
    def coerce_body(cls, value: Any) -> str:
        return "" if value is None else str(value)[:10000]

    @field_validator("android_sms_id", mode="before")
    @classmethod
    def normalize_id(cls, value: Any) -> str:
        text = str(value or "").strip()
        if not text:
            raise ValueError("android_sms_id required")
        return text[:64]

    @field_validator("address", mode="before")
    @classmethod
    def normalize_address(cls, value: Any) -> str:
        text = str(value or "").strip() or "unknown"
        return text[:256]

    @field_validator("sender", mode="before")
    @classmethod
    def normalize_sender(cls, value: Any) -> str | None:
        if value is None or value == "":
            return None
        return str(value).strip()[:120] or None

    @field_validator("thread_id", mode="before")
    @classmethod
    def normalize_thread_id(cls, value: Any) -> str | None:
        if value is None or value == "":
            return None
        return str(value)[:64]

    @field_validator("otp_code", mode="before")
    @classmethod
    def normalize_otp(cls, value: Any) -> str | None:
        if value is None or value == "":
            return None
        return str(value)[:16]

    @field_validator("sms_type", mode="before")
    @classmethod
    def normalize_sms_type(cls, value: Any) -> str | None:
        if value is None or value == "":
            return None
        return str(value)[:30]

    @field_validator("folder", mode="before")
    @classmethod
    def normalize_folder(cls, value: Any) -> str | None:
        if value is None or value == "":
            return "inbox"
        return str(value)[:20]

    @field_validator("received_at", mode="before")
    @classmethod
    def normalize_received_at(cls, value: Any) -> Any:
        if value is None or value == "":
            return datetime.utcnow()
        if isinstance(value, (int, float)):
            # Android DATE is epoch millis
            ms = float(value)
            if ms > 1e12:
                return datetime.utcfromtimestamp(ms / 1000.0)
            return datetime.utcfromtimestamp(ms)
        if isinstance(value, str):
            text = value.strip()
            # Accept epoch millis sent as a string
            if text.isdigit():
                ms = float(text)
                if ms > 1e12:
                    return datetime.utcfromtimestamp(ms / 1000.0)
                return datetime.utcfromtimestamp(ms)
            return text
        return value


class AndroidSmsIngestRequest(BaseModel):
    """Raw message dicts are accepted; invalid rows are filtered in the route."""

    messages: list[dict[str, Any]] = Field(..., min_length=1, max_length=200)
    device_info: dict | None = None
    auto_scan: bool = True


class AndroidSmsClientAuditRequest(BaseModel):
    event_type: str = Field(..., min_length=3, max_length=64)
    description: str | None = Field(default=None, max_length=500)
    metadata: dict | None = None
    sms_id: str | None = Field(default=None, max_length=64)
    status: str | None = Field(default="success", max_length=32)


class AndroidSmsInboxItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    android_sms_id: str
    address: str
    phone_number: str
    sender: str
    body: str
    received_at: datetime
    timestamp: datetime
    is_read: bool
    unread: bool
    is_otp: bool
    otp_code: str | None = None
    sms_type: str | None = None
    transaction_id: UUID | None = None
    fraud_score: float | None = None
    risk_score: float | None = None
    risk_level: str | None = None
    confidence: float | None = None
    processing_time_ms: int | None = None
    decision: str | None = None
    badge: str | None = None


class AndroidSmsIngestResultItem(BaseModel):
    id: UUID
    android_sms_id: str
    is_otp: bool
    otp_code: str | None = None
    sms_type: str | None = None
    transaction_id: UUID | None = None
    badge: str | None = None
    decision: str | None = None
    fraud_score: float | None = None
    risk_level: str | None = None
    confidence: float | None = None
    processing_time_ms: int | None = None
    scanned: bool = False


class AndroidSmsIngestResponse(BaseModel):
    created: int
    updated: int
    scanned: int
    items: list[AndroidSmsIngestResultItem]


class AndroidSmsInboxResponse(BaseModel):
    items: list[AndroidSmsInboxItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    connected: bool

