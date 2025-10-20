const { supabaseAdmin } = require('./src/config/supabase');

async function createWooCommerceTables() {
  try {
    console.log('🔄 Creating WooCommerce tables...');
    
    // First, let's check if the tables exist
    const { data: existingTables, error: checkError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['woocommerce_settings', 'woocommerce_notifications']);
    
    if (checkError) {
      console.log('⚠️  Could not check existing tables, proceeding...');
    } else if (existingTables && existingTables.length === 2) {
      console.log('✅ WooCommerce tables already exist!');
      return;
    }
    
    console.log('📝 Note: You may need to run this SQL manually in your Supabase dashboard:');
    console.log('');
    console.log('-- Copy and paste this into your Supabase SQL Editor:');
    console.log('');
    console.log(`CREATE TABLE IF NOT EXISTS woocommerce_settings (
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

CREATE INDEX IF NOT EXISTS idx_woocommerce_settings_user_id ON woocommerce_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_woocommerce_notifications_user_id ON woocommerce_notifications(user_id);

ALTER TABLE woocommerce_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE woocommerce_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all operations on woocommerce_settings" ON woocommerce_settings FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Allow all operations on woocommerce_notifications" ON woocommerce_notifications FOR ALL USING (true);`);
    
    console.log('');
    console.log('🔗 Go to: https://supabase.com/dashboard/project/[your-project]/sql');
    console.log('📋 Copy the SQL above and run it');
    console.log('');
    console.log('✅ After running the SQL, restart your backend server');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createWooCommerceTables();
