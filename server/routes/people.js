const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { getStoryRecommendations, analyzeJournalForPeopleInsights } = require('../services/openai');

const router = express.Router();

function parseJsonArrayOrWrap(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'string') return [parsed];
    } catch (_) {
      // Fallback: split by comma if present, else wrap
      if (value.includes(',')) return value.split(',').map(s=>s.trim()).filter(Boolean);
      return [value];
    }
  }
  return [];
}

let peopleFeatureTablesEnsured = false;
async function ensurePeopleFeatureTables() {
  if (peopleFeatureTablesEnsured || !prisma) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "person_text_uploads" (
      "id" SERIAL PRIMARY KEY,
      "person_id" INTEGER NOT NULL,
      "label" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "person_conversation_topics" (
      "id" SERIAL PRIMARY KEY,
      "person_id" INTEGER NOT NULL,
      "topic" TEXT NOT NULL,
      "used" BOOLEAN NOT NULL DEFAULT false,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "person_inside_jokes" (
      "id" SERIAL PRIMARY KEY,
      "person_id" INTEGER NOT NULL,
      "joke" TEXT NOT NULL,
      "context" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  peopleFeatureTablesEnsured = true;
}

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
      interests: parseJsonArrayOrWrap(p.interests),
      personality_traits: parseJsonArrayOrWrap(p.personalityTraits),
      conversation_style: p.conversationStyle,
      shared_experiences: parseJsonArrayOrWrap(p.sharedExperiences),
      story_preferences: parseJsonArrayOrWrap(p.storyPreferences),
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
      interests: parseJsonArrayOrWrap(person.interests),
      personality_traits: parseJsonArrayOrWrap(person.personalityTraits),
      conversation_style: person.conversationStyle,
      shared_experiences: parseJsonArrayOrWrap(person.sharedExperiences),
      story_preferences: parseJsonArrayOrWrap(person.storyPreferences),
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
        interests: JSON.stringify(parseJsonArrayOrWrap(interests)),
        personalityTraits: JSON.stringify(parseJsonArrayOrWrap(personality_traits)),
        conversationStyle: conversation_style || null,
        sharedExperiences: JSON.stringify(parseJsonArrayOrWrap(shared_experiences)),
        storyPreferences: JSON.stringify(parseJsonArrayOrWrap(story_preferences)),
        notes: notes || null
      }
    });
    const legacy = {
      id: person.id,
      user_id: person.userId,
      name: person.name,
      relationship: person.relationship,
      how_met: person.howMet,
      interests: parseJsonArrayOrWrap(person.interests),
      personality_traits: parseJsonArrayOrWrap(person.personalityTraits),
      conversation_style: person.conversationStyle,
      shared_experiences: parseJsonArrayOrWrap(person.sharedExperiences),
      story_preferences: parseJsonArrayOrWrap(person.storyPreferences),
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
        interests: JSON.stringify(parseJsonArrayOrWrap(interests)),
        personalityTraits: JSON.stringify(parseJsonArrayOrWrap(personality_traits)),
        conversationStyle: conversation_style || null,
        sharedExperiences: JSON.stringify(parseJsonArrayOrWrap(shared_experiences)),
        storyPreferences: JSON.stringify(parseJsonArrayOrWrap(story_preferences)),
        notes: notes || null
      }
    });
    const legacy = {
      id: person.id,
      user_id: person.userId,
      name: person.name,
      relationship: person.relationship,
      how_met: person.howMet,
      interests: parseJsonArrayOrWrap(person.interests),
      personality_traits: parseJsonArrayOrWrap(person.personalityTraits),
      conversation_style: person.conversationStyle,
      shared_experiences: parseJsonArrayOrWrap(person.sharedExperiences),
      story_preferences: parseJsonArrayOrWrap(person.storyPreferences),
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
      interests: parseJsonArrayOrWrap(person.interests),
      personality_traits: parseJsonArrayOrWrap(person.personalityTraits),
      shared_experiences: parseJsonArrayOrWrap(person.sharedExperiences),
      story_preferences: parseJsonArrayOrWrap(person.storyPreferences)
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
      interests: parseJsonArrayOrWrap(person.interests),
      personality_traits: parseJsonArrayOrWrap(person.personalityTraits),
      shared_experiences: parseJsonArrayOrWrap(person.sharedExperiences),
      story_preferences: parseJsonArrayOrWrap(person.storyPreferences),
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

    const currentInterests = parseJsonArrayOrWrap(person.interests);
    const currentTraits = parseJsonArrayOrWrap(person.personalityTraits);
    const currentPreferences = parseJsonArrayOrWrap(person.storyPreferences);

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

// --- Text message uploads ---

// List text uploads for a person
router.get('/:id/texts', authenticateToken, async (req, res) => {
  try {
    await ensurePeopleFeatureTables();
    const person = await prisma.person.findFirst({
      where: { id: Number(req.params.id), userId: req.user.userId }
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const uploads = await prisma.personTextUpload.findMany({
      where: { personId: person.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, label: true, createdAt: true, updatedAt: true }
    });
    res.json({ uploads });
  } catch (e) {
    console.error('List text uploads error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get a single text upload (with content)
router.get('/:id/texts/:textId', authenticateToken, async (req, res) => {
  try {
    await ensurePeopleFeatureTables();
    const person = await prisma.person.findFirst({
      where: { id: Number(req.params.id), userId: req.user.userId }
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const upload = await prisma.personTextUpload.findFirst({
      where: { id: Number(req.params.textId), personId: person.id }
    });
    if (!upload) return res.status(404).json({ error: 'Text upload not found' });

    res.json({ upload });
  } catch (e) {
    console.error('Get text upload error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create a text upload
router.post('/:id/texts', authenticateToken, async (req, res) => {
  const { label, content } = req.body;
  if (!label || !content) {
    return res.status(400).json({ error: 'Label and content are required' });
  }

  try {
    await ensurePeopleFeatureTables();
    const person = await prisma.person.findFirst({
      where: { id: Number(req.params.id), userId: req.user.userId }
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const upload = await prisma.personTextUpload.create({
      data: { personId: person.id, label, content }
    });
    res.status(201).json({ upload });
  } catch (e) {
    console.error('Create text upload error:', e);
    res.status(500).json({ error: 'Failed to save text upload' });
  }
});

// Update a text upload
router.put('/:id/texts/:textId', authenticateToken, async (req, res) => {
  const { label, content } = req.body;

  try {
    await ensurePeopleFeatureTables();
    const person = await prisma.person.findFirst({
      where: { id: Number(req.params.id), userId: req.user.userId }
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const existing = await prisma.personTextUpload.findFirst({
      where: { id: Number(req.params.textId), personId: person.id }
    });
    if (!existing) return res.status(404).json({ error: 'Text upload not found' });

    const upload = await prisma.personTextUpload.update({
      where: { id: existing.id },
      data: {
        ...(label !== undefined ? { label } : {}),
        ...(content !== undefined ? { content } : {})
      }
    });
    res.json({ upload });
  } catch (e) {
    console.error('Update text upload error:', e);
    res.status(500).json({ error: 'Failed to update text upload' });
  }
});

// Delete a text upload
router.delete('/:id/texts/:textId', authenticateToken, async (req, res) => {
  try {
    await ensurePeopleFeatureTables();
    const person = await prisma.person.findFirst({
      where: { id: Number(req.params.id), userId: req.user.userId }
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const existing = await prisma.personTextUpload.findFirst({
      where: { id: Number(req.params.textId), personId: person.id }
    });
    if (!existing) return res.status(404).json({ error: 'Text upload not found' });

    await prisma.personTextUpload.delete({ where: { id: existing.id } });
    res.json({ message: 'Text upload deleted' });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Text upload not found' });
    console.error('Delete text upload error:', e);
    res.status(500).json({ error: 'Failed to delete text upload' });
  }
});

// --- Conversation topics ---

// List topics for a person
router.get('/:id/topics', authenticateToken, async (req, res) => {
  try {
    await ensurePeopleFeatureTables();
    const person = await prisma.person.findFirst({
      where: { id: Number(req.params.id), userId: req.user.userId }
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const topics = await prisma.personConversationTopic.findMany({
      where: { personId: person.id },
      orderBy: [{ used: 'asc' }, { createdAt: 'desc' }]
    });
    res.json({ topics });
  } catch (e) {
    console.error('List topics error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create a topic
router.post('/:id/topics', authenticateToken, async (req, res) => {
  const { topic } = req.body;
  if (!topic || !topic.trim()) {
    return res.status(400).json({ error: 'Topic text is required' });
  }

  try {
    await ensurePeopleFeatureTables();
    const person = await prisma.person.findFirst({
      where: { id: Number(req.params.id), userId: req.user.userId }
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const created = await prisma.personConversationTopic.create({
      data: { personId: person.id, topic: topic.trim() }
    });
    res.status(201).json({ topic: created });
  } catch (e) {
    console.error('Create topic error:', e);
    res.status(500).json({ error: 'Failed to create topic' });
  }
});

// Update a topic (edit text or toggle used)
router.patch('/:id/topics/:topicId', authenticateToken, async (req, res) => {
  try {
    await ensurePeopleFeatureTables();
    const person = await prisma.person.findFirst({
      where: { id: Number(req.params.id), userId: req.user.userId }
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const existing = await prisma.personConversationTopic.findFirst({
      where: { id: Number(req.params.topicId), personId: person.id }
    });
    if (!existing) return res.status(404).json({ error: 'Topic not found' });

    const data = {};
    if (req.body.topic !== undefined) data.topic = req.body.topic.trim();
    if (req.body.used !== undefined) data.used = Boolean(req.body.used);

    const updated = await prisma.personConversationTopic.update({
      where: { id: existing.id },
      data
    });
    res.json({ topic: updated });
  } catch (e) {
    console.error('Update topic error:', e);
    res.status(500).json({ error: 'Failed to update topic' });
  }
});

// Delete a topic
router.delete('/:id/topics/:topicId', authenticateToken, async (req, res) => {
  try {
    await ensurePeopleFeatureTables();
    const person = await prisma.person.findFirst({
      where: { id: Number(req.params.id), userId: req.user.userId }
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const existing = await prisma.personConversationTopic.findFirst({
      where: { id: Number(req.params.topicId), personId: person.id }
    });
    if (!existing) return res.status(404).json({ error: 'Topic not found' });

    await prisma.personConversationTopic.delete({ where: { id: existing.id } });
    res.json({ message: 'Topic deleted' });
  } catch (e) {
    console.error('Delete topic error:', e);
    res.status(500).json({ error: 'Failed to delete topic' });
  }
});

// --- Inside jokes ---

router.get('/:id/inside-jokes', authenticateToken, async (req, res) => {
  try {
    await ensurePeopleFeatureTables();
    const person = await prisma.person.findFirst({
      where: { id: Number(req.params.id), userId: req.user.userId }
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const jokes = await prisma.personInsideJoke.findMany({
      where: { personId: person.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ jokes });
  } catch (e) {
    console.error('List inside jokes error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/:id/inside-jokes', authenticateToken, async (req, res) => {
  const { joke, context } = req.body;
  if (!joke || !joke.trim()) {
    return res.status(400).json({ error: 'Joke text is required' });
  }

  try {
    await ensurePeopleFeatureTables();
    const person = await prisma.person.findFirst({
      where: { id: Number(req.params.id), userId: req.user.userId }
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const created = await prisma.personInsideJoke.create({
      data: {
        personId: person.id,
        joke: joke.trim(),
        context: context?.trim() || null
      }
    });
    res.status(201).json({ joke: created });
  } catch (e) {
    console.error('Create inside joke error:', e);
    res.status(500).json({ error: 'Failed to create inside joke' });
  }
});

router.patch('/:id/inside-jokes/:jokeId', authenticateToken, async (req, res) => {
  try {
    await ensurePeopleFeatureTables();
    const person = await prisma.person.findFirst({
      where: { id: Number(req.params.id), userId: req.user.userId }
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const existing = await prisma.personInsideJoke.findFirst({
      where: { id: Number(req.params.jokeId), personId: person.id }
    });
    if (!existing) return res.status(404).json({ error: 'Inside joke not found' });

    const data = {};
    if (req.body.joke !== undefined) data.joke = req.body.joke.trim();
    if (req.body.context !== undefined) data.context = req.body.context?.trim() || null;

    const updated = await prisma.personInsideJoke.update({
      where: { id: existing.id },
      data
    });
    res.json({ joke: updated });
  } catch (e) {
    console.error('Update inside joke error:', e);
    res.status(500).json({ error: 'Failed to update inside joke' });
  }
});

router.delete('/:id/inside-jokes/:jokeId', authenticateToken, async (req, res) => {
  try {
    await ensurePeopleFeatureTables();
    const person = await prisma.person.findFirst({
      where: { id: Number(req.params.id), userId: req.user.userId }
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const existing = await prisma.personInsideJoke.findFirst({
      where: { id: Number(req.params.jokeId), personId: person.id }
    });
    if (!existing) return res.status(404).json({ error: 'Inside joke not found' });

    await prisma.personInsideJoke.delete({ where: { id: existing.id } });
    res.json({ message: 'Inside joke deleted' });
  } catch (e) {
    console.error('Delete inside joke error:', e);
    res.status(500).json({ error: 'Failed to delete inside joke' });
  }
});

module.exports = router;
