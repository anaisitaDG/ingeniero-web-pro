const express  = require('express');
const router   = express.Router();
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const bcrypt   = require('bcryptjs');
const db       = require('../database/db');
const { sendMagicLink, sendWelcome } = require('../services/email');
const { requireAuth } = require('../middleware/auth');

// POST /auth/magic-link — solicita enlace de acceso
router.post('/magic-link', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const [[user]] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(404).json({ error: 'No existe una cuenta con ese email' });

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.query(
      'INSERT INTO magic_links (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt]
    );

    try {
      await sendMagicLink(email, user.name, token);
    } catch (emailErr) {
      await db.query('DELETE FROM magic_links WHERE token=?', [token]);
      throw emailErr;
    }
    res.json({ message: 'Enlace enviado a tu correo' });
  } catch (e) {
    console.error('[magic-link]', e.message);
    res.status(500).json({ error: 'No se pudo enviar el enlace. Intenta de nuevo.' });
  }
});

// POST /auth/onboarding — crea cuenta desde formulario de valoración
router.post('/onboarding', async (req, res) => { try {
  const { email, name, phone, questionnaire } = req.body;
  if (!email || !name) return res.status(400).json({ error: 'Email y nombre requeridos' });

  const [[existing]] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  let userId;

  if (existing) {
    userId = existing.id;
  } else {
    userId = uuidv4();
    await db.query(
      'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, "client")',
      [userId, email, name]
    );
  }

  if (questionnaire) {
    await db.query(`
      INSERT INTO questionnaire_data (user_id, age, birth_date, height_cm, weight_kg, occupation, city, phone,
        main_goal, goal_timeframe, trained_before, training_detail, training_days_week,
        has_injury, injury_detail, medical_conditions, medical_detail, takes_medication, medication_detail,
        energy_level, diet_quality, meals_per_day, drinks_water, has_allergies, allergy_detail,
        eats_breakfast, first_meal_time, last_meal_time, willing_to_follow,
        proteins, carbs, fats, fruit_portions, vegetable_portions,
        fast_food_frequency, sugary_drinks, biggest_craving, foods_to_avoid,
        sleep_hours, stress_level, drinks_alcohol, alcohol_detail, smokes, smoke_detail,
        meal_preparer, cooking_time, motivation, expectations, obstacles, commitment_level,
        arm_cm, chest_cm, waist_cm, hip_cm, thigh_cm, calf_cm, forearm_cm, nutritional_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE age = VALUES(age)
    `, [
      userId,
      questionnaire.age, questionnaire.birth_date, questionnaire.height_cm, questionnaire.weight_kg,
      questionnaire.occupation, questionnaire.city, phone || questionnaire.phone,
      JSON.stringify(questionnaire.main_goal), questionnaire.goal_timeframe,
      questionnaire.trained_before, questionnaire.training_detail, questionnaire.training_days_week,
      questionnaire.has_injury, questionnaire.injury_detail,
      JSON.stringify(questionnaire.medical_conditions), questionnaire.medical_detail,
      questionnaire.takes_medication, questionnaire.medication_detail,
      questionnaire.energy_level, questionnaire.diet_quality, questionnaire.meals_per_day,
      questionnaire.drinks_water, questionnaire.has_allergies, questionnaire.allergy_detail,
      questionnaire.eats_breakfast, questionnaire.first_meal_time, questionnaire.last_meal_time,
      questionnaire.willing_to_follow,
      JSON.stringify(questionnaire.proteins), JSON.stringify(questionnaire.carbs),
      JSON.stringify(questionnaire.fats), questionnaire.fruit_portions, questionnaire.vegetable_portions,
      questionnaire.fast_food_frequency, questionnaire.sugary_drinks,
      JSON.stringify(questionnaire.biggest_craving), questionnaire.foods_to_avoid,
      questionnaire.sleep_hours, questionnaire.stress_level,
      questionnaire.drinks_alcohol, questionnaire.alcohol_detail,
      questionnaire.smokes, questionnaire.smoke_detail,
      questionnaire.meal_preparer, questionnaire.cooking_time,
      questionnaire.motivation, questionnaire.expectations, questionnaire.obstacles,
      questionnaire.commitment_level,
      questionnaire.arm_cm, questionnaire.chest_cm, questionnaire.waist_cm,
      questionnaire.hip_cm, questionnaire.thigh_cm, questionnaire.calf_cm,
      questionnaire.forearm_cm, questionnaire.nutritional_notes,
    ]);
  }

  // Enviar magic link automático
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.query('INSERT INTO magic_links (user_id, token, expires_at) VALUES (?, ?, ?)', [userId, token, expiresAt]);
  try {
    await sendWelcome(email, name);
    await sendMagicLink(email, name, token);
  } catch (emailErr) {
    await db.query('DELETE FROM magic_links WHERE token=?', [token]);
    throw emailErr;
  }

  res.json({ message: 'Perfil creado. Revisa tu correo para acceder.' });
} catch (e) {
  console.error('[onboarding]', e.message);
  res.status(500).json({ error: 'Error al crear perfil. Intenta de nuevo.' });
}
});

// GET /auth/verify?token=xxx
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.redirect(`${process.env.APP_URL}/login?error=token-requerido`);

    const [[link]] = await db.query(
      'SELECT * FROM magic_links WHERE token = ? AND used = FALSE AND expires_at > NOW()',
      [token]
    );
    if (!link) return res.redirect(`${process.env.APP_URL}/login?error=link-expirado`);

    await db.query('UPDATE magic_links SET used = TRUE WHERE id = ?', [link.id]);

    const [[tokenUser]] = await db.query('SELECT role FROM users WHERE id=?', [link.user_id]);
    const jwt_token = jwt.sign({ sub: link.user_id, role: tokenUser?.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    res.redirect(`${process.env.APP_URL}/?token=${jwt_token}`);
  } catch (e) {
    console.error('[verify]', e.message);
    res.redirect(`${process.env.APP_URL}/login?error=error-interno`);
  }
});

// POST /auth/login — login con contraseña
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  const [[user]] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  if (!user.password_hash) return res.status(401).json({ error: 'Esta cuenta no tiene contraseña. Usa el enlace por correo.' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// POST /auth/set-password — establecer o cambiar contraseña
router.post('/set-password', requireAuth, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  const hash = await bcrypt.hash(password, 10);
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  res.json({ message: 'Contraseña guardada' });
});

// GET /auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
