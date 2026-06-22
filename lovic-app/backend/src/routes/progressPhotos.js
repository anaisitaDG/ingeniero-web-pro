const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const path    = require('path');
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const multer  = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOAD_PATH || 'uploads/'),
  filename:    (req, file, cb) => cb(null, `progress_${Date.now()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo imágenes'));
  },
});

router.use(requireAuth);

// POST /progress-photos/upload
router.post('/upload', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Foto requerida' });

  const note = req.body.note || '';
  await db.query(
    'INSERT INTO progress_photos (id, user_id, image_url, note) VALUES (?, ?, ?, ?)',
    [uuidv4(), req.user.id, req.file.path, note]
  );

  res.json({ message: 'Foto guardada', path: req.file.path });
});

// GET /progress-photos
router.get('/', async (req, res) => {
  const [rows] = await db.query(
    'SELECT * FROM progress_photos WHERE user_id=? ORDER BY taken_at DESC LIMIT 20',
    [req.user.id]
  );
  res.json({ photos: rows });
});

// DELETE /progress-photos/:id
router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM progress_photos WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  res.json({ message: 'Foto eliminada' });
});

module.exports = router;
