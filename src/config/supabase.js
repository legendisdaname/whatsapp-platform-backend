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

module.exports = { supabase, supabaseAdmin };
