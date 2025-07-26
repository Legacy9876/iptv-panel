const express = require('express');
const db = require('../database/database');

const router = express.Router();

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await db.get(
      'SELECT id, username, email, role, status, max_connections, created_at, expires_at, last_login FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        error: 'User not found.'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const userId = req.user.id;
    const { email } = req.body;

    if (email) {
      // Check if email is already taken
      const existingUser = await db.get(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );

      if (existingUser) {
        return res.status(400).json({
          error: 'Email is already taken.'
        });
      }

      await db.run(
        'UPDATE users SET email = ? WHERE id = ?',
        [email, userId]
      );
    }

    res.json({
      success: true,
      message: 'Profile updated successfully.'
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get user's stream history
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const history = await db.all(`
      SELECT sl.*, c.name as channel_name, c.logo_url, cat.name as category_name
      FROM stream_logs sl
      LEFT JOIN channels c ON sl.channel_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE sl.user_id = ? AND sl.end_time IS NOT NULL
      ORDER BY sl.start_time DESC
      LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), offset]);

    // Get total count
    const countResult = await db.get(
      'SELECT COUNT(*) as total FROM stream_logs WHERE user_id = ? AND end_time IS NOT NULL',
      [userId]
    );

    res.json({
      success: true,
      data: history,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        pages: Math.ceil(countResult.total / limit)
      }
    });

  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get user's favorite channels
router.get('/favorites', async (req, res) => {
  try {
    const userId = req.user.id;

    const favorites = await db.all(`
      SELECT c.*, cat.name as category_name
      FROM user_favorites uf
      LEFT JOIN channels c ON uf.channel_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE uf.user_id = ? AND c.status = 'active'
      ORDER BY uf.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      data: favorites
    });

  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Add channel to favorites
router.post('/favorites/:channelId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { channelId } = req.params;

    // Check if channel exists
    const channel = await db.get(
      'SELECT id FROM channels WHERE id = ? AND status = ?',
      [channelId, 'active']
    );

    if (!channel) {
      return res.status(404).json({
        error: 'Channel not found.'
      });
    }

    // Check if already favorited
    const existing = await db.get(
      'SELECT id FROM user_favorites WHERE user_id = ? AND channel_id = ?',
      [userId, channelId]
    );

    if (existing) {
      return res.status(400).json({
        error: 'Channel already in favorites.'
      });
    }

    await db.run(
      'INSERT INTO user_favorites (user_id, channel_id) VALUES (?, ?)',
      [userId, channelId]
    );

    res.json({
      success: true,
      message: 'Channel added to favorites.'
    });

  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Remove channel from favorites
router.delete('/favorites/:channelId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { channelId } = req.params;

    await db.run(
      'DELETE FROM user_favorites WHERE user_id = ? AND channel_id = ?',
      [userId, channelId]
    );

    res.json({
      success: true,
      message: 'Channel removed from favorites.'
    });

  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get user's stream statistics
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '7d' } = req.query;

    let dateFilter = '';
    const params = [userId];

    switch (period) {
      case '24h':
        dateFilter = 'AND sl.start_time >= datetime("now", "-1 day")';
        break;
      case '7d':
        dateFilter = 'AND sl.start_time >= datetime("now", "-7 days")';
        break;
      case '30d':
        dateFilter = 'AND sl.start_time >= datetime("now", "-30 days")';
        break;
      default:
        dateFilter = 'AND sl.start_time >= datetime("now", "-7 days")';
    }

    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_streams,
        SUM(COALESCE(sl.duration, 0)) as total_duration,
        AVG(COALESCE(sl.duration, 0)) as avg_duration,
        COUNT(DISTINCT sl.channel_id) as unique_channels,
        COUNT(DISTINCT DATE(sl.start_time)) as active_days
      FROM stream_logs sl
      WHERE sl.user_id = ? ${dateFilter}
    `, params);

    // Get top channels
    const topChannels = await db.all(`
      SELECT c.name, COUNT(*) as stream_count, SUM(COALESCE(sl.duration, 0)) as total_duration
      FROM stream_logs sl
      LEFT JOIN channels c ON sl.channel_id = c.id
      WHERE sl.user_id = ? ${dateFilter}
      GROUP BY sl.channel_id
      ORDER BY stream_count DESC
      LIMIT 10
    `, params);

    res.json({
      success: true,
      data: {
        ...stats,
        top_channels: topChannels
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

module.exports = router; 