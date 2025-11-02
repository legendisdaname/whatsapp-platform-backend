const axios = require('axios');
const crypto = require('crypto');

/**
 * WooCommerce REST API Service
 * Handles communication with WooCommerce stores via REST API
 */
class WooCommerceService {
  /**
   * Create a WooCommerce API client
   */
  static createClient(storeUrl, consumerKey, consumerSecret) {
    const baseURL = storeUrl.replace(/\/$/, '');
    
    // Create basic auth credentials for WooCommerce REST API
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    return axios.create({
      baseURL: `${baseURL}/wp-json/wc/v3`,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'WhatsApp-Platform-WooCommerce/1.0.0'
      },
      timeout: 30000,
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });
  }

  /**
   * Verify store connection and credentials
   */
  static async verifyConnection(storeUrl, consumerKey, consumerSecret) {
    try {
      if (!storeUrl || !consumerKey || !consumerSecret) {
        return {
          success: false,
          error: 'Missing required credentials'
        };
      }

      const client = this.createClient(storeUrl, consumerKey, consumerSecret);
      
      // Test connection by fetching system status
      const response = await client.get('/system_status');
      
      if (response.status === 200) {
        return {
          success: true,
          message: 'Store connection verified successfully',
          store_info: {
            version: response.data?.environment?.version || 'Unknown',
            wc_version: response.data?.environment?.version || 'Unknown',
            active_plugins: response.data?.active_plugins || []
          }
        };
      } else if (response.status === 401) {
        return {
          success: false,
          error: 'Invalid credentials. Please check your Consumer Key and Consumer Secret.'
        };
      } else if (response.status === 404) {
        return {
          success: false,
          error: 'WooCommerce REST API not found. Please ensure WooCommerce is installed and REST API is enabled.'
        };
      } else {
        return {
          success: false,
          error: `Connection failed with status ${response.status}`
        };
      }
    } catch (error) {
      console.error('WooCommerce verification error:', error);
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return {
          success: false,
          error: 'Unable to connect to store. Please verify the store URL is correct.'
        };
      } else if (error.code === 'ETIMEDOUT') {
        return {
          success: false,
          error: 'Connection timeout. Please check your store URL and network connection.'
        };
      } else if (error.response) {
        return {
          success: false,
          error: error.response.data?.message || `HTTP ${error.response.status}: ${error.message}`
        };
      } else {
        return {
          success: false,
          error: error.message || 'Unknown error occurred'
        };
      }
    }
  }

  /**
   * Get order from WooCommerce store
   */
  static async getOrder(storeUrl, consumerKey, consumerSecret, orderId) {
    try {
      const client = this.createClient(storeUrl, consumerKey, consumerSecret);
      const response = await client.get(`/orders/${orderId}`);
      
      if (response.status === 200) {
        return {
          success: true,
          order: response.data
        };
      } else {
        return {
          success: false,
          error: `Failed to fetch order: ${response.status}`
        };
      }
    } catch (error) {
      console.error('Get order error:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch order'
      };
    }
  }

  /**
   * List recent orders
   */
  static async listOrders(storeUrl, consumerKey, consumerSecret, limit = 10, status = 'any') {
    try {
      const client = this.createClient(storeUrl, consumerKey, consumerSecret);
      const response = await client.get('/orders', {
        params: {
          per_page: limit,
          status: status,
          orderby: 'date',
          order: 'desc'
        }
      });
      
      if (response.status === 200) {
        return {
          success: true,
          orders: response.data,
          total: parseInt(response.headers['x-wp-total'] || 0)
        };
      } else {
        return {
          success: false,
          error: `Failed to fetch orders: ${response.status}`
        };
      }
    } catch (error) {
      console.error('List orders error:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch orders'
      };
    }
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(payload, signature, secret) {
    if (!secret || !signature) {
      return false; // If no secret configured, allow unsigned requests (for development)
    }
    
    const hash = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64');
    
    return hash === signature;
  }

  /**
   * Format phone number for WhatsApp
   * Handles various phone number formats
   */
  static formatPhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-numeric characters
    let formatted = phone.replace(/\D/g, '');
    
    // Remove leading zeros
    if (formatted.startsWith('0')) {
      formatted = formatted.substring(1);
    }
    
    // If 10 digits and no country code, assume US (+1)
    if (formatted.length === 10) {
      formatted = '1' + formatted;
    }
    
    return formatted;
  }

  /**
   * Build message from template
   */
  static buildMessage(template, order, customerName = null) {
    if (!template) return null;
    
    const orderDate = order.date_created 
      ? new Date(order.date_created).toLocaleDateString() 
      : new Date().toLocaleDateString();
    
    // Get order items
    let itemsList = 'N/A';
    if (order.line_items && order.line_items.length > 0) {
      itemsList = order.line_items
        .map(item => `• ${item.name} x${item.quantity}`)
        .join('\n');
    }
    
    const replacements = {
      '{customer_name}': customerName || order.billing?.first_name || 'Customer',
      '{customer_full_name}': `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || 'Customer',
      '{order_number}': order.number || order.id?.toString() || 'N/A',
      '{order_id}': order.id?.toString() || 'N/A',
      '{total}': order.total || '0',
      '{currency}': order.currency || '$',
      '{status}': order.status || 'N/A',
      '{order_date}': orderDate,
      '{items}': itemsList,
      '{items_count}': order.line_items?.length || 0,
      '{payment_method}': order.payment_method_title || 'N/A',
      '{shipping_address}': this.formatAddress(order.shipping) || 'N/A',
      '{billing_address}': this.formatAddress(order.billing) || 'N/A'
    };
    
    let message = template;
    Object.keys(replacements).forEach(key => {
      message = message.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacements[key]);
    });
    
    return message;
  }

  /**
   * Format address for template
   */
  static formatAddress(address) {
    if (!address) return '';
    
    const parts = [
      address.address_1,
      address.address_2,
      address.city,
      address.state,
      address.postcode,
      address.country
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  /**
   * Get template for order status
   */
  static getTemplateForStatus(status, settings) {
    switch (status) {
      case 'processing':
        return settings.order_processing_template;
      case 'completed':
        return settings.order_completed_template;
      case 'on-hold':
        return settings.order_hold_template;
      case 'cancelled':
        return settings.order_cancelled_template;
      default:
        return settings.order_status_change_template || settings.order_created_template;
    }
  }
}

module.exports = WooCommerceService;

