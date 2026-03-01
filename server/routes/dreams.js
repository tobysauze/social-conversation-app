const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { analyzeDream } = require('../services/openai');

const router = express.Router();

// Get all dream entries for a user
router.get('/', authenticateToken, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  try {
    const entries = await prisma.dreamEntry.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    });
    const legacy = entries.map((e) => ({
      id: e.id,
      content: e.content,
      title: e.title,
      sleep_quality: e.sleepQuality,
      tags: e.tags,
      analysis: e.analysis,
      created_at: e.createdAt,
      updated_at: e.updatedAt
    }));
    res.json({ entries: legacy });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get a specific dream entry
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const entry = await prisma.dreamEntry.findFirst({
      where: { id: Number(id), userId: req.user.userId }
    });
    if (!entry) return res.status(404).json({ error: 'Dream entry not found' });
    res.json({
      entry: {
        id: entry.id,
        content: entry.content,
        title: entry.title,
        sleep_quality: entry.sleepQuality,
        tags: entry.tags,
        analysis: entry.analysis,
        created_at: entry.createdAt,
        updated_at: entry.updatedAt
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Create a new dream entry
router.post('/', authenticateToken, async (req, res) => {
  const { content, title, sleep_quality, tags } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    const entry = await prisma.dreamEntry.create({
      data: {
        userId: req.user.userId,
        content: content.trim(),
        title: title?.trim() || null,
        sleepQuality: sleep_quality || null,
        tags: tags ? JSON.stringify(tags) : null
      }
    });
    res.status(201).json({
      entry: {
        id: entry.id,
        content: entry.content,
        title: entry.title,
        sleep_quality: entry.sleepQuality,
        tags: entry.tags,
        analysis: entry.analysis,
        created_at: entry.createdAt,
        updated_at: entry.updatedAt
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create dream entry' });
  }
});

// Update a dream entry
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { content, title, sleep_quality, tags } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    const entry = await prisma.dreamEntry.update({
      where: { id: Number(id) },
      data: {
        content: content.trim(),
        title: title?.trim() || null,
        sleepQuality: sleep_quality || null,
        tags: tags ? JSON.stringify(tags) : null
      }
    });
    res.json({
      entry: {
        id: entry.id,
        content: entry.content,
        title: entry.title,
        sleep_quality: entry.sleepQuality,
        tags: entry.tags,
        analysis: entry.analysis,
        created_at: entry.createdAt,
        updated_at: entry.updatedAt
      }
    });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Dream entry not found' });
    res.status(500).json({ error: 'Failed to update dream entry' });
  }
});

// Delete a dream entry
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.dreamEntry.delete({ where: { id: Number(id) } });
    res.json({ message: 'Dream entry deleted successfully' });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Dream entry not found' });
    res.status(500).json({ error: 'Failed to delete dream entry' });
  }
});

// Analyze a dream for possible meanings
router.post('/:id/analyze', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const entry = await prisma.dreamEntry.findFirst({
      where: { id: Number(id), userId: req.user.userId }
    });
    if (!entry) return res.status(404).json({ error: 'Dream entry not found' });

    const analysis = await analyzeDream(entry.content);

    // Optionally save analysis to the entry
    await prisma.dreamEntry.update({
      where: { id: Number(id) },
      data: { analysis: JSON.stringify(analysis) }
    });

    res.json({ analysis });
  } catch (e) {
    console.error('Analyze dream error:', e);
    res.status(500).json({ error: 'Failed to analyze dream' });
  }
});

module.exports = router;
