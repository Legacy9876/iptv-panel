const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/database');

const router = express.Router();

// ===== USER MANAGEMENT =====

// Get all users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, status } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT id, username, email, role, status, max_connections, created_at, expires_at, last_login FROM users';
    const params = [];
    const conditions = [];

    if (search) {
      conditions.push('(username LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      conditions.push('role = ?');
      params.push(role);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const users = await db.all(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM users';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    const countResult = await db.get(countQuery, params.slice(0, -2));

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        pages: Math.ceil(countResult.total / limit)
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Create user
router.post('/users', async (req, res) => {
  try {
    const { username, email, password, role, max_connections, expires_at } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Username, email, and password are required.'
      });
    }

    // Check if user exists
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
      'INSERT INTO users (username, email, password, role, max_connections, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, role || 'user', max_connections || 1, expires_at]
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      user_id: result.id
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Update user
router.put('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, email, role, status, max_connections, expires_at, password } = req.body;

    // Check if user exists
    const existingUser = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    let query = 'UPDATE users SET username = ?, email = ?, role = ?, status = ?, max_connections = ?, expires_at = ?';
    const params = [username, email, role, status, max_connections, expires_at];

    // Add password update if provided
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(userId);

    await db.run(query, params);

    res.json({
      success: true,
      message: 'User updated successfully.'
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Delete user
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    await db.run('DELETE FROM users WHERE id = ?', [userId]);

    res.json({
      success: true,
      message: 'User deleted successfully.'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ===== CATEGORY MANAGEMENT =====

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await db.all(`
      SELECT c.*, p.name as parent_name 
      FROM categories c 
      LEFT JOIN categories p ON c.parent_id = p.id 
      ORDER BY c.sort_order, c.name
    `);

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Create category
router.post('/categories', async (req, res) => {
  try {
    const { name, description, parent_id, sort_order } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Category name is required.'
      });
    }

    const result = await db.run(
      'INSERT INTO categories (name, description, parent_id, sort_order) VALUES (?, ?, ?, ?)',
      [name, description, parent_id, sort_order || 0]
    );

    res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      category_id: result.id
    });

  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Update category
router.put('/categories/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, description, parent_id, sort_order } = req.body;

    await db.run(
      'UPDATE categories SET name = ?, description = ?, parent_id = ?, sort_order = ? WHERE id = ?',
      [name, description, parent_id, sort_order, categoryId]
    );

    res.json({
      success: true,
      message: 'Category updated successfully.'
    });

  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Delete category
router.delete('/categories/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Check if category has channels
    const channelCount = await db.get(
      'SELECT COUNT(*) as count FROM channels WHERE category_id = ?',
      [categoryId]
    );

    if (channelCount.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete category with existing channels.'
      });
    }

    await db.run('DELETE FROM categories WHERE id = ?', [categoryId]);

    res.json({
      success: true,
      message: 'Category deleted successfully.'
    });

  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ===== CHANNEL MANAGEMENT =====

// Get all channels
router.get('/channels', async (req, res) => {
  try {
    const { page = 1, limit = 20, category_id, status, search } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT c.*, cat.name as category_name 
      FROM channels c 
      LEFT JOIN categories cat ON c.category_id = cat.id
    `;
    const params = [];
    const conditions = [];

    if (category_id) {
      conditions.push('c.category_id = ?');
      params.push(category_id);
    }

    if (status) {
      conditions.push('c.status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('c.name LIKE ?');
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY c.name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const channels = await db.all(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM channels c';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    const countResult = await db.get(countQuery, params.slice(0, -2));

    res.json({
      success: true,
      data: channels,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        pages: Math.ceil(countResult.total / limit)
      }
    });

  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Create channel
router.post('/channels', async (req, res) => {
  try {
    const { name, stream_url, logo_url, category_id, epg_id, stream_type, quality, language, country } = req.body;

    if (!name || !stream_url) {
      return res.status(400).json({
        error: 'Channel name and stream URL are required.'
      });
    }

    const result = await db.run(
      'INSERT INTO channels (name, stream_url, logo_url, category_id, epg_id, stream_type, quality, language, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, stream_url, logo_url, category_id, epg_id, stream_type || 'live', quality || 'HD', language || 'en', country]
    );

    res.status(201).json({
      success: true,
      message: 'Channel created successfully.',
      channel_id: result.id
    });

  } catch (error) {
    console.error('Create channel error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Update channel
router.put('/channels/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { name, stream_url, logo_url, category_id, epg_id, stream_type, quality, language, country, status } = req.body;

    await db.run(
      'UPDATE channels SET name = ?, stream_url = ?, logo_url = ?, category_id = ?, epg_id = ?, stream_type = ?, quality = ?, language = ?, country = ?, status = ? WHERE id = ?',
      [name, stream_url, logo_url, category_id, epg_id, stream_type, quality, language, country, status, channelId]
    );

    res.json({
      success: true,
      message: 'Channel updated successfully.'
    });

  } catch (error) {
    console.error('Update channel error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Delete channel
router.delete('/channels/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;

    await db.run('DELETE FROM channels WHERE id = ?', [channelId]);

    res.json({
      success: true,
      message: 'Channel deleted successfully.'
    });

  } catch (error) {
    console.error('Delete channel error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ===== SETTINGS MANAGEMENT =====

// Get all settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await db.all('SELECT * FROM settings ORDER BY setting_key');

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Update setting
router.put('/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { setting_value } = req.body;

    await db.run(
      'UPDATE settings SET setting_value = ?, updated_at = ? WHERE setting_key = ?',
      [setting_value, new Date(), key]
    );

    res.json({
      success: true,
      message: 'Setting updated successfully.'
    });

  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ===== STATISTICS =====

// Get system statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.get(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE status = 'active') as active_users,
        (SELECT COUNT(*) FROM channels) as total_channels,
        (SELECT COUNT(*) FROM channels WHERE status = 'active') as active_channels,
        (SELECT COUNT(*) FROM categories) as total_categories,
        (SELECT COUNT(*) FROM stream_logs WHERE end_time IS NULL) as active_streams,
        (SELECT COUNT(*) FROM stream_logs WHERE start_time >= datetime('now', '-24 hours')) as streams_24h
    `);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router; 