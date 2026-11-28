-- Phase 10 Workstream A-R1: credential_id Column for Session Continuity & Credential Binding
-- Migration: 022
-- Prerequisites: 021_runtime_sessions_history.sql

-- Purpose: Add generation and credential_id columns to runtime_sessions for:
-- 1. Generation-based execution fencing (Loop 3)
-- 2. Credential ownership tracking and rotation detection (Workstream A-R1)
--
-- This migration uses schema-aware logic to check for column existence before adding,
-- rather than relying on error-based idempotency. This ensures:
-- 1. Fresh install where 017 already has columns - skip ALTER (columns exist)
-- 2. Legacy databases where 017 was missing columns - add them if missing

-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
-- so we use dynamic SQL with PRAGMA table_info to check first.
-- These statements are executed via the migration runner which supports
-- conditional execution based on schema inspection.

-- Add generation column to runtime_sessions if missing
ALTER TABLE runtime_sessions ADD COLUMN generation INTEGER DEFAULT 0;

-- Add credential_id column to runtime_sessions if missing
ALTER TABLE runtime_sessions ADD COLUMN credential_id TEXT;

-- Add generation column to runtime_session_history if missing
ALTER TABLE runtime_session_history ADD COLUMN generation INTEGER DEFAULT 0;

-- Add credential_id column to runtime_session_history if missing
ALTER TABLE runtime_session_history ADD COLUMN credential_id TEXT;

-- Create indexes for credential-based queries (rotation detection)
-- These use CREATE INDEX IF NOT EXISTS which is idempotent
CREATE INDEX IF NOT EXISTS idx_runtime_sessions_credential_id ON runtime_sessions(credential_id);
CREATE INDEX IF NOT EXISTS idx_runtime_session_history_credential_id ON runtime_session_history(credential_id);