const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { prisma } = require('../prisma/client');

const router = express.Router();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getUploadDir() {
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

router.get('/', authenticateToken, async (req, res) => {
  try {
    const uploads = await prisma.genomeUpload.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true }
    });
    const legacy = uploads.map((u) => ({
      id: u.id,
      original_name: u.originalName,
      mime_type: u.mimeType,
      size_bytes: u.sizeBytes,
      created_at: u.createdAt
    }));
    return res.json({ uploads: legacy });
  } catch (e) {
    console.error('Genome list error:', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const uploadRecord = await prisma.genomeUpload.create({
      data: {
        userId: req.user.userId,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype || null,
        sizeBytes: req.file.size || null
      }
    });
    return res.status(201).json({ id: uploadRecord.id });
  } catch (e) {
    console.error('Genome upload error:', e);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const row = await prisma.genomeUpload.findFirst({
      where: { id, userId: req.user.userId }
    });
    if (!row) return res.status(404).json({ error: 'Not found' });

    const fullPath = path.join(getUploadDir(), row.storedName);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File missing on server' });

    return res.download(fullPath, row.originalName);
  } catch (e) {
    console.error('Genome download error:', e);
    return res.status(500).json({ error: 'Download failed' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const row = await prisma.genomeUpload.findFirst({
      where: { id, userId: req.user.userId }
    });
    if (!row) return res.status(404).json({ error: 'Not found' });

    await prisma.genomeUpload.delete({ where: { id } });

    try {
      const fullPath = path.join(getUploadDir(), row.storedName);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (_) {}

    return res.json({ status: 'deleted' });
  } catch (e) {
    console.error('Genome delete error:', e);
    return res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
