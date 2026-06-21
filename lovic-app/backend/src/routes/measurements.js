const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// POST /measurements
router.post('/', async (req, res) => {
  const { weight_kg, arm_cm, chest_cm, waist_cm, hip_cm, thigh_cm, calf_cm, forearm_cm, notes } = req.body;

  await db.query(
    `INSERT INTO measurements (id, user_id, weight_kg, arm_cm, chest_cm, waist_cm, hip_cm, thigh_cm, calf_cm, forearm_cm, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), req.user.id, weight_kg, arm_cm, chest_cm, waist_cm, hip_cm, thigh_cm, calf_cm, forearm_cm, notes]
  );

  res.json({ message: 'Medidas guardadas' });
});

// GET /measurements
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const [rows] = await db.query(
    `SELECT * FROM measurements WHERE user_id=? ORDER BY logged_at DESC LIMIT ?`,
    [req.user.id, limit]
  );
  res.json({ measurements: rows });
});

module.exports = router;
