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
       FROM anxiety_triggers
       WHERE user_id = ?
       ORDER BY updated_at DESC, id DESC`
    ).all(uid);

    return res.json({ triggers: rows });
  } catch (e) {
    console.error('Triggers list error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const uid = req.user.userId;
    ensureSqliteUser({ id: uid, email: req.user.email, name: req.user.email });

    const {
      title,
      category = null,
      intensity = null,
      notes = null
    } = req.body || {};

    const t = (title || '').toString().trim();
    if (!t) return res.status(400).json({ error: 'title is required' });

    const intVal = intensity === null || intensity === undefined || intensity === '' ? null : Number(intensity);
    if (intVal !== null && (!Number.isFinite(intVal) || intVal < 1 || intVal > 10)) {
      return res.status(400).json({ error: 'intensity must be 1-10' });
    }

    const info = db.prepare(
      `INSERT INTO anxiety_triggers (user_id, title, category, intensity, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ${nowSql()}, ${nowSql()})`
    ).run(uid, t, category || null, intVal, notes || null);

    const row = db.prepare('SELECT * FROM anxiety_triggers WHERE id = ? AND user_id = ?').get(info.lastInsertRowid, uid);
    return res.status(201).json({ trigger: row });
  } catch (e) {
    console.error('Triggers create error:', e);
    return res.status(500).json({ error: 'Failed to create trigger' });
  }
});

router.patch('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const uid = req.user.userId;
    ensureSqliteUser({ id: uid, email: req.user.email, name: req.user.email });

    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM anxiety_triggers WHERE id = ? AND user_id = ?').get(id, uid);
    if (!existing) return res.status(404).json({ error: 'Trigger not found' });

    const {
      title = existing.title,
      category = existing.category,
      intensity = existing.intensity,
      notes = existing.notes
    } = req.body || {};

    const t = (title || '').toString().trim();
    if (!t) return res.status(400).json({ error: 'title is required' });

    const intVal = intensity === null || intensity === undefined || intensity === '' ? null : Number(intensity);
    if (intVal !== null && (!Number.isFinite(intVal) || intVal < 1 || intVal > 10)) {
      return res.status(400).json({ error: 'intensity must be 1-10' });
    }

    db.prepare(
      `UPDATE anxiety_triggers
       SET title = ?, category = ?, intensity = ?, notes = ?, updated_at = ${nowSql()}
       WHERE id = ? AND user_id = ?`
    ).run(t, category || null, intVal, notes || null, id, uid);

    const row = db.prepare('SELECT * FROM anxiety_triggers WHERE id = ? AND user_id = ?').get(id, uid);
    return res.json({ trigger: row });
  } catch (e) {
    console.error('Triggers update error:', e);
    return res.status(500).json({ error: 'Failed to update trigger' });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const uid = req.user.userId;
    ensureSqliteUser({ id: uid, email: req.user.email, name: req.user.email });

    const id = Number(req.params.id);
    const info = db.prepare('DELETE FROM anxiety_triggers WHERE id = ? AND user_id = ?').run(id, uid);
    if (!info.changes) return res.status(404).json({ error: 'Trigger not found' });
    return res.json({ status: 'deleted' });
  } catch (e) {
    console.error('Triggers delete error:', e);
    return res.status(500).json({ error: 'Failed to delete trigger' });
  }
});

module.exports = router;

