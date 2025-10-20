const { supabaseAdmin } = require('../config/supabase');

/**
 * Middleware to check if user is blocked
 * Should be used after authMiddleware
 */
const checkBlockedMiddleware = async (req, res, next) => {
  try {
    // Get user from database to check blocked status
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('is_blocked')
      .eq('id', req.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // If user is blocked, prevent action
    if (user.is_blocked) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account has been blocked by an administrator. You cannot perform this action.',
        blocked: true
      });
    }

    // User is not blocked, proceed
    next();
  } catch (error) {
    console.error('Check blocked middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

module.exports = { checkBlockedMiddleware };

