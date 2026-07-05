-- Run this on the VPS MySQL: mysql -u root -p lovic_db < migrations/003_progress_registers.sql

CREATE TABLE IF NOT EXISTS progress_registers (
  id         VARCHAR(36) PRIMARY KEY,
  user_id    VARCHAR(36) NOT NULL,
  date       DATE        NOT NULL DEFAULT (CURDATE()),
  note       TEXT,
  created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add new columns to existing progress_photos if it already exists
ALTER TABLE progress_photos
  ADD COLUMN IF NOT EXISTS register_id VARCHAR(36) NULL AFTER user_id,
  ADD COLUMN IF NOT EXISTS angle ENUM('frente','espalda','perfil') DEFAULT 'frente' AFTER register_id;

-- If progress_photos doesn't exist yet, create it fresh
CREATE TABLE IF NOT EXISTS progress_photos (
  id          VARCHAR(36) PRIMARY KEY,
  user_id     VARCHAR(36) NOT NULL,
  register_id VARCHAR(36),
  angle       ENUM('frente','espalda','perfil') DEFAULT 'frente',
  image_url   VARCHAR(500) NOT NULL,
  note        TEXT,
  taken_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (register_id) REFERENCES progress_registers(id) ON DELETE CASCADE
);
