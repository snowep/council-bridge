-- Phase 10 Loop 2: Runtime Control Table and Session Generation
-- Authoritative single-active-runtime enforcement with generation fencing
-- Migration: 020
-- Prerequisites: 019_create_runtime_credentials.sql

-- Step 1: Add generation column to existing runtime_sessions table
-- SQLite allows adding columns to existing tables
-- generation: Monotonically increasing counter for this session's lifecycle
-- Used for generation-based execution fencing to prevent stale session execution
ALTER TABLE runtime_sessions ADD COLUMN generation INTEGER DEFAULT 0;

-- Step 2: Create runtime_control table for authoritative runtime pointer
-- This table serves as the single source of truth for which runtime/session is active
CREATE TABLE IF NOT EXISTS runtime_control (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_runtime TEXT CHECK (active_runtime IN ('claude', 'hermes', NULL)),
  active_session_id TEXT,
  generation INTEGER NOT NULL DEFAULT 0,  -- Matches the active session's generation
  updated_at INTEGER NOT NULL             -- Unix milliseconds
);

-- Insert initial control row if not exists
-- This ensures the table always has a single authoritative row
INSERT OR IGNORE INTO runtime_control (id, active_runtime, active_session_id, generation, updated_at)
VALUES (1, NULL, NULL, 0, CAST(strftime('%s', 'now') || '000' AS INTEGER));

-- Step 3: Indexes for runtime_control
-- Unique index on id (enforced by primary key, but add explicit index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_control_single ON runtime_control(id);

-- Index for finding active runtime by runtime_id
CREATE INDEX IF NOT EXISTS idx_runtime_control_active_runtime ON runtime_control(active_runtime) WHERE active_runtime IS NOT NULL;

-- Index for session ownership verification
CREATE INDEX IF NOT EXISTS idx_runtime_control_active_session ON runtime_control(active_session_id);

-- Step 4: Ensure unique active runtime constraint is preserved
-- Keep the existing idx_single_active_runtime index on runtime_sessions
-- This enforces: only one row with connection_status = 'connected'

-- Migration note: Migration 019 added unique index on runtime_sessions.session_id
-- This migration adds:
-- 1. Generation column to runtime_sessions for Loop 3 execution fencing
-- 2. runtime_control table for Loop 2 atomic handoffs
-- 3. Session ID unique index for proper ownership queries