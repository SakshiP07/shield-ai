"""Ensure SQLAlchemy models are imported so metadata is registered."""

from app.core.database import Base, engine
from app.models import (  # noqa: F401
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


def main() -> None:
    Base.metadata.create_all(bind=engine)
    print("Tables ensured via SQLAlchemy metadata.create_all")


if __name__ == "__main__":
    main()
