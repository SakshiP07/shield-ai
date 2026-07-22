from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AndroidSmsConnectionResponse(BaseModel):
    connected: bool
    platform: str = "android"
    ios_supported: bool = False


class AndroidSmsIngestItem(BaseModel):
    """One row from Android Telephony.Sms / Content Provider."""

    android_sms_id: str = Field(..., min_length=1, max_length=64)
    address: str = Field(..., min_length=1, max_length=64, description="Phone number or short code")
    body: str = Field(..., min_length=0, max_length=10000)
    sender: str | None = Field(default=None, max_length=120)
    received_at: datetime
    is_read: bool = False
    thread_id: str | None = Field(default=None, max_length=64)
    is_otp: bool | None = None
    otp_code: str | None = Field(default=None, max_length=16)

    @field_validator("body", mode="before")
    @classmethod
    def coerce_body(cls, value: Any) -> str:
        return "" if value is None else str(value)


class AndroidSmsIngestRequest(BaseModel):
    messages: list[AndroidSmsIngestItem] = Field(..., min_length=1, max_length=200)
    device_info: dict | None = None
    auto_scan: bool = True


class AndroidSmsIngestResultItem(BaseModel):
    id: UUID
    android_sms_id: str
    is_otp: bool
    otp_code: str | None = None
    transaction_id: UUID | None = None
    badge: str | None = None
    decision: str | None = None
    scanned: bool = False


class AndroidSmsIngestResponse(BaseModel):
    created: int
    updated: int
    scanned: int
    items: list[AndroidSmsIngestResultItem]


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
    transaction_id: UUID | None = None
    fraud_score: float | None = None
    risk_score: float | None = None
    risk_level: str | None = None
    decision: str | None = None
    badge: str | None = None


class AndroidSmsInboxResponse(BaseModel):
    items: list[AndroidSmsInboxItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    connected: bool
