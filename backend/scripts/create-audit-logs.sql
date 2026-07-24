-- Manual DDL for append-only audit_logs (create this yourself in Supabase/Postgres).
-- Application code never UPDATEs or DELETEs these rows.

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(64) NOT NULL,
    action VARCHAR(120),
    description TEXT,
    sms_id VARCHAR(64),
    transaction_id UUID,
    status VARCHAR(32) DEFAULT 'success',
    metadata JSONB,
    device_id VARCHAR(128),
    device_model VARCHAR(128),
    manufacturer VARCHAR(128),
    android_version VARCHAR(32),
    app_version VARCHAR(32),
    entity_type VARCHAR(64),
    entity_id VARCHAR(64),
    previous_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(64),
    device VARCHAR(128),
    platform VARCHAR(64),
    request_id VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prompt-aligned SMS audit columns (safe to re-run)
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS action VARCHAR(120),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS sms_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS transaction_id UUID,
    ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'success',
    ADD COLUMN IF NOT EXISTS metadata JSONB,
    ADD COLUMN IF NOT EXISTS device_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS device_model VARCHAR(128),
    ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(128),
    ADD COLUMN IF NOT EXISTS android_version VARCHAR(32),
    ADD COLUMN IF NOT EXISTS app_version VARCHAR(32);

CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_event_type ON audit_logs (event_type);
CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS ix_audit_logs_request_id ON audit_logs (request_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id_created_at ON audit_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS ix_audit_logs_event_type_created_at ON audit_logs (event_type, created_at);
CREATE INDEX IF NOT EXISTS ix_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_sms_id ON audit_logs (sms_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_transaction_id ON audit_logs (transaction_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_status ON audit_logs (status);

-- Enforce append-only at the database level
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_mutation();
