"""Unified account find-or-create and credential linking (Swiggy/Zomato-style)."""

import logging

from sqlalchemy.exc import IntegrityError
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
        if has_phone and has_google:
            user.auth_provider = "linked"
        elif has_google:
            user.auth_provider = "google"
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
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def _ensure_profile(db: Session, user: User) -> None:
        if user.behaviour_profile is None:
            db.add(BehaviourProfile(user_id=user.id))

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
    def _create_google_user(
        db: Session,
        *,
        google_id: str,
        email: str | None,
        name: str,
        given_name: str | None,
        family_name: str | None,
        picture: str | None,
        email_verified: bool,
        locale: str | None,
        hosted_domain: str | None,
    ) -> User:
        user = User(
            name=name,
            email=email,
            google_id=google_id,
            google_given_name=given_name,
            google_family_name=family_name,
            google_email_verified=email_verified,
            google_locale=locale,
            google_hosted_domain=hosted_domain,
            avatar_url=picture,
            auth_provider="google",
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
                "An account already exists for this Google identity. Sign in instead.",
                "account_exists",
            ) from exc
        logger.info("account_created method=google user_id=%s email=%s", user.id, email)
        return user

    @staticmethod
    def _apply_google_profile(
        user: User,
        *,
        google_id: str,
        email: str | None,
        name: str,
        given_name: str | None,
        family_name: str | None,
        picture: str | None,
        email_verified: bool,
        locale: str | None,
        hosted_domain: str | None,
    ) -> None:
        user.google_id = google_id
        if email:
            user.email = email
        user.google_given_name = given_name
        user.google_family_name = family_name
        user.google_email_verified = email_verified
        user.google_locale = locale
        user.google_hosted_domain = hosted_domain
        if picture:
            user.avatar_url = picture
        if name and (not user.name or user.name.strip() == ""):
            user.name = name
        if user.name and user.name.strip():
            user.profile_completed = True

    @staticmethod
    def login_or_register_phone(db: Session, phone: str) -> User:
        """Login screen: find by verified phone or create one account."""
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
        return AccountService.login_or_register_phone(db, phone)

    @staticmethod
    def login_or_register_google(
        db: Session,
        *,
        google_id: str,
        email: str | None,
        name: str,
        given_name: str | None,
        family_name: str | None,
        picture: str | None,
        email_verified: bool = False,
        locale: str | None = None,
        hosted_domain: str | None = None,
    ) -> User:
        """Login screen: find by google_id, then verified email, or create."""
        user = AccountService.find_by_google_id(db, google_id)
        if user:
            if not user.is_active:
                raise AccountLinkError("This account has been deactivated.", "account_inactive")
            AccountService._apply_google_profile(
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
            AccountService.sync_auth_provider(user)
            db.commit()
            db.refresh(user)
            logger.info("account_login method=google user_id=%s via=google_id", user.id)
            return user

        if email and email_verified:
            user = AccountService.find_by_email(db, email)
            if user:
                if not user.is_active:
                    raise AccountLinkError("This account has been deactivated.", "account_inactive")
                if user.google_id and user.google_id != google_id:
                    raise AccountLinkError(
                        "This email is linked to a different Google account. Sign in with the original method or contact support.",
                        "google_email_conflict",
                    )
                AccountService._apply_google_profile(
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
                AccountService.sync_auth_provider(user)
                db.commit()
                db.refresh(user)
                logger.info("account_login method=google user_id=%s via=email_link", user.id)
                return user

        return AccountService._create_google_user(
            db,
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

    @staticmethod
    def authenticate_google(db: Session, *, intent: str, **profile) -> User:
        google_id = profile["google_id"]
        email = profile.get("email")
        existing = AccountService.find_by_google_id(db, google_id)
        if not existing and email and profile.get("email_verified"):
            existing = AccountService.find_by_email(db, email)

        if intent == "signup" and existing:
            raise AccountLinkError(
                "An account already exists for this Google identity. Sign in instead.",
                "account_exists",
            )
        if intent == "login" and not existing:
            raise AccountLinkError(
                "No account exists for this Google identity. Create an account first.",
                "account_not_found",
            )
        return AccountService.login_or_register_google(db, **profile)

    @staticmethod
    def link_phone(db: Session, user: User, phone: str) -> User:
        """Profile: attach verified phone to the logged-in account."""
        formatted = _format_phone(phone)
        if user.phone == formatted:
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

    @staticmethod
    def link_google(
        db: Session,
        user: User,
        *,
        google_id: str,
        email: str | None,
        name: str,
        given_name: str | None,
        family_name: str | None,
        picture: str | None,
        email_verified: bool,
        locale: str | None,
        hosted_domain: str | None,
    ) -> User:
        """Profile: attach verified Google identity to the logged-in account."""
        if user.google_id == google_id:
            return user

        if user.google_id:
            raise AccountLinkError("Your account already has Google linked.", "google_already_linked")

        by_google = AccountService.find_by_google_id(db, google_id)
        if by_google and by_google.id != user.id:
            raise AccountLinkError(
                "This Google account is linked to another user. Sign in with Google directly or use a different account.",
                "google_linked_elsewhere",
            )

        if email:
            by_email = AccountService.find_by_email(db, email)
            if by_email and by_email.id != user.id:
                raise AccountLinkError(
                    "This Google email belongs to another account.",
                    "email_linked_elsewhere",
                )
            user.email = email

        user.google_id = google_id
        user.google_given_name = given_name
        user.google_family_name = family_name
        user.google_email_verified = email_verified
        user.google_locale = locale
        user.google_hosted_domain = hosted_domain
        if picture:
            user.avatar_url = picture
        if name and (not user.name or user.name.strip() == ""):
            user.name = name
        if user.name and user.name.strip():
            user.profile_completed = True

        AccountService.sync_auth_provider(user)
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
