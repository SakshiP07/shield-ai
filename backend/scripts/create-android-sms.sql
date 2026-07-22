-- Android SMS inbox sync tables (run in Supabase SQL editor if not using prisma db push).
-- No Twilio / third-party SMS providers — device Content Provider only.

ALTER TABLE user_preferences
    ADD COLUMN IF NOT EXISTS android_sms_connected BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS sms_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    android_sms_id VARCHAR(64) NOT NULL,
    address VARCHAR(64) NOT NULL,
    sender VARCHAR(120) NOT NULL,
    body TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_otp BOOLEAN NOT NULL DEFAULT FALSE,
    otp_code VARCHAR(16),
    thread_id VARCHAR(64),
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    fraud_score DOUBLE PRECISION,
    risk_score DOUBLE PRECISION,
    risk_level VARCHAR(30),
    decision VARCHAR(30),
    badge VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sms_messages_user_android_id UNIQUE (user_id, android_sms_id)
);

CREATE INDEX IF NOT EXISTS ix_sms_messages_user_id ON sms_messages (user_id);
CREATE INDEX IF NOT EXISTS ix_sms_messages_received_at ON sms_messages (received_at);
CREATE INDEX IF NOT EXISTS ix_sms_messages_user_id_received_at ON sms_messages (user_id, received_at);
CREATE INDEX IF NOT EXISTS ix_sms_messages_user_id_is_read ON sms_messages (user_id, is_read);
