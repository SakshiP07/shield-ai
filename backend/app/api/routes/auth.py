from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.api.controllers.auth_controller import AuthController
from app.api.deps import get_current_user, security
from app.core.config import get_settings
from app.core.database import get_db
from app.core.redis_client import RedisKeys, redis_client
from app.core.security import revoke_access_token
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
from app.schemas.biometric import (
    BiometricLoginOptionsRequest,
    BiometricLoginVerifyRequest,
    BiometricRegisterVerifyRequest,
    BiometricRegisterResponse,
    BiometricStatusResponse,
)
from app.schemas.preferences import UserPreferencesResponse, UserPreferencesUpdate
from app.services.preference_service import PreferenceService
from app.services.account_service import AccountLinkError
from app.services.biometric_auth import BiometricAuthError, BiometricAuthService
from app.services.otp.exceptions import (
    InvalidOtpError,
    InvalidPhoneError,
    OtpExpiredError,
    OtpMismatchError,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _account_error_status(exc: AccountLinkError) -> int:
    if exc.code == "account_not_found":
        return status.HTTP_404_NOT_FOUND
    if exc.code == "account_inactive":
        return status.HTTP_403_FORBIDDEN
    return status.HTTP_409_CONFLICT


@router.get("/config", response_model=AuthConfigResponse)
def auth_config() -> AuthConfigResponse:
    return AuthController.auth_config()


@router.post("/otp/send", response_model=OTPResponse)
def send_otp(payload: OTPRequest) -> OTPResponse:
    try:
        return AuthController.send_otp(payload)
    except InvalidPhoneError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/otp/verify", response_model=AuthResponse)
def verify_otp_login(payload: OTPVerify, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        return AuthController.verify_otp(payload, db)
    except InvalidPhoneError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except InvalidOtpError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except OtpExpiredError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except OtpMismatchError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except AccountLinkError as exc:
        raise HTTPException(status_code=_account_error_status(exc), detail=str(exc)) from exc


@router.post("/google", response_model=AuthResponse)
def google_login(payload: GoogleAuthRequest, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        return AuthController.google_login(payload, db)
    except AccountLinkError as exc:
        raise HTTPException(status_code=_account_error_status(exc), detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except Exception as exc:
        if "not configured" in str(exc).lower():
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google sign-in failed. Please try again.",
        ) from exc


@router.post("/google/prepare", response_model=GoogleOAuthPrepareResponse)
def google_prepare(payload: GoogleOAuthPrepareRequest) -> GoogleOAuthPrepareResponse:
    try:
        return AuthController.google_prepare(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/google/exchange", response_model=GoogleOAuthExchangeResponse)
def google_exchange(payload: GoogleOAuthExchangeRequest) -> GoogleOAuthExchangeResponse:
    try:
        return AuthController.google_exchange(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/link/phone/send-otp", response_model=OTPResponse)
def link_phone_send_otp(payload: OTPRequest, user: User = Depends(get_current_user)) -> OTPResponse:
    if user.phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Your account already has a phone number.")
    try:
        return AuthController.link_phone_send_otp(payload)
    except InvalidPhoneError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/link/phone/verify", response_model=UserResponse)
def link_phone_verify(
    payload: OTPVerify,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    try:
        return AuthController.link_phone_verify(payload, user, db)
    except InvalidPhoneError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except InvalidOtpError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except OtpExpiredError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except OtpMismatchError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except AccountLinkError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/link/google", response_model=UserResponse)
def link_google(
    payload: GoogleAuthRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    if user.google_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Your account already has Google linked.")
    try:
        return AuthController.link_google(payload, user, db)
    except AccountLinkError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.patch("/profile", response_model=UserResponse)
def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    try:
        return AuthController.update_profile(payload, user, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/preferences", response_model=UserPreferencesResponse)
def get_preferences(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserPreferencesResponse:
    prefs = PreferenceService.get_or_create(db, user)
    return UserPreferencesResponse.model_validate(prefs)


@router.patch("/preferences", response_model=UserPreferencesResponse)
def update_preferences(
    payload: UserPreferencesUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPreferencesResponse:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No preference fields provided")
    prefs = PreferenceService.update(db, user, updates)
    return UserPreferencesResponse.model_validate(prefs)


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/logout")
def logout(
    user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    revoke_access_token(credentials.credentials)
    redis_client.delete(RedisKeys.session(str(user.id)))
    return {"ok": True}


@router.get("/biometric/status", response_model=BiometricStatusResponse)
def biometric_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BiometricStatusResponse:
    settings = get_settings()
    status = BiometricAuthService.user_status(user, db)
    return BiometricStatusResponse(server_enabled=settings.webauthn_enabled, **status)


@router.post("/biometric/register/options")
def biometric_register_options(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    payload: BiometricLoginOptionsRequest | None = None,
) -> dict:
    try:
        ctx = payload or BiometricLoginOptionsRequest()
        return BiometricAuthService.registration_options(user, db, rp_id=ctx.rp_id, origin=ctx.origin)
    except BiometricAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/biometric/register/verify", response_model=BiometricRegisterResponse)
def biometric_register_verify(
    payload: BiometricRegisterVerifyRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BiometricRegisterResponse:
    try:
        result = BiometricAuthService.verify_registration(
            user,
            db,
            payload.credential,
            payload.device_label,
            rp_id=payload.rp_id,
            origin=payload.origin,
        )
        return BiometricRegisterResponse(**result)
    except BiometricAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/biometric/login/options")
def biometric_login_options(payload: BiometricLoginOptionsRequest | None = None) -> dict:
    try:
        ctx = payload or BiometricLoginOptionsRequest()
        return BiometricAuthService.login_options(
            credential_ids=ctx.credential_ids,
            rp_id=ctx.rp_id,
            origin=ctx.origin,
        )
    except BiometricAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/biometric/login/verify", response_model=AuthResponse)
def biometric_login_verify(payload: BiometricLoginVerifyRequest, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        user = BiometricAuthService.verify_login(
            db,
            payload.session_id,
            payload.credential,
            rp_id=payload.rp_id,
            origin=payload.origin,
        )
        return AuthController._issue_session(user, extra={"auth": "biometric"})
    except BiometricAuthError as exc:
        code = status.HTTP_401_UNAUTHORIZED if exc.code in ("not_registered", "login_verify_failed") else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(exc)) from exc
