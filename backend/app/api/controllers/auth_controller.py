from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password
from app.models.pending_signup import PendingSignup
from app.models.user import User
from app.schemas.auth import (
    AuthConfigResponse,
    AuthResponse,
    GoogleAuthRequest,
    LinkPhoneVerifyRequest,
    OTPRequest,
    OTPResponse,
    OTPVerify,
    PasswordSignupStartRequest,
    PasswordSignupVerifyRequest,
    PhonePasswordLoginRequest,
    ProfileUpdate,
    UserResponse,
)
from app.services.account_service import AccountLinkError, AccountService
from app.services.audit_service import AuditEventType, AuditService
from app.services.otp import OtpService
from app.services.phone_service import format_phone
from app.services.storage_service import StorageService
from app.services.supabase_auth import verify_supabase_google_user

settings = get_settings()
otp_service = OtpService()


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


class AuthController:
    @staticmethod
    def auth_config() -> AuthConfigResponse:
        return AuthConfigResponse(
            google_enabled=settings.google_enabled,
            google_redirect_ready=settings.google_redirect_ready,
            google_redirect_uri=settings.google_redirect_uri,
            sms_enabled=settings.sms_enabled,
            otp_delivery=settings.otp_delivery,
        )

    @staticmethod
    def signup_start(payload: PasswordSignupStartRequest, db: Session) -> OTPResponse:
        email = AccountService.assert_email_available(db, payload.email)
        phone = AccountService.assert_phone_available(db, payload.phone)

        # Also block if another pending signup holds this email
        existing_pending_email = (
            db.query(PendingSignup).filter(PendingSignup.email == email).first()
        )
        if existing_pending_email and existing_pending_email.phone != phone:
            if _aware(existing_pending_email.expires_at) > datetime.now(UTC):
                raise AccountLinkError(
                    "An account already exists for this email. Sign in instead.",
                    "account_exists",
                )

        hashed = hash_password(payload.password)
        expires_at = datetime.now(UTC) + timedelta(seconds=settings.otp_expire_seconds)
        pending = PendingSignup(
            phone=phone,
            name=payload.name.strip(),
            email=email,
            hashed_password=hashed,
            expires_at=expires_at,
        )
        db.merge(pending)
        db.commit()

        result = otp_service.send_otp(db, payload.phone)
        return OTPResponse(
            message=result.delivery.message,
            expires_in=result.expires_in,
            sms_sent=result.delivery.sent,
            delivery_channel=result.delivery.channel,
            dev_otp=result.dev_otp if settings.debug else None,
        )

    @staticmethod
    def signup_verify(payload: PasswordSignupVerifyRequest, db: Session) -> AuthResponse:
        phone = otp_service.verify_otp(db, payload.phone, payload.otp)
        formatted = format_phone(phone)
        pending = db.get(PendingSignup, formatted)
        if pending is None or _aware(pending.expires_at) < datetime.now(UTC):
            raise AccountLinkError(
                "Signup session expired. Please start again.",
                "signup_expired",
            )

        # Re-check uniqueness right before create
        if AccountService.find_by_email(db, pending.email) or AccountService.find_by_phone(db, phone):
            db.delete(pending)
            db.commit()
            raise AccountLinkError(
                "An account already exists for this email or phone number. Sign in instead.",
                "account_exists",
            )

        user = AccountService.create_password_user(
            db,
            name=pending.name,
            email=pending.email,
            phone=phone,
            hashed_password=pending.hashed_password,
        )
        db.delete(pending)
        AuditService.append(
            db,
            event_type=AuditEventType.LOGIN,
            user_id=user.id,
            entity_type="user",
            entity_id=user.id,
            new_value={"method": "password_signup", "phone": user.phone, "email": user.email},
        )
        db.commit()
        return AuthController._issue_session(user, is_new_user=True)

    @staticmethod
    def login_password(payload: PhonePasswordLoginRequest, db: Session) -> AuthResponse:
        user = AccountService.authenticate_password(db, payload.phone, payload.password)
        AuditService.append(
            db,
            event_type=AuditEventType.LOGIN,
            user_id=user.id,
            entity_type="user",
            entity_id=user.id,
            new_value={"method": "password", "phone": user.phone},
        )
        db.commit()
        return AuthController._issue_session(user)

    @staticmethod
    def send_otp(payload: OTPRequest, db: Session) -> OTPResponse:
        result = otp_service.send_otp(db, payload.phone)
        return OTPResponse(
            message=result.delivery.message,
            expires_in=result.expires_in,
            sms_sent=result.delivery.sent,
            delivery_channel=result.delivery.channel,
            dev_otp=result.dev_otp if settings.debug else None,
        )

    @staticmethod
    def verify_otp(payload: OTPVerify, db: Session) -> AuthResponse:
        """Legacy phone-OTP auth (kept for account linking helpers)."""
        phone = otp_service.verify_otp(db, payload.phone, payload.otp)
        user = AccountService.authenticate_phone(db, phone, payload.intent)
        AuditService.append(
            db,
            event_type=AuditEventType.LOGIN,
            user_id=user.id,
            entity_type="user",
            entity_id=user.id,
            new_value={"method": "phone_otp", "phone": user.phone, "intent": payload.intent},
        )
        db.commit()
        return AuthController._issue_session(user)

    @staticmethod
    def google_login(payload: GoogleAuthRequest, db: Session) -> AuthResponse:
        info = verify_supabase_google_user(payload.access_token)
        google_id = info.get("sub")
        email = info.get("email")
        name = info.get("name") or (email.split("@")[0] if email else "Google User")
        picture = info.get("picture")
        email_verified = bool(info.get("email_verified"))

        if not google_id:
            raise ValueError("Invalid Google token")

        user, is_new = AccountService.authenticate_google(
            db,
            intent="continue",
            google_id=google_id,
            email=email,
            name=name,
            picture=picture,
            email_verified=email_verified,
        )
        AuditService.append(
            db,
            event_type=AuditEventType.LOGIN,
            user_id=user.id,
            entity_type="user",
            entity_id=user.id,
            new_value={
                "method": "google",
                "email": user.email,
                "google_id": user.google_id,
                "is_new_user": is_new,
            },
        )
        db.commit()
        return AuthController._issue_session(user, is_new_user=is_new)

    @staticmethod
    def link_phone_send_otp(payload: OTPRequest, db: Session) -> OTPResponse:
        result = otp_service.send_otp(db, payload.phone)
        return OTPResponse(
            message=result.delivery.message,
            expires_in=result.expires_in,
            sms_sent=result.delivery.sent,
            delivery_channel=result.delivery.channel,
            dev_otp=result.dev_otp if settings.debug else None,
        )

    @staticmethod
    def link_phone_verify(payload: LinkPhoneVerifyRequest, user: User, db: Session) -> UserResponse:
        phone = otp_service.verify_otp(db, payload.phone, payload.otp)
        hashed = hash_password(payload.password) if payload.password else None
        linked = AccountService.link_phone(db, user, phone, hashed_password=hashed)
        return UserResponse.model_validate(linked)

    @staticmethod
    def link_google(payload: GoogleAuthRequest, user: User, db: Session) -> UserResponse:
        info = verify_supabase_google_user(payload.access_token)
        google_id = info.get("sub")
        email = info.get("email")
        name = info.get("name") or (email.split("@")[0] if email else "Google User")
        picture = info.get("picture")
        email_verified = bool(info.get("email_verified"))

        if not google_id:
            raise ValueError("Invalid Google token")

        linked = AccountService.link_google(
            db,
            user,
            google_id=google_id,
            email=email,
            name=name,
            picture=picture,
            email_verified=email_verified,
        )
        return UserResponse.model_validate(linked)

    @staticmethod
    def update_profile(payload: ProfileUpdate, user: User, db: Session) -> User:
        previous = {
            "name": user.name,
            "avatar_url": user.avatar_url,
            "profile_completed": user.profile_completed,
        }
        if payload.name is not None:
            user.name = payload.name.strip()
            user.profile_completed = True
        if payload.avatar_url is not None:
            new_url = payload.avatar_url.strip() or None
            if user.avatar_url and user.avatar_url != new_url:
                StorageService.delete_by_url(user.avatar_url)
            user.avatar_url = new_url
        if payload.name is None and payload.avatar_url is None:
            raise ValueError("At least one field must be provided")
        new_value = {
            "name": user.name,
            "avatar_url": user.avatar_url,
            "profile_completed": user.profile_completed,
        }
        AuditService.append(
            db,
            event_type=AuditEventType.PROFILE_UPDATED,
            user_id=user.id,
            entity_type="user",
            entity_id=user.id,
            previous_value=previous,
            new_value=new_value,
        )
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def upload_avatar(user: User, db: Session, data: bytes, filename: str, content_type: str | None) -> User:
        previous = {"avatar_url": user.avatar_url}
        public_url = StorageService.upload_file(
            data=data,
            filename=filename,
            content_type=content_type,
            folder=f"avatars/{user.id}",
        )
        if user.avatar_url:
            StorageService.delete_by_url(user.avatar_url)
        user.avatar_url = public_url
        AuditService.append(
            db,
            event_type=AuditEventType.PROFILE_UPDATED,
            user_id=user.id,
            entity_type="user",
            entity_id=user.id,
            previous_value=previous,
            new_value={"avatar_url": public_url, "source": "avatar_upload"},
        )
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def _issue_session(user: User, *, is_new_user: bool = False) -> AuthResponse:
        extra: dict = {}
        if user.phone:
            extra["phone"] = user.phone
        if user.email:
            extra["email"] = user.email
        token = create_access_token(str(user.id), extra or None)
        return AuthResponse(
            success=True,
            isNewUser=is_new_user,
            access_token=token,
            token=token,
            user=UserResponse.model_validate(user),
            needs_profile=not user.profile_completed,
        )
