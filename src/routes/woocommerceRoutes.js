const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const whatsappService = require('../services/whatsappService');
const { supabaseAdmin } = require('../config/supabase');

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
    
    // Format phone number
    if (!customerPhone) {
      return res.status(400).json({ 
        success: false,
        error: 'No phone number provided in order' 
      });
    }
    
    const phone = customerPhone.replace(/[^0-9]/g, '');
    
    if (!phone) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid phone number format' 
      });
    }
    
    // Get WooCommerce settings from database
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('woocommerce_settings')
      .select('*')
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
        order_id: orderId,
        order_number: orderNumber,
        customer_phone: phone,
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
    if (req.body.id) {
      await supabaseAdmin
        .from('woocommerce_notifications')
        .insert([{
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
    
    const phone = (order.billing?.phone || '').replace(/[^0-9]/g, '');
    
    if (!phone) {
      return res.status(400).json({ 
        success: false,
        error: 'No phone number' 
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
router.get('/settings', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('woocommerce_settings')
      .select('*')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
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
router.post('/settings', async (req, res) => {
  try {
    const settings = req.body;
    
    const { data, error } = await supabaseAdmin
      .from('woocommerce_settings')
      .upsert([settings], { onConflict: 'id' })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, settings: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/woocommerce/notifications:
 *   get:
 *     summary: Get notification logs
 *     tags: [WooCommerce]
 */
router.get('/notifications', async (req, res) => {
  try {
    const { limit = 50, status } = req.query;
    
    let query = supabaseAdmin
      .from('woocommerce_notifications')
      .select('*')
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

