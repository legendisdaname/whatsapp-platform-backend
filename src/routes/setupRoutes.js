const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/supabase');

// Check if setup is needed (no admins exist)
router.get('/check-setup', async (req, res) => {
  try {
    const { data: admins, error } = await supabaseAdmin
      .from('admins')
      .select('id')
      .limit(1);

    if (error) {
      throw error;
    }

    const needsSetup = admins.length === 0;
    
    res.json({ 
      success: true, 
      needsSetup,
      message: needsSetup ? 'Setup required' : 'Setup already completed'
    });

  } catch (error) {
    console.error('Setup check error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check setup status',
      needsSetup: true // Default to needing setup if there's an error
    });
  }
});

// Create admin account
router.post('/create-admin', async (req, res) => {
  try {
    const { username, password, email, name } = req.body;

    if (!username || !password || !email || !name) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    // Check if admin already exists
    const { data: existingAdmin } = await supabaseAdmin
      .from('admins')
      .select('id')
      .eq('username', username)
      .single();

    if (existingAdmin) {
      return res.status(400).json({ 
        success: false, 
        message: 'Admin username already exists' 
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create admin
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .insert({
        username,
        email,
        name,
        password_hash: passwordHash,
        is_active: true
      })
      .select('id, username, email, name')
      .single();

    if (error) {
      throw error;
    }

    res.json({ 
      success: true, 
      message: 'Admin account created successfully',
      admin 
    });

  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create admin account' 
    });
  }
});

// Create system settings
router.post('/create-settings', async (req, res) => {
  try {
    const {
      platformName,
      adminEmail,
      maxSessionsPerUser,
      maxBotsPerUser,
      enableUserRegistration,
      enableEmailNotifications
    } = req.body;

    // Check if settings already exist
    const { data: existingSettings } = await supabaseAdmin
      .from('system_settings')
      .select('id')
      .limit(1)
      .single();

    let settings;
    let error;

    if (existingSettings) {
      // Update existing settings
      const { data, err } = await supabaseAdmin
        .from('system_settings')
        .update({
          platform_name: platformName,
          admin_email: adminEmail,
          max_sessions_per_user: maxSessionsPerUser,
          max_bots_per_user: maxBotsPerUser,
          enable_user_registration: enableUserRegistration,
          enable_email_notifications: enableEmailNotifications,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSettings.id)
        .select('*')
        .single();

      settings = data;
      error = err;
    } else {
      // Create new settings
      const { data, err } = await supabaseAdmin
        .from('system_settings')
        .insert({
          platform_name: platformName,
          admin_email: adminEmail,
          max_sessions_per_user: maxSessionsPerUser,
          max_bots_per_user: maxBotsPerUser,
          enable_user_registration: enableUserRegistration,
          enable_email_notifications: enableEmailNotifications
        })
        .select('*')
        .single();

      settings = data;
      error = err;
    }

    if (error) {
      throw error;
    }

    res.json({ 
      success: true, 
      message: 'System settings created successfully',
      settings 
    });

  } catch (error) {
    console.error('Create settings error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create system settings' 
    });
  }
});

// Complete setup
router.post('/complete', async (req, res) => {
  try {
    const {
      adminData,
      settingsData
    } = req.body;

    // Create admin
    const adminResponse = await fetch(`${req.protocol}://${req.get('host')}/api/admin/setup/create-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(adminData)
    });

    if (!adminResponse.ok) {
      throw new Error('Failed to create admin account');
    }

    // Create settings
    const settingsResponse = await fetch(`${req.protocol}://${req.get('host')}/api/admin/setup/create-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settingsData)
    });

    if (!settingsResponse.ok) {
      throw new Error('Failed to create system settings');
    }

    res.json({ 
      success: true, 
      message: 'Setup completed successfully' 
    });

  } catch (error) {
    console.error('Complete setup error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to complete setup' 
    });
  }
});

module.exports = router;
