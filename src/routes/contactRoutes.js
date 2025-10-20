const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { checkBlockedMiddleware } = require('../middleware/checkBlocked');

/**
 * @swagger
 * /api/contacts/groups:
 *   get:
 *     summary: Get all contact groups
 *     tags: [Contacts]
 *     parameters:
 *       - in: query
 *         name: session_id
 *         schema:
 *           type: string
 *         description: Filter by session ID
 *     responses:
 *       200:
 *         description: List of contact groups
 */
router.get('/groups', authMiddleware, async (req, res) => {
  try {
    const { session_id } = req.query;
    
    let query = supabaseAdmin
      .from('contact_groups')
      .select('*, contacts:contact_group_members(contact_id, contacts(*))')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });
    
    if (session_id) {
      query = query.eq('session_id', session_id);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    res.json({ success: true, groups: data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact groups',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/contacts/groups/{id}:
 *   get:
 *     summary: Get a specific contact group with members
 *     tags: [Contacts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact group details
 */
router.get('/groups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get group info
    const { data: group, error: groupError } = await supabaseAdmin
      .from('contact_groups')
      .select('*')
      .eq('id', id)
      .single();
    
    if (groupError) throw groupError;
    
    // Get group members
    const { data: members, error: membersError } = await supabaseAdmin
      .from('contact_group_members')
      .select('*, contacts(*)')
      .eq('group_id', id);
    
    if (membersError) throw membersError;
    
    res.json({ 
      success: true, 
      group: {
        ...group,
        members: members.map(m => m.contacts)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact group',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/contacts/groups:
 *   post:
 *     summary: Create a new contact group
 *     tags: [Contacts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - session_id
 *               - name
 *             properties:
 *               session_id:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Group created
 */
router.post('/groups', authMiddleware, checkBlockedMiddleware, async (req, res) => {
  try {
    const { session_id, name, description } = req.body;
    
    if (!session_id || !name) {
      return res.status(400).json({
        success: false,
        error: 'session_id and name are required'
      });
    }
    
    const { data, error } = await supabaseAdmin
      .from('contact_groups')
      .insert([{ session_id, name, description, user_id: req.userId }])
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({ success: true, group: data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create contact group',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/contacts/groups/{id}:
 *   put:
 *     summary: Update a contact group
 *     tags: [Contacts]
 */
router.put('/groups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabaseAdmin
      .from('contact_groups')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, group: data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update contact group',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/contacts/groups/{id}:
 *   delete:
 *     summary: Delete a contact group
 *     tags: [Contacts]
 */
router.delete('/groups/:id', authMiddleware, checkBlockedMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabaseAdmin
      .from('contact_groups')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId);
    
    if (error) throw error;
    
    res.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete contact group',
      message: error.message
    });
  }
});

// ============ CONTACTS ============

/**
 * @swagger
 * /api/contacts:
 *   get:
 *     summary: Get all contacts
 *     tags: [Contacts]
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { session_id } = req.query;
    
    let query = supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('user_id', req.userId)
      .order('name', { ascending: true });
    
    if (session_id) {
      query = query.eq('session_id', session_id);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    res.json({ success: true, contacts: data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contacts',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/contacts:
 *   post:
 *     summary: Create a new contact
 *     tags: [Contacts]
 */
router.post('/', authMiddleware, checkBlockedMiddleware, async (req, res) => {
  try {
    const { session_id, phone_number, name, email, notes } = req.body;
    
    if (!session_id || !phone_number) {
      return res.status(400).json({
        success: false,
        error: 'session_id and phone_number are required'
      });
    }
    
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .insert([{ session_id, phone_number, name, email, notes, user_id: req.userId }])
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({ success: true, contact: data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create contact',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/contacts/{id}:
 *   put:
 *     summary: Update a contact
 *     tags: [Contacts]
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, contact: data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update contact',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/contacts/{id}:
 *   delete:
 *     summary: Delete a contact
 *     tags: [Contacts]
 */
router.delete('/:id', authMiddleware, checkBlockedMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabaseAdmin
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId);
    
    if (error) throw error;
    
    res.json({ success: true, message: 'Contact deleted successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete contact',
      message: error.message
    });
  }
});

// ============ GROUP MEMBERS ============

/**
 * @swagger
 * /api/contacts/groups/{groupId}/members:
 *   post:
 *     summary: Add contact to group
 *     tags: [Contacts]
 */
router.post('/groups/:groupId/members', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { contact_id } = req.body;
    
    if (!contact_id) {
      return res.status(400).json({
        success: false,
        error: 'contact_id is required'
      });
    }
    
    const { data, error } = await supabaseAdmin
      .from('contact_group_members')
      .insert([{ group_id: groupId, contact_id }])
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({ success: true, member: data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add contact to group',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/contacts/groups/{groupId}/members/{contactId}:
 *   delete:
 *     summary: Remove contact from group
 *     tags: [Contacts]
 */
router.delete('/groups/:groupId/members/:contactId', async (req, res) => {
  try {
    const { groupId, contactId } = req.params;
    
    const { error } = await supabaseAdmin
      .from('contact_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('contact_id', contactId);
    
    if (error) throw error;
    
    res.json({ success: true, message: 'Contact removed from group' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to remove contact from group',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/contacts/groups/{groupId}/phone-numbers:
 *   get:
 *     summary: Get all phone numbers in a group
 *     tags: [Contacts]
 */
router.get('/groups/:groupId/phone-numbers', async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const { data, error } = await supabaseAdmin
      .from('contact_group_members')
      .select('contacts(phone_number)')
      .eq('group_id', groupId);
    
    if (error) throw error;
    
    const phoneNumbers = data.map(item => item.contacts.phone_number);
    
    res.json({ success: true, phoneNumbers });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch phone numbers',
      message: error.message
    });
  }
});

module.exports = router;

