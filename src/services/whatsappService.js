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
      
      // Start keepalive mechanism immediately
      // This is critical to prevent disconnection
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
      
      // Stop keepalive (it will restart after reconnection)
      this.stopKeepalive(sessionId);
      
      await supabaseAdmin
        .from('sessions')
        .update({
          status: 'disconnected',
          qr_code: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      // Remove old client from map immediately to allow reconnection
      this.clients.delete(sessionId);
      
      // Auto-reconnect more aggressively (only if reason is not logout)
      if (reason !== 'LOGOUT') {
        console.log(`⏰ Scheduling reconnection for session ${sessionId} in 10 seconds...`);
        
        // Reconnect sooner (10 seconds instead of 30) to minimize downtime
        setTimeout(async () => {
          try {
            await this.reconnectSession(sessionId);
          } catch (error) {
            console.error(`Failed to reconnect ${sessionId} after disconnect:`, error.message);
            // Retry again after 2 minutes if first attempt fails
            setTimeout(() => {
              this.reconnectSession(sessionId).catch(err => {
                console.error(`Second reconnect attempt failed for ${sessionId}:`, err.message);
              });
            }, 120000);
          }
        }, 10000); // 10 seconds - faster reconnection
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

      // Format phone number - automatically add @c.us if not already present
      // This ensures users can send messages by providing just the phone number with country code
      // Examples: "+212 665-927999" -> "212665927999@c.us"
      //          "+212 0655-927999" -> "212655927999@c.us" (removes leading zero)
      //          "1234567890" -> "1234567890@c.us"
      //          "1234567890@c.us" -> "1234567890@c.us" (already formatted)
      
      /**
       * Normalize international phone number for WhatsApp
       * Handles various formats including numbers with leading zeros after country code
       * @param {string} phoneNumber - Raw phone number in any format
       * @returns {string} - Normalized digits only (without @c.us)
       */
      const normalizePhoneNumber = (phoneNumber) => {
        // Remove all non-digit characters to get just the digits
        let digits = phoneNumber.replace(/\D/g, '');
        
        if (!digits || digits.length < 8) {
          return null;
        }
        
        // Handle leading zeros after country codes (common in international formats)
        // This pattern handles cases like: +212 0655... where 0 should be removed
        // Country codes are typically 1-3 digits, so we check positions 1-5 for a leading zero
        // Common patterns:
        // - 1-digit country code: 1-2 digit, then potential 0
        // - 2-digit country code: 2-3 digit, then potential 0  
        // - 3-digit country code: 3-4 digit, then potential 0
        
        // Check if number starts with common country codes and has a leading zero after
        // Most common: numbers starting with 1-3 digits (country code) followed by 0
        // IMPORTANT: Check patterns in reverse order (3-digit first) to catch longer codes first
        // This prevents false matches with shorter country codes
        const countryCodePatterns = [
          /^(\d{3})(0)(\d{5,})/,  // 3-digit country code followed by 0 (common for countries like 212, 234, etc.)
          /^(\d{2})(0)(\d{6,})/,  // 2-digit country code followed by 0 (common)
          /^(\d{1})(0)(\d{7,})/,  // 1-digit country code followed by 0 (rare but possible)
        ];
        
        for (const pattern of countryCodePatterns) {
          const match = digits.match(pattern);
          if (match) {
            // Remove the leading zero after country code
            const countryCode = match[1];
            const rest = match[3];
            
            // Validate: the resulting number should be reasonable (7-15 digits total)
            const normalized = countryCode + rest;
            if (normalized.length >= 7 && normalized.length <= 15) {
              console.log(`[normalizePhoneNumber] Removed leading zero: ${digits} -> ${normalized}`);
              return normalized;
            }
          }
        }
        
        // If no pattern matched, return digits as-is (might be already formatted correctly)
        return digits;
      };
      
      let formattedNumber = String(to).trim();
      console.log(`[sendMessage] Original phone number: "${to}"`);
      
      // Check if it's already a WhatsApp ID format
      if (formattedNumber.includes('@g.us')) {
        // Group number - keep @g.us format, just clean the ID part
        const parts = formattedNumber.split('@');
        const cleanedId = parts[0].replace(/[^0-9]/g, '');
        formattedNumber = `${cleanedId}@g.us`;
        console.log(`[sendMessage] Detected group number, formatted: ${formattedNumber}`);
      } else if (formattedNumber.includes('@c.us')) {
        // Already has @c.us, just clean any non-digits before @
        const parts = formattedNumber.split('@');
        const digitsOnly = parts[0].replace(/\D/g, '');
        formattedNumber = `${digitsOnly}@c.us`;
        console.log(`[sendMessage] Already had @c.us, formatted: ${formattedNumber}`);
      } else {
        // No @ found - normalize and add @c.us automatically
        const normalizedDigits = normalizePhoneNumber(formattedNumber);
        
        if (!normalizedDigits) {
          throw new Error(`Invalid phone number: "${to}". Must contain at least 8 digits after normalization.`);
        }
        
        // Automatically add @c.us suffix for individual contacts
        formattedNumber = `${normalizedDigits}@c.us`;
        console.log(`[sendMessage] Normalized and auto-added @c.us, formatted: ${formattedNumber}`);
      }
      
      console.log(`[sendMessage] Final formatted number: ${to} -> ${formattedNumber}`);
      
      // Validate formatted number (should be at least 8 digits + @c.us = minimum 13 characters)
      if (!formattedNumber || formattedNumber.length < 13) {
        throw new Error(`Invalid phone number format after processing: ${formattedNumber}`);
      }

      // Send message using whatsapp-web.js
      console.log(`[sendMessage] Attempting to send message to: ${formattedNumber}`);
      console.log(`[sendMessage] Message content length: ${message.length} characters`);
      
      let sentMessage;
      try {
        sentMessage = await client.sendMessage(formattedNumber, message);
        console.log(`[sendMessage] ✅ Message sent successfully to ${formattedNumber}`);
        console.log(`[sendMessage] Sent message ID: ${sentMessage.id?._serialized || sentMessage.id || 'N/A'}`);
      } catch (sendError) {
        console.error(`[sendMessage] ❌ Error from whatsapp-web.js:`, sendError);
        console.error(`[sendMessage] Error details:`, {
          message: sendError.message,
          stack: sendError.stack,
          name: sendError.name,
          formattedNumber: formattedNumber,
          originalNumber: to
        });
        
        // Provide more helpful error messages based on common whatsapp-web.js errors
        if (sendError.message && (sendError.message.includes('not found') || sendError.message.includes('not exist'))) {
          throw new Error(`Phone number ${formattedNumber} is not registered on WhatsApp. Please ensure the number exists and has WhatsApp installed. Original: ${to}`);
        }
        
        if (sendError.message && sendError.message.includes('phone')) {
          throw new Error(`Invalid phone number format: ${formattedNumber}. Original: ${to}`);
        }
        
        if (sendError.message && sendError.message.includes('number')) {
          throw new Error(`Phone number error: ${sendError.message}. Formatted: ${formattedNumber}, Original: ${to}`);
        }
        
        // Re-throw with more context
        throw new Error(`Failed to send message: ${sendError.message}. Number: ${formattedNumber} (original: ${to})`);
      }

      // Log message in database
      const messageData = {
        session_id: sessionId,
        to: to, // Store original number
        message: message,
        status: 'sent',
        sent_at: new Date().toISOString()
      };

      const { data, error } = await supabaseAdmin
        .from('messages')
        .insert([messageData])
        .select()
        .single();

      if (error) {
        console.error(`[sendMessage] Database error:`, error);
        // Don't throw here - message was sent successfully, just couldn't log it
        console.warn(`[sendMessage] Message sent but failed to log in database`);
      }

      return {
        ...(data || {}),
        formatted_number: formattedNumber,
        whatsapp_message_id: sentMessage?.id?._serialized || sentMessage?.id
      };
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

  getAllClients() {
    return this.clients;
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
      
      // Note: Keepalive will be started automatically in the 'ready' event handler
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
          // LocalAuth uses clientId as folder name directly (not session-{id})
          const authPath = path.join(this.authDataPath, session.id);
          const authExists = fs.existsSync(authPath) && fs.existsSync(path.join(authPath, 'Default'));
          if (!authExists) {
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
  
  // Enhanced keepalive mechanism to maintain connection
  startKeepalive(sessionId, client) {
    // Clear any existing interval
    this.stopKeepalive(sessionId);
    
    // More frequent ping every 20 seconds to keep connection alive
    // WhatsApp Web typically disconnects after ~30-60 seconds of inactivity
    const interval = setInterval(async () => {
      try {
        // Check if client still exists
        const currentClient = this.clients.get(sessionId);
        if (!currentClient || currentClient !== client) {
          console.log(`⚠️ Client instance changed for session ${sessionId}, stopping keepalive`);
          this.stopKeepalive(sessionId);
          return;
        }

        // Get current state
        let state;
        try {
          state = await client.getState();
        } catch (stateError) {
          // If getState fails, connection is likely lost
          console.log(`⚠️ Cannot get state for session ${sessionId}: ${stateError.message}`);
          throw new Error('Connection lost');
        }

        if (state === 'CONNECTED') {
          // Additional keepalive actions to maintain connection
          try {
            // Access client info as a keepalive action (lightweight operation)
            // This helps keep the connection active
            const info = client.info;
            if (info && info.wid) {
              // Connection is truly alive
            }
          } catch (infoError) {
            // Info check failed, but state is CONNECTED - continue
            console.log(`⚠️ Keepalive info check failed for ${sessionId}, but state is CONNECTED`);
          }

          // Update last_seen in database
          await supabaseAdmin
            .from('sessions')
            .update({ 
              updated_at: new Date().toISOString(),
              last_seen: new Date().toISOString(),
              status: 'connected' // Ensure status stays connected
            })
            .eq('id', sessionId);

          // Log successful keepalive (only every 5th ping to avoid spam)
          const pingCount = this.keepalivePingCount = (this.keepalivePingCount || 0) + 1;
          if (pingCount % 5 === 0) {
            console.log(`💓 Keepalive ping successful for session ${sessionId} (${pingCount} pings)`);
          }
        } else if (state === 'CONNECTING' || state === 'PAIRING') {
          // Session is in transition, wait a bit longer
          console.log(`⏳ Session ${sessionId} is ${state}, keeping keepalive active`);
          await supabaseAdmin
            .from('sessions')
            .update({ 
              updated_at: new Date().toISOString()
            })
            .eq('id', sessionId);
        } else {
          // State is not CONNECTED - attempt immediate reconnection
          console.log(`⚠️ Session ${sessionId} not connected (state: ${state}), attempting reconnect...`);
          
          // Update status but keep keepalive running (it will stop if reconnect succeeds)
          await supabaseAdmin
            .from('sessions')
            .update({ 
              status: 'disconnected',
              updated_at: new Date().toISOString()
            })
            .eq('id', sessionId);
          
          // Attempt reconnection without stopping keepalive immediately
          // This allows multiple reconnect attempts
          this.reconnectSession(sessionId).catch(error => {
            console.error(`Reconnection failed during keepalive for ${sessionId}:`, error.message);
          });
        }
      } catch (error) {
        // Connection error detected
        console.error(`💔 Keepalive check failed for session ${sessionId}:`, error.message);
        
        // Update status to disconnected
        await supabaseAdmin
          .from('sessions')
          .update({ 
            status: 'disconnected',
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId)
          .catch(dbError => {
            console.error(`Failed to update session status in database:`, dbError);
          });

        // Attempt reconnection
        console.log(`🔄 Attempting to reconnect session ${sessionId} after keepalive failure...`);
        this.reconnectSession(sessionId).catch(reconnectError => {
          console.error(`Reconnection failed:`, reconnectError.message);
        });
      }
    }, 20000); // Every 20 seconds - more frequent to prevent disconnection
    
    this.keepaliveIntervals.set(sessionId, interval);
    console.log(`💓 Keepalive started for session ${sessionId} (checking every 20 seconds)`);
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

