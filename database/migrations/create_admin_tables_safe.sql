-- Safe Admin Tables Migration for WhatsApp Platform
-- This version checks everything before creating

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations on admins" ON admins;
DROP POLICY IF EXISTS "Allow all operations on system_settings" ON system_settings;

-- Drop existing tables (CAREFUL - this deletes data!)
-- Comment these out if you want to keep existing data
-- DROP TABLE IF EXISTS admins CASCADE;
-- DROP TABLE IF EXISTS system_settings CASCADE;

-- Create Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- Add is_blocked column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_blocked'
    ) THEN
        ALTER TABLE users ADD COLUMN is_blocked BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_name VARCHAR(255) DEFAULT 'WhatsApp Platform',
    admin_email VARCHAR(255),
    max_sessions_per_user INTEGER DEFAULT 10,
    max_bots_per_user INTEGER DEFAULT 20,
    enable_user_registration BOOLEAN DEFAULT true,
    enable_email_notifications BOOLEAN DEFAULT true,
    maintenance_mode BOOLEAN DEFAULT false,
    maintenance_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes (safe - won't error if exists)
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users(is_blocked);

-- Enable RLS on admin tables
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations on admins" ON admins
    FOR ALL USING (true);

CREATE POLICY "Allow all operations on system_settings" ON system_settings
    FOR ALL USING (true);

-- Insert default admin ONLY if table is empty
-- Username: admin, Password: admin123
-- Password hash generated with: bcrypt.hash('admin123', 10)
DO $$ 
BEGIN
    -- Check if admins table is empty
    IF NOT EXISTS (SELECT 1 FROM admins LIMIT 1) THEN
        INSERT INTO admins (username, email, password_hash, is_active)
        VALUES (
            'admin',
            'admin@whatsappplatform.com',
            '$2a$10$8K1p/a0dL3LzYxO7y7tOG.QqLn6GZK9vJjLj8fP8FqKYzXZ5wH9jy',
            true
        );
        RAISE NOTICE 'Default admin account created: username=admin, password=admin123';
    ELSE
        RAISE NOTICE 'Admin table not empty - skipping default account creation';
    END IF;
END $$;

-- Insert default system settings ONLY if table is empty
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM system_settings LIMIT 1) THEN
        INSERT INTO system_settings (
            platform_name,
            admin_email,
            max_sessions_per_user,
            max_bots_per_user,
            enable_user_registration,
            enable_email_notifications,
            maintenance_mode,
            maintenance_message
        )
        VALUES (
            'WhatsApp Platform',
            'admin@whatsappplatform.com',
            10,
            20,
            true,
            true,
            false,
            ''
        );
        RAISE NOTICE 'Default system settings created';
    ELSE
        RAISE NOTICE 'System settings already exist - skipping';
    END IF;
END $$;

-- Add helpful comments
COMMENT ON TABLE admins IS 'Admin users for the platform';
COMMENT ON TABLE system_settings IS 'System-wide configuration settings';
COMMENT ON COLUMN users.is_blocked IS 'Whether the user is blocked by admin';

-- Display success message
DO $$ 
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Admin panel tables created successfully!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Default Credentials:';
    RAISE NOTICE 'Username: admin';
    RAISE NOTICE 'Password: admin123';
    RAISE NOTICE 'IMPORTANT: Change password after first login!';
    RAISE NOTICE '===========================================';
END $$;

