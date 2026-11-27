-- Phase 10 Workstream A-R1: credential_id Column for Session Continuity & Credential Binding
-- Migration: 022
-- Prerequisites: 021_runtime_sessions_history.sql

-- Purpose: Add generation and credential_id columns to runtime_sessions for:
-- 1. Generation-based execution fencing (Loop 3)
-- 2. Credential ownership tracking and rotation detection (Workstream A-R1)

-- This migration is idempotent: if columns already exist, SQLite throws an error
-- which the migration executor catches and treats as successful (non-fatal).
-- This handles two scenarios:
-- 1. Fresh install where 017 already has columns (columns exist, duplicate column error caught)
-- 2. Legacy databases where 017 was applied but somehow missing columns (columns added)

-- Add generation column if missing (added for Loop 3 execution fencing)
ALTER TABLE runtime_sessions ADD COLUMN generation INTEGER DEFAULT 0;

-- Add credential_id column if missing (added for Workstream A-R1: session continuity)
ALTER TABLE runtime_sessions ADD COLUMN credential_id TEXT;

-- Also add these columns to runtime_session_history table for consistency during credential rotation
ALTER TABLE runtime_session_history ADD COLUMN generation INTEGER DEFAULT 0;
ALTER TABLE runtime_session_history ADD COLUMN credential_id TEXT;

-- Create indexes for credential-based queries (rotation detection)
CREATE INDEX IF NOT EXISTS idx_runtime_sessions_credential_id ON runtime_sessions(credential_id);
CREATE INDEX IF NOT EXISTS idx_runtime_session_history_credential_id ON runtime_session_history(credential_id);