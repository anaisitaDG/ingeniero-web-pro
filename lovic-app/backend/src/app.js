require('dotenv').config();
require('express-async-errors');
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
const fs          = require('fs');

const app = express();

// Guard de arranque: sin JWT_SECRET no se puede firmar/verificar sesiones de forma segura.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('❌ FATAL: falta JWT_SECRET (o es muy corto) en el .env. El login no funcionaría de forma segura. Abortando.');
  process.exit(1);
}
// Visibilidad: cuánto dura la sesión (si ves "30" a secas, son 30 SEGUNDOS → pon "30d").
console.log(`🔐 JWT expira en: ${process.env.JWT_EXPIRES_IN || '60d (default)'}`);

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
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS meal_plan_note TEXT DEFAULT NULL`).catch(() => {});
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
    // Nuevo tipo 'cardio_inicio' (cardio breve después del calentamiento)
    await db.query(`ALTER TABLE workout_activity_logs MODIFY COLUMN type ENUM('warmup','cardio','cardio_inicio') NOT NULL`).catch(() => {});
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
    // Modo del ejercicio: 'reps' (por defecto, no cambia nada existente) o 'time' (por tiempo/segundos)
    await db.query(`ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS tracking_type VARCHAR(8) NOT NULL DEFAULT 'reps'`).catch(() => {});
    await db.query(`ALTER TABLE workout_plans ADD COLUMN IF NOT EXISTS duration_days INT DEFAULT NULL`).catch(() => {});
    await db.query(`ALTER TABLE workout_plans ADD COLUMN IF NOT EXISTS name VARCHAR(120) DEFAULT NULL`).catch(() => {});
    await db.query(`ALTER TABLE workout_plans ADD COLUMN IF NOT EXISTS stats_email_sent BOOLEAN DEFAULT 0`).catch(() => {});
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
    // Foto de perfil personalizada (si no hay, se usa el Gravatar del correo)
    await db.query(`ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) DEFAULT NULL`).catch(() => {});
    // Series con tipo (normal | isometria) y tiempo para isometrías
    await db.query(`ALTER TABLE workout_logs ADD COLUMN set_type VARCHAR(12) NOT NULL DEFAULT 'normal'`).catch(() => {});
    await db.query(`ALTER TABLE workout_logs ADD COLUMN duration_secs INT DEFAULT NULL`).catch(() => {});
    // Ejercicios agregados por la clienta en el día (solo para esa sesión, no cambian el plan)
    await db.query(`
      CREATE TABLE IF NOT EXISTS session_extra_exercises (
        id           VARCHAR(36) PRIMARY KEY,
        user_id      VARCHAR(36) NOT NULL,
        day_id       VARCHAR(36) NOT NULL,
        session_date DATE NOT NULL,
        name         VARCHAR(255) NOT NULL,
        sets         TEXT,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_day_date (user_id, day_id, session_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});
    // Caché de análisis IA de comparación de fotos (evita repetir la llamada por el mismo par)
    await db.query(`
      CREATE TABLE IF NOT EXISTS photo_comparisons (
        id         VARCHAR(36) PRIMARY KEY,
        user_id    VARCHAR(36) NOT NULL,
        pair_key   VARCHAR(120) NOT NULL,
        analysis   TEXT,
        zones      TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_pair (user_id, pair_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Dedupe del recordatorio dinámico de comida (1 aviso por clienta por día)
    await db.query(`
      CREATE TABLE IF NOT EXISTS meal_reminder_sent (
        user_id   VARCHAR(36) NOT NULL,
        sent_date DATE NOT NULL,
        PRIMARY KEY (user_id, sent_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // Fibra en cada registro de comida (informativa, sin meta)
    await db.query(`ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS fiber_g SMALLINT DEFAULT NULL`).catch(() => {});

    // Dedupe del recordatorio de ENTRENO (dinámico: a la hora habitual de cada clienta)
    await db.query(`
      CREATE TABLE IF NOT EXISTS workout_reminder_sent (
        user_id   VARCHAR(36) NOT NULL,
        sent_date DATE NOT NULL,
        PRIMARY KEY (user_id, sent_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Dedupe del recordatorio de la NOCHE (Nivel 2: por si faltó registrar alguna comida)
    await db.query(`
      CREATE TABLE IF NOT EXISTS meal_evening_sent (
        user_id   VARCHAR(36) NOT NULL,
        sent_date DATE NOT NULL,
        PRIMARY KEY (user_id, sent_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // Dedupe de la alerta a Lorena (clientas sin registrar): máx. 1 cada 3 días por clienta
    await db.query(`
      CREATE TABLE IF NOT EXISTS nutrition_alert_sent (
        client_id VARCHAR(36) PRIMARY KEY,
        last_sent DATE NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ===== Nutrición por tipo de entrenamiento (superior / inferior / descanso) =====
    // Zona muscular de cada ejercicio de la biblioteca: sirve para auto-sugerir el tipo del día
    await db.query(`ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS body_zone VARCHAR(12) DEFAULT NULL`).catch(() => {});
    // Tipo de cada día de la rutina: define qué comida se muestra (superior | inferior | descanso)
    await db.query(`ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS day_type VARCHAR(12) DEFAULT NULL`).catch(() => {});
    // Modo de nutrición por clienta: 'simple' (fijo, se repite las 4 semanas) o 'rotativo' (4 semanas distintas)
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nutrition_mode VARCHAR(12) NOT NULL DEFAULT 'simple'`).catch(() => {});
    // Biblioteca de comidas de la entrenadora (reutilizable)
    await db.query(`
      CREATE TABLE IF NOT EXISTS meal_library (
        id          VARCHAR(36) PRIMARY KEY,
        trainer_id  VARCHAR(36) NOT NULL,
        name        VARCHAR(200) NOT NULL,
        description TEXT,
        meal_type   VARCHAR(20) NOT NULL,           -- desayuno | almuerzo | merienda | cena
        body_zone   VARCHAR(12) DEFAULT NULL,       -- superior | inferior | NULL (cualquiera)
        calories    INT DEFAULT NULL,
        protein_g   INT DEFAULT NULL,
        carbs_g     INT DEFAULT NULL,
        fat_g       INT DEFAULT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_trainer (trainer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // Comidas asignadas a una clienta por (semana × zona × momento). Se guarda copia de los datos
    // para que editar/borrar la biblioteca no dañe planes ya asignados.
    await db.query(`
      CREATE TABLE IF NOT EXISTS client_meal_slots (
        id          VARCHAR(36) PRIMARY KEY,
        client_id   VARCHAR(36) NOT NULL,
        week_no     TINYINT NOT NULL DEFAULT 1,     -- 1..4 (en modo simple siempre 1)
        body_zone   VARCHAR(12) NOT NULL,           -- superior | inferior
        meal_type   VARCHAR(20) NOT NULL,           -- desayuno | almuerzo | merienda | cena
        library_id  VARCHAR(36) DEFAULT NULL,       -- referencia opcional a meal_library
        name        VARCHAR(200) NOT NULL,
        description TEXT,
        calories    INT DEFAULT NULL,
        protein_g   INT DEFAULT NULL,
        carbs_g     INT DEFAULT NULL,
        fat_g       INT DEFAULT NULL,
        sort_order  TINYINT DEFAULT 0,              -- permite varias meriendas / varios items por momento
        INDEX idx_client (client_id, week_no, body_zone)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // Indicaciones & suplementación: una lista por clienta (momento libre, item, dosis).
    await db.query(`
      CREATE TABLE IF NOT EXISTS client_supplements (
        id          VARCHAR(36) PRIMARY KEY,
        client_id   VARCHAR(36) NOT NULL,
        moment      VARCHAR(120) NOT NULL,          -- momento libre: 'Antes de Cardio', 'Post-Entreno', 'En ayunas'...
        item        VARCHAR(200) NOT NULL,          -- suplemento o alimento
        dose        VARCHAR(200) DEFAULT NULL,      -- dosis / detalle
        sort_order  SMALLINT DEFAULT 0,
        INDEX idx_client (client_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // Registro diario: qué suplemento marcó la clienta como tomado y en qué fecha.
    await db.query(`
      CREATE TABLE IF NOT EXISTS supplement_logs (
        id            VARCHAR(36) PRIMARY KEY,
        client_id     VARCHAR(36) NOT NULL,
        supplement_id VARCHAR(36) NOT NULL,
        logged_date   DATE NOT NULL,
        UNIQUE KEY uniq_supp_day (supplement_id, logged_date),
        INDEX idx_client_day (client_id, logged_date)
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

// Detrás de nginx: confiar en 1 proxy para leer la IP real (si no, TODAS las clientas
// cuentan como una sola IP y comparten el límite → 429 masivo).
app.set('trust proxy', 1);
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,                                   // por usuario real, no global
  standardHeaders: true,
  legacyHeaders: false,
  // nginx manda la IP real en X-Real-IP; con eso limitamos por persona, no por el proxy
  keyGenerator: (req) => req.headers['x-real-ip'] || req.ip,
  // Las imágenes/miniaturas NO deben gastar el cupo de la API
  skip: (req) => req.path.startsWith('/progress-photos') || req.path.startsWith('/uploads'),
  validate: false,
}));
app.use(express.json());
// Helper: registra el error real en el servidor pero NO lo filtra al cliente.
app.use((req, res, next) => {
  res.serverError = (e) => {
    console.error(`[${req.method} ${req.path}]`, e?.message || e);
    if (!res.headersSent) res.status(500).json({ error: 'Error interno del servidor' });
  };
  next();
});
app.use('/uploads', express.static(path.resolve(uploadPath)));
// Imágenes servidas por una URL SIN extensión de imagen (el nombre va como ?f=),
// para que la regla de nginx que atrapa *.jpg no la intercepte. Pública, para <img>.
// Con ?w=ANCHO devuelve una miniatura liviana (webp) cacheada en disco.
let _sharp = null;
try { _sharp = require('sharp'); } catch { /* opcional: si no está, se sirve el original */ }
const _jwt = require('jsonwebtoken');
app.get('/progress-photos/img', async (req, res) => {
  // Candado: solo con una sesión válida (el token va como ?t= porque <img> no manda cabeceras)
  try { _jwt.verify(String(req.query.t || ''), process.env.JWT_SECRET); }
  catch { return res.status(403).end(); }
  const file = path.basename(String(req.query.f || ''));
  if (!file) return res.status(400).end();
  const src = path.resolve(uploadPath, file);
  const w = Math.min(parseInt(req.query.w, 10) || 0, 1200);
  const opts = { maxAge: '365d', immutable: true };
  if (w && _sharp) {
    try {
      const fs = require('fs');
      const thumbDir = path.resolve(uploadPath, '.thumbs');
      if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });
      const thumb = path.resolve(thumbDir, `${w}_${file}.webp`);
      if (!fs.existsSync(thumb)) {
        // Escribir a un temporal único y renombrar (evita servir un thumb a medio escribir)
        const tmp = path.resolve(thumbDir, `.tmp_${process.pid}_${Date.now()}_${w}_${file}.webp`);
        await _sharp(src).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 72 }).toFile(tmp);
        try { fs.renameSync(tmp, thumb); } catch { /* otro proceso ya lo creó */ }
      }
      return res.sendFile(thumb, opts, err => { if (err && !res.headersSent) res.status(404).end(); });
    } catch { /* si falla el resize, cae al original */ }
  }
  res.sendFile(src, opts, err => { if (err && !res.headersSent) res.status(404).end(); });
});

// ===== FASE 2: Plan de comidas imprimible (PDF de marca Lovic) =====
// HTML autocontenido con la identidad de Lovic, listo para "Imprimir → Guardar como PDF".
// Se abre en pestaña nueva, por eso el token va como ?t= (igual que las imágenes).
// Sin dependencias nuevas en el servidor: lo renderiza el navegador.
app.get('/meal-plan-print', async (req, res) => {
  let payload;
  try { payload = _jwt.verify(String(req.query.t || ''), process.env.JWT_SECRET); }
  catch { return res.status(403).send('Sesión no válida.'); }
  if (payload.role !== 'trainer') return res.status(403).send('Solo la entrenadora puede generar el PDF.');

  const clientId = String(req.query.c || '');
  if (!clientId) return res.status(400).send('Falta la clienta.');

  try {
    const [[u]] = await db.query(
      'SELECT name, fitness_goal, calorie_target, protein_target_g, carbs_target_g, fat_target_g, meal_plan_note FROM users WHERE id=? AND role="client"', [clientId]);
    if (!u) return res.status(404).send('Clienta no encontrada.');

    const [slots] = await db.query(
      `SELECT body_zone, meal_type, name, description, calories, protein_g, carbs_g, fat_g, sort_order
       FROM client_meal_slots WHERE client_id=? AND week_no=1
       ORDER BY FIELD(body_zone,'superior','inferior','descanso'),
                FIELD(meal_type,'desayuno','almuerzo','merienda','cena'), sort_order`, [clientId]);
    const [sups] = await db.query(
      'SELECT moment, item, dose FROM client_supplements WHERE client_id=? ORDER BY sort_order, id', [clientId]);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(renderMealPlanHTML(u, slots, sups));
  } catch (e) {
    console.error('[meal-plan-print]', e);
    res.status(500).send('No se pudo generar el plan.');
  }
});

const ZONE_LABEL = { superior: 'Tren superior', inferior: 'Tren inferior', descanso: 'Descanso' };
const ZONE_EMOJI = { superior: '💪', inferior: '🦵', descanso: '🌙' };
const MEAL_LABEL = { desayuno: 'Desayuno', almuerzo: 'Almuerzo', merienda: 'Merienda', cena: 'Cena' };
const MEAL_EMOJI = { desayuno: '🌅', almuerzo: '☀️', merienda: '🍎', cena: '🌙' };
const MEAL_ORDER = ['desayuno', 'almuerzo', 'merienda', 'cena'];

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderMealPlanHTML(u, slots, sups) {
  // Agrupar por zona → momento → opciones (carrusel = opciones del mismo momento)
  const byZone = {};
  for (const s of slots) {
    (byZone[s.body_zone] ||= {});
    (byZone[s.body_zone][s.meal_type] ||= []).push(s);
  }
  const zones = ['superior', 'inferior', 'descanso'].filter(z => byZone[z]);

  const zoneSections = zones.map(z => {
    const meals = MEAL_ORDER.filter(m => byZone[z][m]).map(m => {
      const opts = byZone[z][m];
      // Opciones separadas por un "o" claro; sin sopa de macros, solo kcal discretas.
      const macroStr = (s) => {
        const p = [];
        if (s.protein_g != null) p.push(`P ${Math.round(s.protein_g)}g`);
        if (s.carbs_g != null) p.push(`C ${Math.round(s.carbs_g)}g`);
        if (s.fat_g != null) p.push(`G ${Math.round(s.fat_g)}g`);
        return p.join(' · ');
      };
      const optHtml = opts.map((s, i) => `
        ${i > 0 ? '<div class="or"><span>o</span></div>' : ''}
        <div class="opt">
          <div class="opt-name">${escapeHtml(s.name)}${s.calories != null ? `<span class="kcal">${Math.round(s.calories)} kcal</span>` : ''}</div>
          ${s.description ? `<div class="opt-desc">${escapeHtml(s.description)}</div>` : ''}
          ${macroStr(s) ? `<div class="opt-macros">${macroStr(s)}</div>` : ''}
        </div>`).join('');
      return `
        <div class="meal">
          <div class="meal-head"><span class="meal-emoji">${MEAL_EMOJI[m] || ''}</span>${escapeHtml(MEAL_LABEL[m] || m)}</div>
          <div class="opts">${optHtml}</div>
        </div>`;
    }).join('');
    return `
      <section class="day">
        <div class="day-chip"><span>${ZONE_EMOJI[z] || ''}</span>${escapeHtml(ZONE_LABEL[z] || z)}</div>
        <div class="meals">${meals}</div>
      </section>`;
  }).join('');

  const supsHtml = sups && sups.length ? `
    <section class="day sups">
      <div class="day-chip alt"><span>💊</span>Suplementación e indicaciones</div>
      <div class="sup-grid">
        ${sups.map(s => `<div class="sup">
          ${s.moment ? `<span class="sup-moment">${escapeHtml(s.moment)}</span>` : ''}
          <span class="sup-item">${escapeHtml(s.item)}</span>
          ${s.dose ? `<span class="sup-dose">${escapeHtml(s.dose)}</span>` : ''}
        </div>`).join('')}
      </div>
    </section>` : '';

  // ===== "¿Por qué este plan?" — explicación FIEL a los datos reales del plan =====
  // Estima las kcal de cada tipo de día (una opción por comida = promedio de opciones)
  // y describe el patrón real, adaptado al objetivo. Nunca afirma algo que el plan no haga.
  const zoneKcal = {};
  for (const z of zones) {
    let total = 0, has = false;
    for (const m of MEAL_ORDER) {
      const opts = (byZone[z][m] || []).filter(s => s.calories != null);
      if (opts.length) { total += opts.reduce((a, s) => a + Number(s.calories), 0) / opts.length; has = true; }
    }
    if (has) zoneKcal[z] = Math.round(total);
  }

  // El número del hero sale de la comida REAL del plan (no de un campo guardado que
  // puede estar desactualizado). Así siempre cuadra con los platos que se muestran.
  const kcalVals = Object.values(zoneKcal);
  let targetLine = '';
  if (kcalVals.length) {
    const lo = Math.min(...kcalVals), hi = Math.max(...kcalVals);
    const txt = (hi - lo) > 120
      ? `~${lo}–${hi} kcal al día`   // varía por tipo de día
      : `~${Math.round(kcalVals.reduce((a, b) => a + b, 0) / kcalVals.length)} kcal al día`;
    targetLine = `<div class="hero-target">🍽️ Tu plan aporta ${txt}</div>`;
  }

  const Z = { superior: 'tren superior', inferior: 'tren inferior', descanso: 'descanso' };
  function planRationale() {
    const goal = u.fitness_goal;
    const bits = [];
    // 1) Intención según el objetivo
    if (goal === 'fat_loss')
      bits.push('Tu plan busca <strong>bajar grasa sin perder músculo</strong>: comes suficiente para rendir y recuperarte, con un balance pensado para que la grasa baje de forma sostenible.');
    else if (goal === 'muscle_gain')
      bits.push('Tu plan está pensado para <strong>ganar músculo</strong>: porciones abundantes y con buena proteína, para darle al cuerpo el material que necesita para crecer y recuperarse.');
    else
      bits.push('Tu plan busca <strong>mantener tu energía y tu composición</strong>, con comida equilibrada que puedas sostener en el día a día.');

    // 2) Patrón real por tipo de día (solo si hay números y diferencia notable)
    const present = Object.keys(zoneKcal);
    if (present.length >= 2) {
      const sorted = present.slice().sort((a, b) => zoneKcal[b] - zoneKcal[a]);
      const hi = sorted[0], lo = sorted[sorted.length - 1];
      const diff = zoneKcal[hi] - zoneKcal[lo];
      const rel = diff / zoneKcal[lo];
      if (rel > 0.05) {
        const legNote = hi === 'inferior' ? ' Las piernas son el músculo más grande: por eso en su día comes un poco más.' : '';
        bits.push(`Comes más en tus días de <strong>${Z[hi]}</strong> (~${zoneKcal[hi]} kcal) y menos en <strong>${Z[lo]}</strong> (~${zoneKcal[lo]} kcal), porque el cuerpo gasta y necesita reparar más cuando entrenas.${legNote}`);
      } else {
        bits.push('Mantienes calorías <strong>parejas todos los días</strong>, para darte una base estable y fácil de seguir.');
      }
    }

    // 3) Cómo usar las opciones
    bits.push('Cada comida trae <strong>opciones que suman parecido</strong>: elige la que más se te antoje o la que tengas a mano — todas cuidan tu objetivo por igual.');
    return bits;
  }
  const rationaleHtml = zones.length ? `
    <section class="day">
      <div class="day-chip alt"><span>💡</span>¿Por qué este plan?</div>
      <div class="why">${planRationale().map(t => `<p>${t}</p>`).join('')}</div>
    </section>` : '';

  const noteHtml = (u.meal_plan_note && u.meal_plan_note.trim()) ? `
    <section class="day">
      <div class="day-chip alt"><span>💌</span>Un mensaje de tu entrenadora</div>
      <div class="note">${escapeHtml(u.meal_plan_note.trim()).replace(/\n/g, '<br>')}</div>
    </section>` : '';

  const today = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

  const body = zones.length ? zoneSections + supsHtml + rationaleHtml + noteHtml
    : `<section class="day"><p class="empty">Aún no hay un plan de comidas configurado.</p></section>`;

  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plan Lovic · ${escapeHtml(u.name)}</title>
<style>
  :root{
    --coral:#FF6B6B; --coral2:#FF8E53; --ink:#2a2a33; --muted:#8a8a96;
    --line:#f0e6e0; --card:#fff; --soft:#fff1ec;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    color:var(--ink); background:#fbf8f6; line-height:1.4;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
  }
  .sheet{max-width:840px; margin:0 auto; padding:0 0 36px}
  .hero{
    background:linear-gradient(135deg,var(--coral) 0%,var(--coral2) 100%);
    color:#fff; padding:30px 40px 26px; border-radius:0 0 26px 26px; text-align:center;
  }
  .brand{font-weight:800; letter-spacing:.18em; font-size:12px; opacity:.92; text-transform:uppercase}
  .hero h1{margin:5px 0 2px; font-size:28px; font-weight:800; letter-spacing:-.02em}
  .hero-sub{opacity:.95; font-size:14px}
  .hero-target{
    margin-top:14px; display:inline-block; background:rgba(255,255,255,.2);
    border:1px solid rgba(255,255,255,.4); padding:7px 16px; border-radius:999px;
    font-size:14px; font-weight:700;
  }
  .hint{max-width:840px; margin:14px auto 0; padding:0 20px; text-align:center;
    color:var(--muted); font-size:12.5px}
  .toolbar{max-width:840px; margin:14px auto 0; padding:0 20px; text-align:center}
  .print-btn{
    background:var(--coral); color:#fff; border:none; padding:12px 24px; border-radius:999px;
    font-size:15px; font-weight:800; cursor:pointer; box-shadow:0 5px 16px rgba(255,107,107,.4);
  }
  .day{margin:22px 20px 0}
  .day-chip{display:inline-flex; align-items:center; gap:8px;
    background:var(--ink); color:#fff; font-weight:800; font-size:15px;
    padding:8px 16px; border-radius:999px; margin-bottom:14px}
  .day-chip.alt{background:linear-gradient(135deg,var(--coral),var(--coral2))}
  .day-chip span{font-size:17px}
  .meals{display:grid; grid-template-columns:1fr 1fr; gap:12px}
  .meal{background:var(--card); border:1px solid var(--line); border-radius:16px;
    overflow:hidden; box-shadow:0 2px 8px rgba(42,42,51,.04)}
  .meal-head{display:flex; align-items:center; gap:7px; background:var(--soft);
    color:var(--coral); font-weight:800; font-size:13px; letter-spacing:.04em;
    text-transform:uppercase; padding:10px 15px}
  .meal-emoji{font-size:15px}
  .opts{padding:6px 15px 13px}
  .opt{padding:8px 0 2px}
  .opt-name{font-weight:700; font-size:14.5px; display:flex; justify-content:space-between;
    align-items:baseline; gap:8px}
  .kcal{flex-shrink:0; font-size:11px; font-weight:700; color:var(--coral2);
    background:var(--soft); padding:2px 8px; border-radius:999px; font-variant-numeric:tabular-nums}
  .opt-desc{color:var(--muted); font-size:13px; margin-top:2px; line-height:1.35}
  .opt-macros{color:#a89a92; font-size:11px; margin-top:3px; letter-spacing:.02em;
    font-variant-numeric:tabular-nums}
  .or{display:flex; align-items:center; gap:8px; margin:9px 0 2px; color:var(--muted)}
  .or::before,.or::after{content:""; flex:1; height:1px; background:var(--line)}
  .or span{font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:var(--coral2)}
  .sup-grid{display:grid; grid-template-columns:1fr 1fr; gap:9px}
  .sup{display:flex; flex-wrap:wrap; align-items:baseline; gap:7px;
    background:var(--card); border:1px solid var(--line); border-radius:12px; padding:10px 13px}
  .sup-moment{font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.05em;
    color:#fff; background:var(--coral2); padding:2px 8px; border-radius:999px}
  .sup-item{font-weight:700; font-size:14px}
  .sup-dose{color:var(--muted); font-size:13px}
  .why{background:var(--card); border:1px solid var(--line); border-radius:16px;
    padding:6px 20px; box-shadow:0 2px 8px rgba(42,42,51,.04)}
  .why p{font-size:14px; line-height:1.55; margin:12px 0; color:#3a3a44}
  .why strong{color:var(--ink)}
  .note{background:var(--soft); border:1px solid var(--line); border-radius:16px;
    padding:16px 20px; font-size:14.5px; line-height:1.6; color:#3a3a44; font-style:italic}
  .empty{color:var(--muted); text-align:center; padding:20px}
  .foot{max-width:840px; margin:26px auto 0; padding:0 24px; color:var(--muted);
    font-size:12px; text-align:center}
  .foot strong{color:var(--coral)}
  @media print{
    .toolbar,.hint{display:none}
    body{background:#fff}
    .hero{border-radius:0}
    .day{break-inside:avoid}
    .meal{break-inside:avoid}
  }
  @media (max-width:560px){
    .meals,.sup-grid{grid-template-columns:1fr}
    .hero{padding:26px 22px 22px}
  }
</style>
</head><body>
  <div class="sheet">
    <div class="hero">
      <div class="brand">Lovic Athletica</div>
      <h1>Tu plan de comidas</h1>
      <div class="hero-sub">Para ${escapeHtml(u.name)} · ${escapeHtml(today)}</div>
      ${targetLine}
    </div>
    <div class="toolbar"><button class="print-btn" onclick="window.print()">⬇ Guardar como PDF</button></div>
    <div class="hint">Cada comida tiene opciones: elige <strong>una</strong>.</div>
    ${body}
    <div class="foot">Hecho con cariño por tu entrenadora · <strong>Lovic Athletica</strong></div>
  </div>
</body></html>`;
}

// Límite estricto contra fuerza bruta en autenticación:
// máx. 10 intentos de login/magic-link cada 15 min por IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  // MISMO fix que el limitador global: la IP real va en X-Real-IP (nginx), no en req.ip.
  // Sin esto, los 10 intentos se cuentan entre TODAS las personas juntas → login bloqueado para todos.
  keyGenerator: (req) => req.headers['x-real-ip'] || req.ip,
  validate: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
  skipSuccessfulRequests: true, // solo cuentan los intentos fallidos
});

// Routes
app.use('/auth/login',      authLimiter);
app.use('/auth/magic-link', authLimiter);
app.use('/auth/onboarding', authLimiter);   // evita creación masiva de cuentas por bots
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

// Health — verifica también que la base de datos responda, para que un monitor
// externo (UptimeRobot) detecte caídas reales, no solo que el proceso esté vivo.
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok', ts: new Date() });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'down', error: e.message });
  }
});

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

    // ── Aviso a Lorena 3 días antes, con datos para armar el próximo plan ──
    const in3 = new Date(today); in3.setDate(in3.getDate() + 3);
    const in3str = in3.toISOString().slice(0, 10);
    const [expiring3] = await db.query(
      `SELECT u.id, u.name, wp.start_date, wp.duration_days, wp.created_at
       FROM workout_plans wp JOIN users u ON u.id = wp.user_id
       WHERE wp.is_active = TRUE AND wp.start_date IS NOT NULL AND wp.duration_days IS NOT NULL
         AND DATE_ADD(wp.start_date, INTERVAL wp.duration_days DAY) = ?`, [in3str]);
    if (expiring3.length) {
      const { sendTrainerPlanExpiryDigest } = require('./services/email');
      const digest = [];
      for (const c of expiring3) {
        const since = (c.start_date ? new Date(c.start_date) : new Date(c.created_at)).toISOString().slice(0, 10);
        const endStr = new Date(new Date(c.start_date).getTime() + c.duration_days * 86400000).toLocaleDateString('es', { day: 'numeric', month: 'long' });
        const [[dt]] = await db.query(
          `SELECT COUNT(DISTINCT tracked_date) n FROM daily_tracking WHERE user_id=? AND workout_done=1 AND tracked_date >= ?`, [c.id, since]);
        const [extras] = await db.query(
          `SELECT name, COUNT(DISTINCT session_date) times FROM session_extra_exercises
           WHERE user_id=? AND session_date >= ? GROUP BY name ORDER BY times DESC LIMIT 15`, [c.id, since]);
        const [[cardio]] = await db.query(
          `SELECT COUNT(DISTINCT session_date) sessions, COALESCE(SUM(duration_mins),0) mins
           FROM workout_activity_logs WHERE user_id=? AND type IN ('cardio','cardio_inicio') AND session_date >= ?`, [c.id, since]);
        const cardioAvg = cardio.sessions ? Math.round(cardio.mins / cardio.sessions) : 0;
        const [[wS]] = await db.query(`SELECT weight_kg w FROM measurements WHERE user_id=? AND logged_at <= ? ORDER BY logged_at DESC LIMIT 1`, [c.id, since + ' 23:59:59']);
        const [[wN]] = await db.query(`SELECT weight_kg w FROM measurements WHERE user_id=? ORDER BY logged_at DESC LIMIT 1`, [c.id]);
        const weightDelta = (wS && wN) ? +(Number(wN.w) - Number(wS.w)).toFixed(1) : null;
        digest.push({
          name: c.name, endDate: endStr, daysTrained: dt.n || 0,
          extras: extras.map(e => ({ name: e.name, times: e.times })),
          cardioAvg, cardioSessions: cardio.sessions || 0, weightDelta,
        });
      }
      await sendTrainerPlanExpiryDigest(trainer.email, trainer.name, digest, 3).catch(e => console.error('[expiry-digest]', e.message));
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

// ── Reporte de estadísticas 2 semanas después de cargar una rutina ────────────
async function sendClientStatsJob() {
  try {
    const { sendClientStats } = require('./services/email');
    const [[trainer]] = await db.query(`SELECT * FROM users WHERE role='trainer' LIMIT 1`);
    if (!trainer) return;

    // Rutinas activas cargadas hace 14+ días a las que aún no se les envió el reporte
    const [plans] = await db.query(
      `SELECT wp.id, wp.name, wp.created_at, u.id AS user_id, u.name AS client_name
       FROM workout_plans wp JOIN users u ON u.id = wp.user_id
       WHERE wp.is_active = TRUE AND wp.stats_email_sent = 0
         AND wp.created_at <= DATE_SUB(NOW(), INTERVAL 14 DAY)`
    );

    for (const p of plans) {
      const uid = p.user_id;
      const sinceStr = new Date(p.created_at).toISOString().slice(0, 10);
      const [[trained]] = await db.query(
        `SELECT COUNT(*) AS n FROM daily_tracking WHERE user_id=? AND workout_done=1 AND tracked_date >= ?`, [uid, sinceStr]);
      const [[sets]] = await db.query(
        `SELECT COUNT(*) AS n FROM workout_logs WHERE user_id=? AND logged_date >= ?`, [uid, sinceStr]);
      const [[water]] = await db.query(
        `SELECT ROUND(AVG(NULLIF(water_glasses,0)),1) AS avg FROM daily_tracking WHERE user_id=? AND tracked_date >= ? AND water_glasses > 0`, [uid, sinceStr]);
      const [[cals]] = await db.query(
        `SELECT ROUND(AVG(day_total)) AS avg FROM (
           SELECT logged_at, SUM(calories) AS day_total FROM food_logs WHERE user_id=? AND logged_at >= ? GROUP BY logged_at
         ) t`, [uid, sinceStr]);
      const [wRows] = await db.query(
        `SELECT weight_kg FROM measurements WHERE user_id=? ORDER BY logged_at ASC`, [uid]);
      const [wStartRows] = await db.query(
        `SELECT weight_kg FROM measurements WHERE user_id=? AND logged_at <= ? ORDER BY logged_at DESC LIMIT 1`, [uid, sinceStr]);
      const weightNow = wRows.length ? Number(wRows[wRows.length - 1].weight_kg) : null;
      const weightStart = wStartRows.length ? Number(wStartRows[0].weight_kg) : (wRows.length ? Number(wRows[0].weight_kg) : null);
      const weightDelta = (weightNow != null && weightStart != null) ? +(weightNow - weightStart).toFixed(1) : null;

      await sendClientStats(trainer.email, trainer.name, p.client_name, uid, {
        planName: p.name,
        daysTrained: trained.n || 0,
        totalSets: sets.n || 0,
        avgWater: water.avg != null ? Number(water.avg) : null,
        avgCalories: cals.avg != null ? Number(cals.avg) : null,
        weightNow, weightDelta,
      }).catch(e => console.error('[client-stats send]', e.message));

      await db.query('UPDATE workout_plans SET stats_email_sent=1 WHERE id=?', [p.id]);
    }
    if (plans.length) console.log(`[client-stats] Enviados ${plans.length} reportes de 2 semanas`);
  } catch (e) { console.error('[client-stats] Error:', e.message); }
}

async function sendNutritionAlertsJob() {
  try {
    const { sendNutritionAlert } = require('./services/email');
    const [[trainer]] = await db.query(`SELECT * FROM users WHERE role='trainer' LIMIT 1`);
    if (!trainer) return;
    const today = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
    // Clientas que YA registraron antes pero llevan 4+ días sin hacerlo
    const [rows] = await db.query(
      `SELECT u.id, u.name, MAX(f.logged_at) AS last_log
       FROM users u JOIN food_logs f ON f.user_id = u.id
       WHERE u.role='client'
       GROUP BY u.id, u.name
       HAVING last_log < DATE_SUB(?, INTERVAL 4 DAY)`, [today]);
    const toAlert = [];
    for (const r of rows) {
      const [[a]] = await db.query('SELECT last_sent FROM nutrition_alert_sent WHERE client_id=?', [r.id]);
      if (a && (new Date(today) - new Date(a.last_sent)) < 3 * 86400000) continue; // ya avisado hace <3 días
      const lastStr = r.last_log instanceof Date ? r.last_log.toISOString().slice(0, 10) : String(r.last_log).slice(0, 10);
      toAlert.push({ id: r.id, name: r.name, daysSince: Math.floor((new Date(today) - new Date(lastStr)) / 86400000) });
    }
    if (!toAlert.length) return;
    await sendNutritionAlert(trainer.email, trainer.name, toAlert).catch(e => console.error('[nutrition-alert send]', e.message));
    for (const c of toAlert) {
      await db.query('INSERT INTO nutrition_alert_sent (client_id, last_sent) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_sent=VALUES(last_sent)', [c.id, today]);
    }
    console.log(`[nutrition-alert] Avisadas ${toAlert.length} clientas a la entrenadora`);
  } catch (e) { console.error('[nutrition-alert] Error:', e.message); }
}

(function scheduleRenewalReminders() {
  function msUntilTomorrow9am() {
    const now  = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + (now.getHours() >= 9 ? 1 : 0));
    next.setHours(9, 0, 0, 0);
    return next.getTime() - now.getTime();
  }
  async function runDaily() {
    await sendRenewalRemindersJob();
    await sendClientStatsJob();
    await sendNutritionAlertsJob();
  }
  function schedule() {
    setTimeout(async () => {
      await runDaily();
      setInterval(runDaily, 24 * 60 * 60 * 1000);
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
      const todayStr = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0,10);
      let streak = 0, restRun = 0, expected = new Date(todayStr).getTime();
      while (true) {
        const ds = new Date(expected).toISOString().slice(0,10);
        if (allDates.has(ds)) { streak++; restRun = 0; }
        else { restRun++; if (restRun > 3) break; }
        expected -= 86400000;
      }

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
  console.error(`[${req.method} ${req.path}]`, err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Imagen demasiado grande (máx 10MB)' });
  if (!res.headersSent) res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Lovic API corriendo en puerto ${PORT}`));

module.exports = app;
