from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "ShieldAI"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    secret_key: str = "change-me-to-a-long-random-secret"
    access_token_expire_minutes: int = 60
    algorithm: str = "HS256"

    database_url: str = "postgresql://shield:shield@127.0.0.1:5432/shieldai"
    redis_url: str = "redis://127.0.0.1:6379/0"

    otp_expire_seconds: int = 300
    otp_length: int = 6
    otp_delivery: str = "console"  # console | msg91

    phone_country_code: str = "91"
    phone_number_length: int = 10

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # SMS — MSG91 (recommended for India) or Twilio; leave empty for dev mode
    msg91_auth_key: str = ""
    msg91_template_id: str = ""
    msg91_sender_id: str = ""
    msg91_dlt_te_id: str = ""
    msg91_pe_id: str = ""
    # DLT category: transactional OTP (Service Implicit). Suffix must match approved template.
    msg91_sms_suffix: str = "- TGSP"

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""

    # Google OAuth — get from Google Cloud Console
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:5173/auth/google/callback"

    # WebAuthn passkeys backed by a user-verifying platform authenticator
    webauthn_rp_name: str = "ShieldAI"
    webauthn_origin: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def msg91_enabled(self) -> bool:
        return bool(self.msg91_auth_key and self.msg91_template_id)

    @property
    def twilio_enabled(self) -> bool:
        return bool(self.twilio_account_sid and self.twilio_auth_token and self.twilio_from_number)

    @property
    def sms_enabled(self) -> bool:
        return self.msg91_enabled or self.twilio_enabled

    @property
    def google_enabled(self) -> bool:
        return bool(self.google_client_id)

    @property
    def google_redirect_ready(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def webauthn_rp_id(self) -> str:
        from urllib.parse import urlparse

        host = urlparse(self.webauthn_origin).hostname
        return host or "localhost"

    @property
    def webauthn_enabled(self) -> bool:
        return bool(self.webauthn_rp_id and self.webauthn_origin)


@lru_cache
def get_settings() -> Settings:
    return Settings()
