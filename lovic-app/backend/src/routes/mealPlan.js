const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../database/db');
const { parseFood } = require('../services/ai');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

function colombiaToday() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// GET /meal-plan — returns today's day plan + completions
router.get('/', async (req, res) => {
  try {
    const uid = req.user.id;
    const today = colombiaToday();
    const jsDay = new Date(today + 'T12:00:00').getDay();
    const dow = jsDay === 0 ? 7 : jsDay;

    const [[dayRow]] = await db.query(
      'SELECT id FROM meal_plan_days WHERE client_id=? AND day_of_week=?', [uid, dow]
    );

    let meals = [];
    if (dayRow) {
      const [items] = await db.query(
        'SELECT * FROM meal_plan_items WHERE day_id=? ORDER BY sort_order, meal_type', [dayRow.id]
      );
      meals = items;
    }

    const [completions] = await db.query(
      'SELECT meal_type FROM meal_completions WHERE client_id=? AND logged_date=?', [uid, today]
    );
    const completed = completions.map(r => r.meal_type);

    res.json({ meals, completed, today, dow });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /meal-plan/week — full week plan
router.get('/week', async (req, res) => {
  try {
    const uid = req.user.id;
    const [days] = await db.query(
      'SELECT * FROM meal_plan_days WHERE client_id=? ORDER BY day_of_week', [uid]
    );
    const plan = {};
    for (const day of days) {
      const [items] = await db.query(
        'SELECT * FROM meal_plan_items WHERE day_id=? ORDER BY sort_order, meal_type', [day.id]
      );
      plan[day.day_of_week] = items;
    }
    res.json({ plan });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// GET /meal-plan/by-type — nutrición de HOY según el tipo de entreno del día + la semana del mes
router.get('/by-type', async (req, res) => {
  try {
    const uid = req.user.id;
    const today = colombiaToday();

    const [[u]] = await db.query('SELECT nutrition_mode FROM users WHERE id=?', [uid]);
    const mode = u?.nutrition_mode || 'simple';

    // Plan activo → fecha de inicio para calcular la semana del mes
    const [[plan]] = await db.query(
      'SELECT id, start_date, created_at FROM workout_plans WHERE user_id=? AND is_active=TRUE ORDER BY created_at DESC LIMIT 1', [uid]
    );
    let week_no = 1;
    if (mode === 'rotativo' && plan) {
      const startStr = (plan.start_date ? new Date(plan.start_date) : new Date(plan.created_at)).toISOString().slice(0, 10);
      const days = Math.max(0, Math.floor((new Date(today) - new Date(startStr)) / 86400000));
      week_no = (Math.floor(days / 7) % 4) + 1; // semana 5 → vuelve a la 1
    }

    // Tipo del día: si la clienta completó un día HOY, usamos su day_type
    const [[doneDay]] = await db.query(
      `SELECT wd.day_type FROM workout_day_completions c
       JOIN workout_days wd ON wd.id = c.day_id
       WHERE c.user_id=? AND c.completed_date=? AND wd.day_type IS NOT NULL
       ORDER BY c.id DESC LIMIT 1`,
      [uid, today]
    );
    let today_day_type = doneDay?.day_type || null;

    // Si aún no marcó el entreno, intentamos deducir el tipo por el NOMBRE del día de hoy
    // (ej. día "MARTES: ..." cuando hoy es martes). Ignora tildes.
    if (!today_day_type && plan) {
      const [pdays] = await db.query(
        'SELECT day_name, day_type FROM workout_days WHERE plan_id=? AND day_type IS NOT NULL', [plan.id]
      );
      const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const noAcc = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const todayName = DIAS[new Date(today + 'T12:00:00').getDay()];
      const match = pdays.find(d => noAcc(d.day_name).includes(todayName));
      if (match) today_day_type = match.day_type;
    }

    // Cada tipo de día tiene su propia zona de comida (superior / inferior / descanso)
    const auto_zone = ['superior', 'inferior', 'descanso'].includes(today_day_type) ? today_day_type : null;

    // Slots de la semana correspondiente
    const [slots] = await db.query(
      'SELECT * FROM client_meal_slots WHERE client_id=? AND week_no=? ORDER BY body_zone, meal_type, sort_order',
      [uid, week_no]
    );

    // Comidas ya registradas hoy (para marcar ✓)
    const [eaten] = await db.query(
      'SELECT input_text FROM food_logs WHERE user_id=? AND logged_at=? AND input_text LIKE ?',
      [uid, today, 'plan:%']
    );
    const eatenKeys = eaten.map(r => r.input_text);

    // Consumo real de hoy (todo lo registrado, no solo lo del plan) para comparar plan vs realidad
    const [[cons]] = await db.query(
      'SELECT COALESCE(SUM(calories),0) AS c FROM food_logs WHERE user_id=? AND logged_at=?', [uid, today]
    );

    // Indicaciones & suplementación (una lista por clienta, igual todos los días)
    const [supplements] = await db.query(
      'SELECT moment, item, dose FROM client_supplements WHERE client_id=? ORDER BY sort_order, id', [uid]
    );

    res.json({ mode, week_no, today_day_type, auto_zone, slots, eatenKeys, today, consumedToday: Number(cons.c), supplements });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /meal-plan/shopping-list?period=weekly|biweekly|monthly
router.get('/shopping-list', async (req, res) => {
  try {
    const { computeShoppingList } = require('../services/shoppingList');
    const period = ['weekly', 'biweekly', 'monthly'].includes(req.query.period) ? req.query.period : 'weekly';
    const out = await computeShoppingList(req.user.id, period);
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /meal-plan/eat — marca una comida del plan como consumida y suma sus calorías al día.
// Acepta custom_text: si la clienta comió una variante ("crema de arroz con mora"),
// se estiman las calorías reales con IA en vez de las del plan.
router.post('/eat', async (req, res) => {
  try {
    const uid = req.user.id;
    const { slot_id, done, custom_text } = req.body;
    const today = req.body.date || colombiaToday();
    const key = `plan:${slot_id}`;

    if (done === false) {
      await db.query('DELETE FROM food_logs WHERE user_id=? AND logged_at=? AND input_text=?', [uid, today, key]);
      return res.json({ ok: true });
    }

    const [[slot]] = await db.query('SELECT * FROM client_meal_slots WHERE id=? AND client_id=?', [slot_id, uid]);
    if (!slot) return res.status(404).json({ error: 'Comida no encontrada' });

    const MAP = { desayuno: 'breakfast', almuerzo: 'lunch', merienda: 'snack', cena: 'dinner' };
    const mealType = MAP[slot.meal_type] || 'snack';

    // Nombre + macros a registrar
    let name = slot.name;
    let cal = slot.calories, p = slot.protein_g, c = slot.carbs_g, f = slot.fat_g, fib = null;
    let items = null; // desglose por ingrediente (igual que las comidas registradas a mano)
    const wantText = (custom_text && String(custom_text).trim()) ? String(custom_text).trim() : null;

    // Siempre pasamos la comida por la IA para obtener el desglose por ingrediente.
    // Las calorías/macros del plan (si Lorena las puso) mandan; solo estimamos cuando faltan o comió variante.
    const textToParse = wantText || `${slot.name}${slot.description ? '. ' + slot.description : ''}`;
    try {
      const parsed = await parseFood(textToParse);
      if (Array.isArray(parsed.items) && parsed.items.length) items = parsed.items;
      if (wantText || cal == null) {
        cal = Math.round(parsed.total_calories) || 0;
        p   = parsed.protein_g != null ? Math.round(parsed.protein_g) : null;
        c   = parsed.carbs_g   != null ? Math.round(parsed.carbs_g)   : null;
        f   = parsed.fat_g     != null ? Math.round(parsed.fat_g)     : null;
        fib = parsed.fiber_g   != null ? Math.round(parsed.fiber_g)   : null;
        if (wantText) name = wantText; // registramos lo que REALMENTE comió
      }
    } catch (_) { cal = cal || 0; } // si la IA falla, seguimos con lo del plan

    // parsed_items: 1er ítem = cabecera con el nombre completo + total; el resto = desglose por ingrediente.
    // (FoodLogger usa la cabecera como título y muestra el desglose debajo, igual que las comidas a mano.)
    const finalItems = [{ name, quantity: '', calories: cal || 0 }, ...(items || [])];

    // Upsert: borramos el registro anterior del plan y volvemos a insertar (permite editar/ajustar)
    await db.query('DELETE FROM food_logs WHERE user_id=? AND logged_at=? AND input_text=?', [uid, today, key]);
    await db.query(
      `INSERT INTO food_logs (id, user_id, input_text, parsed_items, calories, protein_g, carbs_g, fat_g, fiber_g, meal_type, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), uid, key, JSON.stringify(finalItems),
       cal || 0, p, c, f, fib, mealType, today]
    );
    res.json({ ok: true, logged: { name, calories: cal || 0, protein_g: p, carbs_g: c, fat_g: f, fiber_g: fib } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /meal-plan/complete
router.post('/complete', async (req, res) => {
  try {
    const uid = req.user.id;
    const { meal_type, date, done } = req.body;
    const VALID_MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
    if (!meal_type || !VALID_MEALS.includes(meal_type)) return res.status(400).json({ error: 'meal_type inválido' });
    const d = date || colombiaToday();
    if (done === false) {
      await db.query(
        'DELETE FROM meal_completions WHERE client_id=? AND logged_date=? AND meal_type=?',
        [uid, d, meal_type]
      );
    } else {
      await db.query(
        'INSERT IGNORE INTO meal_completions (id, client_id, logged_date, meal_type) VALUES (?,?,?,?)',
        [uuidv4(), uid, d, meal_type]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
