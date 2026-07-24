#!/usr/bin/env bash
# Optional helper: print next steps for Supabase-backed local setup.
# Does NOT create Supabase resources, Docker containers, or Redis.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "ShieldAI uses Supabase PostgreSQL + Storage."
echo ""
echo "1. Create/configure in the Supabase dashboard (manually):"
echo "   - Project + Postgres database"
echo "   - Public storage bucket named: avatars"
echo ""
echo "2. Env (single file):"
echo "   cd \"$ROOT\" && cp .env.example .env"
echo "   # Fill all fields — especially SUPABASE_* and DATABASE_URL"
echo ""
echo "3. Sync schema with Prisma (from backend):"
echo "   cd \"$ROOT\""
echo "   npm install"
echo "   npx prisma validate && npx prisma generate && npx prisma db push"
echo "   npx prisma studio   # optional: view tables"
echo ""
echo "4. Start backend:"
echo "   cd \"$ROOT\""
echo "   source .venv/bin/activate  # or create venv + pip install -r requirements.txt"
echo "   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "5. Start frontend:"
echo "   cd \"$ROOT/../frontend\" && npm install && npm run dev"
