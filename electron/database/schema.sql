-- ============================================================
-- OpenBell Database Schema (SQLite)
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------
-- sounds: uploaded bell audio files
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS sounds (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  file_path     TEXT    NOT NULL UNIQUE,
  duration_sec  REAL    DEFAULT 0,
  volume        INTEGER DEFAULT 80 CHECK (volume BETWEEN 0 AND 100),
  is_default    INTEGER DEFAULT 0 CHECK (is_default IN (0,1)),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------
-- schedules: bell ring times, one row per period/day combination
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedules (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT    NOT NULL,             -- e.g. "Period 1 Start"
  day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun..6=Sat
  ring_time     TEXT    NOT NULL,             -- HH:MM (24h)
  sound_id      INTEGER REFERENCES sounds(id) ON DELETE SET NULL,
  category      TEXT    DEFAULT 'class'  CHECK (category IN ('class','break','assembly','exam','custom')),
  is_active     INTEGER DEFAULT 1 CHECK (is_active IN (0,1)),
  repeat_weekly INTEGER DEFAULT 1 CHECK (repeat_weekly IN (0,1)),
  sort_order    INTEGER DEFAULT 0,
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_schedules_day_time ON schedules(day_of_week, ring_time);

-- ---------------------------------------------------------
-- holidays: dates on which schedules should not trigger
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS holidays (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  date        TEXT    NOT NULL,               -- YYYY-MM-DD
  end_date    TEXT,                            -- for multi-day holidays
  type        TEXT    DEFAULT 'school' CHECK (type IN ('school','public','exception')),
  description TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);

-- ---------------------------------------------------------
-- logs: system / bell activity log
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  level       TEXT    DEFAULT 'info' CHECK (level IN ('info','warn','error','debug')),
  category    TEXT    DEFAULT 'system' CHECK (category IN ('system','bell','schedule','backup','auth')),
  message     TEXT    NOT NULL,
  meta        TEXT,                            -- JSON string with extra context
  schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);

-- ---------------------------------------------------------
-- settings: single-row key/value app configuration
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------
-- backups: metadata about backup files created by the app
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS backups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path   TEXT    NOT NULL,
  size_bytes  INTEGER DEFAULT 0,
  type        TEXT    DEFAULT 'manual' CHECK (type IN ('manual','automatic')),
  status      TEXT    DEFAULT 'success' CHECK (status IN ('success','failed')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------
-- Default settings seed
-- ---------------------------------------------------------
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('theme', 'light'),
  ('language', 'en'),
  ('startup_with_os', 'false'),
  ('master_volume', '80'),
  ('auto_backup_enabled', 'true'),
  ('auto_backup_interval_days', '7'),
  ('school_name', 'My School'),
  ('time_format', '24h'),
  ('timezone', 'Asia/Colombo'),
  ('password_enabled', 'false'),
  ('password_hash', ''),
  ('password_salt', ''),
  ('recovery_code_hash', ''),
  ('db_version', '1.2.0');

-- ---------------------------------------------------------
-- v1.2.0 migration: clear all scheduled bells and sounds
-- Runs only once — guard is the db_version key.
-- ---------------------------------------------------------
-- Clear schedules and sounds when upgrading to v1.2.0
-- (The INSERT OR IGNORE above will have already set db_version='1.2.0'
--  on a brand-new database, so this DELETE is a no-op there.
--  On an existing pre-1.2.0 database the key won't exist yet, so the
--  rows were never cleared — the migration in main.ts handles that case
--  at runtime via the runMigrations() function.)

