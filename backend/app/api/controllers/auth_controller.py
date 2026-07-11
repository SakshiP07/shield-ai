from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.redis_client import RedisKeys, set_json
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.auth import (
    AuthConfigResponse,
    AuthResponse,
    GoogleAuthRequest,
    GoogleOAuthExchangeRequest,
    GoogleOAuthExchangeResponse,
    GoogleOAuthPrepareRequest,
    GoogleOAuthPrepareResponse,
    OTPRequest,
    OTPResponse,
    OTPVerify,
    ProfileUpdate,
    UserResponse,
)
from app.services.account_service import AccountLinkError, AccountService
from app.services.google_auth import verify_google_token
from app.services.google_oauth_flow import consume_oauth_state, exchange_authorization_code, prepare_oauth_state
from app.services.otp import OtpService

settings = get_settings()
otp_service = OtpService()


class AuthController:
    @staticmethod
    def auth_config() -> AuthConfigResponse:
        return AuthConfigResponse(
            google_enabled=settings.google_enabled,
            google_redirect_ready=settings.google_redirect_ready,
            google_redirect_uri=settings.google_redirect_uri,
            sms_enabled=settings.sms_enabled,
            otp_delivery=settings.otp_delivery,
            biometric_enabled=settings.webauthn_enabled,
        )

    @staticmethod
    def google_prepare(payload: GoogleOAuthPrepareRequest) -> GoogleOAuthPrepareResponse:
        if not settings.google_redirect_ready:
            raise ValueError(
                "Google redirect sign-in is not ready. Set GOOGLE_CLIENT_SECRET in backend/.env "
                "and add the redirect URI to Google Cloud Console."
            )
        state = prepare_oauth_state(intent=payload.intent, redirect_uri=payload.redirect_uri)
        return GoogleOAuthPrepareResponse(state=state)

    @staticmethod
    def google_exchange(payload: GoogleOAuthExchangeRequest) -> GoogleOAuthExchangeResponse:
        stored = consume_oauth_state(payload.state)
        if stored is None:
            raise ValueError("OAuth session expired or invalid. Please try again.")
        if stored.get("redirect_uri") != payload.redirect_uri:
            raise ValueError("Redirect URI mismatch.")
        if stored.get("intent") != payload.intent:
            raise ValueError("OAuth intent mismatch.")

        id_token = exchange_authorization_code(
            code=payload.code,
            redirect_uri=payload.redirect_uri,
            code_verifier=payload.code_verifier,
        )
        return GoogleOAuthExchangeResponse(id_token=id_token)

    @staticmethod
    def send_otp(payload: OTPRequest) -> OTPResponse:
        result = otp_service.send_otp(payload.phone)
        return OTPResponse(
            message=result.delivery.message,
            expires_in=result.expires_in,
            sms_sent=result.delivery.sent,
            delivery_channel=result.delivery.channel,
            dev_otp=result.dev_otp if settings.debug else None,
        )

    @staticmethod
    def verify_otp(payload: OTPVerify, db: Session) -> AuthResponse:
        phone = otp_service.verify_otp(payload.phone, payload.otp)
        user = AccountService.authenticate_phone(db, phone, payload.intent)
        return AuthController._issue_session(user, extra={"phone": user.phone})

    @staticmethod
    def google_login(payload: GoogleAuthRequest, db: Session) -> AuthResponse:
        info = verify_google_token(payload.id_token)
        google_id = info.get("sub")
        email = info.get("email")
        name = info.get("name") or (email.split("@")[0] if email else "Google User")
        given_name = info.get("given_name")
        family_name = info.get("family_name")
        picture = info.get("picture")
        email_verified = bool(info.get("email_verified"))
        locale = info.get("locale")
        hosted_domain = info.get("hd")

        if not google_id:
            raise ValueError("Invalid Google token")

        user = AccountService.authenticate_google(
            db,
            intent=payload.intent,
            google_id=google_id,
            email=email,
            name=name,
            given_name=given_name,
            family_name=family_name,
            picture=picture,
            email_verified=email_verified,
            locale=locale,
            hosted_domain=hosted_domain,
        )
        return AuthController._issue_session(user, extra={"email": user.email})

    @staticmethod
    def link_phone_send_otp(payload: OTPRequest) -> OTPResponse:
        result = otp_service.send_otp(payload.phone)
        return OTPResponse(
            message=result.delivery.message,
            expires_in=result.expires_in,
            sms_sent=result.delivery.sent,
            delivery_channel=result.delivery.channel,
            dev_otp=result.dev_otp if settings.debug else None,
        )

    @staticmethod
    def link_phone_verify(payload: OTPVerify, user: User, db: Session) -> UserResponse:
        phone = otp_service.verify_otp(payload.phone, payload.otp)
        linked = AccountService.link_phone(db, user, phone)
        return UserResponse.model_validate(linked)

    @staticmethod
    def link_google(payload: GoogleAuthRequest, user: User, db: Session) -> UserResponse:
        info = verify_google_token(payload.id_token)
        google_id = info.get("sub")
        email = info.get("email")
        name = info.get("name") or (email.split("@")[0] if email else "Google User")
        given_name = info.get("given_name")
        family_name = info.get("family_name")
        picture = info.get("picture")
        email_verified = bool(info.get("email_verified"))
        locale = info.get("locale")
        hosted_domain = info.get("hd")

        if not google_id or (email and not email_verified):
            raise ValueError("Invalid Google token")

        linked = AccountService.link_google(
            db,
            user,
            google_id=google_id,
            email=email,
            name=name,
            given_name=given_name,
            family_name=family_name,
            picture=picture,
            email_verified=email_verified,
            locale=locale,
            hosted_domain=hosted_domain,
        )
        return UserResponse.model_validate(linked)

    @staticmethod
    def update_profile(payload: ProfileUpdate, user: User, db: Session) -> User:
        if payload.name is not None:
            user.name = payload.name.strip()
            user.profile_completed = True
        if payload.avatar_url is not None:
            user.avatar_url = payload.avatar_url.strip() or None
        if payload.name is None and payload.avatar_url is None:
            raise ValueError("At least one field must be provided")
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def _issue_session(user: User, extra: dict | None = None) -> AuthResponse:
        token = create_access_token(str(user.id), extra or {})
        session_data = {"plan": user.plan}
        if user.phone:
            session_data["phone"] = user.phone
        if user.email:
            session_data["email"] = user.email
        set_json(
            RedisKeys.session(str(user.id)),
            session_data,
            ttl=settings.access_token_expire_minutes * 60,
        )
        return AuthResponse(
            access_token=token,
            user=UserResponse.model_validate(user),
            needs_profile=not user.profile_completed,
        )
