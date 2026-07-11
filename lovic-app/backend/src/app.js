require('dotenv').config();
require('express-async-errors');
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
    await db.query(`ALTER TABLE bioimpedance ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(5,2) DEFAULT NULL`).catch(() => {});
    await db.query(`ALTER TABLE bioimpedance ADD COLUMN IF NOT EXISTS ai_summary TEXT DEFAULT NULL`).catch(() => {});
    await db.query(`ALTER TABLE bioimpedance ADD COLUMN IF NOT EXISTS bmi DECIMAL(4,1) DEFAULT NULL`).catch(() => {});
    await db.query(`ALTER TABLE bioimpedance ADD COLUMN IF NOT EXISTS body_fat_kg DECIMAL(5,2) DEFAULT NULL`).catch(() => {});
    await db.query(`ALTER TABLE bioimpedance ADD COLUMN IF NOT EXISTS skeletal_muscle_kg DECIMAL(5,2) DEFAULT NULL`).catch(() => {});
    await db.query(`ALTER TABLE bioimpedance ADD COLUMN IF NOT EXISTS calorie_target INT DEFAULT NULL`).catch(() => {});
    await db.query(`ALTER TABLE daily_tracking ADD COLUMN IF NOT EXISTS sleep_hours DECIMAL(3,1) DEFAULT NULL`).catch(() => {});
    await db.query(`ALTER TABLE daily_tracking MODIFY COLUMN mood ENUM('tired','normal','good') DEFAULT NULL`).catch(e => console.error('[migration] mood column:', e.message));
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(100) DEFAULT NULL`).catch(() => {});
    await db.query(`ALTER TABLE workout_plans ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT NULL`).catch(() => {});
    await db.query(`
      CREATE TABLE IF NOT EXISTS client_billing (
        id               VARCHAR(36) PRIMARY KEY,
        client_id        VARCHAR(36) NOT NULL UNIQUE,
        monthly_fee      DECIMAL(10,2) DEFAULT 0,
        next_payment_date DATE DEFAULT NULL,
        notes            TEXT,
        updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});
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
    await db.query(`
      CREATE TABLE IF NOT EXISTS meal_plan_days (
        id          VARCHAR(36) PRIMARY KEY,
        client_id   VARCHAR(36) NOT NULL,
        day_of_week TINYINT NOT NULL,
        UNIQUE KEY uq_client_day (client_id, day_of_week)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`ALTER TABLE meal_plan_days MODIFY COLUMN client_id VARCHAR(36) NOT NULL`).catch(() => {});
    await db.query(`
      CREATE TABLE IF NOT EXISTS meal_plan_items (
        id          VARCHAR(36) PRIMARY KEY,
        day_id      VARCHAR(36) NOT NULL,
        meal_type   VARCHAR(20) NOT NULL,
        description TEXT NOT NULL,
        sort_order  TINYINT DEFAULT 0,
        INDEX idx_day (day_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS meal_completions (
        id          VARCHAR(36) PRIMARY KEY,
        client_id   VARCHAR(36) NOT NULL,
        logged_date DATE NOT NULL,
        meal_type   VARCHAR(20) NOT NULL,
        UNIQUE KEY uq_client_date_meal (client_id, logged_date, meal_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`ALTER TABLE meal_completions MODIFY COLUMN client_id VARCHAR(36) NOT NULL`).catch(() => {});
    await db.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        user_id    VARCHAR(36) NOT NULL,
        endpoint   TEXT NOT NULL,
        subscription TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, endpoint(255))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (e) {
    console.error('Migration error:', e.message);
  }
})();

// Push notifications cron
require('./notifications').startCronJobs();

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
app.use('/meal-plan',       require('./routes/mealPlan'));
app.use('/push',            require('./routes/push').router);

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

// ── Daily renewal reminder ────────────────────────────────────────────────────
async function sendRenewalRemindersJob() {
  try {
    const { sendRenewalReminder } = require('./services/email');
    const [[trainer]] = await db.query(`SELECT * FROM users WHERE role='trainer' LIMIT 1`);
    if (!trainer) return;

    const today = new Date();
    const in7   = new Date(today); in7.setDate(in7.getDate() + 7);
    const in7str = in7.toISOString().slice(0, 10);

    // Plans expiring in exactly 7 days
    const [expiring] = await db.query(
      `SELECT u.name, u.email, wp.start_date, wp.duration_days
       FROM workout_plans wp
       JOIN users u ON u.id = wp.user_id
       WHERE wp.is_active = TRUE AND wp.start_date IS NOT NULL AND wp.duration_days IS NOT NULL
         AND DATE_ADD(wp.start_date, INTERVAL wp.duration_days DAY) = ?`,
      [in7str]
    );
    for (const c of expiring) {
      await sendRenewalReminder(c.email, c.name, 7, trainer.email, trainer.name).catch(e => console.error('[renewal]', e.message));
    }

    // Payment renewals in exactly 7 days
    const [payments] = await db.query(
      `SELECT u.name, u.email FROM client_billing cb
       JOIN users u ON u.id = cb.client_id
       WHERE cb.next_payment_date = ?`,
      [in7str]
    );
    for (const c of payments) {
      await sendRenewalReminder(c.email, c.name, 7, trainer.email, trainer.name).catch(e => console.error('[renewal-payment]', e.message));
    }

    if (expiring.length || payments.length) console.log(`[renewal] Enviados ${expiring.length + payments.length} recordatorios`);
  } catch (e) { console.error('[renewal] Error:', e.message); }
}

(function scheduleRenewalReminders() {
  function msUntilTomorrow9am() {
    const now  = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + (now.getHours() >= 9 ? 1 : 0));
    next.setHours(9, 0, 0, 0);
    return next.getTime() - now.getTime();
  }
  function schedule() {
    setTimeout(async () => {
      await sendRenewalRemindersJob();
      setInterval(sendRenewalRemindersJob, 24 * 60 * 60 * 1000);
    }, msUntilTomorrow9am());
  }
  schedule();
})();

