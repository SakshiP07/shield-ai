-- Add password auth columns to users + pending_signups table.
-- Run in Supabase SQL editor (avoids Prisma db push FK lock timeouts).

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS pending_signups (
    phone VARCHAR(20) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_pending_signups_expires_at ON pending_signups (expires_at);
CREATE INDEX IF NOT EXISTS ix_pending_signups_email ON pending_signups (email);
