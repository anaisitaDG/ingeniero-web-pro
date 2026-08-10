const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { generateRoutine, generateNutritionPlan, suggestDayName } = require('../services/ai');
const { gravatarUrl } = require('../utils/gravatar');
const { webpush } = require('./push');

router.use(requireAuth);

const requireTrainer = (req, res, next) => {
  if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Solo entrenadores' });
  next();
};

router.use(requireTrainer);

// GET /trainer/clients
router.get('/clients', async (req, res) => {
  try {
    const [clients] = await db.query(
      `SELECT u.id, u.name, u.email, u.created_at, u.avatar_url,
         q.main_goal, q.weight_kg AS initial_weight_kg, q.height_cm,
         (SELECT weight_kg FROM measurements WHERE user_id=u.id ORDER BY logged_at DESC LIMIT 1) AS current_weight_kg,
         (SELECT logged_at FROM measurements WHERE user_id=u.id ORDER BY logged_at DESC LIMIT 1) AS last_measurement,
         (SELECT MAX(tracked_date) FROM daily_tracking WHERE user_id=u.id AND workout_done=1) AS last_trained,
         (SELECT COUNT(*) FROM daily_tracking WHERE user_id=u.id AND workout_done=1 AND tracked_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)) AS workouts_this_week,
         (SELECT MAX(logged_at) FROM food_logs WHERE user_id=u.id) AS last_food_log
       FROM users u
       LEFT JOIN questionnaire_data q ON q.user_id = u.id
       WHERE u.role = 'client'
       ORDER BY u.created_at DESC`,
      []
    );
    for (const c of clients) c.gravatar_url = gravatarUrl(c.email);
    res.json({ clients });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /trainer/clients/:id
router.get('/clients/:id', async (req, res) => {
  try {
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
      `SELECT 30 as total_days, SUM(workout_done) as workout_days, SUM(diet_followed) as diet_days
       FROM daily_tracking WHERE user_id=? AND tracked_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
      [uid]
    );

    const { password_hash, ...safeUser } = user;
    safeUser.gravatar_url = gravatarUrl(user.email);
    res.json({ user: safeUser, questionnaire, measurements, bioimpedance, routine, nutrition_plan: nutrition, adherence: adherence[0] });
  } catch (e) {
    console.error('[GET /clients/:id] ERROR:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /trainer/suggest-day-name — sugiere nombre de día según ejercicios
router.post('/suggest-day-name', async (req, res) => {
  try {
    const { exercises } = req.body;
    if (!Array.isArray(exercises) || exercises.length === 0) return res.status(400).json({ error: 'exercises requerido' });
    const names = exercises.filter(Boolean);
    if (names.length === 0) return res.status(400).json({ error: 'Sin ejercicios' });
    const name = await suggestDayName(names);
    res.json({ name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /trainer/clients/:id/nutrition-adherence — constancia + qué comió (para Lorena)
router.get('/clients/:id/nutrition-adherence', async (req, res) => {
  try {
    const uid = req.params.id;
    const [[u]] = await db.query('SELECT calorie_target, protein_target_g FROM users WHERE id=? AND role="client"', [uid]);
    if (!u) return res.status(404).json({ error: 'Cliente no encontrado' });
    const target = u.calorie_target || 2000;
    const pTarget = u.protein_target_g || null;
    const today = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);

    const [rows] = await db.query(
      `SELECT logged_at, SUM(calories) AS c, SUM(protein_g) AS p
       FROM food_logs WHERE user_id=? AND logged_at >= DATE_SUB(?, INTERVAL 30 DAY)
       GROUP BY logged_at`, [uid, today]);
    const map = {};
    for (const r of rows) {
      const d = r.logged_at instanceof Date ? r.logged_at.toISOString().slice(0, 10) : String(r.logged_at).slice(0, 10);
      map[d] = { c: Number(r.c), p: Number(r.p) };
    }
    const inTarget = c => target && c >= target * 0.85 && c <= target * 1.10;
    const dateAgo = n => { const [y, m, d] = today.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); dt.setUTCDate(dt.getUTCDate() - n); return dt.toISOString().slice(0, 10); };
    let daysLogged = 0, daysInTarget = 0, sumC = 0, sumP = 0, proteinDaysMet = 0;
    for (let i = 0; i < 7; i++) {
      const day = map[dateAgo(i)];
      if (!day) continue;
      daysLogged++; sumC += day.c; sumP += day.p;
      if (inTarget(day.c)) daysInTarget++;
      if (pTarget && day.p >= pTarget * 0.9) proteinDaysMet++;
    }
    // Días sin registrar (desde el último log)
    const lastLog = rows.length ? Object.keys(map).sort().pop() : null;
    const daysSinceLog = lastLog ? Math.floor((new Date(today) - new Date(lastLog)) / 86400000) : null;

    // Detalle últimos 14 días (qué comió)
    const [items] = await db.query(
      `SELECT id, logged_at, input_text, parsed_items, meal_type, calories
       FROM food_logs WHERE user_id=? AND logged_at >= DATE_SUB(?, INTERVAL 14 DAY)
       ORDER BY logged_at DESC, created_at ASC`, [uid, today]);
    const itemsByDay = {};
    for (const it of items) {
      const d = it.logged_at instanceof Date ? it.logged_at.toISOString().slice(0, 10) : String(it.logged_at).slice(0, 10);
      (itemsByDay[d] = itemsByDay[d] || []).push(it);
    }
    const recentDays = Object.keys(itemsByDay).sort().reverse().map(d => ({
      date: d,
      calories: Math.round(map[d]?.c || itemsByDay[d].reduce((s, x) => s + Number(x.calories || 0), 0)),
      protein: Math.round(map[d]?.p || 0),
      inTarget: inTarget(map[d]?.c || 0),
      items: itemsByDay[d],
    }));

    const { computeInsights } = require('../services/nutritionInsights');
    const { insights, correlation } = await computeInsights(uid, { calorieTarget: target, proteinTarget: pTarget });

    res.json({
      calorieTarget: target, proteinTarget: pTarget,
      last7: { daysLogged, daysInTarget, avgCalories: daysLogged ? Math.round(sumC / daysLogged) : null, avgProtein: daysLogged ? Math.round(sumP / daysLogged) : null, proteinDaysMet },
      lastLog, daysSinceLog, recentDays, insights, correlation,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /trainer/clients/:id/workout — obtiene plan estructurado
router.get('/clients/:id/workout', async (req, res) => {
  try {
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
      for (const ex of exercises) {
        if (ex.library_exercise_id) {
          const [vars] = await db.query(
            'SELECT id, name, youtube_url, notes FROM exercise_variations WHERE exercise_id=?', [ex.library_exercise_id]
          );
          ex.variations = vars;
        } else {
          ex.variations = [];
        }
      }
      day.exercises = exercises;
    }
    res.json({ plan: { ...plan, days } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /trainer/clients/:id/workout — guarda plan estructurado completo
router.put('/clients/:id/workout', async (req, res) => {
  const uid = req.params.id;
  const { days, duration_days, start_date, name } = req.body;
  if (!Array.isArray(days)) return res.status(400).json({ error: 'days requerido' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[activePlan]] = await conn.query(
      'SELECT id FROM workout_plans WHERE user_id=? AND is_active=TRUE ORDER BY created_at DESC LIMIT 1', [uid]
    );
    const plan_id = activePlan?.id || null;

    if (plan_id) {
      await conn.query(
        'UPDATE workout_plans SET duration_days=?, start_date=?, name=? WHERE id=? AND user_id=?',
        [duration_days || null, start_date || null, name || null, plan_id, uid]
      );
      const [existingDaysFull] = await conn.query(
        'SELECT id FROM workout_days WHERE plan_id=? ORDER BY day_order', [plan_id]
      );
      for (let di = 0; di < days.length; di++) {
        const day = days[di];
        let dayId = existingDaysFull[di]?.id || null;
        if (dayId) {
          await conn.query(
            'UPDATE workout_days SET day_name=?, day_order=?, warmup_type=?, warmup_duration=?, cardio_type=?, cardio_duration=?, day_type=? WHERE id=?',
            [day.day_name, di, day.warmup_type || null, day.warmup_duration || null, day.cardio_type || null, day.cardio_duration || null, day.day_type || null, dayId]
          );
        } else {
          dayId = uuidv4();
          await conn.query(
            'INSERT INTO workout_days (id, plan_id, day_name, day_order, warmup_type, warmup_duration, cardio_type, cardio_duration, day_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [dayId, plan_id, day.day_name, di, day.warmup_type || null, day.warmup_duration || null, day.cardio_type || null, day.cardio_duration || null, day.day_type || null]
          );
        }
        const exercises = day.exercises || [];
        const [existingExsFull] = await conn.query(
          'SELECT id FROM workout_exercises WHERE day_id=? ORDER BY exercise_order', [dayId]
        );
        for (let ei = 0; ei < exercises.length; ei++) {
          const ex = exercises[ei];
          const existingExId = existingExsFull[ei]?.id || null;
          if (existingExId) {
            await conn.query(
              'UPDATE workout_exercises SET name=?, youtube_url=?, sets=?, reps=?, weight_kg=?, exercise_order=?, library_exercise_id=? WHERE id=?',
              [ex.name, ex.youtube_url || null, ex.sets || 3, ex.reps || '10', ex.weight_kg || null, ei, ex.library_exercise_id || null, existingExId]
            );
          } else {
            await conn.query(
              'INSERT INTO workout_exercises (id, day_id, name, youtube_url, sets, reps, weight_kg, exercise_order, library_exercise_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [uuidv4(), dayId, ex.name, ex.youtube_url || null, ex.sets || 3, ex.reps || '10', ex.weight_kg || null, ei, ex.library_exercise_id || null]
            );
          }
        }
        if (existingExsFull.length > exercises.length) {
          const toRemove = existingExsFull.slice(exercises.length).map(e => e.id);
          await conn.query(`DELETE FROM workout_exercises WHERE id IN (${toRemove.map(() => '?').join(',')})`, toRemove);
        }
      }
      if (existingDaysFull.length > days.length) {
        const toRemove = existingDaysFull.slice(days.length).map(d => d.id);
        await conn.query(`DELETE FROM workout_days WHERE id IN (${toRemove.map(() => '?').join(',')})`, toRemove);
      }
      await conn.commit();
      return res.json({ message: 'Plan actualizado' });
    }

    // No existing plan — create new
    await conn.query('UPDATE workout_plans SET is_active=FALSE WHERE user_id=?', [uid]);
    const planId = uuidv4();
    await conn.query(
      'INSERT INTO workout_plans (id, user_id, is_active, duration_days, start_date, name) VALUES (?, ?, TRUE, ?, ?, ?)',
      [planId, uid, duration_days || null, start_date || null, name || null]
    );
    for (let di = 0; di < days.length; di++) {
      const day = days[di];
      const dayId = uuidv4();
      await conn.query(
        'INSERT INTO workout_days (id, plan_id, day_name, day_order, warmup_type, warmup_duration, cardio_type, cardio_duration, day_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [dayId, planId, day.day_name, di, day.warmup_type || null, day.warmup_duration || null, day.cardio_type || null, day.cardio_duration || null, day.day_type || null]
      );
      const exercises = day.exercises || [];
      for (let ei = 0; ei < exercises.length; ei++) {
        const ex = exercises[ei];
        await conn.query(
          'INSERT INTO workout_exercises (id, day_id, name, youtube_url, sets, reps, weight_kg, exercise_order, library_exercise_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), dayId, ex.name, ex.youtube_url || null, ex.sets || 3, ex.reps || '10', ex.weight_kg || null, ei, ex.library_exercise_id || null]
        );
      }
    }
    await conn.commit();
    res.json({ message: 'Plan guardado' });
  } catch (e) {
    await conn.rollback();
    console.error('[PUT /workout]', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// POST /trainer/clients/:id/workout/new — ARCHIVA la rutina actual y crea una nueva
// (rutina del mes). No borra nada: la anterior queda inactiva y con su historial.
router.post('/clients/:id/workout/new', async (req, res) => {
  const uid = req.params.id;
  const { days, duration_days, start_date, name } = req.body;
  if (!Array.isArray(days) || days.length === 0) return res.status(400).json({ error: 'days requerido' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Archiva TODAS las rutinas activas de la clienta (no las borra)
    await conn.query('UPDATE workout_plans SET is_active=FALSE WHERE user_id=?', [uid]);
    const planId = uuidv4();
    const startDate = start_date || new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
    await conn.query(
      'INSERT INTO workout_plans (id, user_id, is_active, duration_days, start_date, name) VALUES (?, ?, TRUE, ?, ?, ?)',
      [planId, uid, duration_days || null, startDate, name || null]
    );
    for (let di = 0; di < days.length; di++) {
      const day = days[di];
      const dayId = uuidv4();
      await conn.query(
        'INSERT INTO workout_days (id, plan_id, day_name, day_order, warmup_type, warmup_duration, cardio_type, cardio_duration, day_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [dayId, planId, day.day_name, di, day.warmup_type || null, day.warmup_duration || null, day.cardio_type || null, day.cardio_duration || null, day.day_type || null]
      );
      for (let ei = 0; ei < (day.exercises || []).length; ei++) {
        const ex = day.exercises[ei];
        await conn.query(
          'INSERT INTO workout_exercises (id, day_id, name, youtube_url, sets, reps, weight_kg, exercise_order, library_exercise_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), dayId, ex.name, ex.youtube_url || null, ex.sets || 3, ex.reps || '10', ex.weight_kg || null, ei, ex.library_exercise_id || null]
        );
      }
    }
    await conn.commit();
    res.json({ message: 'Nueva rutina creada', planId });

    // Vic avisa a la clienta que tiene una rutina nueva (en segundo plano)
    (async () => {
      try {
        const { sendToUser } = require('../notifications');
        await sendToUser(uid, {
          title: '🎉 ¡Nueva rutina lista!',
          body: name ? `Lorena te cargó "${name}". Ábrela y empecemos. 💪` : 'Lorena te cargó una rutina nueva. Ábrela y empecemos. 💪',
          url: '/plan',
        });
      } catch (e) { console.error('[new-routine push]', e.message); }
    })();
    return;
  } catch (e) {
    await conn.rollback();
    console.error('[POST /workout/new]', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// GET /trainer/clients/:id/workout/plans — lista de rutinas (activa + archivadas)
router.get('/clients/:id/workout/plans', async (req, res) => {
  try {
    const [plans] = await db.query(
      `SELECT wp.id, wp.is_active, wp.name, wp.start_date, wp.duration_days, wp.created_at,
              (SELECT COUNT(*) FROM workout_days wd WHERE wd.plan_id = wp.id) AS day_count
       FROM workout_plans wp WHERE wp.user_id = ? ORDER BY wp.is_active DESC, wp.created_at DESC`,
      [req.params.id]
    );
    res.json({ plans });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /trainer/clients/:id/workout/plans/:planId/summary — resultados del mes de esa rutina
router.get('/clients/:id/workout/plans/:planId/summary', async (req, res) => {
  try {
    const uid = req.params.id;
    const [[plan]] = await db.query('SELECT * FROM workout_plans WHERE id=? AND user_id=?', [req.params.planId, uid]);
    if (!plan) return res.status(404).json({ error: 'Rutina no encontrada' });

    // Ventana = mes completo del calendario (del 1 al último día del mes de la rutina)
    const ref = plan.start_date ? new Date(plan.start_date) : new Date(plan.created_at);
    const y = ref.getUTCFullYear(), m = ref.getUTCMonth();
    const pad = n => String(n).padStart(2, '0');
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const start = `${y}-${pad(m + 1)}-01`;
    const end   = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
    const endTs = end + ' 23:59:59'; // columnas datetime: incluir todo el último día
    const periodDays = lastDay;

    const [[planDayCount]] = await db.query('SELECT COUNT(*) AS n FROM workout_days WHERE plan_id=?', [plan.id]);
    const expectedDays = Math.max(1, Math.ceil(periodDays / 7) * (planDayCount.n || 0));

    // Días entrenados (daily_tracking o logs de ejercicio)
    const [trainRows] = await db.query(
      `SELECT DISTINCT d FROM (
         SELECT DATE_FORMAT(tracked_date,'%Y-%m-%d') d FROM daily_tracking WHERE user_id=? AND workout_done=1 AND tracked_date BETWEEN ? AND ?
         UNION SELECT DATE_FORMAT(logged_date,'%Y-%m-%d') d FROM workout_logs WHERE user_id=? AND logged_date BETWEEN ? AND ?
       ) t`, [uid, start, end, uid, start, end]);
    const daysTrained = trainRows.length;

    const [[sets]] = await db.query('SELECT COUNT(*) AS n FROM workout_logs WHERE user_id=? AND logged_date BETWEEN ? AND ?', [uid, start, end]);
    const [[water]] = await db.query('SELECT ROUND(AVG(water_glasses),1) AS avg FROM daily_tracking WHERE user_id=? AND water_glasses>0 AND tracked_date BETWEEN ? AND ?', [uid, start, end]);
    const [[cals]] = await db.query(
      `SELECT ROUND(AVG(t.total)) AS avg FROM (SELECT SUM(calories) total FROM food_logs WHERE user_id=? AND logged_at BETWEEN ? AND ? GROUP BY logged_at) t`,
      [uid, start, endTs]);

    // Peso: mediciones dentro de la ventana
    const [wRows] = await db.query(
      `SELECT DATE_FORMAT(logged_at,'%Y-%m-%d') d, weight_kg FROM measurements WHERE user_id=? AND weight_kg IS NOT NULL AND logged_at BETWEEN ? AND ? ORDER BY logged_at ASC`,
      [uid, start, endTs]);
    const weightSeries = wRows.map(r => ({ date: r.d, weight: Number(r.weight_kg) }));
    // Punto de partida: la última medición ANTES del inicio, para tener referencia si hay pocas dentro
    const [[prevW]] = await db.query(
      `SELECT DATE_FORMAT(logged_at,'%Y-%m-%d') d, weight_kg FROM measurements WHERE user_id=? AND weight_kg IS NOT NULL AND logged_at < ? ORDER BY logged_at DESC LIMIT 1`,
      [uid, start]);
    if (prevW && (weightSeries.length === 0 || weightSeries[0].date !== prevW.d)) {
      weightSeries.unshift({ date: prevW.d, weight: Number(prevW.weight_kg), anchor: true });
    }

    // Progresión de cargas por ejercicio de esta rutina
    const [logRows] = await db.query(
      `SELECT we.name, DATE_FORMAT(wl.logged_date,'%Y-%m-%d') d, MAX(wl.weight_kg) maxw
       FROM workout_logs wl
       JOIN workout_exercises we ON we.id = wl.exercise_id
       JOIN workout_days wd ON wd.id = we.day_id
       WHERE wd.plan_id=? AND wl.user_id=? AND wl.logged_date BETWEEN ? AND ? AND wl.weight_kg IS NOT NULL
       GROUP BY we.id, wl.logged_date ORDER BY we.name, wl.logged_date`,
      [plan.id, uid, start, end]);
    const byEx = {};
    for (const r of logRows) {
      if (!byEx[r.name]) byEx[r.name] = [];
      byEx[r.name].push(Number(r.maxw));
    }
    const loadProgress = Object.entries(byEx)
      .map(([name, arr]) => ({ name, from: arr[0], to: arr[arr.length - 1], delta: +(arr[arr.length - 1] - arr[0]).toFixed(1) }))
      .filter(x => x.from != null && x.to != null)
      .sort((a, b) => b.delta - a.delta);

    res.json({
      plan: { id: plan.id, name: plan.name, start_date: plan.start_date, duration_days: plan.duration_days },
      period: { start, end, days: periodDays },
      daysTrained, expectedDays,
      sessions: daysTrained,
      totalSets: sets.n || 0,
      avgWater: water.avg != null ? Number(water.avg) : null,
      avgCalories: cals.avg != null ? Number(cals.avg) : null,
      weightSeries,
      loadProgress,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /trainer/clients/:id/workout/plans/:planId — detalle de una rutina (para verla)
router.get('/clients/:id/workout/plans/:planId', async (req, res) => {
  try {
    const [[plan]] = await db.query('SELECT * FROM workout_plans WHERE id=? AND user_id=?', [req.params.planId, req.params.id]);
    if (!plan) return res.status(404).json({ error: 'Rutina no encontrada' });
    const [days] = await db.query('SELECT * FROM workout_days WHERE plan_id=? ORDER BY day_order', [plan.id]);
    for (const day of days) {
      const [exercises] = await db.query('SELECT * FROM workout_exercises WHERE day_id=? ORDER BY exercise_order', [day.id]);
      day.exercises = exercises;
    }
    res.json({ plan: { ...plan, days } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /trainer/clients/:id/routine — guarda rutina manual
router.put('/clients/:id/routine', async (req, res) => {
  try {
    const uid = req.params.id;
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Contenido requerido' });

    await db.query('UPDATE routines SET is_active=FALSE WHERE user_id=?', [uid]);
    await db.query(
      'INSERT INTO routines (id, user_id, content, is_active) VALUES (?, ?, ?, TRUE)',
      [uuidv4(), uid, content.trim()]
    );
    res.json({ routine: content.trim() });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  try {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /trainer/clients/:id/nutrition — genera plan nutricional con IA
router.post('/clients/:id/nutrition', async (req, res) => {
  try {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /trainer/clients/:id/targets — actualiza metas de calorías y macros
router.put('/clients/:id/targets', async (req, res) => {
  try {
    const { calorie_target, protein_target_g, carbs_target_g, fat_target_g } = req.body;
    const uid = req.params.id;
    const [[client]] = await db.query('SELECT id FROM users WHERE id=? AND role="client"', [uid]);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /trainer/clients/:id/invite — envía magic link de acceso (plan listo)
router.post('/clients/:id/invite', async (req, res) => {
  try {
    const [[user]] = await db.query('SELECT * FROM users WHERE id=? AND role="client"', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { sendMagicLink } = require('../services/email');
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.query('INSERT INTO magic_links (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, token, expiresAt]);
    try {
      await sendMagicLink(user.email, user.name, token, 'invite');
    } catch (emailErr) {
      await db.query('DELETE FROM magic_links WHERE token=?', [token]);
      throw emailErr;
    }
    res.json({ message: 'Invitación enviada' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /trainer/clients/:id/progress — fotos + historial de medidas
router.get('/clients/:id/progress', async (req, res) => {
  try {
    const uid = req.params.id;
    const [measurements] = await db.query(
      'SELECT * FROM measurements WHERE user_id=? ORDER BY logged_at DESC LIMIT 30', [uid]
    );
    const [registers] = await db.query(
      'SELECT * FROM progress_registers WHERE user_id=? ORDER BY date DESC LIMIT 20', [uid]
    );
    let photos = [];
    if (registers.length) {
      const ids = registers.map(r => r.id);
      const placeholders = ids.map(() => '?').join(',');
      const [rawPhotos] = await db.query(
        `SELECT * FROM progress_photos WHERE register_id IN (${placeholders})`, ids
      );
      const byRegister = {};
      for (const p of rawPhotos) {
        if (!byRegister[p.register_id]) byRegister[p.register_id] = {};
        byRegister[p.register_id][p.angle] = {
          ...p,
          image_url: p.image_url ? p.image_url.replace(/^.*\/uploads\//, 'uploads/') : p.image_url,
        };
      }
      photos = registers.map(r => ({ ...r, photos: byRegister[r.id] || {} }));
    }
    res.json({ measurements, photos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /trainer/clients/:id/adherence-detail — día a día últimos 60 días
router.get('/clients/:id/adherence-detail', async (req, res) => {
  try {
    const uid = req.params.id;
    const [rows] = await db.query(
      `SELECT tracked_date, workout_done, diet_followed, water_glasses
       FROM daily_tracking WHERE user_id=? AND tracked_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
       ORDER BY tracked_date DESC`, [uid]
    );
    res.json({ days: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /trainer/clients/:id/workout-logs — sesiones agrupadas por fecha + resumen
router.get('/clients/:id/workout-logs', async (req, res) => {
  try {
  const uid = req.params.id;

  // Logs de ejercicios
  const [logs] = await db.query(
    `SELECT wl.logged_date, wl.set_number, wl.weight_kg, wl.reps_done, wl.set_type, wl.duration_secs,
            we.name as exercise_name, we.sets as planned_sets, wd.day_name
     FROM workout_logs wl
     JOIN workout_exercises we ON we.id = wl.exercise_id
     JOIN workout_days wd ON wd.id = we.day_id
     WHERE wl.user_id=?
     ORDER BY wl.logged_date DESC, wd.day_name, we.name, wl.set_number ASC
     LIMIT 500`, [uid]
  );

  // Ejercicios extra agregados por la clienta en el día
  const [extraRows] = await db.query(
    `SELECT * FROM session_extra_exercises WHERE user_id=? ORDER BY session_date DESC LIMIT 200`, [uid]
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
    if (!byDate[d]) byDate[d] = { date: d, day_name: row.day_name, exercises: {}, planned: {}, type: 'routine' };
    if (!byDate[d].exercises[row.exercise_name]) byDate[d].exercises[row.exercise_name] = [];
    byDate[d].planned[row.exercise_name] = row.planned_sets;
    byDate[d].exercises[row.exercise_name].push({ set: row.set_number, weight: row.weight_kg, reps: row.reps_done, set_type: row.set_type, duration_secs: row.duration_secs });
  }

  // Ejercicios extra: se anexan a la sesión de su fecha (o crean una)
  for (const ex of extraRows) {
    const d = ex.session_date instanceof Date ? ex.session_date.toISOString().slice(0,10) : String(ex.session_date).slice(0,10);
    if (!byDate[d]) byDate[d] = { date: d, day_name: 'Ejercicios extra', exercises: {}, planned: {}, type: 'routine' };
    let parsed = []; try { parsed = JSON.parse(ex.sets) || []; } catch { parsed = []; }
    byDate[d].exercises[ex.name] = parsed.map(s => ({ set: s.set_number, weight: s.weight_kg, reps: s.reps_done, set_type: s.set_type, duration_secs: s.duration_secs }));
    byDate[d].planned[ex.name] = '__extra__';
  }

  const sessions = Object.values(byDate).map(s => ({
    date: s.date,
    day_name: s.day_name,
    type: 'routine',
    exercises: Object.entries(s.exercises).map(([name, sets]) => {
      const isExtra = s.planned[name] === '__extra__';
      const plannedN = Number(s.planned[name]) || 0;
      const hasIso = sets.some(x => x.set_type === 'isometry');
      const hasExtraSets = !isExtra && plannedN > 0 && sets.length > plannedN;
      return {
        name,
        added_by_client: isExtra,          // ejercicio nuevo agregado por la clienta
        has_extra_sets: hasExtraSets,      // series de más respecto al plan
        has_isometry: hasIso,
        max_weight: Math.max(...sets.map(x => parseFloat(x.weight) || 0)) || null,
        reps: sets[0]?.reps || null,
        sets,
      };
    }),
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

  // Racha (misma regla que el dashboard: 3 días de gracia)
  let streak = 0, restRun = 0;
  const today = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const msPerDay = 86400000;
  let expected = new Date(today).getTime();
  let firstDay = true;
  while (true) {
    const ds = new Date(expected).toISOString().slice(0,10);
    if (trainedDates.has(ds)) { streak++; restRun = 0; }
    else if (firstDay) { /* hoy aún puede completarse */ }
    else { restRun++; if (restRun > 3) break; }
    firstDay = false;
    expected -= msPerDay;
  }

  res.json({ sessions, summary: { streak, days_this_month: daysThisMonth, total_sessions: sessions.length } });
  } catch (err) {
    console.error('workout-logs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET/PUT /trainer/clients/:id/notes — notas privadas del entrenador
router.get('/clients/:id/notes', async (req, res) => {
  try {
    const [[user]] = await db.query('SELECT trainer_notes FROM users WHERE id=? AND role="client"', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ notes: user.trainer_notes || '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/clients/:id/notes', async (req, res) => {
  try {
    const { notes } = req.body;
    const [[client]] = await db.query('SELECT id FROM users WHERE id=? AND role="client"', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    await db.query('UPDATE users SET trainer_notes=? WHERE id=?', [notes || '', req.params.id]);
    res.json({ message: 'Notas guardadas' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /trainer/invite-new — crea cliente nuevo y envía valoración/onboarding
router.post('/invite-new', async (req, res) => {
  try {
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
    try {
      await sendMagicLink(email, name, token, 'onboarding');
    } catch (emailErr) {
      await db.query('DELETE FROM magic_links WHERE token=?', [token]);
      throw emailErr;
    }
    res.json({ message: 'Valoración enviada', userId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /trainer/weekly-summary — envía resumen manualmente
router.post('/weekly-summary', async (req, res) => {
  try {
    const { sendWeeklySummaryJob } = require('../app');
    // Trigger via app-level function isn't exported cleanly; replicate inline
    const { sendWeeklySummary } = require('../services/email');
    const [[trainer]] = await db.query(`SELECT * FROM users WHERE role='trainer' LIMIT 1`);
    if (!trainer) return res.status(404).json({ error: 'No se encontró entrenador' });
    const [clients] = await db.query(`SELECT id, name FROM users WHERE role='client' ORDER BY name`);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStr = weekAgo.toISOString().slice(0, 10);
    const clientStats = await Promise.all(clients.map(async (c) => {
      const [[track]] = await db.query(`SELECT COUNT(*) as workout_days FROM daily_tracking WHERE user_id=? AND workout_done=1 AND tracked_date >= ?`, [c.id, weekStr]);
      const [[diet]]  = await db.query(`SELECT COUNT(*) as diet_days FROM daily_tracking WHERE user_id=? AND diet_followed=1 AND tracked_date >= ?`, [c.id, weekStr]);
      const [[lastT]] = await db.query(`SELECT MAX(tracked_date) as last_trained FROM daily_tracking WHERE user_id=? AND workout_done=1`, [c.id]);
      const [logDays] = await db.query(`SELECT DISTINCT DATE_FORMAT(logged_date,'%Y-%m-%d') as d FROM workout_logs WHERE user_id=? ORDER BY d DESC LIMIT 60`, [c.id]);
      const [tDays]   = await db.query(`SELECT DATE_FORMAT(tracked_date,'%Y-%m-%d') as d FROM daily_tracking WHERE user_id=? AND workout_done=1 ORDER BY d DESC LIMIT 60`, [c.id]);
      const allDates  = new Set([...logDays.map(r=>r.d), ...tDays.map(r=>r.d)]);
      let streak = 0, restRun = 0, expected = Date.now() - 5 * 60 * 60 * 1000;
      while (true) {
        const ds = new Date(expected).toISOString().slice(0,10);
        if (allDates.has(ds)) { streak++; restRun = 0; }
        else { restRun++; if (restRun > 3) break; }
        expected -= 86400000;
      }
      return { name: c.name, workout_days: track.workout_days, diet_days: diet.diet_days, streak, last_trained: lastT.last_trained };
    }));
    await sendWeeklySummary(trainer.email, trainer.name, clientStats);
    res.json({ ok: true, sent_to: trainer.email });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Meal Planner ──────────────────────────────────────────────────────────────

// GET /trainer/clients/:id/meal-plan
router.get('/clients/:id/meal-plan', async (req, res) => {
  try {
    const uid = req.params.id;
    const [days] = await db.query(
      'SELECT * FROM meal_plan_days WHERE client_id=? ORDER BY day_of_week', [uid]
    );
    const result = {};
    for (const day of days) {
      const [items] = await db.query(
        'SELECT * FROM meal_plan_items WHERE day_id=? ORDER BY sort_order, meal_type', [day.id]
      );
      result[day.day_of_week] = items;
    }
    res.json({ plan: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /trainer/clients/:id/meal-plan
// body: { days: { "1": [{ meal_type, description }], ... } }
router.put('/clients/:id/meal-plan', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const uid = req.params.id;
    const { days } = req.body;
    if (!days || typeof days !== 'object') return res.status(400).json({ error: 'days requerido' });

    await conn.beginTransaction();
    for (const [dow, meals] of Object.entries(days)) {
      const [[existing]] = await conn.query(
        'SELECT id FROM meal_plan_days WHERE client_id=? AND day_of_week=?', [uid, dow]
      );
      let dayId;
      if (existing) {
        dayId = existing.id;
        await conn.query('DELETE FROM meal_plan_items WHERE day_id=?', [dayId]);
      } else {
        dayId = uuidv4();
        await conn.query(
          'INSERT INTO meal_plan_days (id, client_id, day_of_week) VALUES (?,?,?)', [dayId, uid, dow]
        );
      }
      for (let i = 0; i < meals.length; i++) {
        const { meal_type, description } = meals[i];
        if (!description?.trim()) continue;
        await conn.query(
          'INSERT INTO meal_plan_items (id, day_id, meal_type, description, sort_order) VALUES (?,?,?,?,?)',
          [uuidv4(), dayId, meal_type, description.trim(), i]
        );
      }
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// ── Exercise Library ──────────────────────────────────────────────────────────

// GET /trainer/library
router.get('/library', async (req, res) => {
  try {
    const trainerId = req.user.id;
    const [exercises] = await db.query(
      'SELECT * FROM exercise_library WHERE trainer_id=? ORDER BY muscle_group, name', [trainerId]
    );
    // Attach variations
    for (const ex of exercises) {
      const [vars] = await db.query(
        'SELECT * FROM exercise_variations WHERE exercise_id=? ORDER BY name', [ex.id]
      );
      ex.variations = vars;
    }
    res.json({ exercises });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /trainer/library
router.post('/library', async (req, res) => {
  try {
    const trainerId = req.user.id;
    const { name, muscle_group, youtube_url, notes, body_zone } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name requerido' });
    const id = uuidv4();
    const zone = ['superior', 'inferior'].includes(body_zone) ? body_zone : null;
    await db.query(
      'INSERT INTO exercise_library (id, trainer_id, name, muscle_group, youtube_url, notes, body_zone) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, trainerId, name.trim(), muscle_group || null, youtube_url || null, notes || null, zone]
    );
    res.json({ id, name, muscle_group, youtube_url, notes, body_zone: zone, variations: [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /trainer/library/:id
router.put('/library/:id', async (req, res) => {
  try {
    const trainerId = req.user.id;
    const { name, muscle_group, youtube_url, notes, body_zone } = req.body;
    const zone = ['superior', 'inferior'].includes(body_zone) ? body_zone : null;
    const [result] = await db.query(
      'UPDATE exercise_library SET name=?, muscle_group=?, youtube_url=?, notes=?, body_zone=? WHERE id=? AND trainer_id=?',
      [name?.trim() || '', muscle_group || null, youtube_url || null, notes || null, zone, req.params.id, trainerId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Ejercicio no encontrado' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /trainer/library/variations/:varId  — must come before /library/:id
router.delete('/library/variations/:varId', async (req, res) => {
  try {
    const trainerId = req.user.id;
    await db.query(
      `DELETE ev FROM exercise_variations ev
       JOIN exercise_library el ON el.id = ev.exercise_id
       WHERE ev.id = ? AND el.trainer_id = ?`,
      [req.params.varId, trainerId]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /trainer/library/:id/variations
router.post('/library/:id/variations', async (req, res) => {
  try {
    const { name, youtube_url, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name requerido' });
    const [[ex]] = await db.query(
      'SELECT id FROM exercise_library WHERE id=? AND trainer_id=?', [req.params.id, req.user.id]
    );
    if (!ex) return res.status(403).json({ error: 'Ejercicio no encontrado' });
    const id = uuidv4();
    await db.query(
      'INSERT INTO exercise_variations (id, exercise_id, name, youtube_url, notes) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.id, name.trim(), youtube_url || null, notes || null]
    );
    res.json({ id, exercise_id: req.params.id, name, youtube_url, notes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /trainer/library/:id
router.delete('/library/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const trainerId = req.user.id;
    await conn.beginTransaction();
    await conn.query('DELETE FROM exercise_variations WHERE exercise_id=?', [req.params.id]);
    await conn.query('DELETE FROM exercise_library WHERE id=? AND trainer_id=?', [req.params.id, trainerId]);
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// ===== Biblioteca de comidas =====
const MEAL_TYPES = ['desayuno', 'almuerzo', 'merienda', 'cena'];
const numOrNull = v => (v === '' || v == null || isNaN(Number(v)) ? null : Math.round(Number(v)));

// GET /trainer/meal-library
router.get('/meal-library', async (req, res) => {
  try {
    const [meals] = await db.query(
      'SELECT * FROM meal_library WHERE trainer_id=? ORDER BY meal_type, name', [req.user.id]
    );
    res.json({ meals });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /trainer/meal-library
router.post('/meal-library', async (req, res) => {
  try {
    const { name, description, meal_type, body_zone, calories, protein_g, carbs_g, fat_g } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name requerido' });
    if (!MEAL_TYPES.includes(meal_type)) return res.status(400).json({ error: 'meal_type inválido' });
    const zone = ['superior', 'inferior', 'descanso'].includes(body_zone) ? body_zone : null;
    const id = uuidv4();
    await db.query(
      `INSERT INTO meal_library (id, trainer_id, name, description, meal_type, body_zone, calories, protein_g, carbs_g, fat_g)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, name.trim(), description || null, meal_type, zone,
       numOrNull(calories), numOrNull(protein_g), numOrNull(carbs_g), numOrNull(fat_g)]
    );
    res.json({ id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /trainer/meal-library/:id
router.put('/meal-library/:id', async (req, res) => {
  try {
    const { name, description, meal_type, body_zone, calories, protein_g, carbs_g, fat_g } = req.body;
    if (!MEAL_TYPES.includes(meal_type)) return res.status(400).json({ error: 'meal_type inválido' });
    const zone = ['superior', 'inferior', 'descanso'].includes(body_zone) ? body_zone : null;
    const [r] = await db.query(
      `UPDATE meal_library SET name=?, description=?, meal_type=?, body_zone=?, calories=?, protein_g=?, carbs_g=?, fat_g=?
       WHERE id=? AND trainer_id=?`,
      [name?.trim() || '', description || null, meal_type, zone,
       numOrNull(calories), numOrNull(protein_g), numOrNull(carbs_g), numOrNull(fat_g), req.params.id, req.user.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Comida no encontrada' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /trainer/meal-library/:id
router.delete('/meal-library/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM meal_library WHERE id=? AND trainer_id=?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== Asignación de nutrición por clienta (modo + slots por semana × zona × momento) =====
// GET /trainer/clients/:id/nutrition-config
router.get('/clients/:id/nutrition-config', async (req, res) => {
  try {
    const uid = req.params.id;
    const [[u]] = await db.query('SELECT nutrition_mode FROM users WHERE id=?', [uid]);
    const [slots] = await db.query(
      'SELECT * FROM client_meal_slots WHERE client_id=? ORDER BY week_no, body_zone, meal_type, sort_order', [uid]
    );
    res.json({ nutrition_mode: u?.nutrition_mode || 'simple', slots });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /trainer/clients/:id/nutrition-mode
router.put('/clients/:id/nutrition-mode', async (req, res) => {
  try {
    const mode = ['simple', 'rotativo'].includes(req.body.mode) ? req.body.mode : 'simple';
    await db.query('UPDATE users SET nutrition_mode=? WHERE id=?', [mode, req.params.id]);
    res.json({ ok: true, nutrition_mode: mode });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /trainer/clients/:id/meal-slots — reemplaza TODOS los slots de la clienta
router.put('/clients/:id/meal-slots', async (req, res) => {
  const uid = req.params.id;
  const { slots } = req.body;
  if (!Array.isArray(slots)) return res.status(400).json({ error: 'slots requerido' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM client_meal_slots WHERE client_id=?', [uid]);
    for (const s of slots) {
      if (!s.name?.trim() || !['superior', 'inferior', 'descanso'].includes(s.body_zone) || !MEAL_TYPES.includes(s.meal_type)) continue;
      const week = [1, 2, 3, 4].includes(Number(s.week_no)) ? Number(s.week_no) : 1;
      await conn.query(
        `INSERT INTO client_meal_slots (id, client_id, week_no, body_zone, meal_type, library_id, name, description, calories, protein_g, carbs_g, fat_g, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), uid, week, s.body_zone, s.meal_type, s.library_id || null, s.name.trim(), s.description || null,
         numOrNull(s.calories), numOrNull(s.protein_g), numOrNull(s.carbs_g), numOrNull(s.fat_g), Number(s.sort_order) || 0]
      );
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});

// GET /trainer/billing — panel de ingresos
router.get('/billing', requireTrainer, async (req, res) => {
  try {
    const [clients] = await db.query(
      `SELECT u.id, u.name, u.email,
         cb.monthly_fee, cb.next_payment_date, cb.notes,
         wp.duration_days, wp.start_date
       FROM users u
       LEFT JOIN client_billing cb ON cb.client_id = u.id
       LEFT JOIN workout_plans wp ON wp.user_id = u.id AND wp.is_active = TRUE
       WHERE u.role = 'client'
       ORDER BY u.name`
    );
    res.json({ clients });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /trainer/billing/:clientId — actualizar facturación de cliente
router.put('/billing/:clientId', requireTrainer, async (req, res) => {
  try {
    const { monthly_fee, next_payment_date, notes } = req.body;
    await db.query(
      `INSERT INTO client_billing (id, client_id, monthly_fee, next_payment_date, notes)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE monthly_fee=VALUES(monthly_fee), next_payment_date=VALUES(next_payment_date), notes=VALUES(notes)`,
      [uuidv4(), req.params.clientId, monthly_fee || 0, next_payment_date || null, notes || '']
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /trainer/clients/:id
router.delete('/clients/:id', requireTrainer, async (req, res) => {
  try {
    const [[user]] = await db.query('SELECT id FROM users WHERE id=? AND role="client"', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Cliente no encontrado' });
    await db.query('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /trainer/push-reminder — envía recordatorio push a un cliente
router.post('/push-reminder', async (req, res) => {
  const { user_id, title = '¡Hola!', body = 'Tu entrenadora Lorena te envía un recordatorio 💪' } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id requerido' });
  const [subs] = await db.query('SELECT subscription FROM push_subscriptions WHERE user_id=?', [user_id]);
  if (!subs.length) return res.status(404).json({ error: 'El cliente no tiene notificaciones activas' });
  const payload = JSON.stringify({ title, body, icon: '/icons/icon-192.png' });
  const results = await Promise.allSettled(subs.map(s => webpush.sendNotification(JSON.parse(s.subscription), payload)));
  const sent = results.filter(r => r.status === 'fulfilled').length;
  res.json({ ok: true, sent });
});

function extractCalorieTarget(content) {
  const match = content.match(/(\d{3,4})\s*kcal/i);
  return match ? parseInt(match[1]) : null;
}

module.exports = router;
