-- Migration 003: tasks additive columns
-- Purpose: Add dependencies and deliverable_id columns to tasks table
-- These columns support task dependency tracking and deliverable linking
-- Prerequisites: Migrations 001, 002 complete
-- Postconditions: New columns exist with proper defaults; existing data preserved
-- Type: Safe ALTER TABLE (additive, no data loss)
-- Rollback: ALTER TABLE DROP COLUMN (not supported in SQLite < 3.35); use table rebuild if needed

PRAGMA foreign_keys = OFF;

BEGIN IMMEDIATE TRANSACTION;

-- Add dependencies column (JSON array of task_ids)
ALTER TABLE tasks ADD COLUMN dependencies TEXT DEFAULT '[]';

-- Add deliverable_id column (FK to deliverables, nullable)
-- Note: SQLite FK validation at app layer to avoid circular FK issues
ALTER TABLE tasks ADD COLUMN deliverable_id TEXT;

COMMIT;

PRAGMA foreign_keys = ON;

-- Verification:
-- PRAGMA table_info(tasks);
-- Should show dependencies and deliverable_id columns