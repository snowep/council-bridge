CREATE TABLE IF NOT EXISTS migration_ledger (
  migration_id    TEXT PRIMARY KEY,   -- "001", "002", etc.
  filename        TEXT NOT NULL,      -- "001_staff_agents_default_inactive.sql"
  checksum        TEXT NOT NULL,      -- SHA-256 of SQL file content
  checksum_algo   TEXT NOT NULL DEFAULT 'sha256',
  applied_at      TEXT NOT NULL DEFAULT (datetime('now')),  -- ISO 8601
  applied_by      TEXT NOT NULL DEFAULT 'system',      -- user/system that ran migration
  duration_ms     INTEGER,            -- execution time
  status          TEXT NOT NULL       -- 'success', 'failed', 'rolled_back'
    CHECK (status IN ('pending', 'success', 'failed', 'rolled_back')),
  backup_path     TEXT,               -- path to pre-migration backup
  notes           TEXT DEFAULT '{}'   -- JSON with additional metadata
);

CREATE INDEX IF NOT EXISTS idx_migration_ledger_applied_at ON migration_ledger(applied_at);
CREATE INDEX IF NOT EXISTS idx_migration_ledger_status ON migration_ledger(status);