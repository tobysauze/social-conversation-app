const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function parseSteps(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim()).filter(Boolean);
  } catch (_) {}
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const protocols = await prisma.protocol.findMany({
      where: { userId: req.user.userId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
    });
    const legacy = protocols.map((p) => ({
      id: p.id,
      title: p.title,
      when_to_use: p.whenToUse,
      steps: parseSteps(p.steps),
      cadence: p.cadence,
      created_at: p.createdAt,
      updated_at: p.updatedAt
    }));
    return res.json({ protocols: legacy });
  } catch (e) {
    console.error('Protocols list error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const payload = req.body || {};
  const title = (payload.title || '').toString().trim();
  const whenToUse = (payload.when_to_use || '').toString().trim();
  const cadence = (payload.cadence || '').toString().trim();
  const steps = parseSteps(payload.steps);

  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    await prisma.protocol.create({
      data: {
        userId: req.user.userId,
        title,
        whenToUse: whenToUse || null,
        steps: JSON.stringify(steps),
        cadence: cadence || null
      }
    });
    return res.status(201).json({ message: 'Created' });
  } catch (e) {
    console.error('Protocols create error:', e);
    return res.status(500).json({ error: 'Failed to create protocol' });
  }
});

router.patch('/:id', authenticateToken, async (req, res) => {
  const protocolId = Number(req.params.id);
  const payload = req.body || {};
  const title = payload.title !== undefined ? (payload.title || '').toString().trim() : undefined;
  const whenToUse = payload.when_to_use !== undefined ? (payload.when_to_use || '').toString().trim() : undefined;
  const cadence = payload.cadence !== undefined ? (payload.cadence || '').toString().trim() : undefined;
  const steps = payload.steps !== undefined ? parseSteps(payload.steps) : undefined;

  const data = {};
  if (title !== undefined) data.title = title;
  if (whenToUse !== undefined) data.whenToUse = whenToUse || null;
  if (steps !== undefined) data.steps = JSON.stringify(steps);
  if (cadence !== undefined) data.cadence = cadence || null;

  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'no updates' });

  try {
    const result = await prisma.protocol.updateMany({
      where: { id: protocolId, userId: req.user.userId },
      data
    });
    if (result.count === 0) return res.status(404).json({ error: 'Protocol not found' });
    return res.json({ message: 'Updated' });
  } catch (e) {
    console.error('Protocols update error:', e);
    return res.status(500).json({ error: 'Failed to update protocol' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  const protocolId = Number(req.params.id);
  try {
    const result = await prisma.protocol.deleteMany({
      where: { id: protocolId, userId: req.user.userId }
    });
    if (result.count === 0) return res.status(404).json({ error: 'Protocol not found' });
    return res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('Protocols delete error:', e);
    return res.status(500).json({ error: 'Failed to delete protocol' });
  }
});

module.exports = router;
