-- ========================================
-- QUICK ADMIN PANEL SETUP
-- Copy this entire file and run in Supabase SQL Editor
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CREATE ADMINS TABLE
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

-- 2. CREATE SYSTEM SETTINGS TABLE
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

-- 3. ADD is_blocked COLUMN TO USERS TABLE
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_blocked'
    ) THEN
        ALTER TABLE users ADD COLUMN is_blocked BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 4. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users(is_blocked);

-- 5. ENABLE ROW LEVEL SECURITY
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist
DROP POLICY IF EXISTS "Allow all operations on admins" ON admins;
DROP POLICY IF EXISTS "Allow all operations on system_settings" ON system_settings;

-- 6. CREATE POLICIES
CREATE POLICY "Allow all operations on admins" ON admins
    FOR ALL USING (true);

CREATE POLICY "Allow all operations on system_settings" ON system_settings
    FOR ALL USING (true);

-- 7. INSERT DEFAULT ADMIN (Username: admin, Password: admin123)
INSERT INTO admins (username, email, password_hash, is_active)
SELECT 
    'admin',
    'admin@whatsappplatform.com',
    '$2a$10$8K1p/a0dL3LzYxO7y7tOG.QqLn6GZK9vJjLj8fP8FqKYzXZ5wH9jy',
    true
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE username = 'admin');

-- 8. INSERT DEFAULT SYSTEM SETTINGS
INSERT INTO system_settings (
    platform_name,
    admin_email,
    max_sessions_per_user,
    max_bots_per_user,
    enable_user_registration,
    enable_email_notifications,
    maintenance_mode
)
SELECT 
    'WhatsApp Platform',
    'admin@whatsappplatform.com',
    10,
    20,
    true,
    true,
    false
WHERE NOT EXISTS (SELECT 1 FROM system_settings LIMIT 1);

-- 9. VERIFY SETUP
DO $$ 
DECLARE
    admin_count INTEGER;
    settings_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM admins;
    SELECT COUNT(*) INTO settings_count FROM system_settings;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ADMIN PANEL SETUP COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Admin accounts created: %', admin_count;
    RAISE NOTICE 'System settings created: %', settings_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DEFAULT LOGIN CREDENTIALS:';
    RAISE NOTICE 'Username: admin';
    RAISE NOTICE 'Password: admin123';
    RAISE NOTICE '⚠️  CHANGE PASSWORD IMMEDIATELY!';
    RAISE NOTICE '========================================';
END $$;

-- 10. DISPLAY CREATED ADMIN
SELECT 
    username,
    email,
    is_active,
    created_at
FROM admins;

