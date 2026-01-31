const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { analyzeJournalForPersonalInsights } = require('../services/openai');

const router = express.Router();

// Get all journal entries for a user
router.get('/', authenticateToken, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  try {
    const entries = await prisma.journalEntry.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    });
    const legacy = entries.map(e => ({
      id: e.id,
      content: e.content,
      mood: e.mood,
      tags: e.tags,
      created_at: e.createdAt,
      updated_at: e.updatedAt
    }));
    res.json({ entries: legacy });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get a specific journal entry
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: Number(id), userId: req.user.userId }
    });
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });
    res.json({ entry: {
      id: entry.id,
      content: entry.content,
      mood: entry.mood,
      tags: entry.tags,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt
    } });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Create a new journal entry
router.post('/', authenticateToken, async (req, res) => {
  const { content, mood, tags } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    const entry = await prisma.journalEntry.create({
      data: {
        userId: req.user.userId,
        content: content.trim(),
        mood: mood || null,
        tags: tags ? JSON.stringify(tags) : null
      }
    });
    res.status(201).json({ entry: {
      id: entry.id,
      content: entry.content,
      mood: entry.mood,
      tags: entry.tags,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt
    } });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create journal entry' });
  }
});

// Update a journal entry
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { content, mood, tags } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    const entry = await prisma.journalEntry.update({
      where: { id: Number(id) },
      data: {
        content: content.trim(),
        mood: mood || null,
        tags: tags ? JSON.stringify(tags) : null
      }
    });
    res.json({ entry: {
      id: entry.id,
      content: entry.content,
      mood: entry.mood,
      tags: entry.tags,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt
    } });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Journal entry not found' });
    res.status(500).json({ error: 'Failed to update journal entry' });
  }
});

// Delete a journal entry
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.journalEntry.delete({ where: { id: Number(id) } });
    res.json({ message: 'Journal entry deleted successfully' });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Journal entry not found' });
    res.status(500).json({ error: 'Failed to delete journal entry' });
  }
});

// Get journal entries by date range
router.get('/date-range/:start/:end', authenticateToken, async (req, res) => {
  const { start, end } = req.params;
  try {
    const entries = await prisma.journalEntry.findMany({
      where: {
        userId: req.user.userId,
        createdAt: { gte: new Date(start), lte: new Date(end) }
      },
      orderBy: { createdAt: 'desc' }
    });
    const legacy = entries.map(e => ({
      id: e.id,
      content: e.content,
      mood: e.mood,
      tags: e.tags,
      created_at: e.createdAt
    }));
    res.json({ entries: legacy });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Analyze a journal entry for goals, beliefs, triggers, and identity
router.post('/:id/analyze-insights', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: Number(id), userId: req.user.userId }
    });
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });

    const insights = await analyzeJournalForPersonalInsights(entry.content);
    res.json({ insights });
  } catch (e) {
    console.error('Analyze journal insights error:', e);
    res.status(500).json({ error: 'Failed to analyze journal entry' });
  }
});

module.exports = router;

