// Keep-alive service to prevent Render free tier from sleeping
// This will ping the server every 14 minutes (free tier sleeps after 15 minutes of inactivity)

const http = require('http');
const https = require('https');

const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // 14 minutes in milliseconds
const BACKEND_URL = process.env.BACKEND_URL || 'https://whatsapp-platform-backend.onrender.com';

let keepAliveInterval = null;

function start() {
  console.log('🔔 Starting keep-alive service...');
  console.log(`📍 Backend URL: ${BACKEND_URL}`);
  
  // Ping immediately on start
  ping();
  
  // Then ping every 14 minutes
  keepAliveInterval = setInterval(() => {
    ping();
  }, KEEP_ALIVE_INTERVAL);
  
  console.log(`✅ Keep-alive service started. Will ping every ${KEEP_ALIVE_INTERVAL / 60000} minutes.`);
}

function stop() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('🔕 Keep-alive service stopped.');
  }
}

async function ping() {
  return new Promise((resolve, reject) => {
    const protocol = BACKEND_URL.startsWith('https') ? https : http;
    const url = new URL(BACKEND_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (BACKEND_URL.startsWith('https') ? 443 : 80),
      path: '/health',
      method: 'GET',
      timeout: 5000
    };
    
    const req = protocol.request(options, (res) => {
      if (res.statusCode === 200) {
        console.log(`✅ Keep-alive ping successful at ${new Date().toISOString()}`);
        resolve();
      } else {
        console.log(`⚠️ Keep-alive ping returned status ${res.statusCode}`);
        resolve();
      }
      res.on('data', () => {});
      res.on('end', resolve);
    });
    
    req.on('error', (error) => {
      console.error(`❌ Keep-alive ping failed:`, error.message);
      resolve(); // Don't reject, just log error
    });
    
    req.on('timeout', () => {
      console.error(`❌ Keep-alive ping timed out`);
      req.destroy();
      resolve();
    });
    
    req.end();
  });
}

module.exports = {
  start,
  stop
};

