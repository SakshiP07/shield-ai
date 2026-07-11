from typing import Protocol

from app.services.otp.types import OtpDeliveryResult


class OtpDelivery(Protocol):
    """Swap this implementation to plug in MSG91, Twilio, etc."""

    def send_otp(self, phone: str, otp: str) -> OtpDeliveryResult: ...
