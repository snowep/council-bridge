# Phase 6: Database Migration Plan

**Status**: Planning — Not Executed  
**Prerequisite**: Founder approval required before execution  
**Base Schema**: v4.0.0 (Phase 4 complete)  

---

## 1. Current vs Target Schema Summary

| Table | Current State | Target State | Migration Required |
|-------|---------------|--------------|-------------------|
| `staff_agents` | `status` DEFAULT `'active'` | `status` DEFAULT `'inactive'` | ✅ Yes |
| `cross_division_shares` | `granted_by_type` CHECK `('division', 'founder')` | `granted_by_type` CHECK `('founder')` | ✅ Yes |
| `tasks` | No `dependencies`, `deliverable_id` columns | Add JSON columns | ✅ Yes (implementation additions) |
| `deliverables` | No `file_references`, `task_relationships`, `audit_log` columns | Add JSON columns | ✅ Yes (implementation additions) |
| `cross_division_shares` | No request-tracking columns | Add `request_type`, `status`, `justification`, etc. | ✅ Yes (Stage 7) |

---

## 2. Migration 1: staff_agents.status Default

### Current State
```sql
status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'inactive', 'terminated'))
```

### Target State
```sql
status TEXT NOT NULL DEFAULT 'inactive'
  CHECK (status IN ('active', 'inactive', 'terminated'))
```

### Migration Steps
1. **Pre-migration verification**:
   - Count existing staff_agents rows (should be 0 in Phase 4)
   - Verify no application code assumes `DEFAULT 'active'`

2. **Execute**:
   ```sql
   -- SQLite doesn't support ALTER COLUMN DEFAULT directly
   -- Create new table, copy data, drop old, rename
   CREATE TABLE staff_agents_new (
     staff_id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     role TEXT NOT NULL,
     division_id TEXT NOT NULL,
     runtime_instances TEXT NOT NULL DEFAULT '[]',
     permissions TEXT NOT NULL DEFAULT '[]',
     status TEXT NOT NULL DEFAULT 'inactive'
       CHECK (status IN ('active', 'inactive', 'terminated')),
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT NOT NULL DEFAULT (datetime('now')),
     FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
   );
   
   INSERT INTO staff_agents_new SELECT * FROM staff_agents;
   DROP TABLE staff_agents;
   ALTER TABLE staff_agents_new RENAME TO staff_agents;
   
   -- Recreate indexes
   CREATE INDEX idx_staff_agents_division ON staff_agents(division_id);
   CREATE INDEX idx_staff_agents_status ON staff_agents(status);
   ```

3. **Post-migration verification**:
   - Verify table structure matches target
   - Verify row count unchanged (0)
   - Test insert without explicit status → defaults to 'inactive'

### Impact
- **No existing data**: Tables are empty from Phase 4
- **No FK issues**: No circular dependencies
- **Application impact**: MCP tools must enforce `status === 'active'` before allowing operations

---

## 3. Migration 2: cross_division_shares.granted_by_type Restriction

### Current State
```sql
granted_by_type TEXT NOT NULL
  CHECK (granted_by_type IN ('division', 'founder'))
```

### Target State
```sql
granted_by_type TEXT NOT NULL
  CHECK (granted_by_type IN ('founder'))
```

### Migration Steps
1. **Pre-migration audit**:
   ```sql
   SELECT granted_by_type, COUNT(*) FROM cross_division_shares GROUP BY granted_by_type;
   ```

2. **If existing 'division' records exist**:
   - Option A: Convert to 'founder' with `granted_by_id = 'founder'` (if Founder retroactively authorizes)
   - Option B: Revoke (set `revoked_at = datetime('now')`) and require re-request
   - **Decision required from Founder**

3. **Execute schema change** (same recreate pattern):
   ```sql
   CREATE TABLE cross_division_shares_new (
     share_id TEXT PRIMARY KEY,
     memory_id TEXT NOT NULL,
     division_id TEXT NOT NULL,
     granted_by_type TEXT NOT NULL
       CHECK (granted_by_type IN ('founder')),
     granted_by_id TEXT NOT NULL,
     granted_at TEXT NOT NULL DEFAULT (datetime('now')),
     revoked_at TEXT,
     FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
     FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
     UNIQUE(memory_id, division_id)
   );
   
   INSERT INTO cross_division_shares_new SELECT * FROM cross_division_shares;
   DROP TABLE cross_division_shares;
   ALTER TABLE cross_division_shares_new RENAME TO cross_division_shares;
   
   CREATE INDEX idx_cross_division_shares_memory ON cross_division_shares(memory_id);
   CREATE INDEX idx_cross_division_shares_division ON cross_division_shares(division_id);
   ```

### Impact
- **No existing data**: Tables are empty from Phase 4
- **Service-layer**: `createCrossDivisionShare` and `revokeCrossDivisionShare` MCP tools = Founder-only

---

## 4. Migration 3: Implementation Additions (Stages 2, 3, 6, 7)

