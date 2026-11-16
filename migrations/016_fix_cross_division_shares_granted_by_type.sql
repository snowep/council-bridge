-- Migration 016: Fix cross_division_shares granted_by_type CHECK constraint
-- Purpose: Allow 'division' for pending requests, 'founder' for approved
-- This resolves the contradiction where Division Heads create pending requests
-- but CHECK constraint only allowed 'founder'
-- Prerequisites: Migration 002, 005

PRAGMA foreign_keys = OFF;

BEGIN IMMEDIATE TRANSACTION;

-- 1. Create new table with corrected CHECK constraint
CREATE TABLE cross_division_shares_new (
  share_id        TEXT PRIMARY KEY,
  memory_id       TEXT NOT NULL,
  division_id     TEXT NOT NULL,
  granted_by_type TEXT NOT NULL
    CHECK (granted_by_type IN ('founder', 'division')),
  granted_by_id   TEXT NOT NULL,
  granted_at      TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at      TEXT,
  -- Migration 005: Cross-division request tracking
  request_type    TEXT
    CHECK (request_type IN ('task_delegate', 'deliverable_share', 'memory_access', 'resource_request')),
  status          TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  justification   TEXT,
  priority        TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  deadline        TEXT,
  approved_by_type TEXT,
  approved_by_id   TEXT,
  approved_at      TEXT,
  FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
  UNIQUE(memory_id, division_id)
);

-- 2. Copy existing data
INSERT INTO cross_division_shares_new (
  share_id, memory_id, division_id, granted_by_type, granted_by_id,
  granted_at, revoked_at, request_type, status,
  justification, priority, deadline,
  approved_by_type, approved_by_id, approved_at
)
SELECT
  share_id, memory_id, division_id, granted_by_type, granted_by_id,
  granted_at, revoked_at, request_type, status,
  justification, priority, deadline,
  approved_by_type, approved_by_id, approved_at
FROM cross_division_shares;

-- 3. Drop old table
DROP TABLE cross_division_shares;

-- 4. Rename new table
ALTER TABLE cross_division_shares_new RENAME TO cross_division_shares;

-- 5. Recreate indexes
CREATE INDEX idx_cross_division_shares_memory ON cross_division_shares(memory_id);
CREATE INDEX idx_cross_division_shares_division ON cross_division_shares(division_id);

COMMIT;

PRAGMA foreign_keys = ON;

-- Verification:
-- INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id, status)
--   VALUES ('test-div', 'mem-1', 'div-dev', 'division', 'staff-001', 'pending');  -- succeeds
-- INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id)
--   VALUES ('test-fdr', 'mem-1', 'div-dev', 'founder', 'founder');  -- succeeds
-- INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id)
--   VALUES ('test-bad', 'mem-1', 'div-dev', 'staff', 'staff-001');  -- fails CHECK constraint