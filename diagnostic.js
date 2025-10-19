// Backend Diagnostic Script
// Run this to check if everything is configured correctly

require('dotenv').config();

console.log('========================================');
console.log('🔍 WhatsApp Platform Backend Diagnostic');
console.log('========================================\n');

// Check Node.js version
console.log('📦 Node.js Version:', process.version);
const nodeVersion = parseInt(process.version.slice(1).split('.')[0]);
if (nodeVersion >= 16) {
  console.log('   ✅ Node.js version is compatible (16+)\n');
} else {
  console.log('   ❌ Node.js version too old (need 16+)\n');
}

// Check current directory
console.log('📁 Current Directory:', __dirname);
console.log('   Expected: ...\\backend\n');

// Check environment variables
console.log('🔐 Environment Variables:');
console.log('   PORT:', process.env.PORT || '5000 (default)');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'development (default)');
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ MISSING!');
console.log('   SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ MISSING!');
console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ MISSING!\n');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('⚠️  ERROR: Missing Supabase credentials!');
  console.log('   Create a .env file with your Supabase keys\n');
}

// Check dependencies
console.log('📚 Checking Dependencies:');

const requiredDeps = [
  'express',
  'cors',
  'dotenv',
  'body-parser',
  'whatsapp-web.js',
  '@supabase/supabase-js',
  'qrcode',
  'swagger-jsdoc',
  'swagger-ui-express',
  'node-cron',
  'multer',
  'xlsx',
  'csv-parser'
];

let missingDeps = [];

requiredDeps.forEach(dep => {
  try {
    require.resolve(dep);
    console.log(`   ✅ ${dep}`);
  } catch (e) {
    console.log(`   ❌ ${dep} - MISSING!`);
    missingDeps.push(dep);
  }
});

console.log('');

if (missingDeps.length > 0) {
  console.log('⚠️  ERROR: Missing dependencies!');
  console.log('   Run: npm install ' + missingDeps.join(' ') + '\n');
}

// Check file structure
console.log('📂 Checking File Structure:');
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'src/server.js',
  'src/config/supabase.js',
  'src/config/swagger.js',
  'src/services/whatsappService.js',
  'src/services/botService.js',
  'src/services/sessionHealthCheck.js',
  'src/routes/sessionRoutes.js',
  'src/routes/messageRoutes.js',
  'src/routes/botRoutes.js',
  'src/routes/contactRoutes.js',
  'src/routes/woocommerceRoutes.js',
  'src/routes/importRoutes.js'
];

requiredFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, file))) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING!`);
  }
});

console.log('');

// Test Supabase connection
console.log('🔌 Testing Supabase Connection:');
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  supabase.from('sessions').select('count', { count: 'exact', head: true })
    .then(({ count, error }) => {
      if (error) {
        console.log('   ❌ Connection failed:', error.message);
      } else {
        console.log('   ✅ Connection successful!');
        console.log('   ✅ Found', count, 'session(s) in database\n');
      }
      
      printSummary();
    })
    .catch(err => {
      console.log('   ❌ Connection failed:', err.message, '\n');
      printSummary();
    });
} else {
  console.log('   ⚠️  Skipped (missing credentials)\n');
  printSummary();
}

function printSummary() {
  console.log('========================================');
  console.log('📋 Diagnostic Summary');
  console.log('========================================\n');
  
  if (missingDeps.length > 0) {
    console.log('❌ Action Required:');
    console.log('   npm install ' + missingDeps.join(' ') + '\n');
  }
  
  if (!process.env.SUPABASE_URL) {
    console.log('❌ Action Required:');
    console.log('   Create .env file with Supabase credentials\n');
  }
  
  if (missingDeps.length === 0 && process.env.SUPABASE_URL) {
    console.log('✅ Everything looks good!');
    console.log('   You can start the server with: npm run dev\n');
  }
  
  console.log('========================================');
}

