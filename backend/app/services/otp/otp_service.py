from app.core.config import get_settings
from app.services.otp.delivery.factory import get_otp_delivery
from app.services.otp.exceptions import OtpExpiredError, OtpMismatchError
from app.services.otp.otp_store import OtpStore
from app.services.otp.types import OtpVerifyStatus, SendOtpResult
from app.services.phone_service import normalize_phone
from sqlalchemy.orm import Session

settings = get_settings()


class OtpService:
    def __init__(self, store: OtpStore | None = None, delivery=None) -> None:
        self._store = store or OtpStore()
        self._delivery = delivery or get_otp_delivery()

    def send_otp(self, db: Session, phone: str) -> SendOtpResult:
        normalized = normalize_phone(phone)
        otp = self._store.generate()
        self._store.save(db, normalized, otp)
        delivery_result = self._delivery.send_otp(normalized, otp)
        return SendOtpResult(
            phone=normalized,
            expires_in=settings.otp_expire_seconds,
            delivery=delivery_result,
            dev_otp=otp if delivery_result.channel == "console" else None,
        )

    def verify_otp(self, db: Session, phone: str, otp: str) -> str:
        normalized = normalize_phone(phone)
        status = self._store.verify(db, normalized, otp)

        if status is OtpVerifyStatus.EXPIRED:
            raise OtpExpiredError("OTP expired or not found. Request a new code.")
        if status is OtpVerifyStatus.MISMATCH:
            raise OtpMismatchError("Incorrect OTP. Please try again.")

        return normalized
