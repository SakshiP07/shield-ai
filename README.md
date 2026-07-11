<div align="center">

# ShieldAI

**AI-powered fraud protection for UPI, SMS, QR codes, and payment scams.**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-Live%20Alerts-010101?logo=socketdotio&logoColor=white)

<br />

<!-- Replace with an actual screenshot: docs/screenshots/demo.png -->
![ShieldAI Demo](docs/screenshots/demo.png)

*Demo screenshot — add `docs/screenshots/demo.png` to replace this placeholder.*

</div>

---

## Table of Contents

- [Why ShieldAI?](#why-shieldai)
- [Key Features](#key-features)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Authentication](#authentication)
- [Frontend App](#frontend-app)
- [API Reference](#api-reference)
- [Schemas](#schemas)
  - [Entity relationships](#entity-relationships)
  - [Enumerations](#enumerations)
  - [Fraud pipeline schema](#fraud-pipeline-schema)
  - [PostgreSQL tables](#postgresql-tables)
  - [Redis keys](#redis-keys)
  - [API request & response schemas](#api-request--response-schemas)
  - [WebSocket messages](#websocket-messages)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)
- [Production Notes](#production-notes)
- [Future Improvements](#future-improvements)
- [Contributors](#contributors)
- [Tech Stack](#tech-stack)
- [License](#license)

---

## Why ShieldAI?

Digital payment fraud in India is rising across UPI, SMS phishing, fake QR codes, and impersonation scams. Most users lack real-time tools to evaluate a payment link, message, or merchant before money leaves their account.

**ShieldAI solves this** by running every scan through a multi-stage AI pipeline — behaviour analysis, rule checks, ML fraud scoring, and automated decisions — then alerting users instantly when a threat is detected. The result is a mobile-first security app that feels as simple as checking notifications, but is backed by production-grade fraud detection infrastructure.

| Problem | ShieldAI Solution |
|---------|-------------------|
| Unknown UPI IDs, links, and QR payloads | One-tap scan with approve / hold / block decisions |
| SMS and phishing messages | Secure inbox with per-message risk analysis |
| No visibility into personal risk | AI Security Score with breakdown and history |
| Delayed fraud awareness | Real-time WebSocket alerts |
| Weak account security | Phone OTP, Google OAuth, and WebAuthn passkeys |

---

## Key Features

- **Multi-channel scanning** — QR payloads, SMS text, UPI IDs, phone numbers, and URLs
- **Five-stage fraud pipeline** — Behaviour engine, rule engine, ML model, risk scoring, and decision engine
- **Automated decisions** — `approve`, `otp`, `hold`, or `block` based on combined risk
- **Real-time alerts** — WebSocket push when threats are detected
- **AI Security Score** — Dashboard score with reasons, blocked/warning/safe counts, and risk level
- **Secure SMS inbox** — Analyzed messages with full pipeline detail on open
- **Alert Center** — Minimal notification cards with deep pipeline insight in detail view
- **Scan history** — Activity feed, blocked scans, and regional scam alerts
- **Flexible authentication** — Phone OTP, Google OAuth (redirect flow), and WebAuthn passkeys
- **Account linking** — Connect phone and Google on a single profile
- **User preferences** — Notification, AI sensitivity, and privacy settings (stored per user)
- **Production-ready UI** — Mobile shell, consistent design system, fully API-driven (no mock data)

---

## Screenshots

> Add images under `docs/screenshots/` and update paths below.

| Screen | Preview |
|--------|---------|
| **Login** | ![Login](docs/screenshots/login.png) |
| **Home Dashboard** | ![Home Dashboard](docs/screenshots/home.png) |
| **Scanner** | ![Scanner](docs/screenshots/scanner.png) |
| **SMS Shield** | ![SMS Shield](docs/screenshots/sms.png) |
| **Alert Center** | ![Alert Center](docs/screenshots/alerts.png) |
| **Profile** | ![Profile](docs/screenshots/profile.png) |

*Placeholders — replace with actual captures from `http://localhost:5173`.*

---

## Architecture

```
Frontend (React + Vite)          Backend (FastAPI)
localhost:5173                   127.0.0.1:8000
        │                                │
        ├──── REST  /api/v1/* ──────────►│
        └──── WS    /ws/alerts ─────────►│
                                         ├── PostgreSQL  (users, txs, alerts)
                                         └── Redis       (OTP, sessions, velocity)
```

**Fraud pipeline** (`backend/app/services/pipeline.py`): Behaviour → Rules → ML (Random Forest) → Risk Score → Decision. Results persist as `transactions`; flagged scans become `fraud_logs` (alerts).

> **Full pipeline, table, and payload schemas:** see [Schemas](#schemas). SMS scans store full pipeline metadata for the detail view.

---

## Project Structure

```
shield ai/
├── frontend/                 # React mobile UI
│   ├── src/
│   │   ├── pages/            # Auth + app screens
│   │   ├── components/       # Mobile shell, badges, sheets
│   │   ├── hooks/            # Auth, alerts WebSocket, toast
│   │   └── lib/              # API client, formatting, OAuth
│   └── vite.config.ts        # Dev proxy → backend :8000
│
└── backend/                  # FastAPI API
    ├── app/
    │   ├── api/routes/       # auth, dashboard, scans, websocket
    │   ├── services/         # pipeline, OTP, alerts, SMS, dashboard
    │   ├── models/           # SQLAlchemy models
    │   └── ml/               # Random Forest fraud model
    ├── scripts/              # DB init + SQL migrations
    └── docker-compose.yml    # Postgres + Redis
```

---

## Quick Start

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 18+ |
| Python | 3.11+ |
| Docker | Recommended (Postgres + Redis), or local install |

### 1. Start databases

```bash
cd backend
docker compose up -d
```

**Connection strings**

- Postgres: `postgresql://shield:shield@127.0.0.1:5432/shieldai`
- Redis: `redis://127.0.0.1:6379/0`

**Without Docker** (macOS Homebrew):

```bash
brew services start postgresql@16 redis
bash scripts/setup-local.sh
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # Edit SECRET_KEY and optional OAuth/SMS keys
uvicorn app.main:app --reload --port 8000
```

Tables are created automatically on startup. For existing databases, run migrations:

```bash
psql "postgresql://shield:shield@127.0.0.1:5432/shieldai" -f scripts/migrate-user-columns.sql
psql "postgresql://shield:shield@127.0.0.1:5432/shieldai" -f scripts/migrate-user-preferences.sql
```

| Endpoint | URL |
|----------|-----|
| Health check | http://127.0.0.1:8000/health |
| API docs | http://127.0.0.1:8000/docs |

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env             # Set VITE_GOOGLE_CLIENT_ID if using Google sign-in
npm run dev
```

Open **http://localhost:5173**

> Use `localhost` (not `127.0.0.1`) — Vite and Google OAuth are pinned to `localhost:5173`.

### 4. Verify

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://127.0.0.1:8000 |
| API docs | http://127.0.0.1:8000/docs |
| WebSocket (dev) | `ws://127.0.0.1:8000/ws/alerts?token=<JWT>` |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing key — change in production |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `OTP_DELIVERY` | `console` (dev — OTP in API response) or SMS provider |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `GOOGLE_REDIRECT_URI` | `http://localhost:5173/auth/google/callback` |
| `WEBAUTHN_ORIGIN` | `http://localhost:5173` (must match browser URL) |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` |
| `MSG91_*` / `TWILIO_*` | Optional real SMS delivery |

See `backend/.env.example` for the full list.

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_GOOGLE_CLIENT_ID` | Same value as backend `GOOGLE_CLIENT_ID` |

---

## Authentication

ShieldAI supports three sign-in methods plus account linking.

### Phone OTP

1. `POST /api/v1/auth/otp/send` — sends OTP (Redis, 5 min TTL)
2. `POST /api/v1/auth/otp/verify` — returns JWT + user

In dev (`OTP_DELIVERY=console`), the OTP is returned in the API response as `dev_otp`.

### Google OAuth (redirect flow)

1. Frontend calls `POST /api/v1/auth/google/prepare`
2. User is redirected to Google, then back to `/auth/google/callback`
3. Frontend exchanges code via `POST /api/v1/auth/google/exchange`
4. ID token is sent to `POST /api/v1/auth/google` for session

**Google Cloud Console setup**

- OAuth 2.0 Client ID → Web application
- Authorized JavaScript origins: `http://localhost:5173`
- Authorized redirect URIs: `http://localhost:5173/auth/google/callback`

### Passkeys (WebAuthn)

| Action | Endpoints |
|--------|-----------|
| Register | `POST /api/v1/auth/biometric/register/options` + `verify` |
| Login | `POST /api/v1/auth/biometric/login/options` + `verify` |

Managed from **Profile → Passkeys**.

### Account linking

Logged-in users can link the other provider:

- `POST /api/v1/auth/link/phone/send-otp` + `verify`
- `POST /api/v1/auth/link/google`

### Session

- JWT stored in `localStorage` as `shieldai_token`
- Logout: `POST /api/v1/auth/logout` (revokes token + clears Redis session)

---

## Frontend App

### Routes

| Path | Screen |
|------|--------|
| `/login`, `/signup` | Phone OTP + Google + passkey auth |
| `/auth/google/callback` | Google OAuth return handler |
| `/setup` | First-time profile name |
| `/app` | Home — security score, quick actions, activity |
| `/app/scan` | QR / SMS / UPI / phone / link scanner |
| `/app/sms` | Secure SMS inbox (list + detail sheet) |
| `/app/alerts` | Notifications (live WebSocket) |
| `/app/activity` | Full scan history |
| `/app/scam-alerts` | Scam alerts near you |
| `/app/blocked-scans` | Blocked and held scans |
| `/app/profile` | Profile, stats, passkeys, settings |
| `/app/profile/edit` | Edit name and avatar URL |
| `/app/profile/notifications` | Alert delivery preferences |
| `/app/profile/privacy` | Privacy level |
| `/app/profile/ai` | AI sensitivity |
| `/app/profile/plan` | Current plan |

### Backend integration

Every app screen loads data from the API — there is no mock business data. API client: `frontend/src/lib/api.ts`.

| Screen | Backend source |
|--------|----------------|
| Home | `dashboard/stats`, `dashboard/activity`, `scam-alerts` |
| Scan | `scans/analyze` |
| SMS | `sms/scans`, `sms/scans/{id}` |
| Alerts | `alerts`, `alerts/{id}`, WebSocket |
| Activity | `dashboard/activity` |
| Blocked scans | `dashboard/blocked-scans` |
| Profile | `auth/me`, `dashboard/stats`, `auth/preferences`, `biometric/status` |
| Settings | `auth/preferences` (GET/PATCH) |

### UI design system

| Token | Value |
|-------|-------|
| Background | `#0B0B0B` |
| Informational | Blue |
| Danger | Red |
| Typography | 15px base body, improved line-height |
| Cards | `rounded-3xl`, generous padding, subtle dividers |
| Avatars | `users.avatar_url` when set; stable initials fallback (no random images) |

### Dev proxy

Vite proxies `/api` → `http://127.0.0.1:8000`. WebSocket connects directly to the backend in dev to avoid proxy issues.

---

## API Reference

All REST routes are prefixed with `/api/v1`. Protected routes require `Authorization: Bearer <token>` unless noted.

> **Full request/response field definitions:** see [Schemas → API request & response schemas](#api-request--response-schemas).

### Auth

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/config` | Public auth configuration |
| POST | `/auth/otp/send` | Send OTP |
| POST | `/auth/otp/verify` | Verify OTP, get JWT |
| POST | `/auth/google` | Google sign-in (ID token) |
| POST | `/auth/google/prepare` | Start OAuth redirect flow |
| POST | `/auth/google/exchange` | Exchange OAuth code |
| GET | `/auth/me` | Current user |
| PATCH | `/auth/profile` | Update name, `avatar_url` |
| GET / PATCH | `/auth/preferences` | Notification & AI settings |
| POST | `/auth/logout` | Revoke session |
| GET | `/auth/biometric/status` | Passkey registration status |
| POST | `/auth/biometric/register/*` | Register passkey |
| POST | `/auth/biometric/login/*` | Passkey sign-in |
| POST | `/auth/link/phone/*` | Link phone to account |
| POST | `/auth/link/google` | Link Google to account |

### Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/stats` | Security score, counts, risk level |
| GET | `/dashboard/activity` | Recent scan transactions |
| GET | `/dashboard/blocked-scans` | Blocked/held scans |
| GET | `/dashboard/scam-alerts` | Regional scam alerts |

### Scans & alerts

| Method | Path | Description |
|--------|------|-------------|
| POST | `/scans/analyze` | Run fraud scan (qr/sms/upi/phone/link) |
| GET | `/sms/scans` | SMS inbox list |
| GET | `/sms/scans/{id}` | SMS detail with pipeline data |
| GET | `/alerts` | All fraud alerts |
| GET | `/alerts/unread-count` | Unread badge count |
| GET | `/alerts/{id}` | Alert detail (ML, rules, behaviour) |
| PATCH | `/alerts/{id}/read` | Mark alert read |
| POST | `/alerts/mark-all-read` | Mark all read |

### WebSocket

```
ws://127.0.0.1:8000/ws/alerts?token=<JWT>
```

| Message type | Description |
|--------------|-------------|
| `connected` | Handshake confirmation |
| `alert` | New fraud alert payload |
| `pong` | Heartbeat response |

### Fraud detection pipeline (detail)

Every scan runs through five stages in `backend/app/services/pipeline.py`:

| Stage | Service | Purpose |
|-------|---------|---------|
| 1 | Behaviour Engine | Deviation from user's normal patterns |
| 2 | Rule Engine | Hard rules (velocity, merchant trust, flags) |
| 3 | ML Model | Random Forest fraud probability |
| 4 | Risk Score Engine | Combines ML + rules + behaviour |
| 5 | Decision Engine | `approve` · `otp` · `hold` · `block` |

Results are stored as `transactions` and, when flagged, as `fraud_logs` (alerts). SMS scans additionally store pipeline metadata for the detail view. See [Schemas](#schemas) for full field-level definitions.

---

## Schemas

Complete data model reference for PostgreSQL, Redis, API payloads, WebSocket messages, and the fraud pipeline.

### Entity relationships

```mermaid
erDiagram
    users ||--o| behaviour_profiles : has
    users ||--o| user_preferences : has
    users ||--o{ transactions : performs
    users ||--o{ fraud_logs : receives
    users ||--o{ webauthn_credentials : owns
    users ||--o{ decision_logs : audited
    merchants ||--o{ transactions : optional
    transactions ||--o| fraud_logs : triggers
    transactions ||--o| decision_logs : logged

    users {
        uuid id PK
        string name
        string phone UK
        string email UK
        string google_id UK
        string avatar_url
        string auth_provider
        string plan
        bool profile_completed
    }

    transactions {
        uuid id PK
        uuid user_id FK
        uuid merchant_id FK
        string channel
        string decision
        float fraud_score
        float risk_score
        json snapshots
    }

    fraud_logs {
        uuid id PK
        uuid user_id FK
        uuid transaction_id FK
        string severity
        string title
        bool is_read
    }
```

---

### Enumerations

| Domain | Allowed values |
|--------|----------------|
| `scan_type` / `channel` | `qr`, `sms`, `upi`, `phone`, `link` |
| `decision` | `approve`, `otp`, `hold`, `block` |
| `status` (transaction / UI badge) | `safe`, `warning`, `danger`, `blocked` |
| `risk_level` | `low`, `medium`, `high`, `critical` |
| `auth_provider` | `phone`, `google`, `linked` |
| `ai_sensitivity` | `standard`, `balanced`, `high` |
| `privacy_level` | `standard`, `strict`, `minimal` |
| `alert severity` | `safe`, `warning`, `danger`, `spam`, `blocked` |
| `auth intent` | `login`, `signup`, `continue`, `link` |

**Decision thresholds** (`decision_engine.py`):

| Risk score | Decision | Status |
|------------|----------|--------|
| &lt; 25 | `approve` | `safe` |
| 25 – 49 | `otp` | `warning` |
| 50 – 74 | `hold` | `warning` |
| ≥ 75 | `block` | `blocked` |

**Risk score weights** (`risk_score_engine.py`): ML 45% · Rules 30% · Behaviour 25%

---

### Fraud pipeline schema

```mermaid
flowchart LR
    A[ScanRequest] --> B[BehaviourAnalysis]
    B --> C[RuleEvaluation]
    C --> D[ML fraud probability]
    D --> E[RiskScore]
    E --> F[Decision]
    F --> G[ScanResult]
    F --> H[Transaction + DecisionLog]
    F --> I[FraudLog if not approve]
```

#### Input — `ScanRequest`

```json
{
  "scan_type": "sms",
  "content": "URGENT: KYC expired. Click bit.ly/claim",
  "amount": 0,
  "device_info": { "platform": "web" },
  "sender": "VM-BOIIND"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scan_type` | `qr \| sms \| upi \| phone \| link` | yes | Scan channel |
| `content` | string | yes | Payload to analyze |
| `amount` | decimal | no | Transaction amount (INR) |
| `device_info` | object | no | Client metadata |
| `sender` | string | no | SMS sender (SMS scans only) |

#### Internal — `BehaviourAnalysis`

```json
{
  "security_score": 75,
  "items_scanned": 12,
  "threats_blocked": 2,
  "avg_transaction_amount": 1500.0,
  "typical_channels": ["upi", "qr"],
  "risk_level": "low",
  "recent_tx_count_24h": 3,
  "recent_avg_amount": 800.0,
  "deviation_score": 0.45,
  "flags": ["unusual_channel", "amount_spike"]
}
```

| Flag | Trigger |
|------|---------|
| `amount_spike` | Amount &gt; 3× user average |
| `unusual_channel` | Channel not in typical list (after 5+ scans) |
| `high_recent_activity` | ≥ 4 transactions in 24h |
| `elevated_user_risk` | Profile `risk_level` is `high` |

#### Internal — `RuleEvaluation`

```json
{
  "results": [
    {
      "rule_id": "R002",
      "name": "phishing_keywords",
      "triggered": true,
      "severity": "high",
      "score_contribution": 0.3,
      "detail": "suspicious_keywords_found"
    }
  ],
  "total_rule_score": 0.68,
  "any_high_severity": true
}
```

| Rule ID | Name | Trigger condition |
|---------|------|-------------------|
| R001 | `velocity_check` | ≥ 5 scans/hour or ≥ ₹10,000 total |
| R002 | `phishing_keywords` | `lottery`, `kyc expired`, `bit.ly`, `urgent`, `winner` |
| R003 | `high_amount` | Amount ≥ ₹25,000 |
| R004 | `merchant_trust` | Merchant trust &lt; 30 |
| R005 | `behaviour_anomaly` | Any behaviour flag present |
| R006 | `high_risk_channel` | Channel is `sms`, `link`, or `phone` |

#### Internal — ML features (Random Forest)

| Feature | Description |
|---------|-------------|
| `has_link` | URL / short-link in content |
| `has_urgent` | Urgent/scam keywords |
| `channel_risk` | Channel weight (SMS=0.8, link=0.9, qr=0.2) |
| `amount_norm` | Amount / 50,000 (capped at 1) |
| `velocity_norm` | Recent scan count / 10 |
| `trust_norm` | 1 − (merchant_trust / 100) |

#### Output — `ScanResult`

```json
{
  "status": "blocked",
  "decision": "block",
  "fraud_score": 0.72,
  "risk_score": 78.5,
  "risk_level": "critical",
  "title": "High fraud risk — transaction blocked",
  "message": "Decision: BLOCK — High fraud risk — transaction blocked",
  "requires_otp": false,
  "transaction_id": "uuid",
  "alert_id": "uuid"
}
```

---

### PostgreSQL tables

#### `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | User ID |
| `name` | VARCHAR(120) | NOT NULL | Display name |
| `phone` | VARCHAR(20) | UNIQUE, nullable | E.164 / 10-digit phone |
| `email` | VARCHAR(255) | UNIQUE, nullable | Google-linked email |
| `google_id` | VARCHAR(128) | UNIQUE, nullable | Google subject ID |
| `google_given_name` | VARCHAR(120) | nullable | From Google profile |
| `google_family_name` | VARCHAR(120) | nullable | From Google profile |
| `google_email_verified` | BOOLEAN | nullable | Email verified flag |
| `google_locale` | VARCHAR(35) | nullable | Google locale |
| `google_hosted_domain` | VARCHAR(255) | nullable | Workspace domain |
| `avatar_url` | VARCHAR(512) | nullable | Profile image URL |
| `auth_provider` | VARCHAR(20) | default `phone` | `phone` \| `google` \| `linked` |
| `profile_completed` | BOOLEAN | default false | Name setup done |
| `plan` | VARCHAR(50) | default `Free Shield` | Subscription plan |
| `is_active` | BOOLEAN | default true | Account active |
| `created_at` | TIMESTAMPTZ | auto | Created timestamp |
| `updated_at` | TIMESTAMPTZ | auto | Updated timestamp |

#### `user_preferences`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | UUID | PK, FK → users | Owner |
| `notifications_enabled` | BOOLEAN | default true | Master alert switch |
| `push_alerts` | BOOLEAN | default true | WebSocket / push |
| `email_alerts` | BOOLEAN | default false | Email delivery |
| `sms_alerts` | BOOLEAN | default false | SMS delivery |
| `ai_sensitivity` | VARCHAR(20) | default `balanced` | `standard` \| `balanced` \| `high` |
| `privacy_level` | VARCHAR(20) | default `standard` | `standard` \| `strict` \| `minimal` |
| `updated_at` | TIMESTAMPTZ | auto | Last update |

#### `behaviour_profiles`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Profile ID |
| `user_id` | UUID | FK → users, UNIQUE | One per user |
| `security_score` | INTEGER | default 75 | 0–100 AI security score |
| `threats_blocked` | INTEGER | default 0 | Lifetime blocked count |
| `items_scanned` | INTEGER | default 0 | Total scans |
| `safe_items` | INTEGER | default 0 | Approved scans |
| `avg_transaction_amount` | FLOAT | default 0 | Running average amount |
| `typical_channels` | VARCHAR(120) | default `upi,qr` | Comma-separated channels |
| `risk_level` | VARCHAR(20) | default `low` | `low` \| `medium` \| `high` |
| `last_scan_at` | TIMESTAMPTZ | nullable | Last scan time |
| `updated_at` | TIMESTAMPTZ | auto | Last update |

#### `transactions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Transaction / scan ID |
| `user_id` | UUID | FK → users | Owner |
| `merchant_id` | UUID | FK → merchants, nullable | Matched merchant |
| `amount` | NUMERIC(12,2) | NOT NULL | Amount in INR |
| `currency` | VARCHAR(3) | default `INR` | Currency code |
| `channel` | VARCHAR(30) | NOT NULL | `qr` \| `sms` \| `upi` \| `phone` \| `link` |
| `reference` | VARCHAR(255) | nullable | Scanned content (truncated) |
| `status` | VARCHAR(20) | default `pending` | `safe` \| `warning` \| `danger` \| `blocked` |
| `fraud_score` | FLOAT | default 0 | ML probability (0–1) |
| `risk_score` | FLOAT | default 0 | Combined score (0–100) |
| `decision` | VARCHAR(20) | default `approve` | `approve` \| `otp` \| `hold` \| `block` |
| `behaviour_snapshot_json` | TEXT | nullable | Behaviour engine output |
| `rule_results_json` | TEXT | nullable | Rule engine output |
| `metadata_json` | TEXT | nullable | SMS sender, device info, etc. |
| `created_at` | TIMESTAMPTZ | auto | Scan timestamp |

#### `fraud_logs` (alerts)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Alert ID |
| `user_id` | UUID | FK → users | Owner |
| `transaction_id` | UUID | FK → transactions, nullable | Linked scan |
| `alert_type` | VARCHAR(50) | NOT NULL | e.g. `sms_scan`, `upi_scan` |
| `severity` | VARCHAR(20) | default `warning` | UI badge / severity |
| `title` | VARCHAR(200) | NOT NULL | Alert headline |
| `description` | TEXT | NOT NULL | One-line + context |
| `source` | VARCHAR(50) | default `scanner` | `pipeline` \| `scanner` \| `sms` |
| `fraud_score` | FLOAT | default 0 | ML score at alert time |
| `is_read` | BOOLEAN | default false | Read state |
| `created_at` | TIMESTAMPTZ | auto | Alert timestamp |

#### `merchants`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Merchant ID |
| `name` | VARCHAR(150) | NOT NULL | Display name |
| `upi_id` | VARCHAR(120) | UNIQUE, nullable | UPI VPA |
| `phone` | VARCHAR(20) | nullable | Phone number |
| `category` | VARCHAR(80) | nullable | Merchant category |
| `trust_score` | FLOAT | default 50 | 0–100 trust rating |
| `report_count` | INTEGER | default 0 | User reports |
| `notes` | TEXT | nullable | Internal notes |
| `created_at` | TIMESTAMPTZ | auto | Created timestamp |

#### `decision_logs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Log ID |
| `user_id` | UUID | FK → users | Owner |
| `transaction_id` | UUID | FK → transactions | Linked scan |
| `decision` | VARCHAR(20) | NOT NULL | Final decision |
| `risk_score` | FLOAT | NOT NULL | Combined risk score |
| `fraud_score` | FLOAT | NOT NULL | ML probability |
| `pipeline_snapshot_json` | TEXT | nullable | Full pipeline state |
| `created_at` | TIMESTAMPTZ | auto | Decision timestamp |

#### `webauthn_credentials`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Row ID |
| `user_id` | UUID | FK → users | Owner |
| `credential_id` | VARCHAR(512) | UNIQUE, NOT NULL | WebAuthn credential ID |
| `public_key` | TEXT | NOT NULL | Stored public key |
| `sign_count` | INTEGER | default 0 | Signature counter |
| `device_label` | VARCHAR(120) | default `This device` | User-facing label |
| `transports` | VARCHAR(120) | nullable | Authenticator transports |
| `created_at` | TIMESTAMPTZ | auto | Registration time |
| `last_used_at` | TIMESTAMPTZ | nullable | Last login time |

---

### Redis keys

| Key pattern | TTL | Value shape | Purpose |
|-------------|-----|-------------|---------|
| `otp:{phone}` | 300s | 6-digit string | OTP verification code |
| `session:{user_id}` | session | JSON metadata | Active session |
| `recent_tx:{user_id}` | 3600s | List of `{id, amount, at}` | Velocity window (last 50) |
| `velocity:{user_id}` | 3600s | `{count, total_amount, checked_at}` | Latest velocity snapshot |
| `webauthn:register:{user_id}` | short | Challenge JSON | Passkey registration |
| `webauthn:login:{session_id}` | short | Challenge JSON | Passkey login |
| `auth:revoked:{jti}` | token TTL | `"1"` | Revoked JWT blocklist |
| `cache:{key}` | varies | JSON | General API cache |

---

### API request & response schemas

All REST endpoints use prefix `/api/v1`. Types below match `backend/app/schemas/` and `frontend/src/lib/api.ts`.

#### Auth

**`POST /auth/otp/send`** — Request:

```json
{ "phone": "9876543210" }
```

Response — `OTPResponse`:

```json
{
  "message": "OTP sent",
  "expires_in": 300,
  "sms_sent": false,
  "delivery_channel": "console",
  "dev_otp": "123456"
}
```

**`POST /auth/otp/verify`** — Request:

```json
{ "phone": "9876543210", "otp": "123456", "intent": "login" }
```

Response — `AuthResponse`:

```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "needs_profile": false,
  "user": {
    "id": "uuid",
    "name": "User Name",
    "phone": "9876543210",
    "email": null,
    "avatar_url": null,
    "plan": "Free Shield",
    "profile_completed": true,
    "auth_provider": "phone"
  }
}
```

**`GET /auth/config`** — Response:

```json
{
  "google_enabled": true,
  "google_redirect_ready": true,
  "google_redirect_uri": "http://localhost:5173/auth/google/callback",
  "sms_enabled": false,
  "otp_delivery": "console",
  "biometric_enabled": true
}
```

**`PATCH /auth/profile`** — Request:

```json
{ "name": "Sakshi", "avatar_url": "https://example.com/photo.jpg" }
```

**`GET /auth/preferences`** — Response:

```json
{
  "notifications_enabled": true,
  "push_alerts": true,
  "email_alerts": false,
  "sms_alerts": false,
  "ai_sensitivity": "balanced",
  "privacy_level": "standard"
}
```

**`GET /auth/biometric/status`** — Response:

```json
{
  "server_enabled": true,
  "registered": true,
  "credential_count": 1
}
```

#### Dashboard

**`GET /dashboard/stats`** — Response — `DashboardStats`:

```json
{
  "security_score": 75,
  "threats_blocked": 3,
  "items_scanned": 24,
  "safe_items": 21,
  "risk_level": "low",
  "last_scan_at": "2026-07-12T10:30:00Z",
  "blocked_count": 2,
  "warning_count": 1,
  "safe_count": 21,
  "blocked_scans_count": 2,
  "score_breakdown": ["No recent threats", "Active scanning habit"]
}
```

**`GET /dashboard/activity`** — Response — `ActivityItem[]`:

```json
[
  {
    "id": "uuid",
    "title": "UPI scan — safe",
    "time": "2026-07-12T10:30:00Z",
    "amount": "1500.00",
    "sub": "merchant@okaxis",
    "badge": "safe"
  }
]
```

**`GET /dashboard/scam-alerts`** — Response:

```json
[
  {
    "id": "uuid",
    "title": "Fake lottery SMS reported in your area",
    "time": "2026-07-12T08:00:00Z",
    "badge": "danger"
  }
]
```

#### Scans, SMS & alerts

**`GET /sms/scans`** — Response — `SmsScanItem[]`:

```json
[
  {
    "id": "uuid",
    "sender": "VM-BOIIND",
    "text": "Your KYC has expired...",
    "time": "2026-07-12T09:00:00Z",
    "badge": "danger",
    "decision": "block",
    "status": "blocked",
    "fraud_score": 0.82,
    "risk_score": 85.0,
    "risk_level": "critical"
  }
]
```

**`GET /sms/scans/{id}`** — Response — `SmsScanDetail` (extends list item):

```json
{
  "id": "uuid",
  "sender": "VM-BOIIND",
  "text": "Full message body...",
  "time": "2026-07-12T09:00:00Z",
  "badge": "danger",
  "decision": "block",
  "status": "blocked",
  "fraud_score": 0.82,
  "risk_score": 85.0,
  "risk_level": "critical",
  "alert_id": "uuid",
  "flagged_reasons": ["phishing_keywords", "high_risk_channel"],
  "behaviour": { "deviation_score": 0.45, "flags": ["unusual_channel"] },
  "rules": { "total_rule_score": 0.68, "results": [] },
  "ml_prediction": { "fraud_score": 0.82, "risk_score": 0.85, "risk_level": "critical" },
  "pipeline": { "decision": { "action": "block", "reason": "..." } }
}
```

**`GET /alerts`** — Response — `AlertItem[]`:

```json
[
  {
    "id": "uuid",
    "title": "Transaction blocked",
    "description": "[BLOCK] High fraud risk — ...",
    "severity": "blocked",
    "alert_type": "sms_scan",
    "is_read": false,
    "created_at": "2026-07-12T09:00:00Z",
    "transaction_id": "uuid",
    "source": "pipeline",
    "fraud_score": 0.82
  }
]
```

**`GET /alerts/{id}`** — Response — `AlertDetail`:

```json
{
  "id": "uuid",
  "title": "Transaction blocked",
  "description": "[BLOCK] High fraud risk — ...",
  "severity": "blocked",
  "alert_type": "sms_scan",
  "is_read": true,
  "created_at": "2026-07-12T09:00:00Z",
  "transaction_id": "uuid",
  "fraud_score": 0.82,
  "risk_score": 85.0,
  "risk_level": "critical",
  "decision": "block",
  "full_message": "Scanned content or SMS body",
  "recommendation": "Do not proceed with this transaction.",
  "flagged_reasons": ["phishing_keywords", "velocity_check"],
  "behaviour": {},
  "rules": {},
  "ml_prediction": {},
  "pipeline": {},
  "scan_reference": "merchant@okaxis"
}
```

**`GET /alerts/unread-count`** — Response:

```json
{ "count": 3 }
```

**`PATCH /alerts/{id}/read`** — Response:

```json
{ "ok": true, "is_read": true }
```

---

### WebSocket messages

**Endpoint:** `ws://127.0.0.1:8000/ws/alerts?token=<JWT>`

#### Server → Client

**Connected:**

```json
{ "type": "connected", "user_id": "uuid" }
```

**New alert:**

```json
{
  "type": "alert",
  "data": {
    "id": "uuid",
    "title": "Transaction blocked",
    "description": "[BLOCK] High fraud risk — ...",
    "severity": "blocked",
    "alert_type": "sms_scan",
    "is_read": false,
    "created_at": "2026-07-12T09:00:00Z",
    "transaction_id": "uuid",
    "source": "pipeline",
    "fraud_score": 0.82
  }
}
```

**Heartbeat:**

```json
{ "type": "pong" }
```

**Error:**

```json
{ "type": "error", "message": "Unauthorized" }
```

#### Client → Server

| Message | Description |
|---------|-------------|
| `"ping"` | Heartbeat; server replies with `pong` |

---

## Scripts

### Frontend

```bash
npm run dev       # Dev server (localhost:5173)
npm run build     # Production build → dist/
npm run preview   # Preview production build
npm run lint      # Oxlint
npm run test:e2e  # Playwright browser QA
```

### Backend

```bash
uvicorn app.main:app --reload --port 8000
python scripts/init_db.py          # Create tables manually
bash scripts/setup-local.sh        # Local Postgres without Docker
```

---

## Troubleshooting

<details>
<summary><strong>Port 5173 already in use</strong></summary>

```bash
lsof -ti:5173 | xargs kill
cd frontend && npm run dev
```

</details>

<details>
<summary><strong>Vite <code>504 Outdated Optimize Dep</code></strong></summary>

```bash
cd frontend
rm -rf node_modules/.vite
npm run dev -- --force
```

</details>

<details>
<summary><strong>PostCSS <code>bg-shield</code> class error</strong></summary>

Do not use `@apply bg-shield` in CSS. Use `background-color: var(--color-bg)` instead (see `frontend/src/styles/index.css`).

</details>

<details>
<summary><strong>Google OAuth 403 / origin mismatch</strong></summary>

- Open the app at `http://localhost:5173` (not `127.0.0.1`)
- Add both origins in Google Cloud Console
- Match `GOOGLE_REDIRECT_URI` and `WEBAUTHN_ORIGIN` to your browser URL

</details>

<details>
<summary><strong>WebSocket disconnects on page reload</strong></summary>

Expected in dev with React StrictMode. The client reconnects automatically (`useAlertsWebSocket.ts`).

</details>

<details>
<summary><strong>OTP not received via SMS</strong></summary>

Set `OTP_DELIVERY=console` in `backend/.env` for local dev — OTP appears in the API response as `dev_otp`.

</details>

<details>
<summary><strong>Database connection refused</strong></summary>

```bash
cd backend && docker compose up -d
docker compose ps   # Both postgres and redis should be healthy
```

</details>

<details>
<summary><strong>CORS errors</strong></summary>

Ensure `CORS_ORIGINS` in `backend/.env` includes `http://localhost:5173`.

</details>

---

## Production Notes

- Change `SECRET_KEY` to a long random value
- Set `DEBUG=false`
- Configure real SMS (`MSG91_*` or `TWILIO_*`) and set `OTP_DELIVERY` accordingly
- Serve frontend build behind HTTPS; update `WEBAUTHN_ORIGIN` and Google OAuth URIs
- WebSocket in production uses `wss://` on the same host as the frontend

---

## Future Improvements

- [ ] Apply `ai_sensitivity` and `privacy_level` preferences to the fraud pipeline
- [ ] Gate alert delivery by notification preferences (push, email, SMS)
- [ ] Dynamic plan features from backend instead of static UI copy on Plan page
- [ ] Live data refresh on Home, Activity, and SMS while user is on other tabs
- [ ] Email alert delivery integration
- [ ] Merchant trust database expansion and community reporting
- [ ] Mobile native apps (iOS / Android) wrapping the existing API
- [ ] Admin dashboard for fraud analytics and rule tuning
- [ ] Alembic migrations replacing manual SQL migration scripts
- [ ] CI/CD pipeline with automated E2E tests on pull requests

---

## Contributors

| Name | Role |
|------|------|
| Sakshi Pokhriyal | Project lead & full-stack development |

Contributions are welcome. Open an issue or pull request to suggest improvements.

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS, Framer Motion, Lucide |
| Backend | FastAPI, SQLAlchemy, Pydantic, WebAuthn, scikit-learn |
| Data | PostgreSQL 16, Redis 7 |
| Auth | JWT, phone OTP, Google OAuth 2.0, WebAuthn passkeys |
| Real-time | WebSocket alert broadcast |

---

## License

Private project. All rights reserved.
