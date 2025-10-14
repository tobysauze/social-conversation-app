const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { getStoryRecommendations, analyzeJournalForPeopleInsights } = require('../services/openai');

const router = express.Router();

// Get all people for a user
router.get('/', authenticateToken, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  try {
    const people = await prisma.person.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    });
    const legacy = people.map(p => ({
      id: p.id,
      user_id: p.userId,
      name: p.name,
      relationship: p.relationship,
      how_met: p.howMet,
      interests: p.interests ? JSON.parse(p.interests) : [],
      personality_traits: p.personalityTraits ? JSON.parse(p.personalityTraits) : [],
      conversation_style: p.conversationStyle,
      shared_experiences: p.sharedExperiences ? JSON.parse(p.sharedExperiences) : [],
      story_preferences: p.storyPreferences ? JSON.parse(p.storyPreferences) : [],
      notes: p.notes,
      created_at: p.createdAt,
      updated_at: p.updatedAt
    }));
    res.json({ people: legacy });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get a specific person
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const person = await prisma.person.findFirst({
      where: { id: Number(id), userId: req.user.userId }
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });
    const legacy = {
      id: person.id,
      user_id: person.userId,
      name: person.name,
      relationship: person.relationship,
      how_met: person.howMet,
      interests: person.interests ? JSON.parse(person.interests) : [],
      personality_traits: person.personalityTraits ? JSON.parse(person.personalityTraits) : [],
      conversation_style: person.conversationStyle,
      shared_experiences: person.sharedExperiences ? JSON.parse(person.sharedExperiences) : [],
      story_preferences: person.storyPreferences ? JSON.parse(person.storyPreferences) : [],
      notes: person.notes,
      created_at: person.createdAt,
      updated_at: person.updatedAt
    };
    res.json({ person: legacy });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Create a new person
router.post('/', authenticateToken, async (req, res) => {
  const {
    name,
    relationship,
    how_met,
    interests = [],
    personality_traits = [],
    conversation_style,
    shared_experiences = [],
    story_preferences = [],
    notes
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const person = await prisma.person.create({
      data: {
        userId: req.user.userId,
        name,
        relationship: relationship || null,
        howMet: how_met || null,
        interests: JSON.stringify(interests || []),
        personalityTraits: JSON.stringify(personality_traits || []),
        conversationStyle: conversation_style || null,
        sharedExperiences: JSON.stringify(shared_experiences || []),
        storyPreferences: JSON.stringify(story_preferences || []),
        notes: notes || null
      }
    });
    const legacy = {
      id: person.id,
      user_id: person.userId,
      name: person.name,
      relationship: person.relationship,
      how_met: person.howMet,
      interests: person.interests ? JSON.parse(person.interests) : [],
      personality_traits: person.personalityTraits ? JSON.parse(person.personalityTraits) : [],
      conversation_style: person.conversationStyle,
      shared_experiences: person.sharedExperiences ? JSON.parse(person.sharedExperiences) : [],
      story_preferences: person.storyPreferences ? JSON.parse(person.storyPreferences) : [],
      notes: person.notes,
      created_at: person.createdAt,
      updated_at: person.updatedAt
    };
    res.status(201).json({ person: legacy });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create person' });
  }
});

// Update a person
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const {
    name,
    relationship,
    how_met,
    interests = [],
    personality_traits = [],
    conversation_style,
    shared_experiences = [],
    story_preferences = [],
    notes
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const person = await prisma.person.update({
      where: { id: Number(id) },
      data: {
        name,
        relationship: relationship || null,
        howMet: how_met || null,
        interests: JSON.stringify(interests || []),
        personalityTraits: JSON.stringify(personality_traits || []),
        conversationStyle: conversation_style || null,
        sharedExperiences: JSON.stringify(shared_experiences || []),
        storyPreferences: JSON.stringify(story_preferences || []),
        notes: notes || null
      }
    });
    const legacy = {
      id: person.id,
      user_id: person.userId,
      name: person.name,
      relationship: person.relationship,
      how_met: person.howMet,
      interests: person.interests ? JSON.parse(person.interests) : [],
      personality_traits: person.personalityTraits ? JSON.parse(person.personalityTraits) : [],
      conversation_style: person.conversationStyle,
      shared_experiences: person.sharedExperiences ? JSON.parse(person.sharedExperiences) : [],
      story_preferences: person.storyPreferences ? JSON.parse(person.storyPreferences) : [],
      notes: person.notes,
      created_at: person.createdAt,
      updated_at: person.updatedAt
    };
    res.json({ person: legacy });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Person not found' });
    res.status(500).json({ error: 'Failed to update person' });
  }
});

