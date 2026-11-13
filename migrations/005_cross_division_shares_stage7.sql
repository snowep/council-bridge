-- Migration 005: cross_division_shares Stage 7 request-tracking columns
-- Purpose: Add request tracking columns for cross-division share workflow
-- These columns support the Stage 7 approval workflow with Founder as sole authorizer
-- Prerequisites: Migrations 001, 002 complete
-- Postconditions: New columns exist with proper defaults and constraints
-- Type: Safe ALTER TABLE (additive, no data loss)
-- Rollback: ALTER TABLE DROP COLUMN (not supported in SQLite < 3.35); use table rebuild if needed

PRAGMA foreign_keys = OFF;

BEGIN IMMEDIATE TRANSACTION;

-- Add request_type column
ALTER TABLE cross_division_shares ADD COLUMN request_type TEXT
  CHECK (request_type IN ('task_delegate', 'deliverable_share', 'memory_access', 'resource_request'));

-- Add status column
ALTER TABLE cross_division_shares ADD COLUMN status TEXT
  CHECK (status IN ('pending', 'approved', 'rejected'))
  DEFAULT 'pending';

-- Add justification column
ALTER TABLE cross_division_shares ADD COLUMN justification TEXT;

-- Add priority column
ALTER TABLE cross_division_shares ADD COLUMN priority TEXT
  CHECK (priority IN ('low', 'medium', 'high', 'critical'))
  DEFAULT 'medium';

-- Add deadline column
ALTER TABLE cross_division_shares ADD COLUMN deadline TEXT;

-- Add approval tracking columns
ALTER TABLE cross_division_shares ADD COLUMN approved_by_type TEXT;
ALTER TABLE cross_division_shares ADD COLUMN approved_by_id TEXT;
ALTER TABLE cross_division_shares ADD COLUMN approved_at TEXT;

COMMIT;

PRAGMA foreign_keys = ON;

-- Verification:
-- PRAGMA table_info(cross_division_shares);
-- Should show all new columns with proper CHECK constraints
-- Test: INSERT with status='pending', request_type='memory_access', etc.