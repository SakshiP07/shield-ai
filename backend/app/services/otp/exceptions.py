class InvalidPhoneError(ValueError):
    """Raised when the phone number fails validation."""


class InvalidOtpError(ValueError):
    """Raised when the OTP format is invalid."""


class OtpExpiredError(Exception):
    """Raised when no active OTP exists for the phone (missing or expired)."""


class OtpMismatchError(Exception):
    """Raised when the OTP does not match the stored value."""
