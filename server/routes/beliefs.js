const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getDatabase, ensureSqliteUser } = require('../database/init');

const router = express.Router();
const nowSql = () => "DATETIME('now')";

router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const uid = req.user.userId;
    ensureSqliteUser({ id: uid, email: req.user.email, name: req.user.email });

    const rows = db.prepare(
      `SELECT *
       FROM beliefs
       WHERE user_id = ?
       ORDER BY updated_at DESC, id DESC`
    ).all(uid);

    return res.json({ beliefs: rows });
  } catch (e) {
    console.error('Beliefs list error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const uid = req.user.userId;
    ensureSqliteUser({ id: uid, email: req.user.email, name: req.user.email });

    const current_belief = (req.body?.current_belief || '').toString().trim();
    const desired_belief = (req.body?.desired_belief || '').toString().trim();
    const change_plan = (req.body?.change_plan || '').toString().trim();

    if (!current_belief) return res.status(400).json({ error: 'current_belief is required' });
    if (!desired_belief) return res.status(400).json({ error: 'desired_belief is required' });

    const info = db.prepare(
      `INSERT INTO beliefs (user_id, current_belief, desired_belief, change_plan, created_at, updated_at)
       VALUES (?, ?, ?, ?, ${nowSql()}, ${nowSql()})`
    ).run(uid, current_belief, desired_belief, change_plan || null);

    const row = db.prepare('SELECT * FROM beliefs WHERE id = ? AND user_id = ?').get(info.lastInsertRowid, uid);
    return res.status(201).json({ belief: row });
  } catch (e) {
    console.error('Beliefs create error:', e);
    return res.status(500).json({ error: 'Failed to create belief' });
  }
});

router.patch('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const uid = req.user.userId;
    ensureSqliteUser({ id: uid, email: req.user.email, name: req.user.email });

    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM beliefs WHERE id = ? AND user_id = ?').get(id, uid);
    if (!existing) return res.status(404).json({ error: 'Belief not found' });

    const current_belief = (req.body?.current_belief ?? existing.current_belief).toString().trim();
    const desired_belief = (req.body?.desired_belief ?? existing.desired_belief).toString().trim();
    const change_plan = (req.body?.change_plan ?? existing.change_plan ?? '').toString().trim();

    if (!current_belief) return res.status(400).json({ error: 'current_belief is required' });
    if (!desired_belief) return res.status(400).json({ error: 'desired_belief is required' });

    db.prepare(
      `UPDATE beliefs
       SET current_belief = ?, desired_belief = ?, change_plan = ?, updated_at = ${nowSql()}
       WHERE id = ? AND user_id = ?`
    ).run(current_belief, desired_belief, change_plan || null, id, uid);

    const row = db.prepare('SELECT * FROM beliefs WHERE id = ? AND user_id = ?').get(id, uid);
    return res.json({ belief: row });
  } catch (e) {
    console.error('Beliefs update error:', e);
    return res.status(500).json({ error: 'Failed to update belief' });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const uid = req.user.userId;
    ensureSqliteUser({ id: uid, email: req.user.email, name: req.user.email });

    const id = Number(req.params.id);
    const info = db.prepare('DELETE FROM beliefs WHERE id = ? AND user_id = ?').run(id, uid);
    if (!info.changes) return res.status(404).json({ error: 'Belief not found' });
    return res.json({ status: 'deleted' });
  } catch (e) {
    console.error('Beliefs delete error:', e);
    return res.status(500).json({ error: 'Failed to delete belief' });
  }
});

module.exports = router;

