-- Phase 10: Execution Records Table for MCP Tool Execution Guard
-- Tracks active tool executions to prevent TOCTOU race conditions
-- Migration: 018
-- Prerequisites: 001-017

CREATE TABLE IF NOT EXISTS execution_records (
    id TEXT PRIMARY KEY,                   -- Unique execution identifier (UUID)
    session_id TEXT NOT NULL,              -- Session that owns this execution
    runtime_id TEXT NOT NULL,              -- 'claude' | 'hermes'
    started_at INTEGER NOT NULL,           -- Unix timestamp (milliseconds) when execution started
    expires_at INTEGER NOT NULL,           -- Unix timestamp (milliseconds) when permit expires
    completed INTEGER NOT NULL DEFAULT 0,  -- 0 = active, 1 = completed
    generation INTEGER NOT NULL DEFAULT 1, -- Added for Loop 3 execution fencing
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (runtime_id) REFERENCES runtime_sessions(runtime) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES runtime_sessions(session_id) ON DELETE CASCADE
);

-- Index for finding active executions by session (for switch prevention)
CREATE INDEX IF NOT EXISTS idx_execution_records_session
    ON execution_records(session_id, completed)
    WHERE completed = 0;

-- Index for finding expired permits (for cleanup)
CREATE INDEX IF NOT EXISTS idx_execution_records_expires
    ON execution_records(expires_at)
    WHERE completed = 0;

-- Index for runtime lookups during ownership verification
CREATE INDEX IF NOT EXISTS idx_execution_records_runtime
    ON execution_records(runtime_id, completed)
    WHERE completed = 0;

-- Unique constraint to prevent multiple concurrent executions per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_execution_per_session
    ON execution_records(session_id)
    WHERE completed = 0;