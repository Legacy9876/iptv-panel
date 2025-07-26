const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, 'iptv_panel.db');
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
          return;
        }
        
        console.log('Connected to SQLite database');
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  async createTables() {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'reseller', 'user') DEFAULT 'user',
        status ENUM('active', 'suspended', 'banned') DEFAULT 'active',
        max_connections INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        last_login DATETIME
      )`,

      // Categories table
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        parent_id INTEGER,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES categories(id)
      )`,

      // Channels table
      `CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL,
        stream_url TEXT NOT NULL,
        logo_url TEXT,
        category_id INTEGER,
        epg_id VARCHAR(100),
        stream_type ENUM('live', 'vod', 'series') DEFAULT 'live',
        quality VARCHAR(20) DEFAULT 'HD',
        language VARCHAR(10) DEFAULT 'en',
        country VARCHAR(10),
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )`,

      // EPG table
      `CREATE TABLE IF NOT EXISTS epg (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id INTEGER,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        category VARCHAR(100),
        rating VARCHAR(10),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_id) REFERENCES channels(id)
      )`,

      // User sessions table
      `CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      // Stream logs table
      `CREATE TABLE IF NOT EXISTS stream_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        channel_id INTEGER,
        stream_url TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        duration INTEGER,
        bytes_transferred BIGINT DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (channel_id) REFERENCES channels(id)
      )`,

      // Settings table
      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Insert default admin user
    await this.createDefaultAdmin();
    
    // Insert default settings
    await this.insertDefaultSettings();

    console.log('Database tables created successfully');
  }

  async createDefaultAdmin() {
    const adminExists = await this.get('SELECT id FROM users WHERE username = ?', ['admin']);
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await this.run(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        ['admin', 'admin@iptvpanel.com', hashedPassword, 'admin']
      );
      console.log('Default admin user created: admin / admin123');
    }
  }

  async insertDefaultSettings() {
    const defaultSettings = [
      ['site_name', 'Custom IPTV Panel', 'string', 'Site name'],
      ['site_description', 'Custom IPTV Panel - Live Xtream/XUI Alternative', 'string', 'Site description'],
      ['max_connections_per_user', '3', 'number', 'Maximum connections per user'],
      ['stream_timeout', '30', 'number', 'Stream timeout in seconds'],
      ['epg_update_interval', '3600', 'number', 'EPG update interval in seconds'],
      ['enable_registration', 'false', 'boolean', 'Enable user registration'],
      ['maintenance_mode', 'false', 'boolean', 'Maintenance mode'],
      ['default_quality', 'HD', 'string', 'Default stream quality'],
      ['logo_url', '/images/logo.png', 'string', 'Site logo URL'],
      ['theme', 'dark', 'string', 'Default theme']
    ];

    for (const [key, value, type, description] of defaultSettings) {
      await this.run(
        'INSERT OR IGNORE INTO settings (setting_key, setting_value, setting_type, description) VALUES (?, ?, ?, ?)',
        [key, value, type, description]
      );
    }
  }

  // Database operation methods
  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = new Database(); 