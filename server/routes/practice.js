const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { practiceFeedback } = require('../services/openai');

const router = express.Router();

// Get practice sessions for a user
router.get('/sessions', authenticateToken, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  try {
    const sessions = await prisma.practiceSession.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    });
    const storyIds = sessions.map(s => s.storyId).filter(Boolean);
    const stories = storyIds.length
      ? await prisma.story.findMany({ where: { id: { in: storyIds } }, select: { id: true, title: true } })
      : [];
    const idToTitle = Object.fromEntries(stories.map(s => [s.id, s.title]));

    const legacy = sessions.map(s => ({
      id: s.id,
      user_id: s.userId,
      story_id: s.storyId,
      session_type: s.sessionType,
      feedback: s.feedback,
      rating: s.rating,
      created_at: s.createdAt,
      story_title: s.storyId ? idToTitle[s.storyId] || null : null
    }));
    res.json({ sessions: legacy });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Start a practice session
router.post('/sessions', authenticateToken, async (req, res) => {
  try {
    const { story_id, session_type = 'storytelling' } = req.body;
    if (story_id) {
      const story = await prisma.story.findFirst({ where: { id: Number(story_id), userId: req.user.userId } });
      if (!story) return res.status(404).json({ error: 'Story not found' });
    }
    const created = await prisma.practiceSession.create({
      data: {
        userId: req.user.userId,
        storyId: story_id ? Number(story_id) : null,
        sessionType: session_type
      }
    });
    res.status(201).json({ session_id: created.id, message: 'Practice session started' });
  } catch (error) {
    console.error('Start practice session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get practice feedback
router.post('/feedback', authenticateToken, async (req, res) => {
  try {
    const { story_content, user_delivery, session_id } = req.body;

    if (!story_content || !user_delivery) {
      return res.status(400).json({ error: 'Story content and user delivery are required' });
    }

    try {
      const feedback = await practiceFeedback(story_content, user_delivery);
      if (session_id) {
        await prisma.practiceSession.update({
          where: { id: Number(session_id) },
          data: { feedback: feedback.feedback, rating: feedback.rating }
        });
      }
      res.json({ feedback });
    } catch (error) {
      console.error('Practice feedback error:', error);
      res.status(500).json({ error: 'Failed to generate practice feedback' });
    }
  } catch (error) {
    console.error('Get practice feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversation starters for practice
router.get('/conversation-starters', authenticateToken, async (req, res) => {
  const { story_id } = req.query;
  try {
    const starters = await prisma.conversationStarter.findMany({
      where: { userId: req.user.userId, ...(story_id ? { storyId: Number(story_id) } : {}) },
      orderBy: { createdAt: 'desc' }
    });
    const storyIds = starters.map(s => s.storyId).filter(Boolean);
    const stories = storyIds.length
      ? await prisma.story.findMany({ where: { id: { in: storyIds } }, select: { id: true, title: true } })
      : [];
    const idToTitle = Object.fromEntries(stories.map(s => [s.id, s.title]));
    const legacy = starters.map(s => ({
      id: s.id,
      user_id: s.userId,
      story_id: s.storyId,
      question: s.question,
      context: s.context,
      created_at: s.createdAt,
      story_title: s.storyId ? idToTitle[s.storyId] || null : null
    }));
    res.json({ conversation_starters: legacy });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get practice statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [totalSessions, avgAgg, storyGroups, recentSessions] = await Promise.all([
      prisma.practiceSession.count({ where: { userId } }),
      prisma.practiceSession.aggregate({ _avg: { rating: true }, where: { userId, rating: { not: null } } }),
      prisma.practiceSession.groupBy({ by: ['storyId'], where: { userId, storyId: { not: null } } }),
      prisma.practiceSession.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 7*24*60*60*1000) } } })
    ]);
    res.json({ stats: {
      totalSessions,
      avgRating: Number(avgAgg._avg.rating || 0),
      storiesPracticed: storyGroups.filter(g => g.storyId !== null).length,
      recentSessions
    }});
  } catch (e) {
    console.error('Stats error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get a specific practice session
router.get('/sessions/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const ps = await prisma.practiceSession.findFirst({ where: { id: Number(id), userId: req.user.userId } });
    if (!ps) return res.status(404).json({ error: 'Practice session not found' });
    const story = ps.storyId ? await prisma.story.findUnique({ where: { id: ps.storyId } }) : null;
    const legacy = {
      id: ps.id,
      user_id: ps.userId,
      story_id: ps.storyId,
      session_type: ps.sessionType,
      feedback: ps.feedback,
      rating: ps.rating,
      created_at: ps.createdAt,
      story_title: story ? story.title : null,
      story_content: story ? story.content : null
    };
    res.json({ session: legacy });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;

