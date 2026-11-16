# Phase 10 Batch 1: Migration Architecture Documentation

## Overview

This document describes the production-safe database migration management system implemented for Council Bridge. The system provides deterministic migration discovery, checksum-verified execution, persistent ledger tracking, automatic pre-migration backups, and comprehensive validation.

## Architecture Components

### 1. Migration Registry (`src/migration-runner/registry.ts`)

**Responsibilities:**
- Discovers migration files in `migrations/` directory matching pattern `NNN_*.sql`
- Parses migration metadata from SQL comments:
  - Type: `table_rebuild` or `alter_additive`
  - Dependencies: from `-- Prerequisites:` comment
  - Target tables: from `-- Tables affected:` or `-- Target tables:` comment
  - Description: from `-- Purpose:` or `-- Description:` comment
- Computes SHA-256 checksums for tamper detection
- Provides deterministic ordering (sequential by ID or dependency-based topological sort)
- Validates for duplicate version numbers and missing migrations

**Key Methods:**
- `load()` - Discovers and parses all migrations
- `getOrdered()` - Returns migrations in execution order
- `getById(id)` - Retrieves specific migration
- `verifyChecksums()` - Validates file checksums against ledger

### 2. Migration Ledger (`src/migration-runner/ledger.ts`)

**Schema:**
```sql
CREATE TABLE migration_ledger (
  migration_id    TEXT PRIMARY KEY,
  filename        TEXT NOT NULL,
  checksum        TEXT NOT NULL,
  checksum_algo   TEXT NOT NULL DEFAULT 'sha256',
  applied_at      TEXT NOT NULL DEFAULT (datetime('now')),
  applied_by      TEXT NOT NULL DEFAULT 'system',
  duration_ms     INTEGER,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'rolled_back')),
  backup_path     TEXT,
  notes           TEXT DEFAULT '{}'
);
```

**Responsibilities:**
- Persistent record of all migration attempts
- Stores migration ID, filename, checksum, timestamp, executor, duration, status
- Links to pre-migration backup file
- Prevents duplicate execution (idempotent by default)
- Detects checksum mismatches (tamper detection)
- Provides query methods for status, checksums, pending migrations

### 3. Migration Executor (`src/migration-runner/executor.ts`)

**Execution Flow:**
```
executeMigration(migrationId, options)
  1. Load migration from registry
  2. Check ledger - skip if already applied (unless force=true)
  3. Verify checksum against ledger
  4. Run pre-migration validation
  5. Create pre-migration backup (if enabled)
  6. Execute migration SQL (migration handles its own transactions)
  6. Run post-migration validation
  7. Record success/failure in ledger
  8. Return ExecutionResult
```

**Safety Features:**
- Transactions: Migration SQL contains its own BEGIN/COMMIT
- Idempotency: Checks ledger before execution
- Checksum verification: Prevents execution of modified files
- Backup creation: Automatic pre-migration backup with verification
- Validation: Pre and post-migration schema/integrity checks
- Stop-on-error: Halts batch on first failure (configurable)

### 4. Validator (`src/migration-runner/validator.ts`)

**Pre-Migration Checks:**
- Database accessibility
- Database not locked (BEGIN IMMEDIATE test)
- Foreign keys enabled (PRAGMA foreign_keys = ON)
- Migration file readable
- Pre-migration schema state (for table_rebuild migrations)

**Post-Migration Checks:**
- PRAGMA integrity_check = ok
- PRAGMA foreign_key_check = 0 violations
- Migration-specific schema changes verified
- Row counts preserved (for table_rebuild)
- Indexes recreated (for table_rebuild)
- FTS5 triggers functional

**Full Integrity Check:**
```typescript
async fullIntegrityCheck(): Promise<boolean> {
  const integrity = db.prepare('PRAGMA integrity_check').get();
  const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
  return integrity.integrity_check === 'ok' && fkCheck.length === 0;
}
```

### 5. Backup Manager (`src/migration-runner/backup.ts`)

**Backup Methods:**
1. **Binary** (`VACUUM INTO`): Creates standalone SQLite file with WAL checkpointed
2. **Schema Dump**: SQL CREATE statements only
3. **Full Dump**: Schema + INSERT statements for all data

**Verification:**
- Binary: PRAGMA integrity_check on backup file
- Dump: File size > 0

