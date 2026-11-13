# Phase 6 Migration Runner Specification

**Document Version**: 1.0 (Future Implementation Specification)
**Status**: DESIGN DOCUMENT — NOT IMPLEMENTED
**Reference**: `tests/phase6_migration_verification.test.ts` (proposed implementation patterns)

---

## 1. Purpose

This specification defines the requirements for a production migration runner tool that will execute Phase 6 database migrations with safety, auditability, and rollback capabilities. This is a **future implementation specification** — no production runner currently exists.

---

## 2. Architecture Overview

### 2.1 Design Principles

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Pre-flight     │────▶│  Execute        │────▶│  Post-flight      │
│  Validation     │     │  Migration      │     │  Verification     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Backup Created │     │  Ledger Entry   │     │  Integrity      │
│  & Verified     │     │  Written        │     │  Checks Passed  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 2.2 Core Components

| Component | Responsibility |
|-----------|--------------|
| `MigrationRegistry` | Reads manifest, orders migrations, tracks state |
| `MigrationExecutor` | Executes SQL files, handles transactions |
| `MigrationLedger` | Records checksums, timestamps, status |
| `BackupManager` | Creates/restores backups with integrity checks |
| `Validator` | Pre/post migration verification, FK integrity |
| `RollbackEngine` | Executes rollback procedures per migration |

---

## 3. Specification Details

### 3.1 Configuration

**File**: `.migrationrc` or `migrations/config.json`

```json
{
  "database": {
    "path": "data/council.db",
    "type": "sqlite3",
    "journal_mode": "WAL",
    "foreign_keys": true
  },
  "backup": {
    "directory": "data/backups",
    "retention_days": 30,
    "method": "binary|schema_dump|full_dump"
  },
  "ledger": {
    "table": "migration_ledger",
    "schema_path": "migrations/ledger_schema.sql"
  },
  "migrations": {
    "directory": "migrations",
    "pattern": "*/.sql$",
    "order": "sequential"
  },
  "verification": {
    "post_migration_tests": "tests/phase6_migration_verification.test.ts",
    "integrity_check": true,
    "foreign_key_check": true
  },
  "authorization": {
    "require_founder_signature": true,
    "signature_file": "PHASE6_FOUNDER_AUTHORIZATION_PACKAGE.md"
  }
}
```

### 3.2 Migration Registry

**Interface**: `MigrationRegistry`

```typescript
interface Migration {
  id: string;              // "001", "002", etc.
  filename: string;        // "001_staff_agents_default_inactive.sql"
  filepath: string;        // absolute path
  type: 'table_rebuild' | 'alter_additive';
  dependencies: string[];  // array of migration IDs
  targetTables: string[];  // tables affected
  description: string;
  checksum: string;        // SHA-256 computed from file
}
```

**Responsibilities:**
1. Scan migration directory for `.sql` files
2. Parse migration ID from filename prefix
3. Load migration metadata from file comments or separate manifest
4. Compute and store SHA-256 checksum
5. Determine execution order based on dependencies or numeric prefix
6. Check ledger to skip already-applied migrations

### 3.3 Migration Executor

**Interface**: `MigrationExecutor`

```typescript
interface MigrationExecutionContext {
  db: Database;                    // SQLite connection
  migration: Migration;
  backupPath: string;              // Path to pre-migration backup
  logger: Logger;                  // Structured logging
  options: {
    dryRun: boolean;               // Validate without executing
    force: boolean;                // Override checks (dangerous)
    transaction: boolean;          // Use explicit transaction
    timeout: number;               // Execution timeout (ms)
  };
}

async function executeMigration(ctx: MigrationExecutionContext): Promise<ExecutionResult>
```

**Execution Flow:**

1. **Pre-flight Validation**
   - Verify migration file exists and is readable
   - Verify checksum matches what's in ledger (if already applied)
   - Verify database is not in WAL-only mode
   - Verify foreign_keys pragma setting

