-- Add API Key support for users
-- This allows users to authenticate API requests using their API key

-- Add api_key column to users table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'api_key'
    ) THEN
        ALTER TABLE users ADD COLUMN api_key TEXT UNIQUE;
    END IF;
END $$;

-- Create index for faster API key lookups
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ API Key column added to users table!';
    RAISE NOTICE 'Users can now authenticate using API keys';
END $$;

