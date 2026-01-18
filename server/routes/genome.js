const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { getDatabase, ensureSqliteUser } = require('../database/init');

const router = express.Router();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getUploadDir() {
  // Prefer persistent disk if available (Render mounts /data)
  const base = process.env.UPLOAD_DIR || process.env.DATABASE_DIR || (process.env.RENDER ? '/data' : null);
  const dir = base ? path.join(base, 'genome_uploads') : path.join(__dirname, '..', 'uploads', 'genome');
  ensureDir(dir);
  return dir;
}

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, getUploadDir());
  },
  filename: function (_req, file, cb) {
    const ts = Date.now();
    const safeOriginal = (file.originalname || 'upload')
      .toString()
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);
    cb(null, `${ts}-${Math.random().toString(16).slice(2)}-${safeOriginal}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// List uploads
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const rows = db.prepare(
      `SELECT id, original_name, mime_type, size_bytes, created_at
       FROM genome_uploads
       WHERE user_id = ?
       ORDER BY created_at DESC`
    ).all(req.user.userId);
    return res.json({ uploads: rows });
  } catch (e) {
    console.error('Genome list error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Upload a file
router.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const db = getDatabase();
    ensureSqliteUser({ id: req.user.userId, email: req.user.email, name: req.user.email });
    const info = db.prepare(
      `INSERT INTO genome_uploads (user_id, original_name, stored_name, mime_type, size_bytes)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      req.user.userId,
      req.file.originalname,
      req.file.filename,
      req.file.mimetype || null,
      req.file.size || null
    );
    return res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    console.error('Genome upload error:', e);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

// Download a file
router.get('/:id/download', authenticateToken, (req, res) => {
  try {
    const id = Number(req.params.id);
    const db = getDatabase();
    const row = db.prepare(
      `SELECT id, original_name, stored_name
       FROM genome_uploads
       WHERE id = ? AND user_id = ?`
    ).get(id, req.user.userId);
    if (!row) return res.status(404).json({ error: 'Not found' });

    const fullPath = path.join(getUploadDir(), row.stored_name);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File missing on server' });

    return res.download(fullPath, row.original_name);
  } catch (e) {
    console.error('Genome download error:', e);
    return res.status(500).json({ error: 'Download failed' });
  }
});

// Delete a file
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const id = Number(req.params.id);
    const db = getDatabase();
    const row = db.prepare(
      `SELECT stored_name
       FROM genome_uploads
       WHERE id = ? AND user_id = ?`
    ).get(id, req.user.userId);
    if (!row) return res.status(404).json({ error: 'Not found' });

    db.prepare(`DELETE FROM genome_uploads WHERE id = ? AND user_id = ?`).run(id, req.user.userId);

    // best-effort delete file
    try {
      const fullPath = path.join(getUploadDir(), row.stored_name);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (_) {}

    return res.json({ status: 'deleted' });
  } catch (e) {
    console.error('Genome delete error:', e);
    return res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;

