"""OTP heuristics for Android SMS bodies (no third-party SMS APIs)."""

from __future__ import annotations

import re

# Common bank / UPI / login OTP patterns (India + generic).
_OTP_HINT = re.compile(
    r"\b(otp|one[-\s]?time\s*(?:password|passcode|code)|verification\s*code|"
    r"auth(?:entication)?\s*code|security\s*code|passcode)\b",
    re.IGNORECASE,
)
_OTP_CODE = re.compile(
    r"(?<!\d)(\d{4,8})(?!\d)",
)
_OTP_LABELED = re.compile(
    r"(?:otp|code|passcode|password)\s*(?:is|:)?\s*(\d{4,8})",
    re.IGNORECASE,
)


def detect_otp(body: str) -> tuple[bool, str | None]:
    """Return (is_otp, otp_code) for an SMS body."""
    text = (body or "").strip()
    if not text:
        return False, None

    labeled = _OTP_LABELED.search(text)
    if labeled:
        return True, labeled.group(1)

    if _OTP_HINT.search(text):
        codes = _OTP_CODE.findall(text)
        # Prefer 6-digit codes (most common for banks).
        for code in codes:
            if len(code) == 6:
                return True, code
        if codes:
            return True, codes[0]
        return True, None

    return False, None
