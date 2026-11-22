-- Phase 10 Loop 1: Runtime Credential Storage Table
-- Enables independent Claude and Hermes runtime authentication
-- Prerequisites: 001-018

-- Create runtime credentials table
CREATE TABLE IF NOT EXISTS runtime_credentials (
    credential_id TEXT NOT NULL PRIMARY KEY,
    runtime_id TEXT NOT NULL CHECK (runtime_id IN ('claude', 'hermes')),
    token_hash TEXT NOT NULL UNIQUE,              -- SHA-256 hash of credential secret
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked', 'expired')),
    created_at INTEGER NOT NULL,                  -- Unix milliseconds
    expires_at INTEGER NOT NULL,                  -- Unix milliseconds
    last_used_at INTEGER,                         -- Unix milliseconds, NULL if never used
    revoked_at INTEGER                            -- Unix milliseconds, NULL if not revoked
);

-- Index for finding credentials by runtime (for provisioning checks)
CREATE INDEX IF NOT EXISTS idx_runtime_credentials_runtime
    ON runtime_credentials(runtime_id, status)
    WHERE status = 'active';

-- Index for finding by revocation/expiry date (for cleanup)
CREATE INDEX IF NOT EXISTS idx_runtime_credentials_expires
    ON runtime_credentials(expires_at);

-- Index for finding by revocation date
CREATE INDEX IF NOT EXISTS idx_runtime_credentials_revoked
    ON runtime_credentials(revoked_at)
    WHERE revoked_at IS NOT NULL;

-- NOTE: Migration 017 should have included a UNIQUE index on runtime_sessions.session_id
-- This is needed for proper session ownership verification
-- Adding it here to ensure it exists before runtime credential authentication
CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_sessions_session_id_unique
    ON runtime_sessions(session_id);

-- Phase 10 Loop 3: Generation column for execution_records is handled by database.ts
-- The schema in database.ts includes generation INTEGER NOT NULL DEFAULT 1
-- For existing databases, database.ts checks and adds the column via ALTER TABLE if missing

-- Add generation index for efficient querying
CREATE INDEX IF NOT EXISTS idx_execution_records_generation ON execution_records(generation);