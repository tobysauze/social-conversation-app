const express = require('express');
const multer = require('multer');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { analyzeJournalForPersonalInsights, transcribeAudio } = require('../services/openai');
const { embedAndStore, deleteMemory, isAvailable: memoryAvailable } = require('../services/embeddings');

function syncJournalEmbedding(entry) {
  if (!memoryAvailable()) return;
  const text = `Journal entry on ${entry.createdAt.toISOString().slice(0, 10)}${entry.mood ? `, feeling ${entry.mood}` : ''}:\n${entry.content}`;
  embedAndStore({
    userId: entry.userId,
    sourceType: 'journal',
    sourceId: entry.id,
    content: text,
    metadata: { date: entry.createdAt.toISOString().slice(0, 10), mood: entry.mood || null }
  }).catch((e) => console.warn('Journal embed sync failed:', e?.message));
}

const router = express.Router();

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // Whisper API hard limit is 25MB
});

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
    console.error('Journal list error:', e);
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
    console.error('Journal get error:', e);
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
    syncJournalEmbedding(entry);
    res.status(201).json({ entry: {
      id: entry.id,
      content: entry.content,
      mood: entry.mood,
      tags: entry.tags,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt
    } });
  } catch (e) {
    console.error('Journal create error:', e);
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
    syncJournalEmbedding(entry);
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
    console.error('Journal update error:', e);
    res.status(500).json({ error: 'Failed to update journal entry' });
  }
});

// Delete a journal entry
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.journalEntry.delete({ where: { id: Number(id) } });
    if (memoryAvailable()) {
      deleteMemory({ userId: req.user.userId, sourceType: 'journal', sourceId: Number(id) })
        .catch((e) => console.warn('Journal embed delete failed:', e?.message));
    }
    res.json({ message: 'Journal entry deleted successfully' });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Journal entry not found' });
    console.error('Journal delete error:', e);
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
    console.error('Journal date-range error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Transcribe an audio recording for voice-based journal capture.
// Returns the raw transcript so the client can let the user review/edit before saving.
router.post('/transcribe', authenticateToken, audioUpload.single('audio'), async (req, res) => {
  if (!req.file || !req.file.buffer || req.file.size === 0) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }
  try {
    const filename = req.file.originalname || 'recording.webm';
    const text = await transcribeAudio(req.file.buffer, filename);
    res.json({ text });
  } catch (e) {
    console.error('Journal transcribe error:', e);
    const status = /OPENAI_API_KEY/.test(e.message) ? 503 : 500;
    res.status(status).json({ error: e.message || 'Failed to transcribe audio' });
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

