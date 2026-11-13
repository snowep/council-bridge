-- Migration 004: deliverables additive columns
-- Purpose: Add file_references, task_relationships, and audit_log columns to deliverables
-- These columns support deliverable versioning and audit trail
-- Prerequisites: Migrations 001, 002 complete
-- Postconditions: New columns exist with proper defaults; existing data preserved
-- Type: Safe ALTER TABLE (additive, no data loss)
-- Rollback: ALTER TABLE DROP COLUMN (not supported in SQLite < 3.35); use table rebuild if needed

PRAGMA foreign_keys = OFF;

BEGIN IMMEDIATE TRANSACTION;

-- Add file_references column (JSON array of file paths)
ALTER TABLE deliverables ADD COLUMN file_references TEXT DEFAULT '[]';

-- Add task_relationships column (JSON array of task_ids for cross-referencing)
ALTER TABLE deliverables ADD COLUMN task_relationships TEXT DEFAULT '[]';

-- Add audit_log column (JSON array of audit entries)
-- Each entry: {by_type, by_id, action, timestamp, before, after}
ALTER TABLE deliverables ADD COLUMN audit_log TEXT DEFAULT '[]';

COMMIT;

PRAGMA foreign_keys = ON;

-- Verification:
-- PRAGMA table_info(deliverables);
-- Should show file_references, task_relationships, audit_log columns