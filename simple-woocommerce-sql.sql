-- Simple WooCommerce Tables SQL (No Dependencies)

CREATE TABLE IF NOT EXISTS woocommerce_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    store_url TEXT NOT NULL,
    consumer_key TEXT,
    consumer_secret TEXT,
    session_id UUID,
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

CREATE TABLE IF NOT EXISTS woocommerce_notifications (
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
CREATE INDEX IF NOT EXISTS idx_woocommerce_settings_user_id ON woocommerce_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_woocommerce_notifications_user_id ON woocommerce_notifications(user_id);

-- Enable RLS
ALTER TABLE woocommerce_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE woocommerce_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow all operations on woocommerce_settings" ON woocommerce_settings;
DROP POLICY IF EXISTS "Allow all operations on woocommerce_notifications" ON woocommerce_notifications;

-- Create policies (without IF NOT EXISTS)
CREATE POLICY "Allow all operations on woocommerce_settings" ON woocommerce_settings
    FOR ALL USING (true);

CREATE POLICY "Allow all operations on woocommerce_notifications" ON woocommerce_notifications
    FOR ALL USING (true);
