const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     summary: Get all WhatsApp sessions
 *     tags: [Sessions]
 *     responses:
 *       200:
 *         description: List of all sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Session'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req, res) => {
  try {
    const sessions = await whatsappService.getAllSessions();
    res.json({ success: true, sessions });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch sessions',
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/sessions/{id}:
 *   get:
 *     summary: Get a specific session
 *     tags: [Sessions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Session details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 session:
 *                   $ref: '#/components/schemas/Session'
 *       404:
 *         description: Session not found
 *       500:
 *         description: Server error
 */
router.get('/:id', async (req, res) => {
  try {
    const session = await whatsappService.getSession(req.params.id);
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch session',
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     summary: Create a new WhatsApp session
 *     tags: [Sessions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionName
 *             properties:
 *               sessionName:
 *                 type: string
 *                 description: Name for the session
 *     responses:
 *       201:
 *         description: Session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 session:
 *                   $ref: '#/components/schemas/Session'
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/', async (req, res) => {
  try {
    const { sessionName } = req.body;
    
    if (!sessionName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Session name is required' 
      });
    }

    const session = await whatsappService.createSession(sessionName);
    res.status(201).json({ success: true, session });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create session',
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/sessions/{id}:
 *   delete:
 *     summary: Delete a WhatsApp session
 *     tags: [Sessions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Session deleted successfully
 *       500:
 *         description: Server error
 */
router.delete('/:id', async (req, res) => {
  try {
    await whatsappService.deleteSession(req.params.id);
    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete session',
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/sessions/health-status:
 *   get:
 *     summary: Get health status of all sessions
 *     tags: [Sessions]
 *     responses:
 *       200:
 *         description: Health status of all sessions
 */
router.get('/health-status', async (req, res) => {
  try {
    const sessions = await whatsappService.getAllSessions();
    
    const status = await Promise.all(sessions.map(async (session) => {
      const client = whatsappService.getClient(session.id);
      let clientState = 'no_client';
      let isReady = false;
      let phoneNumber = null;
      
      if (client) {
        try {
          clientState = await client.getState();
          const info = await client.info;
          isReady = !!info;
          if (info) {
            phoneNumber = info.wid?.user || null;
          }
        } catch (error) {
          clientState = 'error';
        }
      }
      
      return {
        id: session.id,
        name: session.session_name,
        phone: session.phone_number || phoneNumber,
        db_status: session.status,
        client_state: clientState,
        is_ready: isReady,
        needs_attention: (clientState !== 'CONNECTED' && session.status === 'connected') ||
                        (clientState === 'CONFLICT' || clientState === 'UNPAIRED'),
        last_updated: session.updated_at
      };
    }));
    
    const summary = {
      total: status.length,
      connected: status.filter(s => s.client_state === 'CONNECTED').length,
      disconnected: status.filter(s => s.client_state === 'no_client' || s.db_status === 'disconnected').length,
      needs_attention: status.filter(s => s.needs_attention).length,
      healthy: status.filter(s => s.client_state === 'CONNECTED' && s.is_ready).length
    };
    
    res.json({ 
      success: true, 
      summary, 
      sessions: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get health status',
      message: error.message 
    });
  }
});

module.exports = router;

