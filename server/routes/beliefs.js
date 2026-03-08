const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const beliefs = await prisma.belief.findMany({
      where: { userId: req.user.userId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
    });
    const legacy = beliefs.map((b) => ({
      id: b.id,
      current_belief: b.currentBelief,
      desired_belief: b.desiredBelief,
      change_plan: b.changePlan,
      created_at: b.createdAt,
      updated_at: b.updatedAt
    }));
    return res.json({ beliefs: legacy });
  } catch (e) {
    console.error('Beliefs list error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const current_belief = (req.body?.current_belief || '').toString().trim();
    const desired_belief = (req.body?.desired_belief || '').toString().trim();
    const change_plan = (req.body?.change_plan || '').toString().trim();

    if (!current_belief) return res.status(400).json({ error: 'current_belief is required' });
    if (!desired_belief) return res.status(400).json({ error: 'desired_belief is required' });

    const belief = await prisma.belief.create({
      data: {
        userId: req.user.userId,
        currentBelief: current_belief,
        desiredBelief: desired_belief,
        changePlan: change_plan || null
      }
    });
    return res.status(201).json({
      belief: {
        id: belief.id,
        current_belief: belief.currentBelief,
        desired_belief: belief.desiredBelief,
        change_plan: belief.changePlan,
        created_at: belief.createdAt,
        updated_at: belief.updatedAt
      }
    });
  } catch (e) {
    console.error('Beliefs create error:', e);
    return res.status(500).json({ error: 'Failed to create belief' });
  }
});

router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.belief.findFirst({
      where: { id, userId: req.user.userId }
    });
    if (!existing) return res.status(404).json({ error: 'Belief not found' });

    const current_belief = (req.body?.current_belief ?? existing.currentBelief).toString().trim();
    const desired_belief = (req.body?.desired_belief ?? existing.desiredBelief).toString().trim();
    const change_plan = (req.body?.change_plan ?? existing.changePlan ?? '').toString().trim();

    if (!current_belief) return res.status(400).json({ error: 'current_belief is required' });
    if (!desired_belief) return res.status(400).json({ error: 'desired_belief is required' });

    const belief = await prisma.belief.update({
      where: { id },
      data: {
        currentBelief: current_belief,
        desiredBelief: desired_belief,
        changePlan: change_plan || null
      }
    });
    return res.json({
      belief: {
        id: belief.id,
        current_belief: belief.currentBelief,
        desired_belief: belief.desiredBelief,
        change_plan: belief.changePlan,
        created_at: belief.createdAt,
        updated_at: belief.updatedAt
      }
    });
  } catch (e) {
    console.error('Beliefs update error:', e);
    if (e.code === 'P2025') return res.status(404).json({ error: 'Belief not found' });
    return res.status(500).json({ error: 'Failed to update belief' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await prisma.belief.deleteMany({
      where: { id, userId: req.user.userId }
    });
    if (result.count === 0) return res.status(404).json({ error: 'Belief not found' });
    return res.json({ status: 'deleted' });
  } catch (e) {
    console.error('Beliefs delete error:', e);
    return res.status(500).json({ error: 'Failed to delete belief' });
  }
});

module.exports = router;
