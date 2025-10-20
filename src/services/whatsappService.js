const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const { supabaseAdmin } = require('../config/supabase');
const path = require('path');
const fs = require('fs');
const authBackupService = require('./authBackupService');

class WhatsAppService {
  constructor() {
    this.clients = new Map();
    this.keepaliveIntervals = new Map();
    
    // Ensure auth data directory exists and is persistent
    this.authDataPath = path.join(process.cwd(), '.wwebjs_auth');
    if (!fs.existsSync(this.authDataPath)) {
      fs.mkdirSync(this.authDataPath, { recursive: true });
      console.log('📁 Created auth data directory:', this.authDataPath);
    }
  }

  async createSession(sessionName, userId) {
    try {
      // Create session record in database
      const { data: session, error } = await supabaseAdmin
        .from('sessions')
        .insert([
          {
            session_name: sessionName,
            status: 'connecting',
            user_id: userId
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Initialize WhatsApp client with persistent auth
      const client = new Client({
        authStrategy: new LocalAuth({ 
          clientId: session.id,
          dataPath: this.authDataPath 
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        },
        // Increase timeout for better stability
        authTimeoutMs: 60000,
        // Enable qr refresh
        qrMaxRetries: 5
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
          last_connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      // Backup auth data (if enabled)
      await authBackupService.backupAuthData(sessionId);
      
      // Start keepalive mechanism
      this.startKeepalive(sessionId, client);
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
      
      // Stop keepalive
      this.stopKeepalive(sessionId);
      
      await supabaseAdmin
        .from('sessions')
        .update({
          status: 'disconnected',
          qr_code: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      this.clients.delete(sessionId);
      
      // Auto-reconnect after 30 seconds (only if reason is not logout)
      if (reason !== 'LOGOUT') {
        console.log(`⏰ Scheduling reconnection for session ${sessionId} in 30 seconds...`);
        setTimeout(() => {
          this.reconnectSession(sessionId);
        }, 30000);
      } else {
        console.log(`🚪 Session ${sessionId} logged out, not reconnecting automatically`);
      }
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

  async getSession(sessionId, userId) {
    const query = supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('id', sessionId);
    
    // Filter by user if userId provided
    if (userId) {
      query.eq('user_id', userId);
    }
    
    const { data, error } = await query.single();

    if (error) throw error;
    return data;
  }

  async getUserSessions(userId) {
    const query = supabaseAdmin
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Filter by user if userId provided
    if (userId) {
      query.eq('user_id', userId);
    }
    
    const { data, error } = await query;

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

  async deleteSession(sessionId, userId) {
    // Verify ownership if userId provided
    if (userId) {
      const { data: session } = await supabaseAdmin
        .from('sessions')
        .select('user_id')
        .eq('id', sessionId)
        .single();
      
      if (session && session.user_id !== userId) {
        throw new Error('Unauthorized: You do not own this session');
      }
    }
    
    const client = this.clients.get(sessionId);
    
    if (client) {
      // Stop keepalive
      this.stopKeepalive(sessionId);
      
      await client.destroy();
      this.clients.delete(sessionId);
    }
    
    // Clean up auth data
    try {
      const authPath = path.join(this.authDataPath, `session-${sessionId}`);
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log(`🗑️ Deleted auth data for session ${sessionId}`);
      }
    } catch (error) {
      console.error(`Failed to delete auth data for session ${sessionId}:`, error);
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
        authStrategy: new LocalAuth({ 
          clientId: sessionId,
          dataPath: this.authDataPath 
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        },
        authTimeoutMs: 60000,
        qrMaxRetries: 5
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
      
      // Get all sessions that were previously connected (not just currently 'connected')
      // This allows restoration even after server restart
      const { data: sessions, error } = await supabaseAdmin
        .from('sessions')
        .select('*')
        .not('phone_number', 'is', null) // Has been authenticated at least once
        .order('last_connected_at', { ascending: false, nullsFirst: false });
      
      if (error) throw error;
      
      if (sessions.length === 0) {
        console.log('No sessions to restore');
        return;
      }
      
      console.log(`Found ${sessions.length} session(s) with saved authentication`);
      
      for (const session of sessions) {
        try {
          // Check if auth data exists for this session
          const authPath = path.join(this.authDataPath, `session-${session.id}`);
          if (!fs.existsSync(authPath)) {
            console.log(`⚠️ No auth data found for ${session.session_name}, skipping`);
            continue;
          }
          
          console.log(`📱 Restoring: ${session.session_name} (${session.phone_number})`);
          
          // Mark as connecting
          await supabaseAdmin
            .from('sessions')
            .update({ status: 'connecting' })
            .eq('id', session.id);
          
          // Initialize client with saved auth
          const client = new Client({
            authStrategy: new LocalAuth({ 
              clientId: session.id,
              dataPath: this.authDataPath 
            }),
            puppeteer: {
              headless: true,
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
              ]
            },
            authTimeoutMs: 60000,
            qrMaxRetries: 5
          });
          
          this.clients.set(session.id, client);
          this.setupEventHandlers(client, session.id);
          
          await client.initialize();
          
          console.log(`✅ Session ${session.session_name} restoration initiated`);
          
          // Add delay between restorations to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 2000));
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
  
  // Keepalive mechanism to maintain connection
  startKeepalive(sessionId, client) {
    // Clear any existing interval
    this.stopKeepalive(sessionId);
    
    // Ping every 30 seconds to keep connection alive
    const interval = setInterval(async () => {
      try {
        const state = await client.getState();
        if (state === 'CONNECTED') {
          // Update last_seen in database
          await supabaseAdmin
            .from('sessions')
            .update({ 
              updated_at: new Date().toISOString(),
              last_seen: new Date().toISOString()
            })
            .eq('id', sessionId);
        } else {
          console.log(`⚠️ Session ${sessionId} not connected (state: ${state}), attempting reconnect...`);
          this.stopKeepalive(sessionId);
          await this.reconnectSession(sessionId);
        }
      } catch (error) {
        console.error(`Keepalive check failed for session ${sessionId}:`, error.message);
      }
    }, 30000); // Every 30 seconds
    
    this.keepaliveIntervals.set(sessionId, interval);
    console.log(`💓 Keepalive started for session ${sessionId}`);
  }
  
  stopKeepalive(sessionId) {
    const interval = this.keepaliveIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.keepaliveIntervals.delete(sessionId);
      console.log(`💔 Keepalive stopped for session ${sessionId}`);
    }
  }
}

module.exports = new WhatsAppService();

