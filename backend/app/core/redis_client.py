import json
from typing import Any

import redis

from app.core.config import get_settings

settings = get_settings()
redis_client = redis.from_url(settings.redis_url, decode_responses=True)


class RedisKeys:
    @staticmethod
    def otp(phone: str) -> str:
        return f"otp:{phone}"

    @staticmethod
    def session(user_id: str) -> str:
        return f"session:{user_id}"

    @staticmethod
    def recent_transactions(user_id: str) -> str:
        return f"recent_tx:{user_id}"

    @staticmethod
    def velocity(user_id: str) -> str:
        return f"velocity:{user_id}"

    @staticmethod
    def cache(key: str) -> str:
        return f"cache:{key}"

    @staticmethod
    def webauthn_register(user_id: str) -> str:
        return f"webauthn:register:{user_id}"

    @staticmethod
    def webauthn_login(session_id: str) -> str:
        return f"webauthn:login:{session_id}"

    @staticmethod
    def revoked_token(jti: str) -> str:
        return f"auth:revoked:{jti}"


def set_json(key: str, value: Any, ttl: int | None = None) -> None:
    payload = json.dumps(value)
    if ttl:
        redis_client.setex(key, ttl, payload)
    else:
        redis_client.set(key, payload)


def get_json(key: str) -> Any | None:
    raw = redis_client.get(key)
    if raw is None:
        return None
    return json.loads(raw)
