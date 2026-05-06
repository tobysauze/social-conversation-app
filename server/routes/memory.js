const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const {
  ensureMemoryTable,
  embedAndStore,
  getStats,
  isAvailable
} = require('../services/embeddings');

const router = express.Router();

// Compose the text and metadata that get embedded for a given source row.
// Keep these strings concrete and short — embeddings work better on focused text
// than on big mixed dumps.
function buildJournalText(e) {
  const tagPart = e.tags ? ` (tags: ${safeTags(e.tags).join(', ')})` : '';
  return `Journal entry on ${e.createdAt.toISOString().slice(0, 10)}${e.mood ? `, feeling ${e.mood}` : ''}${tagPart}:\n${e.content}`;
}
function buildDreamText(e) {
  return `Dream on ${e.createdAt.toISOString().slice(0, 10)}${e.title ? ` — ${e.title}` : ''}:\n${e.content}`;
}
function buildTriggerText(t) {
  const intensity = t.intensity != null ? ` (intensity ${t.intensity}/10)` : '';
  const cat = t.category ? ` [${t.category}]` : '';
  return `Anxiety trigger${cat}${intensity}: ${t.title}${t.notes ? `\n${t.notes}` : ''}`;
}
function buildBeliefText(b) {
  const plan = b.changePlan ? `\nChange plan: ${b.changePlan}` : '';
  return `Belief work — current: "${b.currentBelief}"\nDesired: "${b.desiredBelief}"${plan}`;
}
function buildProtocolText(p) {
  const when = p.whenToUse ? `\nWhen to use: ${p.whenToUse}` : '';
  const steps = p.steps ? `\nSteps: ${p.steps}` : '';
  return `Protocol: ${p.title}${when}${steps}`;
}
function buildGoalText(g) {
  return `Goal${g.area ? ` (${g.area})` : ''}: ${g.title}${g.description ? `\n${g.description}` : ''}`;
}
function buildPersonText(p) {
  const parts = [`Person: ${p.name}${p.relationship ? ` (${p.relationship})` : ''}`];
  if (p.howMet) parts.push(`How met: ${p.howMet}`);
  if (p.interests) parts.push(`Interests: ${p.interests}`);
  if (p.personalityTraits) parts.push(`Personality: ${p.personalityTraits}`);
  if (p.conversationStyle) parts.push(`Conversation style: ${p.conversationStyle}`);
  if (p.sharedExperiences) parts.push(`Shared: ${p.sharedExperiences}`);
  if (p.notes) parts.push(`Notes: ${p.notes}`);
  return parts.join('\n');
}
function buildIdentityText(v) {
  const parts = ['Identity / vision'];
  if (v.vision) parts.push(`Vision: ${v.vision}`);
  for (const f of ['values', 'principles', 'traits', 'visionPoints']) {
    const arr = safeJsonArr(v[f]);
    if (arr.length) parts.push(`${f}: ${arr.join('; ')}`);
  }
  return parts.join('\n');
}
function buildStoryText(s) {
  return `Story: ${s.title}\n${s.content}`;
}

function safeTags(tagStr) {
  if (!tagStr) return [];
  try {
    const arr = JSON.parse(tagStr);
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}
function safeJsonArr(s) {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch (_) {
    return [];
  }
}

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
// Idempotent (uses upsert on user_id+source_type+source_id), but slow:
// rate-limited by the embeddings API. Personal-scale data so we run inline.
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

  async function processBatch(rows, sourceType, getText, getMeta) {
    counts[sourceType] = 0;
    for (const r of rows) {
      try {
        const text = getText(r);
        if (!text || !text.trim()) continue;
        await embedAndStore({
          userId,
          sourceType,
          sourceId: r.id,
          content: text,
          metadata: getMeta ? getMeta(r) : null
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

    await processBatch(journals, 'journal', buildJournalText, (e) => ({
      date: e.createdAt.toISOString().slice(0, 10),
      mood: e.mood || null
    }));
    await processBatch(dreams, 'dream', buildDreamText, (e) => ({
      date: e.createdAt.toISOString().slice(0, 10),
      title: e.title || null
    }));
    await processBatch(triggers, 'trigger', buildTriggerText, (t) => ({
      title: t.title,
      category: t.category || null
    }));
    await processBatch(beliefs, 'belief', buildBeliefText, (b) => ({
      current: b.currentBelief,
      desired: b.desiredBelief
    }));
    await processBatch(protocols, 'protocol', buildProtocolText, (p) => ({ title: p.title }));
    await processBatch(goals, 'goal', buildGoalText, (g) => ({
      title: g.title,
      status: g.status,
      area: g.area || null
    }));
    await processBatch(people, 'person', buildPersonText, (p) => ({
      name: p.name,
      relationship: p.relationship || null
    }));
    await processBatch(stories, 'story', buildStoryText, (s) => ({ title: s.title }));

    if (identity) {
      try {
        const text = buildIdentityText(identity);
        if (text && text.trim()) {
          await embedAndStore({
            userId,
            sourceType: 'identity',
            sourceId: identity.id,
            content: text,
            metadata: null
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
