-- Phase 10 Loop 2: Runtime Control Table and Session Generation
-- Authoritative single-active-runtime enforcement with generation fencing
-- Migration: 020
-- Prerequisites: 019_create_runtime_credentials.sql

-- Step 1: Create runtime_control table for authoritative runtime pointer
-- This table serves as the single source of truth for which runtime/session is active
-- Note: The application uses runtime_sessions directly (with idx_single_active_runtime partial unique index)
-- for single-active-runtime enforcement. runtime_control is created for future use but currently unused.
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

-- Step 2: Indexes for runtime_control
-- Unique index on id (enforced by primary key, but add explicit index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_control_single ON runtime_control(id);

-- Index for finding active runtime by runtime_id
CREATE INDEX IF NOT EXISTS idx_runtime_control_active_runtime ON runtime_control(active_runtime) WHERE active_runtime IS NOT NULL;

-- Index for session ownership verification
CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_control_active_session ON runtime_control(active_session_id);

-- Step 3: Ensure generation column exists in runtime_sessions (defensive check)
-- This column was added in migration 017. If running migration-only path and it's missing, add it.
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN, so this may fail if column exists.
-- The migration ledger prevents re-running, but this check documents the expected column.
PRAGMA table_info(runtime_sessions);

-- Step 4: Ensure unique active runtime constraint is preserved
-- Keep the existing idx_single_active_runtime index on runtime_sessions
-- This enforces: only one row with connection_status = 'connected'

-- Migration note:
-- Migration 017: Created runtime_sessions with generation column, credential_id column, unique session_id index
-- Migration 018: Created execution_records table with FK to runtime_sessions
-- Migration 019: Created runtime_credentials table
-- This migration (020) adds:
-- 1. runtime_control table (currently unused but defined for future use)
-- 2. generation column check (already present in 017)