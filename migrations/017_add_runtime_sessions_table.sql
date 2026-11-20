-- Phase 10: Runtime Session Persistence Table
-- Tracks active runtime connections for single-active-runtime enforcement
-- Migration: 017

CREATE TABLE IF NOT EXISTS runtime_sessions (
    runtime TEXT PRIMARY KEY,           -- 'claude' | 'hermes'
    session_id TEXT NOT NULL,           -- Unique session identifier
    connection_status TEXT NOT NULL,    -- 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'switching' | 'error'
    connected_at TEXT,                  -- ISO timestamp of initial connection
    last_heartbeat_at TEXT,             -- ISO timestamp of last heartbeat
    lease_expires_at TEXT,              -- ISO timestamp when session expires
    client_ip TEXT,                     -- Client IP address for ownership verification
    user_agent TEXT,                    -- Client user agent for debugging
    last_error TEXT,                    -- Last error message if any
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for finding active session (connected sessions)
CREATE INDEX IF NOT EXISTS idx_runtime_sessions_active
    ON runtime_sessions(connection_status)
    WHERE connection_status IN ('connecting', 'connected', 'switching');

-- Index for session ID lookup (for ownership verification)
CREATE INDEX IF NOT EXISTS idx_runtime_sessions_session_id
    ON runtime_sessions(session_id);

-- Index for lease expiration (for stale session recovery)
CREATE INDEX IF NOT EXISTS idx_runtime_sessions_lease
    ON runtime_sessions(lease_expires_at);