-- Safe WooCommerce Migration SQL
-- This handles existing tables and creates new ones safely

-- First, let's drop existing tables if they exist (to start fresh)
DROP TABLE IF EXISTS woocommerce_notifications CASCADE;
DROP TABLE IF EXISTS woocommerce_settings CASCADE;

-- Now create the tables with the correct structure
CREATE TABLE woocommerce_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    store_url TEXT NOT NULL,
    consumer_key TEXT,
    consumer_secret TEXT,
    session_id TEXT,
    order_created_template TEXT,
    order_processing_template TEXT,
    order_completed_template TEXT,
    order_hold_template TEXT,
    order_cancelled_template TEXT,
    order_status_change_template TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE woocommerce_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    order_id VARCHAR(255),
    order_number VARCHAR(255),
    customer_phone VARCHAR(50),
    message_sent TEXT,
    status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_woocommerce_settings_user_id ON woocommerce_settings(user_id);
CREATE INDEX idx_woocommerce_notifications_user_id ON woocommerce_notifications(user_id);

-- Enable RLS
ALTER TABLE woocommerce_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE woocommerce_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations on woocommerce_settings" ON woocommerce_settings
    FOR ALL USING (true);

CREATE POLICY "Allow all operations on woocommerce_notifications" ON woocommerce_notifications
    FOR ALL USING (true);

-- Add some helpful comments
COMMENT ON TABLE woocommerce_settings IS 'WooCommerce integration settings';
COMMENT ON TABLE woocommerce_notifications IS 'WooCommerce order notifications log';
