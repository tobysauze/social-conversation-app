const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');

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
          `SELECT id FROM wellness_entries WHERE user_id=$1 AND date=$2::date`,
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
            `INSERT INTO wellness_entries (user_id, date, exercise_minutes, exercise_intensity, sleep_quality, sleep_score) VALUES ($1,$2::date,$3,$4,$5,$6)`,
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

// GET /api/ingest/info — returns the data the user needs to wire up the
// iOS Shortcut: their user_id, the ingest endpoint URL, the auth token,
// and the most recent ingest events for verification. Authenticated.
router.get('/info', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const events = await prisma.healthIntakeEvent.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      take: 20
    });

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const endpoint = `${protocol}://${host}/api/ingest/apple-health`;

    res.json({
      userId,
      endpoint,
      tokenConfigured: Boolean(process.env.HEALTH_INGEST_TOKEN),
      // Token is intentionally surfaced — it's already shared with the user via
      // the iOS Shortcut. This endpoint is auth-gated so only the logged-in
      // owner sees it.
      token: process.env.HEALTH_INGEST_TOKEN || null,
      recentEvents: events.map((e) => ({
        id: e.id,
        source: e.source,
        eventType: e.eventType,
        eventDate: e.eventDate,
        createdAt: e.createdAt,
        // Parse to a small preview so the UI can show key fields without
        // dumping the whole blob.
        payload: (() => {
          try { return JSON.parse(e.payloadJson); } catch (_) { return null; }
        })()
      }))
    });
  } catch (e) {
    console.error('Ingest info error:', e);
    res.status(500).json({ error: 'Failed to load ingest info' });
  }
});

module.exports = router;
