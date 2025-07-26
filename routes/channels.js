const express = require('express');
const db = require('../database/database');

const router = express.Router();

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await db.all(`
      SELECT c.*, p.name as parent_name, 
             (SELECT COUNT(*) FROM channels WHERE category_id = c.id AND status = 'active') as channel_count
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
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get channels by category
router.get('/categories/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const channels = await db.all(`
      SELECT c.*, cat.name as category_name
      FROM channels c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.category_id = ? AND c.status = 'active'
      ORDER BY c.name
      LIMIT ? OFFSET ?
    `, [categoryId, parseInt(limit), offset]);

    // Get total count
    const countResult = await db.get(
      'SELECT COUNT(*) as total FROM channels WHERE category_id = ? AND status = ?',
      [categoryId, 'active']
    );

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
    console.error('Get channels by category error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Search channels
router.get('/search', async (req, res) => {
  try {
    const { q, category_id, quality, language, country } = req.query;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT c.*, cat.name as category_name
      FROM channels c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.status = 'active'
    `;
    const params = [];

    if (q) {
      query += ' AND c.name LIKE ?';
      params.push(`%${q}%`);
    }

    if (category_id) {
      query += ' AND c.category_id = ?';
      params.push(category_id);
    }

    if (quality) {
      query += ' AND c.quality = ?';
      params.push(quality);
    }

    if (language) {
      query += ' AND c.language = ?';
      params.push(language);
    }

    if (country) {
      query += ' AND c.country = ?';
      params.push(country);
    }

    query += ' ORDER BY c.name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const channels = await db.all(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM channels c WHERE c.status = ?';
    const countParams = ['active'];

    if (q) {
      countQuery += ' AND c.name LIKE ?';
      countParams.push(`%${q}%`);
    }

    if (category_id) {
      countQuery += ' AND c.category_id = ?';
      countParams.push(category_id);
    }

    if (quality) {
      countQuery += ' AND c.quality = ?';
      countParams.push(quality);
    }

    if (language) {
      countQuery += ' AND c.language = ?';
      countParams.push(language);
    }

    if (country) {
      countQuery += ' AND c.country = ?';
      countParams.push(country);
    }

    const countResult = await db.get(countQuery, countParams);

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
    console.error('Search channels error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get channel details
router.get('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;

    const channel = await db.get(`
      SELECT c.*, cat.name as category_name
      FROM channels c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.id = ? AND c.status = 'active'
    `, [channelId]);

    if (!channel) {
      return res.status(404).json({
        error: 'Channel not found.'
      });
    }

    res.json({
      success: true,
      data: channel
    });

  } catch (error) {
    console.error('Get channel error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get popular channels
router.get('/popular', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const popularChannels = await db.all(`
      SELECT c.*, cat.name as category_name, COUNT(sl.id) as stream_count
      FROM channels c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN stream_logs sl ON c.id = sl.channel_id
      WHERE c.status = 'active'
      GROUP BY c.id
      ORDER BY stream_count DESC
      LIMIT ?
    `, [parseInt(limit)]);

    res.json({
      success: true,
      data: popularChannels
    });

  } catch (error) {
    console.error('Get popular channels error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get recently watched channels
router.get('/recent', async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20 } = req.query;

    const recentChannels = await db.all(`
      SELECT c.*, cat.name as category_name, MAX(sl.start_time) as last_watched
      FROM channels c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN stream_logs sl ON c.id = sl.channel_id AND sl.user_id = ?
      WHERE c.status = 'active' AND sl.id IS NOT NULL
      GROUP BY c.id
      ORDER BY last_watched DESC
      LIMIT ?
    `, [userId, parseInt(limit)]);

    res.json({
      success: true,
      data: recentChannels
    });

  } catch (error) {
    console.error('Get recent channels error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get channels by quality
router.get('/quality/:quality', async (req, res) => {
  try {
    const { quality } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const channels = await db.all(`
      SELECT c.*, cat.name as category_name
      FROM channels c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.quality = ? AND c.status = 'active'
      ORDER BY c.name
      LIMIT ? OFFSET ?
    `, [quality, parseInt(limit), offset]);

    // Get total count
    const countResult = await db.get(
      'SELECT COUNT(*) as total FROM channels WHERE quality = ? AND status = ?',
      [quality, 'active']
    );

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
    console.error('Get channels by quality error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get channels by language
router.get('/language/:language', async (req, res) => {
  try {
    const { language } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const channels = await db.all(`
      SELECT c.*, cat.name as category_name
      FROM channels c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.language = ? AND c.status = 'active'
      ORDER BY c.name
      LIMIT ? OFFSET ?
    `, [language, parseInt(limit), offset]);

    // Get total count
    const countResult = await db.get(
      'SELECT COUNT(*) as total FROM channels WHERE language = ? AND status = ?',
      [language, 'active']
    );

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
    console.error('Get channels by language error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

module.exports = router; 