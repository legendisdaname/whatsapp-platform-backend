-- Migration: Add user_id to sessions table
-- Description: Link sessions to specific users for multi-user support
-- Date: 2025-10-19

-- Add user_id column to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Update existing sessions to have a default user (optional - for migration)
-- You can manually assign these to users or delete them
-- UPDATE sessions SET user_id = 'some-user-id' WHERE user_id IS NULL;

-- Add user_id to other tables that need user context
ALTER TABLE bots ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE contact_groups ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_groups_user_id ON contact_groups(user_id);

-- Update RLS policies for user-specific data
-- Sessions - users can only see their own
DROP POLICY IF EXISTS "Allow all operations on sessions" ON sessions;
CREATE POLICY "Users can view own sessions" ON sessions
    FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users can insert own sessions" ON sessions
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own sessions" ON sessions
    FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users can delete own sessions" ON sessions
    FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- Similar policies for other tables
DROP POLICY IF EXISTS "Allow all operations on bots" ON bots;
CREATE POLICY "Users can manage own bots" ON bots
    FOR ALL USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Allow all operations on contacts" ON contacts;
CREATE POLICY "Users can manage own contacts" ON contacts
    FOR ALL USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Allow all operations on contact_groups" ON contact_groups;
CREATE POLICY "Users can manage own contact_groups" ON contact_groups
    FOR ALL USING (user_id = auth.uid() OR user_id IS NULL);

-- Add comments
COMMENT ON COLUMN sessions.user_id IS 'User who owns this session';
COMMENT ON COLUMN bots.user_id IS 'User who owns this bot';
COMMENT ON COLUMN contacts.user_id IS 'User who owns this contact';
COMMENT ON COLUMN contact_groups.user_id IS 'User who owns this contact group';

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Multi-user support added';
END $$;

