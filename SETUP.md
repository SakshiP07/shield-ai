# ShieldAI — Setup Guide (Easy Steps)

## What runs where

| Thing | How it runs | Port |
|-------|-------------|------|
| Frontend (React) | `npm run dev` | 5173 |
| Backend (FastAPI) | `uvicorn` | 8000 |
| PostgreSQL | Docker container `shieldai-postgres` | 5432 |
| Redis | Docker container `shieldai-redis` | 6379 |

---

## Step 1 — Start Docker (Postgres + Redis)

```bash
cd backend
docker compose up -d
docker compose ps   # both should say "healthy"
```

---

## Step 2 — Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

**Upgrade DB if you had an older version:**
```bash
psql "postgresql://shield:shield@127.0.0.1:5432/shieldai" -f scripts/migrate-user-columns.sql
```

**Start backend:**
```bash
uvicorn app.main:app --reload --port 8000
```

Check: open http://127.0.0.1:8000/health → should say `"status":"ok"`

---

## Step 3 — Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open: http://localhost:5173

---

## Step 4 — Real OTP via SMS (MSG91 — recommended for India)

MSG91 sends OTP to **any** +91 number automatically (no manual verify per user like Twilio trial).

Add to `backend/.env`:

```
MSG91_AUTH_KEY=your_auth_key
MSG91_TEMPLATE_ID=your_msg91_template_id
MSG91_SENDER_ID=SHLDAI
MSG91_DLT_TE_ID=your_dlt_template_id
MSG91_PE_ID=your_dlt_entity_id
MSG91_SMS_SUFFIX=- TGSP
```

### One-time MSG91 + DLT setup

1. Sign up at https://msg91.com → copy **Auth Key** (Dashboard → API)
2. Register on a **DLT portal** (Airtel/Jio/Vi etc.) → get **PE ID** (Entity ID)
3. Register a **Sender ID** (6 chars, e.g. `SHLDAI`) on DLT
4. Create a **Content Template** on DLT:
   - Category: **Service Implicit** (transactional OTP — not promotional)
   - Example text (must match exactly in MSG91):
     ```
     Your ShieldAI verification code is ##OTP##. Valid for 5 minutes. - TGSP
     ```
   - Copy the DLT **Template ID** → `MSG91_DLT_TE_ID`
5. In MSG91 panel → **SMS → Templates → Create**:
   - Paste same message with `##OTP##`
   - Map DLT Template ID + Sender ID
   - Copy MSG91 **Template ID** → `MSG91_TEMPLATE_ID`
6. Restart backend

Verify:
```bash
curl http://127.0.0.1:8000/api/v1/auth/config
# "sms_enabled": true
```

### Test

1. Open http://localhost:5173
2. Enter any 10-digit Indian mobile
3. **Send OTP** → SMS arrives with `- TGSP` at the end (per DLT template)
4. Enter the 6-digit code

**Priority:** If MSG91 is configured, it is used first. Twilio is fallback only.

### Twilio (optional fallback)

Twilio trial only sends to numbers you manually verify. Use only if MSG91 is not set up.

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
```

**Without MSG91 or Twilio:** dev mode — OTP auto-filled in UI.

---

## Step 5 — Google OAuth

1. Go to https://console.cloud.google.com/apis/credentials
2. Create **OAuth 2.0 Client ID** → Web application
3. Authorized JavaScript origins: `http://localhost:5173`
4. Copy Client ID to **both** files:

`backend/.env`:
```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

`frontend/.env`:
```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

5. Restart backend + frontend
6. "Continue with Google" button will work

---

## Step 6 — Login flow

```
Phone login:
  Enter number → OTP (SMS or dev) → Enter name (first time) → App

Google login:
  Click Google → Name from Google account → App
```

