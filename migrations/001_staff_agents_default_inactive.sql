-- Migration 001: staff_agents status default → 'inactive'
-- Purpose: Change staff_agents.status default from 'active' to 'inactive'
-- This ensures new staff agents are non-operational until explicit Founder activation
-- Prerequisites: None (table empty in Phase 4)
-- Postconditions: New inserts default to 'inactive'; existing data preserved
-- Rollback: Restore from backup or re-run Phase 4 CREATE TABLE

-- SQLite does not support ALTER COLUMN DEFAULT directly
-- Use table rebuild strategy that preserves data and foreign keys

PRAGMA foreign_keys = OFF;

BEGIN IMMEDIATE TRANSACTION;

-- 1. Create new table with target schema
CREATE TABLE staff_agents_new (
  staff_id          TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  role              TEXT NOT NULL,
  division_id       TEXT NOT NULL,
  runtime_instances TEXT NOT NULL DEFAULT '[]',
  permissions       TEXT NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active', 'inactive', 'terminated')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
);

-- 2. Copy all existing data
INSERT INTO staff_agents_new (staff_id, name, role, division_id, runtime_instances, permissions, status, created_at, updated_at)
SELECT staff_id, name, role, division_id, runtime_instances, permissions, status, created_at, updated_at
FROM staff_agents;

-- 3. Drop old table
DROP TABLE staff_agents;

-- 4. Rename new table
ALTER TABLE staff_agents_new RENAME TO staff_agents;

-- 5. Recreate indexes
CREATE INDEX idx_staff_agents_division ON staff_agents(division_id);
CREATE INDEX idx_staff_agents_status ON staff_agents(status);

COMMIT;

PRAGMA foreign_keys = ON;

-- Verification:
-- SELECT * FROM staff_agents;  -- should show same row count
-- INSERT INTO staff_agents (staff_id, name, role, division_id) VALUES ('test', 'Test', 'role', 'div-dev');
-- SELECT status FROM staff_agents WHERE staff_id = 'test';  -- should be 'inactive'