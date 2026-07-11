#!/usr/bin/env bash
# Local dev setup WITHOUT Docker (uses Homebrew PostgreSQL + Redis)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Checking Redis..."
if ! redis-cli ping >/dev/null 2>&1; then
  echo "Redis is not running. Start it with: brew services start redis"
  exit 1
fi
echo "    Redis OK"

echo "==> Setting up PostgreSQL user/database..."
PSQL_USER="${PGUSER:-$(whoami)}"
psql -h 127.0.0.1 -U "$PSQL_USER" -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'shield') THEN
    CREATE ROLE shield WITH LOGIN PASSWORD 'shield';
  END IF;
END
$$;
SELECT 'CREATE DATABASE shieldai OWNER shield' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'shieldai')\gexec
GRANT ALL PRIVILEGES ON DATABASE shieldai TO shield;
SQL

psql -h 127.0.0.1 -U "$PSQL_USER" -d shieldai -v ON_ERROR_STOP=1 -c \
  "GRANT ALL ON SCHEMA public TO shield; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO shield;"

echo "==> Writing .env (if missing)..."
if [[ ! -f .env ]]; then
  cp .env.example .env
fi
# Prefer IPv4 to avoid localhost -> ::1 issues on some Mac setups
if grep -q 'localhost:5432' .env 2>/dev/null; then
  sed -i '' 's|@localhost:5432|@127.0.0.1:5432|g' .env
fi

echo "==> Testing connection..."
psql "postgresql://shield:shield@127.0.0.1:5432/shieldai" -c "SELECT current_user, current_database();"

echo ""
echo "Done! Start backend:"
echo "  source .venv/bin/activate"
echo "  uvicorn app.main:app --reload --port 8000"
