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
  } catch (e) { res.serverError(e); }
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
  } catch (e) { res.serverError(e); }
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
  } catch (e) { res.serverError(e); }
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
  } catch (e) { res.serverError(e); }
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
  } catch (e) { res.serverError(e); }
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

    // Cada serie tiene 3 campos opcionales: peso, reps e isometría (seg).
    // Se guarda lo que venga; set_type='isometry' si trae tiempo (para marcarlo).
    const cleanSets = [];
    for (const s of sets) {
      const w = sanitizeNumber(s.weight_kg, { min: 0, max: 999.99, label: 'El peso (kg)' });
      if (w.error) return res.status(400).json({ error: w.error });
      const r = sanitizeNumber(s.reps_done, { min: 0, max: 9999, label: 'Las repeticiones', integer: true });
      if (r.error) return res.status(400).json({ error: r.error });
      const d = sanitizeNumber(s.duration_secs, { min: 0, max: 36000, label: 'El tiempo (seg)', integer: true });
      if (d.error) return res.status(400).json({ error: d.error });
      cleanSets.push({
        set_number: s.set_number,
        set_type: d.value != null ? 'isometry' : 'normal',
        weight_kg: w.value,
        reps_done: r.value,
        duration_secs: d.value,
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
  } catch (e) { res.serverError(e); }
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
  } catch (e) { res.serverError(e); }
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
  } catch (e) { res.serverError(e); }
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
  } catch (e) { res.serverError(e); }
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
  } catch (e) { res.serverError(e); }
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
  } catch (e) { res.serverError(e); }
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
  } catch (e) { res.serverError(e); }
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
    const num = (v, max) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Math.min(Number(v), max));
    const cleanSets = (Array.isArray(sets) ? sets : []).map((s, i) => {
      const dur = num(s.duration_secs, 36000);
      return {
        set_number: i + 1,
        set_type: dur != null ? 'isometry' : 'normal',
        weight_kg: num(s.weight_kg, 999.99),
        reps_done: num(s.reps_done, 9999),
        duration_secs: dur,
      };
    });

    const id = uuidv4();
    await db.query(
      'INSERT INTO session_extra_exercises (id, user_id, day_id, session_date, name, sets) VALUES (?, ?, ?, ?, ?, ?)',
      [id, uid, day_id, session_date, String(name).trim(), JSON.stringify(cleanSets)]
    );
    res.json({ ok: true, id });
  } catch (e) { res.serverError(e); }
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
  } catch (e) { res.serverError(e); }
});

// DELETE /workout/extra-exercise/:id
router.delete('/extra-exercise/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM session_extra_exercises WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.serverError(e); }
});

// GET /workout/share/:dayId?date=YYYY-MM-DD
// Datos para la tarjeta "Entreno completado" que la clienta comparte en redes.
// La imagen se arma en el celular (no en el servidor); aquí solo van los datos.
const SHARE_PHRASES = [
  'Lo hiciste.', 'Sin excusas.', 'Una más.', 'Imparable.', 'Puro carácter.',
  'Hoy sí.', 'De postergarlo a hacerlo.', 'Esto es constancia.',
  'Nadie te lo regaló.', 'Tu mejor versión.', 'Esto se siente bien.', 'Fuerte y constante.',
];
const SHARE_DESIGNS = ['dark', 'coral', 'night'];
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

