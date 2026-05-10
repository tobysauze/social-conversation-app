const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const {
  generateNameRiffs,
  generateBandNames,
  generateTwoTruthsAndALie
} = require('../services/openai');

const router = express.Router();

// Build a short context string from a Person row to feed the LLM. Optional —
// only used when the user picks a person from their People list.
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
  const { game, input = '', personId = null } = req.body || {};
  if (!game) return res.status(400).json({ error: 'game is required' });

  // Optionally fetch the person for context — name riffs and two-truths
  // benefit from light context, band names don't.
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
      const riffs = await generateNameRiffs(name, buildPersonContext(person));
      return res.json({ game, name, riffs });
    }

    if (game === 'band_name') {
      const theme = (input || '').toString().trim();
      const names = await generateBandNames(theme);
      return res.json({ game, theme, names });
    }

    if (game === 'two_truths') {
      const subject = (person?.name || input || '').toString().trim();
      if (!subject) return res.status(400).json({ error: 'A subject is required' });
      const result = await generateTwoTruthsAndALie(subject, buildPersonContext(person));
      return res.json({ game, subject, ...result });
    }

    return res.status(400).json({ error: `Unknown game: ${game}` });
  } catch (e) {
    console.error('Games generate error:', e);
    return res.status(500).json({ error: e.message || 'Failed to generate' });
  }
});

module.exports = router;
