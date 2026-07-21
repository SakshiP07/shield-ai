from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, dashboard, ledger, scans, websocket
from app.core.config import get_settings
from app.core.database import Base, engine
from app.core.request_context import AuditContextMiddleware
from app.models import (  # noqa: F401
    audit_log,
    behaviour_profile,
    decision_log,
    fraud_log,
    merchant,
    oauth_state,
    otp_code,
    revoked_token,
    transaction,
    transaction_ledger,
    user,
    user_preference,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditContextMiddleware)

api_prefix = settings.api_v1_prefix
app.include_router(auth.router, prefix=api_prefix)
app.include_router(dashboard.router, prefix=api_prefix)
app.include_router(scans.router, prefix=api_prefix)
app.include_router(ledger.router, prefix=api_prefix)
app.include_router(websocket.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": settings.app_name}
