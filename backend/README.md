# ShieldAI Backend

FastAPI backend for fraud detection, phone OTP auth, and real-time alerts.

## Stack

- FastAPI + Uvicorn
- SQLAlchemy + PostgreSQL (via `DATABASE_URL` / Supabase)
- Supabase Storage (existing `avatars` bucket)
- Prisma (`backend/prisma`) for schema sync / client generate
- JWT authentication
- WebSockets (live alerts)
- scikit-learn Random Forest (fraud scoring)

## Quick start

```bash
cd backend
cp .env.example .env   # fill all fields
npm install
npx prisma validate && npx prisma generate && npx prisma db push
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Environment

Single file: `.env` (template `.env.example`). Keys must match.

Storage uses the existing public bucket named `avatars` (create/configure it yourself in the Supabase dashboard).

## Models

| Table | Purpose |
|-------|---------|
| `users` | Phone-based accounts |
| `transactions` | Scans and payment checks (indexed for velocity) |
| `behaviour_profiles` | Security score, scan stats |
| `merchants` | Known UPI/phone merchants |
| `fraud_logs` | Alerts shown in Alert Center |
| `otp_codes` | Short-lived OTPs (replaces Redis) |
| `revoked_tokens` | JWT denylist (replaces Redis) |
