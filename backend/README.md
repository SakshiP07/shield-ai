# ShieldAI Backend

FastAPI backend for fraud detection, OTP auth, and real-time alerts.

## Stack

- FastAPI + Uvicorn
- SQLAlchemy + PostgreSQL
- Redis (OTP, sessions, velocity, cache)
- JWT authentication
- WebSockets (live alerts)
- scikit-learn Random Forest (fraud scoring)

## Quick start

```bash
docker compose up -d
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

## Environment

Copy `.env.example` to `.env` and update `SECRET_KEY` before production.

## Models

| Table | Purpose |
|-------|---------|
| `users` | Phone-based accounts |
| `transactions` | Scans and payment checks |
| `behaviour_profiles` | Security score, scan stats |
| `merchants` | Known UPI/phone merchants |
| `fraud_logs` | Alerts shown in Alert Center |

## Redis keys

- `otp:{phone}` — OTP codes (TTL)
- `session:{user_id}` — Active session metadata
- `recent_tx:{user_id}` — Recent transactions for velocity
- `velocity:{user_id}` — Latest velocity check snapshot
- `cache:{key}` — General API cache
