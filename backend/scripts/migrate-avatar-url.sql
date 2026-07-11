-- Run: psql "postgresql://shield:shield@127.0.0.1:5432/shieldai" -f scripts/migrate-avatar-url.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);
