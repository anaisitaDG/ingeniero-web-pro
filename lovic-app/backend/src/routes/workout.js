const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /workout/plan — cliente ve su plan estructurado
router.get('/plan', async (req, res) => {
  const uid = req.user.id;
  const [[plan]] = await db.query(
    'SELECT * FROM workout_plans WHERE user_id=? AND is_active=TRUE ORDER BY created_at DESC LIMIT 1', [uid]
  );
  if (!plan) return res.json({ plan: null });

  const [days] = await db.query(
    'SELECT * FROM workout_days WHERE plan_id=? ORDER BY day_order', [plan.id]
  );
  for (const day of days) {
    const [exercises] = await db.query(
      'SELECT * FROM workout_exercises WHERE day_id=? ORDER BY exercise_order', [day.id]
    );
    // Last session log per exercise
    for (const ex of exercises) {
      const [lastLog] = await db.query(
        `SELECT logged_date, GROUP_CONCAT(weight_kg ORDER BY set_number SEPARATOR ',') as weights,
                GROUP_CONCAT(reps_done ORDER BY set_number SEPARATOR ',') as reps
         FROM workout_logs WHERE exercise_id=? AND user_id=?
         GROUP BY logged_date ORDER BY logged_date DESC LIMIT 1`,
        [ex.id, uid]
      );
      ex.last_session = lastLog[0] || null;
    }
    day.exercises = exercises;
  }
  res.json({ plan: { ...plan, days } });
});

// POST /workout/log — cliente registra sets de un ejercicio
router.post('/log', async (req, res) => {
  const uid = req.user.id;
  const { exercise_id, logged_date, sets } = req.body;
  // sets = [{ set_number, weight_kg, reps_done }]
  if (!exercise_id || !Array.isArray(sets)) return res.status(400).json({ error: 'Datos requeridos' });
  const date = logged_date || new Date().toLocaleDateString('en-CA');

  // Delete previous logs for this exercise on this date
  await db.query('DELETE FROM workout_logs WHERE exercise_id=? AND user_id=? AND logged_date=?',
    [exercise_id, uid, date]);

  for (const s of sets) {
    await db.query(
      'INSERT INTO workout_logs (id, exercise_id, user_id, logged_date, set_number, weight_kg, reps_done) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), exercise_id, uid, date, s.set_number, s.weight_kg || null, s.reps_done || null]
    );
  }
  res.json({ message: 'Registrado' });
});

// GET /workout/history/:exerciseId — historial de un ejercicio
router.get('/history/:exerciseId', async (req, res) => {
  const uid = req.user.id;
  const [logs] = await db.query(
    `SELECT logged_date, set_number, weight_kg, reps_done
     FROM workout_logs WHERE exercise_id=? AND user_id=?
     ORDER BY logged_date DESC, set_number ASC
     LIMIT 50`,
    [req.params.exerciseId, uid]
  );
  // Group by date
  const grouped = [];
  const byDate = {};
  for (const row of logs) {
    const d = row.logged_date instanceof Date
      ? row.logged_date.toISOString().slice(0, 10)
      : String(row.logged_date).slice(0, 10);
    if (!byDate[d]) { byDate[d] = []; grouped.push({ date: d, sets: byDate[d] }); }
    byDate[d].push({ set_number: row.set_number, weight_kg: row.weight_kg, reps_done: row.reps_done });
  }
  res.json({ history: grouped });
});

module.exports = router;