These are additive column additions to existing tables — safe `ALTER TABLE` operations.

### 4.1 tasks table additions
```sql
ALTER TABLE tasks ADD COLUMN dependencies TEXT DEFAULT '[]';        -- JSON array of task_ids
ALTER TABLE tasks ADD COLUMN deliverable_id TEXT;                   -- FK to deliverables
-- FK validation at app layer (no circular FK)
```

### 4.2 deliverables table additions
```sql
ALTER TABLE deliverables ADD COLUMN file_references TEXT DEFAULT '[]';     -- JSON array of file paths
ALTER TABLE deliverables ADD COLUMN task_relationships TEXT DEFAULT '[]';  -- JSON array of task_ids
ALTER TABLE deliverables ADD COLUMN audit_log TEXT DEFAULT '[]';           -- JSON array of {by_type, by_id, action, timestamp, before, after}
```

### 4.3 cross_division_shares Stage 7 additions
```sql
ALTER TABLE cross_division_shares ADD COLUMN request_type TEXT
  CHECK (request_type IN ('task_delegate', 'deliverable_share', 'memory_access', 'resource_request'));
ALTER TABLE cross_division_shares ADD COLUMN status TEXT
  CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE cross_division_shares ADD COLUMN justification TEXT;
ALTER TABLE cross_division_shares ADD COLUMN priority TEXT
  CHECK (priority IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE cross_division_shares ADD COLUMN deadline TEXT;
ALTER TABLE cross_division_shares ADD COLUMN approved_by_type TEXT;
ALTER TABLE cross_division_shares ADD COLUMN approved_by_id TEXT;
ALTER TABLE cross_division_shares ADD COLUMN approved_at TEXT;
```

---

## 5. Migration Order and Dependencies

| Order | Migration | Depends On |
|-------|-----------|------------|
| 1 | `staff_agents` default → `inactive` | None (empty table) |
| 2 | `cross_division_shares` `granted_by_type` → `'founder'` | None (empty table) |
| 3 | `tasks` additive columns | Migrations 1, 2 |
| 4 | `deliverables` additive columns | Migrations 1, 2 |
| 5 | `cross_division_shares` Stage 7 columns | Migrations 1, 2 |

---

## 6. Backup and Rollback

### Backup Procedure (Before Each Migration)
```bash
# 1. SQLite backup
sqlite3 council.db ".backup council_pre_migration_$(date +%s).db"

# 2. Export schema
sqlite3 council.db ".schema" > schema_backup_$(date +%s).sql

# 3. Export data (all Phase 6 tables)
sqlite3 council.db "SELECT * FROM staff_agents;" > staff_agents_backup_$(date +%s).csv
sqlite3 council.db "SELECT * FROM cross_division_shares;" > cross_division_shares_backup_$(date +%s).csv
sqlite3 council.db "SELECT * FROM divisions;" > divisions_backup_$(date +%s).csv
sqlite3 council.db "SELECT * FROM division_members;" > division_members_backup_$(date +%s).csv
sqlite3 council.db "SELECT * FROM tasks;" > tasks_backup_$(date +%s).csv
sqlite3 council.db "SELECT * FROM deliverables;" > deliverables_backup_$(date +%s).csv
```

### Rollback Procedure
```bash
# Restore from backup
sqlite3 council.db ".restore council_pre_migration_<timestamp>.db"

# Or re-run original Phase 4 CREATE TABLE statements (idempotent)
```

---

## 7. Foreign Key Integrity

### Pre-Migration Checks
```sql
-- Verify no orphaned staff_agents
SELECT s.* FROM staff_agents s LEFT JOIN divisions d ON s.division_id = d.division_id WHERE d.division_id IS NULL;

-- Verify no orphaned division_members
SELECT dm.* FROM division_members dm LEFT JOIN divisions d ON dm.division_id = d.division_id WHERE d.division_id IS NULL;
SELECT dm.* FROM division_members dm LEFT JOIN staff_agents s ON dm.staff_id = s.staff_id WHERE s.staff_id IS NULL;

-- Verify no orphaned cross_division_shares
SELECT cds.* FROM cross_division_shares cds LEFT JOIN memory_entries m ON cds.memory_id = m.memory_id WHERE m.memory_id IS NULL;
SELECT cds.* FROM cross_division_shares cds LEFT JOIN divisions d ON cds.division_id = d.division_id WHERE d.division_id IS NULL;
```

### Post-Migration Checks (Same Queries)

---

## 8. Index and Trigger Preservation

### Indexes to Recreate (After Table Recreate)
- `idx_staff_agents_division` on `staff_agents(division_id)`
- `idx_staff_agents_status` on `staff_agents(status)`
- `idx_cross_division_shares_memory` on `cross_division_shares(memory_id)`
- `idx_cross_division_shares_division` on `cross_division_shares(division_id)`
- `idx_divisions_head` on `divisions(head_staff_id)`
- `idx_division_members_division` on `division_members(division_id)`
- `idx_division_members_staff` on `division_members(staff_id)`
- `idx_tasks_assigned` on `tasks(assigned_to_type, assigned_to_id)`
- `idx_tasks_status` on `tasks(status)`
- `idx_tasks_created_by` on `tasks(created_by_type, created_by_id)`
- `idx_deliverables_task` on `deliverables(task_id)`
- `idx_deliverables_status` on `deliverables(status)`

