const jwt = require('jsonwebtoken');
const db  = require('../database/db');

function calcMacroTargets(calorieTarget, fitnessGoal) {
  const kcal = calorieTarget || 2000;
  const goal = fitnessGoal || 'maintenance';
  // protein/carbs/fat split as % of calories
  const splits = {
    fat_loss:     { p: 0.40, c: 0.30, f: 0.30 },
    muscle_gain:  { p: 0.30, c: 0.40, f: 0.30 },
    maintenance:  { p: 0.25, c: 0.45, f: 0.30 },
    health:       { p: 0.25, c: 0.45, f: 0.30 },
  };
  const s = splits[goal] || splits.maintenance;
  return {
    protein_target_g: Math.round((kcal * s.p) / 4),
    carbs_target_g:   Math.round((kcal * s.c) / 4),
    fat_target_g:     Math.round((kcal * s.f) / 9),
  };
}


async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [[user]] = await db.query(
      `SELECT u.id, u.email, u.name, u.role, u.calorie_target, u.fitness_goal,
              u.protein_target_g, u.carbs_target_g, u.fat_target_g,
              (SELECT COUNT(*) FROM questionnaire_data q WHERE q.user_id = u.id) > 0 AS has_questionnaire
       FROM users u WHERE u.id = ?`,
      [payload.sub]
    );
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    // Skip calorie/macro calculations for trainers
    if (user.role === 'trainer') {
      req.user = user;
      return next();
    }

    // If calorie_target not set, calculate from questionnaire data
    if (!user.calorie_target) {
      const [[q]] = await db.query(
        'SELECT weight_kg, height_cm, age FROM questionnaire_data WHERE user_id = ? LIMIT 1',
        [user.id]
      );
      if (q && q.weight_kg && q.height_cm && q.age) {
        const bmr = 10 * q.weight_kg + 6.25 * q.height_cm - 5 * q.age + 5;
        const tdee = Math.round(bmr * 1.55);
        const goal = user.fitness_goal || 'maintenance';
        const target = goal === 'fat_loss' ? tdee - 400 : goal === 'muscle_gain' ? tdee + 300 : tdee;
        user.calorie_target = target;
        await db.query('UPDATE users SET calorie_target = ? WHERE id = ?', [target, user.id]);
      } else {
        user.calorie_target = 2000;
      }
    }

    // If macro targets not set, auto-calculate from calorie_target + fitness_goal
    if (!user.protein_target_g) {
      const macros = calcMacroTargets(user.calorie_target, user.fitness_goal);
      Object.assign(user, macros);
      await db.query(
        'UPDATE users SET protein_target_g=?, carbs_target_g=?, fat_target_g=? WHERE id=?',
        [macros.protein_target_g, macros.carbs_target_g, macros.fat_target_g, user.id]
      );
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function requireTrainer(req, res, next) {
  if (req.user?.role !== 'trainer') {
    return res.status(403).json({ error: 'Acceso solo para entrenadores' });
  }
  next();
}

module.exports = { requireAuth, requireTrainer, calcMacroTargets };
