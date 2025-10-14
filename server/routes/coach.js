const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { analyzeJournalForCBTIssues } = require('../services/openai');

const router = express.Router();

// Ensure table exists (Postgres raw)
let ensured = false;
async function ensureTables() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS coach_issues (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        journal_id INTEGER,
        theme TEXT,
        distortions TEXT, -- JSON array
        severity INTEGER,
        confidence REAL,
        span_text TEXT,
        span_start INTEGER,
        span_end INTEGER,
        goal TEXT,
        techniques TEXT, -- JSON array
        tags TEXT, -- JSON array
        status TEXT DEFAULT 'open',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_coach_user_status ON coach_issues(user_id, status)
    `);
  } catch (e) {
    console.warn('Could not ensure coach_issues table exists:', e?.message);
  }
  ensured = true;
}

// Scan a journal entry (expects journal content in body if not stored in postgres)
router.post('/scan/:journalId', authenticateToken, async (req, res) => {
  await ensureTables();
  const { journalId } = req.params;
  const { content } = req.body; // content required for now
  if (!content) return res.status(400).json({ error: 'journal content is required' });

  try {
    const analysis = await analyzeJournalForCBTIssues(content);
    const issues = analysis.issues || [];
    for (const issue of issues) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO coach_issues
         (user_id, journal_id, theme, distortions, severity, confidence, span_text, span_start, span_end, goal, techniques, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        req.user.userId,
        Number(journalId) || null,
        issue.theme || null,
        JSON.stringify(issue.cognitive_distortions || []),
        issue.severity ?? null,
        issue.confidence ?? null,
        issue.span_text || null,
        issue.span_start ?? null,
        issue.span_end ?? null,
        issue.goal || null,
        JSON.stringify(issue.suggested_techniques || []),
        JSON.stringify(issue.tags || [])
      );
    }
    res.json({ inserted: issues.length });
  } catch (e) {
    console.error('Coach scan error:', e);
    res.status(500).json({ error: 'Failed to analyze journal' });
  }
});

// List issues
router.get('/issues', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM coach_issues WHERE user_id=$1 ORDER BY created_at DESC`,
      req.user.userId
    );
    const issues = rows.map(r => ({
      id: r.id,
      journal_id: r.journal_id,
      theme: r.theme,
      cognitive_distortions: r.distortions ? JSON.parse(r.distortions) : [],
      severity: r.severity,
      confidence: r.confidence,
      span_text: r.span_text,
      span_start: r.span_start,
      span_end: r.span_end,
      goal: r.goal,
      suggested_techniques: r.techniques ? JSON.parse(r.techniques) : [],
      tags: r.tags ? JSON.parse(r.tags) : [],
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));
    res.json({ issues });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Update status/severity
router.patch('/issues/:id', authenticateToken, async (req, res) => {
  await ensureTables();
  const { id } = req.params;
  const { status, severity } = req.body;
  try {
    const updates = [];
    const params = [];
    if (status) { updates.push(`status=$${updates.length+1}`); params.push(status); }
    if (severity !== undefined) { updates.push(`severity=$${updates.length+1}`); params.push(Number(severity)); }
    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
    params.push(req.user.userId, Number(id));
    await prisma.$executeRawUnsafe(
      `UPDATE coach_issues SET ${updates.join(', ')}, updated_at=NOW() WHERE user_id=$${updates.length+1} AND id=$${updates.length+2}`,
      ...params
    );
    res.json({ message: 'Updated' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update issue' });
  }
});

module.exports = router;


