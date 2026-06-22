CREATE DATABASE IF NOT EXISTS lovic_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lovic_db;

CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  email         VARCHAR(255) NOT NULL UNIQUE,
  name          VARCHAR(255) NOT NULL,
  role          ENUM('client','trainer') NOT NULL DEFAULT 'client',
  calorie_target INT         DEFAULT 2000,
  fitness_goal  ENUM('fat_loss','maintenance','muscle_gain') DEFAULT 'maintenance',
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS magic_links (
  id         VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  user_id    VARCHAR(36)  NOT NULL,
  token      VARCHAR(255) NOT NULL UNIQUE,
  used       BOOLEAN      DEFAULT FALSE,
  expires_at TIMESTAMP    NOT NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS questionnaire_data (
  id                   VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id              VARCHAR(36) NOT NULL UNIQUE,
  -- Datos personales
  age                  INT,
  birth_date           DATE,
  height_cm            DECIMAL(5,2),
  weight_kg            DECIMAL(5,2),
  occupation           VARCHAR(255),
  city                 VARCHAR(255),
  phone                VARCHAR(50),
  -- Objetivo
  main_goal            JSON,
  goal_timeframe       VARCHAR(50),
  -- Entrenamiento
  trained_before       BOOLEAN,
  training_detail      TEXT,
  training_days_week   VARCHAR(20),
  -- Salud
  has_injury           BOOLEAN,
  injury_detail        TEXT,
  medical_conditions   JSON,
  medical_detail       TEXT,
  takes_medication     BOOLEAN,
  medication_detail    TEXT,
  energy_level         VARCHAR(20),
  -- Alimentación
  diet_quality         VARCHAR(20),
  meals_per_day        VARCHAR(10),
  drinks_water         BOOLEAN,
  has_allergies        BOOLEAN,
  allergy_detail       TEXT,
  eats_breakfast       BOOLEAN,
  first_meal_time      VARCHAR(20),
  last_meal_time       VARCHAR(20),
  willing_to_follow    BOOLEAN,
  -- Preferencias
  proteins             JSON,
  carbs                JSON,
  fats                 JSON,
  fruit_portions       VARCHAR(20),
  vegetable_portions   VARCHAR(20),
  fast_food_frequency  VARCHAR(50),
  sugary_drinks        VARCHAR(50),
  biggest_craving      JSON,
  foods_to_avoid       TEXT,
  -- Estilo de vida
  sleep_hours          VARCHAR(20),
  stress_level         VARCHAR(20),
  drinks_alcohol       BOOLEAN,
  alcohol_detail       TEXT,
  smokes               BOOLEAN,
  smoke_detail         TEXT,
  meal_preparer        VARCHAR(50),
  cooking_time         VARCHAR(50),
  -- Motivación
  motivation           TEXT,
  expectations         TEXT,
  obstacles            TEXT,
  commitment_level     INT,
  -- Medidas iniciales
  arm_cm               DECIMAL(5,2),
  chest_cm             DECIMAL(5,2),
  waist_cm             DECIMAL(5,2),
  hip_cm               DECIMAL(5,2),
  thigh_cm             DECIMAL(5,2),
  calf_cm              DECIMAL(5,2),
  forearm_cm           DECIMAL(5,2),
  -- Nutrición extra
  nutritional_notes    TEXT,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS measurements (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id     VARCHAR(36)   NOT NULL,
  weight_kg   DECIMAL(5,2),
  arm_cm      DECIMAL(5,2),
  chest_cm    DECIMAL(5,2),
  waist_cm    DECIMAL(5,2),
  hip_cm      DECIMAL(5,2),
  thigh_cm    DECIMAL(5,2),
  calf_cm     DECIMAL(5,2),
  forearm_cm  DECIMAL(5,2),
  notes       TEXT,
  logged_at   DATE          NOT NULL DEFAULT (CURDATE()),
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bioimpedance (
  id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id         VARCHAR(36)   NOT NULL,
  image_url       VARCHAR(500),
  weight_kg       DECIMAL(5,2),
  body_fat_pct    DECIMAL(5,2),
  muscle_mass_kg  DECIMAL(5,2),
  water_pct       DECIMAL(5,2),
  visceral_fat    INT,
  bone_mass_kg    DECIMAL(5,2),
  bmr_kcal        INT,
  raw_ocr_text    TEXT,
  notes           TEXT,
  logged_at       DATE          NOT NULL DEFAULT (CURDATE()),
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS food_logs (
  id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id         VARCHAR(36)   NOT NULL,
  input_text      TEXT          NOT NULL,
  parsed_items    JSON,
  calories        INT           NOT NULL DEFAULT 0,
  protein_g       DECIMAL(6,2)  DEFAULT 0,
  carbs_g         DECIMAL(6,2)  DEFAULT 0,
  fat_g           DECIMAL(6,2)  DEFAULT 0,
  meal_type       ENUM('breakfast','lunch','dinner','snack') DEFAULT 'snack',
  logged_at       DATE          NOT NULL DEFAULT (CURDATE()),
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Caché global de comidas parseadas por IA (reduce costos: reutiliza resultados)
CREATE TABLE IF NOT EXISTS food_cache (
  id             VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  input_key      VARCHAR(255) NOT NULL UNIQUE,
  parsed_items   JSON,
  total_calories INT          DEFAULT 0,
  protein_g      DECIMAL(6,2) DEFAULT 0,
  carbs_g        DECIMAL(6,2) DEFAULT 0,
  fat_g          DECIMAL(6,2) DEFAULT 0,
  meal_type      ENUM('breakfast','lunch','dinner','snack') DEFAULT 'snack',
  hit_count      INT          DEFAULT 1,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS routines (
  id          VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  user_id     VARCHAR(36)  NOT NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  plan        JSON         NOT NULL,
  start_date  DATE,
  end_date    DATE,
  is_active   BOOLEAN      DEFAULT TRUE,
  created_by  VARCHAR(36),
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS nutrition_plans (
  id          VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  user_id     VARCHAR(36)  NOT NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  plan        JSON         NOT NULL,
  daily_calories INT       DEFAULT 2000,
  start_date  DATE,
  end_date    DATE,
  is_active   BOOLEAN      DEFAULT TRUE,
  created_by  VARCHAR(36),
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS daily_tracking (
  id               VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id          VARCHAR(36) NOT NULL,
  tracked_date     DATE        NOT NULL DEFAULT (CURDATE()),
  workout_done     BOOLEAN     DEFAULT FALSE,
  diet_followed    BOOLEAN     DEFAULT FALSE,
  weight_kg        DECIMAL(5,2),
  mood             ENUM('great','good','okay','bad') DEFAULT 'good',
  notes            TEXT,
  created_at       TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_date (user_id, tracked_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Trainer por defecto
INSERT IGNORE INTO users (id, email, name, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'lorenaespitia.m@gmail.com', 'Lorena Espitia', 'trainer');
