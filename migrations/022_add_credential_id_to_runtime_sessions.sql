-- Phase 10 Workstream A-R1: credential_id Column for Session Continuity & Credential Binding
-- Added to runtime_sessions for tracking credential ownership
-- Migration: 022
-- Prerequisites: 021_runtime_sessions_history.sql

-- Note: As of Migration 017, credential_id is already part of runtime_sessions schema.
-- Migration 021 already has credential_id in runtime_session_history.
-- Migration 022 is a no-op migration for backward compatibility.

-- The credential_id column was added as part of Workstream A-R1 (Session Continuity & Credential Binding).
-- For backward compatibility with existing databases, the bootstrap checks if the column exists
-- before attempting to add it via ALTER TABLE in:
--   src/infrastructure/database/database.ts

-- This migration file exists as documentation and for audit trail purposes.
-- No SQL operations are needed because:
-- 1. New databases get credential_id from migration 017 (CREATE TABLE IF NOT EXISTS)
-- 2. Existing databases get credential_id from bootstrap ALTER TABLE (with existence check)

-- Intentional no-op - credential_id is already present
SELECT 1 WHERE 1 = 1;