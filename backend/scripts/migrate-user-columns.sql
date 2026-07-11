-- Run: psql "postgresql://shield:shield@127.0.0.1:5432/shieldai" -f scripts/migrate-user-columns.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_given_name VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_family_name VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_email_verified BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_locale VARCHAR(35);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_hosted_domain VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'phone';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;

UPDATE users SET profile_completed = TRUE WHERE name IS NOT NULL AND name != '' AND name NOT LIKE 'User %';
