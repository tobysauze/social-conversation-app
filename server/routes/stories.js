const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const { extractStories, refineStory, generateConversationStarters } = require('../services/openai');

const router = express.Router();

// Get all stories for a user
router.get('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { page = 1, limit = 20, tone } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT s.*, je.content as journal_content 
    FROM stories s 
    LEFT JOIN journal_entries je ON s.journal_entry_id = je.id 
    WHERE s.user_id = ?
  `;
  const params = [req.user.userId];

  if (tone) {
    query += ' AND s.tone = ?';
    params.push(tone);
  }

  query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  db.all(query, params, (err, stories) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ stories });
  });
});

// Get a specific story
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  db.get(
    `SELECT s.*, je.content as journal_content 
     FROM stories s 
     LEFT JOIN journal_entries je ON s.journal_entry_id = je.id 
     WHERE s.id = ? AND s.user_id = ?`,
    [id, req.user.userId],
    (err, story) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!story) {
        return res.status(404).json({ error: 'Story not found' });
      }

      res.json({ story });
    }
  );
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

    const db = getDatabase();
    const tagsString = tags ? JSON.stringify(tags) : null;

    db.run(
      `INSERT INTO stories (user_id, journal_entry_id, title, content, tone, duration_seconds, tags) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.userId, journal_entry_id, title, content, tone, duration_seconds, tagsString],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to create story' });
        }

        // Return the created story
        db.get(
          'SELECT * FROM stories WHERE id = ?',
          [this.lastID],
          (err, story) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to retrieve created story' });
            }
            res.status(201).json({ story });
          }
        );
      }
    );
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refine a story
router.post('/:id/refine', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tone = 'casual', duration = 30 } = req.body;
    const db = getDatabase();

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
          // Refine the story using OpenAI
          const refinedContent = await refineStory(story.content, tone, duration);
          
          // Update the story in database
          db.run(
            `UPDATE stories 
             SET content = ?, tone = ?, duration_seconds = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [refinedContent, tone, duration, id],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Failed to update story' });
              }

              // Return the updated story
              db.get(
                'SELECT * FROM stories WHERE id = ?',
                [id],
                (err, updatedStory) => {
                  if (err) {
                    return res.status(500).json({ error: 'Failed to retrieve updated story' });
                  }
                  res.json({ story: updatedStory });
                }
              );
            }
          );
        } catch (error) {
          console.error('Story refinement error:', error);
          res.status(500).json({ error: 'Failed to refine story' });
        }
      }
    );
  } catch (error) {
    console.error('Refine story error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate conversation starters for a story
router.get('/:id/conversation-starters', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

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
          // Generate conversation starters using OpenAI
          const starters = await generateConversationStarters(story.content);
          
          // Save conversation starters to database
          const insertPromises = starters.questions.map(question => {
            return new Promise((resolve, reject) => {
              db.run(
                'INSERT INTO conversation_starters (user_id, story_id, question) VALUES (?, ?, ?)',
                [req.user.userId, id, question],
                function(err) {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
          });

          await Promise.all(insertPromises);
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
router.patch('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { times_told, success_rating } = req.body;
  const db = getDatabase();

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
  params.push(id, req.user.userId);

  db.run(
    `UPDATE stories SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
    params,
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update story' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Story not found' });
      }

      res.json({ message: 'Story updated successfully' });
    }
  );
});

// Delete a story
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDatabase();

  db.run(
    'DELETE FROM stories WHERE id = ? AND user_id = ?',
    [id, req.user.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete story' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Story not found' });
      }

      res.json({ message: 'Story deleted successfully' });
    }
  );
});

module.exports = router;

