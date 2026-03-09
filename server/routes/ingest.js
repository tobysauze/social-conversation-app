const express = require('express');
const { prisma } = require('../prisma/client');

const router = express.Router();

function validateIngestToken(req) {
  const header = req.headers['x-ingest-token'] || req.headers['authorization'];
  if (!header) return false;
  const token = header.toString().startsWith('Bearer ')
    ? header.toString().slice('Bearer '.length)
    : header.toString();
  return token && process.env.HEALTH_INGEST_TOKEN && token === process.env.HEALTH_INGEST_TOKEN;
}

router.post('/apple-health', async (req, res) => {
  if (!validateIngestToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = req.body || {};
  const {
    user_id: userId = null,
    event_type: eventType = 'daily_summary',
    event_date: eventDate = null,
    source = 'apple_health_shortcut'
  } = payload;

  try {
    await prisma.healthIntakeEvent.create({
      data: {
        userId: userId ? Number(userId) : null,
        source,
        eventType,
        eventDate,
        payloadJson: JSON.stringify(payload)
      }
    });

    try {
      const date = eventDate || new Date().toISOString().slice(0, 10);
      const exerciseMinutes = Number(payload.exercise_minutes ?? payload.active_minutes ?? 0) || 0;
      const exerciseIntensity = payload.exercise_intensity ? Number(payload.exercise_intensity) : null;
      const sleepScore = payload.sleep_score ? Number(payload.sleep_score) : (payload.sleepHours ? Math.round(Math.min(100, Number(payload.sleepHours) * 12)) : null);
      const sleepQuality = payload.sleep_quality ? Number(payload.sleep_quality) : (sleepScore ? Math.max(1, Math.min(5, Math.round(sleepScore / 20))) : null);

      if (userId && date) {
        const existing = await prisma.$queryRawUnsafe(
          `SELECT id FROM wellness_entries WHERE user_id=$1 AND date=$2`,
          Number(userId),
          date
        );
        if (existing.length > 0) {
          await prisma.$executeRawUnsafe(
            `UPDATE wellness_entries SET exercise_minutes=$1, exercise_intensity=$2, sleep_quality=$3, sleep_score=$4, updated_at=NOW() WHERE id=$5`,
            exerciseMinutes ?? 0,
            exerciseIntensity ?? null,
            sleepQuality ?? null,
            sleepScore ?? null,
            existing[0].id
          );
        } else {
          await prisma.$executeRawUnsafe(
            `INSERT INTO wellness_entries (user_id, date, exercise_minutes, exercise_intensity, sleep_quality, sleep_score) VALUES ($1,$2,$3,$4,$5,$6)`,
            Number(userId),
            date,
            exerciseMinutes ?? 0,
            exerciseIntensity ?? null,
            sleepQuality ?? null,
            sleepScore ?? null
          );
        }
      }
    } catch (wellnessErr) {
      console.warn('Wellness upsert from Apple Health failed:', wellnessErr?.message);
    }
    return res.status(201).json({ status: 'stored' });
  } catch (e) {
    console.error('Error storing health intake event:', e);
    return res.status(500).json({ error: 'Failed to store event' });
  }
});

module.exports = router;
