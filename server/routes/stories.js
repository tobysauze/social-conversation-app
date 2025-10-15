const express = require('express');
const { prisma } = require('../prisma/client');
const { getDatabase } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const { extractStories, refineStory, generateConversationStarters, buildRefinePrompt } = require('../services/openai');

const router = express.Router();

// Get all stories for a user
router.get('/', authenticateToken, async (req, res) => {
  const { page = 1, limit = 20, tone } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  try {
    try {
      const stories = await prisma.story.findMany({
        where: { userId: req.user.userId, ...(tone ? { tone } : {}) },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      });
      const legacy = stories.map(s => ({
        id: s.id,
        user_id: s.userId,
        journal_entry_id: s.journalEntryId,
        title: s.title,
        content: s.content,
        tone: s.tone,
        duration_seconds: s.durationSeconds,
        tags: s.tags ? (typeof s.tags === 'string' ? JSON.parse(s.tags) : s.tags) : [],
        times_told: s.timesTold,
        success_rating: s.successRating,
        created_at: s.createdAt,
        updated_at: s.updatedAt
      }));
      return res.json({ stories: legacy });
    } catch (pgErr) {
      // Fallback to SQLite
      const db = getDatabase();
      const rows = db.prepare(
        `SELECT id, user_id, journal_entry_id, title, content, tone, duration_seconds, tags, times_told, success_rating, created_at, updated_at
         FROM stories
         WHERE user_id = ? ${tone ? 'AND tone = ?' : ''}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      ).all(...[req.user.userId, ...(tone ? [tone] : []), Number(limit), skip]);
      const legacy = rows.map(s => ({
        id: s.id,
        user_id: s.user_id,
        journal_entry_id: s.journal_entry_id,
        title: s.title,
        content: s.content,
        tone: s.tone,
        duration_seconds: s.duration_seconds,
        tags: s.tags ? (typeof s.tags === 'string' && s.tags.trim().startsWith('[') ? JSON.parse(s.tags) : [s.tags]) : [],
        times_told: s.times_told,
        success_rating: s.success_rating,
        created_at: s.created_at,
        updated_at: s.updated_at
      }));
      return res.json({ stories: legacy });
    }
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get a specific story
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    try {
      const story = await prisma.story.findFirst({ where: { id: Number(id), userId: req.user.userId } });
      if (!story) return res.status(404).json({ error: 'Story not found' });
      const legacy = {
        id: story.id,
        user_id: story.userId,
        journal_entry_id: story.journalEntryId,
        title: story.title,
        content: story.content,
        tone: story.tone,
        duration_seconds: story.durationSeconds,
        tags: story.tags ? (typeof story.tags === 'string' ? JSON.parse(story.tags) : story.tags) : [],
        times_told: story.timesTold,
        success_rating: story.successRating,
        created_at: story.createdAt,
        updated_at: story.updatedAt
      };
      return res.json({ story: legacy });
    } catch (pgErr) {
      const db = getDatabase();
      const s = db.prepare(
        'SELECT * FROM stories WHERE id = ? AND user_id = ?'
      ).get(Number(id), req.user.userId);
      if (!s) return res.status(404).json({ error: 'Story not found' });
      const legacy = {
        id: s.id,
        user_id: s.user_id,
        journal_entry_id: s.journal_entry_id,
        title: s.title,
        content: s.content,
        tone: s.tone,
        duration_seconds: s.duration_seconds,
        tags: s.tags ? (typeof s.tags === 'string' && s.tags.trim().startsWith('[') ? JSON.parse(s.tags) : [s.tags]) : [],
        times_told: s.times_told,
        success_rating: s.success_rating,
        created_at: s.created_at,
        updated_at: s.updated_at
      };
      return res.json({ story: legacy });
    }
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Extract stories from a journal entry
router.post('/extract/:journalId', authenticateToken, async (req, res) => {
  try {
    const { journalId } = req.params;
    const db = getDatabase();

    // Get the journal entry
    db.get(
      'SELECT * FROM journal_entries WHERE id = ? AND user_id = ?',
      [journalId, req.user.userId],
      async (err, entry) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!entry) {
          return res.status(404).json({ error: 'Journal entry not found' });
        }

        try {
          // Extract stories using OpenAI
          const extractedStories = await extractStories(entry.content);
          res.json({ stories: extractedStories.stories });
        } catch (error) {
          console.error('Story extraction error:', error);
          res.status(500).json({ error: 'Failed to extract stories' });
        }
      }
    );
  } catch (error) {
    console.error('Extract stories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new story
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      title, 
      content, 
      tone = 'casual', 
      duration_seconds = 30, 
      journal_entry_id,
      tags 
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    try {
      const story = await prisma.story.create({
        data: {
          userId: req.user.userId,
          journalEntryId: journal_entry_id || null,
          title,
          content,
          tone,
          durationSeconds: duration_seconds,
          tags: tags ? JSON.stringify(tags) : null
        }
      });
      const legacy = {
        id: story.id,
        user_id: story.userId,
        journal_entry_id: story.journalEntryId,
        title: story.title,
        content: story.content,
        tone: story.tone,
        duration_seconds: story.durationSeconds,
        tags: story.tags ? (typeof story.tags === 'string' ? JSON.parse(story.tags) : story.tags) : [],
        times_told: story.timesTold,
        success_rating: story.successRating,
        created_at: story.createdAt,
        updated_at: story.updatedAt
      };
      res.status(201).json({ story: legacy });
    } catch (e) {
      // Fallback to SQLite
      try {
        const db = getDatabase();
        const stmt = db.prepare(
          `INSERT INTO stories (user_id, journal_entry_id, title, content, tone, duration_seconds, tags)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        );
        const info = stmt.run(
          req.user.userId,
          journal_entry_id || null,
          title,
          content,
          tone,
          duration_seconds,
          tags ? JSON.stringify(tags) : null
        );
        const row = db.prepare('SELECT * FROM stories WHERE id = ?').get(info.lastInsertRowid);
        const legacy = {
          id: row.id,
          user_id: row.user_id,
          journal_entry_id: row.journal_entry_id,
          title: row.title,
          content: row.content,
          tone: row.tone,
          duration_seconds: row.duration_seconds,
          tags: row.tags ? (typeof row.tags === 'string' && row.tags.trim().startsWith('[') ? JSON.parse(row.tags) : [row.tags]) : [],
          times_told: row.times_told,
          success_rating: row.success_rating,
          created_at: row.created_at,
          updated_at: row.updated_at
        };
        return res.status(201).json({ story: legacy });
      } catch (sqliteErr) {
        return res.status(500).json({ error: 'Failed to create story' });
      }
    }
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refine a story
router.post('/:id/refine', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tone = 'casual', duration = 30, notes = '' } = req.body;

    // Load via Prisma
    const story = await prisma.story.findFirst({ where: { id: Number(id), userId: req.user.userId } });
    if (!story) return res.status(404).json({ error: 'Story not found' });

    try {
      // Allow preview of prompt without sending to LLM
      if (req.query.preview === 'prompt') {
        const prompt = buildRefinePrompt(story.content, tone, duration, notes);
        return res.json({ prompt });
      }
      const refinedContent = await refineStory(story.content, tone, duration, notes);
      const updated = await prisma.story.update({
        where: { id: Number(id) },
        data: { content: refinedContent, tone, durationSeconds: duration }
      });
      const legacy = {
        id: updated.id,
        user_id: updated.userId,
        journal_entry_id: updated.journalEntryId,
        title: updated.title,
        content: updated.content,
        tone: updated.tone,
        duration_seconds: updated.durationSeconds,
        tags: updated.tags,
        times_told: updated.timesTold,
        success_rating: updated.successRating,
        created_at: updated.createdAt,
        updated_at: updated.updatedAt
      };
      return res.json({ story: legacy });
    } catch (err) {
      console.error('Story refinement error:', err);
      return res.status(500).json({ error: 'Failed to refine story' });
    }
  } catch (error) {
    console.error('Refine story error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate conversation starters for a story
router.get('/:id/conversation-starters', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = null;

    // Get the story
    db.get(
      'SELECT * FROM stories WHERE id = ? AND user_id = ?',
      [id, req.user.userId],
      async (err, story) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!story) {
          return res.status(404).json({ error: 'Story not found' });
        }

        try {
          const starters = await generateConversationStarters(story.content);
          await Promise.all(
            starters.questions.map((question) =>
              prisma.conversationStarter.create({
                data: { userId: req.user.userId, storyId: Number(id), question }
              })
            )
          );
          res.json({ conversation_starters: starters.questions });
        } catch (error) {
          console.error('Conversation starters error:', error);
          res.status(500).json({ error: 'Failed to generate conversation starters' });
        }
      }
    );
  } catch (error) {
    console.error('Generate conversation starters error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update story (mark as told, add success rating)
router.patch('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { times_told, success_rating } = req.body;

  const updates = [];
  const params = [];

  if (times_told !== undefined) {
    updates.push('times_told = ?');
    params.push(times_told);
  }

  if (success_rating !== undefined) {
    updates.push('success_rating = ?');
    params.push(success_rating);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid updates provided' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  try {
    await prisma.story.update({
      where: { id: Number(id) },
      data: Object.fromEntries(updates.map((u, i) => [u.split(' = ')[0].replace('duration_seconds','durationSeconds').replace('times_told','timesTold').replace('success_rating','successRating'), params[i]]))
    });
    res.json({ message: 'Story updated successfully' });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Story not found' });
    res.status(500).json({ error: 'Failed to update story' });
  }
});

// Delete a story
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.story.delete({ where: { id: Number(id) } });
    res.json({ message: 'Story deleted successfully' });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Story not found' });
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

module.exports = router;

