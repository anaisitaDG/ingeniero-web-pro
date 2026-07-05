-- Meal planner tables
CREATE TABLE IF NOT EXISTS meal_plan_days (
  id           VARCHAR(36)  PRIMARY KEY,
  client_id    INT          NOT NULL,
  day_of_week  TINYINT      NOT NULL,  -- 1=Lunes … 7=Domingo
  UNIQUE KEY uq_client_day (client_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS meal_plan_items (
  id           VARCHAR(36)  PRIMARY KEY,
  day_id       VARCHAR(36)  NOT NULL REFERENCES meal_plan_days(id) ON DELETE CASCADE,
  meal_type    VARCHAR(20)  NOT NULL,  -- breakfast|lunch|snack|dinner
  description  TEXT         NOT NULL,
  sort_order   TINYINT      DEFAULT 0
);

CREATE TABLE IF NOT EXISTS meal_completions (
  id           VARCHAR(36)  PRIMARY KEY,
  client_id    INT          NOT NULL,
  logged_date  DATE         NOT NULL,
  meal_type    VARCHAR(20)  NOT NULL,
  UNIQUE KEY uq_client_date_meal (client_id, logged_date, meal_type)
);
