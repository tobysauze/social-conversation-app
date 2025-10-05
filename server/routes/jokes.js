const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { generateJoke, iterateJoke } = require('../services/openai');

const router = express.Router();

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
    res.json({ jokes });
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
    res.json({ joke });
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
    res.status(201).json({ message: 'Joke created successfully', joke });
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
router.post('/:id/tag-person/:personId', authenticateToken, (req, res) => {
  const db = null;
  const { id, personId } = req.params;

  db.run(
    'INSERT INTO joke_people (joke_id, person_id) VALUES (?, ?)',
    [id, personId],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(400).json({ error: 'Joke is already tagged to this person' });
        }
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ message: 'Joke tagged to person successfully' });
    }
  );
});

// Untag a joke from a person
router.delete('/:id/tag-person/:personId', authenticateToken, (req, res) => {
  const db = null;
  const { id, personId } = req.params;

  db.run(
    'DELETE FROM joke_people WHERE joke_id = ? AND person_id = ?',
    [id, personId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ message: 'Joke untagged from person successfully' });
    }
  );
});

// Get jokes for a specific person
router.get('/person/:personId', authenticateToken, async (req, res) => {
  const { personId } = req.params;
  try {
    const tagged = await prisma.joke.findMany({
      where: { userId: req.user.userId, /* future: join table if needed */ },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ jokes: tagged });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/jokes/:jokeId/iterate - Iterate a joke with AI
router.post('/:jokeId/iterate', authenticateToken, async (req, res) => {
  const { jokeId } = req.params;
  const { conversationHistory = [] } = req.body;
  const db = null;

  try {
    // Get the joke
    const joke = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM jokes WHERE id = ? AND user_id = ?', [jokeId, req.user.userId], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

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

module.exports = router;
