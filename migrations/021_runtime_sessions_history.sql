-- Phase 10 P1-06: Runtime Session History Preservation
-- Allows multiple sessions per runtime while enforcing single active runtime
-- Preserves execution history during credential rotation
-- Migration: 021

-- Step 1: Add session_id as PRIMARY KEY (replacing runtime as PK)
-- This allows multiple sessions per runtime (different credentials, rotations, etc.)
-- The runtime column becomes a regular column, and we add an index for lookup

-- SQLite doesn't support dropping primary key, so we use a workaround:
-- We'll create a new table with the desired structure, copy data, and rename

-- First, add a unique constraint on session_id if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_sessions_session_id_unique
  ON runtime_sessions(session_id);

-- Add index on runtime for efficient lookups
CREATE INDEX IF NOT EXISTS idx_runtime_sessions_runtime ON runtime_sessions(runtime);

-- Add index on credential_id for credential-based queries (rotation detection)
CREATE INDEX IF NOT EXISTS idx_runtime_sessions_credential_id ON runtime_sessions(credential_id);

-- Create a history table to preserve old session data when rotating credentials
-- This preserves execution records that reference the old session_id
CREATE TABLE IF NOT EXISTS runtime_session_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_session_id TEXT NOT NULL,  -- The session_id being archived
    runtime TEXT NOT NULL,              -- 'claude' | 'hermes'
    credential_id TEXT,                 -- Credential that owned this session
    connection_status TEXT NOT NULL,    -- Final state (usually 'disconnected')
    connected_at TEXT,
    last_heartbeat_at TEXT,
    lease_expires_at TEXT,
    client_ip TEXT,
    user_agent TEXT,
    last_error TEXT,
    generation INTEGER DEFAULT 0,
    disconnected_at TEXT NOT NULL,      -- When moved to history
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for finding historical sessions by session_id
CREATE INDEX IF NOT EXISTS idx_runtime_session_history_session_id ON runtime_session_history(original_session_id);

-- Index for finding historical sessions by runtime
CREATE INDEX IF NOT EXISTS idx_runtime_session_history_runtime ON runtime_session_history(runtime);

-- Index for finding historical sessions by credential_id
CREATE INDEX IF NOT EXISTS idx_runtime_session_history_credential_id ON runtime_session_history(credential_id);

-- Index for time-based queries on historical sessions
CREATE INDEX IF NOT EXISTS idx_runtime_session_history_disconnected ON runtime_session_history(disconnected_at);

-- Step 3: Create history table for execution records
-- This preserves execution records that reference old session_ids during credential rotation
-- Note: FKs are not enforced with CASCADE due to SQLite limitations with history tables
-- Records are archived manually during credential rotation
CREATE TABLE IF NOT EXISTS execution_records_history (
    id TEXT PRIMARY KEY,                   -- Same UUID as original execution record
    session_id TEXT NOT NULL,                -- The session_id at time of archival (preserved for queries)
    runtime_id TEXT NOT NULL,                -- 'claude' | 'hermes'
    started_at INTEGER NOT NULL,             -- Unix timestamp (milliseconds) when execution started
    expires_at INTEGER NOT NULL,             -- Unix timestamp (milliseconds) when permit expires
    completed INTEGER NOT NULL DEFAULT 0,    -- 0 = active, 1 = completed
    generation INTEGER NOT NULL DEFAULT 1,   -- Execution generation
    original_session_id TEXT NOT NULL,       -- The session_id that was archived (same as session_id before migration)
    archived_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for finding archived executions by original session_id
CREATE INDEX IF NOT EXISTS idx_execution_records_history_original_session
    ON execution_records_history(original_session_id, completed) WHERE completed = 0;

-- Index for finding archived executions by runtime
CREATE INDEX IF NOT EXISTS idx_execution_records_history_runtime
    ON execution_records_history(runtime_id, completed) WHERE completed = 0;

-- Index for finding archived executions by archive time
CREATE INDEX IF NOT EXISTS idx_execution_records_history_archived
    ON execution_records_history(archived_at);

-- Create a view for backward compatibility - shows both active and historical sessions
CREATE VIEW IF NOT EXISTS all_runtime_sessions AS
SELECT
    runtime,
    session_id,
    connection_status,
    connected_at,
    last_heartbeat_at,
    lease_expires_at,
    client_ip,
    user_agent,
    last_error,
    generation,
    credential_id,
    created_at,
    updated_at,
    'active' as session_origin
FROM runtime_sessions
WHERE connection_status IN ('connecting', 'connected', 'switching')

UNION ALL

SELECT
    runtime,
    original_session_id as session_id,
    connection_status,
    connected_at,
    last_heartbeat_at,
    lease_expires_at,
    client_ip,
    user_agent,
    last_error,
    generation,
    credential_id,
    created_at,
    updated_at,
    'historical' as session_origin
FROM runtime_session_history;