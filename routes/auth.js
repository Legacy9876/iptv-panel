const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/database');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required.'
      });
    }

    // Get user from database
    const user = await db.get(
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND status = ?',
      [username, username, 'active']
    );

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials.'
      });
    }

    // Check if account has expired
    if (user.expires_at && new Date(user.expires_at) < new Date()) {
      return res.status(401).json({
        error: 'Account has expired. Please contact administrator.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials.'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Create session in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await db.run(
      'INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)',
      [user.id, token, req.ip, req.get('User-Agent'), expiresAt]
    );

    // Update last login
    await db.run(
      'UPDATE users SET last_login = ? WHERE id = ?',
      [new Date(), user.id]
    );

    // Remove password from response
    delete user.password;

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        max_connections: user.max_connections,
        expires_at: user.expires_at
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Logout route
router.post('/logout', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.cookies?.token;

    if (token) {
      // Remove session from database
      await db.run(
        'DELETE FROM user_sessions WHERE session_token = ?',
        [token]
      );
    }

    res.json({
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Register route (if enabled)
router.post('/register', async (req, res) => {
  try {
    // Check if registration is enabled
    const setting = await db.get(
      'SELECT setting_value FROM settings WHERE setting_key = ?',
      ['enable_registration']
    );

    if (!setting || setting.setting_value !== 'true') {
      return res.status(403).json({
        error: 'Registration is disabled.'
      });
    }

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Username, email, and password are required.'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format.'
      });
    }

    // Check if username or email already exists
    const existingUser = await db.get(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUser) {
      return res.status(400).json({
        error: 'Username or email already exists.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await db.run(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, 'user']
    );

    res.status(201).json({
      message: 'User registered successfully. Please login.'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get current user info
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        error: 'No token provided.'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.get(
      'SELECT id, username, email, role, status, max_connections, created_at, expires_at, last_login FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({
        error: 'User not found.'
      });
    }

    res.json({ user });

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(401).json({
      error: 'Invalid token.'
    });
  }
});

// Change password
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required.'
      });
    }

    // Get current user
    const user = await db.get(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Current password is incorrect.'
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.run(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedNewPassword, userId]
    );

    res.json({
      message: 'Password changed successfully.'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

module.exports = router; 