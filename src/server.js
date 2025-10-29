const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const botService = require('./services/botService');
const whatsappService = require('./services/whatsappService');
const sessionHealthCheck = require('./services/sessionHealthCheck');
const keepAlive = require('./services/keepAlive');
require('dotenv').config();

// Validate required environment variables
function validateEnvVars() {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n⚠️ Server will start but some features may not work.');
    console.error('💡 Set these in Render Dashboard > Environment tab\n');
  } else {
    console.log('✅ All required environment variables are set');
  }
}

// Run validation
validateEnvVars();

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL
].filter(Boolean); // Remove undefined values

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
};

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Routes
const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const messageRoutes = require('./routes/messageRoutes');
const botRoutes = require('./routes/botRoutes');
const contactRoutes = require('./routes/contactRoutes');
const woocommerceRoutes = require('./routes/woocommerceRoutes');
const importRoutes = require('./routes/importRoutes');
const apiKeyRoutes = require('./routes/apiKeyRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminTestRoutes = require('./routes/adminTestRoutes');
const setupRoutes = require('./routes/setupRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/woocommerce', woocommerceRoutes);
app.use('/api/import', importRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin-test', adminTestRoutes);
app.use('/api/admin/setup', setupRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'WhatsApp Platform API is running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'WhatsApp Platform API',
    version: '1.0.0',
    documentation: '/api-docs',
    endpoints: {
      sessions: '/api/sessions',
      messages: '/api/messages',
      bots: '/api/bots',
      contacts: '/api/contacts',
      woocommerce: '/api/woocommerce',
      import: '/api/import',
      health: '/health'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // In production, don't expose internal error details
  const isDevelopment = NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    success: false,
    error: 'Internal server error',
    message: isDevelopment ? err.message : 'An error occurred. Please try again later.',
    ...(isDevelopment && { stack: err.stack })
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`========================================`);
  console.log(`🚀 WhatsApp Platform API Starting...`);
  console.log(`========================================`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`========================================`);
  
  // Restore previous WhatsApp sessions (with delay to ensure everything is ready)
  console.log('');
  console.log('🔄 Step 1: Restoring WhatsApp sessions...');
  setTimeout(async () => {
    try {
      await whatsappService.restoreAllSessions();
    } catch (error) {
      console.error('❌ Failed to restore sessions:', error);
    }
  }, 3000); // Wait 3 seconds before restoring
  
  // Initialize active bots
  console.log('');
  console.log('🤖 Step 2: Initializing active bots...');
  setTimeout(async () => {
    try {
      await botService.initializeActiveBots();
    } catch (error) {
      console.error('❌ Failed to initialize bots:', error);
    }
  }, 5000); // Wait 5 seconds before initializing bots
  
  // Start session health monitoring
  console.log('');
  console.log('💊 Step 3: Starting session health monitoring...');
  setTimeout(() => {
    try {
      sessionHealthCheck.start();
    } catch (error) {
      console.error('❌ Failed to start health check:', error);
    }
  }, 10000); // Wait 10 seconds before starting health check
  
  // Start keep-alive service (only in production)
  console.log('');
  console.log('🔔 Step 4: Starting keep-alive service...');
  setTimeout(() => {
    try {
      keepAlive.start();
    } catch (error) {
      console.error('❌ Failed to start keep-alive:', error);
    }
  }, 15000); // Wait 15 seconds before starting keep-alive
  
  console.log('');
  console.log('========================================');
  console.log('✅ Server is ready and running!');
  console.log('========================================');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM signal received: closing HTTP server gracefully...');
  
  // Stop health check
  sessionHealthCheck.stop();
  
  // Stop keep-alive
  keepAlive.stop();
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;

