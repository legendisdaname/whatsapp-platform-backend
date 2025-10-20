-- Migration: Add auth backup tracking table (OPTIONAL)
-- Description: Tracks WhatsApp authentication data backup status
-- Date: 2025-10-19
-- NOTE: This is optional - only create if you want backup tracking

-- Create auth backup table
CREATE TABLE IF NOT EXISTS session_auth_backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE UNIQUE,
    auth_exists BOOLEAN DEFAULT FALSE,
    auth_size_bytes BIGINT,
    last_backup_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_auth_backups_session ON session_auth_backups(session_id);
CREATE INDEX IF NOT EXISTS idx_auth_backups_last_backup ON session_auth_backups(last_backup_at);

-- Enable RLS
ALTER TABLE session_auth_backups ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all operations on session_auth_backups" ON session_auth_backups
    FOR ALL USING (true) WITH CHECK (true);

-- Add comment
COMMENT ON TABLE session_auth_backups IS 'Tracks authentication data backup status (metadata only, not actual auth data)';

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Auth backup tracking table created';
END $$;

