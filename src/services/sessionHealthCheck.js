const cron = require('node-cron');
const whatsappService = require('./whatsappService');
const { supabaseAdmin } = require('../config/supabase');

class SessionHealthCheck {
  constructor() {
    this.healthCheckJob = null;
    this.reconnectAttempts = new Map(); // Track reconnection attempts
  }
  
  start() {
    // Check all sessions every 5 minutes
    this.healthCheckJob = cron.schedule('*/5 * * * *', async () => {
      console.log('🔍 Running session health check...');
      await this.checkAllSessions();
    });
    
    console.log('✅ Session health check started (every 5 minutes)');
  }
  
  async checkAllSessions() {
    try {
      // Get all sessions that should be connected
      const { data: sessions, error } = await supabaseAdmin
        .from('sessions')
        .select('*')
        .in('status', ['connected', 'connecting']);
      
      if (error) throw error;
      
      if (sessions.length === 0) {
        console.log('No active sessions to check');
        return;
      }
      
      console.log(`Checking ${sessions.length} session(s)...`);
      
      for (const session of sessions) {
        await this.checkSession(session);
      }
    } catch (error) {
      console.error('❌ Health check error:', error);
    }
  }
  
  async checkSession(session) {
    try {
      const client = whatsappService.getClient(session.id);
      
      // No client instance found
      if (!client) {
        console.log(`⚠️ Session ${session.session_name} has no client instance`);
        
        // If marked as connected but no client, try to restore
        if (session.status === 'connected') {
          console.log(`🔄 Attempting to restore session ${session.id}...`);
          await whatsappService.reconnectSession(session.id);
        }
        return;
      }
      
      // Check client state
      const state = await client.getState();
      
      if (state === 'CONNECTED') {
        console.log(`✅ Session ${session.session_name} is healthy`);
        this.reconnectAttempts.delete(session.id); // Reset attempts
        return;
      }
      
      // Handle problematic states
      if (state === 'CONFLICT' || state === 'UNPAIRED') {
        console.log(`⚠️ Session ${session.session_name} in state: ${state}`);
        
        // Update database
        await supabaseAdmin
          .from('sessions')
          .update({ 
            status: 'disconnected',
            qr_code: null
          })
          .eq('id', session.id);
        
        console.log(`Session ${session.id} needs QR scan (state: ${state})`);
        return;
      }
      
      // Check if we can get client info
      try {
        const info = await client.info;
        if (info) {
          console.log(`✅ Session ${session.session_name} verified with info`);
        }
      } catch (error) {
        console.log(`⚠️ Session ${session.id} info check failed:`, error.message);
      }
      
    } catch (error) {
      console.error(`❌ Health check failed for session ${session.id}:`, error.message);
    }
  }
  
  stop() {
    if (this.healthCheckJob) {
      this.healthCheckJob.stop();
      console.log('Session health check stopped');
    }
  }
}

module.exports = new SessionHealthCheck();

