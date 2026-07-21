from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.api.controllers.auth_controller import AuthController
from app.api.deps import get_current_user, security
from app.core.database import get_db
from app.core.security import revoke_access_token
from app.models.user import User
from app.schemas.auth import (
    AuthConfigResponse,
    AuthResponse,
    GoogleAuthRequest,
    OTPRequest,
    OTPResponse,
    OTPVerify,
    ProfileUpdate,
    UserResponse,
)
from app.schemas.preferences import UserPreferencesResponse, UserPreferencesUpdate
from app.services.account_service import AccountLinkError
from app.services.audit_service import AuditEventType, AuditService
from app.services.otp.exceptions import (
    InvalidOtpError,
    InvalidPhoneError,
    OtpExpiredError,
    OtpMismatchError,
)
from app.services.preference_service import PreferenceService
from app.services.storage_service import StorageError

router = APIRouter(prefix="/auth", tags=["auth"])


def _account_error_status(exc: AccountLinkError) -> int:
    # account_not_found is only used for phone login now; Google never emits it.
    if exc.code == "account_not_found":
        return status.HTTP_404_NOT_FOUND
    if exc.code == "account_inactive":
        return status.HTTP_403_FORBIDDEN
    return status.HTTP_409_CONFLICT


@router.get("/config", response_model=AuthConfigResponse)
def auth_config() -> AuthConfigResponse:
    return AuthController.auth_config()


@router.post("/otp/send", response_model=OTPResponse)
def send_otp(payload: OTPRequest, db: Session = Depends(get_db)) -> OTPResponse:
    try:
        return AuthController.send_otp(payload, db)
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
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        if "not configured" in str(exc).lower():
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google sign-in failed. Please try again.",
        ) from exc


@router.post("/link/phone/send-otp", response_model=OTPResponse)
def link_phone_send_otp(
    payload: OTPRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OTPResponse:
    if user.phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Your account already has a phone number.")
    try:
        return AuthController.link_phone_send_otp(payload, db)
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


@router.post("/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large (max 5MB)")
    try:
        return AuthController.upload_avatar(
            user,
            db,
            data=data,
            filename=file.filename or "avatar.bin",
            content_type=file.content_type,
        )
    except StorageError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


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
    db: Session = Depends(get_db),
) -> dict:
    revoke_access_token(db, credentials.credentials)
    AuditService.append(
        db,
        event_type=AuditEventType.LOGOUT,
        user_id=user.id,
        entity_type="user",
        entity_id=user.id,
        new_value={"ok": True},
    )
    db.commit()
    return {"ok": True}
