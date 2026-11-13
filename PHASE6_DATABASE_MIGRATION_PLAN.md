# Phase 6: Database Migration Plan

**Status**: Planning — Not Executed  
**Prerequisite**: Founder approval required before execution  
**Base Schema**: v4.0.0 (Phase 4 complete)  
**Migration Directory**: `migrations/`  
**Test Suite**: `tests/phase6_migration_verification.test.ts`

---

## 1. Current vs Target Schema Summary

| Table | Current State | Target State | Migration Required |
|-------|---------------|--------------|-------------------|
| `staff_agents` | `status` DEFAULT `'active'` | `status` DEFAULT `'inactive'` | ✅ Migration 001 (table rebuild) |
| `cross_division_shares` | `granted_by_type` CHECK `('division', 'founder')` | `granted_by_type` CHECK `('founder')` | ✅ Migration 002 (table rebuild) |
| `tasks` | No `dependencies`, `deliverable_id` columns | Add JSON/FK columns | ✅ Migration 003 (ALTER TABLE) |
| `deliverables` | No `file_references`, `task_relationships`, `audit_log` columns | Add JSON columns | ✅ Migration 004 (ALTER TABLE) |
| `cross_division_shares` | No request-tracking columns | Add `request_type`, `status`, `justification`, etc. | ✅ Migration 005 (ALTER TABLE) |

**Total Logical Migrations**: 5 (001–005)  
- 2 table rebuilds (001, 002)  
- 3 additive ALTER TABLE operations (003, 004, 005)

---

## 2. Migration 001: staff_agents.status Default → 'inactive'

### Current State (src/database.ts:671-683)
```sql
CREATE TABLE IF NOT EXISTS staff_agents (
  staff_id          TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  role              TEXT NOT NULL,
  division_id       TEXT NOT NULL,
  runtime_instances TEXT NOT NULL DEFAULT '[]',
  permissions       TEXT NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'terminated')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
);
```

### Target State
```sql
CREATE TABLE IF NOT EXISTS staff_agents (
  staff_id          TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  role              TEXT NOT NULL,
  division_id       TEXT NOT NULL,
  runtime_instances TEXT NOT NULL DEFAULT '[]',
  permissions       TEXT NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active', 'inactive', 'terminated')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
);
```

