const express = require('express');
const router  = express.Router();
const db      = require('../database/db');
const { requireAuth, calcMacroTargets } = require('../middleware/auth');

router.use(requireAuth);

// PUT /profile
router.put('/', async (req, res) => {
  const { name, fitness_goal, calorie_target, protein_target_g, carbs_target_g, fat_target_g } = req.body;
  const uid = req.user.id;

  // If calorie_target or fitness_goal changed but macros not provided, recalculate
  const newCalorie = calorie_target || req.user.calorie_target;
  const newGoal    = fitness_goal   || req.user.fitness_goal;
  const auto = (!protein_target_g) ? calcMacroTargets(newCalorie, newGoal) : {};

  await db.query(
    `UPDATE users SET
       name             = COALESCE(NULLIF(?, ''), name),
       fitness_goal     = COALESCE(NULLIF(?, ''), fitness_goal),
       calorie_target   = COALESCE(NULLIF(?, 0), calorie_target),
       protein_target_g = ?,
       carbs_target_g   = ?,
       fat_target_g     = ?
     WHERE id = ?`,
    [
      name, fitness_goal, calorie_target || null,
      protein_target_g || auto.protein_target_g,
      carbs_target_g   || auto.carbs_target_g,
      fat_target_g     || auto.fat_target_g,
      uid,
    ]
  );

  const [[updated]] = await db.query(
    'SELECT id, email, name, role, fitness_goal, calorie_target, protein_target_g, carbs_target_g, fat_target_g FROM users WHERE id = ?',
    [uid]
  );

  res.json({ user: updated });
});

module.exports = router;
