const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const whatsappService = require('../services/whatsappService');
const woocommerceService = require('../services/woocommerceService');
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
    // Log incoming request for debugging
    console.log('WooCommerce webhook received:', {
      method: req.method,
      url: req.url,
      hasHeaders: !!req.headers,
      headersKeys: req.headers ? Object.keys(req.headers) : [],
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : []
    });

    // Verify webhook signature (optional but recommended)
    // Use case-insensitive header access and ensure headers exist
    const headers = req.headers || {};
    const signature = headers['x-wc-webhook-signature'] || 
                      headers['X-WC-Webhook-Signature'] ||
                      headers['X-WC-Webhook-Signature'.toLowerCase()];
    const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
    
    if (secret && signature) {
      const payload = JSON.stringify(req.body || {});
      if (!verifyWebhookSignature(payload, signature, secret)) {
        console.warn('WooCommerce webhook signature verification failed');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    } else if (secret && !signature) {
      console.warn('WooCommerce webhook secret configured but no signature provided');
    }
    
    // Ensure request body exists
    if (!req.body || typeof req.body !== 'object') {
      console.error('WooCommerce webhook: Invalid or missing request body');
      return res.status(400).json({ 
        success: false,
        error: 'Invalid request body' 
      });
    }

    const order = req.body;
    
    // Extract order details with safe defaults
    const orderId = order?.id;
    const orderNumber = order?.number || orderId?.toString() || 'N/A';
    const customerName = order?.billing?.first_name || 'Customer';
    const customerPhone = order?.billing?.phone;
    const total = order?.total || '0';
    const currency = order?.currency || 'USD';
    const status = order?.status || 'unknown';
    const orderDate = order?.date_created || new Date().toISOString();
    
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
    
    // Process message template using service
    const message = woocommerceService.buildMessage(messageTemplate, order, customerName);
    
    if (!message) {
      return res.status(400).json({ 
        success: false,
        error: 'Message template not configured' 
      });
    }
    
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
    console.error('Error stack:', error.stack);
    console.error('Request details:', {
      hasHeaders: !!req.headers,
      hasBody: !!req.body,
      bodyType: req.body ? typeof req.body : 'undefined',
      orderId: req.body?.id
    });
    
    // Log failed notification - safely handle req.body access
    try {
      const orderId = req.body?.id;
      const orderNumber = req.body?.number;
      const customerPhone = req.body?.billing?.phone;
      
      if (orderId) {
        // Try to get settings if we can
        try {
          const { data: settings } = await supabaseAdmin
            .from('woocommerce_settings')
            .select('user_id')
            .eq('enabled', true)
            .limit(1)
            .single();
          
          if (settings?.user_id) {
            await supabaseAdmin
              .from('woocommerce_notifications')
              .insert([{
                user_id: settings.user_id,
                order_id: orderId.toString(),
                order_number: orderNumber || orderId.toString(),
                customer_phone: customerPhone || '',
                status: 'failed',
                error_message: error.message || 'Unknown error'
              }]);
          }
        } catch (dbError) {
          console.error('Failed to log notification error to database:', dbError);
        }
      }
    } catch (logError) {
      console.error('Error logging failed notification:', logError);
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send notification',
      message: error.message || 'Unknown error occurred'
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
    // Ensure request body exists
    if (!req.body || typeof req.body !== 'object') {
      console.error('WooCommerce status-change webhook: Invalid or missing request body');
      return res.status(400).json({ 
        success: false,
        error: 'Invalid request body' 
      });
    }

    const order = req.body;
    
    const { data: settings } = await supabaseAdmin
      .from('woocommerce_settings')
      .select('*')
      .eq('enabled', true)
      .limit(1)
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
    
    // Build message using service
    const message = woocommerceService.buildMessage(
      messageTemplate, 
      order, 
      order.billing?.first_name || 'Customer'
    );
    
    if (!message) {
      return res.status(400).json({ 
        success: false,
        error: 'Message template not configured' 
      });
    }
    
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

/**
 * @swagger
 * /api/woocommerce/verify:
 *   post:
 *     summary: Verify WooCommerce store connection
 *     tags: [WooCommerce]
 */
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const { store_url, consumer_key, consumer_secret } = req.body;
    
    if (!store_url || !consumer_key || !consumer_secret) {
      return res.status(400).json({ 
        success: false,
        error: 'store_url, consumer_key, and consumer_secret are required' 
      });
    }
    
    const result = await woocommerceService.verifyConnection(
      store_url, 
      consumer_key, 
      consumer_secret
    );
    
    res.json(result);
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Verification failed' 
    });
  }
});

/**
 * @swagger
 * /api/woocommerce/orders:
 *   get:
 *     summary: Get orders from WooCommerce store
 *     tags: [WooCommerce]
 */
router.get('/orders', authMiddleware, async (req, res) => {
  try {
    const { limit = 10, status = 'any' } = req.query;
    
    // Get user's WooCommerce settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('woocommerce_settings')
      .select('*')
      .eq('user_id', req.userId)
      .single();
    
    if (settingsError || !settings) {
      return res.status(404).json({ 
        success: false,
        error: 'WooCommerce settings not found. Please configure integration first.' 
      });
    }
    
    if (!settings.store_url || !settings.consumer_key || !settings.consumer_secret) {
      return res.status(400).json({ 
        success: false,
        error: 'Store credentials not configured. Please add Consumer Key and Secret.' 
      });
    }
    
    const result = await woocommerceService.listOrders(
      settings.store_url,
      settings.consumer_key,
      settings.consumer_secret,
      parseInt(limit),
      status
    );
    
    res.json(result);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch orders' 
    });
  }
});

/**
 * @swagger
 * /api/woocommerce/orders/:orderId:
 *   get:
 *     summary: Get specific order from WooCommerce store
 *     tags: [WooCommerce]
 */
router.get('/orders/:orderId', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Get user's WooCommerce settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('woocommerce_settings')
      .select('*')
      .eq('user_id', req.userId)
      .single();
    
    if (settingsError || !settings) {
      return res.status(404).json({ 
        success: false,
        error: 'WooCommerce settings not found' 
      });
    }
    
    if (!settings.store_url || !settings.consumer_key || !settings.consumer_secret) {
      return res.status(400).json({ 
        success: false,
        error: 'Store credentials not configured' 
      });
    }
    
    const result = await woocommerceService.getOrder(
      settings.store_url,
      settings.consumer_key,
      settings.consumer_secret,
      orderId
    );
    
    res.json(result);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch order' 
    });
  }
});

module.exports = router;

