-- Create WooCommerce tables if they don't exist
-- This ensures the tables are available for the integration

-- WooCommerce Settings table
CREATE TABLE IF NOT EXISTS woocommerce_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    store_url TEXT NOT NULL,
    consumer_key TEXT,
    consumer_secret TEXT,
    session_id UUID REFERENCES sessions(id),
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

-- WooCommerce Notifications table
CREATE TABLE IF NOT EXISTS woocommerce_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    order_id VARCHAR(255),
    order_number VARCHAR(255),
    customer_phone VARCHAR(50),
    message_sent TEXT,
    status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_woocommerce_settings_user_id ON woocommerce_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_woocommerce_settings_enabled ON woocommerce_settings(enabled);
CREATE INDEX IF NOT EXISTS idx_woocommerce_notifications_user_id ON woocommerce_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_woocommerce_notifications_order ON woocommerce_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_woocommerce_notifications_status ON woocommerce_notifications(status);
CREATE INDEX IF NOT EXISTS idx_woocommerce_notifications_phone ON woocommerce_notifications(customer_phone);

-- Create updated_at trigger for woocommerce_settings
CREATE OR REPLACE FUNCTION update_woocommerce_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_woocommerce_settings_updated_at ON woocommerce_settings;
CREATE TRIGGER update_woocommerce_settings_updated_at
    BEFORE UPDATE ON woocommerce_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_woocommerce_settings_updated_at();

-- Enable RLS
ALTER TABLE woocommerce_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE woocommerce_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY IF NOT EXISTS "Allow all operations on woocommerce_settings" ON woocommerce_settings
    FOR ALL USING (true);

CREATE POLICY IF NOT EXISTS "Allow all operations on woocommerce_notifications" ON woocommerce_notifications
    FOR ALL USING (true);

-- Add comments
COMMENT ON TABLE woocommerce_settings IS 'WooCommerce integration settings and message templates';
COMMENT ON TABLE woocommerce_notifications IS 'Log of WooCommerce order notifications sent via WhatsApp';
