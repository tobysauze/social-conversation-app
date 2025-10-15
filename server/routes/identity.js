const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS identity_visions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        vision TEXT,
        values TEXT, -- JSON array of core values words
        principles TEXT, -- JSON array of principles
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.warn('Ensure identity tables failed:', e?.message);
  }
  ensured = true;
}

router.get('/', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM identity_visions WHERE user_id=$1 LIMIT 1`, req.user.userId);
    if (!rows.length) return res.json({ identity: { vision: '', values: [], principles: [] } });
    const r = rows[0];
    res.json({ identity: { vision: r.vision || '', values: r.values ? JSON.parse(r.values) : [], principles: r.principles ? JSON.parse(r.principles) : [] } });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  await ensureTables();
  const { vision = '', values = [], principles = [] } = req.body;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO identity_visions (user_id, vision, values, principles) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET vision=EXCLUDED.vision, values=EXCLUDED.values, principles=EXCLUDED.principles, updated_at=NOW()`,
      req.user.userId,
      vision,
      JSON.stringify(values),
      JSON.stringify(principles)
    );
    res.json({ message: 'Saved' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save identity' });
  }
});

module.exports = router;


