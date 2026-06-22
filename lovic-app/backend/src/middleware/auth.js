const jwt = require('jsonwebtoken');
const db  = require('../database/db');

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
              (SELECT COUNT(*) FROM questionnaire_data q WHERE q.user_id = u.id) > 0 AS has_questionnaire
       FROM users u WHERE u.id = ?`,
      [payload.sub]
    );
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

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
        // Persist so we don't recalculate every request
        await db.query('UPDATE users SET calorie_target = ? WHERE id = ?', [target, user.id]);
      } else {
        user.calorie_target = 2000;
      }
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

module.exports = { requireAuth, requireTrainer };
