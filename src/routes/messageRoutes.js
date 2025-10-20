const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { checkBlockedMiddleware } = require('../middleware/checkBlocked');

/**
 * @swagger
 * /api/messages/send:
 *   post:
 *     summary: Send a WhatsApp message
 *     tags: [Messages]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - to
 *               - message
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Session ID to use for sending
 *               to:
 *                 type: string
 *                 description: Recipient phone number (with country code)
 *               message:
 *                 type: string
 *                 description: Message text to send
 *     responses:
 *       200:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   $ref: '#/components/schemas/Message'
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/send', authMiddleware, checkBlockedMiddleware, async (req, res) => {
  try {
    const { sessionId, to, message } = req.body;

    if (!sessionId || !to || !message) {
      return res.status(400).json({
        success: false,
        error: 'sessionId, to, and message are required'
      });
    }

    // Verify user owns this session
    const session = await whatsappService.getSession(sessionId, req.userId);
    if (!session) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You do not own this session'
      });
    }

    const result = await whatsappService.sendMessage(sessionId, to, message);
    res.json({ success: true, message: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/messages/history/{sessionId}:
 *   get:
 *     summary: Get message history for a session
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of messages to retrieve
 *     responses:
 *       200:
 *         description: Message history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *       500:
 *         description: Server error
 */
router.get('/history/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    // Verify user owns this session
    const session = await whatsappService.getSession(sessionId, req.userId);
    if (!session) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You do not own this session'
      });
    }

    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch message history',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/messages/received/{sessionId}:
 *   get:
 *     summary: Get received messages for a session
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of messages to retrieve
 *     responses:
 *       200:
 *         description: Received messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 messages:
 *                   type: array
 *       500:
 *         description: Server error
 */
router.get('/received/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    // Verify user owns this session
    const session = await whatsappService.getSession(sessionId, req.userId);
    if (!session) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You do not own this session'
      });
    }

    const { data: messages, error } = await supabaseAdmin
      .from('received_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch received messages',
      message: error.message
    });
  }
});

module.exports = router;

