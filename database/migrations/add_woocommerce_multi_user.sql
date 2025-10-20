-- Add user_id to WooCommerce tables for multi-user support

-- Update woocommerce_settings table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'woocommerce_settings' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE woocommerce_settings ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Update woocommerce_notifications table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'woocommerce_notifications' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE woocommerce_notifications ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_woocommerce_settings_user_id ON woocommerce_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_woocommerce_notifications_user_id ON woocommerce_notifications(user_id);

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ WooCommerce multi-user support added!';
END $$;

