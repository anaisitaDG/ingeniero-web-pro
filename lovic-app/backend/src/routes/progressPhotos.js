const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const path    = require('path');
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const multer  = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOAD_PATH || 'uploads/'),
  filename:    (req, file, cb) => cb(null, `progress_${Date.now()}_${file.fieldname}${path.extname(file.originalname)}`),
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

// POST /progress-photos/register — upload a 3-angle set (frente, espalda, perfil)
router.post('/register', upload.fields([
  { name: 'frente', maxCount: 1 },
  { name: 'espalda', maxCount: 1 },
  { name: 'perfil', maxCount: 1 },
]), async (req, res) => {
  const files = req.files || {};
  if (!files.frente && !files.espalda && !files.perfil) {
    return res.status(400).json({ error: 'Al menos una foto es requerida' });
  }

  const registerId = uuidv4();
  const note = req.body.note || '';
  const date = req.body.date || new Date().toISOString().slice(0, 10);

  await db.query(
    'INSERT INTO progress_registers (id, user_id, date, note) VALUES (?, ?, ?, ?)',
    [registerId, req.user.id, date, note]
  );

  const angles = ['frente', 'espalda', 'perfil'];
  for (const angle of angles) {
    if (files[angle]) {
      await db.query(
        'INSERT INTO progress_photos (id, user_id, register_id, angle, image_url, note) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), req.user.id, registerId, angle, 'uploads/' + files[angle][0].filename, note]
      );
    }
  }

  res.json({ message: 'Registro guardado', registerId });
});

// GET /progress-photos — list all registers grouped with their photos
router.get('/', async (req, res) => {
  const [registers] = await db.query(
    'SELECT * FROM progress_registers WHERE user_id=? ORDER BY date DESC LIMIT 20',
    [req.user.id]
  );

  if (!registers.length) return res.json({ registers: [] });

  const ids = registers.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const [photos] = await db.query(
    `SELECT * FROM progress_photos WHERE register_id IN (${placeholders})`,
    ids
  );

  const photosByRegister = {};
  for (const p of photos) {
    if (!photosByRegister[p.register_id]) photosByRegister[p.register_id] = {};
    photosByRegister[p.register_id][p.angle] = p;
  }

  const result = registers.map(r => ({
    ...r,
    photos: photosByRegister[r.id] || {},
  }));

  res.json({ registers: result });
});

// DELETE /progress-photos/register/:id
router.delete('/register/:id', async (req, res) => {
  await db.query(
    'DELETE FROM progress_photos WHERE register_id=? AND user_id=?',
    [req.params.id, req.user.id]
  );
  await db.query(
    'DELETE FROM progress_registers WHERE id=? AND user_id=?',
    [req.params.id, req.user.id]
  );
  res.json({ message: 'Registro eliminado' });
});

// Legacy single upload kept for backwards compatibility
router.post('/upload', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Foto requerida' });
  const note = req.body.note || '';

  const registerId = uuidv4();
  await db.query(
    'INSERT INTO progress_registers (id, user_id, date, note) VALUES (?, ?, NOW(), ?)',
    [registerId, req.user.id, note]
  );
  await db.query(
    'INSERT INTO progress_photos (id, user_id, register_id, angle, image_url, note) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), req.user.id, registerId, 'frente', 'uploads/' + req.file.filename, note]
  );

  res.json({ message: 'Foto guardada', path: req.file.path });
});

module.exports = router;
