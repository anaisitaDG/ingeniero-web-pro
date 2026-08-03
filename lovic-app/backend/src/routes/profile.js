const express = require('express');
const router  = express.Router();
const path    = require('path');
const multer  = require('multer');
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { VAPID_PUBLIC } = require('../config/vapid');

router.use(requireAuth);

// GET /profile/vapid-key — llave pública ACTUAL (por ruta proxeada, a diferencia de /push)
router.get('/vapid-key', (req, res) => res.json({ publicKey: VAPID_PUBLIC }));

// ── Foto de perfil ────────────────────────────────────────────────────────────
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOAD_PATH || 'uploads/'),
  filename:    (req, file, cb) => cb(null, `avatar_${req.user.id}_${Date.now()}${path.extname(file.originalname)}`),
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Solo imágenes')),
});

// POST /profile/avatar — sube foto de perfil personalizada
router.post('/avatar', avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Imagen requerida' });
    const url = 'uploads/' + req.file.filename;
    await db.query('UPDATE users SET avatar_url=? WHERE id=?', [url, req.user.id]);
    res.json({ avatar_url: url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /profile/avatar — quita la foto personalizada (vuelve a Gravatar/iniciales)
router.delete('/avatar', async (req, res) => {
  try {
    await db.query('UPDATE users SET avatar_url=NULL WHERE id=?', [req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /profile
router.put('/', async (req, res) => {
  const { name, fitness_goal } = req.body;
  const uid = req.user.id;

  // La clienta solo puede cambiar su nombre y objetivo. La META CALÓRICA y los
  // macros SOLO los define su entrenadora (vía /trainer/clients/:id/targets),
  // por eso aquí no se tocan aunque vengan en el body.
  await db.query(
    `UPDATE users SET
       name         = COALESCE(NULLIF(?, ''), name),
       fitness_goal = COALESCE(NULLIF(?, ''), fitness_goal)
     WHERE id = ?`,
    [name ?? null, fitness_goal ?? null, uid]
  );

  const [[updated]] = await db.query(
    'SELECT id, email, name, role, fitness_goal, calorie_target, protein_target_g, carbs_target_g, fat_target_g FROM users WHERE id = ?',
    [uid]
  );

  res.json({ user: updated });
});

// POST /profile/push-subscribe
router.post('/push-subscribe', async (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'subscription requerida' });
  const uid = req.user.id;
  await db.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, subscription)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE subscription = VALUES(subscription)`,
    [uid, subscription.endpoint, JSON.stringify(subscription)]
  );

  // Notificación de bienvenida inmediata: confirma que las push funcionan de punta a punta
  try {
    const { sendToUser } = require('../notifications');
    await sendToUser(uid, {
      title: '🔥 ¡Notificaciones activadas!',
      body: 'Vic ya puede recordarte agua, entrenos y motivación. ¡Vamos con todo! 💪',
      url: '/',
    });
  } catch (e) { console.error('[push welcome]', e.message); }

  res.json({ ok: true });
});

// POST /profile/push-test — el usuario se envía una notificación de prueba a sí mismo
router.post('/push-test', async (req, res) => {
  try {
    const [subs] = await db.query('SELECT endpoint FROM push_subscriptions WHERE user_id=?', [req.user.id]);
    if (!subs.length) return res.status(404).json({ error: 'Este dispositivo no tiene notificaciones activas' });
    const { sendToUser } = require('../notifications');
    await sendToUser(req.user.id, {
      title: '🧪 Prueba de Lovic',
      body: '¡Funciona! Vic ya puede recordarte agua, entrenos y motivación 🎉',
      url: '/',
    });
    res.json({ ok: true, sent: subs.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /profile/push-subscribe
router.delete('/push-subscribe', async (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) {
    await db.query('DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?', [req.user.id, endpoint]);
  } else {
    await db.query('DELETE FROM push_subscriptions WHERE user_id=?', [req.user.id]);
  }
  res.json({ ok: true });
});

module.exports = router;