### FTS5 Triggers (Unaffected)
- `memory_entries_fts_insert`
- `memory_entries_fts_update`
- `memory_entries_fts_archive`
- `memory_entries_fts_restore`
- `memory_entries_fts_delete`

---

## 9. Migration Verification Tests

### Automated Tests (Add to test suite)
```typescript
// tests/phase6.migration.verification.test.ts

describe('Phase 6 Migration Verification', () => {
  test('staff_agents default status is inactive', () => {
    const result = db.prepare("INSERT INTO staff_agents (staff_id, name, role, division_id) VALUES (?, ?, ?, ?)")
      .run('test-id', 'Test', 'role', 'div-dev');
    const agent = db.prepare('SELECT status FROM staff_agents WHERE staff_id = ?').get('test-id');
    expect(agent.status).toBe('inactive');
  });

  test('cross_division_shares rejects division granted_by_type', () => {
    expect(() => {
      db.prepare(`INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id)
        VALUES (?, ?, ?, ?, ?)`).run('share-1', 'mem-1', 'div-dev', 'division', 'div-dev');
    }).toThrow();
  });

  test('cross_division_shares accepts founder granted_by_type', () => {
    const result = db.prepare(`INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id)
      VALUES (?, ?, ?, ?, ?)`).run('share-2', 'mem-1', 'div-dev', 'founder', 'founder');
    expect(result.changes).toBe(1);
  });

  test('new columns exist on tasks', () => {
    const cols = db.prepare("PRAGMA table_info(tasks)").all().map(c => c.name);
    expect(cols).toContain('dependencies');
    expect(cols).toContain('deliverable_id');
  });

  test('new columns exist on deliverables', () => {
    const cols = db.prepare("PRAGMA table_info(deliverables)").all().map(c => c.name);
    expect(cols).toContain('file_references');
    expect(cols).toContain('task_relationships');
    expect(cols).toContain('audit_log');
  });

  test('Stage 7 columns exist on cross_division_shares', () => {
    const cols = db.prepare("PRAGMA table_info(cross_division_shares)").all().map(c => c.name);
    expect(cols).toContain('request_type');
    expect(cols).toContain('status');
    expect(cols).toContain('justification');
    expect(cols).toContain('priority');
    expect(cols).toContain('deadline');
    expect(cols).toContain('approved_by_type');
    expect(cols).toContain('approved_by_id');
    expect(cols).toContain('approved_at');
  });
});
```

---

## 10. Approval Requirements

| Migration | Founder Approval Required | Notes |
|-----------|--------------------------|-------|
| 1: staff_agents default | ✅ Yes | Changes operational default |
| 2: cross_division_shares granted_by_type | ✅ Yes | Policy change; may affect existing grants |
| 3-5: Additive columns | ✅ Yes | Part of Phase 6 implementation scope |

**All migrations require explicit Founder authorization before execution.**

---

## 11. Migration Execution Script (Template)

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

# 1. Backup
sqlite3 "$DB_PATH" ".backup $BACKUP_DIR/council_pre_migration.db"
sqlite3 "$DB_PATH" ".schema" > "$BACKUP_DIR/schema.sql"
# ... export all Phase 6 table data ...

# 2. Execute migrations in order
echo "Running Migration 1: staff_agents default -> inactive"
sqlite3 "$DB_PATH" < migrations/001_staff_agents_default_inactive.sql

echo "Running Migration 2: cross_division_shares granted_by_type -> founder"
sqlite3 "$DB_PATH" < migrations/002_cross_division_shares_founder_only.sql

echo "Running Migration 3: tasks additive columns"
sqlite3 "$DB_PATH" < migrations/003_tasks_add_columns.sql

echo "Running Migration 4: deliverables additive columns"
sqlite3 "$DB_PATH" < migrations/004_deliverables_add_columns.sql

echo "Running Migration 5: cross_division_shares stage7 columns"
sqlite3 "$DB_PATH" < migrations/005_cross_division_shares_stage7.sql

# 3. Verify
echo "Running verification tests..."
npm test -- tests/phase6.migration.verification.test.ts

echo "=== Migration Complete ==="
```

---

## 12. Open Decisions Requiring Founder Input

1. **Existing 'division' grants**: If any exist (currently 0), convert to 'founder' or revoke?
2. **Migration timing**: Run all at once or staged with Phase 6 implementation stages?
3. **Rollback criteria**: What constitutes a failed migration requiring rollback?
4. **Downtime window**: When to execute (development vs production)?

---

*End of Migration Plan*  
*No migrations executed. All changes require Founder approval.*