const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        area TEXT, -- health, social, work, learning, etc.
        target_date DATE,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.warn('Ensure goals table failed:', e?.message);
  }
  ensured = true;
}

router.get('/', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM goals WHERE user_id=$1 ORDER BY created_at DESC`, req.user.userId);
    res.json({ goals: rows });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  await ensureTables();
  const { title, description = '', area = null, target_date = null } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO goals (user_id, title, description, area, target_date) VALUES ($1,$2,$3,$4,$5)`,
      req.user.userId, title, description, area, target_date
    );
    res.status(201).json({ message: 'Created' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

router.patch('/:id', authenticateToken, async (req, res) => {
  await ensureTables();
  const { id } = req.params;
  const { title, description, area, target_date, status } = req.body;
  const fields = [];
  const params = [];
  function add(field, val) { if (val !== undefined) { fields.push(`${field}=$${fields.length+1}`); params.push(val); } }
  add('title', title);
  add('description', description);
  add('area', area);
  add('target_date', target_date);
  add('status', status);
  if (!fields.length) return res.status(400).json({ error: 'no updates' });
  params.push(req.user.userId, Number(id));
  try {
    await prisma.$executeRawUnsafe(`UPDATE goals SET ${fields.join(', ')}, updated_at=NOW() WHERE user_id=$${fields.length+1} AND id=$${fields.length+2}`, ...params);
    res.json({ message: 'Updated' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  await ensureTables();
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM goals WHERE user_id=$1 AND id=$2`, req.user.userId, Number(req.params.id));
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

module.exports = router;


