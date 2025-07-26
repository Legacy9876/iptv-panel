const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/database');

// License validation middleware
const validateLicense = async (req, res, next) => {
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
        console.error('License validation error:', error);
        res.status(500).json({ error: 'License validation failed' });
    }
};

// Generate license key
const generateLicenseKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) result += '-';
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Create license
router.post('/create', async (req, res) => {
    try {
        const { 
            customer_name, 
            customer_email, 
            plan_type, 
            max_connections = 1,
            duration_days = 30,
            features = 'basic'
        } = req.body;

        if (!customer_name || !customer_email || !plan_type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const licenseKey = generateLicenseKey();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + duration_days);

        await db.run(`
            INSERT INTO licenses (
                license_key, customer_name, customer_email, plan_type, 
                max_connections, current_connections, features, 
                created_at, expires_at, status
            ) VALUES (?, ?, ?, ?, ?, 0, ?, datetime("now"), ?, "active")
        `, [licenseKey, customer_name, customer_email, plan_type, max_connections, features, expiresAt.toISOString()]);

        res.json({
            success: true,
            license_key: licenseKey,
            expires_at: expiresAt.toISOString(),
            message: 'License created successfully'
        });
    } catch (error) {
        console.error('License creation error:', error);
        res.status(500).json({ error: 'Failed to create license' });
    }
});

// Validate license
router.post('/validate', validateLicense, (req, res) => {
    res.json({
        success: true,
        license: {
            key: req.license.license_key,
            customer: req.license.customer_name,
            plan: req.license.plan_type,
            features: req.license.features,
            expires_at: req.license.expires_at,
            max_connections: req.license.max_connections,
            current_connections: req.license.current_connections
        }
    });
});

// Get license info
router.get('/info/:licenseKey', async (req, res) => {
    try {
        const license = await db.get(
            'SELECT * FROM licenses WHERE license_key = ?',
            [req.params.licenseKey]
        );

        if (!license) {
            return res.status(404).json({ error: 'License not found' });
        }

        res.json({
            success: true,
            license: {
                customer_name: license.customer_name,
                customer_email: license.customer_email,
                plan_type: license.plan_type,
                features: license.features,
                created_at: license.created_at,
                expires_at: license.expires_at,
                status: license.status,
                max_connections: license.max_connections,
                current_connections: license.current_connections,
                last_used: license.last_used
            }
        });
    } catch (error) {
        console.error('License info error:', error);
        res.status(500).json({ error: 'Failed to get license info' });
    }
});

// List all licenses (admin only)
router.get('/list', async (req, res) => {
    try {
        const licenses = await db.all(`
            SELECT license_key, customer_name, customer_email, plan_type, 
                   features, created_at, expires_at, status, 
                   max_connections, current_connections, last_used
            FROM licenses 
            ORDER BY created_at DESC
        `);

        res.json({
            success: true,
            licenses: licenses
        });
    } catch (error) {
        console.error('License list error:', error);
        res.status(500).json({ error: 'Failed to list licenses' });
    }
});

// Update license
router.put('/update/:licenseKey', async (req, res) => {
    try {
        const { 
            customer_name, 
            customer_email, 
            plan_type, 
            max_connections,
            features,
            status,
            duration_days
        } = req.body;

        let updateFields = [];
        let params = [];

        if (customer_name) {
            updateFields.push('customer_name = ?');
            params.push(customer_name);
        }
        if (customer_email) {
            updateFields.push('customer_email = ?');
            params.push(customer_email);
        }
        if (plan_type) {
            updateFields.push('plan_type = ?');
            params.push(plan_type);
        }
        if (max_connections !== undefined) {
            updateFields.push('max_connections = ?');
            params.push(max_connections);
        }
        if (features) {
            updateFields.push('features = ?');
            params.push(features);
        }
        if (status) {
            updateFields.push('status = ?');
            params.push(status);
        }
        if (duration_days) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + duration_days);
            updateFields.push('expires_at = ?');
            params.push(expiresAt.toISOString());
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(req.params.licenseKey);

        await db.run(
            `UPDATE licenses SET ${updateFields.join(', ')} WHERE license_key = ?`,
            params
        );

        res.json({
            success: true,
            message: 'License updated successfully'
        });
    } catch (error) {
        console.error('License update error:', error);
        res.status(500).json({ error: 'Failed to update license' });
    }
});

// Revoke license
router.delete('/revoke/:licenseKey', async (req, res) => {
    try {
        await db.run(
            'UPDATE licenses SET status = "revoked" WHERE license_key = ?',
            [req.params.licenseKey]
        );

        res.json({
            success: true,
            message: 'License revoked successfully'
        });
    } catch (error) {
        console.error('License revocation error:', error);
        res.status(500).json({ error: 'Failed to revoke license' });
    }
});

// License usage statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await db.get(`
            SELECT 
                COUNT(*) as total_licenses,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_licenses,
                COUNT(CASE WHEN status = 'revoked' THEN 1 END) as revoked_licenses,
                COUNT(CASE WHEN expires_at < datetime('now') THEN 1 END) as expired_licenses,
                SUM(max_connections) as total_connections,
                SUM(current_connections) as used_connections
            FROM licenses
        `);

        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('License stats error:', error);
        res.status(500).json({ error: 'Failed to get license statistics' });
    }
});

// Decrease connection count (called when user disconnects)
router.post('/disconnect/:licenseKey', async (req, res) => {
    try {
        await db.run(
            'UPDATE licenses SET current_connections = MAX(0, current_connections - 1) WHERE license_key = ?',
            [req.params.licenseKey]
        );

        res.json({
            success: true,
            message: 'Connection count decreased'
        });
    } catch (error) {
        console.error('License disconnect error:', error);
        res.status(500).json({ error: 'Failed to decrease connection count' });
    }
});

module.exports = router; 