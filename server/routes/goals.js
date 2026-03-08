const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function normalizeDate(input) {
  if (!input) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return new Date(input + 'T12:00:00Z');
  const m = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return new Date(`${yyyy}-${mm}-${dd}T12:00:00Z`);
  }
  return input ? new Date(input) : null;
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' }
    });
    const legacy = goals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      area: g.area,
      target_date: g.targetDate ? g.targetDate.toISOString().slice(0, 10) : null,
      status: g.status,
      created_at: g.createdAt,
      updated_at: g.updatedAt
    }));
    res.json({ goals: legacy });
  } catch (e) {
    console.error('Goals GET error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const { title, description = '', area = null } = req.body;
  const target_date = normalizeDate(req.body.target_date);
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    await prisma.goal.create({
      data: {
        userId: req.user.userId,
        title,
        description: description || null,
        area: area || null,
        targetDate: target_date
      }
    });
    res.status(201).json({ message: 'Created' });
  } catch (e) {
    console.error('Goals POST error:', e);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

router.patch('/:id', authenticateToken, async (req, res) => {
  const id = Number(req.params.id);
  const { title, description, area, status } = req.body;
  const target_date = req.body.target_date !== undefined ? normalizeDate(req.body.target_date) : undefined;

  const data = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description || null;
  if (area !== undefined) data.area = area || null;
  if (target_date !== undefined) data.targetDate = target_date;
  if (status !== undefined) data.status = status;

  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'no updates' });

  try {
    const result = await prisma.goal.updateMany({
      where: { id, userId: req.user.userId },
      data
    });
    if (result.count === 0) return res.status(404).json({ error: 'Goal not found' });
    res.json({ message: 'Updated' });
  } catch (e) {
    console.error('Goals PATCH error:', e);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await prisma.goal.deleteMany({
      where: { id: Number(req.params.id), userId: req.user.userId }
    });
    if (result.count === 0) return res.status(404).json({ error: 'Goal not found' });
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('Goals DELETE error:', e);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

module.exports = router;
