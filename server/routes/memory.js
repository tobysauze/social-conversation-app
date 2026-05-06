const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const {
  ensureMemoryTable,
  embedAndStore,
  getStats,
  isAvailable
} = require('../services/embeddings');
const { buildFor } = require('../services/memory_sync');

const router = express.Router();

// GET /api/memory/stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await getStats(req.user.userId);
    res.json(stats);
  } catch (e) {
    console.error('Memory stats error:', e);
    res.status(500).json({ error: 'Failed to load memory stats' });
  }
});

// POST /api/memory/reindex
// Walks every source table for the current user and embeds all rows.
// Idempotent (uses upsert on user_id+source_type+source_id).
router.post('/reindex', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const setup = await ensureMemoryTable();
  if (!setup.extensionAvailable) {
    return res.status(503).json({
      error:
        'pgvector extension is not available on this database. Enable it (CREATE EXTENSION vector) and retry.'
    });
  }
  if (!isAvailable()) {
    return res.status(503).json({
      error: 'OPENAI_API_KEY is not configured on the server.'
    });
  }

  const counts = {};
  const errors = [];

  async function processBatch(rows, sourceType) {
    counts[sourceType] = 0;
    for (const r of rows) {
      try {
        const built = buildFor(sourceType, r);
        if (!built || !built.text || !built.text.trim()) continue;
        await embedAndStore({
          userId,
          sourceType,
          sourceId: r.id,
          content: built.text,
          metadata: built.metadata || null
        });
        counts[sourceType]++;
      } catch (e) {
        errors.push({ sourceType, sourceId: r.id, error: e.message });
        if (errors.length > 50) break; // bail early on cascading failures
      }
    }
  }

  try {
    const [journals, dreams, triggers, beliefs, protocols, goals, people, stories, identity] = await Promise.all([
      prisma.journalEntry.findMany({ where: { userId } }),
      prisma.dreamEntry.findMany({ where: { userId } }),
      prisma.anxietyTrigger.findMany({ where: { userId } }),
      prisma.belief.findMany({ where: { userId } }),
      prisma.protocol.findMany({ where: { userId } }),
      prisma.goal.findMany({ where: { userId } }),
      prisma.person.findMany({ where: { userId } }),
      prisma.story.findMany({ where: { userId } }),
      prisma.identityVision.findUnique({ where: { userId } }).catch(() => null)
    ]);

    await processBatch(journals, 'journal');
    await processBatch(dreams, 'dream');
    await processBatch(triggers, 'trigger');
    await processBatch(beliefs, 'belief');
    await processBatch(protocols, 'protocol');
    await processBatch(goals, 'goal');
    await processBatch(people, 'person');
    await processBatch(stories, 'story');

    if (identity) {
      try {
        // identity is keyed by id (its own PK), not userId, but we persist with sourceId=identity.id
        const built = buildFor('identity', identity);
        if (built && built.text && built.text.trim()) {
          await embedAndStore({
            userId,
            sourceType: 'identity',
            sourceId: identity.id,
            content: built.text,
            metadata: built.metadata || null
          });
          counts.identity = 1;
        }
      } catch (e) {
        errors.push({ sourceType: 'identity', sourceId: identity.id, error: e.message });
      }
    }

    const stats = await getStats(userId);
    res.json({ counts, errors, stats });
  } catch (e) {
    console.error('Memory reindex error:', e);
    res.status(500).json({ error: e.message || 'Reindex failed', counts, errors });
  }
});

module.exports = router;
