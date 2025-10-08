const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create table if missing (Postgres raw for speed without prisma migration)
let ensuredWellness = false;
async function ensureWellnessTable() {
  if (ensuredWellness) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS wellness_entries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        date DATE NOT NULL,
        supplements TEXT,
        medication TEXT,
        diet_quality INTEGER,
        exercise_minutes INTEGER,
        exercise_intensity INTEGER,
        sleep_quality INTEGER,
        sleep_score INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_wellness_user_date ON wellness_entries(user_id, date)
    `);
  } catch (e) {
    console.warn('Could not ensure wellness_entries table exists:', e?.message);
  }
  ensuredWellness = true;
}

// Legacy shape helper
function mapWellness(row) {
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    date: row.date,
    supplements: row.supplements ? JSON.parse(row.supplements) : [],
    medication: row.medication ? JSON.parse(row.medication) : [],
    diet_quality: row.diet_quality ?? null,
    exercise_minutes: row.exercise_minutes ?? 0,
    exercise_intensity: row.exercise_intensity ?? null,
    sleep_quality: row.sleep_quality ?? null,
    sleep_score: row.sleep_score ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// List entries (optionally date range)
router.get('/', authenticateToken, async (req, res) => {
  await ensureWellnessTable();
  const { start, end } = req.query;
  try {
    const rows = start && end
      ? await prisma.$queryRawUnsafe(
          `SELECT * FROM wellness_entries WHERE user_id=$1 AND date BETWEEN $2 AND $3 ORDER BY date DESC`,
          req.user.userId,
          start,
          end
        )
      : await prisma.$queryRawUnsafe(
          `SELECT * FROM wellness_entries WHERE user_id=$1 ORDER BY date DESC LIMIT 90`,
          req.user.userId
        );
    res.json({ wellness: rows.map(mapWellness) });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Create or upsert by date
router.post('/', authenticateToken, async (req, res) => {
  await ensureWellnessTable();
  const {
    date,
    supplements = [],
    medication = [],
    diet_quality,
    exercise_minutes = 0,
    exercise_intensity,
    sleep_quality,
    sleep_score
  } = req.body;
  if (!date) return res.status(400).json({ error: 'date is required' });
  try {
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM wellness_entries WHERE user_id=$1 AND date=$2`,
      req.user.userId,
      date
    );
    if (existing.length > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE wellness_entries SET supplements=$1, medication=$2, diet_quality=$3, exercise_minutes=$4, exercise_intensity=$5, sleep_quality=$6, sleep_score=$7, updated_at=NOW() WHERE id=$8`,
        JSON.stringify(supplements),
        JSON.stringify(medication),
        diet_quality ?? null,
        exercise_minutes ?? 0,
        exercise_intensity ?? null,
        sleep_quality ?? null,
        sleep_score ?? null,
        existing[0].id
      );
      return res.json({ message: 'Updated' });
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO wellness_entries (user_id, date, supplements, medication, diet_quality, exercise_minutes, exercise_intensity, sleep_quality, sleep_score) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      req.user.userId,
      date,
      JSON.stringify(supplements),
      JSON.stringify(medication),
      diet_quality ?? null,
      exercise_minutes ?? 0,
      exercise_intensity ?? null,
      sleep_quality ?? null,
      sleep_score ?? null
    );
    res.status(201).json({ message: 'Created' });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete by id
router.delete('/:id', authenticateToken, async (req, res) => {
  await ensureWellnessTable();
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM wellness_entries WHERE id=$1 AND user_id=$2`,
      Number(req.params.id),
      req.user.userId
    );
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Correlations with journal mood (-1..1) using Pearson on daily aggregates
router.get('/correlations', authenticateToken, async (req, res) => {
  await ensureWellnessTable();
  try {
    // Get recent 90 days wellness
    const wellness = await prisma.$queryRawUnsafe(
      `SELECT * FROM wellness_entries WHERE user_id=$1 ORDER BY date ASC LIMIT 180`,
      req.user.userId
    );
    // Get journal moods mapped to day
    const journals = await prisma.journalEntry.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'asc' }
    });

    // map mood to numeric scale
    const moodMap = { happy: 5, excited: 5, proud: 4, calm: 4, grateful: 4, tired: 2, confused: 2, anxious: 2, sad: 1, frustrated: 1 };
    const moodByDate = new Map();
    for (const j of journals) {
      if (!j.mood) continue;
      const d = new Date(j.createdAt);
      const key = d.toISOString().slice(0,10);
      const val = moodMap[j.mood] ?? 3;
      if (!moodByDate.has(key)) moodByDate.set(key, []);
      moodByDate.get(key).push(val);
    }
    const dailyMood = new Map();
    for (const [k, arr] of moodByDate.entries()) {
      dailyMood.set(k, arr.reduce((a,b)=>a+b,0)/arr.length);
    }

    // helper to compute Pearson r
    function pearson(x, y) {
      const n = Math.min(x.length, y.length);
      if (n < 3) return null;
      let sx=0, sy=0, sxx=0, syy=0, sxy=0;
      for (let i=0;i<n;i++) { sx+=x[i]; sy+=y[i]; sxx+=x[i]*x[i]; syy+=y[i]*y[i]; sxy+=x[i]*y[i]; }
      const cov = sxy - (sx*sy)/n;
      const vx = sxx - (sx*sx)/n;
      const vy = syy - (sy*sy)/n;
      if (vx<=0 || vy<=0) return null;
      return cov / Math.sqrt(vx*vy);
    }

    // align by date
    const paired = wellness
      .map(w => {
        const key = new Date(w.date).toISOString().slice(0,10);
        const mood = dailyMood.get(key);
        return { w, mood };
      })
      .filter(p => typeof p.mood === 'number');

    function series(mapper) {
      return paired.map(p => mapper(p.w));
    }
    const moodSeries = paired.map(p => p.mood);

    const correlations = {
      exercise_minutes: pearson(series(w=>Number(w.exercise_minutes||0)), moodSeries),
      exercise_intensity: pearson(series(w=>Number(w.exercise_intensity||0)), moodSeries),
      diet_quality: pearson(series(w=>Number(w.diet_quality||0)), moodSeries),
      sleep_quality: pearson(series(w=>Number(w.sleep_quality||0)), moodSeries),
      sleep_score: pearson(series(w=>Number(w.sleep_score||0)), moodSeries),
      supplements_count: pearson(series(w=> (w.supplements? JSON.parse(w.supplements).length : 0)), moodSeries),
      medication_count: pearson(series(w=> (w.medication? JSON.parse(w.medication).length : 0)), moodSeries)
    };

    res.json({ correlations });
  } catch (e) {
    console.error('Correlation error:', e);
    res.status(500).json({ error: 'Failed to compute correlations' });
  }
});

module.exports = router;
