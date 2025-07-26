const express = require('express');
const axios = require('axios');
const db = require('../database/database');
const { streamRateLimit } = require('../middleware/auth');

const router = express.Router();

// Get available streams for user
router.get('/', async (req, res) => {
  try {
    const { category_id, stream_type, quality, language, country } = req.query;
    const userId = req.user.id;

    let query = `
      SELECT c.*, cat.name as category_name 
      FROM channels c 
      LEFT JOIN categories cat ON c.category_id = cat.id 
      WHERE c.status = 'active'
    `;
    const params = [];

    if (category_id) {
      query += ' AND c.category_id = ?';
      params.push(category_id);
    }

    if (stream_type) {
      query += ' AND c.stream_type = ?';
      params.push(stream_type);
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

    query += ' ORDER BY cat.sort_order, c.name';

    const streams = await db.all(query, params);

    res.json({
      success: true,
      data: streams
    });

  } catch (error) {
    console.error('Get streams error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get stream by ID
router.get('/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;
    const userId = req.user.id;

    const stream = await db.get(`
      SELECT c.*, cat.name as category_name 
      FROM channels c 
      LEFT JOIN categories cat ON c.category_id = cat.id 
      WHERE c.id = ? AND c.status = 'active'
    `, [streamId]);

    if (!stream) {
      return res.status(404).json({
        error: 'Stream not found.'
      });
    }

    res.json({
      success: true,
      data: stream
    });

  } catch (error) {
    console.error('Get stream error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Start stream (proxy)
router.get('/:streamId/play', streamRateLimit, async (req, res) => {
  try {
    const { streamId } = req.params;
    const userId = req.user.id;
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip;

    // Get stream details
    const stream = await db.get(
      'SELECT * FROM channels WHERE id = ? AND status = ?',
      [streamId, 'active']
    );

    if (!stream) {
      return res.status(404).json({
        error: 'Stream not found.'
      });
    }

    // Log stream start
    const logResult = await db.run(
      'INSERT INTO stream_logs (user_id, channel_id, stream_url, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
      [userId, streamId, stream.stream_url, ipAddress, userAgent]
    );

    const logId = logResult.id;

    // Create proxy URL
    const proxyUrl = `/api/streams/${streamId}/proxy?log_id=${logId}`;

    res.json({
      success: true,
      data: {
        stream_url: proxyUrl,
        original_url: stream.stream_url,
        name: stream.name,
        quality: stream.quality,
        log_id: logId
      }
    });

  } catch (error) {
    console.error('Start stream error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Stream proxy endpoint
router.get('/:streamId/proxy', streamRateLimit, async (req, res) => {
  try {
    const { streamId } = req.params;
    const { log_id } = req.query;
    const userId = req.user.id;

    // Get stream details
    const stream = await db.get(
      'SELECT * FROM channels WHERE id = ? AND status = ?',
      [streamId, 'active']
    );

    if (!stream) {
      return res.status(404).json({
        error: 'Stream not found.'
      });
    }

    // Update log with start time
    if (log_id) {
      await db.run(
        'UPDATE stream_logs SET start_time = ? WHERE id = ? AND user_id = ?',
        [new Date(), log_id, userId]
      );
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');

    // Handle range requests
    const range = req.headers.range;
    if (range) {
      res.setHeader('Accept-Ranges', 'bytes');
    }

    // Proxy the stream
    try {
      const response = await axios({
        method: 'GET',
        url: stream.stream_url,
        responseType: 'stream',
        headers: {
          'User-Agent': req.get('User-Agent') || 'IPTV-Panel/1.0',
          'Range': range || undefined
        },
        timeout: 30000
      });

      // Forward headers
      if (response.headers['content-type']) {
        res.setHeader('Content-Type', response.headers['content-type']);
      }
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }
      if (response.headers['accept-ranges']) {
        res.setHeader('Accept-Ranges', response.headers['accept-ranges']);
      }
      if (response.headers['content-range']) {
        res.setHeader('Content-Range', response.headers['content-range']);
      }

      // Pipe the stream
      response.data.pipe(res);

      // Handle stream end
      response.data.on('end', async () => {
        if (log_id) {
          await db.run(
            'UPDATE stream_logs SET end_time = ?, duration = ? WHERE id = ?',
            [new Date(), Math.floor((new Date() - new Date()) / 1000), log_id]
          );
        }
      });

      // Handle stream error
      response.data.on('error', async (error) => {
        console.error('Stream proxy error:', error);
        if (log_id) {
          await db.run(
            'UPDATE stream_logs SET end_time = ? WHERE id = ?',
            [new Date(), log_id]
          );
        }
        res.end();
      });

    } catch (proxyError) {
      console.error('Proxy error:', proxyError);
      res.status(502).json({
        error: 'Failed to proxy stream.'
      });
    }

  } catch (error) {
    console.error('Stream proxy error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Stop stream
router.post('/:streamId/stop', async (req, res) => {
  try {
    const { streamId } = req.params;
    const { log_id } = req.body;
    const userId = req.user.id;

    if (log_id) {
      await db.run(
        'UPDATE stream_logs SET end_time = ?, duration = ? WHERE id = ? AND user_id = ?',
        [new Date(), Math.floor((new Date() - new Date()) / 1000), log_id, userId]
      );
    }

    res.json({
      success: true,
      message: 'Stream stopped successfully.'
    });

  } catch (error) {
    console.error('Stop stream error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get user's active streams
router.get('/user/active', async (req, res) => {
  try {
    const userId = req.user.id;

    const activeStreams = await db.all(`
      SELECT sl.*, c.name as channel_name, c.stream_url, c.logo_url
      FROM stream_logs sl
      LEFT JOIN channels c ON sl.channel_id = c.id
      WHERE sl.user_id = ? AND sl.end_time IS NULL
      ORDER BY sl.start_time DESC
    `, [userId]);

    res.json({
      success: true,
      data: activeStreams
    });

  } catch (error) {
    console.error('Get active streams error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

// Get stream statistics
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
        COUNT(DISTINCT sl.channel_id) as unique_channels
      FROM stream_logs sl
      WHERE sl.user_id = ? ${dateFilter}
    `, params);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get stream stats error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
});

module.exports = router; 