from pydantic import BaseModel, Field


class BiometricRegisterVerifyRequest(BaseModel):
    credential: dict
    device_label: str | None = Field(default=None, max_length=120)
    rp_id: str | None = None
    origin: str | None = None


class BiometricLoginOptionsRequest(BaseModel):
    credential_ids: list[str] = Field(default_factory=list)
    rp_id: str | None = None
    origin: str | None = None


class BiometricLoginVerifyRequest(BaseModel):
    session_id: str
    credential: dict
    rp_id: str | None = None
    origin: str | None = None


class BiometricStatusResponse(BaseModel):
    server_enabled: bool
    registered: bool = False
    credential_count: int = 0


class BiometricRegisterResponse(BaseModel):
    registered: bool
    device_label: str
    credential_id: str
