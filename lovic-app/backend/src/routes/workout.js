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

// POST /workout/complete — cliente marca rutina del día como completada
router.post('/complete', async (req, res) => {
  const uid = req.user.id;
  const today = req.body.date || new Date().toLocaleDateString('en-CA');
  await db.query(
    `INSERT INTO daily_tracking (id, user_id, tracked_date, workout_done)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE workout_done = 1`,
    [uuidv4(), uid, today]
  );
  res.json({ message: 'Rutina marcada como completada' });
});

// GET /workout/today-done — check si ya completó rutina hoy
router.get('/today-done', async (req, res) => {
  const uid = req.user.id;
  const today = req.query.date || new Date().toLocaleDateString('en-CA');
  const [[row]] = await db.query(
    'SELECT workout_done FROM daily_tracking WHERE user_id=? AND tracked_date=?',
    [uid, today]
  );
  res.json({ done: !!(row?.workout_done) });
});

// POST /workout/complete-day — marca/desmarca un día específico
router.post('/complete-day', async (req, res) => {
  const uid = req.user.id;
  const { day_id, done, date } = req.body;
  const today = date || new Date().toLocaleDateString('en-CA');
  if (done) {
    await db.query(
      `INSERT INTO workout_day_completions (id, user_id, day_id, completed_date)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE completed_date=completed_date`,
      [uuidv4(), uid, day_id, today]
    );
    // También marca workout_done en daily_tracking
    await db.query(
      `INSERT INTO daily_tracking (id, user_id, tracked_date, workout_done) VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE workout_done=1`,
      [uuidv4(), uid, today]
    );
  } else {
    await db.query(
      'DELETE FROM workout_day_completions WHERE user_id=? AND day_id=? AND completed_date=?',
      [uid, day_id, today]
    );
    // Check if any other day was completed today; if not, reset workout_done
    const [[remaining]] = await db.query(
      `SELECT COUNT(*) as cnt FROM workout_day_completions WHERE user_id=? AND completed_date=?`,
      [uid, today]
    );
    if (remaining.cnt === 0) {
      await db.query(
        `INSERT INTO daily_tracking (id, user_id, tracked_date, workout_done) VALUES (?, ?, ?, 0)
         ON DUPLICATE KEY UPDATE workout_done=0`,
        [uuidv4(), uid, today]
      );
    }
  }
  res.json({ ok: true });
});

// GET /workout/completed-days — días completados (más reciente por día)
router.get('/completed-days', async (req, res) => {
  const uid = req.user.id;
  const [rows] = await db.query(
    `SELECT day_id, MAX(completed_date) as last_completed
     FROM workout_day_completions WHERE user_id=?
     GROUP BY day_id`,
    [uid]
  );
  res.json({ completed: rows });
});


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

// POST /workout/activity — guarda calentamiento o cardio de una sesión
router.post('/activity', async (req, res) => {
  const uid = req.user.id;
  const { day_id, type, activity_name, duration_mins, date } = req.body;
  const session_date = date || new Date().toLocaleDateString('en-CA');
  await db.query(
    `INSERT INTO workout_activity_logs (id, user_id, day_id, session_date, type, activity_name, duration_mins)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE activity_name=VALUES(activity_name), duration_mins=VALUES(duration_mins)`,
    [uuidv4(), uid, day_id, session_date, type, activity_name, duration_mins || null]
  );
  res.json({ ok: true });
});

// GET /workout/activity/:dayId — trae actividades de las últimas sesiones de un día
router.get('/activity/:dayId', async (req, res) => {
  const uid = req.user.id;
  const [rows] = await db.query(
    `SELECT * FROM workout_activity_logs WHERE user_id=? AND day_id=? ORDER BY session_date DESC LIMIT 20`,
    [uid, req.params.dayId]
  );
  res.json({ activities: rows });
});

// POST /workout/free — guardar sesión de entrenamiento libre
router.post('/free', async (req, res) => {
  const uid = req.user.id;
  const { exercises, note, date } = req.body;
  if (!Array.isArray(exercises) || exercises.length === 0)
    return res.status(400).json({ error: 'Se requiere al menos un ejercicio' });
  const session_date = date || new Date().toLocaleDateString('en-CA');

  const id = uuidv4();
  await db.query(
    `INSERT INTO free_workout_logs (id, user_id, session_date, note, exercises)
     VALUES (?, ?, ?, ?, ?)`,
    [id, uid, session_date, note || null, JSON.stringify(exercises)]
  );

  // Marca workout_done en daily_tracking
  await db.query(
    `INSERT INTO daily_tracking (id, user_id, tracked_date, workout_done) VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE workout_done=1`,
    [uuidv4(), uid, session_date]
  );

  res.json({ ok: true, id });
});

// GET /workout/free — historial de entrenamientos libres
router.get('/free', async (req, res) => {
  const uid = req.user.id;
  const [rows] = await db.query(
    `SELECT * FROM free_workout_logs WHERE user_id=? ORDER BY session_date DESC LIMIT 30`,
    [uid]
  );
  res.json({ sessions: rows });
});

module.exports = router;
