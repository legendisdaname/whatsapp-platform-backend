-- WhatsApp Platform Database Schema for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    status VARCHAR(50) DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'qr')),
    qr_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table (outgoing)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    to VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Received messages table
CREATE TABLE IF NOT EXISTS received_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    "from" VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bots table
CREATE TABLE IF NOT EXISTS bots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    schedule_pattern VARCHAR(100),
    target_numbers TEXT[] NOT NULL,
    message_template TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot executions table (for logging)
CREATE TABLE IF NOT EXISTS bot_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    results JSONB
);

-- Contact groups table
CREATE TABLE IF NOT EXISTS contact_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    phone_number VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, phone_number)
);

-- Contact group members (many-to-many relationship)
CREATE TABLE IF NOT EXISTS contact_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES contact_groups(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, contact_id)
);

-- WooCommerce settings table
CREATE TABLE IF NOT EXISTS woocommerce_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    store_url VARCHAR(500),
    webhook_secret VARCHAR(255),
    order_created_template TEXT DEFAULT 'Hello {customer_name}! 🎉

Thank you for your order!

📦 Order #{order_number}
💰 Total: {currency} {total}
📅 Date: {order_date}

Items:
{items}

We''ll keep you updated on your order status!

Thank you for shopping with us! ❤️',
    order_processing_template TEXT DEFAULT 'Hello {customer_name}!

Your order #{order_number} is now being processed! 📦

We''re preparing your items and will notify you once they''re shipped.',
    order_completed_template TEXT DEFAULT 'Hello {customer_name}!

Your order #{order_number} has been completed! 🎉

Thank you for your purchase!',
    order_hold_template TEXT DEFAULT 'Hello {customer_name}!

Your order #{order_number} is currently on hold.

Please contact us for more information.',
    order_cancelled_template TEXT DEFAULT 'Hello {customer_name}!

Your order #{order_number} has been cancelled.

If you have any questions, please contact us.',
    order_status_change_template TEXT DEFAULT 'Hello {customer_name}!

Your order #{order_number} status has been updated to: {status}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WooCommerce notifications log
CREATE TABLE IF NOT EXISTS woocommerce_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id BIGINT,
    order_number VARCHAR(100),
    customer_phone VARCHAR(50),
    message_sent TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_received_messages_session ON received_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_bots_session ON bots(session_id);
CREATE INDEX IF NOT EXISTS idx_bots_active ON bots(is_active);
CREATE INDEX IF NOT EXISTS idx_bot_executions_bot ON bot_executions(bot_id);
CREATE INDEX IF NOT EXISTS idx_contact_groups_session ON contact_groups(session_id);
CREATE INDEX IF NOT EXISTS idx_contacts_session ON contacts(session_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contact_group_members_group ON contact_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_contact_group_members_contact ON contact_group_members(contact_id);
CREATE INDEX IF NOT EXISTS idx_woocommerce_notifications_order ON woocommerce_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_woocommerce_notifications_status ON woocommerce_notifications(status);
CREATE INDEX IF NOT EXISTS idx_woocommerce_notifications_phone ON woocommerce_notifications(customer_phone);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bots_updated_at
    BEFORE UPDATE ON bots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_groups_updated_at
    BEFORE UPDATE ON contact_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_woocommerce_settings_updated_at
    BEFORE UPDATE ON woocommerce_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE received_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE woocommerce_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE woocommerce_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your authentication needs)
-- For now, allowing all operations for authenticated users

CREATE POLICY "Allow all operations on sessions" ON sessions
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on messages" ON messages
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on received_messages" ON received_messages
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on bots" ON bots
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on bot_executions" ON bot_executions
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on contact_groups" ON contact_groups
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on contacts" ON contacts
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on contact_group_members" ON contact_group_members
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on woocommerce_settings" ON woocommerce_settings
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on woocommerce_notifications" ON woocommerce_notifications
    FOR ALL USING (true) WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE sessions IS 'Stores WhatsApp session information';
COMMENT ON TABLE messages IS 'Stores outgoing messages';
COMMENT ON TABLE received_messages IS 'Stores incoming messages';
COMMENT ON TABLE bots IS 'Stores automated bot configurations';
COMMENT ON TABLE bot_executions IS 'Logs bot execution history';
COMMENT ON TABLE contact_groups IS 'Stores contact groups for organizing contacts';
COMMENT ON TABLE contacts IS 'Stores individual contact information';
COMMENT ON TABLE contact_group_members IS 'Links contacts to groups (many-to-many relationship)';
COMMENT ON TABLE woocommerce_settings IS 'WooCommerce integration settings and message templates';
COMMENT ON TABLE woocommerce_notifications IS 'Log of WooCommerce order notifications sent via WhatsApp';

