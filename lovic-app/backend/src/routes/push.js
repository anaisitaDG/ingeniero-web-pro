const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const db = require('../database/db');
const { requireAuth: auth } = require('../middleware/auth');

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || 'BMyXu344UMSX0IoqheXZQnVnk9LC5bSMUVYza66Ht5jrY_LpeSe3y5b3npONMOM33uI-Rsg7z5XJBza4CHbwD6s';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '0zl7Psjn5I2o8gyQMDmWiEgKuqgsC5hl9kG2zWvxZ30';

webpush.setVapidDetails('mailto:hola@anaismoralesmkt.com', VAPID_PUBLIC, VAPID_PRIVATE);

// GET /push/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

// POST /push/subscribe
router.post('/subscribe', auth, async (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'subscription requerida' });

  const uid = req.user.id;
  const endpoint = subscription.endpoint;
  const sub = JSON.stringify(subscription);

  await db.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, subscription)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE subscription = VALUES(subscription)`,
    [uid, endpoint, sub]
  );
  res.json({ ok: true });
});

// DELETE /push/subscribe
router.delete('/subscribe', auth, async (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) {
    await db.query('DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?', [req.user.id, endpoint]);
  } else {
    await db.query('DELETE FROM push_subscriptions WHERE user_id=?', [req.user.id]);
  }
  res.json({ ok: true });
});

// POST /push/send — trainer sends a reminder to a specific client
router.post('/send', auth, async (req, res) => {
  try {
    if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Sin permiso' });
    const { user_id, title = '¡Hola!', body = 'Tu entrenadora Lorena te envía un recordatorio 💪' } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id requerido' });

    const [subs] = await db.query('SELECT subscription FROM push_subscriptions WHERE user_id=?', [user_id]);
    if (!subs.length) return res.status(404).json({ error: 'El cliente no tiene notificaciones activas' });

    const payload = JSON.stringify({ title, body, icon: '/icon-192.png' });
    const results = await Promise.allSettled(
      subs.map(s => webpush.sendNotification(JSON.parse(s.subscription), payload))
    );
    const sent = results.filter(r => r.status === 'fulfilled').length;
    res.json({ ok: true, sent });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error enviando notificación' });
  }
});

// POST /push/test — el propio usuario se envía una notificación de prueba
router.post('/test', auth, async (req, res) => {
  try {
    const [subs] = await db.query('SELECT subscription FROM push_subscriptions WHERE user_id=?', [req.user.id]);
    if (!subs.length) return res.status(404).json({ error: 'Este dispositivo no tiene notificaciones activas' });

    const payload = JSON.stringify({
      title: '🧪 Prueba de Lovic',
      body: '¡Funciona! Vic ya puede recordarte agua, entrenos y motivación 🎉',
      icon: '/icon-192.png',
    });
    const results = await Promise.allSettled(
      subs.map(s => webpush.sendNotification(JSON.parse(s.subscription), payload))
    );
    const sent = results.filter(r => r.status === 'fulfilled').length;
    // Limpia suscripciones muertas (410/404)
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'rejected' && [410, 404].includes(r.reason?.statusCode)) {
        const ep = JSON.parse(subs[i].subscription).endpoint;
        await db.query('DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?', [req.user.id, ep]);
      }
    }
    res.json({ ok: true, sent });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error enviando notificación' });
  }
});

module.exports = { router, webpush, VAPID_PUBLIC };