// ── Weekly summary scheduler ──────────────────────────────────────────────────
async function sendWeeklySummaryJob() {
  try {
    const { sendWeeklySummary } = require('./services/email');
    const [[trainer]] = await db.query(`SELECT * FROM users WHERE role='trainer' LIMIT 1`);
    if (!trainer) return;

    const [clients] = await db.query(`SELECT id, name FROM users WHERE role='client' ORDER BY name`);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStr = weekAgo.toISOString().slice(0, 10);

    const clientStats = await Promise.all(clients.map(async (c) => {
      const [[track]] = await db.query(
        `SELECT COUNT(*) as workout_days FROM daily_tracking WHERE user_id=? AND workout_done=1 AND tracked_date >= ?`,
        [c.id, weekStr]
      );
      const [[diet]] = await db.query(
        `SELECT COUNT(*) as diet_days FROM daily_tracking WHERE user_id=? AND diet_followed=1 AND tracked_date >= ?`,
        [c.id, weekStr]
      );
      const [[lastT]] = await db.query(
        `SELECT MAX(tracked_date) as last_trained FROM daily_tracking WHERE user_id=? AND workout_done=1`,
        [c.id]
      );
      // streak
      const [logDays] = await db.query(
        `SELECT DISTINCT DATE_FORMAT(logged_date,'%Y-%m-%d') as d FROM workout_logs WHERE user_id=? ORDER BY d DESC LIMIT 60`, [c.id]
      );
      const [trackDays] = await db.query(
        `SELECT DATE_FORMAT(tracked_date,'%Y-%m-%d') as d FROM daily_tracking WHERE user_id=? AND workout_done=1 ORDER BY d DESC LIMIT 60`, [c.id]
      );
      const allDates = new Set([...logDays.map(r=>r.d), ...trackDays.map(r=>r.d)]);
      const todayStr = new Date().toISOString().slice(0,10);
      let streak = 0, expected = new Date(todayStr).getTime();
      while (allDates.has(new Date(expected).toISOString().slice(0,10))) { streak++; expected -= 86400000; }

      return { name: c.name, workout_days: track.workout_days, diet_days: diet.diet_days, streak, last_trained: lastT.last_trained };
    }));

    await sendWeeklySummary(trainer.email, trainer.name, clientStats);
    console.log('[weekly-summary] Enviado a', trainer.email);
  } catch (e) {
    console.error('[weekly-summary] Error:', e.message);
  }
}

// Run every Monday at 8am — check every hour
(function scheduleWeeklySummary() {
  function msUntilNextMonday8am() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(8, 0, 0, 0);
    // days until Monday (1): if today is Monday and past 8am, next week
    const day = next.getDay(); // 0=Sun,1=Mon,...
    const daysUntilMon = (1 - day + 7) % 7 || (now >= next ? 7 : 0);
    next.setDate(next.getDate() + daysUntilMon);
    return next.getTime() - now.getTime();
  }
  function schedule() {
    const ms = msUntilNextMonday8am();
    console.log(`[weekly-summary] Próximo envío en ${Math.round(ms/3600000)}h`);
    setTimeout(async () => {
      await sendWeeklySummaryJob();
      schedule(); // reschedule for next Monday
    }, ms);
  }
  schedule();
})();

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Imagen demasiado grande (máx 10MB)' });
  res.status(500).json({ error: err.message || 'Error interno' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Lovic API corriendo en puerto ${PORT}`));

module.exports = app;
