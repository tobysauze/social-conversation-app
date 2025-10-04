const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const { practiceFeedback } = require('../services/openai');

const router = express.Router();

// Get practice sessions for a user
router.get('/sessions', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  db.all(
    `SELECT ps.*, s.title as story_title 
     FROM practice_sessions ps 
     LEFT JOIN stories s ON ps.story_id = s.id 
     WHERE ps.user_id = ? 
     ORDER BY ps.created_at DESC 
     LIMIT ? OFFSET ?`,
    [req.user.userId, limit, offset],
    (err, sessions) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ sessions });
    }
  );
});

// Start a practice session
router.post('/sessions', authenticateToken, async (req, res) => {
  try {
    const { story_id, session_type = 'storytelling' } = req.body;
    const db = getDatabase();

    // Verify story belongs to user
    if (story_id) {
      db.get(
        'SELECT id FROM stories WHERE id = ? AND user_id = ?',
        [story_id, req.user.userId],
        (err, story) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          if (!story) {
            return res.status(404).json({ error: 'Story not found' });
          }

          // Create practice session
          db.run(
            'INSERT INTO practice_sessions (user_id, story_id, session_type) VALUES (?, ?, ?)',
            [req.user.userId, story_id, session_type],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Failed to create practice session' });
              }

              res.status(201).json({ 
                session_id: this.lastID,
                message: 'Practice session started'
              });
            }
          );
        }
      );
    } else {
      // Create practice session without story
      db.run(
        'INSERT INTO practice_sessions (user_id, session_type) VALUES (?, ?)',
        [req.user.userId, session_type],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to create practice session' });
          }

          res.status(201).json({ 
            session_id: this.lastID,
            message: 'Practice session started'
          });
        }
      );
    }
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
      // Get feedback from OpenAI
      const feedback = await practiceFeedback(story_content, user_delivery);
      
      // Save feedback to database if session_id provided
      if (session_id) {
        const db = getDatabase();
        db.run(
          `UPDATE practice_sessions 
           SET feedback = ?, rating = ? 
           WHERE id = ? AND user_id = ?`,
          [feedback.feedback, feedback.rating, session_id, req.user.userId],
          (err) => {
            if (err) {
              console.error('Failed to save feedback:', err);
            }
          }
        );
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
router.get('/conversation-starters', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { story_id } = req.query;

  let query = `
    SELECT cs.*, s.title as story_title 
    FROM conversation_starters cs 
    LEFT JOIN stories s ON cs.story_id = s.id 
    WHERE cs.user_id = ?
  `;
  const params = [req.user.userId];

  if (story_id) {
    query += ' AND cs.story_id = ?';
    params.push(story_id);
  }

  query += ' ORDER BY cs.created_at DESC';

  db.all(query, params, (err, starters) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ conversation_starters: starters });
  });
});

// Get practice statistics
router.get('/stats', authenticateToken, (req, res) => {
  const db = getDatabase();

  // Get various practice statistics
  const queries = {
    totalSessions: 'SELECT COUNT(*) as count FROM practice_sessions WHERE user_id = ?',
    avgRating: 'SELECT AVG(rating) as avg FROM practice_sessions WHERE user_id = ? AND rating IS NOT NULL',
    storiesPracticed: 'SELECT COUNT(DISTINCT story_id) as count FROM practice_sessions WHERE user_id = ? AND story_id IS NOT NULL',
    recentSessions: `SELECT COUNT(*) as count FROM practice_sessions 
                     WHERE user_id = ? AND created_at >= datetime('now', '-7 days')`
  };

  const stats = {};
  let completedQueries = 0;
  const totalQueries = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, query]) => {
    db.get(query, [req.user.userId], (err, result) => {
      if (err) {
        console.error(`Error getting ${key}:`, err);
        stats[key] = 0;
      } else {
        stats[key] = result.count || result.avg || 0;
      }

      completedQueries++;
      if (completedQueries === totalQueries) {
        res.json({ stats });
      }
    });
  });
});

// Get a specific practice session
router.get('/sessions/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDatabase();

  db.get(
    `SELECT ps.*, s.title as story_title, s.content as story_content 
     FROM practice_sessions ps 
     LEFT JOIN stories s ON ps.story_id = s.id 
     WHERE ps.id = ? AND ps.user_id = ?`,
    [id, req.user.userId],
    (err, session) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!session) {
        return res.status(404).json({ error: 'Practice session not found' });
      }

      res.json({ session });
    }
  );
});

module.exports = router;

