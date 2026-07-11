"""Verify Google ID tokens from the frontend."""

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.config import get_settings


def verify_google_token(token: str) -> dict:
    settings = get_settings()
    if not settings.google_client_id:
        raise ValueError("Google OAuth is not configured. Set GOOGLE_CLIENT_ID in .env")

    return id_token.verify_oauth2_token(token, google_requests.Request(), settings.google_client_id)
