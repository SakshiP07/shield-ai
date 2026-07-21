from collections.abc import Generator
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

settings = get_settings()

# Prisma-only query params that psycopg2 / SQLAlchemy reject.
_PRISMA_ONLY_PARAMS = frozenset({"pgbouncer", "schema", "connection_limit", "pool_timeout"})


def sqlalchemy_database_url(raw_url: str) -> tuple[str, bool]:
    """Strip Prisma-only DSN options. Returns (url, uses_pgbouncer)."""
    parsed = urlparse(raw_url)
    query = parse_qsl(parsed.query, keep_blank_values=True)
    uses_pgbouncer = any(k == "pgbouncer" and v.lower() in {"true", "1", "yes"} for k, v in query)
    # Supabase transaction pooler is typically port 6543.
    uses_pgbouncer = uses_pgbouncer or parsed.port == 6543
    cleaned = [(k, v) for k, v in query if k.lower() not in _PRISMA_ONLY_PARAMS]
    return urlunparse(parsed._replace(query=urlencode(cleaned))), uses_pgbouncer


if not settings.database_url:
    raise RuntimeError("DATABASE_URL is required. Set it to your Supabase PostgreSQL connection string.")

_db_url, _uses_pgbouncer = sqlalchemy_database_url(settings.database_url)
# Transaction-mode PgBouncer cannot reuse server-side prepared statements / long-lived pools.
_engine_kwargs: dict = {"pool_pre_ping": True}
if _uses_pgbouncer:
    _engine_kwargs["poolclass"] = NullPool

engine = create_engine(_db_url, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
