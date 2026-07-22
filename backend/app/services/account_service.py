"""Unified account find-or-create and credential linking.

One real person → one user row. Phone and Google can both live on the same record.
"""

from __future__ import annotations

import logging

from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.behaviour_profile import BehaviourProfile
from app.models.user import User

logger = logging.getLogger("shieldai.account")


def _format_phone(phone: str) -> str:
    from app.services.phone_service import format_phone

    return format_phone(phone)


class AccountLinkError(Exception):
    def __init__(self, message: str, code: str = "account_link_error") -> None:
        super().__init__(message)
        self.code = code


class AccountService:
    @staticmethod
    def sync_auth_provider(user: User) -> None:
        has_phone = bool(user.phone)
        has_google = bool(user.google_id)
        has_password = bool(user.hashed_password)
        if has_google and (has_phone or has_password):
            user.auth_provider = "linked"
        elif has_google:
            user.auth_provider = "google"
        elif has_password:
            user.auth_provider = "password"
        elif has_phone:
            user.auth_provider = "phone"

    @staticmethod
    def find_by_phone(db: Session, phone: str) -> User | None:
        formatted = _format_phone(phone)
        return db.query(User).filter(User.phone == formatted).first()

    @staticmethod
    def find_by_google_id(db: Session, google_id: str) -> User | None:
        return db.query(User).filter(User.google_id == google_id).first()

    @staticmethod
    def find_by_email(db: Session, email: str | None) -> User | None:
        if not email:
            return None
        normalized = email.strip().lower()
        if not normalized:
            return None
        return db.query(User).filter(func.lower(User.email) == normalized).first()

    @staticmethod
    def _normalize_email(email: str | None) -> str | None:
        if not email:
            return None
        normalized = email.strip().lower()
        return normalized or None

    @staticmethod
    def _ensure_profile(db: Session, user: User) -> None:
        if user.behaviour_profile is None:
            db.add(BehaviourProfile(user_id=user.id))

    @staticmethod
    def assert_email_available(db: Session, email: str) -> str:
        normalized = AccountService._normalize_email(email)
        if not normalized:
            raise AccountLinkError("Email is required.", "invalid_email")
        if AccountService.find_by_email(db, normalized):
            raise AccountLinkError(
                "An account already exists for this email. Sign in instead.",
                "account_exists",
            )
        return normalized

    @staticmethod
    def assert_phone_available(db: Session, phone: str) -> str:
        formatted = _format_phone(phone)
        if AccountService.find_by_phone(db, phone):
            raise AccountLinkError(
                "An account already exists for this phone number. Sign in instead.",
                "account_exists",
            )
        return formatted

    @staticmethod
    def create_password_user(
        db: Session,
        *,
        name: str,
        email: str,
        phone: str,
        hashed_password: str,
    ) -> User:
        formatted = _format_phone(phone)
        normalized_email = AccountService._normalize_email(email)
        user = User(
            name=name.strip(),
            email=normalized_email,
            phone=formatted,
            hashed_password=hashed_password,
            auth_provider="password",
            phone_verified=True,
            email_verified=False,
            profile_completed=True,
            plan="Premium Shield",
        )
        try:
            db.add(user)
            db.flush()
            AccountService._ensure_profile(db, user)
            db.commit()
            db.refresh(user)
        except IntegrityError as exc:
            db.rollback()
            raise AccountLinkError(
                "An account already exists for this email or phone number. Sign in instead.",
                "account_exists",
            ) from exc
        logger.info("account_created method=password user_id=%s email=%s", user.id, normalized_email)
        return user

    @staticmethod
    def authenticate_password(db: Session, phone: str, password: str) -> User:
        from app.core.security import verify_password

        user = AccountService.find_by_phone(db, phone)
        if not user or not user.hashed_password:
            raise AccountLinkError("Invalid phone number or password.", "invalid_credentials")
        if not user.is_active:
            raise AccountLinkError("This account has been deactivated.", "account_inactive")
        if not verify_password(password, user.hashed_password):
            raise AccountLinkError("Invalid phone number or password.", "invalid_credentials")
        logger.info("account_login method=password user_id=%s", user.id)
        return user

    @staticmethod
    def _create_phone_user(db: Session, phone: str) -> User:
        formatted = _format_phone(phone)
        user = User(
            name="",
            phone=formatted,
            auth_provider="phone",
            profile_completed=False,
            plan="Premium Shield",
        )
        try:
            db.add(user)
            db.flush()
            AccountService._ensure_profile(db, user)
            db.commit()
            db.refresh(user)
        except IntegrityError as exc:
            db.rollback()
            raise AccountLinkError(
                "An account already exists for this phone number. Sign in instead.",
                "account_exists",
            ) from exc
        logger.info("account_created method=phone user_id=%s phone=%s", user.id, formatted)
        return user

    @staticmethod
    def _apply_google_profile(
        user: User,
        *,
        google_id: str,
        email: str | None,
        name: str,
        picture: str | None,
    ) -> None:
        user.google_id = google_id
        normalized_email = AccountService._normalize_email(email)
        if normalized_email:
            user.email = normalized_email
        if picture:
            user.avatar_url = picture
        if name and (not user.name or not user.name.strip()):
            user.name = name
        if user.name and user.name.strip():
            user.profile_completed = True
        user.email_verified = True
        AccountService.sync_auth_provider(user)

    @staticmethod
    def _create_google_user(
        db: Session,
        *,
        google_id: str,
        email: str | None,
        name: str,
        picture: str | None,
    ) -> tuple[User, bool]:
        normalized_email = AccountService._normalize_email(email)
        user = User(
            name=name or (normalized_email.split("@")[0] if normalized_email else "Google User"),
            email=normalized_email,
            google_id=google_id,
            avatar_url=picture,
            auth_provider="google",
            email_verified=True,
            phone_verified=False,
            profile_completed=True,
            plan="Premium Shield",
        )
        try:
            db.add(user)
            db.flush()
            AccountService._ensure_profile(db, user)
            db.commit()
            db.refresh(user)
        except IntegrityError as exc:
            db.rollback()
            # Race: another request created the same google_id/email — reuse that row.
            existing = AccountService.find_by_google_id(db, google_id)
            if not existing and normalized_email:
                existing = AccountService.find_by_email(db, normalized_email)
            if existing:
                AccountService._apply_google_profile(
                    existing, google_id=google_id, email=normalized_email, name=name, picture=picture
                )
                db.commit()
                db.refresh(existing)
                logger.info("account_created_race_resolved method=google user_id=%s", existing.id)
                return existing, False
            raise AccountLinkError(
                "An account already exists for this Google identity. Sign in instead.",
                "account_exists",
            ) from exc
        logger.info("account_created method=google user_id=%s email=%s", user.id, normalized_email)
        return user, True

    # ── Phone OTP ──────────────────────────────────────────────────────────

    @staticmethod
    def login_or_register_phone(db: Session, phone: str) -> User:
        """Find by verified phone or create one account (never duplicates)."""
        user = AccountService.find_by_phone(db, phone)
        if user:
            if not user.is_active:
                raise AccountLinkError("This account has been deactivated.", "account_inactive")
            logger.info("account_login method=phone user_id=%s", user.id)
            return user
        return AccountService._create_phone_user(db, phone)

    @staticmethod
    def authenticate_phone(db: Session, phone: str, intent: str) -> User:
        user = AccountService.find_by_phone(db, phone)
        if intent == "signup":
            if user:
                raise AccountLinkError(
                    "An account already exists for this phone number. Sign in instead.",
                    "account_exists",
                )
            return AccountService._create_phone_user(db, phone)
        if intent == "login":
            if not user:
                raise AccountLinkError(
                    "No account exists for this phone number. Create an account first.",
                    "account_not_found",
                )
            if not user.is_active:
                raise AccountLinkError("This account has been deactivated.", "account_inactive")
            return user
        # continue — find or create
        return AccountService.login_or_register_phone(db, phone)

    @staticmethod
    def link_phone(
        db: Session,
        user: User,
        phone: str,
        *,
        hashed_password: str | None = None,
    ) -> User:
        """Attach verified phone (and optional password) to the logged-in account."""
        formatted = _format_phone(phone)
        if user.phone == formatted:
            if hashed_password and not user.hashed_password:
                user.hashed_password = hashed_password
                AccountService.sync_auth_provider(user)
                db.commit()
                db.refresh(user)
            return user

        if user.phone:
            raise AccountLinkError("Your account already has a phone number linked.", "phone_already_linked")

        existing = AccountService.find_by_phone(db, phone)
        if existing and existing.id != user.id:
            raise AccountLinkError(
                "This phone number is linked to another account. Sign in with that number or use a different phone.",
                "phone_linked_elsewhere",
            )

        user.phone = formatted
        user.phone_verified = True
        if hashed_password:
            user.hashed_password = hashed_password
        AccountService.sync_auth_provider(user)
        if user.name and user.name.strip():
            user.profile_completed = True
        try:
            db.commit()
            db.refresh(user)
        except IntegrityError as exc:
            db.rollback()
            raise AccountLinkError(
                "This phone number is linked to another account.",
                "phone_linked_elsewhere",
            ) from exc

        logger.info("account_linked type=phone user_id=%s phone=%s", user.id, formatted)
        return user

    # ── Google OAuth ───────────────────────────────────────────────────────

    @staticmethod
    def login_or_register_google(
        db: Session,
        *,
        google_id: str,
        email: str | None,
        name: str,
        picture: str | None,
        email_verified: bool = True,
    ) -> tuple[User, bool]:
        """
        Dedup order (never duplicates):
        1. Match google_id → login (+ refresh profile)
        2. Match email → link Google onto that row
        3. Else create new user

        Returns (user, is_new_user).
        """
        _ = email_verified  # Google via Supabase is treated as trusted for linking
        normalized_email = AccountService._normalize_email(email)

        user = AccountService.find_by_google_id(db, google_id)
        if user:
            if not user.is_active:
                raise AccountLinkError("This account has been deactivated.", "account_inactive")
            AccountService._apply_google_profile(
                user, google_id=google_id, email=normalized_email, name=name, picture=picture
            )
            db.commit()
            db.refresh(user)
            logger.info("account_login method=google user_id=%s via=google_id", user.id)
            return user, False

        if normalized_email:
            user = AccountService.find_by_email(db, normalized_email)
            if user:
                if not user.is_active:
                    raise AccountLinkError("This account has been deactivated.", "account_inactive")
                if user.google_id and user.google_id != google_id:
                    raise AccountLinkError(
                        "This email is linked to a different Google account.",
                        "google_email_conflict",
                    )
                AccountService._apply_google_profile(
                    user, google_id=google_id, email=normalized_email, name=name, picture=picture
                )
                db.commit()
                db.refresh(user)
                logger.info("account_login method=google user_id=%s via=email_link", user.id)
                return user, False

        created, is_new = AccountService._create_google_user(
            db, google_id=google_id, email=normalized_email, name=name, picture=picture
        )
        return created, is_new

    @staticmethod
    def authenticate_google(
        db: Session,
        *,
        intent: str = "continue",
        google_id: str,
        email: str | None,
        name: str,
        picture: str | None,
        email_verified: bool = True,
    ) -> tuple[User, bool]:
        """
        Google OAuth is always find-or-create (login and signup share the same path).

        Intent is accepted for API compatibility but never blocks account creation.
        """
        _ = intent
        return AccountService.login_or_register_google(
            db,
            google_id=google_id,
            email=email,
            name=name,
            picture=picture,
            email_verified=email_verified,
        )

    @staticmethod
    def link_google(
        db: Session,
        user: User,
        *,
        google_id: str,
        email: str | None,
        name: str,
        picture: str | None,
        email_verified: bool = True,
    ) -> User:
        """Attach verified Google identity to the logged-in account (same user id)."""
        normalized_email = AccountService._normalize_email(email)
        if user.google_id == google_id:
            return user

        if user.google_id:
            raise AccountLinkError("Your account already has Google linked.", "google_already_linked")

        by_google = AccountService.find_by_google_id(db, google_id)
        if by_google and by_google.id != user.id:
            raise AccountLinkError(
                "This Google account is linked to another user.",
                "google_linked_elsewhere",
            )

        if normalized_email:
            by_email = AccountService.find_by_email(db, normalized_email)
            if by_email and by_email.id != user.id:
                raise AccountLinkError(
                    "This Google email belongs to another account.",
                    "email_linked_elsewhere",
                )

        AccountService._apply_google_profile(
            user, google_id=google_id, email=normalized_email, name=name, picture=picture
        )
        try:
            db.commit()
            db.refresh(user)
        except IntegrityError as exc:
            db.rollback()
            raise AccountLinkError(
                "This Google account is linked to another user.",
                "google_linked_elsewhere",
            ) from exc

        logger.info("account_linked type=google user_id=%s google_id=%s...", user.id, google_id[:12])
        return user
