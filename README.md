<div align="center">

# ShieldAI

**AI-powered fraud protection for UPI, SMS, QR codes, and payment scams.**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Storage-3ECF8E?logo=supabase&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)

</div>

---

## Overview

ShieldAI scans QR payloads, SMS, UPI IDs, phone numbers, and links through a multi-stage fraud pipeline (behaviour → rules → ML → risk → decision), then surfaces alerts in a mobile-first React app.

**Auth:** phone OTP only.  
**Data:** PostgreSQL via Supabase (`DATABASE_URL`).  
**Files:** Supabase Storage (existing `avatars` bucket).  
**Schema tooling:** Prisma inside `backend/` — run manually; nothing is auto-created in Supabase.

See [SETUP.md](SETUP.md) for the full local setup.

## Quick start

1. In the Supabase dashboard, ensure Postgres is ready and a public bucket named `avatars` exists.
2. Configure the single env file `backend/.env` (copy from `backend/.env.example`).
3. Prisma + API (from `backend/`):

```bash
cd backend
cp .env.example .env   # then fill values
npm install
npx prisma validate
npx prisma generate
npx prisma db push
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

4. Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Environment

One file only: `backend/.env` / `backend/.env.example` (same keys).

Required for Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`.

## Redis → PostgreSQL

| Former Redis key | Replacement |
|------------------|-------------|
| `otp:{phone}` | Table `otp_codes` |
| `auth:revoked:{jti}` | Table `revoked_tokens` |
| `session:{user_id}` | Removed — JWT + `users` |
| `recent_tx` / `velocity` | Indexed `transactions(user_id, created_at)` |

## Removed

- Redis, Docker, Google OAuth, WebAuthn/passkeys
- Root-level Prisma / root `node_modules`

## Android SMS app

Native Android client lives in **`android/`** (Content Provider SMS sync — no Twilio).

- Configure backend URL: `android/gradle.properties` → `API_BASE_URL` (override in `android/local.properties`)
- Docs / run instructions: [`android/README.md`](android/README.md)

```bash
cd android
# Open this folder in Android Studio, or:
./gradlew :app:assembleDebug
```

## License

Private — all rights reserved.
