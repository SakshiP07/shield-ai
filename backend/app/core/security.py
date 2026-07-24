from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import bcrypt
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.revoked_token import RevokedToken

settings = get_settings()


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload: dict[str, Any] = {"sub": subject, "exp": expire, "jti": str(uuid4())}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def is_access_token_revoked(db: Session, payload: dict[str, Any]) -> bool:
    jti = payload.get("jti")
    if not jti:
        return False
    row = db.get(RevokedToken, str(jti))
    if row is None:
        return False
    if _aware(row.expires_at) < datetime.now(UTC):
        db.delete(row)
        db.commit()
        return False
    return True


def revoke_access_token(db: Session, token: str) -> bool:
    payload = decode_access_token(token)
    if payload is None or not payload.get("jti"):
        return False
    expires_at = datetime.fromtimestamp(int(payload.get("exp", 0)), tz=UTC)
    if expires_at <= datetime.now(UTC):
        return False
    existing = db.get(RevokedToken, str(payload["jti"]))
    if existing is None:
        db.add(RevokedToken(jti=str(payload["jti"]), expires_at=expires_at))
        db.commit()
    return True


def hash_password(password: str) -> str:
    digest = bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt())
    return digest.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False