2. **Backup Creation**
   - Create timestamped binary backup
   - Verify backup integrity with `PRAGMA integrity_check`
   - Store backup path in execution context

3. **SQL Execution**
   ```sql
   -- Migration files contain their own pragmas:
   PRAGMA foreign_keys = OFF;
   BEGIN IMMEDIATE TRANSACTION;
   -- ... migration statements ...
   COMMIT;
   PRAGMA foreign_keys = ON;
   ```
   - Execute file content via `db.exec()`
   - Capture any errors for rollback

4. **Post-execution Verification**
   - Run `PRAGMA foreign_key_check`
   - Run `PRAGMA integrity_check`
   - Verify table structure changes
   - Verify row counts preserved (for table rebuilds)

### 3.4 Migration Ledger

**Table Schema**: `migrations/ledger_schema.sql`

```sql
CREATE TABLE IF NOT EXISTS migration_ledger (
  migration_id    TEXT PRIMARY KEY,   -- "001", "002", etc.
  filename        TEXT NOT NULL,      -- "001_staff_agents_default_inactive.sql"
  checksum        TEXT NOT NULL,      -- SHA-256 of SQL file content
  checksum_algo   TEXT NOT NULL DEFAULT 'sha256',
  applied_at      TEXT NOT NULL DEFAULT (datetime('now')),  -- ISO 8601
  applied_by      TEXT NOT NULL,      -- user/system that ran migration
  duration_ms     INTEGER,            -- execution time
  status          TEXT NOT NULL      -- 'success', 'failed', 'rolled_back'
    CHECK (status IN ('pending', 'success', 'failed', 'rolled_back')),
  backup_path     TEXT,               -- path to pre-migration backup
  notes           TEXT                -- JSON with additional metadata
);

CREATE INDEX idx_migration_ledger_applied_at ON migration_ledger(applied_at);
CREATE INDEX idx_migration_ledger_status ON migration_ledger(status);
```

**Ledger Operations:**

```typescript
interface LedgerEntry {
  migration_id: string;
  filename: string;
  checksum: string;
  applied_at: string;
  applied_by: string;
  duration_ms: number;
  status: 'pending' | 'success' | 'failed' | 'rolled_back';
  backup_path: string;
  notes: Record<string, unknown>;
}

// Record successful migration
async function recordSuccess(
  migration: Migration,
  durationMs: number,
  backupPath: string,
  appliedBy: string
): Promise<void>

// Record failed migration
async function recordFailure(
  migration: Migration,
  error: Error,
  durationMs: number,
  backupPath: string,
  appliedBy: string
): Promise<void>

// Check if migration already applied
async function isApplied(migrationId: string): Promise<boolean>

// Get recorded checksum
async function getChecksum(migrationId: string): Promise<string | null>
```

### 3.5 Backup Manager

**Interface**: `BackupManager`

```typescript
interface BackupOptions {
  method: 'binary' | 'schema_dump' | 'full_dump';
  compress: boolean;
  retentionDays: number;
  verify: boolean;
}

async function createBackup(dbPath: string, options: BackupOptions): Promise<BackupResult>

interface BackupResult {
  backupPath: string;
  method: string;
  timestamp: string;
  verified: boolean;
  sizeBytes: number;
  integrityCheck: boolean;
}
```

**Backup Methods:**

| Method | Command | Use Case |
|--------|---------|----------|
| binary | `sqlite3 db ".backup backup.db"` | Fastest, most reliable |
| schema_dump | `sqlite3 db ".schema" > schema.sql` | Schema inspection |
| full_dump | `sqlite3 db ".dump" > dump.sql` | Full reconstruction |

### 3.6 Validator

**Interface**: `Validator`

```typescript
interface ValidationResult {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message?: string;
    details?: unknown;
  }>;
}

async function preMigrationValidation(db: Database, migration: Migration): Promise<ValidationResult>
async function postMigrationValidation(db: Database, migration: Migration): Promise<ValidationResult>
async function fullIntegrityCheck(db: Database): Promise<boolean>
```

