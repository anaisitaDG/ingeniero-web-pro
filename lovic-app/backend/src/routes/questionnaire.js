const express = require('express');
const router  = express.Router();
const db      = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { notifyTrainerOnboarding } = require('../services/email');

router.use(requireAuth);

// POST /questionnaire
router.post('/', async (req, res) => {
  const q = req.body;
  const uid = req.user.id;

  await db.query(`
    INSERT INTO questionnaire_data (
      user_id, age, birth_date, height_cm, weight_kg, occupation, city, phone,
      main_goal, goal_timeframe, trained_before, training_detail, training_days_week,
      has_injury, injury_detail, medical_conditions, medical_detail,
      takes_medication, medication_detail, energy_level,
      diet_quality, meals_per_day, drinks_water, has_allergies, allergy_detail,
      eats_breakfast, first_meal_time, last_meal_time, willing_to_follow,
      proteins, carbs, fats, fruit_portions, vegetable_portions,
      fast_food_frequency, sugary_drinks, biggest_craving, foods_to_avoid,
      sleep_hours, stress_level, drinks_alcohol, alcohol_detail, smokes, smoke_detail,
      meal_preparer, cooking_time, motivation, expectations, obstacles, commitment_level,
      arm_cm, chest_cm, waist_cm, hip_cm, thigh_cm, calf_cm, forearm_cm, nutritional_notes
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      age=VALUES(age), height_cm=VALUES(height_cm), weight_kg=VALUES(weight_kg),
      main_goal=VALUES(main_goal), goal_timeframe=VALUES(goal_timeframe),
      trained_before=VALUES(trained_before), training_days_week=VALUES(training_days_week),
      has_injury=VALUES(has_injury), injury_detail=VALUES(injury_detail),
      energy_level=VALUES(energy_level), diet_quality=VALUES(diet_quality),
      motivation=VALUES(motivation), commitment_level=VALUES(commitment_level)
  `, [
    uid,
    q.age, q.birth_date, q.height_cm, q.weight_kg, q.occupation, q.city, q.phone,
    JSON.stringify(q.main_goal), q.goal_timeframe,
    q.trained_before, q.training_detail, q.training_days_week,
    q.has_injury, q.injury_detail,
    JSON.stringify(q.medical_conditions), q.medical_detail,
    q.takes_medication, q.medication_detail, q.energy_level,
    q.diet_quality, q.meals_per_day, q.drinks_water, q.has_allergies, q.allergy_detail,
    q.eats_breakfast, q.first_meal_time, q.last_meal_time, q.willing_to_follow,
    JSON.stringify(q.proteins), JSON.stringify(q.carbs), JSON.stringify(q.fats),
    q.fruit_portions, q.vegetable_portions,
    q.fast_food_frequency, q.sugary_drinks,
    JSON.stringify(q.biggest_craving), q.foods_to_avoid,
    q.sleep_hours, q.stress_level,
    q.drinks_alcohol, q.alcohol_detail, q.smokes, q.smoke_detail,
    q.meal_preparer, q.cooking_time,
    q.motivation, q.expectations, q.obstacles, q.commitment_level,
    q.arm_cm, q.chest_cm, q.waist_cm, q.hip_cm, q.thigh_cm, q.calf_cm, q.forearm_cm,
    q.nutritional_notes,
  ]);

  // Calculate calorie target from biometrics if not provided
  let calorie_target = q.calorie_target || null;
  if (!calorie_target && q.weight_kg && q.height_cm && q.age) {
    // Mifflin-St Jeor neutral BMR (no gender)
    const bmr = 10 * parseFloat(q.weight_kg) + 6.25 * parseFloat(q.height_cm) - 5 * parseFloat(q.age) + 5;
    const tdee = Math.round(bmr * 1.55); // moderate activity
    const goal = q.fitness_goal || 'maintenance';
    if (goal === 'fat_loss')    calorie_target = tdee - 400;
    else if (goal === 'muscle_gain') calorie_target = tdee + 300;
    else                             calorie_target = tdee;
  }

  // Update calorie_target and fitness_goal on users table
  if (q.fitness_goal || calorie_target) {
    await db.query(
      'UPDATE users SET fitness_goal = COALESCE(?, fitness_goal), calorie_target = COALESCE(?, calorie_target) WHERE id = ?',
      [q.fitness_goal || null, calorie_target, uid]
    );
  }

  // Notify trainer
  const [[u]] = await db.query('SELECT name FROM users WHERE id=?', [uid]);
  notifyTrainerOnboarding(u?.name || 'Una clienta').catch(() => {});

  res.json({ message: 'Cuestionario guardado' });
});

module.exports = router;
