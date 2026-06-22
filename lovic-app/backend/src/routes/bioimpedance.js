const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const path    = require('path');
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { parseBioimpedance } = require('../services/ai');
const multer  = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOAD_PATH || 'uploads/'),
  filename:    (req, file, cb) => cb(null, `bio_${Date.now()}${path.extname(file.originalname)}`),
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

// POST /bioimpedance/upload
router.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Imagen requerida' });

  const targetUserId = req.body.user_id || req.user.id;

  if (req.user.role !== 'trainer' && targetUserId !== req.user.id) {
    return res.status(403).json({ error: 'Sin permiso' });
  }

  const imagePath = req.file.path;
  const parsed = await parseBioimpedance(imagePath);

  await db.query(
    `INSERT INTO bioimpedance
       (id, user_id, image_url, body_fat_pct, muscle_mass_kg, visceral_fat, bmr_kcal, raw_ocr_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(), targetUserId, imagePath,
      parsed.body_fat_pct, parsed.muscle_mass_kg, parsed.visceral_fat,
      parsed.bmr_kcal, JSON.stringify(parsed.raw),
    ]
  );

  res.json({ parsed });
});

// GET /bioimpedance — historial del usuario autenticado
router.get('/', async (req, res) => {
  const uid = req.query.user_id && req.user.role === 'trainer' ? req.query.user_id : req.user.id;
  const [rows] = await db.query(
    'SELECT * FROM bioimpedance WHERE user_id=? ORDER BY logged_at DESC LIMIT 10', [uid]
  );
  res.json({ bioimpedance: rows });
});

module.exports = router;
