const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const {
  generateNameRiffs,
  generateBandNames,
  generateTwoTruthsAndALie
} = require('../services/openai');

const router = express.Router();

// Persistent saves for funny generations the user wants to keep. Stored
// generically — `content` is the canonical text and `metadata` carries
// game-specific extras (genre tag, explanation, two-truths statements).
let ensuredSavedGames = false;
async function ensureSavedGamesTable() {
  if (ensuredSavedGames) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS saved_game_outputs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        game_type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_saved_games_user_game
        ON saved_game_outputs(user_id, game_type, created_at DESC)
    `);
  } catch (e) {
    console.warn('Could not ensure saved_game_outputs table:', e?.message);
  }
  ensuredSavedGames = true;
}

function buildPersonContext(p) {
  if (!p) return '';
  const parts = [];
  if (p.relationship) parts.push(`relationship: ${p.relationship}`);
  if (p.personalityTraits) parts.push(`personality: ${p.personalityTraits}`);
  if (p.interests) parts.push(`interests: ${p.interests}`);
  if (p.notes) parts.push(`notes: ${p.notes}`);
  return parts.join('; ').slice(0, 500);
}

router.post('/generate', authenticateToken, async (req, res) => {
  const {
    game,
    input = '',
    personId = null,
    previous = [], // array of strings already shown — the model should avoid these
    direction = '' // user's refinement instruction, e.g. "more 90s hip-hop"
  } = req.body || {};
  if (!game) return res.status(400).json({ error: 'game is required' });

  const refineOpts = {
    previous: Array.isArray(previous) ? previous.filter(Boolean).slice(0, 30) : [],
    direction: (direction || '').toString().trim().slice(0, 500)
  };

  let person = null;
  if (personId) {
    try {
      person = await prisma.person.findFirst({
        where: { id: Number(personId), userId: req.user.userId }
      });
    } catch (_) {}
  }

  try {
    if (game === 'name_riff') {
      const name = (person?.name || input || '').toString().trim();
      if (!name) return res.status(400).json({ error: 'A name is required' });
      const riffs = await generateNameRiffs(name, buildPersonContext(person), refineOpts);
      return res.json({ game, name, riffs });
    }

    if (game === 'band_name') {
      const theme = (input || '').toString().trim();
      const names = await generateBandNames(theme, refineOpts);
      return res.json({ game, theme, names });
    }

    if (game === 'two_truths') {
      const subject = (person?.name || input || '').toString().trim();
      if (!subject) return res.status(400).json({ error: 'A subject is required' });
      const result = await generateTwoTruthsAndALie(subject, buildPersonContext(person), refineOpts);
      return res.json({ game, subject, ...result });
    }

    return res.status(400).json({ error: `Unknown game: ${game}` });
  } catch (e) {
    console.error('Games generate error:', e);
    return res.status(500).json({ error: e.message || 'Failed to generate' });
  }
});

// --- Saved generations -----------------------------------------------------

// GET /api/games/saved?game=name_riff (or omit ?game= for all)
router.get('/saved', authenticateToken, async (req, res) => {
  await ensureSavedGamesTable();
  const game = (req.query.game || '').toString().trim();
  try {
    const rows = game
      ? await prisma.$queryRawUnsafe(
          `SELECT id, game_type, content, metadata, created_at FROM saved_game_outputs
            WHERE user_id=$1 AND game_type=$2 ORDER BY created_at DESC LIMIT 100`,
          req.user.userId,
          game
        )
      : await prisma.$queryRawUnsafe(
          `SELECT id, game_type, content, metadata, created_at FROM saved_game_outputs
            WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
          req.user.userId
        );
    res.json({
      saved: (rows || []).map((r) => ({
        id: Number(r.id),
        gameType: r.game_type,
        content: r.content,
        metadata: r.metadata || null,
        createdAt: r.created_at
      }))
    });
  } catch (e) {
    console.error('List saved games error:', e);
    res.status(500).json({ error: 'Failed to list saved' });
  }
});

router.post('/saved', authenticateToken, async (req, res) => {
  await ensureSavedGamesTable();
  const game = (req.body?.game || '').toString().trim();
  const content = (req.body?.content || '').toString().trim();
  const metadata = req.body?.metadata || null;
  if (!game || !content) return res.status(400).json({ error: 'game and content required' });
  try {
    const rows = await prisma.$queryRawUnsafe(
      `INSERT INTO saved_game_outputs (user_id, game_type, content, metadata)
         VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, created_at`,
      req.user.userId,
      game,
      content,
      metadata ? JSON.stringify(metadata) : null
    );
    res.status(201).json({
      id: Number(rows[0].id),
      gameType: game,
      content,
      metadata,
      createdAt: rows[0].created_at
    });
  } catch (e) {
    console.error('Save game output error:', e);
    res.status(500).json({ error: 'Failed to save' });
  }
});

router.delete('/saved/:id', authenticateToken, async (req, res) => {
  await ensureSavedGamesTable();
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM saved_game_outputs WHERE user_id=$1 AND id=$2`,
      req.user.userId,
      id
    );
    res.json({ deleted: id });
  } catch (e) {
    console.error('Delete saved game error:', e);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = router;
