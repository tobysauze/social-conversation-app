const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { extractStories, refineStory, generateConversationStarters, buildRefinePrompt } = require('../services/openai');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  const { page = 1, limit = 20, tone } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  try {
    const stories = await prisma.story.findMany({
      where: { userId: req.user.userId, ...(tone ? { tone } : {}) },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    });
    const legacy = stories.map((s) => ({
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
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
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
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/extract/:journalId', authenticateToken, async (req, res) => {
  try {
    const { journalId } = req.params;
    const entry = await prisma.journalEntry.findFirst({
      where: { id: Number(journalId), userId: req.user.userId }
    });
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });

    const extractedStories = await extractStories(entry.content);
    return res.json({ stories: extractedStories.stories });
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

    const allStories = await prisma.story.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { title: true, content: true }
    });
    const existingStories = allStories.filter((s) => s.id !== Number(id));

    try {
      // Allow preview of prompt without sending to LLM
      if (req.query.preview === 'prompt') {
        const prompt = buildRefinePrompt(story.content, tone, duration, notes, existingStories);
        return res.json({ prompt });
      }
      const refinedContent = await refineStory(story.content, tone, duration, notes, existingStories);
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

    const story = await prisma.story.findFirst({
      where: { id: Number(id), userId: req.user.userId },
      select: { content: true }
    });
    if (!story) return res.status(404).json({ error: 'Story not found' });

    try {
      const starters = await generateConversationStarters(story.content);

      await Promise.all(
        starters.questions.map((question) =>
          prisma.conversationStarter.create({
            data: { userId: req.user.userId, storyId: Number(id), question }
          })
        )
      );

      return res.json({ conversation_starters: starters.questions });
    } catch (error) {
      console.error('Conversation starters error:', error);
      return res.status(500).json({ error: 'Failed to generate conversation starters' });
    }
  } catch (error) {
    console.error('Generate conversation starters error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update story (mark as told, add success rating, or edit content)
router.patch('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { times_told, success_rating, content, title } = req.body;

  const updateData = {};

  if (times_told !== undefined) {
    updateData.timesTold = times_told;
  }

  if (success_rating !== undefined) {
    updateData.successRating = success_rating;
  }

  if (content !== undefined) {
    updateData.content = content;
  }

  if (title !== undefined) {
    updateData.title = title;
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'No valid updates provided' });
  }

  try {
    const updated = await prisma.story.update({
      where: { id: Number(id), userId: req.user.userId },
      data: updateData
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
    res.json({ story: legacy });
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

