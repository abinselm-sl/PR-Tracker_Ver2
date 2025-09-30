const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const DatabaseService = require('../services/DatabaseService');
const SocketService = require('../services/SocketService');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// User configuration - In production, this should be in a database
const USER_CONFIG = {
  'abinselm': { role: 'Admin', password: '$2a$10$example1' }, // Replace with actual hashed passwords
  'Shahid': { role: 'Admin', password: '$2a$10$example2' },
  'Pilot': { role: 'Viewer', password: '$2a$10$example3' },
  'Master': { role: 'Viewer', password: '$2a$10$example4' },
  'Engineer': { role: 'Viewer', password: '$2a$10$example5' },
};

// Login
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('deviceId').trim().notEmpty().withMessage('Device ID is required'),
  body('deviceName').trim().notEmpty().withMessage('Device name is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { username, password, deviceId, deviceName } = req.body;
    
    const userConfig = USER_CONFIG[username];
    if (!userConfig) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isValidPassword = await bcrypt.compare(password, userConfig.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const sessionId = jwt.sign(
      { username, role: userConfig.role, deviceId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Store session in database
    await DatabaseService.createUserSession({
      sessionId,
      username,
      role: userConfig.role,
      deviceId,
      deviceName,
      lastSeen: Date.now()
    });

    // Notify other users about new session
    SocketService.broadcastUserJoined({
      sessionId,
      username,
      role: userConfig.role,
      deviceName
    });

    res.json({
      success: true,
      sessionId,
      role: userConfig.role,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (sessionId) {
      await DatabaseService.deleteUserSession(sessionId);
      SocketService.broadcastUserLeft(sessionId);
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

// Validate session
router.post('/validate', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.json({ valid: false });
    }

    try {
      jwt.verify(sessionId, JWT_SECRET);
      const session = await DatabaseService.getUserSession(sessionId);
      
      res.json({
        valid: !!session,
        session: session || null
      });
    } catch (jwtError) {
      res.json({ valid: false });
    }

  } catch (error) {
    console.error('Session validation error:', error);
    res.json({ valid: false });
  }
});

// Update heartbeat
router.post('/heartbeat', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (sessionId) {
      await DatabaseService.updateUserHeartbeat(sessionId);
    }

    res.json({
      success: true,
      message: 'Heartbeat updated'
    });

  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({
      success: false,
      message: 'Heartbeat update failed'
    });
  }
});

module.exports = router;