from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AuditLogUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str | None = None
    phone: str | None = None


class AuditLogEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user: AuditLogUser | None = None
    timestamp: datetime = Field(description="When the audit event was recorded")
    event_type: str
    entity_type: str | None = None
    entity_id: str | None = None
    previous_value: dict[str, Any] | None = None
    new_value: dict[str, Any] | None = None
    ip_address: str | None = None
    device: str | None = None
    platform: str | None = None
    request_id: str | None = None
    user_agent: str | None = None


class AuditLogListResponse(BaseModel):
    items: list[AuditLogEntry]
    total: int
    page: int
    page_size: int
    total_pages: int
