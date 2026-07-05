require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
const fs          = require('fs');

const app = express();

// Uploads dir
const uploadPath = process.env.UPLOAD_PATH || 'uploads/';
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

// DB migrations — run once on startup
const db = require('./database/db');
(async () => {
  try {
    await db.query(`ALTER TABLE daily_tracking ADD COLUMN IF NOT EXISTS water_glasses TINYINT DEFAULT 0`);
    await db.query(`ALTER TABLE daily_tracking ADD COLUMN IF NOT EXISTS workout_done TINYINT DEFAULT 0`).catch(() => {});
    await db.query(`ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS warmup_type VARCHAR(100) DEFAULT NULL`).catch(() => {});
    await db.query(`ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS warmup_duration INT DEFAULT NULL`).catch(() => {});
    await db.query(`ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS cardio_type VARCHAR(100) DEFAULT NULL`).catch(() => {});
    await db.query(`ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS cardio_duration INT DEFAULT NULL`).catch(() => {});
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_notes TEXT DEFAULT NULL`).catch(() => {});
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS protein_target_g SMALLINT DEFAULT NULL`);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS carbs_target_g SMALLINT DEFAULT NULL`);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fat_target_g SMALLINT DEFAULT NULL`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS progress_photos (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        image_url VARCHAR(500) NOT NULL,
        note VARCHAR(255) DEFAULT '',
        taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS workout_plans (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS workout_days (
        id VARCHAR(36) PRIMARY KEY,
        plan_id VARCHAR(36) NOT NULL,
        day_name VARCHAR(50) NOT NULL,
        day_order INT DEFAULT 0,
        FOREIGN KEY (plan_id) REFERENCES workout_plans(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS workout_exercises (
        id VARCHAR(36) PRIMARY KEY,
        day_id VARCHAR(36) NOT NULL,
        name VARCHAR(200) NOT NULL,
        youtube_url VARCHAR(500) DEFAULT NULL,
        sets INT DEFAULT 3,
        reps VARCHAR(50) DEFAULT '10',
        weight_kg DECIMAL(5,2) DEFAULT NULL,
        exercise_order INT DEFAULT 0,
        FOREIGN KEY (day_id) REFERENCES workout_days(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`ALTER TABLE nutrition_plans ADD COLUMN IF NOT EXISTS content TEXT`).catch(() => {});
    await db.query(`ALTER TABLE nutrition_plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`).catch(() => {});
    await db.query(`ALTER TABLE nutrition_plans MODIFY COLUMN title VARCHAR(255) DEFAULT ''`).catch(() => {});
    await db.query(`
      CREATE TABLE IF NOT EXISTS nutrition_plans (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        content TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS workout_logs (
        id VARCHAR(36) PRIMARY KEY,
        exercise_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        logged_date DATE NOT NULL,
        set_number INT NOT NULL,
        weight_kg DECIMAL(5,2) DEFAULT NULL,
        reps_done INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_exercise_user (exercise_id, user_id),
        INDEX idx_user_date (user_id, logged_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`ALTER TABLE bioimpedance ADD COLUMN IF NOT EXISTS body_water_pct DECIMAL(4,1) DEFAULT NULL`).catch(() => {});
    await db.query(`ALTER TABLE daily_tracking ADD COLUMN IF NOT EXISTS sleep_hours DECIMAL(3,1) DEFAULT NULL`).catch(() => {});
    await db.query(`
      CREATE TABLE IF NOT EXISTS workout_day_completions (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        day_id VARCHAR(36) NOT NULL,
        completed_date DATE NOT NULL,
        UNIQUE KEY uq_user_day_date (user_id, day_id, completed_date),
        INDEX idx_user_date (user_id, completed_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS workout_activity_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        day_id VARCHAR(36) NOT NULL,
        session_date DATE NOT NULL,
        type ENUM('warmup','cardio') NOT NULL,
        activity_name VARCHAR(100) NOT NULL,
        duration_mins INT DEFAULT NULL,
        UNIQUE KEY uq_user_day_date_type (user_id, day_id, session_date, type),
        INDEX idx_user_day (user_id, day_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS exercise_library (
        id VARCHAR(36) PRIMARY KEY,
        trainer_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        muscle_group VARCHAR(100) DEFAULT NULL,
        youtube_url VARCHAR(500) DEFAULT NULL,
        notes VARCHAR(500) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_trainer (trainer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS exercise_variations (
        id VARCHAR(36) PRIMARY KEY,
        exercise_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        youtube_url VARCHAR(500) DEFAULT NULL,
        notes VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_exercise (exercise_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS library_exercise_id VARCHAR(36) DEFAULT NULL`).catch(() => {});
    await db.query(`ALTER TABLE workout_plans ADD COLUMN IF NOT EXISTS duration_days INT DEFAULT NULL`).catch(() => {});
    await db.query(`
      CREATE TABLE IF NOT EXISTS free_workout_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        session_date DATE NOT NULL,
        note VARCHAR(255),
        exercises JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_date (user_id, session_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (e) {
    console.error('Migration error:', e.message);
  }
})();

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true }));
app.use(express.json());
app.use('/uploads', express.static(path.resolve(uploadPath)));

// Routes
app.use('/auth',          require('./routes/auth'));
app.use('/food',          require('./routes/food'));
app.use('/dashboard',     require('./routes/dashboard'));
app.use('/measurements',  require('./routes/measurements'));
app.use('/bioimpedance',  require('./routes/bioimpedance'));
app.use('/trainer',       require('./routes/trainer'));
app.use('/questionnaire', require('./routes/questionnaire'));
app.use('/profile',         require('./routes/profile'));
app.use('/progress-photos', require('./routes/progressPhotos'));
app.use('/workout',         require('./routes/workout'));

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Imagen demasiado grande (máx 10MB)' });
  res.status(500).json({ error: err.message || 'Error interno' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Lovic API corriendo en puerto ${PORT}`));

module.exports = app;
