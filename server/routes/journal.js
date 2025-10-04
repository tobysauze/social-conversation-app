const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all journal entries for a user
router.get('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  db.all(
    `SELECT id, content, mood, tags, created_at, updated_at 
     FROM journal_entries 
     WHERE user_id = ? 
     ORDER BY created_at DESC 
     LIMIT ? OFFSET ?`,
    [req.user.userId, limit, offset],
    (err, entries) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ entries });
    }
  );
});

// Get a specific journal entry
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { id } = req.params;

  db.get(
    'SELECT * FROM journal_entries WHERE id = ? AND user_id = ?',
    [id, req.user.userId],
    (err, entry) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!entry) {
        return res.status(404).json({ error: 'Journal entry not found' });
      }

      res.json({ entry });
    }
  );
});

// Create a new journal entry
router.post('/', authenticateToken, (req, res) => {
  const { content, mood, tags } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const db = getDatabase();
  const tagsString = tags ? JSON.stringify(tags) : null;

  db.run(
    'INSERT INTO journal_entries (user_id, content, mood, tags) VALUES (?, ?, ?, ?)',
    [req.user.userId, content.trim(), mood, tagsString],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create journal entry' });
      }

      // Return the created entry
      db.get(
        'SELECT * FROM journal_entries WHERE id = ?',
        [this.lastID],
        (err, entry) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to retrieve created entry' });
          }
          res.status(201).json({ entry });
        }
      );
    }
  );
});

// Update a journal entry
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { content, mood, tags } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const db = getDatabase();
  const tagsString = tags ? JSON.stringify(tags) : null;

  db.run(
    `UPDATE journal_entries 
     SET content = ?, mood = ?, tags = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ? AND user_id = ?`,
    [content.trim(), mood, tagsString, id, req.user.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update journal entry' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Journal entry not found' });
      }

      // Return the updated entry
      db.get(
        'SELECT * FROM journal_entries WHERE id = ?',
        [id],
        (err, entry) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to retrieve updated entry' });
          }
          res.json({ entry });
        }
      );
    }
  );
});

// Delete a journal entry
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDatabase();

  db.run(
    'DELETE FROM journal_entries WHERE id = ? AND user_id = ?',
    [id, req.user.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete journal entry' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Journal entry not found' });
      }

      res.json({ message: 'Journal entry deleted successfully' });
    }
  );
});

// Get journal entries by date range
router.get('/date-range/:start/:end', authenticateToken, (req, res) => {
  const { start, end } = req.params;
  const db = getDatabase();

  db.all(
    `SELECT id, content, mood, tags, created_at 
     FROM journal_entries 
     WHERE user_id = ? AND date(created_at) BETWEEN ? AND ? 
     ORDER BY created_at DESC`,
    [req.user.userId, start, end],
    (err, entries) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ entries });
    }
  );
});

module.exports = router;

