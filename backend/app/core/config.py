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

    # Supabase / PostgreSQL — only these connection env vars are required
    database_url: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    otp_expire_seconds: int = 300
    otp_length: int = 6
    otp_delivery: str = "console"  # console | msg91 | twilio | auto

    phone_country_code: str = "91"
    phone_number_length: int = 10

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    msg91_auth_key: str = ""
    msg91_template_id: str = ""
    msg91_sender_id: str = ""
    msg91_dlt_te_id: str = ""
    msg91_pe_id: str = ""
    msg91_sms_suffix: str = "- TGSP"

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""

    # Google OAuth is handled by Supabase Auth; redirect URI is the frontend callback.
    google_redirect_uri: str = "http://localhost:5173/auth/google/callback"

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
        """Google sign-in is available when Supabase Auth credentials are set."""
        return bool(self.supabase_url and self.supabase_anon_key)

    @property
    def google_redirect_ready(self) -> bool:
        return self.google_enabled

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
