const jwt = require('jsonwebtoken');
const db = require('../database/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.cookies?.token || 
                  req.query.token;

    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.' 
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user exists and is active
    const user = await db.get(
      'SELECT id, username, email, role, status, max_connections, expires_at FROM users WHERE id = ? AND status = ?',
      [decoded.userId, 'active']
    );

    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid token or user not found.' 
      });
    }

    // Check if user account has expired
    if (user.expires_at && new Date(user.expires_at) < new Date()) {
      return res.status(401).json({ 
        error: 'Account has expired. Please contact administrator.' 
      });
    }

    // Check if session exists in database
    const session = await db.get(
      'SELECT * FROM user_sessions WHERE user_id = ? AND session_token = ? AND expires_at > ?',
      [user.id, token, new Date()]
    );

    if (!session) {
      return res.status(401).json({ 
        error: 'Session expired. Please login again.' 
      });
    }

    // Add user info to request
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      error: 'Invalid token.' 
    });
  }
};

// Optional auth middleware (doesn't require token but adds user if present)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.cookies?.token || 
                  req.query.token;

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await db.get(
        'SELECT id, username, email, role, status FROM users WHERE id = ? AND status = ?',
        [decoded.userId, 'active']
      );
      
      if (user) {
        req.user = user;
        req.token = token;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Rate limiting middleware for streams
const streamRateLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await db.get(
      'SELECT max_connections FROM users WHERE id = ?',
      [userId]
    );

    // Count active streams for this user
    const activeStreams = await db.all(
      'SELECT COUNT(*) as count FROM stream_logs WHERE user_id = ? AND end_time IS NULL',
      [userId]
    );

    if (activeStreams[0].count >= user.max_connections) {
      return res.status(429).json({
        error: 'Maximum connections reached. Please close other streams first.'
      });
    }

    next();
  } catch (error) {
    console.error('Stream rate limit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// License validation middleware
const licenseMiddleware = async (req, res, next) => {
  try {
    const licenseKey = req.headers['x-license-key'] || req.query.license || req.body.license;
    
    if (!licenseKey) {
      return res.status(401).json({ error: 'License key required' });
    }

    // Check if license exists and is valid
    const license = await db.get(
      'SELECT * FROM licenses WHERE license_key = ? AND status = "active" AND expires_at > datetime("now")',
      [licenseKey]
    );

    if (!license) {
      return res.status(401).json({ error: 'Invalid or expired license key' });
    }

    // Check usage limits
    if (license.max_connections && license.current_connections >= license.max_connections) {
      return res.status(429).json({ error: 'License connection limit reached' });
    }

    // Update last used timestamp
    await db.run(
      'UPDATE licenses SET last_used = datetime("now"), current_connections = current_connections + 1 WHERE license_key = ?',
      [licenseKey]
    );

    req.license = license;
    next();
  } catch (error) {
    console.error('License middleware error:', error);
    res.status(500).json({ error: 'License validation failed' });
  }
};

module.exports = {
  authMiddleware,
  optionalAuth,
  streamRateLimit,
  licenseMiddleware,
  JWT_SECRET
}; 