**Pre-Migration Checks:**
- Database file exists and is readable
- Database is not locked
- Foreign keys are enabled (`PRAGMA foreign_keys = ON`)
- Migration file is readable and checksum matches ledger

**Post-Migration Checks:**
- `PRAGMA integrity_check` → 'ok'
- `PRAGMA foreign_key_check` → empty result
- Table schema matches expected state
- Row counts preserved (for table rebuilds)
- Indexes exist and are valid

### 3.7 Rollback Engine

**Interface**: `RollbackEngine`

```typescript
interface RollbackOptions {
  migrationId: string;
  method: 'backup' | 'reapply';
  force: boolean;  // Skip safety checks
}

async function rollback(migration: Migration, options: RollbackOptions): Promise<boolean>

async function rollbackTo(migrationId: string): Promise<boolean>  // Rollback all after ID

async function rollbackAll(): Promise<boolean>  // Full rollback to clean state
```

**Rollback Strategies by Migration Type:**

| Migration | Strategy | Details |
|-----------|----------|---------|
| 001 | backup_restore | Restore from pre-001 backup |
| 001 | reapply | Re-run Phase 4 staff_agents creation |
| 002 | backup_restore | Restore from pre-002 backup |
| 002 | reapply | Re-run Phase 4 cross_division_shares creation |
| 003-005 | backup_restore | Restore from per-migration backup |
| any | sequential | Rollback newest to oldest |

---

## 4. CLI Interface Specification

### 4.1 Command Structure

```bash
migration-runner <command> [options]

Commands:
  run [migration...]    Execute migrations (default: all)
  status                Show migration ledger state
  validate              Run validation checks
  backup                Create backup
  restore <backup>      Restore from backup
  rollback [n]            Rollback last n migrations
  check-authorization   Verify founder authorization
  compute-checksums     Compute and report checksums
  help                  Show help
```

### 4.2 Command Details

#### `migration-runner status`

```bash
> migration-runner status

Migration Status:
┌─────────┬─────────────────────┬───────────┬────────────┬──────────────┐
│ ID      │ File                │ Status    │ Applied At │ Checksum     │
├─────────┼─────────────────────┼───────────┼────────────┼──────────────┤
│ 001     │ 001_...sql          │ pending   │ -          │ a1b2c3...    │
│ 002     │ 002_...sql          │ pending   │ -          │ d4e5f6...    │
│ 003     │ 003_...sql          │ pending   │ -          │ g7h8i9...    │
│ 004     │ 004_...sql          │ pending   │ -          │ j0k1l2...    │
│ 005     │ 005_...sql          │ pending   │ -          │ m3n4o5...    │
└─────────┴─────────────────────┴───────────┴────────────┴──────────────┘

Total: 5 pending, 0 applied, 0 failed
```

#### `migration-runner run`

```bash
# Dry run (validate only)
> migration-runner run --dry-run

# Execute specific migrations
> migration-runner run 001 002

# Execute with backup
> migration-runner run --create-backup

# Force execution (override safety)
> migration-runner run --force
```

#### `migration-runner rollback`

```bash
# Rollback last migration
> migration-runner rollback 1

# Rollback to before migration 003
> migration-runner rollback-to 002

# Full rollback
> migration-runner rollback --all
```

---

## 5. Safety Mechanisms

### 5.1 Authorization Gate

**Before ANY migration execution:**

```typescript
async function verifyAuthorization(): Promise<boolean> {
  // 1. Check for explicit signer in authorization package
  // 2. Verify signer is authorized Founder
  // 3. Verify signature is current (not expired)
  // 4. Verify document matches expected hash

  const authDoc = fs.readFileSync('PHASE6_FOUNDER_AUTHORIZATION_PACKAGE.md', 'utf-8');
  const expectedHash = getExpectedAuthorizationHash(); // from secure config
  return crypto.createHash('sha256').update(authDoc).digest('hex') === expectedHash;
}
```

