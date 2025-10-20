const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabase');

// Simple admin login test
router.post('/test-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt:', { username, password: password ? '***' : 'missing' });

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    // Get admin by username
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('username', username)
      .single();

    console.log('Admin query result:', { admin: admin ? 'found' : 'not found', error });

    if (error || !admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    console.log('Admin found:', { id: admin.id, username: admin.username, is_active: admin.is_active });

    // Check if admin is active
    if (!admin.is_active) {
      return res.status(403).json({ success: false, message: 'Account is disabled' });
    }

    // Verify password
    console.log('Comparing password...');
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    console.log('Password comparison result:', isValidPassword);

    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { adminId: admin.id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Login successful for:', username);

    res.json({ 
      success: true, 
      message: 'Login successful',
      token,
      admin: { id: admin.id, username: admin.username, email: admin.email }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
