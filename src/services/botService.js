const cron = require('node-cron');
const { supabaseAdmin } = require('../config/supabase');
const whatsappService = require('./whatsappService');

class BotService {
  constructor() {
    this.scheduledJobs = new Map();
  }

  async createBot(botData) {
    try {
      const { data: bot, error } = await supabaseAdmin
        .from('bots')
        .insert([botData])
        .select()
        .single();

      if (error) throw error;

      // If bot is active, schedule it
      if (bot.is_active && bot.schedule_pattern) {
        this.scheduleBot(bot);
      }

      return bot;
    } catch (error) {
      console.error('Error creating bot:', error);
      throw error;
    }
  }

  async getBotTargetNumbers(bot) {
    try {
      let numbers = [];
      
      // If target_numbers is already an array of phone numbers
      if (bot.target_numbers && Array.isArray(bot.target_numbers)) {
        numbers = bot.target_numbers.filter(n => !n.startsWith('group:'));
      }
      
      // Check if bot has group targets (format: "group:GROUP_ID")
      const groupTargets = bot.target_numbers?.filter(n => n.startsWith('group:')) || [];
      
      for (const groupTarget of groupTargets) {
        const groupId = groupTarget.replace('group:', '');
        
        // Fetch all phone numbers from this group
        const { data, error } = await supabaseAdmin
          .from('contact_group_members')
          .select('contacts(phone_number)')
          .eq('group_id', groupId);
        
        if (!error && data) {
          const groupNumbers = data.map(item => item.contacts.phone_number);
          numbers = numbers.concat(groupNumbers);
        }
      }
      
      // Remove duplicates
      return [...new Set(numbers)];
    } catch (error) {
      console.error('Error getting bot target numbers:', error);
      return bot.target_numbers || [];
    }
  }

  async updateBot(botId, updates) {
    try {
      const { data: bot, error } = await supabaseAdmin
        .from('bots')
        .update(updates)
        .eq('id', botId)
        .select()
        .single();

      if (error) throw error;

      // Reschedule if schedule pattern changed or activation status changed
      this.stopBot(botId);
      if (bot.is_active && bot.schedule_pattern) {
        this.scheduleBot(bot);
      }

      return bot;
    } catch (error) {
      console.error('Error updating bot:', error);
      throw error;
    }
  }

  async deleteBot(botId) {
    try {
      this.stopBot(botId);

      const { error } = await supabaseAdmin
        .from('bots')
        .delete()
        .eq('id', botId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting bot:', error);
      throw error;
    }
  }

  async getBot(botId) {
    const { data, error } = await supabaseAdmin
      .from('bots')
      .select('*')
      .eq('id', botId)
      .single();

    if (error) throw error;
    return data;
  }

  async getAllBots() {
    const { data, error } = await supabaseAdmin
      .from('bots')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getBotsBySession(sessionId) {
    const { data, error } = await supabaseAdmin
      .from('bots')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  scheduleBot(bot) {
    if (!cron.validate(bot.schedule_pattern)) {
      console.error(`Invalid cron pattern for bot ${bot.id}: ${bot.schedule_pattern}`);
      return;
    }

    const job = cron.schedule(bot.schedule_pattern, async () => {
      console.log(`Executing bot ${bot.id}: ${bot.name}`);
      await this.executeBotTask(bot);
    });

    this.scheduledJobs.set(bot.id, job);
    console.log(`Bot ${bot.id} scheduled with pattern: ${bot.schedule_pattern}`);
  }

  stopBot(botId) {
    const job = this.scheduledJobs.get(botId);
    if (job) {
      job.stop();
      this.scheduledJobs.delete(botId);
      console.log(`Bot ${botId} stopped`);
    }
  }

  async executeBotTask(bot) {
    try {
      // Check if session is connected
      const session = await whatsappService.getSession(bot.session_id);
      if (session.status !== 'connected') {
        console.log(`Bot ${bot.id} skipped: session not connected`);
        return;
      }

      // Process message template (support for dynamic variables)
      const message = this.processMessageTemplate(bot.message_template);

      // Get all target numbers (including from groups)
      const targetNumbers = await this.getBotTargetNumbers(bot);

      // Send message to all target numbers
      const results = [];
      for (const number of targetNumbers) {
        try {
          const result = await whatsappService.sendMessage(
            bot.session_id,
            number,
            message
          );
          results.push({ number, status: 'sent', result });
        } catch (error) {
          console.error(`Failed to send message to ${number}:`, error);
          results.push({ number, status: 'failed', error: error.message });
        }
      }

      // Log bot execution
      await supabaseAdmin
        .from('bot_executions')
        .insert([
          {
            bot_id: bot.id,
            executed_at: new Date().toISOString(),
            results: results
          }
        ]);

      console.log(`Bot ${bot.id} executed successfully`);
    } catch (error) {
      console.error(`Error executing bot ${bot.id}:`, error);
    }
  }

  processMessageTemplate(template) {
    // Replace dynamic variables in message template
    let message = template;
    
    // Current date/time variables
    const now = new Date();
    message = message.replace(/\{date\}/g, now.toLocaleDateString());
    message = message.replace(/\{time\}/g, now.toLocaleTimeString());
    message = message.replace(/\{datetime\}/g, now.toLocaleString());
    
    // Day of week
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    message = message.replace(/\{day\}/g, days[now.getDay()]);

    return message;
  }

  async initializeActiveBots() {
    try {
      const { data: bots, error } = await supabaseAdmin
        .from('bots')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      for (const bot of bots) {
        if (bot.schedule_pattern) {
          this.scheduleBot(bot);
        }
      }

      console.log(`Initialized ${bots.length} active bots`);
    } catch (error) {
      console.error('Error initializing active bots:', error);
    }
  }

  // Manual send for testing
  async sendBotMessageNow(botId) {
    const bot = await this.getBot(botId);
    await this.executeBotTask(bot);
  }
}

module.exports = new BotService();

