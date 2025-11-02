const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERROR: Missing required Supabase environment variables!');
  console.error('   SUPABASE_URL:', supabaseUrl ? '✅' : '❌ MISSING');
  console.error('   SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅' : '❌ MISSING');
  throw new Error('Missing required Supabase configuration');
}

// Client for public operations
let supabase = null;
try {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('✅ Supabase client initialized');
} catch (error) {
  console.error('❌ Failed to initialize Supabase client:', error.message);
  throw error;
}

// Admin client for service-level operations
// Only create if service key is available
let supabaseAdmin = null;
if (supabaseUrl && supabaseServiceKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Supabase Admin client initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Supabase Admin client:', error.message);
    console.warn('⚠️  Admin operations will fail without service role key');
  }
} else {
  console.warn('⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY not set. Admin operations will fail.');
  console.warn('   Make sure SUPABASE_SERVICE_ROLE_KEY is set in your .env file');
}

// Connection verification function
async function verifySupabaseConnection() {
  if (!supabaseAdmin) {
    console.error('❌ Cannot verify connection: Supabase Admin client not initialized');
    return { success: false, error: 'Admin client not initialized' };
  }

  try {
    // Test connection by querying a simple table (sessions table is most common)
    const { data, error, count } = await supabaseAdmin
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      console.error('❌ Supabase connection test failed:', error.message);
      return { 
        success: false, 
        error: error.message,
        code: error.code 
      };
    }

    console.log(`✅ Supabase connection verified successfully (found ${count || 0} session(s))`);
    return { 
      success: true, 
      message: 'Connection verified',
      sessionCount: count || 0
    };
  } catch (error) {
    console.error('❌ Supabase connection test error:', error.message);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Verify connection on module load (async, won't block)
if (supabaseAdmin) {
  // Run verification after a short delay to ensure everything is ready
  setTimeout(async () => {
    await verifySupabaseConnection();
  }, 1000);
}

module.exports = { supabase, supabaseAdmin, verifySupabaseConnection };
