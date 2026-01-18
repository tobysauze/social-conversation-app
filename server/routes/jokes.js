const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { generateJoke, iterateJoke, categorizeJoke } = require('../services/openai');

const router = express.Router();

// Minimal join table support for Postgres without Prisma schema migration
let ensuredJokePeople = false;
async function ensureJokePeopleTable() {
  if (ensuredJokePeople) return;
  try {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS joke_people (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        joke_id INTEGER NOT NULL,
        person_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (joke_id, person_id)
      )`
    );
  } catch (e) {
    console.warn('Could not ensure joke_people table exists:', e?.message);
  }
  ensuredJokePeople = true;
}

// Get all jokes for a user
router.get('/', authenticateToken, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  try {
    const jokes = await prisma.joke.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    });
    const legacy = jokes.map(j => ({
      id: j.id,
      user_id: j.userId,
      title: j.title,
      content: j.content,
      category: j.category,
      difficulty: j.difficulty,
      times_told: j.timesTold,
      success_rating: j.successRating,
      notes: j.notes,
      created_at: j.createdAt,
      updated_at: j.updatedAt
    }));
    res.json({ jokes: legacy });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get a specific joke
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const joke = await prisma.joke.findFirst({ where: { id: Number(id), userId: req.user.userId } });
    if (!joke) return res.status(404).json({ error: 'Joke not found' });
    const legacy = {
      id: joke.id,
      user_id: joke.userId,
      title: joke.title,
      content: joke.content,
      category: joke.category,
      difficulty: joke.difficulty,
      times_told: joke.timesTold,
      success_rating: joke.successRating,
      notes: joke.notes,
      created_at: joke.createdAt,
      updated_at: joke.updatedAt
    };
    res.json({ joke: legacy });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Create a new joke
router.post('/', authenticateToken, async (req, res) => {
  const { title, content, category, difficulty, notes } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  try {
    const joke = await prisma.joke.create({
      data: {
        userId: req.user.userId,
        title,
        content,
        category: category || null,
        difficulty: difficulty || null,
        notes: notes || null
      }
    });
    const legacy = {
      id: joke.id,
      user_id: joke.userId,
      title: joke.title,
      content: joke.content,
      category: joke.category,
      difficulty: joke.difficulty,
      times_told: joke.timesTold,
      success_rating: joke.successRating,
      notes: joke.notes,
      created_at: joke.createdAt,
      updated_at: joke.updatedAt
    };
    res.status(201).json({ message: 'Joke created successfully', joke: legacy });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Update a joke
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, content, category, difficulty, notes, times_told, success_rating } = req.body;
  try {
    await prisma.joke.update({
      where: { id: Number(id) },
      data: {
        title,
        content,
        category: category || null,
        difficulty: difficulty || null,
        notes: notes || null,
        timesTold: times_told ?? undefined,
        successRating: success_rating ?? undefined
      }
    });
    res.json({ message: 'Joke updated successfully' });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Joke not found' });
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete a joke
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.joke.delete({ where: { id: Number(id) } });
    res.json({ message: 'Joke deleted successfully' });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Joke not found' });
    res.status(500).json({ error: 'Database error' });
  }
});

// Generate a joke using AI
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { prompt, category, difficulty, personId } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Get person info if personId is provided
    let personInfo = null;
    if (personId) {
      const person = await prisma.person.findFirst({ where: { id: Number(personId), userId: req.user.userId } });

      if (person) {
        personInfo = {
          name: person.name,
          interests: person.interests ? JSON.parse(person.interests) : [],
          personality_traits: person.personality_traits ? JSON.parse(person.personality_traits) : [],
          conversation_style: person.conversation_style
        };
      }
    }

    const joke = await generateJoke(prompt, category, difficulty, personInfo);
    res.json({ joke });
  } catch (error) {
    console.error('Error generating joke:', error);
    res.status(500).json({ error: 'Failed to generate joke' });
  }
});

// Tag a joke to a person
router.post('/:id/tag-person/:personId', authenticateToken, async (req, res) => {
  const { id, personId } = req.params;
  try {
    await ensureJokePeopleTable();
    await prisma.$executeRawUnsafe(
      `INSERT INTO joke_people (user_id, joke_id, person_id) VALUES ($1, $2, $3)
       ON CONFLICT (joke_id, person_id) DO NOTHING`,
      req.user.userId,
      Number(id),
      Number(personId)
    );
    res.json({ message: 'Joke tagged to person successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Untag a joke from a person
router.delete('/:id/tag-person/:personId', authenticateToken, async (req, res) => {
  const { id, personId } = req.params;
  try {
    await ensureJokePeopleTable();
    await prisma.$executeRawUnsafe(
      `DELETE FROM joke_people WHERE user_id=$1 AND joke_id=$2 AND person_id=$3`,
      req.user.userId,
      Number(id),
      Number(personId)
    );
    res.json({ message: 'Joke untagged from person successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get jokes for a specific person
router.get('/person/:personId', authenticateToken, async (req, res) => {
  const { personId } = req.params;
  try {
    await ensureJokePeopleTable();
    const rows = await prisma.$queryRawUnsafe(
      `SELECT joke_id FROM joke_people WHERE user_id=$1 AND person_id=$2`,
      req.user.userId,
      Number(personId)
    );
    const jokeIds = rows.map(r => Number(r.joke_id));
    if (jokeIds.length === 0) return res.json({ jokes: [] });

    const tagged = await prisma.joke.findMany({
      where: { userId: req.user.userId, id: { in: jokeIds } },
      orderBy: { createdAt: 'desc' }
    });
    const legacy = tagged.map(j => ({
      id: j.id,
      user_id: j.userId,
      title: j.title,
      content: j.content,
      category: j.category,
      difficulty: j.difficulty,
      times_told: j.timesTold,
      success_rating: j.successRating,
      notes: j.notes,
      created_at: j.createdAt,
      updated_at: j.updatedAt
    }));
    res.json({ jokes: legacy });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/jokes/:jokeId/iterate - Iterate a joke with AI
router.post('/:jokeId/iterate', authenticateToken, async (req, res) => {
  const { jokeId } = req.params;
  const { conversationHistory = [] } = req.body;

  try {
    // Get the joke (Prisma first, fallback to SQLite)
    let joke = null;
    try {
      joke = await prisma.joke.findFirst({
        where: { id: Number(jokeId), userId: req.user.userId },
        select: { title: true, content: true, category: true, difficulty: true }
      });
    } catch (e) {
      // ignore, fall back below
    }

    if (!joke) {
      const db = getDatabase();
      joke = db
        .prepare('SELECT title, content, category, difficulty FROM jokes WHERE id = ? AND user_id = ?')
        .get(Number(jokeId), req.user.userId);
    }

    if (!joke) {
      return res.status(404).json({ error: 'Joke not found' });
    }

    // Get AI iteration
    const iteration = await iterateJoke(joke, conversationHistory);

    res.json(iteration);
  } catch (error) {
    console.error('Error iterating joke:', error);
    res.status(500).json({ error: error.message });
  }
});

// Auto-categorize a joke using AI and persist primary category + taxonomy metadata (notes)
router.post('/:id/categorize', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const joke = await prisma.joke.findFirst({ where: { id: Number(id), userId: req.user.userId } });
    if (!joke) return res.status(404).json({ error: 'Joke not found' });

    const classification = await categorizeJoke(joke.content);

    // Persist the primary category; append taxonomy info to notes for now
    const newNotes = (() => {
      const info = `Taxonomy: ${classification.taxonomy_matches?.join(', ') || '—'} | Theories: ${classification.comedy_theories?.join(', ') || '—'}`;
      if (!joke.notes) return info;
      // Avoid duplicating if already present
      return joke.notes.includes('Taxonomy:') ? joke.notes : `${joke.notes}\n${info}`;
    })();

    const updated = await prisma.joke.update({
      where: { id: Number(id) },
      data: { category: classification.primary_category, notes: newNotes }
    });

    return res.json({
      message: 'Joke categorized',
      category: classification.primary_category,
      taxonomy_matches: classification.taxonomy_matches,
      comedy_theories: classification.comedy_theories,
      joke: {
        id: updated.id,
        title: updated.title,
        content: updated.content,
        category: updated.category,
        difficulty: updated.difficulty,
        notes: updated.notes
      }
    });
  } catch (e) {
    console.error('Error categorizing joke:', e);
    res.status(500).json({ error: 'Failed to categorize joke' });
  }
});

module.exports = router;
