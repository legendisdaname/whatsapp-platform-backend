const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const whatsappService = require('../services/whatsappService');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { checkBlockedMiddleware } = require('../middleware/checkBlocked');

// Verify webhook signature
function verifyWebhookSignature(payload, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64');
  return hash === signature;
}

/**
 * @swagger
 * /api/woocommerce/order-created:
 *   post:
 *     summary: Webhook endpoint for WooCommerce order created
 *     tags: [WooCommerce]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Notification sent successfully
 */
router.post('/order-created', async (req, res) => {
  try {
    // Verify webhook signature (optional but recommended)
    const signature = req.headers['x-wc-webhook-signature'];
    const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
    
    if (secret && signature) {
      const payload = JSON.stringify(req.body);
      if (!verifyWebhookSignature(payload, signature, secret)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    
    const order = req.body;
    
    // Extract order details
    const orderId = order.id;
    const orderNumber = order.number;
    const customerName = order.billing?.first_name || 'Customer';
    const customerPhone = order.billing?.phone;
    const total = order.total;
    const currency = order.currency;
    const status = order.status;
    const orderDate = order.date_created;
    
    // Get order items
    let itemsList = '';
    if (order.line_items && order.line_items.length > 0) {
      itemsList = order.line_items.map(item => 
        `${item.name} x${item.quantity}`
      ).join('\n');
    }
    
    // Validate phone number (don't format here - let whatsappService.handle it)
    if (!customerPhone || !customerPhone.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'No phone number provided in order' 
      });
    }
    
    // Pass the original phone number to whatsappService.sendMessage
    // It will handle all normalization including leading zeros, country codes, etc.
    const phone = customerPhone.trim();
    
    // Get WooCommerce settings from database
    // Note: For webhook, we need to match by store URL or have a custom header
    // For now, get the first active settings (can be enhanced with store identification)
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('woocommerce_settings')
      .select('*')
      .eq('enabled', true)
      .limit(1)
      .single();
    
    if (settingsError || !settings) {
      console.error('WooCommerce settings not found:', settingsError);
      return res.status(500).json({ 
        success: false,
        error: 'Settings not configured. Please configure WooCommerce integration first.' 
      });
    }
    
    const sessionId = settings.session_id;
    let messageTemplate = settings.order_created_template;
    
    // Default template if not set
    if (!messageTemplate) {
      messageTemplate = `Hello {customer_name}! 🎉

Thank you for your order!

📦 Order #{order_number}
💰 Total: {currency} {total}
📅 Date: {order_date}

Items:
{items}

We'll keep you updated on your order status!

Thank you for shopping with us! ❤️`;
    }
    
    // Process message template
    let message = messageTemplate
      .replace(/\{customer_name\}/g, customerName)
      .replace(/\{order_number\}/g, orderNumber)
      .replace(/\{total\}/g, total)
      .replace(/\{currency\}/g, currency)
      .replace(/\{status\}/g, status)
      .replace(/\{order_date\}/g, orderDate || new Date().toISOString())
      .replace(/\{items\}/g, itemsList || 'N/A');
    
    // Send WhatsApp message
    await whatsappService.sendMessage(sessionId, phone, message);
    
    // Log the order notification
    await supabaseAdmin
      .from('woocommerce_notifications')
      .insert([{
        user_id: settings.user_id,
        order_id: orderId,
        order_number: orderNumber,
        customer_phone: phone, // Store original format
        message_sent: message,
        status: 'sent'
      }]);
    
    console.log(`WooCommerce notification sent for order #${orderNumber} to ${phone}`);
    
    res.json({ 
      success: true, 
      message: 'Notification sent successfully',
      order_number: orderNumber
    });
  } catch (error) {
    console.error('WooCommerce webhook error:', error);
    
    // Log failed notification
    if (req.body.id && settings?.user_id) {
      await supabaseAdmin
        .from('woocommerce_notifications')
        .insert([{
          user_id: settings.user_id,
          order_id: req.body.id,
          order_number: req.body.number || 'N/A',
          customer_phone: req.body.billing?.phone || '',
          status: 'failed',
          error_message: error.message
        }]);
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send notification',
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/woocommerce/order-status-changed:
 *   post:
 *     summary: Webhook for order status changes
 *     tags: [WooCommerce]
 */
router.post('/order-status-changed', async (req, res) => {
  try {
    const order = req.body;
    
    const { data: settings } = await supabaseAdmin
      .from('woocommerce_settings')
      .select('*')
      .single();
    
    if (!settings) {
      return res.status(500).json({ 
        success: false,
        error: 'Settings not configured' 
      });
    }
    
    // Get appropriate message template based on status
    let messageTemplate;
    switch (order.status) {
      case 'processing':
        messageTemplate = settings.order_processing_template || 
          'Hello {customer_name}!\n\nYour order #{order_number} is now being processed! 📦';
        break;
      case 'completed':
        messageTemplate = settings.order_completed_template || 
          'Hello {customer_name}!\n\nYour order #{order_number} has been completed! 🎉';
        break;
      case 'on-hold':
        messageTemplate = settings.order_hold_template || 
          'Hello {customer_name}!\n\nYour order #{order_number} is on hold.';
        break;
      case 'cancelled':
        messageTemplate = settings.order_cancelled_template || 
          'Hello {customer_name}!\n\nYour order #{order_number} has been cancelled.';
        break;
      default:
        messageTemplate = settings.order_status_change_template || 
          'Hello {customer_name}!\n\nYour order #{order_number} status: {status}';
    }
    
    // Validate and pass original phone number (don't format here)
    const phone = (order.billing?.phone || '').trim();
    
    if (!phone) {
      return res.status(400).json({ 
        success: false,
        error: 'No phone number provided in order' 
      });
    }
    
    const message = messageTemplate
      .replace(/\{customer_name\}/g, order.billing?.first_name || 'Customer')
      .replace(/\{order_number\}/g, order.number)
      .replace(/\{status\}/g, order.status)
      .replace(/\{total\}/g, order.total)
      .replace(/\{currency\}/g, order.currency);
    
    await whatsappService.sendMessage(settings.session_id, phone, message);
    
    await supabaseAdmin
      .from('woocommerce_notifications')
      .insert([{
        order_id: order.id,
        order_number: order.number,
        customer_phone: phone,
        message_sent: message,
        status: 'sent'
      }]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Status change webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/woocommerce/settings:
 *   get:
 *     summary: Get WooCommerce integration settings
 *     tags: [WooCommerce]
 */
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('woocommerce_settings')
      .select('*')
      .eq('user_id', req.userId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      // No settings found is okay, return null
      return res.json({ success: true, settings: null });
    }
    
    res.json({ success: true, settings: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/woocommerce/settings:
 *   post:
 *     summary: Create or update WooCommerce integration settings
 *     tags: [WooCommerce]
 */
router.post('/settings', authMiddleware, checkBlockedMiddleware, async (req, res) => {
  try {
    // Use user_id from request body if provided, otherwise use from auth middleware
    const userId = req.body.user_id || req.userId;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }
    
    const settings = {
      ...req.body,
      user_id: userId
    };
    
    console.log('Saving WooCommerce settings:', { userId: userId, settings: { ...settings, session_id: settings.session_id ? '***' : null } });
    
    // Check if settings exist
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('woocommerce_settings')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    // If error is "not found", that's okay - we'll create new
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing settings:', checkError);
      throw checkError;
    }
    
    let data, error;
    
    if (existing) {
      // Update existing
      console.log('Updating existing WooCommerce settings');
      ({ data, error } = await supabaseAdmin
        .from('woocommerce_settings')
        .update(settings)
        .eq('user_id', userId)
        .select()
        .single());
    } else {
      // Create new
      console.log('Creating new WooCommerce settings');
      ({ data, error } = await supabaseAdmin
        .from('woocommerce_settings')
        .insert([settings])
        .select()
        .single());
    }
    
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    console.log('WooCommerce settings saved successfully');
    res.json({ success: true, settings: data });
  } catch (error) {
    console.error('WooCommerce settings error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.code || 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/woocommerce/notifications:
 *   get:
 *     summary: Get notification logs
 *     tags: [WooCommerce]
 */
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, status } = req.query;
    
    let query = supabaseAdmin
      .from('woocommerce_notifications')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    res.json({ success: true, notifications: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/woocommerce/test:
 *   post:
 *     summary: Test WooCommerce integration with sample order
 *     tags: [WooCommerce]
 */
router.post('/test', async (req, res) => {
  try {
    const { phone_number } = req.body;
    
    if (!phone_number) {
      return res.status(400).json({ 
        success: false,
        error: 'phone_number is required' 
      });
    }
    
    // Create a test order payload
    const testOrder = {
      id: 99999,
      number: '99999-TEST',
      status: 'processing',
      currency: 'USD',
      total: '99.99',
      date_created: new Date().toISOString(),
      billing: {
        first_name: 'Test',
        last_name: 'Customer',
        phone: phone_number
      },
      line_items: [
        { name: 'Test Product', quantity: 1 }
      ]
    };
    
    // Send to webhook endpoint
    req.body = testOrder;
    return router.handle(
      { ...req, method: 'POST', url: '/order-created' },
      res
    );
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

