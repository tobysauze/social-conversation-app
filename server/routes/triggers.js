const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const triggers = await prisma.anxietyTrigger.findMany({
      where: { userId: req.user.userId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
    });
    const legacy = triggers.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      intensity: t.intensity,
      notes: t.notes,
      created_at: t.createdAt,
      updated_at: t.updatedAt
    }));
    return res.json({ triggers: legacy });
  } catch (e) {
    console.error('Triggers list error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, category = null, intensity = null, notes = null } = req.body || {};

    const t = (title || '').toString().trim();
    if (!t) return res.status(400).json({ error: 'title is required' });

    const intVal = intensity === null || intensity === undefined || intensity === '' ? null : Number(intensity);
    if (intVal !== null && (!Number.isFinite(intVal) || intVal < 1 || intVal > 10)) {
      return res.status(400).json({ error: 'intensity must be 1-10' });
    }

    const trigger = await prisma.anxietyTrigger.create({
      data: {
        userId: req.user.userId,
        title: t,
        category: category || null,
        intensity: intVal,
        notes: notes || null
      }
    });
    return res.status(201).json({
      trigger: {
        id: trigger.id,
        title: trigger.title,
        category: trigger.category,
        intensity: trigger.intensity,
        notes: trigger.notes,
        created_at: trigger.createdAt,
        updated_at: trigger.updatedAt
      }
    });
  } catch (e) {
    console.error('Triggers create error:', e);
    return res.status(500).json({ error: 'Failed to create trigger' });
  }
});

router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.anxietyTrigger.findFirst({
      where: { id, userId: req.user.userId }
    });
    if (!existing) return res.status(404).json({ error: 'Trigger not found' });

    const { title, category, intensity, notes } = req.body || {};

    const t = ((title ?? existing.title) || '').toString().trim();
    if (!t) return res.status(400).json({ error: 'title is required' });

    const intVal = intensity === null || intensity === undefined || intensity === '' ? null : Number(intensity);
    if (intVal !== null && (!Number.isFinite(intVal) || intVal < 1 || intVal > 10)) {
      return res.status(400).json({ error: 'intensity must be 1-10' });
    }

    const trigger = await prisma.anxietyTrigger.update({
      where: { id },
      data: {
        title: t,
        category: category !== undefined ? (category || null) : existing.category,
        intensity: intensity !== undefined ? intVal : existing.intensity,
        notes: notes !== undefined ? (notes || null) : existing.notes
      }
    });
    return res.json({
      trigger: {
        id: trigger.id,
        title: trigger.title,
        category: trigger.category,
        intensity: trigger.intensity,
        notes: trigger.notes,
        created_at: trigger.createdAt,
        updated_at: trigger.updatedAt
      }
    });
  } catch (e) {
    console.error('Triggers update error:', e);
    if (e.code === 'P2025') return res.status(404).json({ error: 'Trigger not found' });
    return res.status(500).json({ error: 'Failed to update trigger' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await prisma.anxietyTrigger.deleteMany({
      where: { id, userId: req.user.userId }
    });
    if (result.count === 0) return res.status(404).json({ error: 'Trigger not found' });
    return res.json({ status: 'deleted' });
  } catch (e) {
    console.error('Triggers delete error:', e);
    return res.status(500).json({ error: 'Failed to delete trigger' });
  }
});

module.exports = router;
