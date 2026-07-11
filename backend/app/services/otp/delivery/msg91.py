import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from app.core.config import get_settings
from app.services.otp.types import OtpDeliveryResult
from app.services.phone_service import normalize_phone

logger = logging.getLogger(__name__)
settings = get_settings()

MSG91_OTP_URL = "https://control.msg91.com/api/v5/otp"


class Msg91OtpDelivery:
    """MSG91 SendOTP v5 — plug in by setting OTP_DELIVERY=msg91 in .env."""

    def send_otp(self, phone: str, otp: str) -> OtpDeliveryResult:
        mobile = f"{settings.phone_country_code}{normalize_phone(phone)}"
        otp_expiry_min = max(1, settings.otp_expire_seconds // 60)

        params = urllib.parse.urlencode(
            {
                "template_id": settings.msg91_template_id,
                "mobile": mobile,
                "otp": otp,
                "otp_length": settings.otp_length,
                "otp_expiry": otp_expiry_min,
            }
        )
        url = f"{MSG91_OTP_URL}?{params}"
        request = urllib.request.Request(
            url,
            method="POST",
            data=b"{}",
            headers={
                "authkey": settings.msg91_auth_key,
                "Content-Type": "application/json",
            },
        )

        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                body = json.loads(response.read().decode())
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode() if exc.fp else str(exc)
            logger.exception("MSG91 HTTP error for %s: %s", mobile, detail)
            return OtpDeliveryResult(sent=False, channel="msg91", message=f"MSG91 request failed: {detail}")
        except Exception as exc:
            logger.exception("MSG91 request failed for %s", mobile)
            return OtpDeliveryResult(sent=False, channel="msg91", message=f"MSG91 request failed: {exc}")

        if body.get("type") == "success":
            logger.info("MSG91 OTP sent to %s", mobile)
            return OtpDeliveryResult(sent=True, channel="msg91", message="OTP sent to your phone via SMS")

        message = body.get("message") or body.get("errors") or str(body)
        logger.error("MSG91 OTP failed for %s: %s", mobile, message)
        return OtpDeliveryResult(sent=False, channel="msg91", message=f"MSG91 could not send SMS: {message}")
