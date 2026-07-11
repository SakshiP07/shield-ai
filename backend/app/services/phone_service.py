import re

from app.core.config import get_settings
from app.services.otp.exceptions import InvalidPhoneError

settings = get_settings()


def normalize_phone(phone: str) -> str:
    """Return the last N digits for the configured national number length."""
    digits = re.sub(r"\D", "", phone.strip())
    required = settings.phone_number_length

    if len(digits) < required:
        raise InvalidPhoneError(f"Enter a valid {required}-digit phone number")

    normalized = digits[-required:]
    if not normalized.isdigit():
        raise InvalidPhoneError(f"Enter a valid {required}-digit phone number")

    return normalized


def format_phone(phone: str) -> str:
    """Human-readable display format, e.g. +91 98765 43210."""
    digits = normalize_phone(phone)
    cc = settings.phone_country_code
    midpoint = settings.phone_number_length // 2
    return f"+{cc} {digits[:midpoint]} {digits[midpoint:]}"


def to_e164(phone: str) -> str:
    """E.164 format without spaces, e.g. +919876543210."""
    digits = normalize_phone(phone)
    return f"+{settings.phone_country_code}{digits}"
