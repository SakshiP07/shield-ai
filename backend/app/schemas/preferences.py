from pydantic import BaseModel, ConfigDict, Field


class UserPreferencesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    notifications_enabled: bool = True
    push_alerts: bool = True
    email_alerts: bool = False
    sms_alerts: bool = False
    android_sms_connected: bool = False
    ai_sensitivity: str = "balanced"
    privacy_level: str = "standard"


class UserPreferencesUpdate(BaseModel):
    notifications_enabled: bool | None = None
    push_alerts: bool | None = None
    email_alerts: bool | None = None
    sms_alerts: bool | None = None
    android_sms_connected: bool | None = None
    ai_sensitivity: str | None = Field(default=None, pattern="^(standard|balanced|high)$")
    privacy_level: str | None = Field(default=None, pattern="^(standard|strict|minimal)$")
