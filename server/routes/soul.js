const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Per-user "soul.md" — one markdown blob per user. The thing they read every
// day as a reminder of how they want to live. Same shape as user_profiles
// (see routes/me.js): one row per user, the user IS the key.
let ensuredUserSouls = false;
async function ensureUserSoulsTable() {
  if (ensuredUserSouls) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS user_souls (
        user_id INTEGER PRIMARY KEY,
        content TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.warn('Could not ensure user_souls table:', e?.message);
  }
  ensuredUserSouls = true;
}

async function loadSoul(userId) {
  await ensureUserSoulsTable();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT user_id, content, updated_at FROM user_souls WHERE user_id = $1`,
    Number(userId)
  );
  const row = (rows || [])[0];
  return row
    ? { content: row.content || '', updatedAt: row.updated_at }
    : { content: '', updatedAt: null };
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const soul = await loadSoul(req.user.userId);
    res.json(soul);
  } catch (e) {
    console.error('soul load error:', e);
    res.status(500).json({ error: 'Failed to load soul' });
  }
});

router.put('/', authenticateToken, async (req, res) => {
  await ensureUserSoulsTable();
  const content = (req.body?.content ?? '').toString();
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO user_souls (user_id, content, updated_at)
         VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`,
      Number(req.user.userId),
      content
    );
    const soul = await loadSoul(req.user.userId);
    res.json(soul);
  } catch (e) {
    console.error('soul save error:', e);
    res.status(500).json({ error: 'Failed to save soul' });
  }
});

module.exports = router;
module.exports.loadSoul = loadSoul;
