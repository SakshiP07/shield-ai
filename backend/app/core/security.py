from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import redis
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings
from app.core.redis_client import RedisKeys, redis_client

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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


def is_access_token_revoked(payload: dict[str, Any]) -> bool:
    jti = payload.get("jti")
    if not jti:
        return False
    try:
        return bool(redis_client.exists(RedisKeys.revoked_token(str(jti))))
    except redis.RedisError:
        # Fail open if Redis is temporarily unavailable — do not lock users out.
        return False


def revoke_access_token(token: str) -> bool:
    payload = decode_access_token(token)
    if payload is None or not payload.get("jti"):
        return False
    expires_at = int(payload.get("exp", 0))
    ttl = max(expires_at - int(datetime.now(UTC).timestamp()), 1)
    redis_client.setex(RedisKeys.revoked_token(str(payload["jti"])), ttl, "1")
    return True


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)
