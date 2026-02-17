const express = require('express');
const { prisma } = require('../prisma/client');
const { getDatabase } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const { generateIdentityVision } = require('../services/openai');

const router = express.Router();

function parseJsonArraySafe(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

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
        traits TEXT,
        vision_points TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Ensure unique index exists even if table was created earlier without UNIQUE
    try { await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS identity_visions_user_id_idx ON identity_visions(user_id)`); } catch(_) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE identity_visions ADD COLUMN IF NOT EXISTS traits TEXT`); } catch(_) {}
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
          traits TEXT,
          vision_points TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // Ensure unique index exists
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS identity_visions_user_id_idx ON identity_visions(user_id)`);
      try { db.exec(`ALTER TABLE identity_visions ADD COLUMN traits TEXT`); } catch (_) {}
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
    if (!rows.length) return res.json({ identity: { vision: '', values: [], principles: [], traits: [], vision_points: [] } });
    const r = rows[0];
    res.json({
      identity: {
        vision: r.vision || '',
        values: parseJsonArraySafe(r.values),
        principles: parseJsonArraySafe(r.principles),
        traits: parseJsonArraySafe(r.traits),
        vision_points: parseJsonArraySafe(r.vision_points)
      }
    });
  } catch (e) {
    console.error('Identity GET (Postgres) error:', e);
    // Fallback to SQLite
    try {
      const db = getDatabase();
      const r = db.prepare('SELECT * FROM identity_visions WHERE user_id = ? LIMIT 1').get(req.user.userId);
      if (!r) return res.json({ identity: { vision: '', values: [], principles: [], traits: [], vision_points: [] } });
      res.json({
        identity: {
          vision: r.vision || '',
          values: parseJsonArraySafe(r.values),
          principles: parseJsonArraySafe(r.principles),
          traits: parseJsonArraySafe(r.traits),
          vision_points: parseJsonArraySafe(r.vision_points)
        }
      });
    } catch (sqliteErr) {
      console.error('Identity GET (SQLite) error:', sqliteErr);
      res.status(500).json({ error: 'Database error' });
    }
  }
});

router.post('/', authenticateToken, async (req, res) => {
  await ensureTables();
  const { vision = '', values = [], principles = [], traits = [], vision_points = [] } = req.body;
  try {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO identity_visions (user_id, vision, "values", principles, traits, vision_points) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (user_id) DO UPDATE SET vision=EXCLUDED.vision, "values"=EXCLUDED."values", principles=EXCLUDED.principles, traits=EXCLUDED.traits, vision_points=EXCLUDED.vision_points, updated_at=NOW()`,
        req.user.userId,
        vision,
        JSON.stringify(values),
        JSON.stringify(principles),
        JSON.stringify(traits),
        JSON.stringify(vision_points)
      );
      return res.json({ message: 'Saved' });
    } catch (e) {
      // Backward compatibility if traits column doesn't exist on Postgres
      if (String(e?.message || '').toLowerCase().includes('traits')) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO identity_visions (user_id, vision, "values", principles, vision_points) VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (user_id) DO UPDATE SET vision=EXCLUDED.vision, "values"=EXCLUDED."values", principles=EXCLUDED.principles, vision_points=EXCLUDED.vision_points, updated_at=NOW()`,
          req.user.userId,
          vision,
          JSON.stringify(values),
          JSON.stringify(principles),
          JSON.stringify(vision_points)
        );
        return res.json({ message: 'Saved' });
      }
      throw e;
    }
  } catch (e) {
    console.error('Identity POST (Postgres) error:', e);
    // Fallback to SQLite
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT INTO identity_visions (user_id, vision, "values", principles, traits, vision_points)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET vision=excluded.vision, "values"=excluded."values", principles=excluded.principles, traits=excluded.traits, vision_points=excluded.vision_points, updated_at=CURRENT_TIMESTAMP
      `).run(req.user.userId, vision, JSON.stringify(values), JSON.stringify(principles), JSON.stringify(traits), JSON.stringify(vision_points));
      res.json({ message: 'Saved' });
    } catch (sqliteErr) {
      console.error('Identity POST (SQLite) error:', sqliteErr);
      res.status(500).json({ error: 'Failed to save identity' });
    }
  }
});

// Generate identity vision from bullet points (does not save unless client then posts)
router.post('/generate-vision', authenticateToken, async (req, res) => {
  try {
    const { vision_points = [] } = req.body;
    const statement = await generateIdentityVision(vision_points);
    res.json({ vision: statement });
  } catch (e) {
    console.error('Generate identity vision error:', e);
    res.status(500).json({ error: 'Failed to generate vision statement' });
  }
});

module.exports = router;


