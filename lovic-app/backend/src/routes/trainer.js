const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { generateRoutine, generateNutritionPlan } = require('../services/ai');

router.use(requireAuth);

const requireTrainer = (req, res, next) => {
  if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Solo entrenadores' });
  next();
};

router.use(requireTrainer);

// GET /trainer/clients
router.get('/clients', async (req, res) => {
  const [clients] = await db.query(
    `SELECT u.id, u.name, u.email, u.created_at,
       q.main_goal, q.weight_kg, q.height_cm,
       (SELECT logged_at FROM measurements WHERE user_id=u.id ORDER BY logged_at DESC LIMIT 1) AS last_measurement
     FROM users u
     LEFT JOIN questionnaire_data q ON q.user_id = u.id
     WHERE u.role = 'client'
     ORDER BY u.created_at DESC`,
    []
  );
  res.json({ clients });
});

// GET /trainer/clients/:id
router.get('/clients/:id', async (req, res) => {
  const uid = req.params.id;

  const [[user]] = await db.query('SELECT * FROM users WHERE id=? AND role="client"', [uid]);
  if (!user) return res.status(404).json({ error: 'Cliente no encontrado' });

  const [[questionnaire]] = await db.query('SELECT * FROM questionnaire_data WHERE user_id=?', [uid]);

  const [measurements] = await db.query(
    'SELECT * FROM measurements WHERE user_id=? ORDER BY logged_at DESC LIMIT 10', [uid]
  );

  const [bioimpedance] = await db.query(
    'SELECT * FROM bioimpedance WHERE user_id=? ORDER BY logged_at DESC LIMIT 5', [uid]
  );

  const [[routine]] = await db.query(
    'SELECT * FROM routines WHERE user_id=? AND is_active=TRUE ORDER BY created_at DESC LIMIT 1', [uid]
  );

  const [[nutrition]] = await db.query(
    'SELECT * FROM nutrition_plans WHERE user_id=? AND is_active=TRUE ORDER BY created_at DESC LIMIT 1', [uid]
  );

  const [adherence] = await db.query(
    `SELECT COUNT(*) as total_days, SUM(workout_done) as workout_days, SUM(diet_followed) as diet_days
     FROM daily_tracking WHERE user_id=? AND tracked_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
    [uid]
  );

  res.json({ user, questionnaire, measurements, bioimpedance, routine, nutrition_plan: nutrition, adherence: adherence[0] });
});

// PUT /trainer/clients/:id/routine — guarda rutina manual
router.put('/clients/:id/routine', async (req, res) => {
  const uid = req.params.id;
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Contenido requerido' });

  await db.query('UPDATE routines SET is_active=FALSE WHERE user_id=?', [uid]);
  await db.query(
    'INSERT INTO routines (id, user_id, content, is_active) VALUES (?, ?, ?, TRUE)',
    [uuidv4(), uid, content.trim()]
  );
  res.json({ routine: content.trim() });
});

// PUT /trainer/clients/:id/nutrition — guarda plan nutricional manual
router.put('/clients/:id/nutrition', async (req, res) => {
  const uid = req.params.id;
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Contenido requerido' });

  await db.query('UPDATE nutrition_plans SET is_active=FALSE WHERE user_id=?', [uid]);
  const planId = uuidv4();
  await db.query(
    'INSERT INTO nutrition_plans (id, user_id, content, is_active) VALUES (?, ?, ?, TRUE)',
    [planId, uid, content.trim()]
  );
  const calories = extractCalorieTarget(content);
  if (calories) await db.query('UPDATE users SET calorie_target=? WHERE id=?', [calories, uid]);
  res.json({ nutrition_plan: content.trim() });
});

// POST /trainer/clients/:id/routine — genera rutina con IA
router.post('/clients/:id/routine', async (req, res) => {
  const uid = req.params.id;
  const { override_prompt } = req.body;

  const [[questionnaire]] = await db.query('SELECT * FROM questionnaire_data WHERE user_id=?', [uid]);
  if (!questionnaire) return res.status(400).json({ error: 'El cliente no tiene cuestionario' });

  const content = await generateRoutine(questionnaire, override_prompt);

  await db.query('UPDATE routines SET is_active=FALSE WHERE user_id=?', [uid]);
  await db.query(
    'INSERT INTO routines (id, user_id, content, is_active) VALUES (?, ?, ?, TRUE)',
    [uuidv4(), uid, content]
  );

  res.json({ routine: content });
});

// POST /trainer/clients/:id/nutrition — genera plan nutricional con IA
router.post('/clients/:id/nutrition', async (req, res) => {
  const uid = req.params.id;
  const { override_prompt } = req.body;

  const [[questionnaire]] = await db.query('SELECT * FROM questionnaire_data WHERE user_id=?', [uid]);
  if (!questionnaire) return res.status(400).json({ error: 'El cliente no tiene cuestionario' });

  const [[user]] = await db.query('SELECT * FROM users WHERE id=?', [uid]);
  const content = await generateNutritionPlan(questionnaire, user, override_prompt);

  await db.query('UPDATE nutrition_plans SET is_active=FALSE WHERE user_id=?', [uid]);
  const planId = uuidv4();
  await db.query(
    'INSERT INTO nutrition_plans (id, user_id, content, is_active) VALUES (?, ?, ?, TRUE)',
    [planId, uid, content]
  );

  const calories = extractCalorieTarget(content);
  if (calories) {
    await db.query('UPDATE users SET calorie_target=? WHERE id=?', [calories, uid]);
  }

  res.json({ nutrition_plan: content });
});

// PUT /trainer/clients/:id/targets — actualiza metas de calorías y macros
router.put('/clients/:id/targets', async (req, res) => {
  const { calorie_target, protein_target_g, carbs_target_g, fat_target_g } = req.body;
  const uid = req.params.id;
  await db.query(
    `UPDATE users SET
       calorie_target   = COALESCE(?, calorie_target),
       protein_target_g = COALESCE(?, protein_target_g),
       carbs_target_g   = COALESCE(?, carbs_target_g),
       fat_target_g     = COALESCE(?, fat_target_g)
     WHERE id = ?`,
    [calorie_target || null, protein_target_g || null, carbs_target_g || null, fat_target_g || null, uid]
  );
  res.json({ message: 'Metas actualizadas' });
});

// POST /trainer/clients/:id/invite — envía magic link de acceso
router.post('/clients/:id/invite', async (req, res) => {
  const [[user]] = await db.query('SELECT * FROM users WHERE id=? AND role="client"', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'Cliente no encontrado' });

  const { sendMagicLink } = require('../services/email');
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.query('INSERT INTO magic_links (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, token, expiresAt]);
  await sendMagicLink(user.email, user.name, token);

  res.json({ message: 'Invitación enviada' });
});

function extractCalorieTarget(content) {
  const match = content.match(/(\d{3,4})\s*kcal/i);
  return match ? parseInt(match[1]) : null;
}

module.exports = router;
