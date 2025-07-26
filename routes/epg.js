const express = require('express');
const db = require('../database/database');

const router = express.Router();

// Get EPG for a specific channel
router.get('/channel/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { date } = req.query;

    let dateFilter = '';
    const params = [channelId];

    if (date) {
      dateFilter = 'AND DATE(start_time) = ?';
      params.push(date);
    } else {
      // Default to today
      dateFilter = 'AND DATE(start_time) = DATE("now")';
    }

    const epg = await db.all(`
      SELECT * FROM epg 
      WHERE channel_id = ? ${dateFilter}
      ORDER BY start_time ASC
    `, params);

    res.json({
      success: true,
      data: epg
    });

  } catch (error) {
    console.error('Get EPG error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get EPG for multiple channels
router.post('/channels', async (req, res) => {
  try {
    const { channelIds, date } = req.body;

    if (!channelIds || !Array.isArray(channelIds)) {
      return res.status(400).json({
        error: 'Channel IDs array is required.'
      });
    }

    let dateFilter = '';
    const params = [channelIds];

    if (date) {
      dateFilter = 'AND DATE(start_time) = ?';
      params.push(date);
    } else {
      // Default to today
      dateFilter = 'AND DATE(start_time) = DATE("now")';
    }

    const epg = await db.all(`
      SELECT e.*, c.name as channel_name, c.logo_url
      FROM epg e
      LEFT JOIN channels c ON e.channel_id = c.id
      WHERE e.channel_id IN (${channelIds.map(() => '?').join(',')}) ${dateFilter}
      ORDER BY e.start_time ASC
    `, params);

    res.json({
      success: true,
      data: epg
    });

  } catch (error) {
    console.error('Get EPG for channels error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get current program for a channel
router.get('/channel/:channelId/current', async (req, res) => {
  try {
    const { channelId } = req.params;

    const currentProgram = await db.get(`
      SELECT * FROM epg 
      WHERE channel_id = ? 
        AND start_time <= datetime('now') 
        AND end_time > datetime('now')
      ORDER BY start_time DESC 
      LIMIT 1
    `, [channelId]);

    if (!currentProgram) {
      return res.json({
        success: true,
        data: null
      });
    }

    res.json({
      success: true,
      data: currentProgram
    });

  } catch (error) {
    console.error('Get current program error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get next program for a channel
router.get('/channel/:channelId/next', async (req, res) => {
  try {
    const { channelId } = req.params;

    const nextProgram = await db.get(`
      SELECT * FROM epg 
      WHERE channel_id = ? 
        AND start_time > datetime('now')
      ORDER BY start_time ASC 
      LIMIT 1
    `, [channelId]);

    if (!nextProgram) {
      return res.json({
        success: true,
        data: null
      });
    }

    res.json({
      success: true,
      data: nextProgram
    });

  } catch (error) {
    console.error('Get next program error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Search EPG programs
router.get('/search', async (req, res) => {
  try {
    const { q, category, rating, date } = req.query;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT e.*, c.name as channel_name, c.logo_url, cat.name as category_name
      FROM epg e
      LEFT JOIN channels c ON e.channel_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE 1=1
    `;
    const params = [];

    if (q) {
      query += ' AND (e.title LIKE ? OR e.description LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }

    if (category) {
      query += ' AND e.category = ?';
      params.push(category);
    }

    if (rating) {
      query += ' AND e.rating = ?';
      params.push(rating);
    }

    if (date) {
      query += ' AND DATE(e.start_time) = ?';
      params.push(date);
    } else {
      // Default to today and future
      query += ' AND e.start_time >= datetime("now")';
    }

    query += ' ORDER BY e.start_time ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const programs = await db.all(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM epg e
      LEFT JOIN channels c ON e.channel_id = c.id
      WHERE 1=1
    `;
    const countParams = [];

    if (q) {
      countQuery += ' AND (e.title LIKE ? OR e.description LIKE ?)';
      countParams.push(`%${q}%`, `%${q}%`);
    }

    if (category) {
      countQuery += ' AND e.category = ?';
      countParams.push(category);
    }

    if (rating) {
      countQuery += ' AND e.rating = ?';
      countParams.push(rating);
    }

    if (date) {
      countQuery += ' AND DATE(e.start_time) = ?';
      countParams.push(date);
    } else {
      countQuery += ' AND e.start_time >= datetime("now")';
    }

    const countResult = await db.get(countQuery, countParams);

    res.json({
      success: true,
      data: programs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        pages: Math.ceil(countResult.total / limit)
      }
    });

  } catch (error) {
    console.error('Search EPG error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get EPG categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await db.all(`
      SELECT DISTINCT category, COUNT(*) as program_count
      FROM epg 
      WHERE category IS NOT NULL AND category != ''
      GROUP BY category
      ORDER BY program_count DESC
    `);

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('Get EPG categories error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get EPG ratings
router.get('/ratings', async (req, res) => {
  try {
    const ratings = await db.all(`
      SELECT DISTINCT rating, COUNT(*) as program_count
      FROM epg 
      WHERE rating IS NOT NULL AND rating != ''
      GROUP BY rating
      ORDER BY program_count DESC
    `);

    res.json({
      success: true,
      data: ratings
    });

  } catch (error) {
    console.error('Get EPG ratings error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get EPG for a specific date range
router.get('/range', async (req, res) => {
  try {
    const { start_date, end_date, channel_ids } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        error: 'Start date and end date are required.'
      });
    }

    let query = `
      SELECT e.*, c.name as channel_name, c.logo_url, cat.name as category_name
      FROM epg e
      LEFT JOIN channels c ON e.channel_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE e.start_time >= ? AND e.start_time <= ?
    `;
    const params = [start_date, end_date];

    if (channel_ids) {
      const channelIds = channel_ids.split(',').map(id => parseInt(id.trim()));
      query += ` AND e.channel_id IN (${channelIds.map(() => '?').join(',')})`;
      params.push(...channelIds);
    }

    query += ' ORDER BY e.start_time ASC';

    const epg = await db.all(query, params);

    res.json({
      success: true,
      data: epg
    });

  } catch (error) {
    console.error('Get EPG range error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

module.exports = router; 