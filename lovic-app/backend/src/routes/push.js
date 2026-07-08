const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const db = require('../db');
const auth = require('../middleware/auth');

const VAPID_PUBLIC  = 'BMyXu344UMSX0IoqheXZQnVnk9LC5bSMUVYza66Ht5jrY_LpeSe3y5b3npONMOM33uI-Rsg7z5XJBza4CHbwD6s';
const VAPID_PRIVATE = '0zl7Psjn5I2o8gyQMDmWiEgKuqgsC5hl9kG2zWvxZ30';

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

module.exports = { router, webpush, VAPID_PUBLIC };
