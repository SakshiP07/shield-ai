"""Google OAuth 2.0 authorization-code flow (redirect + PKCE)."""

import json
import secrets
import urllib.error
import urllib.parse
import urllib.request

from app.core.config import get_settings
from app.core.redis_client import redis_client
from app.services.google_auth import verify_google_token

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


def prepare_oauth_state(*, intent: str, redirect_uri: str) -> str:
    state = secrets.token_urlsafe(32)
    redis_client.setex(
        f"google_oauth:{state}",
        600,
        json.dumps({"intent": intent, "redirect_uri": redirect_uri}),
    )
    return state


def consume_oauth_state(state: str) -> dict | None:
    raw = redis_client.get(f"google_oauth:{state}")
    if not raw:
        return None
    redis_client.delete(f"google_oauth:{state}")
    return json.loads(raw)


def exchange_authorization_code(*, code: str, redirect_uri: str, code_verifier: str) -> str:
    settings = get_settings()
    if not settings.google_client_id:
        raise ValueError("Google OAuth is not configured. Set GOOGLE_CLIENT_ID in backend/.env")
    if not settings.google_client_secret:
        raise ValueError(
            "Google redirect sign-in requires GOOGLE_CLIENT_SECRET in backend/.env "
            "(Google Cloud Console → OAuth client → Client secret)."
        )

    body = urllib.parse.urlencode(
        {
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
            "code_verifier": code_verifier,
        }
    ).encode()

    req = urllib.request.Request(
        GOOGLE_TOKEN_URL,
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            payload = json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode() if exc.fp else str(exc)
        raise ValueError(f"Google token exchange failed: {detail}") from exc

    id_token = payload.get("id_token")
    if not id_token:
        raise ValueError("Google did not return an id_token")
    verify_google_token(id_token)
    return id_token
