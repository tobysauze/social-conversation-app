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

const emptyRequirements = {
  partner_vision: '',
  must_haves: [],
  nice_to_haves: [],
  red_flags: [],
  interests: []
};

function parseRequirements(value) {
  if (!value) return emptyRequirements;
  if (typeof value === 'object' && value !== null) return value;
  if (typeof value !== 'string') return emptyRequirements;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return {
        partner_vision: parsed.partner_vision || '',
        must_haves: parseStoredArray(parsed.must_haves),
        nice_to_haves: parseStoredArray(parsed.nice_to_haves),
        red_flags: parseStoredArray(parsed.red_flags),
        interests: parseStoredArray(parsed.interests)
      };
    }
  } catch (_) {}
  return emptyRequirements;
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
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS interests TEXT`
      );
    } catch (_) {}
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS short_term_requirements TEXT`
      );
    } catch (_) {}
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS long_term_requirements TEXT`
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
    try {
      db.exec(`ALTER TABLE dating_profiles ADD COLUMN interests TEXT`);
    } catch (_) {}
    try {
      db.exec(`ALTER TABLE dating_profiles ADD COLUMN short_term_requirements TEXT`);
    } catch (_) {}
    try {
      db.exec(`ALTER TABLE dating_profiles ADD COLUMN long_term_requirements TEXT`);
    } catch (_) {}
  } catch (e) {
    console.warn('Ensure dating_profiles (SQLite) failed:', e?.message);
  }

  ensured = true;
}

function buildProfileResponse(row) {
  const selfReflection =
    typeof row.self_reflection_answers === 'string'
      ? (() => {
          try {
            return JSON.parse(row.self_reflection_answers || '{}');
          } catch (_) {
            return {};
          }
        })()
      : row.self_reflection_answers || {};

  const shortTerm = parseRequirements(row.short_term_requirements);
  const longTerm = parseRequirements(row.long_term_requirements);

  // Migrate old flat format into long_term if new columns are empty
  const hasNewFormat = row.short_term_requirements || row.long_term_requirements;
  if (!hasNewFormat && (row.must_haves || row.partner_vision)) {
    return {
      short_term: emptyRequirements,
      long_term: {
        partner_vision: (row.partner_vision || '').toString(),
        must_haves: parseStoredArray(row.must_haves),
        nice_to_haves: parseStoredArray(row.nice_to_haves),
        red_flags: parseStoredArray(row.red_flags),
        interests: parseStoredArray(row.interests)
      },
      self_reflection_answers: selfReflection
    };
  }

  return {
    short_term: shortTerm,
    long_term: longTerm,
    self_reflection_answers: selfReflection
  };
}

const emptyProfileResponse = {
  short_term: emptyRequirements,
  long_term: emptyRequirements,
  self_reflection_answers: {}
};

router.get('/', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM dating_profiles WHERE user_id=$1 LIMIT 1`,
      req.user.userId
    );
    const row = rows?.[0];
    if (!row) {
      return res.json({ profile: emptyProfileResponse });
    }
    return res.json({ profile: buildProfileResponse(row) });
  } catch (e) {
    try {
      const db = getDatabase();
      const row = db
        .prepare('SELECT * FROM dating_profiles WHERE user_id = ? LIMIT 1')
        .get(req.user.userId);
      if (!row) {
        return res.json({ profile: emptyProfileResponse });
      }
      return res.json({ profile: buildProfileResponse(row) });
    } catch (sqliteErr) {
      console.error('Dating GET error:', sqliteErr);
      return res.status(500).json({ error: 'Database error' });
    }
  }
});

function toRequirements(obj) {
  if (!obj || typeof obj !== 'object') return emptyRequirements;
  return {
    partner_vision: (obj.partner_vision || '').toString().trim(),
    must_haves: toJsonArray(obj.must_haves),
    nice_to_haves: toJsonArray(obj.nice_to_haves),
    red_flags: toJsonArray(obj.red_flags),
    interests: toJsonArray(obj.interests)
  };
}

router.post('/', authenticateToken, async (req, res) => {
  await ensureTables();
  const payload = req.body || {};

  const shortTerm = toRequirements(payload.short_term);
  const longTerm = toRequirements(payload.long_term);
  const selfReflectionAnswers =
    payload.self_reflection_answers && typeof payload.self_reflection_answers === 'object'
      ? payload.self_reflection_answers
      : {};

  const shortTermJson = JSON.stringify(shortTerm);
  const longTermJson = JSON.stringify(longTerm);
  const selfReflectionJson = JSON.stringify(selfReflectionAnswers);

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO dating_profiles (user_id, short_term_requirements, long_term_requirements, self_reflection_answers)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE
       SET short_term_requirements = EXCLUDED.short_term_requirements,
           long_term_requirements = EXCLUDED.long_term_requirements,
           self_reflection_answers = EXCLUDED.self_reflection_answers,
           updated_at = NOW()`,
      req.user.userId,
      shortTermJson,
      longTermJson,
      selfReflectionJson
    );
    return res.json({ message: 'Saved' });
  } catch (e) {
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT INTO dating_profiles (user_id, short_term_requirements, long_term_requirements, self_reflection_answers)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          short_term_requirements=excluded.short_term_requirements,
          long_term_requirements=excluded.long_term_requirements,
          self_reflection_answers=excluded.self_reflection_answers,
          updated_at=CURRENT_TIMESTAMP
      `).run(req.user.userId, shortTermJson, longTermJson, selfReflectionJson);
      return res.json({ message: 'Saved' });
    } catch (sqliteErr) {
      console.error('Dating POST error:', sqliteErr);
      return res.status(500).json({ error: 'Failed to save dating profile' });
    }
  }
});

module.exports = router;
