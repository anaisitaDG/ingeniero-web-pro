const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const path    = require('path');
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { comparePhotos } = require('../services/ai');
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

function safeParse(s) {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}

// POST /progress-photos/register — upload a 3-angle set (frente, espalda, perfil)
router.post('/register', upload.fields([
  { name: 'frente', maxCount: 1 },
  { name: 'espalda', maxCount: 1 },
  { name: 'perfil', maxCount: 1 },
]), async (req, res) => {
  try {
    const files = req.files || {};
    if (!files.frente && !files.espalda && !files.perfil) {
      return res.status(400).json({ error: 'Al menos una foto es requerida' });
    }

    let targetUserId = req.user.id;
    if (req.body.user_id && req.user.role === 'trainer') {
      const [[target]] = await db.query('SELECT id FROM users WHERE id=? AND role="client"', [req.body.user_id]);
      if (!target) return res.status(403).json({ error: 'Usuario destino no válido' });
      targetUserId = target.id;
    }

    const registerId = uuidv4();
    const note = req.body.note || '';
    const date = req.body.date || new Date().toISOString().slice(0, 10);

    await db.query(
      'INSERT INTO progress_registers (id, user_id, date, note) VALUES (?, ?, ?, ?)',
      [registerId, targetUserId, date, note]
    );

    const angles = ['frente', 'espalda', 'perfil'];
    for (const angle of angles) {
      if (files[angle]) {
        await db.query(
          'INSERT INTO progress_photos (id, user_id, register_id, angle, image_url, note) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), targetUserId, registerId, angle, 'uploads/' + files[angle][0].filename, note]
        );
      }
    }

    res.json({ message: 'Registro guardado', registerId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /progress-photos — list all registers grouped with their photos
router.get('/', async (req, res) => {
  try {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /progress-photos/register/:id
router.delete('/register/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM progress_photos WHERE register_id=? AND user_id=?', [req.params.id, req.user.id]);
    await conn.query('DELETE FROM progress_registers WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    await conn.commit();
    res.json({ message: 'Registro eliminado' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// POST /progress-photos/compare — análisis IA de dos registros
router.post('/compare', async (req, res) => {
  try {
    const { register_a, register_b } = req.body;
    if (!register_a || !register_b) return res.status(400).json({ error: 'Se requieren dos registros' });

    // La entrenadora puede comparar las fotos de su clienta (user_id); si no, usa su propio id
    let targetUserId = req.user.id;
    if (req.body.user_id && req.user.role === 'trainer') {
      const [[target]] = await db.query('SELECT id FROM users WHERE id=? AND role="client"', [req.body.user_id]);
      if (!target) return res.status(403).json({ error: 'Usuario destino no válido' });
      targetUserId = target.id;
    }

    const [regs] = await db.query(
      'SELECT * FROM progress_registers WHERE id IN (?, ?) AND user_id=?',
      [register_a, register_b, targetUserId]
    );
    if (regs.length !== 2) return res.status(404).json({ error: 'Registros no encontrados' });

    const [photos] = await db.query(
      'SELECT * FROM progress_photos WHERE register_id IN (?, ?) AND user_id=?',
      [register_a, register_b, targetUserId]
    );

    // Ordenar por fecha: antes = más antiguo, después = más reciente
    const byId = {};
    for (const r of regs) byId[r.id] = r;
    const [older, newer] = [byId[register_a], byId[register_b]].sort(
      (x, y) => String(x.date).localeCompare(String(y.date))
    );

    const photoOf = (regId, angle) => photos.find(p => p.register_id === regId && p.angle === angle);
    const pairs = [];
    for (const angle of ['frente', 'espalda', 'perfil']) {
      const before = photoOf(older.id, angle);
      const after  = photoOf(newer.id, angle);
      if (before && after) {
        pairs.push({
          angle,
          beforePath: path.resolve(before.image_url),
          afterPath:  path.resolve(after.image_url),
        });
      }
    }

    if (!pairs.length) {
      return res.status(400).json({ error: 'No hay ángulos en común entre los dos registros para comparar' });
    }

    const dateBefore = String(older.date).slice(0, 10);
    const dateAfter  = String(newer.date).slice(0, 10);

    // Caché: mismo par de registros → no volver a llamar a la IA (salvo refresh)
    const pairKey = [register_a, register_b].sort().join('|');
    let result = null;
    if (!req.body.refresh) {
      const [[cached]] = await db.query(
        'SELECT analysis, zones FROM photo_comparisons WHERE user_id=? AND pair_key=?',
        [targetUserId, pairKey]
      );
      if (cached) {
        result = { summary: cached.analysis || '', zones: safeParse(cached.zones) };
      }
    }
    if (!result) {
      result = await comparePhotos(pairs, dateBefore, dateAfter, older.note || newer.note || '');
      await db.query(
        `INSERT INTO photo_comparisons (id, user_id, pair_key, analysis, zones) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE analysis=VALUES(analysis), zones=VALUES(zones), created_at=CURRENT_TIMESTAMP`,
        [uuidv4(), targetUserId, pairKey, result.summary, JSON.stringify(result.zones || [])]
      );
    }

    // Bioimpedancia más cercana a cada fecha (para mostrar números reales al lado)
    const [bios] = await db.query(
      'SELECT weight_kg, body_fat_pct, muscle_mass_kg, skeletal_muscle_kg, visceral_fat, logged_at, created_at FROM bioimpedance WHERE user_id=? ORDER BY logged_at DESC LIMIT 40',
      [targetUserId]
    );
    const closestBio = (dateStr) => {
      if (!bios.length) return null;
      const target = new Date(dateStr).getTime();
      let best = null, bestDiff = Infinity;
      for (const b of bios) {
        const d = new Date(b.logged_at || b.created_at).getTime();
        const diff = Math.abs(d - target);
        if (diff < bestDiff) { bestDiff = diff; best = b; }
      }
      // Solo si está dentro de ~45 días de la foto, si no es engañoso
      if (bestDiff > 45 * 24 * 60 * 60 * 1000) return null;
      return best;
    };

    res.json({
      analysis: result.summary,
      zones: result.zones,
      dateBefore,
      dateAfter,
      angles: pairs.map(p => p.angle),
      bioBefore: closestBio(dateBefore),
      bioAfter:  closestBio(dateAfter),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Legacy single upload kept for backwards compatibility
router.post('/upload', upload.single('photo'), async (req, res) => {
  try {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
