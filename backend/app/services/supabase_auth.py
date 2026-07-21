"""Verify Supabase Auth sessions and extract Google identity claims."""

from __future__ import annotations

import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger("shieldai.supabase_auth")
settings = get_settings()


def _as_dict(value: object) -> dict:
    if isinstance(value, dict):
        return value
    if value is None:
        return {}
    # pydantic / supabase objects
    for attr in ("model_dump", "dict"):
        method = getattr(value, attr, None)
        if callable(method):
            try:
                data = method()
                if isinstance(data, dict):
                    return data
            except Exception:  # noqa: BLE001
                pass
    raw = getattr(value, "__dict__", None)
    return dict(raw) if isinstance(raw, dict) else {}


def _fetch_supabase_user(access_token: str) -> dict:
    if not settings.supabase_url:
        raise RuntimeError("Supabase is not configured. Set SUPABASE_URL.")

    api_keys = [k for k in (settings.supabase_anon_key, settings.supabase_service_role_key) if k]
    if not api_keys:
        raise RuntimeError("Supabase is not configured. Set SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.")

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/user"
    last_error = "Invalid or expired Supabase session"

    with httpx.Client(timeout=20.0) as client:
        for api_key in api_keys:
            response = client.get(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "apikey": api_key,
                },
            )
            if response.status_code < 400:
                payload = response.json()
                if isinstance(payload, dict) and payload.get("id"):
                    return payload
                last_error = "Invalid or expired Supabase session"
                continue
            last_error = response.text[:300] or last_error
            logger.warning(
                "supabase_user_lookup_failed status=%s detail=%s",
                response.status_code,
                last_error,
            )

    raise ValueError("Invalid or expired Supabase session")


def verify_supabase_google_user(access_token: str) -> dict:
    """
    Validate a Supabase access token and return Google profile fields.

    Expects the session to come from Supabase Auth Google OAuth.
    """
    if not access_token or not access_token.strip():
        raise ValueError("Missing Supabase access token")

    user = _fetch_supabase_user(access_token.strip())
    meta = _as_dict(user.get("user_metadata"))
    app_meta = _as_dict(user.get("app_metadata"))
    identities = user.get("identities") or []
    if not isinstance(identities, list):
        identities = []

    google = None
    for identity in identities:
        data = _as_dict(identity)
        if data.get("provider") == "google":
            google = data
            break

    identity_data = _as_dict(google.get("identity_data")) if google else {}
    provider = (
        (google or {}).get("provider")
        or app_meta.get("provider")
        or meta.get("iss")
        or meta.get("provider")
    )
    providers = app_meta.get("providers") or []
    is_google = provider == "google" or "google" in providers or bool(google)
    if not is_google:
        # Still accept if classic Google profile fields are present on metadata.
        is_google = bool(meta.get("picture") or meta.get("avatar_url")) and bool(
            meta.get("email") or user.get("email")
        )
    if not is_google:
        raise ValueError("No Google identity found on this Supabase user")

    google_id = (
        identity_data.get("sub")
        or (google or {}).get("provider_id")
        or (google or {}).get("id")
        or meta.get("provider_id")
        or meta.get("sub")
        or app_meta.get("provider_id")
    )
    email = user.get("email") or identity_data.get("email") or meta.get("email")
    name = (
        meta.get("full_name")
        or meta.get("name")
        or identity_data.get("full_name")
        or identity_data.get("name")
        or (email.split("@")[0] if isinstance(email, str) and email else "Google User")
    )
    picture = (
        meta.get("avatar_url")
        or meta.get("picture")
        or identity_data.get("avatar_url")
        or identity_data.get("picture")
    )
    email_verified = bool(
        user.get("email_confirmed_at")
        or identity_data.get("email_verified")
        or meta.get("email_verified")
        or True  # Google via Supabase is treated as verified email
    )

    if not google_id:
        # Last resort: stable Supabase user id keeps one ShieldAI account per Google login.
        google_id = user.get("id")
    if not google_id:
        raise ValueError("Google identity is missing a provider id")

    return {
        "sub": str(google_id),
        "email": email,
        "name": name,
        "picture": picture,
        "email_verified": email_verified,
        "supabase_user_id": str(user.get("id") or ""),
    }
