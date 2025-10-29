const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { generateApiKey } = require('../utils/apiKeyGenerator');

/**
 * GET /api/api-keys/current
 * Get current user's API key
 */
router.get('/current', authMiddleware, async (req, res) => {
  try {
    if (!req.userId) {
      console.error('No userId in request');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    console.log('Fetching API key for user:', req.userId);

    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      console.error('supabaseAdmin client is not initialized');
      return res.status(500).json({
        success: false,
        message: 'Database connection error. Please check SUPABASE_SERVICE_ROLE_KEY in environment variables.'
      });
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('api_key')
      .eq('id', req.userId)
      .single();

    if (error) {
      console.error('Supabase error fetching API key:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch API key',
        error: error.code || 'UNKNOWN_ERROR',
        details: error.details || null
      });
    }

    if (!user) {
      console.error('No user found with id:', req.userId);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        apiKey: user.api_key || null,
        hasApiKey: !!user.api_key
      }
    });
  } catch (error) {
    console.error('Error fetching API key:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

/**
 * POST /api/api-keys/generate
 * Generate or regenerate API key for current user
 * 
 * IMPORTANT: API keys NEVER expire. They remain valid until manually regenerated or revoked.
 * When a new key is generated, the old key is immediately invalidated.
 */
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    if (!req.userId) {
      console.error('No userId in request');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      console.error('supabaseAdmin client is not initialized');
      return res.status(500).json({
        success: false,
        message: 'Database connection error. Please check SUPABASE_SERVICE_ROLE_KEY in environment variables.'
      });
    }

    const newApiKey = generateApiKey();
    console.log('Generating API key for user:', req.userId);

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ api_key: newApiKey })
      .eq('id', req.userId)
      .select('api_key')
      .single();

    if (error) {
      console.error('Supabase error generating API key:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Check if it's a column missing error
      if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
        return res.status(500).json({
          success: false,
          message: 'The api_key column does not exist in the users table. Please run the migration to add it.',
          error: 'COLUMN_MISSING',
          sqlHelp: 'Run: ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE; CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);'
        });
      }
      
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate API key',
        error: error.code || 'UNKNOWN_ERROR',
        details: error.details || null
      });
    }

    if (!data) {
      console.error('No data returned after update for user:', req.userId);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve generated API key'
      });
    }

    res.json({
      success: true,
      message: 'API key generated successfully',
      data: {
        apiKey: data.api_key
      }
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: error.name || 'UNKNOWN_ERROR',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * DELETE /api/api-keys/current
 * Revoke current user's API key
 */
router.delete('/current', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('users')
      .update({ api_key: null })
      .eq('id', req.userId);

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to revoke API key'
      });
    }

    res.json({
      success: true,
      message: 'API key revoked successfully'
    });
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

