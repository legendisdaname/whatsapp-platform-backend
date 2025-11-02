const cron = require('node-cron');
const whatsappService = require('./whatsappService');
const { supabaseAdmin } = require('../config/supabase');

class SessionHealthCheck {
  constructor() {
    this.healthCheckJob = null;
    this.reconnectAttempts = new Map(); // Track reconnection attempts
  }
  
  start() {
    // Check all sessions every 3 minutes for faster recovery
    // This ensures disconnected sessions are detected and reconnected quickly
    this.healthCheckJob = cron.schedule('*/3 * * * *', async () => {
      console.log('🔍 Running session health check...');
      await this.checkAllSessions();
    });
    
    console.log('✅ Session health check started (every 3 minutes)');
  }
  
  async checkAllSessions() {
    try {
      // Get ALL sessions that have been authenticated before (have phone_number)
      // This includes disconnected sessions - we'll try to reconnect them
      const { data: sessions, error } = await supabaseAdmin
        .from('sessions')
        .select('*')
        .not('phone_number', 'is', null) // Only sessions that have been authenticated
        .in('status', ['connected', 'connecting', 'disconnected']); // Include disconnected too
      
      if (error) throw error;
      
      if (sessions.length === 0) {
        console.log('No authenticated sessions to check');
        return;
      }
      
      console.log(`Checking ${sessions.length} session(s) (including disconnected ones for auto-reconnect)...`);
      
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
      
      // No client instance found - try to restore regardless of status
      if (!client) {
        console.log(`⚠️ Session ${session.session_name} has no client instance`);
        
        // If session has been authenticated before (has phone_number), always try to restore
        if (session.phone_number) {
          console.log(`🔄 Attempting to restore session ${session.id} (was authenticated before)...`);
          await whatsappService.reconnectSession(session.id).catch(error => {
            console.error(`Failed to restore session ${session.id}:`, error.message);
          });
        }
        return;
      }
      
      // Check client state
      const state = await client.getState();
      
      if (state === 'CONNECTED') {
        console.log(`✅ Session ${session.session_name} is healthy`);
        this.reconnectAttempts.delete(session.id); // Reset attempts
        
        // Update status if it was marked as disconnected
        if (session.status !== 'connected') {
          await supabaseAdmin
            .from('sessions')
            .update({ 
              status: 'connected',
              updated_at: new Date().toISOString()
            })
            .eq('id', session.id);
        }
        return;
      }
      
      // If state is DISCONNECTED or OPENING, try to reconnect
      if (state === 'DISCONNECTED' || state === 'OPENING') {
        console.log(`⚠️ Session ${session.session_name} is ${state}, attempting reconnection...`);
        await whatsappService.reconnectSession(session.id).catch(error => {
          console.error(`Health check reconnection failed for ${session.id}:`, error.message);
        });
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