### 5.2 Safety Prompts

```typescript
// Confirmation prompts for destructive operations
await promptConfirm("This will modify your production database. Continue? (yes/no): ");

// Summary before execution
console.log(`
Migration: 001_staff_agents_default_inactive.sql
Type: Table Rebuild
Tables: staff_agents
Changes: DEFAULT 'active' → 'inactive'
Backup: data/backups/council_pre_001_20261113_143022.db
`);
await promptConfirm("Proceed with migration? (yes/no): ");
```

### 5.3 Atomic Execution

Each migration MUST be executed within a single transaction with atomic ledger recording:

```sql
BEGIN IMMEDIATE TRANSACTION;
  -- Execute migration SQL
  -- Record to migration_ledger
COMMIT;
```

If ANY step fails, the entire transaction rolls back.

### 5.4 Checksum Verification

Before executing any migration, verify file integrity:

```typescript
const currentChecksum = crypto.createHash('sha256')
  .update(fs.readFileSync(migrationFilepath, 'utf-8'))
  .digest('hex');

const recordedChecksum = await ledger.getChecksum(migrationId);

if (recordedChecksum && currentChecksum !== recordedChecksum) {
  throw new Error(`Migration file checksum mismatch! File may have been tampered.`);
}
```

---

## 6. Error Handling

### 6.1 Error Types and Responses

| Error Type | Response |
|------------|----------|
| Authorization missing/failed | Abort immediately, log alert |
| Checksum mismatch | Abort, log security alert |
| Database locked | Retry with backoff, then abort |
| Migration SQL syntax error | Abort, rollback, log |
| Foreign key constraint violation | Abort, verify data integrity, investigate |
| Backup creation failed | Abort (no backup = cannot proceed) |
| Integrity check failed | Do NOT commit, rollback, alert |

### 6.2 Error Output Format

```json
{
  "timestamp": "2026-11-13T14:30:22.123Z",
  "level": "error",
  "migration_id": "001",
  "error": {
    "type": "IntegrityCheckFailed",
    "message": "PRAGMA integrity_check returned 'corruption detected'",
    "stack": "Error: ...",
    "context": {
      "table": "staff_agents",
      "affected_count": 0
    }
  },
  "action": "rolled_back",
  "backup_restored_from": "data/backups/council_pre_001_20261113_1430.db"
}
```

---

## 7. Logging Specification

### 7.1 Log Format

All operations logged to `logs/migration-runner.log` in JSON format:

```json
{"timestamp":"2026-11-13T14:30:00Z","level":"info","message":"Migration 001 started","migration_id":"001","operator":"root"}
{"timestamp":"2026-11-13T14:30:01Z","level":"info","message":"Backup created","backup_path":"data/backups/council_pre_001_20261113_143000.db","size_bytes":40960}
{"timestamp":"2026-11-13T14:30:05Z","level":"info","message":"Migration 001 completed","duration_ms":5000,"status":"success"}
```

### 7.2 Log Levels

| Level | When to Use |
|-------|-------------|
| debug | Detailed SQL execution traces |
| info | Standard operations (start, finish, backup) |
| warn | Non-critical issues (slow query, retry) |
| error | Migration failure, rollback required |
| fatal | Unrecoverable error, cannot continue |

---

## 8. Implementation Language and Dependencies

### 8.1 Recommended Stack

- **Language**: TypeScript (Node.js) — matches existing test suite
- **Database Driver**: `better-sqlite3` — used by verification tests
- **CLI Framework**: `commander` or `zod` for argument parsing
- **Checksum**: Node.js `crypto` module (sha256)
- **Logging**: `winston` or `pino`

### 8.2 Package Dependencies

```json
{
  "dependencies": {
    "better-sqlite3": "^9.0.0",
    "commander": "^12.0.0",
    "winston": "^3.11.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.5.0"
  }
}
```

