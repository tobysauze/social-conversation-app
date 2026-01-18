const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma/client');
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

    // Hash password and create user if not exists
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    let created = null;
    try {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(400).json({ error: 'User already exists' });

      created = await prisma.user.create({
        data: { email, password: passwordHash, name }
      });
    } catch (e) {
      // Fallback to bundled SQLite
      const db = getDatabase();
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) return res.status(400).json({ error: 'User already exists' });

      const info = db
        .prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)')
        .run(email, passwordHash, name);
      const row = db
        .prepare('SELECT id, email, name FROM users WHERE id = ?')
        .get(info.lastInsertRowid);
      created = { id: row.id, email: row.email, name: row.name };
    }

    const token = jwt.sign(
      { userId: created.id, email: created.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: created.id, email: created.email, name: created.name }
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

    let user = null;
    let usedSQLiteFallback = false;

    // Try Prisma/Postgres first
    try {
      user = await prisma.user.findFirst({ where: { name: username } });
    } catch (e) {
      usedSQLiteFallback = true;
    }

    // Fallback to bundled SQLite if Prisma is unavailable (e.g., no DATABASE_URL/migrations yet)
    if (usedSQLiteFallback) {
      try {
        const db = getDatabase();
        user = db
          .prepare('SELECT id, email, name, password_hash FROM users WHERE name = ?')
          .get(username) || null;

        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
          { userId: user.id, email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        return res.json({
          message: 'Login successful',
          token,
          user: { id: user.id, email: user.email, name: user.name }
        });
      } catch (fallbackErr) {
        console.error('SQLite fallback login error:', fallbackErr);
        return res.status(500).json({ error: 'Database error' });
      }
    }

    // Prisma path (Postgres)
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    let user = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { id: true, email: true, name: true, createdAt: true }
      });
    } catch (e) {
      // Fallback to SQLite
      const db = getDatabase();
      const row = db
        .prepare('SELECT id, email, name, created_at FROM users WHERE id = ?')
        .get(req.user.userId);
      user = row
        ? { id: row.id, email: row.email, name: row.name, createdAt: row.created_at }
        : null;
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;

