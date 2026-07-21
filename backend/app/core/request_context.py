"""Request-scoped audit context (IP, UA, request id, device/platform)."""

from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_request_context: ContextVar[RequestAuditContext | None] = ContextVar("request_audit_context", default=None)


@dataclass(frozen=True, slots=True)
class RequestAuditContext:
    request_id: str
    ip_address: str | None
    user_agent: str | None
    device: str | None
    platform: str | None


def get_request_audit_context() -> RequestAuditContext | None:
    return _request_context.get()


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or None
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip() or None
    if request.client:
        return request.client.host
    return None


def _guess_platform(user_agent: str | None) -> str | None:
    if not user_agent:
        return None
    ua = user_agent.lower()
    if "android" in ua:
        return "android"
    if "iphone" in ua or "ipad" in ua or "ios" in ua:
        return "ios"
    if "mac os" in ua or "macintosh" in ua:
        return "macos"
    if "windows" in ua:
        return "windows"
    if "linux" in ua:
        return "linux"
    return "web"


def _guess_device(user_agent: str | None, device_header: str | None) -> str | None:
    if device_header:
        return device_header[:128]
    if not user_agent:
        return None
    ua = user_agent.lower()
    if "mobile" in ua or "android" in ua or "iphone" in ua:
        return "mobile"
    if "tablet" in ua or "ipad" in ua:
        return "tablet"
    return "desktop"


class AuditContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid4())
        user_agent = request.headers.get("user-agent")
        platform = request.headers.get("x-platform") or _guess_platform(user_agent)
        device = _guess_device(user_agent, request.headers.get("x-device-id") or request.headers.get("x-device"))

        ctx = RequestAuditContext(
            request_id=request_id,
            ip_address=_client_ip(request),
            user_agent=user_agent,
            device=device,
            platform=platform,
        )
        token = _request_context.set(ctx)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            _request_context.reset(token)
