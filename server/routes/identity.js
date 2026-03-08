const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { generateIdentityVision } = require('../services/openai');

const router = express.Router();

function parseJsonArraySafe(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const identity = await prisma.identityVision.findUnique({
      where: { userId: req.user.userId }
    });
    if (!identity) {
      return res.json({ identity: { vision: '', values: [], principles: [], traits: [], vision_points: [] } });
    }
    res.json({
      identity: {
        vision: identity.vision || '',
        values: parseJsonArraySafe(identity.values),
        principles: parseJsonArraySafe(identity.principles),
        traits: parseJsonArraySafe(identity.traits),
        vision_points: parseJsonArraySafe(identity.visionPoints)
      }
    });
  } catch (e) {
    console.error('Identity GET error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const { vision = '', values = [], principles = [], traits = [], vision_points = [] } = req.body;
  try {
    await prisma.identityVision.upsert({
      where: { userId: req.user.userId },
      create: {
        userId: req.user.userId,
        vision,
        values: JSON.stringify(values),
        principles: JSON.stringify(principles),
        traits: JSON.stringify(traits),
        visionPoints: JSON.stringify(vision_points)
      },
      update: {
        vision,
        values: JSON.stringify(values),
        principles: JSON.stringify(principles),
        traits: JSON.stringify(traits),
        visionPoints: JSON.stringify(vision_points)
      }
    });
    return res.json({ message: 'Saved' });
  } catch (e) {
    console.error('Identity POST error:', e);
    return res.status(500).json({ error: 'Failed to save identity' });
  }
});

router.post('/generate-vision', authenticateToken, async (req, res) => {
  try {
    const { vision_points = [] } = req.body;
    const statement = await generateIdentityVision(vision_points);
    res.json({ vision: statement });
  } catch (e) {
    console.error('Generate identity vision error:', e);
    res.status(500).json({ error: 'Failed to generate vision statement' });
  }
});

module.exports = router;
