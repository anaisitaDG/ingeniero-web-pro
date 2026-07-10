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

  function parseBioDate(raw) {
    if (!raw) return null;
    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
    // YYYY-MM-DD
    const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) return raw;
    // YYYY/MM/DD
    const ymd2 = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (ymd2) return `${ymd2[1]}-${ymd2[2]}-${ymd2[3]}`;
    return null;
  }

  if (req.user.role !== 'trainer' && targetUserId !== req.user.id) {
    return res.status(403).json({ error: 'Sin permiso' });
  }

  // Parsear todas las imágenes y combinar: el último valor no-nulo prevalece
  const results = await Promise.all(req.files.map(f => parseBioimpedance(f.path)));
  const FIELDS = ['weight_kg','bmi','body_fat_pct','body_fat_kg','muscle_mass_kg','skeletal_muscle_kg','body_water_pct','visceral_fat','bmr_kcal','calorie_target','target_muscle_kg','target_fat_loss_kg'];
  const empty = Object.fromEntries(FIELDS.map(f => [f, null]));
  const merged = results.reduce((acc, r) => ({
    ...Object.fromEntries(FIELDS.map(f => [f, r[f] ?? acc[f]])),
    report_date_raw: r.report_date_raw ?? acc.report_date_raw,
    raw: { ...acc.raw, ...r.raw },
  }), { ...empty, report_date_raw: null, raw: {} });

  const imagePaths = req.files.map(f => f.path).join(',');
  const loggedAt = parseBioDate(merged.report_date_raw) || req.body.logged_at || null;

  const insertSql = loggedAt
    ? `INSERT INTO bioimpedance (id, user_id, image_url, logged_at, weight_kg, bmi, body_fat_pct, body_fat_kg, muscle_mass_kg, skeletal_muscle_kg, body_water_pct, visceral_fat, bmr_kcal, calorie_target, target_muscle_kg, target_fat_loss_kg, raw_ocr_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    : `INSERT INTO bioimpedance (id, user_id, image_url, weight_kg, bmi, body_fat_pct, body_fat_kg, muscle_mass_kg, skeletal_muscle_kg, body_water_pct, visceral_fat, bmr_kcal, calorie_target, target_muscle_kg, target_fat_loss_kg, raw_ocr_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const baseParams = [
    uuidv4(), targetUserId, imagePaths,
    merged.weight_kg, merged.bmi, merged.body_fat_pct, merged.body_fat_kg,
    merged.muscle_mass_kg, merged.skeletal_muscle_kg, merged.body_water_pct,
    merged.visceral_fat, merged.bmr_kcal, merged.calorie_target,
    merged.target_muscle_kg, merged.target_fat_loss_kg,
    JSON.stringify(merged.raw),
  ];

  await db.query(insertSql, loggedAt ? [baseParams[0], baseParams[1], baseParams[2], loggedAt, ...baseParams.slice(3)] : baseParams);

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

// DELETE /bioimpedance/:id
router.delete('/:id', async (req, res) => {
  const [rows] = await db.query('SELECT user_id FROM bioimpedance WHERE id=?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.role !== 'trainer' && rows[0].user_id !== req.user.id) {
    return res.status(403).json({ error: 'Sin permiso' });
  }
  await db.query('DELETE FROM bioimpedance WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
