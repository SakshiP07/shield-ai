import logging

from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

from app.core.config import get_settings
from app.services.otp.types import OtpDeliveryResult
from app.services.phone_service import normalize_phone

logger = logging.getLogger(__name__)
settings = get_settings()


class TwilioOtpDelivery:
    """Send login/signup OTPs via Twilio SMS. Enable with OTP_DELIVERY=twilio."""

    def send_otp(self, phone: str, otp: str) -> OtpDeliveryResult:
        if not settings.twilio_enabled:
            return OtpDeliveryResult(
                sent=False,
                channel="twilio",
                message="Twilio is not configured",
            )

# Prefer normalized E.164
        digits = normalize_phone(phone)
        raw = phone.strip()
        if raw.startswith("+"):
            to_number = f"+{''.join(ch for ch in raw if ch.isdigit())}"
        elif len(digits) == 10:
            to_number = f"+{settings.phone_country_code}{digits}"
        else:
            to_number = f"+{digits}"

        body = (
            f"Your ShieldAI verification code is {otp}. "
            f"It expires in {max(1, settings.otp_expire_seconds // 60)} minutes. Do not share this code."
        )

        try:
            client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
            message = client.messages.create(
                body=body,
                from_=settings.twilio_from_number,
                to=to_number,
            )
            logger.info("Twilio OTP sent to %s sid=%s", to_number, message.sid)
            return OtpDeliveryResult(
                sent=True,
                channel="twilio",
                message="OTP sent to your phone via SMS",
            )
        except TwilioRestException as exc:
            logger.exception("Twilio HTTP error for %s: %s", to_number, exc.msg)
            return OtpDeliveryResult(
                sent=False,
                channel="twilio",
                message=f"Twilio could not send SMS: {exc.msg}",
            )
        except Exception as exc:
            logger.exception("Twilio request failed for %s", to_number)
            return OtpDeliveryResult(
                sent=False,
                channel="twilio",
                message=f"Twilio request failed: {exc}",
            )
