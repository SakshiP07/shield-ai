-- Run: psql "postgresql://shield:shield@127.0.0.1:5432/shieldai" -f scripts/migrate-user-preferences.sql

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    push_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    email_alerts BOOLEAN NOT NULL DEFAULT FALSE,
    sms_alerts BOOLEAN NOT NULL DEFAULT FALSE,
    ai_sensitivity VARCHAR(20) NOT NULL DEFAULT 'balanced',
    privacy_level VARCHAR(20) NOT NULL DEFAULT 'standard',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
