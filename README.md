<div align="center">

# ShieldAI

**AI-powered fraud protection for UPI, SMS, QR codes, and payment scams.**

![React Native](https://img.shields.io/badge/React_Native-Expo_54-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth_%26_Storage-3ECF8E?logo=supabase&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)

</div>

---

## Overview

ShieldAI scans QR payloads, SMS, UPI IDs, phone numbers, and links through a multi-stage fraud pipeline (behaviour → rules → ML → risk → decision), then surfaces alerts in a mobile-first React Native app.

**Auth:** Phone OTP (via backend) and Google OAuth (via Supabase Auth).  
**Data:** PostgreSQL via Supabase (`DATABASE_URL`).  
**Files:** Supabase Storage (`avatars` bucket).  
**Schema tooling:** SQLAlchemy + Alembic inside `backend/`.

See [SETUP.md](SETUP.md) for the full Supabase local setup instructions.

## Quick start

### 1. Database & Environment

1. In the Supabase dashboard, ensure Postgres is ready, a public bucket named `avatars` exists, and Google Auth is configured.
2. Configure the backend environment:
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env to include your Supabase Database URL and Keys
   ```
3. Configure the frontend environment:
   ```bash
   cp frontend-rn/.env.example frontend-rn/.env
   # Edit frontend-rn/.env and ensure EXPO_PUBLIC_API_BASE points to your computer's local IP (e.g. http://192.168.x.x:8000/api/v1)
   ```

### 2. Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start the server (binds to 0.0.0.0 so phone can connect)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend (React Native / Expo)

```bash
cd frontend-rn
npm install
npm run start -- -c
```
*Use the Expo Go app on your physical device to scan the QR code.*

## Redis → PostgreSQL Migration

| Former Redis key | Replacement |
|------------------|-------------|
| `otp:{phone}` | Table `otp_codes` |
| `auth:revoked:{jti}` | Table `revoked_tokens` |
| `session:{user_id}` | Removed — JWT + `users` |
| `recent_tx` / `velocity` | Indexed `transactions(user_id, created_at)` |

## Architecture Changes

- **Web to Mobile**: The frontend was fully migrated from React web to React Native using Expo (SDK 54).
- **ORM**: Replaced Prisma with SQLAlchemy + Alembic.
- **Removed**: Redis, Docker, WebAuthn/passkeys.

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
