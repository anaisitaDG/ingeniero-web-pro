const express = require('express');
const router  = express.Router();
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /dashboard
router.get('/', async (req, res) => {
  const uid = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  const [[caloriesRow]] = await db.query(
    `SELECT COALESCE(SUM(calories),0) AS consumed FROM food_logs WHERE user_id=? AND logged_at=CURDATE()`, [uid]);

  const [[tracking]] = await db.query(
    `SELECT * FROM daily_tracking WHERE user_id=? AND tracked_date=?`, [uid, today]);

  const [bioRows] = await db.query(
    `SELECT * FROM bioimpedance WHERE user_id=? ORDER BY logged_at DESC LIMIT 2`, [uid]);

  const [weightRows] = await db.query(
    `SELECT logged_at, weight_kg FROM measurements WHERE user_id=? ORDER BY logged_at DESC LIMIT 10`, [uid]);

  const [[questRow]] = await db.query(
    `SELECT * FROM questionnaire_data WHERE user_id=?`, [uid]);

  const [[routine]] = await db.query(
    `SELECT * FROM routines WHERE user_id=? AND is_active=TRUE ORDER BY created_at DESC LIMIT 1`, [uid]);

  const [[nutrition]] = await db.query(
    `SELECT * FROM nutrition_plans WHERE user_id=? AND is_active=TRUE ORDER BY created_at DESC LIMIT 1`, [uid]);

  const [adherence] = await db.query(
    `SELECT
       COUNT(*) as total_days,
       SUM(workout_done) as workout_days,
       SUM(diet_followed) as diet_days
     FROM daily_tracking WHERE user_id=? AND tracked_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
    [uid]);

  const latest = bioRows[0] || null;
  const target  = req.user.calorie_target || 2000;
  const consumed = caloriesRow.consumed;

  res.json({
    user: req.user,
    calories:  { target, consumed, remaining: Math.max(target - consumed, 0) },
    tracking:  tracking || { workout_done: false, diet_followed: false },
    bio:       latest,
    weight_history: weightRows,
    questionnaire: questRow,
    routine,
    nutrition_plan: nutrition,
    adherence: adherence[0],
  });
});

// POST /dashboard/tracking
router.post('/tracking', async (req, res) => {
  const { workout_done, diet_followed, weight_kg, mood, notes } = req.body;
  const today = new Date().toISOString().split('T')[0];

  await db.query(
    `INSERT INTO daily_tracking (id, user_id, tracked_date, workout_done, diet_followed, weight_kg, mood, notes)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       workout_done=VALUES(workout_done), diet_followed=VALUES(diet_followed),
       weight_kg=VALUES(weight_kg), mood=VALUES(mood), notes=VALUES(notes)`,
    [req.user.id, today, workout_done ?? false, diet_followed ?? false, weight_kg, mood, notes]
  );

  res.json({ message: 'Registro actualizado' });
});

module.exports = router;
