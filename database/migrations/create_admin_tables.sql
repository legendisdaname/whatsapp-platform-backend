-- Create Admin Tables for WhatsApp Platform Admin Panel

-- Admins Table
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

-- System Settings Table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users(is_blocked);

-- Enable RLS on admin tables
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now, you can tighten these later)
CREATE POLICY "Allow all operations on admins" ON admins
    FOR ALL USING (true);

CREATE POLICY "Allow all operations on system_settings" ON system_settings
    FOR ALL USING (true);

-- Insert default admin (username: admin, password: admin123)
-- Password hash for 'admin123' using bcrypt (10 rounds)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM admins WHERE username = 'admin') THEN
        INSERT INTO admins (username, email, password_hash, is_active)
        VALUES (
            'admin',
            'admin@whatsappplatform.com',
            '$2a$10$8K1p/a0dL3LzYxO7y7tOG.QqLn6GZK9vJjLj8fP8FqKYzXZ5wH9jy',
            true
        );
    END IF;
END $$;

-- Insert default system settings
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
            maintenance_mode
        )
        VALUES (
            'WhatsApp Platform',
            'admin@whatsappplatform.com',
            10,
            20,
            true,
            true,
            false
        );
    END IF;
END $$;

-- Comments
COMMENT ON TABLE admins IS 'Admin users for the platform';
COMMENT ON TABLE system_settings IS 'System-wide configuration settings';
COMMENT ON COLUMN users.is_blocked IS 'Whether the user is blocked by admin';