**Name from phone number:** Not possible automatically (telecom APIs don't allow this). You enter your name once after first OTP login.

---

## Step 7 — Test the app

1. **Login** with phone or Google
2. **Home** — stats from PostgreSQL (`behaviour_profiles`)
3. **Scan** → paste `URGENT KYC expired bit.ly/fake` → fraud pipeline runs
4. **Alerts** — fraud alerts from `fraud_logs` table
5. **SMS** — past SMS scans from `transactions`
6. **Profile** — your name from database

---

## How to view the database

### Important: two Postgres instances on Mac

If you run **Homebrew PostgreSQL** and **Docker** (`shieldai-postgres`), both may use port **5432**:

| How you connect | Which database | Has app tables? |
|-----------------|----------------|-----------------|
| `docker exec -it shieldai-postgres psql ...` | Docker Postgres | Usually **empty** |
| `psql "postgresql://shield:shield@127.0.0.1:5432/shieldai"` | Homebrew Postgres (what the backend uses by default) | **Yes** — where login data is stored |

The backend `.env` uses `127.0.0.1:5432`, which on most Macs hits **Homebrew**, not Docker.

**Query users (correct way for current setup):**
```bash
psql "postgresql://shield:shield@127.0.0.1:5432/shieldai" -c "SELECT name, phone FROM users;"
```

**Create tables** (if missing after first backend start):
```bash
cd backend
source .venv/bin/activate
python scripts/init_db.py
```

**Use only Docker Postgres:** stop Homebrew (`brew services stop postgresql@16` or your version), then restart backend once — tables are created automatically on startup.

---

### Option A — Terminal (host psql)

```bash
docker exec -it shieldai-postgres psql -U shield -d shieldai
```

Useful commands:
```sql
\dt                                          -- list tables
SELECT name, phone, email FROM users;        -- users
SELECT decision, risk_score FROM transactions ORDER BY created_at DESC LIMIT 5;
SELECT title, severity FROM fraud_logs ORDER BY created_at DESC LIMIT 5;
SELECT * FROM behaviour_profiles;
\q                                           -- quit
```

### Option B — One-liner from Mac

```bash
psql "postgresql://shield:shield@127.0.0.1:5432/shieldai" -c "SELECT * FROM users;"
```

### Option C — GUI app

Use **TablePlus**, **pgAdmin**, or **DBeaver**:
- Host: `127.0.0.1`
- Port: `5432`
- User: `shield`
- Password: `shield`
- Database: `shieldai`

---

## Fix "Port 5173 is already in use"

**Root cause:** Another Vite dev server is already running on port 5173 — usually from a previous `npm run dev` in another terminal, or a background process that was not stopped with Ctrl+C.

This project sets `strictPort: true` in `frontend/vite.config.ts`, so Vite **will not** silently switch to another port. That is intentional: it surfaces duplicate servers instead of hiding them.

Docker is **not** the cause — `docker-compose.yml` only exposes 5432 (Postgres) and 6379 (Redis), not 5173.

**Find what is using the port:**
```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

**Stop it safely** (only if the command shows `node .../vite` for this project):
```bash
kill $(lsof -tiTCP:5173 -sTCP:LISTEN)
```

If it does not exit within a few seconds:
```bash
kill -9 $(lsof -tiTCP:5173 -sTCP:LISTEN)
```

**Verify the port is free** (should print nothing):
```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

**Restart the frontend:**
```bash
cd frontend
npm run dev
```

Expected output:
```
➜  Local:   http://localhost:5173/
```

**Rule of thumb:** Run only **one** frontend dev server at a time. Stop the old one (Ctrl+C in its terminal) before starting a new one.

---

## Fix 401 Unauthorized on /auth/me

This means an **old or invalid JWT** in browser storage.

**Fix:** Open browser DevTools → Application → Local Storage → delete `shieldai_token` → login again.

Or run in browser console:
```javascript
localStorage.removeItem('shieldai_token');
location.reload();
```

---

## About the `.vite` folder

- **Not needed** — it's Vite's temporary cache
- **Safe to delete** — recreated when you run `npm run dev`
- **Don't commit it** — already in `.gitignore`
- The one in project root was removed; only `frontend/node_modules/.vite` may exist (normal)

---

## Quick checklist

```bash
docker compose ps                    # postgres + redis healthy
curl http://127.0.0.1:8000/health    # backend OK
redis-cli ping                       # PONG
open http://localhost:5173           # frontend
```
