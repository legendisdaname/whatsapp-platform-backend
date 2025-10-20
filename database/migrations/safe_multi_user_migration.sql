-- Safe Multi-User Migration
-- This script checks if things exist before creating them
-- Safe to run multiple times

-- Add user_id columns (safe - won't error if exists)
DO $$ 
BEGIN
    -- Sessions
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sessions' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE sessions ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    -- Bots
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bots' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE bots ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    -- Contacts
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE contacts ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    -- Contact Groups
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contact_groups' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE contact_groups ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes (safe - won't error if exists)
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_groups_user_id ON contact_groups(user_id);

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE 'All tables now have user_id columns and indexes';
END $$;

