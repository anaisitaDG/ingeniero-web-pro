const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../database/db');
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
    // JS getDay: 0=Sun,1=Mon... we use 1=Mon,7=Sun
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
