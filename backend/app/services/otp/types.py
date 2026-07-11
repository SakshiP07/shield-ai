from dataclasses import dataclass
from enum import Enum


class OtpVerifyStatus(str, Enum):
    SUCCESS = "success"
    EXPIRED = "expired"
    MISMATCH = "mismatch"


@dataclass(frozen=True)
class OtpDeliveryResult:
    sent: bool
    channel: str
    message: str


@dataclass(frozen=True)
class SendOtpResult:
    phone: str
    expires_in: int
    delivery: OtpDeliveryResult
    dev_otp: str | None = None
