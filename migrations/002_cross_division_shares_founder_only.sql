-- Migration 002: cross_division_shares granted_by_type → 'founder' only
-- Purpose: Restrict cross_division_shares.granted_by_type to 'founder' only
-- This enforces Founder-only grant/revoke authority for cross-division access
-- Prerequisites: None (table empty in Phase 4)
-- Legacy handling: No existing data in Phase 4; if any exists, revoke with migration record
-- Postconditions: Only Founder-authorized grants possible; existing Founder grants preserved
-- Rollback: Restore from backup or re-run Phase 4 CREATE TABLE

-- SQLite does not support ALTER COLUMN CHECK constraint directly
-- Use table rebuild strategy that preserves data and foreign keys

PRAGMA foreign_keys = OFF;

BEGIN IMMEDIATE TRANSACTION;

-- 1. Create new table with target schema
CREATE TABLE cross_division_shares_new (
  share_id        TEXT PRIMARY KEY,
  memory_id       TEXT NOT NULL,
  division_id     TEXT NOT NULL,
  granted_by_type TEXT NOT NULL
    CHECK (granted_by_type IN ('founder')),
  granted_by_id   TEXT NOT NULL,
  granted_at      TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at      TEXT,
  FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
  UNIQUE(memory_id, division_id)
);

-- 2. Copy existing data with legacy handling
-- In Phase 4, table is empty. If data exists:
--   - Founder-authorized grants (granted_by_type='founder') → copy as-is
--   - Division-authorized grants (granted_by_type='division') → DO NOT copy (revoked)
--   - Log all legacy records to migration_audit table
INSERT INTO cross_division_shares_new (share_id, memory_id, division_id, granted_by_type, granted_by_id, granted_at, revoked_at)
SELECT share_id, memory_id, division_id, granted_by_type, granted_by_id, granted_at, revoked_at
FROM cross_division_shares
WHERE granted_by_type = 'founder';

-- 3. Create migration audit log for legacy records (if any)
CREATE TABLE IF NOT EXISTS migration_audit (
  audit_id          TEXT PRIMARY KEY,
  migration_id      TEXT NOT NULL,
  source_table      TEXT NOT NULL,
  source_pk         TEXT NOT NULL,
  action            TEXT NOT NULL,  -- 'preserved' | 'revoked' | 'quarantined'
  reason            TEXT NOT NULL,
  legacy_data       TEXT NOT NULL,  -- JSON of original row
  migrated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Log any division-authorized grants as revoked
INSERT INTO migration_audit (audit_id, migration_id, source_table, source_pk, action, reason, legacy_data)
SELECT
  'audit_' || share_id,
  '002_cross_division_shares_founder_only',
  'cross_division_shares',
  share_id,
  'revoked',
  'Division-authorized grant not permitted under Founder-only policy; requires explicit Founder reauthorization',
  json_object(
    'share_id', share_id,
    'memory_id', memory_id,
    'division_id', division_id,
    'granted_by_type', granted_by_type,
    'granted_by_id', granted_by_id,
    'granted_at', granted_at,
    'revoked_at', revoked_at
  )
FROM cross_division_shares
WHERE granted_by_type = 'division';

-- 4. Drop old table
DROP TABLE cross_division_shares;

-- 5. Rename new table
ALTER TABLE cross_division_shares_new RENAME TO cross_division_shares;

-- 6. Recreate indexes
CREATE INDEX idx_cross_division_shares_memory ON cross_division_shares(memory_id);
CREATE INDEX idx_cross_division_shares_division ON cross_division_shares(division_id);

COMMIT;

PRAGMA foreign_keys = ON;

-- Verification:
-- SELECT * FROM cross_division_shares;  -- should show only Founder grants
-- INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id)
--   VALUES ('test-share', 'mem-1', 'div-dev', 'founder', 'founder');  -- succeeds
-- INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id)
--   VALUES ('test-share-2', 'mem-1', 'div-dev', 'division', 'div-dev');  -- fails CHECK constraint
-- SELECT * FROM migration_audit WHERE migration_id = '002_cross_division_shares_founder_only';