**WAL Handling:**
```typescript
private async createBinaryBackup(dbPath: string, backupPath: string): Promise<void> {
  const db = new Database(dbPath, { readonly: true });
  const escapedPath = backupPath.replace(/\\/g, '\\\\');
  db.exec("VACUUM INTO '" + escapedPath + "'");
  db.close();
}
```
VACUUM INTO automatically checkpoints WAL and creates a consistent standalone database file.

### 6. Rollback Engine (`src/migration-runner/executor.ts`)

**Methods:**
- `rollback(migrationId, method)`: Restore from backup or reapply (not implemented)
- `rollbackTo(targetMigrationId)`: Rollback all migrations after target
- `rollbackAll()`: Rollback all successful migrations (newest first)

**Restoration:**
- Binary backups: Uses better-sqlite3 `backup()` API
- SQL dumps: Executes SQL against target database

### 7. CLI (`src/migration-runner/cli.ts`)

**Commands:**
| Command | Description |
|---------|-------------|
| `status` | Show migration ledger state |
| `run [migrations...]` | Execute migrations |
| `rollback [n]` | Rollback last n migrations |
| `validate [migration...]` | Run validation checks |
| `backup` | Create backup |
| `restore <backupFile>` | Restore from backup |
| `verify-ledger` | Verify ledger checksums |
| `compute-checksums` | Report all migration checksums |

**Production Safeguards:**
- Requires `--confirm-production` flag when NODE_ENV=production
- Rejects in-memory databases in production
- Validates DATABASE_PATH pattern

## Migration 013 Specifics

**File:** `migrations/013_deliverable_workflow.sql`

**Changes:**
1. **deliverables table** - Added columns:
   - `version` (INTEGER DEFAULT 1)
   - `quality_score` (INTEGER CHECK 0-100)
   - `reviewer_type`, `reviewer_id`
   - `approved_at`, `approved_by_type`, `approved_by_id`
   - `founder_signature`, `founder_signed_at`
   - `revision_notes`

2. **deliverable_versions table** - New table for version history:
   - `version_id`, `deliverable_id`, `version_num`
   - `content`, `quality_score`, `status`
   - `submitted_by_type`, `submitted_by_id`
   - `revision_notes`, `created_at`
   - FK to deliverables, UNIQUE on (deliverable_id, version_num)
   - Index on deliverable_id

3. **quality_thresholds table** - New table for quality gates:
   - `threshold_id`, `division_id`, `task_type`
   - `min_quality_score` (DEFAULT 70, CHECK 0-100)
   - `requires_review` (DEFAULT 1)
   - FK to divisions, UNIQUE on (division_id, task_type)
   - Index on division_id

4. **Default threshold**: `INSERT OR IGNORE ... VALUES ('default-global', NULL, NULL, 70, 1)`

**Type:** `alter_additive` (safe, no data loss)

**Prerequisites:** Migrations 001-006 complete

## Production Protection

1. **Environment Detection**: `process.env.NODE_ENV === 'production'`
2. **Confirmation Required**: `--confirm-production` flag mandatory
3. **Database Validation**: 
   - Rejects `:memory:` in production
   - Warns on unexpected DB paths
4. **No Auto-Downgrade**: Rollback only via backup restore
5. **Ledger Integrity**: Checksum verification on every execution

## Migration Execution Instructions

### Development
```bash
# Show status
npx tsx src/migration-runner/cli.ts status

# Run all pending migrations (dry run first)
npx tsx src/migration-runner/cli.ts run --dry-run
npx tsx src/migration-runner/cli.ts run

# Run specific migration
npx tsx src/migration-runner/cli.ts run 013

# Validate
npx tsx src/migration-runner/cli.ts validate
```

### Production
```bash
# Requires explicit confirmation
NODE_ENV=production npx tsx src/migration-runner/cli.ts run --confirm-production

# With specific migrations
NODE_ENV=production npx tsx src/migration-runner/cli.ts run 013 --confirm-production
```

### Backup/Restore
```bash
# Create backup
npx tsx src/migration-runner/cli.ts backup --method binary

# Restore
npx tsx src/migration-runner/cli.ts restore council_pre_013_2026-11-14_20-22-59_abc123.db
```

## Known Limitations

1. **No automated down migrations**: Rollback requires backup restore
2. **SQLite ALTER TABLE limitations**: Cannot drop columns, only additive changes
3. **Sequential execution only**: No parallel migration support
4. **Single database**: No multi-database migration coordination
5. **Checksum only on file content**: Does not verify SQL semantics