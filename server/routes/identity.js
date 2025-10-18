const express = require('express');
const { prisma } = require('../prisma/client');
const { getDatabase } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS identity_visions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE,
        vision TEXT,
        "values" TEXT,
        principles TEXT,
        vision_points TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Ensure unique index exists even if table was created earlier without UNIQUE
    try { await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS identity_visions_user_id_idx ON identity_visions(user_id)`); } catch(_) {}
  } catch (e) {
    console.warn('Ensure identity tables (Postgres) failed:', e?.message);
    // Fallback to SQLite
    try {
      const db = getDatabase();
      db.exec(`
        CREATE TABLE IF NOT EXISTS identity_visions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE,
          vision TEXT,
          "values" TEXT,
          principles TEXT,
          vision_points TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // Ensure unique index exists
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS identity_visions_user_id_idx ON identity_visions(user_id)`);
    } catch (sqliteErr) {
      console.warn('Ensure identity tables (SQLite) failed:', sqliteErr?.message);
    }
  }
  ensured = true;
}

router.get('/', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM identity_visions WHERE user_id=$1 LIMIT 1`, req.user.userId);
    if (!rows.length) return res.json({ identity: { vision: '', values: [], principles: [], vision_points: [] } });
    const r = rows[0];
    res.json({ identity: { vision: r.vision || '', values: r.values ? JSON.parse(r.values) : [], principles: r.principles ? JSON.parse(r.principles) : [], vision_points: r.vision_points ? JSON.parse(r.vision_points) : [] } });
  } catch (e) {
    console.error('Identity GET (Postgres) error:', e);
    // Fallback to SQLite
    try {
      const db = getDatabase();
      const r = db.prepare('SELECT * FROM identity_visions WHERE user_id = ? LIMIT 1').get(req.user.userId);
      if (!r) return res.json({ identity: { vision: '', values: [], principles: [], vision_points: [] } });
      res.json({ identity: { vision: r.vision || '', values: r.values ? JSON.parse(r.values) : [], principles: r.principles ? JSON.parse(r.principles) : [], vision_points: r.vision_points ? JSON.parse(r.vision_points) : [] } });
    } catch (sqliteErr) {
      console.error('Identity GET (SQLite) error:', sqliteErr);
      res.status(500).json({ error: 'Database error' });
    }
  }
});

router.post('/', authenticateToken, async (req, res) => {
  await ensureTables();
  const { vision = '', values = [], principles = [], vision_points = [] } = req.body;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO identity_visions (user_id, vision, "values", principles, vision_points) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id) DO UPDATE SET vision=EXCLUDED.vision, "values"=EXCLUDED."values", principles=EXCLUDED.principles, vision_points=EXCLUDED.vision_points, updated_at=NOW()`,
      req.user.userId,
      vision,
      JSON.stringify(values),
      JSON.stringify(principles),
      JSON.stringify(vision_points)
    );
    res.json({ message: 'Saved' });
  } catch (e) {
    console.error('Identity POST (Postgres) error:', e);
    // Fallback to SQLite
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT INTO identity_visions (user_id, vision, "values", principles, vision_points)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET vision=excluded.vision, "values"=excluded."values", principles=excluded.principles, vision_points=excluded.vision_points, updated_at=CURRENT_TIMESTAMP
      `).run(req.user.userId, vision, JSON.stringify(values), JSON.stringify(principles), JSON.stringify(vision_points));
      res.json({ message: 'Saved' });
    } catch (sqliteErr) {
      console.error('Identity POST (SQLite) error:', sqliteErr);
      res.status(500).json({ error: 'Failed to save identity' });
    }
  }
});

module.exports = router;