// Delete a person
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.person.delete({ where: { id: Number(id) } });
    res.json({ message: 'Person deleted successfully' });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Person not found' });
    res.status(500).json({ error: 'Failed to delete person' });
  }
});

// Get story recommendations for a person
router.get('/:id/story-recommendations', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const person = await prisma.person.findFirst({ where: { id: Number(id), userId: req.user.userId } });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const stories = await prisma.story.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' }
    });

    const parsedPerson = {
      id: person.id,
      name: person.name,
      interests: person.interests ? JSON.parse(person.interests) : [],
      personality_traits: person.personalityTraits ? JSON.parse(person.personalityTraits) : [],
      shared_experiences: person.sharedExperiences ? JSON.parse(person.sharedExperiences) : [],
      story_preferences: person.storyPreferences ? JSON.parse(person.storyPreferences) : []
    };

    const recommendations = await getStoryRecommendations(parsedPerson, stories);
    res.json({ recommendations });
  } catch (error) {
    console.error('Story recommendations error:', error);
    res.status(500).json({ error: 'Failed to get story recommendations' });
  }
});

// Tag a story with a person
router.post('/:id/tag-story/:storyId', authenticateToken, async (req, res) => {
  // TODO: implement join table in Postgres
  res.json({ message: 'Tagging not yet implemented in Postgres; coming soon.' });
});

// Remove tag from a story
router.delete('/:id/tag-story/:storyId', authenticateToken, async (req, res) => {
  res.json({ message: 'Untag not yet implemented in Postgres; coming soon.' });
});

// Tag a journal entry with a person
router.post('/:id/tag-journal/:journalId', authenticateToken, async (req, res) => {
  res.json({ message: 'Tagging not yet implemented in Postgres; coming soon.' });
});

// Remove tag from a journal entry
router.delete('/:id/tag-journal/:journalId', authenticateToken, async (req, res) => {
  res.json({ message: 'Untag not yet implemented in Postgres; coming soon.' });
});

// Analyze journal entry for people insights
router.post('/analyze-journal', authenticateToken, async (req, res) => {
  try {
    const { journalContent } = req.body;
    
    if (!journalContent) {
      return res.status(400).json({ error: 'Journal content is required' });
    }

    // Pull existing people via Prisma
    const existingPeople = await prisma.person.findMany({ where: { userId: req.user.userId } });

    const parsedPeople = existingPeople.map(person => ({
      id: person.id,
      name: person.name,
      interests: person.interests ? JSON.parse(person.interests) : [],
      personality_traits: person.personalityTraits ? JSON.parse(person.personalityTraits) : [],
      shared_experiences: person.sharedExperiences ? JSON.parse(person.sharedExperiences) : [],
      story_preferences: person.storyPreferences ? JSON.parse(person.storyPreferences) : [],
      conversation_style: person.conversationStyle || null,
      relationship: person.relationship || null
    }));

    const insights = await analyzeJournalForPeopleInsights(journalContent, parsedPeople);
    res.json({ insights: insights.people_insights });
  } catch (error) {
    console.error('Journal analysis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Apply insights to a person's profile
router.post('/:id/apply-insights', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { insights } = req.body;

  if (!insights) {
    return res.status(400).json({ error: 'Insights are required' });
  }

  try {
    const person = await prisma.person.findFirst({
      where: { id: Number(id), userId: req.user.userId }
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const currentInterests = person.interests ? JSON.parse(person.interests) : [];
    const currentTraits = person.personalityTraits ? JSON.parse(person.personalityTraits) : [];
    const currentPreferences = person.storyPreferences ? JSON.parse(person.storyPreferences) : [];

    const updatedInterests = Array.from(new Set([...currentInterests, ...(insights.interests || [])]));
    const updatedTraits = Array.from(new Set([...currentTraits, ...(insights.personality_traits || [])]));
    const updatedPreferences = Array.from(new Set([...currentPreferences, ...(insights.preferences || [])]));

    const updatedConversationStyle = insights.conversation_style || person.conversationStyle || null;
    const newNotesPart = insights.observations || '';
    const updatedNotes = newNotesPart
      ? ((person.notes || '') ? `${person.notes}\n\n${newNotesPart}` : newNotesPart)
      : person.notes || null;

    await prisma.person.update({
      where: { id: Number(id) },
      data: {
        interests: JSON.stringify(updatedInterests),
        personalityTraits: JSON.stringify(updatedTraits),
        storyPreferences: JSON.stringify(updatedPreferences),
        conversationStyle: updatedConversationStyle,
        notes: updatedNotes
      }
    });

    res.json({ message: 'Insights applied successfully' });
  } catch (e) {
    console.error('Error applying insights:', e);
    res.status(500).json({ error: 'Failed to apply insights' });
  }
});

module.exports = router;
