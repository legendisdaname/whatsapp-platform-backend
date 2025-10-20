const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/supabase');

// Admin auth middleware
const adminAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET);

    // Verify admin user exists
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('id', decoded.adminId)
      .single();

    if (error || !admin || !admin.is_active) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    req.adminId = decoded.adminId;
    req.admin = admin;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Admin Login
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    // Get admin by username
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if admin is active
    if (!admin.is_active) {
      return res.status(403).json({ success: false, message: 'Account is disabled' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { adminId: admin.id, username: admin.username },
      process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update last login
    await supabaseAdmin
      .from('admins')
      .update({ last_login: new Date().toISOString() })
      .eq('id', admin.id);

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Get Admin Profile
router.get('/auth/profile', adminAuthMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      admin: {
        id: req.admin.id,
        username: req.admin.username,
        email: req.admin.email
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
});

// Get All Users
router.get('/users', adminAuthMiddleware, async (req, res) => {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        sessions:sessions(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Format response
    const formattedUsers = users.map(user => ({
      ...user,
      session_count: user.sessions[0]?.count || 0,
      sessions: undefined // Remove nested object
    }));

    res.json({ success: true, users: formattedUsers });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// Get User by ID
router.get('/users/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
});

// Update User
router.put('/users/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { name, email, is_blocked } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (is_blocked !== undefined) updates.is_blocked = is_blocked;

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, user: data });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// Block User
router.post('/users/:id/block', adminAuthMiddleware, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('users')
      .update({ is_blocked: true })
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true, message: 'User blocked successfully' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ success: false, message: 'Failed to block user' });
  }
});

// Unblock User
router.post('/users/:id/unblock', adminAuthMiddleware, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('users')
      .update({ is_blocked: false })
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true, message: 'User unblocked successfully' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ success: false, message: 'Failed to unblock user' });
  }
});

// Delete User
router.delete('/users/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { error} = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// Analytics - Dashboard Stats
router.get('/analytics/dashboard', adminAuthMiddleware, async (req, res) => {
  try {
    // Get total users
    const { count: totalUsers } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Get active sessions
    const { count: activeSessions } = await supabaseAdmin
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'connected');

    // Get active bots
    const { count: activeBots } = await supabaseAdmin
      .from('bots')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Get recent users (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: newUsers } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo);

    // Mock data for charts (you can enhance this with real data)
    const userGrowthData = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      users: Math.floor(Math.random() * 20) + 5
    }));

    const messageActivityData = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      messages: Math.floor(Math.random() * 100) + 20
    }));

    const recentActivity = [
      {
        type: 'user',
        title: 'New User Registration',
        description: `${newUsers} new users this week`,
        time: 'Recent'
      },
      {
        type: 'session',
        title: 'Active Sessions',
        description: `${activeSessions} sessions currently active`,
        time: 'Now'
      },
      {
        type: 'message',
        title: 'Automated Messages',
        description: `${activeBots} bots sending messages`,
        time: 'Ongoing'
      }
    ];

    res.json({
      success: true,
      totalUsers: totalUsers || 0,
      activeSessions: activeSessions || 0,
      totalMessages: 0, // Can be enhanced with message tracking
      activeBots: activeBots || 0,
      userGrowth: '+12%',
      sessionGrowth: '+8%',
      messageGrowth: '+24%',
      botGrowth: '+5%',
      userGrowthData,
      messageActivityData,
      recentActivity
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
});

// System Settings - Get
router.get('/system/settings', adminAuthMiddleware, async (req, res) => {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('system_settings')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Return default settings if none exist
    const defaultSettings = {
      platformName: 'WhatsApp Platform',
      adminEmail: 'admin@whatsappplatform.com',
      maxSessionsPerUser: 10,
      maxBotsPerUser: 20,
      enableUserRegistration: true,
      enableEmailNotifications: true,
      maintenanceMode: false,
      maintenanceMessage: ''
    };

    res.json({
      success: true,
      settings: settings || defaultSettings
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

// System Settings - Update
router.put('/system/settings', adminAuthMiddleware, async (req, res) => {
  try {
    const settings = req.body;

    // Check if settings exist
    const { data: existing } = await supabaseAdmin
      .from('system_settings')
      .select('id')
      .single();

    let result;
    if (existing) {
      // Update existing
      result = await supabaseAdmin
        .from('system_settings')
        .update(settings)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert new
      result = await supabaseAdmin
        .from('system_settings')
        .insert(settings)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    res.json({ success: true, settings: result.data });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

module.exports = router;

