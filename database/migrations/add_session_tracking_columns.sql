-- Migration: Add session tracking columns
-- Description: Adds last_connected_at and last_seen columns to track session persistence
-- Date: 2025-10-19

-- Add new columns if they don't exist
DO $$ 
BEGIN
    -- Add last_connected_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sessions' AND column_name = 'last_connected_at'
    ) THEN
        ALTER TABLE sessions ADD COLUMN last_connected_at TIMESTAMPTZ;
        COMMENT ON COLUMN sessions.last_connected_at IS 'Last time session successfully connected';
    END IF;

    -- Add last_seen column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sessions' AND column_name = 'last_seen'
    ) THEN
        ALTER TABLE sessions ADD COLUMN last_seen TIMESTAMPTZ;
        COMMENT ON COLUMN sessions.last_seen IS 'Last keepalive ping timestamp';
    END IF;
END $$;

-- Set initial values for existing records
UPDATE sessions 
SET last_connected_at = updated_at 
WHERE status = 'connected' AND last_connected_at IS NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sessions_last_connected ON sessions(last_connected_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen);

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Session tracking columns added successfully';
END $$;

