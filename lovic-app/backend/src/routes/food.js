const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../database/db');
const { parseFood, getFoodRecommendation } = require('../services/ai');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// POST /food/log
router.post('/log', async (req, res) => {
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

  await db.query(
    `INSERT INTO food_logs (id, user_id, input_text, parsed_items, calories, protein_g, carbs_g, fat_g, meal_type, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE(CONVERT_TZ(NOW(), 'UTC', 'America/Bogota')))`,
    [
      uuidv4(), req.user.id, input_text,
      JSON.stringify(parsed.items),
      parsed.total_calories, parsed.protein_g, parsed.carbs_g, parsed.fat_g,
      finalMealType,
    ]
  );

  const [[{ total }]] = await db.query(
    `SELECT COALESCE(SUM(calories), 0) AS total FROM food_logs
     WHERE user_id = ? AND logged_at = CURDATE()`,
    [req.user.id]
  );

  const remaining = (req.user.calorie_target || 2000) - total;

  res.json({
    parsed,
    daily: {
      target:    req.user.calorie_target || 2000,
      consumed:  total,
      remaining: Math.max(remaining, 0),
    },
  });
});

// GET /food/today
router.get('/today', async (req, res) => {
  const [logs] = await db.query(
    `SELECT * FROM food_logs WHERE user_id = ? AND logged_at = DATE(CONVERT_TZ(NOW(), 'UTC', 'America/Bogota')) ORDER BY created_at DESC`,
    [req.user.id]
  );

  const [[{ total }]] = await db.query(
    `SELECT COALESCE(SUM(calories), 0) AS total FROM food_logs
     WHERE user_id = ? AND logged_at = DATE(CONVERT_TZ(NOW(), 'UTC', 'America/Bogota'))`,
    [req.user.id]
  );

  const target    = req.user.calorie_target || 2000;
  const remaining = Math.max(target - total, 0);

  res.json({
    logs,
    daily: { target, consumed: total, remaining },
    status: deficitStatus(total, target),
  });
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
  const days = Math.min(parseInt(req.query.days) || 7, 30);
  const [rows] = await db.query(
    `SELECT logged_at, SUM(calories) as calories, SUM(protein_g) as protein_g,
            SUM(carbs_g) as carbs_g, SUM(fat_g) as fat_g
     FROM food_logs WHERE user_id = ? AND logged_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY logged_at ORDER BY logged_at ASC`,
    [req.user.id, days]
  );
  res.json({ history: rows, target: req.user.calorie_target });
});

// DELETE /food/log/:id
router.delete('/log/:id', async (req, res) => {
  await db.query('DELETE FROM food_logs WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ message: 'Registro eliminado' });
});

module.exports = router;
