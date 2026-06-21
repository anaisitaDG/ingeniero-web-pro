const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../database/db');
const { parseFood, getFoodRecommendation } = require('../services/ai');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// POST /food/log
router.post('/log', async (req, res) => {
  const { input_text } = req.body;
  if (!input_text?.trim()) return res.status(400).json({ error: 'Texto requerido' });

  const parsed = await parseFood(input_text, req.user.fitness_goal);

  await db.query(
    `INSERT INTO food_logs (id, user_id, input_text, parsed_items, calories, protein_g, carbs_g, fat_g, meal_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(), req.user.id, input_text,
      JSON.stringify(parsed.items),
      parsed.total_calories, parsed.protein_g, parsed.carbs_g, parsed.fat_g,
      parsed.meal_type,
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
    `SELECT * FROM food_logs WHERE user_id = ? AND logged_at = CURDATE() ORDER BY created_at DESC`,
    [req.user.id]
  );

  const [[{ total }]] = await db.query(
    `SELECT COALESCE(SUM(calories), 0) AS total FROM food_logs
     WHERE user_id = ? AND logged_at = CURDATE()`,
    [req.user.id]
  );

  const target    = req.user.calorie_target || 2000;
  const remaining = Math.max(target - total, 0);

  const recommendation = await getFoodRecommendation(remaining, req.user.fitness_goal, total);

  res.json({
    logs,
    daily: { target, consumed: total, remaining },
    recommendation,
  });
});

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
