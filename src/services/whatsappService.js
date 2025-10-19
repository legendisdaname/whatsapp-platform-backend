const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const { supabaseAdmin } = require('../config/supabase');

class WhatsAppService {
  constructor() {
    this.clients = new Map();
  }

  async createSession(sessionName) {
    try {
      // Create session record in database
      const { data: session, error } = await supabaseAdmin
        .from('sessions')
        .insert([
          {
            session_name: sessionName,
            status: 'connecting'
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Initialize WhatsApp client
      const client = new Client({
        authStrategy: new LocalAuth({ clientId: session.id }),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });

      // Store client instance
      this.clients.set(session.id, client);

      // Set up event handlers
      this.setupEventHandlers(client, session.id);

      // Initialize client
      await client.initialize();

      return session;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  setupEventHandlers(client, sessionId) {
    client.on('qr', async (qr) => {
      console.log(`QR Code generated for session ${sessionId}`);
      
      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(qr);

      // Update session with QR code
      await supabaseAdmin
        .from('sessions')
        .update({
          status: 'qr',
          qr_code: qrDataUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
    });

    client.on('ready', async () => {
      console.log(`Client ${sessionId} is ready!`);

      // Get phone number
      const info = client.info;
      
      await supabaseAdmin
        .from('sessions')
        .update({
          status: 'connected',
          phone_number: info.wid.user,
          qr_code: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
    });

    client.on('authenticated', async () => {
      console.log(`Client ${sessionId} authenticated`);
      
      await supabaseAdmin
        .from('sessions')
        .update({
          status: 'connecting',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
    });

    client.on('auth_failure', async (msg) => {
      console.error(`Auth failure for session ${sessionId}:`, msg);
      
      await supabaseAdmin
        .from('sessions')
        .update({
          status: 'disconnected',
          qr_code: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
    });

    client.on('disconnected', async (reason) => {
      console.log(`Client ${sessionId} disconnected:`, reason);
      
      await supabaseAdmin
        .from('sessions')
        .update({
          status: 'disconnected',
          qr_code: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      this.clients.delete(sessionId);
      
      // Auto-reconnect after 30 seconds
      console.log(`⏰ Scheduling reconnection for session ${sessionId} in 30 seconds...`);
      setTimeout(() => {
        this.reconnectSession(sessionId);
      }, 30000);
    });

    client.on('message', async (message) => {
      console.log(`Message received in session ${sessionId}:`, message.body);
      
      // Store received message
      await supabaseAdmin
        .from('received_messages')
        .insert([
          {
            session_id: sessionId,
            from: message.from,
            message: message.body,
            timestamp: new Date(message.timestamp * 1000).toISOString()
          }
        ]);
    });
  }

  async sendMessage(sessionId, to, message) {
    try {
      const client = this.clients.get(sessionId);
      
      if (!client) {
        throw new Error('Session not found or not connected');
      }

      const state = await client.getState();
      if (state !== 'CONNECTED') {
        throw new Error('WhatsApp client is not connected');
      }

      // Format phone number (remove non-digits and add country code if needed)
      let formattedNumber = to.replace(/\D/g, '');
      if (!formattedNumber.includes('@')) {
        formattedNumber = `${formattedNumber}@c.us`;
      }

      // Send message
      const sentMessage = await client.sendMessage(formattedNumber, message);

      // Log message in database
      const { data, error } = await supabaseAdmin
        .from('messages')
        .insert([
          {
            session_id: sessionId,
            to: to,
            message: message,
            status: 'sent',
            sent_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Log failed message
      await supabaseAdmin
        .from('messages')
        .insert([
          {
            session_id: sessionId,
            to: to,
            message: message,
            status: 'failed'
          }
        ]);

      throw error;
    }
  }

  async getSession(sessionId) {
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) throw error;
    return data;
  }

  async getAllSessions() {
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async deleteSession(sessionId) {
    const client = this.clients.get(sessionId);
    
    if (client) {
      await client.destroy();
      this.clients.delete(sessionId);
    }

    const { error } = await supabaseAdmin
      .from('sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;
  }

  getClient(sessionId) {
    return this.clients.get(sessionId);
  }

  async reconnectSession(sessionId) {
    try {
      console.log(`🔄 Attempting to reconnect session ${sessionId}...`);
      
      // Check if session exists in database
      const session = await this.getSession(sessionId);
      if (!session) {
        console.log(`Session ${sessionId} not found in database, skipping reconnection`);
        return;
      }
      
      // Don't reconnect if client already exists
      if (this.clients.has(sessionId)) {
        console.log(`Session ${sessionId} already has active client`);
        return;
      }
      
      // Mark as connecting
      await supabaseAdmin
        .from('sessions')
        .update({ status: 'connecting' })
        .eq('id', sessionId);
      
      // Initialize new client with same ID (reuses saved auth)
      const client = new Client({
        authStrategy: new LocalAuth({ clientId: sessionId }),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });
      
      this.clients.set(sessionId, client);
      this.setupEventHandlers(client, sessionId);
      
      await client.initialize();
      console.log(`✅ Reconnection initiated for session ${sessionId}`);
    } catch (error) {
      console.error(`❌ Failed to reconnect session ${sessionId}:`, error);
      
      // Mark as disconnected
      await supabaseAdmin
        .from('sessions')
        .update({ status: 'disconnected' })
        .eq('id', sessionId);
      
      // Retry after 5 minutes
      console.log(`⏰ Will retry reconnection for ${sessionId} in 5 minutes...`);
      setTimeout(() => {
        this.reconnectSession(sessionId);
      }, 300000);
    }
  }

  async restoreAllSessions() {
    try {
      console.log('🔄 Restoring previous sessions...');
      
      // Get all previously connected sessions
      const { data: sessions, error } = await supabaseAdmin
        .from('sessions')
        .select('*')
        .eq('status', 'connected');
      
      if (error) throw error;
      
      if (sessions.length === 0) {
        console.log('No sessions to restore');
        return;
      }
      
      console.log(`Found ${sessions.length} session(s) to restore`);
      
      for (const session of sessions) {
        try {
          console.log(`📱 Restoring: ${session.session_name} (${session.phone_number})`);
          
          // Mark as connecting
          await supabaseAdmin
            .from('sessions')
            .update({ status: 'connecting' })
            .eq('id', session.id);
          
          // Initialize client with saved auth
          const client = new Client({
            authStrategy: new LocalAuth({ clientId: session.id }),
            puppeteer: {
              headless: true,
              args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
          });
          
          this.clients.set(session.id, client);
          this.setupEventHandlers(client, session.id);
          
          await client.initialize();
          
          console.log(`✅ Session ${session.session_name} restoration initiated`);
        } catch (error) {
          console.error(`❌ Failed to restore session ${session.id}:`, error);
          
          // Mark as disconnected
          await supabaseAdmin
            .from('sessions')
            .update({ status: 'disconnected' })
            .eq('id', session.id);
        }
      }
      
      console.log('✅ Session restoration complete');
    } catch (error) {
      console.error('❌ Error restoring sessions:', error);
    }
  }
}

module.exports = new WhatsAppService();

