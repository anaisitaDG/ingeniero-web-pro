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

// POST /bioimpedance/upload — acepta 1 o 2 imágenes, guarda un solo registro combinado
router.post('/upload', upload.array('image', 4), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Imagen requerida' });

  const targetUserId = req.body.user_id || req.user.id;

  if (req.user.role !== 'trainer' && targetUserId !== req.user.id) {
    return res.status(403).json({ error: 'Sin permiso' });
  }

  // Parsear todas las imágenes y combinar: el último valor no-nulo prevalece
  const results = await Promise.all(req.files.map(f => parseBioimpedance(f.path)));
  const merged = results.reduce((acc, r) => ({
    body_fat_pct:   r.body_fat_pct   ?? acc.body_fat_pct,
    muscle_mass_kg: r.muscle_mass_kg ?? acc.muscle_mass_kg,
    visceral_fat:   r.visceral_fat   ?? acc.visceral_fat,
    bmr_kcal:       r.bmr_kcal       ?? acc.bmr_kcal,
    raw:            { ...acc.raw, ...r.raw },
  }), { body_fat_pct: null, muscle_mass_kg: null, visceral_fat: null, bmr_kcal: null, raw: {} });

  const imagePaths = req.files.map(f => f.path).join(',');

  await db.query(
    `INSERT INTO bioimpedance
       (id, user_id, image_url, body_fat_pct, muscle_mass_kg, visceral_fat, bmr_kcal, raw_ocr_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(), targetUserId, imagePaths,
      merged.body_fat_pct, merged.muscle_mass_kg, merged.visceral_fat,
      merged.bmr_kcal, JSON.stringify(merged.raw),
    ]
  );

  res.json({ parsed: merged });
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
