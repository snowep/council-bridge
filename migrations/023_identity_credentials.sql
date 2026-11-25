-- Phase 10 Loop 1 (Extended): Identity Credential Storage Table
-- Enables independent staff, division, and seat session authentication via credentials
-- Prerequisites: 001-022

-- Create identity_credentials table for staff, division, and seat provisioning
CREATE TABLE IF NOT EXISTS identity_credentials (
    credential_id TEXT NOT NULL PRIMARY KEY,
    identity_type TEXT NOT NULL CHECK (identity_type IN ('staff', 'division', 'seat')),
    identity_id TEXT NOT NULL,  -- staff_id, division_id, or seat_id
    token_hash TEXT NOT NULL UNIQUE,  -- SHA-256 hash of credential secret
    runtime_id TEXT NOT NULL CHECK (runtime_id IN ('claude', 'hermes')),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked', 'expired')),
    created_at INTEGER NOT NULL,      -- Unix milliseconds
    expires_at INTEGER NOT NULL,      -- Unix milliseconds
    last_used_at INTEGER,             -- Unix milliseconds, NULL if never used
    revoked_at INTEGER                -- Unix milliseconds, NULL if not revoked
);

-- Index for finding credentials by identity type and ID (authentication lookup)
CREATE INDEX IF NOT EXISTS idx_identity_credentials_identity
    ON identity_credentials(identity_type, identity_id);

-- Index for finding credentials by runtime (for provisioning checks)
CREATE INDEX IF NOT EXISTS idx_identity_credentials_runtime
    ON identity_credentials(runtime_id, status) WHERE status = 'active';

-- Index for finding by revocation/expiry date (for cleanup)
CREATE INDEX IF NOT EXISTS idx_identity_credentials_expires
    ON identity_credentials(expires_at);

-- Index for finding by revocation date
CREATE INDEX IF NOT EXISTS idx_identity_credentials_revoked
    ON identity_credentials(revoked_at) WHERE revoked_at IS NOT NULL;