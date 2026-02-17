const express = require('express');
const { prisma } = require('../prisma/client');
const { getDatabase } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

let ensured = false;

function toJsonArray(input) {
  if (Array.isArray(input)) return input.map((v) => String(v).trim()).filter(Boolean);
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];
    return trimmed
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function parseStoredArray(value) {
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

async function ensureTables() {
  if (ensured) return;

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS dating_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE,
        partner_vision TEXT,
        must_haves TEXT,
        nice_to_haves TEXT,
        red_flags TEXT,
        self_reflection_answers TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    try {
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS dating_profiles_user_id_idx ON dating_profiles(user_id)`
      );
    } catch (_) {}
  } catch (e) {
    console.warn('Ensure dating_profiles (Postgres) failed:', e?.message);
  }

  try {
    const db = getDatabase();
    db.exec(`
      CREATE TABLE IF NOT EXISTS dating_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        partner_vision TEXT,
        must_haves TEXT,
        nice_to_haves TEXT,
        red_flags TEXT,
        self_reflection_answers TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS dating_profiles_user_id_idx ON dating_profiles(user_id)`);
  } catch (e) {
    console.warn('Ensure dating_profiles (SQLite) failed:', e?.message);
  }

  ensured = true;
}

router.get('/', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM dating_profiles WHERE user_id=$1 LIMIT 1`,
      req.user.userId
    );
    const row = rows?.[0];
    if (!row) {
      return res.json({
        profile: {
          partner_vision: '',
          must_haves: [],
          nice_to_haves: [],
          red_flags: [],
          self_reflection_answers: {}
        }
      });
    }

    return res.json({
      profile: {
        partner_vision: row.partner_vision || '',
        must_haves: parseStoredArray(row.must_haves),
        nice_to_haves: parseStoredArray(row.nice_to_haves),
        red_flags: parseStoredArray(row.red_flags),
        self_reflection_answers:
          typeof row.self_reflection_answers === 'string'
            ? JSON.parse(row.self_reflection_answers || '{}')
            : (row.self_reflection_answers || {})
      }
    });
  } catch (e) {
    try {
      const db = getDatabase();
      const row = db
        .prepare('SELECT * FROM dating_profiles WHERE user_id = ? LIMIT 1')
        .get(req.user.userId);
      if (!row) {
        return res.json({
          profile: {
            partner_vision: '',
            must_haves: [],
            nice_to_haves: [],
            red_flags: [],
            self_reflection_answers: {}
          }
        });
      }
      return res.json({
        profile: {
          partner_vision: row.partner_vision || '',
          must_haves: parseStoredArray(row.must_haves),
          nice_to_haves: parseStoredArray(row.nice_to_haves),
          red_flags: parseStoredArray(row.red_flags),
          self_reflection_answers: row.self_reflection_answers
            ? JSON.parse(row.self_reflection_answers)
            : {}
        }
      });
    } catch (sqliteErr) {
      console.error('Dating GET error:', sqliteErr);
      return res.status(500).json({ error: 'Database error' });
    }
  }
});

router.post('/', authenticateToken, async (req, res) => {
  await ensureTables();
  const payload = req.body || {};

  const partnerVision = (payload.partner_vision || '').toString().trim();
  const mustHaves = toJsonArray(payload.must_haves);
  const niceToHaves = toJsonArray(payload.nice_to_haves);
  const redFlags = toJsonArray(payload.red_flags);
  const selfReflectionAnswers =
    payload.self_reflection_answers && typeof payload.self_reflection_answers === 'object'
      ? payload.self_reflection_answers
      : {};

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO dating_profiles (user_id, partner_vision, must_haves, nice_to_haves, red_flags, self_reflection_answers)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id) DO UPDATE
       SET partner_vision = EXCLUDED.partner_vision,
           must_haves = EXCLUDED.must_haves,
           nice_to_haves = EXCLUDED.nice_to_haves,
           red_flags = EXCLUDED.red_flags,
           self_reflection_answers = EXCLUDED.self_reflection_answers,
           updated_at = NOW()`,
      req.user.userId,
      partnerVision,
      JSON.stringify(mustHaves),
      JSON.stringify(niceToHaves),
      JSON.stringify(redFlags),
      JSON.stringify(selfReflectionAnswers)
    );
    return res.json({ message: 'Saved' });
  } catch (e) {
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT INTO dating_profiles (user_id, partner_vision, must_haves, nice_to_haves, red_flags, self_reflection_answers)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          partner_vision=excluded.partner_vision,
          must_haves=excluded.must_haves,
          nice_to_haves=excluded.nice_to_haves,
          red_flags=excluded.red_flags,
          self_reflection_answers=excluded.self_reflection_answers,
          updated_at=CURRENT_TIMESTAMP
      `).run(
        req.user.userId,
        partnerVision,
        JSON.stringify(mustHaves),
        JSON.stringify(niceToHaves),
        JSON.stringify(redFlags),
        JSON.stringify(selfReflectionAnswers)
      );
      return res.json({ message: 'Saved' });
    } catch (sqliteErr) {
      console.error('Dating POST error:', sqliteErr);
      return res.status(500).json({ error: 'Failed to save dating profile' });
    }
  }
});

module.exports = router;
