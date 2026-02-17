const express = require('express');
const { prisma } = require('../prisma/client');
const { getDatabase } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

let ensured = false;

function parseSteps(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim()).filter(Boolean);
  } catch (_) {}
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function ensureTables() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS protocols (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        when_to_use TEXT,
        steps TEXT,
        cadence TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.warn('Ensure protocols table (Postgres) failed:', e?.message);
  }

  try {
    const db = getDatabase();
    db.exec(`
      CREATE TABLE IF NOT EXISTS protocols (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        when_to_use TEXT,
        steps TEXT,
        cadence TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (sqliteErr) {
    console.warn('Ensure protocols table (SQLite) failed:', sqliteErr?.message);
  }

  ensured = true;
}

router.get('/', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM protocols WHERE user_id = $1 ORDER BY updated_at DESC, id DESC`,
      req.user.userId
    );
    return res.json({
      protocols: rows.map((r) => ({
        ...r,
        steps: parseSteps(r.steps)
      }))
    });
  } catch (e) {
    try {
      const db = getDatabase();
      const rows = db
        .prepare(`SELECT * FROM protocols WHERE user_id = ? ORDER BY updated_at DESC, id DESC`)
        .all(req.user.userId);
      return res.json({
        protocols: rows.map((r) => ({
          ...r,
          steps: parseSteps(r.steps)
        }))
      });
    } catch (sqliteErr) {
      console.error('Protocols list error:', sqliteErr);
      return res.status(500).json({ error: 'Database error' });
    }
  }
});

router.post('/', authenticateToken, async (req, res) => {
  await ensureTables();
  const payload = req.body || {};
  const title = (payload.title || '').toString().trim();
  const whenToUse = (payload.when_to_use || '').toString().trim();
  const cadence = (payload.cadence || '').toString().trim();
  const steps = parseSteps(payload.steps);

  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO protocols (user_id, title, when_to_use, steps, cadence)
       VALUES ($1, $2, $3, $4, $5)`,
      req.user.userId,
      title,
      whenToUse || null,
      JSON.stringify(steps),
      cadence || null
    );
    return res.status(201).json({ message: 'Created' });
  } catch (e) {
    try {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO protocols (user_id, title, when_to_use, steps, cadence)
         VALUES (?, ?, ?, ?, ?)`
      ).run(req.user.userId, title, whenToUse || null, JSON.stringify(steps), cadence || null);
      return res.status(201).json({ message: 'Created' });
    } catch (sqliteErr) {
      console.error('Protocols create error:', sqliteErr);
      return res.status(500).json({ error: 'Failed to create protocol' });
    }
  }
});

router.patch('/:id', authenticateToken, async (req, res) => {
  await ensureTables();
  const protocolId = Number(req.params.id);
  const payload = req.body || {};
  const title = payload.title !== undefined ? (payload.title || '').toString().trim() : undefined;
  const whenToUse = payload.when_to_use !== undefined ? (payload.when_to_use || '').toString().trim() : undefined;
  const cadence = payload.cadence !== undefined ? (payload.cadence || '').toString().trim() : undefined;
  const steps = payload.steps !== undefined ? parseSteps(payload.steps) : undefined;

  try {
    const sets = [];
    const params = [];
    if (title !== undefined) { sets.push(`title = $${sets.length + 1}`); params.push(title); }
    if (whenToUse !== undefined) { sets.push(`when_to_use = $${sets.length + 1}`); params.push(whenToUse || null); }
    if (steps !== undefined) { sets.push(`steps = $${sets.length + 1}`); params.push(JSON.stringify(steps)); }
    if (cadence !== undefined) { sets.push(`cadence = $${sets.length + 1}`); params.push(cadence || null); }
    if (!sets.length) return res.status(400).json({ error: 'no updates' });
    params.push(req.user.userId, protocolId);
    const sql = `UPDATE protocols SET ${sets.join(', ')}, updated_at=NOW() WHERE user_id = $${sets.length + 1} AND id = $${sets.length + 2}`;
    await prisma.$executeRawUnsafe(sql, ...params);
    return res.json({ message: 'Updated' });
  } catch (e) {
    try {
      const db = getDatabase();
      const sets = [];
      const params = [];
      if (title !== undefined) { sets.push(`title = ?`); params.push(title); }
      if (whenToUse !== undefined) { sets.push(`when_to_use = ?`); params.push(whenToUse || null); }
      if (steps !== undefined) { sets.push(`steps = ?`); params.push(JSON.stringify(steps)); }
      if (cadence !== undefined) { sets.push(`cadence = ?`); params.push(cadence || null); }
      if (!sets.length) return res.status(400).json({ error: 'no updates' });
      params.push(req.user.userId, protocolId);
      db.prepare(`UPDATE protocols SET ${sets.join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE user_id = ? AND id = ?`).run(...params);
      return res.json({ message: 'Updated' });
    } catch (sqliteErr) {
      console.error('Protocols update error:', sqliteErr);
      return res.status(500).json({ error: 'Failed to update protocol' });
    }
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  await ensureTables();
  const protocolId = Number(req.params.id);
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM protocols WHERE user_id = $1 AND id = $2`,
      req.user.userId,
      protocolId
    );
    return res.json({ message: 'Deleted' });
  } catch (e) {
    try {
      const db = getDatabase();
      db.prepare(`DELETE FROM protocols WHERE user_id = ? AND id = ?`).run(req.user.userId, protocolId);
      return res.json({ message: 'Deleted' });
    } catch (sqliteErr) {
      console.error('Protocols delete error:', sqliteErr);
      return res.status(500).json({ error: 'Failed to delete protocol' });
    }
  }
});

module.exports = router;
