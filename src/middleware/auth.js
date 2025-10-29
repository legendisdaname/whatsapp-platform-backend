const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      console.error('supabaseAdmin client is not initialized in authMiddleware');
      return res.status(500).json({
        success: false,
        message: 'Database connection error. Please check SUPABASE_SERVICE_ROLE_KEY in environment variables.'
      });
    }

    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Get user from database
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, provider, avatar_url')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      console.error('User lookup error:', error);
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found'
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Authentication failed'
    });
  }
};

/**
 * Optional Auth Middleware
 * Attaches user if token exists, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      // Continue without auth if admin client not available
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id, email, name, provider, avatar_url')
        .eq('id', decoded.userId)
        .single();
      
      if (user) {
        req.user = user;
        req.userId = user.id;
      }
    }
    
    next();
  } catch (error) {
    // Continue without auth
    next();
  }
};

module.exports = { authMiddleware, optionalAuth };

