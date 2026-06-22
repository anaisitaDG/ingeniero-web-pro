const express = require('express');
const router  = express.Router();
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// PUT /profile
router.put('/', async (req, res) => {
  const { name, fitness_goal, calorie_target } = req.body;
  const uid = req.user.id;

  await db.query(
    `UPDATE users SET
       name           = COALESCE(NULLIF(?, ''), name),
       fitness_goal   = COALESCE(NULLIF(?, ''), fitness_goal),
       calorie_target = COALESCE(NULLIF(?, ''), calorie_target)
     WHERE id = ?`,
    [name, fitness_goal, calorie_target || null, uid]
  );

  const [[updated]] = await db.query(
    'SELECT id, email, name, role, fitness_goal, calorie_target FROM users WHERE id = ?',
    [uid]
  );

  res.json({ user: updated });
});

module.exports = router;
