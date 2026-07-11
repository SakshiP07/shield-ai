import logging

from app.core.config import get_settings
from app.services.otp.types import OtpDeliveryResult
from app.services.phone_service import to_e164

logger = logging.getLogger(__name__)
settings = get_settings()


class ConsoleOtpDelivery:
    """Logs OTP to the server console — default for local / pre-SMS testing."""

    def send_otp(self, phone: str, otp: str) -> OtpDeliveryResult:
        e164 = to_e164(phone)
        logger.info(
            "OTP generated | phone=%s | otp=%s | expires_in=%ds",
            e164,
            otp,
            settings.otp_expire_seconds,
        )
        return OtpDeliveryResult(
            sent=False,
            channel="console",
            message="OTP generated. Check backend server logs for the code (testing mode).",
        )