### Migration Strategy
- **Type**: Table rebuild (SQLite doesn't support `ALTER COLUMN DEFAULT`)
- **File**: `migrations/001_staff_agents_default_inactive.sql`
- **Foreign Key Handling**: `PRAGMA foreign_keys = OFF` during rebuild
- **Dependent Tables**: `division_members` (FK to `staff_agents.staff_id`), `divisions.head_staff_id` (no FK, app-layer only)
- **Data Preservation**: Full copy via `INSERT INTO new SELECT * FROM old`
- **Indexes Recreated**: `idx_staff_agents_division`, `idx_staff_agents_status`

### Verification Tests
- Existing data preserved (3 test agents with mixed statuses)
- New default = 'inactive' for fresh inserts
- FK to `divisions` enforced after migration
- `division_members` FK to `staff_agents` enforced after migration
- Indexes recreated

### Rollback
```bash
sqlite3 council.db ".restore council_pre_migration_001_<timestamp>.db"
# OR re-run Phase 4 CREATE TABLE statement
```

---

## 3. Migration 002: cross_division_shares.granted_by_type → 'founder' Only

### Current State (src/database.ts:698-710)
```sql
CREATE TABLE IF NOT EXISTS cross_division_shares (
  share_id        TEXT PRIMARY KEY,
  memory_id       TEXT NOT NULL,
  division_id     TEXT NOT NULL,
  granted_by_type TEXT NOT NULL
    CHECK (granted_by_type IN ('division', 'founder')),
  granted_by_id   TEXT NOT NULL,
  granted_at      TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at      TEXT,
  FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
  UNIQUE(memory_id, division_id)
);
```

### Target State
```sql
CREATE TABLE IF NOT EXISTS cross_division_shares (
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
```

### Migration Strategy
- **Type**: Table rebuild with legacy handling
- **File**: `migrations/002_cross_division_shares_founder_only.sql`
- **Foreign Key Handling**: `PRAGMA foreign_keys = OFF` during rebuild

### Legacy Grant Treatment (Critical)
| Grant Type | Action | Rationale |
|------------|--------|-----------|
| `granted_by_type = 'founder'` | **Preserved** — copied to new table | Legitimate Founder authorization |
| `granted_by_type = 'division'` | **Revoked** — NOT copied, logged to `migration_audit` | No fabricated Founder approval; requires explicit reauthorization |

**Migration Audit Table** (created by migration):
```sql
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
```

### Verification Tests
- Founder grants remain valid and usable
- Division grants revoked and logged
- New division grants rejected by CHECK constraint
- New Founder grants accepted
- Audit records contain full legacy data for traceability

### Rollback
```bash
sqlite3 council.db ".restore council_pre_migration_002_<timestamp>.db"
# OR re-run Phase 4 CREATE TABLE statement
```

---

## 4. Migration 003: tasks Additive Columns

### File
`migrations/003_tasks_add_columns.sql`

### Operations
```sql
ALTER TABLE tasks ADD COLUMN dependencies TEXT DEFAULT '[]';  -- JSON array of task_ids
ALTER TABLE tasks ADD COLUMN deliverable_id TEXT;              -- FK reference (app-layer validated)
```

### Deliverable Relationship Decision: **Option B — Application-Level**
- **NOT a database foreign key** — no FK constraint created
- **Reason**: Circular FK risk (`tasks` ↔ `deliverables` via `deliverables.task_id`)
- **Service-Layer Validation**:
  - On task creation: `deliverable_id` nullable
  - On deliverable submission: validate `deliverable.task_id === task.task_id`
  - On deliverable deletion: clear `task.deliverable_id` or mark task for review
  - Queries: `JOIN` available but not DB-enforced

### Verification Tests
- Columns exist with correct defaults
- `dependencies` defaults to `'[]'`
- `deliverable_id` nullable

### Rollback
Table rebuild from backup (SQLite < 3.35 doesn't support `DROP COLUMN`)

---

## 5. Migration 004: deliverables Additive Columns

### File
`migrations/004_deliverables_add_columns.sql`

### Operations
```sql
ALTER TABLE deliverables ADD COLUMN file_references TEXT DEFAULT '[]';     -- JSON array of file paths
ALTER TABLE deliverables ADD COLUMN task_relationships TEXT DEFAULT '[]';  -- JSON array of task_ids
ALTER TABLE deliverables ADD COLUMN audit_log TEXT DEFAULT '[]';           -- JSON array of {by_type, by_id, action, timestamp, before, after}
```

### Verification Tests
- All three columns exist with correct defaults
- JSON defaults are `'[]'`

### Rollback
Table rebuild from backup

---

## 6. Migration 005: cross_division_shares Stage 7 Request-Tracking Columns

### File
`migrations/005_cross_division_shares_stage7.sql`

### Operations
```sql
ALTER TABLE cross_division_shares ADD COLUMN request_type TEXT
  CHECK (request_type IN ('task_delegate', 'deliverable_share', 'memory_access', 'resource_request'));
ALTER TABLE cross_division_shares ADD COLUMN status TEXT
  CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending';
ALTER TABLE cross_division_shares ADD COLUMN justification TEXT;
ALTER TABLE cross_division_shares ADD COLUMN priority TEXT
  CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium';
ALTER TABLE cross_division_shares ADD COLUMN deadline TEXT;
ALTER TABLE cross_division_shares ADD COLUMN approved_by_type TEXT;
ALTER TABLE cross_division_shares ADD COLUMN approved_by_id TEXT;
ALTER TABLE cross_division_shares ADD COLUMN approved_at TEXT;
```

### Verification Tests
- All columns exist with CHECK constraints
- Invalid `request_type`, `status`, `priority` values rejected
- Valid inserts succeed

### Rollback
Table rebuild from backup

---

## 7. Migration Execution Order & Dependencies

```
Phase 1 (Independent, can run in parallel):
  ├── 001: staff_agents_default_inactive
  └── 002: cross_division_shares_founder_only

Phase 2 (Depend on Phase 1, can run in parallel):
  ├── 003: tasks_add_columns
  ├── 004: deliverables_add_columns
  └── 005: cross_division_shares_stage7 (depends on 002)
```

**Recommended Sequential Execution**: 001 → 002 → 003 → 004 → 005

---

## 8. Backup and Rollback Procedures

### Per-Migration Backup
```bash
# Before each migration:
sqlite3 council.db ".backup council_pre_migration_<migration_id>_$(date +%s).db"
sqlite3 council.db ".schema" > schema_backup_<migration_id>_$(date +%s).sql
sqlite3 council.db "SELECT * FROM staff_agents;" > staff_agents_backup_<migration_id>_$(date +%s).csv
sqlite3 council.db "SELECT * FROM cross_division_shares;" > cross_division_shares_backup_<migration_id>_$(date +%s).csv
sqlite3 council.db "SELECT * FROM divisions;" > divisions_backup_<migration_id>_$(date +%s).csv
sqlite3 council.db "SELECT * FROM division_members;" > division_members_backup_<migration_id>_$(date +%s).csv
sqlite3 council.db "SELECT * FROM tasks;" > tasks_backup_<migration_id>_$(date +%s).csv
sqlite3 council.db "SELECT * FROM deliverables;" > deliverables_backup_<migration_id>_$(date +%s).csv
```

### Full Rollback (if any migration fails)
```bash
# Restore from first migration backup
sqlite3 council.db ".restore council_pre_migration_001_<timestamp>.db"
# Then re-run all migrations in order if retrying
```

---

## 9. Foreign Key Integrity Checks

### Pre-Migration
```sql
-- staff_agents → divisions
SELECT s.* FROM staff_agents s LEFT JOIN divisions d ON s.division_id = d.division_id WHERE d.division_id IS NULL;

-- division_members → divisions
SELECT dm.* FROM division_members dm LEFT JOIN divisions d ON dm.division_id = d.division_id WHERE d.division_id IS NULL;

-- division_members → staff_agents
SELECT dm.* FROM division_members dm LEFT JOIN staff_agents s ON dm.staff_id = s.staff_id WHERE s.staff_id IS NULL;

-- cross_division_shares → memory_entries
SELECT cds.* FROM cross_division_shares cds LEFT JOIN memory_entries m ON cds.memory_id = m.memory_id WHERE m.memory_id IS NULL;

-- cross_division_shares → divisions
SELECT cds.* FROM cross_division_shares cds LEFT JOIN divisions d ON cds.division_id = d.division_id WHERE d.division_id IS NULL;
```

### Post-Migration (Same Queries)

---

## 10. Index and Trigger Preservation

### Indexes Recreated After Table Rebuilds (001, 002)
| Migration | Indexes |
|-----------|---------|
| 001 | `idx_staff_agents_division`, `idx_staff_agents_status` |
| 002 | `idx_cross_division_shares_memory`, `idx_cross_division_shares_division` |

### FTS5 Triggers (Unaffected by Phase 6 Migrations)
- `memory_entries_fts_insert`
- `memory_entries_fts_update`
- `memory_entries_fts_archive`
- `memory_entries_fts_restore`
- `memory_entries_fts_delete`

---

## 11. Migration Verification Tests

**File**: `tests/phase6_migration_verification.test.ts`

**Test Coverage (15 tests, all passing)**:
| Test Category | Tests | Status |
|---------------|-------|--------|
| Migration 001 (actual SQL): staff_agents default → inactive | 1 | ✅ PASS |
| Migration 002 (actual SQL): cross_division_shares founder-only | 1 | ✅ PASS |
| Migration 003 (actual SQL): tasks additive columns | 1 | ✅ PASS |
| Migration 004 (actual SQL): deliverables additive columns | 1 | ✅ PASS |
| Migration 005 (actual SQL): cross_division_shares Stage 7 columns | 1 | ✅ PASS |
| Full migration sequence (001-005 in order) | 1 | ✅ PASS |
| Table rebuild preservation (indexes, triggers, FK records) | 2 | ✅ PASS |
| Rollback using actual backups (file-backed database) | 1 | ✅ PASS |
| Migration execution tracking (ledger, duplicate prevention) | 1 | ✅ PASS |
| Test classification (unit/integration/application-layer) | 5 | ✅ PASS |

**Verification Scope**:
- ✅ All five committed SQL files executed by tests
- ✅ Legacy grant conversion tested against actual Migration 002 file
- ✅ Foreign-key checks pass after table rebuilds (`PRAGMA foreign_key_check`)
- ✅ Indexes recreated after table rebuilds (standard indexes documented in migration SQL)
- ✅ Dependent records survive table rebuilds (division_members → staff_agents FK)
- ✅ Backup restoration tested against file-backed temporary database (file copy method)
- ✅ Duplicate migration execution prevented via migration_ledger table with SHA-256 checksums
- ✅ Tests distinguish: actual SQL file execution, full sequence integration, backup/rollback integration, application-layer (NOT tested here)

**Run Command**:
```bash
npx tsx --test tests/phase6_migration_verification.test.ts
```

---

## 12. Execution Script Template

```bash
#!/bin/bash
# execute_phase6_migrations.sh
# DO NOT RUN WITHOUT FOUNDER APPROVAL

set -e

DB_PATH="data/council.db"
BACKUP_DIR="migrations/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "=== Phase 6 Database Migration ==="
echo "Backup directory: $BACKUP_DIR"
echo "Database: $DB_PATH"

# Backup
sqlite3 "$DB_PATH" ".backup $BACKUP_DIR/council_pre_migration.db"
sqlite3 "$DB_PATH" ".schema" > "$BACKUP_DIR/schema.sql"
sqlite3 "$DB_PATH" "SELECT * FROM staff_agents;" > "$BACKUP_DIR/staff_agents.csv"
sqlite3 "$DB_PATH" "SELECT * FROM cross_division_shares;" > "$BACKUP_DIR/cross_division_shares.csv"
sqlite3 "$DB_PATH" "SELECT * FROM divisions;" > "$BACKUP_DIR/divisions.csv"
sqlite3 "$DB_PATH" "SELECT * FROM division_members;" > "$BACKUP_DIR/division_members.csv"
sqlite3 "$DB_PATH" "SELECT * FROM tasks;" > "$BACKUP_DIR/tasks.csv"
sqlite3 "$DB_PATH" "SELECT * FROM deliverables;" > "$BACKUP_DIR/deliverables.csv"

# Execute migrations in order
echo "Running Migration 001: staff_agents default -> inactive"
sqlite3 "$DB_PATH" < migrations/001_staff_agents_default_inactive.sql

echo "Running Migration 002: cross_division_shares granted_by_type -> founder"
sqlite3 "$DB_PATH" < migrations/002_cross_division_shares_founder_only.sql

echo "Running Migration 003: tasks additive columns"
sqlite3 "$DB_PATH" < migrations/003_tasks_add_columns.sql

echo "Running Migration 004: deliverables additive columns"
sqlite3 "$DB_PATH" < migrations/004_deliverables_add_columns.sql

echo "Running Migration 005: cross_division_shares stage7 columns"
sqlite3 "$DB_PATH" < migrations/005_cross_division_shares_stage7.sql

# Verify
echo "Running verification tests..."
npx tsx --test tests/phase6_migration_verification.test.ts

echo "=== Migration Complete ==="
```

---

## 13. Open Decisions Requiring Founder Input

1. **Migration timing**: Run all at once or staged with Phase 6 implementation stages?
2. **Rollback criteria**: What constitutes a failed migration requiring rollback?
3. **Downtime window**: When to execute (development vs production)?
4. **Migration audit retention**: How long to keep `migration_audit` table?

---

## 14. Approval Requirements

| Migration | Founder Approval Required | Notes |
|-----------|--------------------------|-------|
| 001: staff_agents default | ✅ Yes | Changes operational default |
| 002: cross_division_shares granted_by_type | ✅ Yes | Policy change; revokes legacy grants |
| 003: tasks additive columns | ✅ Yes | Part of Phase 6 implementation scope |
| 004: deliverables additive columns | ✅ Yes | Part of Phase 6 implementation scope |
| 005: cross_division_shares Stage 7 columns | ✅ Yes | Part of Phase 6 implementation scope |

**All migrations require explicit Founder authorization before execution.**

---

*End of Migration Plan*  
*No migrations executed. All changes require Founder approval.*