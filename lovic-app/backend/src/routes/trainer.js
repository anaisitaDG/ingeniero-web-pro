const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { generateRoutine, generateNutritionPlan, suggestDayName } = require('../services/ai');

router.use(requireAuth);

const requireTrainer = (req, res, next) => {
  if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Solo entrenadores' });
  next();
};

router.use(requireTrainer);

// GET /trainer/clients
router.get('/clients', async (req, res) => {
  const [clients] = await db.query(
    `SELECT u.id, u.name, u.email, u.created_at,
       q.main_goal, q.weight_kg, q.height_cm,
       (SELECT logged_at FROM measurements WHERE user_id=u.id ORDER BY logged_at DESC LIMIT 1) AS last_measurement
     FROM users u
     LEFT JOIN questionnaire_data q ON q.user_id = u.id
     WHERE u.role = 'client'
     ORDER BY u.created_at DESC`,
    []
  );
  res.json({ clients });
});

// GET /trainer/clients/:id
router.get('/clients/:id', async (req, res) => {
  const uid = req.params.id;

  const [[user]] = await db.query('SELECT * FROM users WHERE id=? AND role="client"', [uid]);
  if (!user) return res.status(404).json({ error: 'Cliente no encontrado' });

  const [[questionnaire]] = await db.query('SELECT * FROM questionnaire_data WHERE user_id=?', [uid]);

  const [measurements] = await db.query(
    'SELECT * FROM measurements WHERE user_id=? ORDER BY logged_at DESC LIMIT 10', [uid]
  );

  const [bioimpedance] = await db.query(
    'SELECT * FROM bioimpedance WHERE user_id=? ORDER BY logged_at DESC LIMIT 5', [uid]
  );

  const [[routine]] = await db.query(
    'SELECT * FROM routines WHERE user_id=? AND is_active=TRUE ORDER BY created_at DESC LIMIT 1', [uid]
  );

  const [[nutrition]] = await db.query(
    'SELECT * FROM nutrition_plans WHERE user_id=? AND is_active=TRUE ORDER BY created_at DESC LIMIT 1', [uid]
  );

  const [adherence] = await db.query(
    `SELECT COUNT(*) as total_days, SUM(workout_done) as workout_days, SUM(diet_followed) as diet_days
     FROM daily_tracking WHERE user_id=? AND tracked_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
    [uid]
  );

  res.json({ user, questionnaire, measurements, bioimpedance, routine, nutrition_plan: nutrition, adherence: adherence[0] });
});

// POST /trainer/suggest-day-name — sugiere nombre de día según ejercicios
router.post('/suggest-day-name', async (req, res) => {
  const { exercises } = req.body;
  if (!Array.isArray(exercises) || exercises.length === 0) return res.status(400).json({ error: 'exercises requerido' });
  const names = exercises.filter(Boolean);
  if (names.length === 0) return res.status(400).json({ error: 'Sin ejercicios' });
  const name = await suggestDayName(names);
  res.json({ name });
});

// GET /trainer/clients/:id/workout — obtiene plan estructurado
router.get('/clients/:id/workout', async (req, res) => {
  const uid = req.params.id;
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
    day.exercises = exercises;
  }
  res.json({ plan: { ...plan, days } });
});

// PUT /trainer/clients/:id/workout — guarda plan estructurado completo
router.put('/clients/:id/workout', async (req, res) => {
  const uid = req.params.id;
  const { days } = req.body;
  if (!Array.isArray(days)) return res.status(400).json({ error: 'days requerido' });

  await db.query('UPDATE workout_plans SET is_active=FALSE WHERE user_id=?', [uid]);
  const planId = uuidv4();
  await db.query('INSERT INTO workout_plans (id, user_id, is_active) VALUES (?, ?, TRUE)', [planId, uid]);

  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    const dayId = uuidv4();
    await db.query(
      'INSERT INTO workout_days (id, plan_id, day_name, day_order, warmup_type, warmup_duration, cardio_type, cardio_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [dayId, planId, day.day_name, di, day.warmup_type || null, day.warmup_duration || null, day.cardio_type || null, day.cardio_duration || null]);
    const exercises = day.exercises || [];
    for (let ei = 0; ei < exercises.length; ei++) {
      const ex = exercises[ei];
      await db.query(
        'INSERT INTO workout_exercises (id, day_id, name, youtube_url, sets, reps, weight_kg, exercise_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), dayId, ex.name, ex.youtube_url || null, ex.sets || 3, ex.reps || '10', ex.weight_kg || null, ei]
      );
    }
  }
  res.json({ message: 'Plan guardado' });
});

// PUT /trainer/clients/:id/routine — guarda rutina manual
router.put('/clients/:id/routine', async (req, res) => {
  const uid = req.params.id;
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Contenido requerido' });

  await db.query('UPDATE routines SET is_active=FALSE WHERE user_id=?', [uid]);
  await db.query(
    'INSERT INTO routines (id, user_id, content, is_active) VALUES (?, ?, ?, TRUE)',
    [uuidv4(), uid, content.trim()]
  );
  res.json({ routine: content.trim() });
});

// PUT /trainer/clients/:id/nutrition — guarda plan nutricional manual
router.put('/clients/:id/nutrition', async (req, res) => {
  try {
    const uid = req.params.id;
    const { content } = req.body;
    console.log('[nutrition PUT] uid:', uid, 'content length:', content?.length);
    if (!content || !content.trim()) return res.status(400).json({ error: 'Contenido requerido' });

    console.log('[nutrition PUT] running UPDATE...');
    await db.query('UPDATE nutrition_plans SET is_active=FALSE WHERE user_id=?', [uid]);
    console.log('[nutrition PUT] UPDATE done, running INSERT...');
    const planId = uuidv4();
    await db.query(
      'INSERT INTO nutrition_plans (id, user_id, plan, content, is_active) VALUES (?, ?, ?, ?, TRUE)',
      [planId, uid, JSON.stringify({ text: content.trim() }), content.trim()]
    );
    console.log('[nutrition PUT] INSERT done');
    const calories = extractCalorieTarget(content);
    if (calories) await db.query('UPDATE users SET calorie_target=? WHERE id=?', [calories, uid]);
    res.json({ nutrition_plan: { content: content.trim(), plan: content.trim() } });
  } catch (e) {
    console.error('[nutrition PUT] ERROR:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /trainer/clients/:id/routine — genera rutina con IA
router.post('/clients/:id/routine', async (req, res) => {
  const uid = req.params.id;
  const { override_prompt } = req.body;

  const [[questionnaire]] = await db.query('SELECT * FROM questionnaire_data WHERE user_id=?', [uid]);
  if (!questionnaire) return res.status(400).json({ error: 'El cliente no tiene cuestionario' });

  const content = await generateRoutine(questionnaire, override_prompt);

  await db.query('UPDATE routines SET is_active=FALSE WHERE user_id=?', [uid]);
  await db.query(
    'INSERT INTO routines (id, user_id, content, is_active) VALUES (?, ?, ?, TRUE)',
    [uuidv4(), uid, content]
  );

  res.json({ routine: content });
});

// POST /trainer/clients/:id/nutrition — genera plan nutricional con IA
router.post('/clients/:id/nutrition', async (req, res) => {
  const uid = req.params.id;
  const { override_prompt } = req.body;

  const [[questionnaire]] = await db.query('SELECT * FROM questionnaire_data WHERE user_id=?', [uid]);
  if (!questionnaire) return res.status(400).json({ error: 'El cliente no tiene cuestionario' });

  const [[user]] = await db.query('SELECT * FROM users WHERE id=?', [uid]);
  const content = await generateNutritionPlan(questionnaire, user, override_prompt);

  await db.query('UPDATE nutrition_plans SET is_active=FALSE WHERE user_id=?', [uid]);
  const planId = uuidv4();
  await db.query(
    'INSERT INTO nutrition_plans (id, user_id, plan, content, is_active) VALUES (?, ?, ?, ?, TRUE)',
    [planId, uid, JSON.stringify({ text: content }), content]
  );

  const calories = extractCalorieTarget(content);
  if (calories) {
    await db.query('UPDATE users SET calorie_target=? WHERE id=?', [calories, uid]);
  }

  res.json({ nutrition_plan: content });
});

// PUT /trainer/clients/:id/targets — actualiza metas de calorías y macros
router.put('/clients/:id/targets', async (req, res) => {
  const { calorie_target, protein_target_g, carbs_target_g, fat_target_g } = req.body;
  const uid = req.params.id;
  await db.query(
    `UPDATE users SET
       calorie_target   = COALESCE(?, calorie_target),
       protein_target_g = COALESCE(?, protein_target_g),
       carbs_target_g   = COALESCE(?, carbs_target_g),
       fat_target_g     = COALESCE(?, fat_target_g)
     WHERE id = ?`,
    [calorie_target || null, protein_target_g || null, carbs_target_g || null, fat_target_g || null, uid]
  );
  res.json({ message: 'Metas actualizadas' });
});

// POST /trainer/clients/:id/invite — envía magic link de acceso (plan listo)
router.post('/clients/:id/invite', async (req, res) => {
  const [[user]] = await db.query('SELECT * FROM users WHERE id=? AND role="client"', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'Cliente no encontrado' });

  const { sendMagicLink } = require('../services/email');
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.query('INSERT INTO magic_links (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, token, expiresAt]);
  await sendMagicLink(user.email, user.name, token, 'invite');

  res.json({ message: 'Invitación enviada' });
});

// GET /trainer/clients/:id/progress — fotos + historial de medidas
router.get('/clients/:id/progress', async (req, res) => {
  const uid = req.params.id;
  const [measurements] = await db.query(
    'SELECT * FROM measurements WHERE user_id=? ORDER BY logged_at DESC LIMIT 30', [uid]
  );
  const [photos] = await db.query(
    'SELECT * FROM progress_photos WHERE user_id=? ORDER BY taken_at DESC LIMIT 20', [uid]
  );
  res.json({ measurements, photos });
});

// GET /trainer/clients/:id/adherence-detail — día a día últimos 60 días
router.get('/clients/:id/adherence-detail', async (req, res) => {
  const uid = req.params.id;
  const [rows] = await db.query(
    `SELECT tracked_date, workout_done, diet_followed, water_glasses
     FROM daily_tracking WHERE user_id=? AND tracked_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
     ORDER BY tracked_date DESC`, [uid]
  );
  res.json({ days: rows });
});

// GET /trainer/clients/:id/workout-logs — sesiones agrupadas por fecha + resumen
router.get('/clients/:id/workout-logs', async (req, res) => {
  try {
  const uid = req.params.id;

  // Logs de ejercicios
  const [logs] = await db.query(
    `SELECT wl.logged_date, wl.set_number, wl.weight_kg, wl.reps_done,
            we.name as exercise_name, wd.day_name
     FROM workout_logs wl
     JOIN workout_exercises we ON we.id = wl.exercise_id
     JOIN workout_days wd ON wd.id = we.day_id
     WHERE wl.user_id=?
     ORDER BY wl.logged_date DESC, wd.day_name, we.name, wl.set_number ASC
     LIMIT 500`, [uid]
  );

  // Días completados (workout_done)
  const [trackRows] = await db.query(
    `SELECT DATE_FORMAT(tracked_date, '%Y-%m-%d') as d
     FROM daily_tracking WHERE user_id=? AND workout_done=1
     ORDER BY tracked_date DESC`, [uid]
  );

  // Entrenamientos libres
  const [freeRows] = await db.query(
    `SELECT * FROM free_workout_logs WHERE user_id=? ORDER BY session_date DESC LIMIT 50`, [uid]
  );

  // Agrupar ejercicios por fecha
  const byDate = {};
  for (const row of logs) {
    const d = row.logged_date instanceof Date ? row.logged_date.toISOString().slice(0,10) : String(row.logged_date).slice(0,10);
    if (!byDate[d]) byDate[d] = { date: d, day_name: row.day_name, exercises: {}, type: 'routine' };
    if (!byDate[d].exercises[row.exercise_name]) byDate[d].exercises[row.exercise_name] = [];
    byDate[d].exercises[row.exercise_name].push({ set: row.set_number, weight: row.weight_kg, reps: row.reps_done });
  }

  const sessions = Object.values(byDate).map(s => ({
    date: s.date,
    day_name: s.day_name,
    type: 'routine',
    exercises: Object.entries(s.exercises).map(([name, sets]) => ({
      name,
      max_weight: Math.max(...sets.map(x => parseFloat(x.weight) || 0)) || null,
      reps: sets[0]?.reps || null,
      sets,
    })),
  }));

  // Agregar entrenamientos libres
  for (const f of freeRows) {
    const d = f.session_date instanceof Date ? f.session_date.toISOString().slice(0,10) : String(f.session_date).slice(0,10);
    const exs = typeof f.exercises === 'string' ? JSON.parse(f.exercises) : f.exercises;
    sessions.push({ date: d, day_name: 'Entrenamiento libre', type: 'free', note: f.note, exercises: exs.map(e => ({ name: e.name, type: e.type, sets: e.sets, reps: e.reps, weight_kg: e.weight_kg, duration_secs: e.duration_secs, duration_mins: e.duration_mins, max_weight: e.weight_kg || null })) });
  }

  // Ordenar por fecha desc
  sessions.sort((a, b) => b.date.localeCompare(a.date));

  // Resumen
  const trainedDates = new Set([...trackRows.map(r => r.d), ...sessions.map(s => s.date)]);
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyStr = thirtyDaysAgo.toISOString().slice(0,10);
  const daysThisMonth = [...trainedDates].filter(d => d >= thirtyStr).length;

  // Racha
  const sorted = [...trainedDates].sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().slice(0,10);
  const msPerDay = 86400000;
  let expected = new Date(today).getTime();
  while (true) {
    const ds = new Date(expected).toISOString().slice(0,10);
    if (!trainedDates.has(ds)) break;
    streak++; expected -= msPerDay;
  }

  res.json({ sessions, summary: { streak, days_this_month: daysThisMonth, total_sessions: sessions.length } });
  } catch (err) {
    console.error('workout-logs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET/PUT /trainer/clients/:id/notes — notas privadas del entrenador
router.get('/clients/:id/notes', async (req, res) => {
  const [[user]] = await db.query('SELECT trainer_notes FROM users WHERE id=?', [req.params.id]);
  res.json({ notes: user?.trainer_notes || '' });
});

router.put('/clients/:id/notes', async (req, res) => {
  const { notes } = req.body;
  await db.query('UPDATE users SET trainer_notes=? WHERE id=?', [notes || '', req.params.id]);
  res.json({ message: 'Notas guardadas' });
});

// POST /trainer/invite-new — crea cliente nuevo y envía valoración/onboarding
router.post('/invite-new', async (req, res) => {
  const { email, name } = req.body;
  if (!email || !name) return res.status(400).json({ error: 'Email y nombre requeridos' });

  const [[existing]] = await db.query('SELECT id FROM users WHERE email=?', [email]);
  let userId;
  if (existing) {
    userId = existing.id;
  } else {
    userId = uuidv4();
    await db.query('INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, "client")', [userId, email, name]);
  }

  const { sendMagicLink } = require('../services/email');
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.query('INSERT INTO magic_links (user_id, token, expires_at) VALUES (?, ?, ?)', [userId, token, expiresAt]);
  await sendMagicLink(email, name, token, 'onboarding');

  res.json({ message: 'Valoración enviada', userId });
});

function extractCalorieTarget(content) {
  const match = content.match(/(\d{3,4})\s*kcal/i);
  return match ? parseInt(match[1]) : null;
}

module.exports = router;
