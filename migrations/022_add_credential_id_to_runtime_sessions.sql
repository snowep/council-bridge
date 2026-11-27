-- Phase 10 Workstream A-R1: credential_id Column for Session Continuity & Credential Binding
-- Added to runtime_sessions for tracking credential ownership
-- Migration: 022
-- Prerequisites: 021_runtime_sessions_history.sql

-- Note: As of Migration 017, credential_id and generation columns
-- are now part of runtime_sessions schema for new databases.
--
-- For existing databases that applied an older version of migration 017 without these columns,
-- the application bootstrap (src/infrastructure/database/database.ts) adds them via:
--   ALTER TABLE runtime_sessions ADD COLUMN generation INTEGER DEFAULT 0
--   ALTER TABLE runtime_sessions ADD COLUMN credential_id TEXT
--
-- IMPORTANT: The migration runner does NOT invoke bootstrap code.
-- For proper schema upgrade of legacy databases, run migrations then start the application
-- to allow bootstrap to add any missing columns.
--
-- This migration file exists as documentation and for audit trail purposes.
-- No SQL operations are needed here because:
-- 1. New databases get credential_id and generation from migration 017 (CREATE TABLE IF NOT EXISTS)
-- 2. Existing databases get these columns from application bootstrap

-- Intentional no-op - column addition handled by application bootstrap when needed
SELECT 1 WHERE 1 = 1;