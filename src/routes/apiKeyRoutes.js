const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { generateApiKey } = require('../utils/apiKeyGenerator');

/**
 * GET /api/api-keys/current
 * Get current user's API key
 */
router.get('/current', authMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('api_key')
      .eq('id', req.userId)
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch API key'
      });
    }

    res.json({
      success: true,
      data: {
        apiKey: user.api_key,
        hasApiKey: !!user.api_key
      }
    });
  } catch (error) {
    console.error('Error fetching API key:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * POST /api/api-keys/generate
 * Generate or regenerate API key for current user
 */
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const newApiKey = generateApiKey();

    const { data, error } = await supabase
      .from('users')
      .update({ api_key: newApiKey })
      .eq('id', req.userId)
      .select('api_key')
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate API key'
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
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * DELETE /api/api-keys/current
 * Revoke current user's API key
 */
router.delete('/current', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase
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

