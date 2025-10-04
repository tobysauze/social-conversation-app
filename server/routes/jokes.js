const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const { generateJoke, iterateJoke } = require('../services/openai');

const router = express.Router();

// Get all jokes for a user
router.get('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  db.all(
    `SELECT * FROM jokes 
     WHERE user_id = ? 
     ORDER BY created_at DESC 
     LIMIT ? OFFSET ?`,
    [req.user.userId, limit, offset],
    (err, jokes) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({ jokes });
    }
  );
});

// Get a specific joke
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  db.get(
    'SELECT * FROM jokes WHERE id = ? AND user_id = ?',
    [id, req.user.userId],
    (err, joke) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!joke) {
        return res.status(404).json({ error: 'Joke not found' });
      }

      res.json({ joke });
    }
  );
});

// Create a new joke
router.post('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { title, content, category, difficulty, notes } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  db.run(
    `INSERT INTO jokes (user_id, title, content, category, difficulty, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.user.userId, title, content, category || null, difficulty || null, notes || null],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.status(201).json({ 
        message: 'Joke created successfully',
        joke: { id: this.lastID, title, content, category, difficulty, notes }
      });
    }
  );
});

// Update a joke
router.put('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { id } = req.params;
  const { title, content, category, difficulty, notes, times_told, success_rating } = req.body;

  db.run(
    `UPDATE jokes 
     SET title = ?, content = ?, category = ?, difficulty = ?, notes = ?, 
         times_told = ?, success_rating = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
    [title, content, category, difficulty, notes, times_told, success_rating, id, req.user.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Joke not found' });
      }

      res.json({ message: 'Joke updated successfully' });
    }
  );
});

// Delete a joke
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  db.run(
    'DELETE FROM jokes WHERE id = ? AND user_id = ?',
    [id, req.user.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Joke not found' });
      }

      res.json({ message: 'Joke deleted successfully' });
    }
  );
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
      const db = getDatabase();
      const person = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM people WHERE id = ? AND user_id = ?',
          [personId, req.user.userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

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
  const db = getDatabase();
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
  const db = getDatabase();
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
router.get('/person/:personId', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { personId } = req.params;

  db.all(
    `SELECT j.* FROM jokes j
     INNER JOIN joke_people jp ON j.id = jp.joke_id
     WHERE jp.person_id = ? AND j.user_id = ?
     ORDER BY j.created_at DESC`,
    [personId, req.user.userId],
    (err, jokes) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({ jokes });
    }
  );
});

// POST /api/jokes/:jokeId/iterate - Iterate a joke with AI
router.post('/:jokeId/iterate', authenticateToken, async (req, res) => {
  const { jokeId } = req.params;
  const { conversationHistory = [] } = req.body;
  const db = getDatabase();

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
