const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// POST /measurements
router.post('/', async (req, res) => {
  try {
    const { weight_kg, arm_cm, chest_cm, waist_cm, hip_cm, thigh_cm, calf_cm, forearm_cm, notes } = req.body;
    const hasValue = [weight_kg, arm_cm, chest_cm, waist_cm, hip_cm, thigh_cm, calf_cm, forearm_cm].some(v => v != null && v !== '');
    if (!hasValue) return res.status(400).json({ error: 'Al menos una medida es requerida' });

    await db.query(
      `INSERT INTO measurements (id, user_id, weight_kg, arm_cm, chest_cm, waist_cm, hip_cm, thigh_cm, calf_cm, forearm_cm, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), req.user.id, weight_kg || null, arm_cm || null, chest_cm || null, waist_cm || null, hip_cm || null, thigh_cm || null, calf_cm || null, forearm_cm || null, notes || null]
    );

    res.json({ message: 'Medidas guardadas' });
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
