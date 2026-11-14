-- Migration 013: Deliverable Workflow Enhancements
-- Purpose: Add versioning, quality thresholds, and HITL approval fields to deliverables
-- Prerequisites: Migrations 001-006 complete (Phase 7 autonomy + Phase 9 Batch 3 delegation)
-- Postconditions: New columns, deliverable_versions table, quality_thresholds table with default
-- Type: Safe ALTER TABLE (additive, no data loss) + new tables
-- Rollback: Use backup restore (SQLite doesn't support DROP COLUMN)

PRAGMA foreign_keys = OFF;

BEGIN IMMEDIATE TRANSACTION;

-- Add columns to deliverables table
ALTER TABLE deliverables ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE deliverables ADD COLUMN quality_score INTEGER CHECK (quality_score BETWEEN 0 AND 100);
ALTER TABLE deliverables ADD COLUMN reviewer_type TEXT CHECK (reviewer_type IN ('founder', 'council', 'division_head'));
ALTER TABLE deliverables ADD COLUMN reviewer_id TEXT;
ALTER TABLE deliverables ADD COLUMN approved_at TEXT;
ALTER TABLE deliverables ADD COLUMN approved_by_type TEXT CHECK (approved_by_type IN ('founder', 'council', 'division_head'));
ALTER TABLE deliverables ADD COLUMN approved_by_id TEXT;
ALTER TABLE deliverables ADD COLUMN founder_signature TEXT;
ALTER TABLE deliverables ADD COLUMN founder_signed_at TEXT;
ALTER TABLE deliverables ADD COLUMN revision_notes TEXT;

COMMIT;

-- Create deliverable_versions table for complete audit trail
CREATE TABLE IF NOT EXISTS deliverable_versions (
  version_id        TEXT PRIMARY KEY,
  deliverable_id    TEXT NOT NULL,
  version_num       INTEGER NOT NULL,
  content           TEXT NOT NULL,
  quality_score     INTEGER,
  status            TEXT NOT NULL,
  submitted_by_type TEXT NOT NULL,
  submitted_by_id   TEXT NOT NULL,
  revision_notes    TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(deliverable_id) ON DELETE CASCADE,
  UNIQUE(deliverable_id, version_num)
);

CREATE INDEX IF NOT EXISTS idx_deliverable_versions_deliverable ON deliverable_versions(deliverable_id);

-- Create quality_thresholds table for configurable quality gates
CREATE TABLE IF NOT EXISTS quality_thresholds (
  threshold_id      TEXT PRIMARY KEY,
  division_id       TEXT,
  task_type         TEXT,
  min_quality_score INTEGER NOT NULL DEFAULT 70 CHECK (min_quality_score BETWEEN 0 AND 100),
  requires_review   INTEGER NOT NULL DEFAULT 1 CHECK (requires_review IN (0, 1)),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
  UNIQUE(division_id, task_type)
);

CREATE INDEX IF NOT EXISTS idx_quality_thresholds_division ON quality_thresholds(division_id);

-- Insert global default threshold (70, review required)
INSERT OR IGNORE INTO quality_thresholds (threshold_id, division_id, task_type, min_quality_score, requires_review)
VALUES ('default-global', NULL, NULL, 70, 1);

PRAGMA foreign_keys = ON;

-- Verification:
-- PRAGMA table_info(deliverables);
-- Should show: version, quality_score, reviewer_type, reviewer_id, approved_at, approved_by_type, approved_by_id, founder_signature, founder_signed_at, revision_notes
-- SELECT * FROM deliverable_versions; (empty, structure exists)
-- SELECT * FROM quality_thresholds; (should have default-global row)