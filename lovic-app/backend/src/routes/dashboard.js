const express = require('express');
const router  = express.Router();
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

function colombiaToday() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// GET /dashboard
router.get('/', async (req, res) => {
  const uid = req.user.id;
  const today = req.query.date || colombiaToday();

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

  // Streak: consecutive days with workout_done, any exercise logged, OR diet_followed
  const [logDays] = await db.query(
    `SELECT DISTINCT DATE_FORMAT(logged_date, '%Y-%m-%d') as d
     FROM workout_logs WHERE user_id=? AND logged_date <= ?
     ORDER BY d DESC LIMIT 60`,
    [uid, today]);
  const [trackDays] = await db.query(
    `SELECT DATE_FORMAT(tracked_date, '%Y-%m-%d') as d
     FROM daily_tracking WHERE user_id=? AND (workout_done=1 OR diet_followed=1) AND tracked_date <= ?
     ORDER BY d DESC LIMIT 60`,
    [uid, today]);

  const activeDates = new Set();
  for (const r of logDays) activeDates.add(r.d);
  for (const r of trackDays) activeDates.add(r.d);

  // Streak: only breaks if more rest days pass than the plan allows
  // e.g. training 5 days/week → max 2 consecutive rest days allowed
  const trainingDaysPerWeek = Math.min(Math.max(parseInt(questRow?.training_days_week) || 5, 1), 6);
  const maxRestDays = 7 - trainingDaysPerWeek;
  let streak = 0;
  let restDaysSinceLastWorkout = 0;
  const msPerDay = 86400000;
  let expected = new Date(today).getTime();
  while (true) {
    const dateStr = new Date(expected).toISOString().slice(0, 10);
    if (activeDates.has(dateStr)) {
      streak++;
      restDaysSinceLastWorkout = 0;
    } else {
      restDaysSinceLastWorkout++;
      if (restDaysSinceLastWorkout > maxRestDays) break;
    }
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
  const today = date || new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await db.query(
    `INSERT INTO daily_tracking (id, user_id, tracked_date, workout_done, diet_followed, water_glasses, weight_kg, mood, notes, sleep_hours)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       workout_done=VALUES(workout_done), diet_followed=VALUES(diet_followed),
       water_glasses=VALUES(water_glasses),
       weight_kg=VALUES(weight_kg), mood=VALUES(mood), notes=VALUES(notes),
       sleep_hours=VALUES(sleep_hours)`,
    [req.user.id, today, workout_done ?? false, diet_followed ?? false, water_glasses ?? 0, weight_kg ?? null, mood ?? null, notes ?? null, sleep_hours ?? null]
  );

  res.json({ message: 'Registro actualizado' });
});

module.exports = router;

