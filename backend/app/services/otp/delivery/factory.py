from app.core.config import get_settings
from app.services.otp.delivery.base import OtpDelivery
from app.services.otp.delivery.console import ConsoleOtpDelivery
from app.services.otp.delivery.msg91 import Msg91OtpDelivery
from app.services.otp.delivery.twilio import TwilioOtpDelivery

settings = get_settings()


def get_otp_delivery() -> OtpDelivery:
    provider = settings.otp_delivery.lower().strip()

    if provider == "msg91" and settings.msg91_enabled:
        return Msg91OtpDelivery()

    if provider == "twilio" and settings.twilio_enabled:
        return TwilioOtpDelivery()

    # Auto-prefer a real SMS channel when credentials exist and delivery is left on console by mistake
    if provider in {"", "console", "auto"}:
        if settings.twilio_enabled:
            return TwilioOtpDelivery()
        if settings.msg91_enabled:
            return Msg91OtpDelivery()

    return ConsoleOtpDelivery()
