const fs = require('fs');
const path = require('path');

// Simple script to apply WooCommerce migration
async function applyWooCommerceMigration() {
  try {
    const { createClient } = require('@supabase/supabase-js');
    
    // Get Supabase credentials from environment
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials in environment variables');
      console.log('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'database', 'migrations', 'create_woocommerce_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔄 Applying WooCommerce migration...');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      return;
    }
    
    console.log('✅ WooCommerce migration applied successfully!');
    console.log('📊 Tables created: woocommerce_settings, woocommerce_notifications');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error);
  }
}

// Run the migration
applyWooCommerceMigration();