---

## 9. Implementation Tasks

### Phase 1: Core Runner (MVP)

1. [ ] `src/ledger.ts` — Migration ledger table management
2. [ ] `src/backup.ts` — Backup creation and restoration
3. [ ] `src/registry.ts` — Migration discovery and ordering
4. [ ] `src/validator.ts` — Pre/post migration validation
5. [ ] `src/executor.ts` — Migration execution with transactions
6. [ ] `src/cli.ts` — CLI interface (run, status, rollback)
7. [ ] `tests/runner.test.ts` — Integration tests using in-memory DB

### Phase 2: Safety Enhancements

1. [ ] Authorization verification (signature checking)
2. [ ] Safety prompts and confirmations
3. [ ] Checkpoint/restart capability
4. [ ] Parallel execution support (for independent migrations 003, 004, 005)

### Phase 3: Production Hardening

1. [ ] Retry logic with exponential backoff
2. [ ] Timeout handling for stuck migrations
3. [ ] Metrics export (Prometheus/StatsD)
4. [ ] Alerting integration (Slack, email)
5. [ ] Dry-run mode with simulation

---

## 10. Testing Requirements

### 10.1 Unit Tests

Each component must have unit tests:

| Component | Test Requirements |
|-----------|-------------------|
| Registry | Parse all 5 migration files, compute checksums |
| Executor | Execute migrations against in-memory DB |
| Ledger | Record, query, update migration status |
| Backup | Create, verify, restore backups |
| Validator | Detect schema changes, FK violations |

### 10.2 Integration Tests

Reuse patterns from `tests/phase6_migration_verification.test.ts`:

```
tests/runner/
  ├── 001-execution.test.ts      # Execute 001 on fresh DB
  ├── 002-execution.test.ts      # Execute 002, verify founder-only
  ├── 003-005-execution.test.ts  # Execute additive migrations
  ├── integration.test.ts        # Full sequence execution
  ├── rollback.test.ts           # Rollback procedures
  ├── backup.test.ts             # Backup/restore verification
  └── ledger.test.ts             # Checksum and state tracking
```

### 10.3 Acceptance Tests

- All 5 migrations execute in order
- All 16 verification tests pass post-execution
- Rollback to any migration point works
- Backup integrity verified
- Authorization required and enforced

---

## 11. Deployment Considerations

### 11.1 CI/CD Integration

```yaml
# .github/workflows/migration.yml
name: Migration Runner
on:
  push:
    branches: [main]
    paths: ['migrations/**', 'src/runner/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
      - run: npx tsx --test tests/runner/

  release:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build CLI
        run: npm run build
      - name: Upload binary
        uses: actions/upload-artifact@v4
        with:
          name: migration-runner
          path: dist/cli
```

### 11.2 Production Deployment

1. Build CLI binary: `npm run build`
2. Deploy to `bin/migration-runner` (executable)
3. Set up cron/scheduler for backups
4. Configure alert handlers for failures

---

## 12. Glossary

| Term | Definition |
|------|------------|
| Phase 4 | Baseline schema (before Phase 6 migrations) |
| Phase 6 | Collection of 5 migrations for production deployment |
| Table Rebuild | Migration strategy that recreates table to change schema (DEFAULT, CHECK) |
| Additive Migration | Migration that only adds columns (ALTER TABLE ADD COLUMN) |
| Ledger | Migration execution history table tracking all runs |
| Safety Window | Time period during which migration can be safely rolled back |

---

**THIS DOCUMENT IS A FUTURE IMPLEMENTATION SPECIFICATION**

- No code exists to execute migrations in production
- The specification above defines the complete design
- Implementation should follow the patterns in `tests/phase6_migration_verification.test.ts`
- All migrations have been VERIFIED against temporary databases only
- Production database `data/council.db` remains at Phase 4 schema

**End of Specification**