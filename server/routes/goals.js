const express = require('express');
const { prisma } = require('../prisma/client');
const { Prisma } = require('@prisma/client');
const { getDatabase } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        area TEXT,
        target_date DATE,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.warn('Ensure goals table (Postgres) failed:', e?.message);
    // Fallback to SQLite
    try {
      const db = getDatabase();
      db.exec(`
        CREATE TABLE IF NOT EXISTS goals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          area TEXT,
          target_date TEXT,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (sqliteErr) {
      console.warn('Ensure goals table (SQLite) failed:', sqliteErr?.message);
    }
  }
  ensured = true;
}

function normalizeDate(input) {
  if (!input) return null;
  // Already ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  // Convert from DD/MM/YYYY to YYYY-MM-DD
  const m = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [_, dd, mm, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  }
  // Fallback: return as-is
  return input;
}

router.get('/', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    const rows = await prisma.$queryRaw`SELECT * FROM goals WHERE user_id=${req.user.userId} ORDER BY created_at DESC`;
    res.json({ goals: rows });
  } catch (e) {
    console.error('Goals GET (Postgres) error:', e);
    // Fallback to SQLite
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC').all(req.user.userId);
      res.json({ goals: rows });
    } catch (sqliteErr) {
      console.error('Goals GET (SQLite) error:', sqliteErr);
      res.status(500).json({ error: 'Database error' });
    }
  }
});

router.post('/', authenticateToken, async (req, res) => {
  await ensureTables();
  const { title, description = '', area = null } = req.body;
  const target_date = normalizeDate(req.body.target_date);
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    await prisma.$executeRaw`INSERT INTO goals (user_id, title, description, area, target_date) VALUES (${req.user.userId}, ${title}, ${description}, ${area}, ${target_date})`;
    res.status(201).json({ message: 'Created' });
  } catch (e) {
    console.error('Goals POST (Postgres) error:', e);
    // Fallback to SQLite
    try {
      const db = getDatabase();
      db.prepare('INSERT INTO goals (user_id, title, description, area, target_date) VALUES (?, ?, ?, ?, ?)').run(
        req.user.userId, title, description, area, target_date
      );
      res.status(201).json({ message: 'Created' });
    } catch (sqliteErr) {
      console.error('Goals POST (SQLite) error:', sqliteErr);
      res.status(500).json({ error: 'Failed to create goal' });
    }
  }
});

router.patch('/:id', authenticateToken, async (req, res) => {
  await ensureTables();
  const { id } = req.params;
  const { title, description, area, status } = req.body;
  const target_date = normalizeDate(req.body.target_date);
  const fields = [];
  const params = [];
  function add(field, val) { if (val !== undefined) { fields.push(`${field}=$${fields.length+1}`); params.push(val); } }
  try {
    const sets = [];
    if (title !== undefined) sets.push(Prisma.sql`title = ${title}`);
    if (description !== undefined) sets.push(Prisma.sql`description = ${description}`);
    if (area !== undefined) sets.push(Prisma.sql`area = ${area}`);
    if (target_date !== undefined) sets.push(Prisma.sql`target_date = ${target_date}`);
    if (status !== undefined) sets.push(Prisma.sql`status = ${status}`);
    if (!sets.length) return res.status(400).json({ error: 'no updates' });
    const setSql = Prisma.join(sets, Prisma.raw(', '));
    await prisma.$executeRaw`UPDATE goals SET ${setSql}, updated_at=NOW() WHERE user_id=${req.user.userId} AND id=${Number(id)}`;
    res.json({ message: 'Updated' });
  } catch (e) {
    console.error('Goals PATCH (Postgres) error:', e);
    // Fallback to SQLite
    try {
      const db = getDatabase();
      const sqliteFields = [];
      const sqliteParams = [];
      if (title !== undefined) { sqliteFields.push('title = ?'); sqliteParams.push(title); }
      if (description !== undefined) { sqliteFields.push('description = ?'); sqliteParams.push(description); }
      if (area !== undefined) { sqliteFields.push('area = ?'); sqliteParams.push(area); }
      if (target_date !== undefined) { sqliteFields.push('target_date = ?'); sqliteParams.push(target_date); }
      if (status !== undefined) { sqliteFields.push('status = ?'); sqliteParams.push(status); }
      if (!sqliteFields.length) return res.status(400).json({ error: 'no updates' });
      sqliteParams.push(req.user.userId, Number(id));
      db.prepare(`UPDATE goals SET ${sqliteFields.join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND id=?`).run(...sqliteParams);
      res.json({ message: 'Updated' });
    } catch (sqliteErr) {
      console.error('Goals PATCH (SQLite) error:', sqliteErr);
      res.status(500).json({ error: 'Failed to update goal' });
    }
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    await prisma.$executeRaw`DELETE FROM goals WHERE user_id=${req.user.userId} AND id=${Number(req.params.id)}`;
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('Goals DELETE (Postgres) error:', e);
    // Fallback to SQLite
    try {
      const db = getDatabase();
      db.prepare('DELETE FROM goals WHERE user_id=? AND id=?').run(req.user.userId, Number(req.params.id));
      res.json({ message: 'Deleted' });
    } catch (sqliteErr) {
      console.error('Goals DELETE (SQLite) error:', sqliteErr);
      res.status(500).json({ error: 'Failed to delete goal' });
    }
  }
});

module.exports = router;


