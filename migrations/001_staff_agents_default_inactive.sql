-- Migration 001: Change staff_agents status default from 'active' to 'inactive'
-- Purpose: New staff agents should default to inactive status for security
-- Prerequisites: Phase 4 schema with status DEFAULT 'active'
-- Postconditions: status column default changed to 'inactive'; existing data preserved
-- Type: Table rebuild (SQLite doesn't support ALTER COLUMN DEFAULT)
-- Rollback: Restore from backup or re-run Phase 4 CREATE TABLE

PRAGMA foreign_keys = OFF;

BEGIN IMMEDIATE TRANSACTION;

-- 1. Create new table with target schema (status default 'inactive')
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

-- 2. Copy existing data (preserving explicit status values)
INSERT INTO staff_agents_new (staff_id, name, role, division_id, runtime_instances, permissions, status, created_at, updated_at)
SELECT staff_id, name, role, division_id, runtime_instances, permissions, status, created_at, updated_at
FROM staff_agents;

-- 3. Drop old table
DROP TABLE staff_agents;

-- 4. Rename new table
ALTER TABLE staff_agents_new RENAME TO staff_agents;

-- 5. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_staff_agents_division ON staff_agents(division_id);
CREATE INDEX IF NOT EXISTS idx_staff_agents_status ON staff_agents(status);

COMMIT;

PRAGMA foreign_keys = ON;

-- Verification:
-- PRAGMA table_info(staff_agents);
-- Should show status column with DEFAULT 'inactive'
-- INSERT INTO staff_agents (staff_id, name, role, division_id) VALUES ('test-1', 'Test', 'role', 'div-1');
-- SELECT status FROM staff_agents WHERE staff_id = 'test-1'; -- should return 'inactive'