router.get('/share/:dayId', async (req, res) => {
  try {
    const uid = req.user.id;
    const dayId = req.params.dayId;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : colombiaToday();

    // El día debe pertenecer al plan de esta clienta
    const [[day]] = await db.query(
      `SELECT wd.id, wd.day_name
       FROM workout_days wd JOIN workout_plans wp ON wp.id = wd.plan_id
       WHERE wd.id=? AND wp.user_id=?`, [dayId, uid]);
    if (!day) return res.status(404).json({ error: 'Día no encontrado' });

    const [exRows] = await db.query('SELECT id, name, sets, reps FROM workout_exercises WHERE day_id=?', [dayId]);
    const exName = {}, exPlan = {};
    exRows.forEach(e => { exName[e.id] = e.name; exPlan[e.id] = { sets: Number(e.sets) || 0, reps: (String(e.reps || '').match(/\d+/) || [0])[0] | 0 }; });
    const exIds = exRows.map(e => e.id);

    let logs = [];
    if (exIds.length) {
      [logs] = await db.query(
        `SELECT exercise_id, weight_kg, reps_done, created_at
         FROM workout_logs WHERE user_id=? AND logged_date=? AND exercise_id IN (?)`,
        [uid, date, exIds]);
    }
    const sets = logs.length;
    const exercisesDone = new Set(logs.map(l => l.exercise_id)).size || exRows.length;

    // Duración estimada por el lapso entre el primer y último registro; kcal simple para fuerza
    let durMin = 0;
    if (logs.length >= 2) {
      const ts = logs.map(l => new Date(l.created_at).getTime());
      durMin = Math.round((Math.max(...ts) - Math.min(...ts)) / 60000);
    }
    durMin = Math.min(Math.max(durMin, 20), 120);
    const kcal = Math.round(durMin * 6 / 5) * 5; // redondeado a 5

    // Logros del día (siempre hay algo que destacar). Prioridad por _s descendente:
    // récord de peso > récord de reps > más reps que el plan > series extra >
    // ejercicio adicional > cardio/calentamiento > (respaldo) series completadas.
    const H = [];
    for (const exId of new Set(logs.map(l => l.exercise_id))) {
      const t = logs.filter(l => l.exercise_id === exId);
      const maxW = Math.max(...t.map(l => Number(l.weight_kg) || 0));
      const maxR = Math.max(...t.map(l => Number(l.reps_done) || 0));
      const doneSets = t.length;
      const plan = exPlan[exId] || { sets: 0, reps: 0 };
      const [[prev]] = await db.query(
        'SELECT MAX(weight_kg) AS w, MAX(reps_done) AS r FROM workout_logs WHERE user_id=? AND exercise_id=? AND logged_date < ?',
        [uid, exId, date]);
      const prevW = Number(prev?.w) || 0, prevR = Number(prev?.r) || 0;
      if (maxW > 0 && prevW > 0 && maxW > prevW) {
        H.push({ ic: '🏅', big: `+${Math.round((maxW - prevW) * 10) / 10} kg`, name: exName[exId], note: 'Récord de peso', _s: 1000 + maxW });
      } else if (maxR > 0 && prevR > 0 && maxR > prevR) {
        H.push({ ic: '⚡', big: `+${maxR - prevR} reps`, name: exName[exId], note: 'Récord de reps', _s: 900 + maxR });
      } else if (plan.reps > 0 && maxR > plan.reps) {
        H.push({ ic: '💪', big: `${maxR} reps`, name: exName[exId], note: `Tu plan pedía ${plan.reps}`, _s: 700 + (maxR - plan.reps) });
      } else if (plan.sets > 0 && doneSets > plan.sets) {
        H.push({ ic: '🔁', big: `+${doneSets - plan.sets} series`, name: exName[exId], note: 'Series extra', _s: 600 + doneSets });
      }
    }
    // Ejercicios adicionales de ese día
    const [extras] = await db.query(
      'SELECT name FROM session_extra_exercises WHERE user_id=? AND day_id=? AND session_date=?', [uid, dayId, date]);
    if (extras.length) {
      H.push({ ic: '➕', big: `+${extras.length}`, name: extras.length > 1 ? 'Ejercicios extra' : 'Ejercicio extra', note: extras.map(e => e.name).slice(0, 2).join(', '), _s: 500 });
    }
    // Cardio y calentamiento (son cosas distintas)
    const [acts] = await db.query(
      'SELECT type, duration_mins FROM workout_activity_logs WHERE user_id=? AND day_id=? AND session_date=?', [uid, dayId, date]);
    const cardioMin = acts.filter(a => a.type === 'cardio' || a.type === 'cardio_inicio').reduce((s, a) => s + (Number(a.duration_mins) || 0), 0);
    const warmMin = acts.filter(a => a.type === 'warmup').reduce((s, a) => s + (Number(a.duration_mins) || 0), 0);
    if (cardioMin > 0) H.push({ ic: '🏃', big: `${cardioMin} min`, name: 'Cardio', note: 'Sumaste cardio hoy', _s: 400 });
    if (warmMin > 0) H.push({ ic: '🔥', big: `${warmMin} min`, name: 'Calentamiento', note: 'Entraste en calor', _s: 350 });

    // Bienestar (prioridad baja): sueño > 7h y meta de agua cumplida
    const [[dt]] = await db.query('SELECT water_glasses, sleep_hours FROM daily_tracking WHERE user_id=? AND tracked_date=?', [uid, date]);
    const sleepH = Number(dt?.sleep_hours) || 0;
    const water = Number(dt?.water_glasses) || 0;
    if (sleepH > 7) H.push({ ic: '😴', big: `${sleepH} h`, name: 'Dormiste bien', note: 'Más de 7 horas', _s: 250 });
    if (water >= 8) H.push({ ic: '💧', big: `${water}`, name: 'Vasos de agua', note: 'Meta cumplida', _s: 200 });

    // Respaldo: si no hubo nada de lo anterior pero sí entrenó
    if (H.length === 0 && sets > 0) H.push({ ic: '✅', big: `${sets}`, name: 'Series completas', note: 'Diste todo hoy', _s: 1 });

    // Un solo logro, el de mayor prioridad (nombres largos no caben bien en 2 columnas)
    H.sort((a, b) => b._s - a._s);
    const topRecords = H.slice(0, 1).map(({ _s, ...r }) => r);

    // Racha (misma lógica que el dashboard: 3 días de gracia mínimo)
    const [[quest]] = await db.query('SELECT training_days_week FROM questionnaire_data WHERE user_id=?', [uid]);
    const [logDays] = await db.query(
      `SELECT DISTINCT DATE_FORMAT(logged_date,'%Y-%m-%d') d FROM workout_logs WHERE user_id=? AND logged_date<=? ORDER BY d DESC LIMIT 730`, [uid, date]);
    const [trackDays] = await db.query(
      `SELECT DATE_FORMAT(tracked_date,'%Y-%m-%d') d FROM daily_tracking WHERE user_id=? AND (workout_done=1 OR diet_followed=1) AND tracked_date<=? ORDER BY d DESC LIMIT 730`, [uid, date]);
    const active = new Set([...logDays.map(r => r.d), ...trackDays.map(r => r.d)]);
    const perWeek = Math.min(Math.max(parseInt(quest?.training_days_week) || 5, 1), 6);
    const maxRest = Math.max(7 - perWeek, 3);
    let streak = 0, rest = 0, first = true, t = new Date(date).getTime();
    while (true) {
      const ds = new Date(t).toISOString().slice(0, 10);
      if (active.has(ds)) { streak++; rest = 0; }
      else if (first) { /* hoy aún cuenta */ }
      else { rest++; if (rest > maxRest) break; }
      first = false; t -= 86400000;
      if (streak > 730) break;
    }

    // Zona (etiqueta) deducida del nombre de la rutina; si no se reconoce, no se muestra
    const dn = String(day.day_name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let zone = null, zoneEmoji = null;
    if (/(glute|pierna|cuadr|femoral|inferior|sentadilla|pantorrilla)/.test(dn)) { zone = 'Tren inferior'; zoneEmoji = '🦵'; }
    else if (/(pecho|espalda|brazo|hombro|bicep|tricep|superior|torso|dorsal)/.test(dn)) { zone = 'Tren superior'; zoneEmoji = '💪'; }

    // Fecha (en Colombia) para la línea "cuándo" — sin hora
    const dObj = new Date(date + 'T12:00:00Z');
    const when = dObj.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

    // Frase: récord > racha larga > rotación
    let phrase;
    if (topRecords.length) phrase = pick(['¡Récord nuevo!', 'Más fuerte que ayer.']);
    else if (streak >= 7) phrase = `${streak} días imparable.`;
    else phrase = pick(SHARE_PHRASES);

    // Diseño por turnos (rota en cada compartir)
    const [[u]] = await db.query('SELECT COALESCE(share_card_count,0) AS n FROM users WHERE id=?', [uid]);
    const design = SHARE_DESIGNS[(u.n || 0) % SHARE_DESIGNS.length];
    await db.query('UPDATE users SET share_card_count = COALESCE(share_card_count,0)+1 WHERE id=?', [uid]);

    res.json({
      routine: day.day_name || 'Mi entreno',
      zone, zoneEmoji, when,
      exercises: exercisesDone, sets, kcal,
      streak, records: topRecords, phrase, design,
    });
  } catch (e) { res.serverError(e); }
});

module.exports = router;
