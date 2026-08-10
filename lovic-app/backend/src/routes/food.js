const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const db      = require('../database/db');
const { parseFood, parseFoodImage, getFoodRecommendation } = require('../services/ai');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Fecha local en Colombia (UTC-5) como fallback cuando el cliente no la manda
function colombiaToday() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Subida temporal para escanear el plato (la foto NO se conserva)
const scanUpload = multer({
  dest: process.env.UPLOAD_PATH || 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Solo imágenes')),
});

const num = (v, def = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.round(n)) : def; };

// POST /food/scan — analiza una foto del plato y devuelve el estimado (NO guarda)
router.post('/scan', scanUpload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Foto requerida' });
  try {
    const parsed = await parseFoodImage(req.file.path, req.user.fitness_goal);
    res.json({ parsed });
  } catch (e) {
    console.error('[food/scan]', e.message);
    res.status(500).json({ error: 'No se pudo analizar la foto. Intenta con una más clara.' });
  } finally {
    fs.unlink(req.file.path, () => {}); // borra la foto temporal siempre
  }
});

// POST /food/log-parsed — guarda un registro ya revisado por la clienta (sin re-analizar)
router.post('/log-parsed', async (req, res) => {
  try {
    const { input_text, items, calories, protein_g, carbs_g, fat_g, meal_type } = req.body;
    if (!input_text?.trim()) return res.status(400).json({ error: 'Descripción requerida' });
    const VALID = ['breakfast', 'lunch', 'dinner', 'snack'];
    const finalMealType = VALID.includes(meal_type) ? meal_type : 'snack';
    const today = req.body.date || colombiaToday();

    await db.query(
      `INSERT INTO food_logs (id, user_id, input_text, parsed_items, calories, protein_g, carbs_g, fat_g, meal_type, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), req.user.id, input_text.trim(),
        JSON.stringify(Array.isArray(items) ? items : []),
        num(calories), num(protein_g), num(carbs_g), num(fat_g),
        finalMealType, today,
      ]
    );

    const [[{ total }]] = await db.query(
      `SELECT COALESCE(SUM(calories), 0) AS total FROM food_logs WHERE user_id = ? AND logged_at = ?`,
      [req.user.id, today]
    );
    res.json({
      daily: { target: req.user.calorie_target || 2000, consumed: total, remaining: Math.max((req.user.calorie_target || 2000) - total, 0) },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /food/log
router.post('/log', async (req, res) => {
  try {
  const { input_text, meal_type } = req.body;
  if (!input_text?.trim()) return res.status(400).json({ error: 'Texto requerido' });

  // Clave normalizada para el caché: minúsculas, sin espacios extra
  const inputKey = input_text.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 255);

  let parsed;
  const [cached] = await db.query('SELECT * FROM food_cache WHERE input_key = ?', [inputKey]);

  if (cached.length) {
    // Comida ya conocida → reutiliza, no llama a la IA
    const c = cached[0];
    parsed = {
      items: typeof c.parsed_items === 'string' ? JSON.parse(c.parsed_items) : (c.parsed_items || []),
      total_calories: c.total_calories,
      protein_g: c.protein_g,
      carbs_g: c.carbs_g,
      fat_g: c.fat_g,
      meal_type: c.meal_type,
    };
    await db.query('UPDATE food_cache SET hit_count = hit_count + 1 WHERE id = ?', [c.id]);
  } else {
    // Comida nueva → la IA la analiza y se guarda en caché
    parsed = await parseFood(input_text, req.user.fitness_goal);
    await db.query(
      `INSERT INTO food_cache (id, input_key, parsed_items, total_calories, protein_g, carbs_g, fat_g, meal_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), inputKey, JSON.stringify(parsed.items),
        parsed.total_calories, parsed.protein_g, parsed.carbs_g, parsed.fat_g, parsed.meal_type,
      ]
    );
  }

  const VALID = ['breakfast', 'lunch', 'dinner', 'snack'];
  const finalMealType = VALID.includes(meal_type) ? meal_type : parsed.meal_type;

  const today = req.body.date || colombiaToday();
  await db.query(
    `INSERT INTO food_logs (id, user_id, input_text, parsed_items, calories, protein_g, carbs_g, fat_g, meal_type, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(), req.user.id, input_text,
      JSON.stringify(parsed.items),
      parsed.total_calories, parsed.protein_g, parsed.carbs_g, parsed.fat_g,
      finalMealType, today,
    ]
  );

  const [[sums]] = await db.query(
    `SELECT COALESCE(SUM(calories),0) AS calories, COALESCE(SUM(protein_g),0) AS protein_g,
            COALESCE(SUM(carbs_g),0) AS carbs_g, COALESCE(SUM(fat_g),0) AS fat_g
     FROM food_logs WHERE user_id = ? AND logged_at = ?`,
    [req.user.id, today]
  );
  const total = Number(sums.calories);
  const target = req.user.calorie_target || 2000;

  res.json({
    parsed,
    daily: {
      target,
      consumed:  total,
      remaining: Math.max(target - total, 0),
      macros: {
        protein: { consumed: Number(sums.protein_g), target: req.user.protein_target_g || null },
        carbs:   { consumed: Number(sums.carbs_g),   target: req.user.carbs_target_g || null },
        fat:     { consumed: Number(sums.fat_g),     target: req.user.fat_target_g || null },
      },
    },
  });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /food/today
router.get('/today', async (req, res) => {
  try {
    const today = req.query.date || colombiaToday();
    const [logs] = await db.query(
      `SELECT * FROM food_logs WHERE user_id = ? AND logged_at = ? ORDER BY created_at DESC`,
      [req.user.id, today]
    );

    const [[sums]] = await db.query(
      `SELECT COALESCE(SUM(calories),0) AS calories, COALESCE(SUM(protein_g),0) AS protein_g,
              COALESCE(SUM(carbs_g),0) AS carbs_g, COALESCE(SUM(fat_g),0) AS fat_g
       FROM food_logs WHERE user_id = ? AND logged_at = ?`,
      [req.user.id, today]
    );
    const total     = Number(sums.calories);
    const target    = req.user.calorie_target || 2000;
    const remaining = Math.max(target - total, 0);
    const macros = {
      protein: { consumed: Number(sums.protein_g), target: req.user.protein_target_g || null },
      carbs:   { consumed: Number(sums.carbs_g),   target: req.user.carbs_target_g || null },
      fat:     { consumed: Number(sums.fat_g),     target: req.user.fat_target_g || null },
    };

    res.json({
      logs,
      daily: { target, consumed: total, remaining, macros },
      status: deficitStatus(total, target),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Estado calórico basado en reglas (sin IA)
function deficitStatus(consumed, target) {
  const ratio = target > 0 ? consumed / target : 0;
  if (ratio >= 1.05) return { level: 'surplus',  label: 'Superávit calórico',  color: '#E05252', message: 'Te pasaste de tu meta de hoy. Mañana es un nuevo día.' };
  if (ratio >= 0.90) return { level: 'on_target', label: 'En tu meta',          color: '#2D7A2D', message: '¡Perfecto! Estás justo en tu objetivo del día.' };
  if (ratio >= 0.65) return { level: 'mild',      label: 'Déficit ligero',      color: '#7A9A2D', message: 'Vas bien. Te queda margen para una comida más.' };
  if (ratio >= 0.40) return { level: 'moderate',  label: 'Déficit moderado',    color: '#C99A1E', message: 'Aún te faltan calorías. Asegúrate de comer suficiente.' };
  return                     { level: 'extreme',   label: 'Déficit extremo',     color: '#E05252', message: 'Has comido muy poco. Es importante alimentarte bien.' };
}

// GET /food/history?days=7
router.get('/history', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 30);
    const [rows] = await db.query(
      `SELECT logged_at, SUM(calories) as calories, SUM(protein_g) as protein_g,
              SUM(carbs_g) as carbs_g, SUM(fat_g) as fat_g
       FROM food_logs WHERE user_id = ? AND logged_at >= DATE_SUB(?, INTERVAL ? DAY)
       GROUP BY logged_at ORDER BY logged_at ASC`,
      [req.user.id, colombiaToday(), days]
    );
    // Items de cada día (qué comió), para poder desplegar el detalle en el historial
    const [items] = await db.query(
      `SELECT id, logged_at, input_text, parsed_items, meal_type, calories, protein_g, carbs_g, fat_g
       FROM food_logs WHERE user_id = ? AND logged_at >= DATE_SUB(?, INTERVAL ? DAY)
       ORDER BY logged_at ASC, created_at ASC`,
      [req.user.id, colombiaToday(), days]
    );
    const itemsByDay = {};
    for (const it of items) {
      const d = it.logged_at instanceof Date ? it.logged_at.toISOString().slice(0, 10) : String(it.logged_at).slice(0, 10);
      (itemsByDay[d] = itemsByDay[d] || []).push(it);
    }
    res.json({ history: rows, itemsByDay, target: req.user.calorie_target, protein_target: req.user.protein_target_g || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /food/adherence — resumen de constancia nutricional (últimos 7 y 30 días)
router.get('/adherence', async (req, res) => {
  try {
    const uid = req.user.id;
    const target = req.user.calorie_target || 2000;
    const pTarget = req.user.protein_target_g || null;
    const today = colombiaToday();

    const [rows] = await db.query(
      `SELECT logged_at, SUM(calories) AS c, SUM(protein_g) AS p
       FROM food_logs WHERE user_id=? AND logged_at >= DATE_SUB(?, INTERVAL 60 DAY)
       GROUP BY logged_at`,
      [uid, today]
    );
    const map = {};
    for (const r of rows) {
      const d = r.logged_at instanceof Date ? r.logged_at.toISOString().slice(0, 10) : String(r.logged_at).slice(0, 10);
      map[d] = { c: Number(r.c), p: Number(r.p) };
    }
    const inTarget = c => target && c >= target * 0.85 && c <= target * 1.10;
    const dateAgo = n => { const [y, m, d] = today.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); dt.setUTCDate(dt.getUTCDate() - n); return dt.toISOString().slice(0, 10); };

    const window = (nDays) => {
      let daysLogged = 0, daysInTarget = 0, sumC = 0, sumP = 0, proteinDaysMet = 0;
      for (let i = 0; i < nDays; i++) {
        const day = map[dateAgo(i)];
        if (!day) continue;
        daysLogged++; sumC += day.c; sumP += day.p;
        if (inTarget(day.c)) daysInTarget++;
        if (pTarget && day.p >= pTarget * 0.9) proteinDaysMet++;
      }
      return {
        days: nDays,
        daysLogged,
        daysInTarget,
        avgCalories: daysLogged ? Math.round(sumC / daysLogged) : null,
        avgProtein: daysLogged ? Math.round(sumP / daysLogged) : null,
        proteinDaysMet,
      };
    };

    // Racha: días seguidos en meta terminando hoy (hoy solo cuenta si ya está en meta)
    let streak = 0;
    for (let i = 0; i <= 60; i++) {
      const c = map[dateAgo(i)]?.c || 0;
      const it = inTarget(c);
      if (i === 0 && !it) continue; // hoy aún puede completarse
      if (it) streak++; else break;
    }

    res.json({ calorieTarget: target, proteinTarget: pTarget, last7: window(7), last30: window(30), streak });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /food/log/:id
router.delete('/log/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM food_logs WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Registro eliminado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
