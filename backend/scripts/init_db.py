"""Create all SQLAlchemy tables in the database from DATABASE_URL in .env."""

from app.core.database import Base, engine
from app.models import behaviour_profile, decision_log, fraud_log, merchant, transaction, user, webauthn_credential  # noqa: F401

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("Tables created (or already exist) in:", engine.url)
