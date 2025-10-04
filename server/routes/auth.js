const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const db = getDatabase();
    
    // Check if user already exists
    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (row) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password and create user
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      try {
        const stmt = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)');
        const result = stmt.run(email, passwordHash, name);
        
        // Generate JWT token
        const token = jwt.sign(
          { userId: result.lastInsertRowid, email },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.status(201).json({
          message: 'User created successfully',
          token,
          user: {
            id: result.lastInsertRowid,
            email,
            name
          }
        });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to create user' });
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = getDatabase();
    
      try {
        const stmt = db.prepare('SELECT id, email, password_hash, name FROM users WHERE name = ?');
        const user = stmt.get(username);

        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
          { userId: user.id, email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.json({
          message: 'Login successful',
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          }
        });
      } catch (err) {
        return res.status(500).json({ error: 'Database error' });
      }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  try {
    const stmt = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?');
    const user = stmt.get(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;

