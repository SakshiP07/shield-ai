# ShieldAI — Local Setup (Supabase)

This project uses **Supabase PostgreSQL** and **Supabase Storage**. Nothing is created automatically — configure resources in the Supabase dashboard yourself.

## Prerequisites

| Service | Source |
|---------|--------|
| PostgreSQL | Supabase project → Settings → Database → Connection string (`DATABASE_URL`) |
| Storage | Existing public bucket named `avatars` |
| API keys | Supabase project → Settings → API |

## Step 1 — Environment

Backend: `backend/.env` (template: `backend/.env.example`).  
Frontend: `frontend/.env` (template: `frontend/.env.example`) — needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

```bash
cd backend
cp .env.example .env
```

Fill in every field (especially `SUPABASE_*` and `DATABASE_URL`).

## Step 2 — Prisma (inside backend)

```bash
cd backend
npm install
npx prisma validate
npx prisma generate
npx prisma db push
npx prisma studio
```

- Schema: `backend/prisma/schema.prisma`
- Prisma loads `DATABASE_URL` from `backend/.env` automatically

## Step 3 — Backend API

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Step 4 — Frontend

```bash
cd frontend
cp .env.example .env
# set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (same project as backend)
npm install
npm run dev
```

Open http://localhost:5173

## Auth

One person → one `users` row. Google and phone/password can both live on the same account.

- **Email/phone signup** — name + email + phone + password → OTP verify → user created (`POST /auth/signup/start`, `/auth/signup/verify`)
- **Phone login** — phone + password (`POST /auth/login`) against the same account
- **Google via Supabase Auth** — `signInWithOAuth({ provider: 'google' })`, then `POST /api/v1/auth/google` with the Supabase access token
- Google is always **find-or-create / link-by-email** (never “no account exists”)
- **Link later** — Profile can attach phone (+ optional password) or Google to the **same** user row (`auth_provider`: `password` | `google` | `linked`)

Lookup order: `google_id` → `email` → create.

DB migration for password columns + `pending_signups`: run `backend/scripts/migrate-password-auth.sql` in the Supabase SQL editor.

### Supabase dashboard checklist

1. Authentication → Providers → **Google** enabled (Client ID + Secret from Google Cloud)
2. Authentication → URL Configuration:
   - Site URL: `http://localhost:5173`
   - Redirect URLs include: `http://localhost:5173/auth/google/callback`
3. Frontend `.env`: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (same project as backend)

## Storage

Avatar uploads go to the existing `avatars` bucket. The app never creates buckets.

## Troubleshooting

- **DATABASE_URL required** — backend will not start without it
- **Upload failed** — confirm the `avatars` bucket exists and is public (or adjust policies in the dashboard)
- **OTP in console** — without MSG91/Twilio configured, OTP prints to backend logs
