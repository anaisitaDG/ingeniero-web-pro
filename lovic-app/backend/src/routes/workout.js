const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

function colombiaToday() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// GET /workout/plan — cliente ve su plan estructurado
router.get('/plan', async (req, res) => {
  try {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /workout/complete — cliente marca rutina del día como completada
router.post('/complete', async (req, res) => {
  try {
    const uid = req.user.id;
    const today = req.body.date || colombiaToday();
    await db.query(
      `INSERT INTO daily_tracking (id, user_id, tracked_date, workout_done)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE workout_done = 1`,
      [uuidv4(), uid, today]
    );
    res.json({ message: 'Rutina marcada como completada' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /workout/today-done — check si ya completó rutina hoy
router.get('/today-done', async (req, res) => {
  try {
    const uid = req.user.id;
    const today = req.query.date || colombiaToday();
    const [[row]] = await db.query(
      'SELECT workout_done FROM daily_tracking WHERE user_id=? AND tracked_date=?',
      [uid, today]
    );
    res.json({ done: !!(row?.workout_done) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /workout/complete-day — marca/desmarca un día específico
router.post('/complete-day', async (req, res) => {
  try {
    const uid = req.user.id;
    const { day_id, done, date } = req.body;
    const today = date || colombiaToday();
    if (done) {
      await db.query(
        `INSERT INTO workout_day_completions (id, user_id, day_id, completed_date)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE completed_date=completed_date`,
        [uuidv4(), uid, day_id, today]
      );
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /workout/completed-days — días completados (más reciente por día)
router.get('/completed-days', async (req, res) => {
  try {
    const uid = req.user.id;
    const [rows] = await db.query(
      `SELECT day_id, MAX(completed_date) as last_completed
       FROM workout_day_completions WHERE user_id=?
       GROUP BY day_id`,
      [uid]
    );
    res.json({ completed: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// Normaliza y valida un valor numérico opcional dentro de un rango.
// Devuelve { value } si está bien (null si venía vacío), o { error } si no.
function sanitizeNumber(raw, { min, max, label, integer }) {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { error: `${label} no es un número válido` };
  if (n < min || n > max) return { error: `${label} debe estar entre ${min} y ${max}` };
  return { value: integer ? Math.round(n) : Math.round(n * 100) / 100 };
}

router.post('/log', async (req, res) => {
  try {
    const uid = req.user.id;
    const { exercise_id, logged_date, sets } = req.body;
    if (!exercise_id || !Array.isArray(sets)) return res.status(400).json({ error: 'Datos requeridos' });

    // Validar TODOS los sets antes de tocar la base de datos (evita borrados a medias)
    const cleanSets = [];
    for (const s of sets) {
      const isIso = s.set_type === 'isometry';
      const w = sanitizeNumber(s.weight_kg, { min: 0, max: 999.99, label: 'El peso (kg)' });
      if (w.error) return res.status(400).json({ error: w.error });
      const r = sanitizeNumber(s.reps_done, { min: 0, max: 9999, label: 'Las repeticiones', integer: true });
      if (r.error) return res.status(400).json({ error: r.error });
      const d = sanitizeNumber(s.duration_secs, { min: 0, max: 36000, label: 'El tiempo (seg)', integer: true });
      if (d.error) return res.status(400).json({ error: d.error });
      cleanSets.push({
        set_number: s.set_number,
        set_type: isIso ? 'isometry' : 'normal',
        weight_kg: w.value,
        reps_done: isIso ? null : r.value,
        duration_secs: isIso ? d.value : null,
      });
    }

    // Verify exercise belongs to this user's active plan
    const [[ownerCheck]] = await db.query(
      `SELECT we.id FROM workout_exercises we
       JOIN workout_days wd ON wd.id = we.day_id
       JOIN workout_plans wp ON wp.id = wd.plan_id
       WHERE we.id = ? AND wp.user_id = ?`,
      [exercise_id, uid]
    );
    if (!ownerCheck) return res.status(403).json({ error: 'Ejercicio no encontrado en tu plan' });

    const date = logged_date || colombiaToday();

    // Delete previous logs for this exercise on this date
    await db.query('DELETE FROM workout_logs WHERE exercise_id=? AND user_id=? AND logged_date=?',
      [exercise_id, uid, date]);

    for (const s of cleanSets) {
      await db.query(
        'INSERT INTO workout_logs (id, exercise_id, user_id, logged_date, set_number, weight_kg, reps_done, set_type, duration_secs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), exercise_id, uid, date, s.set_number, s.weight_kg, s.reps_done, s.set_type, s.duration_secs]
      );
    }
    res.json({ message: 'Registrado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /workout/history/:exerciseId — historial de un ejercicio
router.get('/history/:exerciseId', async (req, res) => {
  try {
    const uid = req.user.id;
    const [logs] = await db.query(
      `SELECT logged_date, set_number, weight_kg, reps_done, set_type, duration_secs
       FROM workout_logs WHERE exercise_id=? AND user_id=?
       ORDER BY logged_date DESC, set_number ASC
       LIMIT 50`,
      [req.params.exerciseId, uid]
    );
    const grouped = [];
    const byDate = {};
    for (const row of logs) {
      const d = row.logged_date instanceof Date
        ? row.logged_date.toISOString().slice(0, 10)
        : String(row.logged_date).slice(0, 10);
      if (!byDate[d]) { byDate[d] = []; grouped.push({ date: d, sets: byDate[d] }); }
      byDate[d].push({ set_number: row.set_number, weight_kg: row.weight_kg, reps_done: row.reps_done, set_type: row.set_type, duration_secs: row.duration_secs });
    }
    res.json({ history: grouped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /workout/activity — guarda calentamiento o cardio de una sesión
router.post('/activity', async (req, res) => {
  try {
    const uid = req.user.id;
    const { day_id, type, activity_name, duration_mins, date } = req.body;
    const session_date = date || colombiaToday();
    await db.query(
      `INSERT INTO workout_activity_logs (id, user_id, day_id, session_date, type, activity_name, duration_mins)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE activity_name=VALUES(activity_name), duration_mins=VALUES(duration_mins)`,
      [uuidv4(), uid, day_id, session_date, type, activity_name, duration_mins || null]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /workout/activity — borra el calentamiento/cardio de un día para una fecha
router.delete('/activity', async (req, res) => {
  try {
    const uid = req.user.id;
    const { day_id, type, date } = req.body;
    if (!day_id || !type) return res.status(400).json({ error: 'day_id y type requeridos' });
    const session_date = date || colombiaToday();
    await db.query(
      'DELETE FROM workout_activity_logs WHERE user_id=? AND day_id=? AND type=? AND session_date=?',
      [uid, day_id, type, session_date]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /workout/activity/:dayId — trae actividades de las últimas sesiones de un día
router.get('/activity/:dayId', async (req, res) => {
  try {
    const uid = req.user.id;
    const [rows] = await db.query(
      `SELECT * FROM workout_activity_logs WHERE user_id=? AND day_id=? ORDER BY session_date DESC LIMIT 20`,
      [uid, req.params.dayId]
    );
    res.json({ activities: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /workout/free — guardar sesión de entrenamiento libre
router.post('/free', async (req, res) => {
  try {
    const uid = req.user.id;
    const { exercises, note, date } = req.body;
    if (!Array.isArray(exercises) || exercises.length === 0)
      return res.status(400).json({ error: 'Se requiere al menos un ejercicio' });
    const session_date = date || colombiaToday();

    const id = uuidv4();
    await db.query(
      `INSERT INTO free_workout_logs (id, user_id, session_date, note, exercises)
       VALUES (?, ?, ?, ?, ?)`,
      [id, uid, session_date, note || null, JSON.stringify(exercises)]
    );

    await db.query(
      `INSERT INTO daily_tracking (id, user_id, tracked_date, workout_done) VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE workout_done=1`,
      [uuidv4(), uid, session_date]
    );

    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /workout/free — historial de entrenamientos libres
router.get('/free', async (req, res) => {
  try {
    const uid = req.user.id;
    const [rows] = await db.query(
      `SELECT * FROM free_workout_logs WHERE user_id=? ORDER BY session_date DESC LIMIT 30`,
      [uid]
    );
    res.json({ sessions: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Ejercicios extra agregados en el día (solo para esa sesión) ───────────────
// POST /workout/extra-exercise — agrega un ejercicio nuevo al día de hoy
router.post('/extra-exercise', async (req, res) => {
  try {
    const uid = req.user.id;
    const { day_id, name, sets, date } = req.body;
    if (!day_id || !name || !String(name).trim()) return res.status(400).json({ error: 'Nombre y día requeridos' });
    const session_date = date || colombiaToday();

    // Normaliza las series (normal: reps+peso · isometria: peso+tiempo)
    const cleanSets = (Array.isArray(sets) ? sets : []).map((s, i) => {
      const iso = s.set_type === 'isometry';
      const num = (v, max) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Math.min(Number(v), max));
      return {
        set_number: i + 1,
        set_type: iso ? 'isometry' : 'normal',
        weight_kg: num(s.weight_kg, 999.99),
        reps_done: iso ? null : num(s.reps_done, 9999),
        duration_secs: iso ? num(s.duration_secs, 36000) : null,
      };
    });

    const id = uuidv4();
    await db.query(
      'INSERT INTO session_extra_exercises (id, user_id, day_id, session_date, name, sets) VALUES (?, ?, ?, ?, ?, ?)',
      [id, uid, day_id, session_date, String(name).trim(), JSON.stringify(cleanSets)]
    );
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /workout/extra-exercises/:dayId?date= — ejercicios extra de un día en una fecha
router.get('/extra-exercises/:dayId', async (req, res) => {
  try {
    const uid = req.user.id;
    const date = req.query.date || colombiaToday();
    const [rows] = await db.query(
      'SELECT * FROM session_extra_exercises WHERE user_id=? AND day_id=? AND session_date=? ORDER BY created_at ASC',
      [uid, req.params.dayId, date]
    );
    const exercises = rows.map(r => ({ id: r.id, name: r.name, session_date: r.session_date, sets: (() => { try { return JSON.parse(r.sets) || []; } catch { return []; } })() }));
    res.json({ exercises });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /workout/extra-exercise/:id
router.delete('/extra-exercise/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM session_extra_exercises WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
