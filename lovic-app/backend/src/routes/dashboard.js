const express = require('express');
const router  = express.Router();
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /dashboard
router.get('/', async (req, res) => {
  const uid = req.user.id;
  const today = req.query.date || new Date().toISOString().slice(0, 10);

  const [[caloriesRow]] = await db.query(
    `SELECT COALESCE(SUM(calories),0) AS consumed,
            COALESCE(SUM(protein_g),0) AS protein,
            COALESCE(SUM(carbs_g),0) AS carbs,
            COALESCE(SUM(fat_g),0) AS fat
     FROM food_logs WHERE user_id=? AND logged_at=?`, [uid, today]);

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

  // Streak: consecutive days with any exercise logged OR diet_followed
  const [trackingRows] = await db.query(
    `SELECT dt.tracked_date,
            (dt.workout_done OR EXISTS (
              SELECT 1 FROM workout_logs wl WHERE wl.user_id=dt.user_id AND wl.logged_date=dt.tracked_date
            )) AS active,
            dt.diet_followed
     FROM daily_tracking dt
     WHERE dt.user_id=? AND dt.tracked_date < ?
     ORDER BY dt.tracked_date DESC LIMIT 60`,
    [uid, today]);

  // Also get days with exercise logs but no daily_tracking entry
  const [logDays] = await db.query(
    `SELECT DISTINCT DATE(logged_date) as d FROM workout_logs
     WHERE user_id=? AND logged_date < ? ORDER BY d DESC LIMIT 60`,
    [uid, today]);

  // Merge into a set of active dates
  const activeDates = new Set();
  for (const r of trackingRows) {
    if (r.active || r.diet_followed) {
      activeDates.add(String(r.tracked_date).slice(0, 10));
    }
  }
  for (const r of logDays) activeDates.add(String(r.d).slice(0, 10));

  let streak = 0;
  const msPerDay = 86400000;
  let expected = new Date(today).getTime() - msPerDay;
  while (activeDates.has(new Date(expected).toLocaleDateString('en-CA'))) {
    streak++;
    expected -= msPerDay;
  }

  const latest = bioRows[0] || null;
  const target  = req.user.calorie_target || 2000;
  const consumed = caloriesRow.consumed;

  res.json({
    user: req.user,
    calories:  { target, consumed, remaining: Math.max(target - consumed, 0) },
    macros: {
      protein: Math.round(caloriesRow.protein), carbs: Math.round(caloriesRow.carbs), fat: Math.round(caloriesRow.fat),
      protein_target: req.user.protein_target_g || 0,
      carbs_target:   req.user.carbs_target_g   || 0,
      fat_target:     req.user.fat_target_g      || 0,
    },
    tracking:  tracking || { workout_done: false, diet_followed: false, water_glasses: 0 },
    bio:       latest,
    weight_history: weightRows,
    questionnaire: questRow,
    routine,
    nutrition_plan: nutrition,
    adherence: adherence[0],
    streak,
  });
});

// POST /dashboard/tracking
router.post('/tracking', async (req, res) => {
  const { workout_done, diet_followed, water_glasses, weight_kg, mood, notes, sleep_hours, date } = req.body;
  const today = date || new Date().toISOString().split('T')[0];

  await db.query(
    `INSERT INTO daily_tracking (id, user_id, tracked_date, workout_done, diet_followed, water_glasses, weight_kg, mood, notes, sleep_hours)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       workout_done=VALUES(workout_done), diet_followed=VALUES(diet_followed),
       water_glasses=VALUES(water_glasses),
       weight_kg=VALUES(weight_kg), mood=VALUES(mood), notes=VALUES(notes),
       sleep_hours=VALUES(sleep_hours)`,
    [req.user.id, today, workout_done ?? false, diet_followed ?? false, water_glasses ?? 0, weight_kg, mood, notes, sleep_hours ?? null]
  );

  res.json({ message: 'Registro actualizado' });
});

module.exports = router;

