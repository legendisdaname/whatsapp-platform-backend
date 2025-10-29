const { supabase } = require('../config/supabase');
const { validateApiKeyFormat } = require('../utils/apiKeyGenerator');

/**
 * Middleware to authenticate requests using API key
 * Looks for API key in Authorization header or x-api-key header
 */
const apiKeyAuth = async (req, res, next) => {
  try {
    // Try to get API key from headers
    let apiKey = req.headers['x-api-key'];
    
    // Also support Bearer token format with API key
    if (!apiKey && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer wp_live_')) {
        apiKey = authHeader.replace('Bearer ', '');
      }
    }

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key required. Provide it via x-api-key header or Authorization: Bearer <api_key>'
      });
    }

    // Validate API key format
    if (!validateApiKeyFormat(apiKey)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key format'
      });
    }

    // Look up user by API key
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('api_key', apiKey)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key'
      });
    }

    // Attach user info to request
    req.userId = user.id;
    req.user = user;
    req.authType = 'api_key';

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

module.exports = { apiKeyAuth };

