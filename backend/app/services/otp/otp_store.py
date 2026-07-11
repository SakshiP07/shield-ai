import secrets

from app.core.config import get_settings
from app.core.redis_client import RedisKeys, redis_client
from app.services.otp.exceptions import InvalidOtpError
from app.services.otp.types import OtpVerifyStatus

settings = get_settings()


class OtpStore:
    def generate(self) -> str:
        return "".join(str(secrets.randbelow(10)) for _ in range(settings.otp_length))

    def save(self, phone: str, otp: str) -> None:
        redis_client.setex(RedisKeys.otp(phone), settings.otp_expire_seconds, otp)

    def verify(self, phone: str, otp: str) -> OtpVerifyStatus:
        self._validate_otp_format(otp)

        stored = redis_client.get(RedisKeys.otp(phone))
        if stored is None:
            return OtpVerifyStatus.EXPIRED
        if stored != otp.strip():
            return OtpVerifyStatus.MISMATCH

        redis_client.delete(RedisKeys.otp(phone))
        return OtpVerifyStatus.SUCCESS

    def _validate_otp_format(self, otp: str) -> None:
        cleaned = otp.strip()
        if not cleaned.isdigit():
            raise InvalidOtpError("OTP must contain digits only")
        if len(cleaned) != settings.otp_length:
            raise InvalidOtpError(f"OTP must be {settings.otp_length} digits")
