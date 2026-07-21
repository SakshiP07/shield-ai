import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.otp_code import OtpCode
from app.services.otp.exceptions import InvalidOtpError
from app.services.otp.types import OtpVerifyStatus

settings = get_settings()


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


class OtpStore:
    """PostgreSQL OTP store (replaces Redis otp:{phone}). Indexed by phone PK + expires_at."""

    def generate(self) -> str:
        return "".join(str(secrets.randbelow(10)) for _ in range(settings.otp_length))

    def save(self, db: Session, phone: str, otp: str) -> None:
        expires_at = datetime.now(UTC) + timedelta(seconds=settings.otp_expire_seconds)
        row = db.get(OtpCode, phone)
        if row is None:
            db.add(OtpCode(phone=phone, code=otp, expires_at=expires_at))
        else:
            row.code = otp
            row.expires_at = expires_at
        db.commit()

    def verify(self, db: Session, phone: str, otp: str) -> OtpVerifyStatus:
        self._validate_otp_format(otp)

        row = db.get(OtpCode, phone)
        if row is None:
            return OtpVerifyStatus.EXPIRED

        if _aware(row.expires_at) < datetime.now(UTC):
            db.delete(row)
            db.commit()
            return OtpVerifyStatus.EXPIRED

        if row.code != otp.strip():
            return OtpVerifyStatus.MISMATCH

        db.delete(row)
        db.commit()
        return OtpVerifyStatus.SUCCESS

    def _validate_otp_format(self, otp: str) -> None:
        cleaned = otp.strip()
        if not cleaned.isdigit():
            raise InvalidOtpError("OTP must contain digits only")
        if len(cleaned) != settings.otp_length:
            raise InvalidOtpError(f"OTP must be {settings.otp_length} digits")
