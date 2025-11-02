const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const botService = require('./services/botService');
const whatsappService = require('./services/whatsappService');
const sessionHealthCheck = require('./services/sessionHealthCheck');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// CORS configuration - allow all origins for maximum compatibility
const corsOptions = {
  origin: true, // Allow all origins
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-API-Key', 'x-wc-webhook-signature', 'X-WC-Webhook-Signature']
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`========================================`);
  console.log(`🚀 WhatsApp Platform API Starting...`);
  console.log(`========================================`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  const apiUrl = process.env.API_URL || 'https://whatapi.streamfinitytv.com';
  console.log(`📚 API Documentation: ${apiUrl}/api-docs`);z
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
  
  console.log('');
  console.log('========================================');
  console.log('✅ Server is ready and running!');
  console.log('========================================');
  console.log('');
});

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
  console.log(`⚠️ ${signal} signal received: closing HTTP server gracefully...`);
  
  // Stop health check
  sessionHealthCheck.stop();
  
  // Close WhatsApp clients gracefully
  try {
    const whatsappService = require('./services/whatsappService');
    const clients = whatsappService.getAllClients();
    console.log(`Closing ${clients.size} WhatsApp client(s)...`);
    
    for (const [sessionId, client] of clients) {
      try {
        await client.destroy();
        console.log(`✅ Closed client for session ${sessionId}`);
      } catch (error) {
        console.error(`❌ Error closing client ${sessionId}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error during client cleanup:', error);
  }
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
  
  // Force exit after 30 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('⚠️ Forced exit after graceful shutdown timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;

