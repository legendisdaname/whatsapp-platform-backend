const express = require('express');
const router = express.Router();
const botService = require('../services/botService');
const { authMiddleware } = require('../middleware/auth');
const { checkBlockedMiddleware } = require('../middleware/checkBlocked');

/**
 * @swagger
 * /api/bots:
 *   get:
 *     summary: Get all bots
 *     tags: [Bots]
 *     responses:
 *       200:
 *         description: List of all bots
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 bots:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Bot'
 *       500:
 *         description: Server error
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const bots = await botService.getUserBots(req.userId);
    res.json({ success: true, bots });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bots',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/bots/session/{sessionId}:
 *   get:
 *     summary: Get bots for a specific session
 *     tags: [Bots]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     responses:
 *       200:
 *         description: List of bots for the session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 bots:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Bot'
 *       500:
 *         description: Server error
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const bots = await botService.getBotsBySession(req.params.sessionId);
    res.json({ success: true, bots });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bots',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/bots/{id}:
 *   get:
 *     summary: Get a specific bot
 *     tags: [Bots]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bot ID
 *     responses:
 *       200:
 *         description: Bot details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 bot:
 *                   $ref: '#/components/schemas/Bot'
 *       500:
 *         description: Server error
 */
router.get('/:id', async (req, res) => {
  try {
    const bot = await botService.getBot(req.params.id);
    res.json({ success: true, bot });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bot',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/bots:
 *   post:
 *     summary: Create a new bot
 *     tags: [Bots]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - session_id
 *               - name
 *               - message_template
 *               - target_numbers
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: Session ID to use for the bot
 *               name:
 *                 type: string
 *                 description: Bot name
 *               message_template:
 *                 type: string
 *                 description: Message template (supports {date}, {time}, {day} variables)
 *               target_numbers:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of phone numbers to send messages to
 *               schedule_pattern:
 *                 type: string
 *                 description: Cron pattern for scheduling (e.g., "0 9 * * *" for daily at 9 AM)
 *               is_active:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Bot created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 bot:
 *                   $ref: '#/components/schemas/Bot'
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/', authMiddleware, checkBlockedMiddleware, async (req, res) => {
  try {
    const { session_id, name, message_template, target_numbers, schedule_pattern, is_active } = req.body;

    if (!session_id || !name || !message_template || !target_numbers || target_numbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'session_id, name, message_template, and target_numbers are required'
      });
    }

    const botData = {
      session_id,
      name,
      message_template,
      target_numbers,
      schedule_pattern: schedule_pattern || null,
      is_active: is_active || false,
      user_id: req.userId
    };

    const bot = await botService.createBot(botData);
    res.status(201).json({ success: true, bot });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create bot',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/bots/{id}:
 *   put:
 *     summary: Update a bot
 *     tags: [Bots]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bot ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               message_template:
 *                 type: string
 *               target_numbers:
 *                 type: array
 *                 items:
 *                   type: string
 *               schedule_pattern:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Bot updated successfully
 *       500:
 *         description: Server error
 */
router.put('/:id', authMiddleware, checkBlockedMiddleware, async (req, res) => {
  try {
    const updates = req.body;
    const bot = await botService.updateBot(req.params.id, updates, req.userId);
    res.json({ success: true, bot });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update bot',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/bots/{id}:
 *   delete:
 *     summary: Delete a bot
 *     tags: [Bots]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bot ID
 *     responses:
 *       200:
 *         description: Bot deleted successfully
 *       500:
 *         description: Server error
 */
router.delete('/:id', authMiddleware, checkBlockedMiddleware, async (req, res) => {
  try {
    await botService.deleteBot(req.params.id, req.userId);
    res.json({ success: true, message: 'Bot deleted successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete bot',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/bots/{id}/trigger:
 *   post:
 *     summary: Manually trigger a bot to send messages now
 *     tags: [Bots]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bot ID
 *     responses:
 *       200:
 *         description: Bot triggered successfully
 *       500:
 *         description: Server error
 */
router.post('/:id/trigger', async (req, res) => {
  try {
    await botService.sendBotMessageNow(req.params.id);
    res.json({ success: true, message: 'Bot triggered successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to trigger bot',
      message: error.message
    });
  }
});

module.exports = router;

