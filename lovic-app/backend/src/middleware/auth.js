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
      'SELECT id, email, name, role, calorie_target, fitness_goal FROM users WHERE id = ?',
      [payload.sub]
    );
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
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
