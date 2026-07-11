import base64
import json
import logging
import secrets
from datetime import UTC, datetime
from urllib.parse import urlparse

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers.cose import COSEAlgorithmIdentifier
from webauthn.helpers.structs import (
    AuthenticatorAttachment,
    AuthenticatorSelectionCriteria,
    AuthenticatorTransport,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)
from webauthn.registration.verify_registration_response import VerifiedRegistration

from app.core.config import get_settings
from app.core.redis_client import RedisKeys, redis_client
from app.models.user import User
from app.models.webauthn_credential import WebAuthnCredential

logger = logging.getLogger("shieldai.biometric")
settings = get_settings()
CHALLENGE_TTL = 300


class BiometricAuthError(Exception):
    def __init__(self, message: str, code: str = "biometric_error") -> None:
        super().__init__(message)
        self.code = code


class BiometricAuthService:
    @staticmethod
    def _allowed_origins() -> list[str]:
        origins = list(settings.cors_origin_list)
        if settings.webauthn_origin not in origins:
            origins.append(settings.webauthn_origin)
        return origins

    @staticmethod
    def _allowed_rp_ids() -> set[str]:
        ids = {settings.webauthn_rp_id}
        for origin in BiometricAuthService._allowed_origins():
            host = urlparse(origin).hostname
            if host:
                ids.add(host)
        return ids

    @staticmethod
    def resolve_webauthn_context(origin: str | None, rp_id: str | None) -> tuple[str, list[str]]:
        allowed_origins = BiometricAuthService._allowed_origins()
        allowed_rp_ids = BiometricAuthService._allowed_rp_ids()

        if origin is not None and origin not in allowed_origins:
            raise BiometricAuthError("Invalid WebAuthn origin for this app.", "invalid_origin")
        if rp_id is not None and rp_id not in allowed_rp_ids:
            raise BiometricAuthError("Invalid WebAuthn domain for this app.", "invalid_rp_id")

        resolved_origin = origin or settings.webauthn_origin
        resolved_rp_id = rp_id or urlparse(resolved_origin).hostname or settings.webauthn_rp_id

        return resolved_rp_id, allowed_origins

    @staticmethod
    def _save_challenge(key: str, challenge: bytes, rp_id: str) -> None:
        payload = json.dumps({"challenge": base64.b64encode(challenge).decode("ascii"), "rp_id": rp_id})
        redis_client.setex(key, CHALLENGE_TTL, payload)

    @staticmethod
    def _load_challenge(key: str) -> tuple[bytes, str]:
        raw = redis_client.get(key)
        if raw is None:
            raise BiometricAuthError("Authentication session expired. Try again.", "challenge_expired")
        redis_client.delete(key)
        data = json.loads(raw)
        return base64.b64decode(data["challenge"]), data["rp_id"]

    @staticmethod
    def _platform_selection() -> AuthenticatorSelectionCriteria:
        return AuthenticatorSelectionCriteria(
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
            resident_key=ResidentKeyRequirement.REQUIRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        )

    @staticmethod
    def registration_options(user: User, db: Session, *, rp_id: str | None = None, origin: str | None = None) -> dict:
        resolved_rp_id, _ = BiometricAuthService.resolve_webauthn_context(origin, rp_id)

        existing = db.query(WebAuthnCredential).filter(WebAuthnCredential.user_id == user.id).all()
        exclude = [
            PublicKeyCredentialDescriptor(id=base64.urlsafe_b64decode(BiometricAuthService._pad_b64(c.credential_id)))
            for c in existing
        ]

        user_handle = str(user.id).encode("utf-8")
        user_name = user.email or user.phone or str(user.id)
        display_name = user.name or user_name

        options = generate_registration_options(
            rp_id=resolved_rp_id,
            rp_name=settings.webauthn_rp_name,
            user_id=user_handle,
            user_name=user_name,
            user_display_name=display_name,
            authenticator_selection=BiometricAuthService._platform_selection(),
            supported_pub_key_algs=[COSEAlgorithmIdentifier.ECDSA_SHA_256, COSEAlgorithmIdentifier.RSASSA_PKCS1_v1_5_SHA_256],
            exclude_credentials=exclude,
        )

        BiometricAuthService._save_challenge(RedisKeys.webauthn_register(str(user.id)), options.challenge, resolved_rp_id)
        logger.info("biometric_register_options user_id=%s rp_id=%s", user.id, resolved_rp_id)
        payload = json.loads(options_to_json(options))
        payload["rpId"] = resolved_rp_id
        return payload

    @staticmethod
    def verify_registration(
        user: User,
        db: Session,
        credential: dict,
        device_label: str | None,
        *,
        rp_id: str | None = None,
        origin: str | None = None,
    ) -> dict:
        challenge, stored_rp_id = BiometricAuthService._load_challenge(RedisKeys.webauthn_register(str(user.id)))
        resolved_rp_id, allowed_origins = BiometricAuthService.resolve_webauthn_context(origin, rp_id or stored_rp_id)
        if resolved_rp_id != stored_rp_id:
            raise BiometricAuthError("WebAuthn domain changed during registration.", "invalid_rp_id")

        try:
            verification: VerifiedRegistration = verify_registration_response(
                credential=credential,
                expected_challenge=challenge,
                expected_rp_id=resolved_rp_id,
                expected_origin=allowed_origins,
                require_user_verification=True,
            )
        except Exception as exc:
            logger.warning("biometric_register_verify_failed user_id=%s error=%s", user.id, exc)
            raise BiometricAuthError(
                "Could not register the passkey. Use the same browser URL you opened the app with (localhost vs 127.0.0.1).",
                "register_verify_failed",
            ) from exc

        cred_id_b64 = base64.urlsafe_b64encode(verification.credential_id).decode("ascii").rstrip("=")
        pub_key_b64 = base64.urlsafe_b64encode(verification.credential_public_key).decode("ascii").rstrip("=")

        record = WebAuthnCredential(
            user_id=user.id,
            credential_id=cred_id_b64,
            public_key=pub_key_b64,
            sign_count=verification.sign_count,
            device_label=(device_label or "This device").strip()[:120],
            transports=",".join(credential.get("response", {}).get("transports") or ["internal"]),
        )
        try:
            db.add(record)
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise BiometricAuthError(
                "This passkey is already registered.",
                "credential_exists",
            ) from exc
        logger.info("biometric_registered user_id=%s credential_id=%s rp_id=%s", user.id, cred_id_b64[:16], resolved_rp_id)
        return {"registered": True, "device_label": record.device_label, "credential_id": cred_id_b64}

    @staticmethod
    def login_options(
        *,
        credential_ids: list[str] | None = None,
        rp_id: str | None = None,
        origin: str | None = None,
    ) -> dict:
        resolved_rp_id, _ = BiometricAuthService.resolve_webauthn_context(origin, rp_id)
        session_id = secrets.token_urlsafe(16)

        allow_credentials: list[PublicKeyCredentialDescriptor] | None = None
        if credential_ids:
            allow_credentials = [
                PublicKeyCredentialDescriptor(
                    id=base64.urlsafe_b64decode(BiometricAuthService._pad_b64(cid)),
                    transports=[AuthenticatorTransport.INTERNAL, AuthenticatorTransport.HYBRID],
                )
                for cid in credential_ids
            ]

        options = generate_authentication_options(
            rp_id=resolved_rp_id,
            allow_credentials=allow_credentials,
            user_verification=UserVerificationRequirement.REQUIRED,
        )
        BiometricAuthService._save_challenge(RedisKeys.webauthn_login(session_id), options.challenge, resolved_rp_id)
        payload = json.loads(options_to_json(options))
        payload["session_id"] = session_id
        payload["rpId"] = resolved_rp_id
        logger.info(
            "biometric_login_options session_id=%s rp_id=%s credential_ids=%s",
            session_id,
            resolved_rp_id,
            len(credential_ids or []),
        )
        return payload

    @staticmethod
    def verify_login(
        db: Session,
        session_id: str,
        credential: dict,
        *,
        rp_id: str | None = None,
        origin: str | None = None,
    ) -> User:
        if not session_id:
            raise BiometricAuthError("Missing authentication session.", "missing_session")

        challenge, stored_rp_id = BiometricAuthService._load_challenge(RedisKeys.webauthn_login(session_id))
        resolved_rp_id, allowed_origins = BiometricAuthService.resolve_webauthn_context(origin, rp_id or stored_rp_id)
        if resolved_rp_id != stored_rp_id:
            raise BiometricAuthError("WebAuthn domain changed during authentication.", "invalid_rp_id")

        raw_id = credential.get("rawId") or credential.get("id")
        if not raw_id:
            raise BiometricAuthError("Invalid credential response.", "invalid_credential")

        cred_id_b64 = raw_id if isinstance(raw_id, str) else base64.urlsafe_b64encode(raw_id).decode("ascii").rstrip("=")
        stored = BiometricAuthService._find_credential(db, cred_id_b64)
        if stored is None:
            logger.warning("biometric_login_unknown_credential credential_id=%s...", cred_id_b64[:16])
            raise BiometricAuthError(
                "This passkey is not registered to an account. Sign in with phone or Google, then create a passkey in Profile.",
                "not_registered",
            )

        public_key = base64.urlsafe_b64decode(BiometricAuthService._pad_b64(stored.public_key))

        try:
            verification = verify_authentication_response(
                credential=credential,
                expected_challenge=challenge,
                expected_rp_id=resolved_rp_id,
                expected_origin=allowed_origins,
                credential_public_key=public_key,
                credential_current_sign_count=stored.sign_count,
                require_user_verification=True,
            )
        except Exception as exc:
            logger.warning("biometric_login_verify_failed user_id=%s error=%s", stored.user_id, exc)
            raise BiometricAuthError(
                "Passkey verification failed. Create a new passkey in Profile if the site URL changed.",
                "login_verify_failed",
            ) from exc

        stored.sign_count = verification.new_sign_count
        stored.last_used_at = datetime.now(UTC)
        db.commit()

        user = db.get(User, stored.user_id)
        if user is None or not user.is_active:
            raise BiometricAuthError("Account not found or inactive.", "user_inactive")

        logger.info("biometric_login_success user_id=%s", user.id)
        return user

    @staticmethod
    def _find_credential(db: Session, cred_id_b64: str) -> WebAuthnCredential | None:
        stored = db.query(WebAuthnCredential).filter(WebAuthnCredential.credential_id == cred_id_b64).first()
        if stored:
            return stored
        padded = BiometricAuthService._pad_b64(cred_id_b64)
        return db.query(WebAuthnCredential).filter(WebAuthnCredential.credential_id == padded).first()

    @staticmethod
    def user_status(user: User, db: Session) -> dict:
        count = db.query(WebAuthnCredential).filter(WebAuthnCredential.user_id == user.id).count()
        return {"registered": count > 0, "credential_count": count}

    @staticmethod
    def _pad_b64(value: str) -> str:
        padding = (4 - len(value) % 4) % 4
        return value + ("=" * padding)
