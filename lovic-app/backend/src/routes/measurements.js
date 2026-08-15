const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { sendMeasurementUpdate } = require('../services/email');

router.use(requireAuth);

// Avisa a la entrenadora (en segundo plano) cuando una CLIENTA registra medidas.
async function notifyTrainerMeasurements(user) {
  try {
    const [[trainer]] = await db.query(`SELECT name, email FROM users WHERE role='trainer' LIMIT 1`);
    if (!trainer?.email) return;
    const [rows] = await db.query(
      `SELECT * FROM measurements WHERE user_id=? ORDER BY logged_at DESC, created_at DESC LIMIT 2`,
      [user.id]
    );
    if (!rows.length) return;
    const current = rows[0];
    const previous = rows[1] || null;
    await sendMeasurementUpdate(trainer.email, trainer.name, user.name, user.id, current, previous);
  } catch (e) {
    console.error('[notifyTrainerMeasurements]', e.message);
  }
}

// POST /measurements
router.post('/', async (req, res) => {
  try {
    const { weight_kg, arm_cm, chest_cm, waist_cm, hip_cm, thigh_cm, calf_cm, forearm_cm, notes } = req.body;
    const hasValue = [weight_kg, arm_cm, chest_cm, waist_cm, hip_cm, thigh_cm, calf_cm, forearm_cm].some(v => v != null && v !== '');
    if (!hasValue) return res.status(400).json({ error: 'Al menos una medida es requerida' });

    // Validación de rangos (las columnas son DECIMAL(5,2): tope 999.99; evita "Out of range")
    const num = v => (v == null || v === '' ? null : Number(v));
    const checks = [
      ['El peso', weight_kg, 1, 500],
      ['El brazo', arm_cm, 1, 200], ['El pecho', chest_cm, 1, 250], ['La cintura', waist_cm, 1, 250],
      ['La cadera', hip_cm, 1, 250], ['El muslo', thigh_cm, 1, 200], ['La pantorrilla', calf_cm, 1, 150],
      ['El antebrazo', forearm_cm, 1, 150],
    ];
    for (const [label, val, min, max] of checks) {
      const n = num(val);
      if (n != null && (isNaN(n) || n < min || n > max)) {
        return res.status(400).json({ error: `${label} tiene un valor fuera de rango (revisa que no sea un error de dedo).` });
      }
    }

    await db.query(
      `INSERT INTO measurements (id, user_id, weight_kg, arm_cm, chest_cm, waist_cm, hip_cm, thigh_cm, calf_cm, forearm_cm, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), req.user.id, num(weight_kg), num(arm_cm), num(chest_cm), num(waist_cm), num(hip_cm), num(thigh_cm), num(calf_cm), num(forearm_cm), notes || null]
    );

    res.json({ message: 'Medidas guardadas' });

    // Aviso a la entrenadora (solo si quien registra es una clienta), en segundo plano
    if (req.user.role === 'client') notifyTrainerMeasurements(req.user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /measurements
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const [rows] = await db.query(
      `SELECT * FROM measurements WHERE user_id=? ORDER BY logged_at DESC LIMIT ?`,
      [req.user.id, limit]
    );
    res.json({ measurements: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
