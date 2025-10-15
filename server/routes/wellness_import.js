const express = require('express');
const { prisma } = require('../prisma/client');

const router = express.Router();

// Ensure main table exists (share schema with wellness.js)
let ensured = false;
async function ensureWellnessTable() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS wellness_entries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        date DATE NOT NULL,
        supplements TEXT,
        medication TEXT,
        diet_items TEXT,
        diet_quality INTEGER,
        exercise_minutes INTEGER,
        exercise_intensity INTEGER,
        sleep_quality INTEGER,
        sleep_score INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_wellness_user_date ON wellness_entries(user_id, date)`);
  } catch (e) {
    console.warn('Could not ensure wellness_entries table exists:', e?.message);
  }
  ensured = true;
}

function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i+1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else { cur += ch; }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = parseCSVLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(l => {
    const cells = parseCSVLine(l);
    const o = {};
    header.forEach((h, idx) => { o[h] = cells[idx]; });
    return o;
  });
}

function coerceInt(v, def = 0) {
  const n = Number(String(v || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : def;
}

async function upsertEntry(userId, d, data) {
  const existing = await prisma.$queryRawUnsafe(`SELECT id FROM wellness_entries WHERE user_id=$1 AND date=$2`, userId, d);
  if (existing.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE wellness_entries SET exercise_minutes=$1, exercise_intensity=$2, sleep_quality=$3, sleep_score=$4, updated_at=NOW() WHERE id=$5`,
      data.exercise_minutes ?? 0,
      data.exercise_intensity ?? null,
      data.sleep_quality ?? null,
      data.sleep_score ?? null,
      existing[0].id
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO wellness_entries (user_id, date, exercise_minutes, exercise_intensity, sleep_quality, sleep_score) VALUES ($1,$2,$3,$4,$5,$6)`,
      userId,
      d,
      data.exercise_minutes ?? 0,
      data.exercise_intensity ?? null,
      data.sleep_quality ?? null,
      data.sleep_score ?? null
    );
  }
}

function mapGarminRow(row) {
  const date = row['Date'] || row['Calendar Date'] || row['calendarDate'] || row['Activity Date'];
  const steps = coerceInt(row['Steps'] || row['Total Steps'] || row['TotalSteps']);
  const intensity = coerceInt(row['Intensity Minutes'] || row['Active Minutes'] || row['Moderate Intensity Minutes']);
  const sleepScore = coerceInt(row['Sleep Score'] || row['Average Sleep Score'] || row['sleepScore'], null);
  const sleepQuality = sleepScore ? Math.max(1, Math.min(5, Math.round(sleepScore / 20))) : null;
  const exerciseMinutes = intensity || coerceInt(row['Active Time'] || row['Active time (min)']);
  return { date, exercise_minutes: exerciseMinutes, sleep_score: sleepScore, sleep_quality: sleepQuality };
}

async function importGarminCSV(userId, csvText) {
  await ensureWellnessTable();
  const rows = parseCSV(csvText);
  let count = 0;
  for (const r of rows) {
    const m = mapGarminRow(r);
    if (!m.date) continue;
    try {
      await upsertEntry(userId, m.date, m);
      count++;
    } catch (e) {
      console.warn('Import row failed:', e?.message);
    }
  }
  return count;
}

// Manual import: send { csv } OR { url }
router.post('/garmin', async (req, res) => {
  const auth = req.headers['x-import-token'] || req.headers['authorization'];
  const token = auth && auth.toString().startsWith('Bearer ') ? auth.toString().slice(7) : auth;
  if (!process.env.IMPORT_TOKEN || token !== process.env.IMPORT_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { csv, url, user_id } = req.body || {};
  try {
    let text = csv;
    if (!text && url) {
      const resp = await fetch(url);
      text = await resp.text();
    }
    if (!text) return res.status(400).json({ error: 'csv or url required' });
    const count = await importGarminCSV(Number(user_id) || 1, text);
    res.json({ imported: count });
  } catch (e) {
    console.error('Garmin import error:', e);
    res.status(500).json({ error: 'Import failed' });
  }
});

// Automatic import using env GARMIN_CSV_URL, secured by IMPORT_TOKEN
router.post('/garmin/auto', async (req, res) => {
  const auth = req.headers['x-import-token'] || req.headers['authorization'];
  const token = auth && auth.toString().startsWith('Bearer ') ? auth.toString().slice(7) : auth;
  if (!process.env.IMPORT_TOKEN || token !== process.env.IMPORT_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const url = process.env.GARMIN_CSV_URL;
  if (!url) return res.status(400).json({ error: 'GARMIN_CSV_URL not set' });
  try {
    const resp = await fetch(url);
    const text = await resp.text();
    const imported = await importGarminCSV(Number(process.env.DEFAULT_USER_ID) || 1, text);
    res.json({ imported });
  } catch (e) {
    console.error('Auto import failed:', e);
    res.status(500).json({ error: 'Auto import failed' });
  }
});

module.exports = router;


