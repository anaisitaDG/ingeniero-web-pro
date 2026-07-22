const express = require('express');
const router  = express.Router();
const db      = require('../database/db');
const { requireAuth, calcMacroTargets } = require('../middleware/auth');

router.use(requireAuth);

// PUT /profile
router.put('/', async (req, res) => {
  const { name, fitness_goal, calorie_target, protein_target_g, carbs_target_g, fat_target_g } = req.body;
  const uid = req.user.id;

  // If calorie_target or fitness_goal changed but macros not provided, recalculate
  const newCalorie = calorie_target || req.user.calorie_target;
  const newGoal    = fitness_goal   || req.user.fitness_goal;
  const auto = (!protein_target_g) ? calcMacroTargets(newCalorie, newGoal) : {};

  await db.query(
    `UPDATE users SET
       name             = COALESCE(NULLIF(?, ''), name),
       fitness_goal     = COALESCE(NULLIF(?, ''), fitness_goal),
       calorie_target   = COALESCE(NULLIF(?, 0), calorie_target),
       protein_target_g = COALESCE(?, protein_target_g),
       carbs_target_g   = COALESCE(?, carbs_target_g),
       fat_target_g     = COALESCE(?, fat_target_g)
     WHERE id = ?`,
    [
      name ?? null, fitness_goal ?? null, calorie_target || null,
      protein_target_g || auto.protein_target_g || null,
      carbs_target_g   || auto.carbs_target_g   || null,
      fat_target_g     || auto.fat_target_g     || null,
      uid,
    ]
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
