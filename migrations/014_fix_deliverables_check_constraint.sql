-- Migration 014: Fix deliverables CHECK constraint to include 'draft' status
-- Purpose: The deliverables table CHECK constraint was missing 'draft' status
-- Prerequisites: Migrations 001-013 complete
-- Postconditions: deliverables.status CHECK constraint includes 'draft'
-- Type: Table rebuild (SQLite doesn't support ALTER TABLE to modify CHECK constraints)
-- Rollback: Use backup restore

PRAGMA foreign_keys = OFF;

BEGIN IMMEDIATE TRANSACTION;

-- Create new table with correct CHECK constraint
CREATE TABLE deliverables_new (
  deliverable_id    TEXT PRIMARY KEY,
  task_id           TEXT NOT NULL,
  submitted_by_type TEXT NOT NULL                      -- 'staff' | 'division'
    CHECK (submitted_by_type IN ('staff', 'division')),
  submitted_by_id   TEXT NOT NULL,
  content           TEXT NOT NULL,                     -- JSON payload
  status            TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted', 'accepted', 'rejected', 'revision_requested')),
  reviewed_by_type  TEXT,                              -- 'founder' | 'council' | 'division_head'
  reviewed_by_id    TEXT,
  reviewed_at       TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  version           INTEGER NOT NULL DEFAULT 1,
  quality_score     INTEGER CHECK (quality_score BETWEEN 0 AND 100),
  reviewer_type     TEXT CHECK (reviewer_type IN ('founder', 'council', 'division_head')),
  reviewer_id       TEXT,
  approved_at       TEXT,
  approved_by_type  TEXT CHECK (approved_by_type IN ('founder', 'council', 'division_head')),
  approved_by_id    TEXT,
  founder_signature TEXT,
  founder_signed_at TEXT,
  revision_notes    TEXT,
  file_references   TEXT DEFAULT '[]',
  task_relationships TEXT DEFAULT '[]',
  audit_log         TEXT DEFAULT '[]',
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  execution_id      TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);

-- Copy data from old table
INSERT INTO deliverables_new (
  deliverable_id, task_id, submitted_by_type, submitted_by_id, content, status,
  reviewed_by_type, reviewed_by_id, reviewed_at, created_at, version, quality_score,
  reviewer_type, reviewer_id, approved_at, approved_by_type, approved_by_id,
  founder_signature, founder_signed_at, revision_notes,
  file_references, task_relationships, audit_log, updated_at, execution_id
)
SELECT
  deliverable_id, task_id, submitted_by_type, submitted_by_id, content, status,
  reviewed_by_type, reviewed_by_id, reviewed_at, created_at, version, quality_score,
  reviewer_type, reviewer_id, approved_at, approved_by_type, approved_by_id,
  founder_signature, founder_signed_at, revision_notes,
  file_references, task_relationships, audit_log, updated_at, execution_id
FROM deliverables;

-- Drop old table and rename new
DROP TABLE deliverables;
ALTER TABLE deliverables_new RENAME TO deliverables;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_deliverables_task ON deliverables(task_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_status ON deliverables(status);

COMMIT;

PRAGMA foreign_keys = ON;

-- Verification:
-- PRAGMA table_info(deliverables);
-- Should show status CHECK constraint includes 'draft'
