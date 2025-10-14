const express = require('express');
const { getDatabase } = require('../database/init');

const router = express.Router();

// Lightweight token auth specific to ingestion webhooks (bypasses JWT)
function validateIngestToken(req) {
  const header = req.headers['x-ingest-token'] || req.headers['authorization'];
  if (!header) return false;
  // Support either raw token in X-Ingest-Token or Bearer TOKEN in Authorization
  const token = header.toString().startsWith('Bearer ')
    ? header.toString().slice('Bearer '.length)
    : header.toString();
  return token && process.env.HEALTH_INGEST_TOKEN && token === process.env.HEALTH_INGEST_TOKEN;
}

router.post('/apple-health', async (req, res) => {
  if (!validateIngestToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getDatabase();
  const payload = req.body || {};
  const {
    user_id: userId = null,
    event_type: eventType = 'daily_summary',
    event_date: eventDate = null,
    source = 'apple_health_shortcut'
  } = payload;

  try {
    const stmt = db.prepare(
      `INSERT INTO health_intake_events (user_id, source, event_type, event_date, payload_json)
       VALUES (?, ?, ?, ?, ?)`
    );
    stmt.run(
      userId,
      source,
      eventType,
      eventDate,
      JSON.stringify(payload)
    );
    return res.status(201).json({ status: 'stored' });
  } catch (e) {
    console.error('Error storing health intake event:', e);
    return res.status(500).json({ error: 'Failed to store event' });
  }
});

module.exports = router;


