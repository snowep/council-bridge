# Phase 6 Production Migration Runbook

**Document Version**: 1.0
**Target Database**: `data/council.db`
**Migration Files**: 5 SQL files in `migrations/`
**Verification Baseline**: `PHASE6_BASELINE_VERIFICATION_REPORT.md`
**Test Suite**: `tests/phase6_migration_verification.test.ts` (16 tests passing)

---

## 1. Executive Summary

This runbook provides step-by-step procedures for executing the Phase 6 database migrations against the production database (`data/council.db`). The migrations implement schema changes for:

- Staff agent activation control (default inactive)
- Founder-only cross-division grant authority
- Task dependency tracking and deliverable linking
- Deliverable versioning and audit trail
- Cross-division share request workflow tracking

**Critical**: All migrations have been verified against temporary databases only. No migration has been executed against `data/council.db`.

---

## 2. Pre-Execution Prerequisites

### 2.1 Authorization Requirements

| Requirement | Status | Verification |
|-------------|--------|--------------|
| Founder explicit authorization | **REQUIRED** | Written approval in `PHASE6_FOUNDER_AUTHORIZATION_PACKAGE.md` |
| Phase 1-5 functionality verified | **VERIFIED** | 122 tests passing (29 suites) |
| Production database backup created | **REQUIRED** | See Section 3 |
| Migration verification tests passing | **VERIFIED** | 16/16 tests passing |

### 2.2 Environment Verification

```bash
# Verify current database state
ls -la data/council.db
# Expected: 40,960 bytes, last modified Nov 11 17:36 (pre-migration)

# Verify migrations directory
ls -la migrations/
# Expected: 5 .sql files (001-005)

# Verify test suite
npx tsx --test tests/phase6_migration_verification.test.ts
# Expected: 16/16 PASS
```

### 2.3 Tool Requirements

- SQLite3 CLI (`sqlite3`) — for backup/restore operations
- Node.js with better-sqlite3 — for verification scripts
- Write access to `data/` directory

---

## 3. Backup Procedures

### 3.1 Pre-Migration Full Backup

**Execute before ANY migration:**

```bash
# Timestamp for backup identification
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 1. Binary backup (most reliable for SQLite)
sqlite3 data/council.db ".backup data/backups/council_pre_migration_${TIMESTAMP}.db"

# 2. Schema dump (for inspection)
sqlite3 data/council.db ".schema" > data/backups/schema_pre_migration_${TIMESTAMP}.sql

# 3. Data dump (for full reconstruction)
sqlite3 data/council.db ".dump" > data/backups/dump_pre_migration_${TIMESTAMP}.sql

# 4. Verify backup integrity
sqlite3 data/backups/council_pre_migration_${TIMESTAMP}.db "PRAGMA integrity_check;"
# Expected: "ok"
```

### 3.2 Per-Migration Backup (Optional but Recommended)

```bash
# Before each migration N (001-005):
sqlite3 data/council.db ".backup data/backups/council_pre_${N}_${TIMESTAMP}.db"
```

### 3.3 Backup Verification Checklist

| Check | Command | Expected |
|-------|---------|----------|
| Backup file exists | `ls -la data/backups/council_pre_migration_*.db` | File present |
| Integrity check | `sqlite3 backup.db "PRAGMA integrity_check;"` | `ok` |
| Table count matches | `sqlite3 backup.db ".tables"` | 7 tables + FTS + triggers |
| Row counts match | Compare `SELECT COUNT(*) FROM table` | Pre-migration counts |

---

## 4. Migration Execution Procedures

### 4.1 Execution Order

**Strict sequential order required:**

```
001 → 002 → 003 → 004 → 005
```

**Dependency Rationale:**
- 001, 002: Table rebuilds (must complete before additive migrations on same tables)
- 003, 004: Depend on 001, 002 (tasks/deliverables reference staff_agents)
- 005: Depends on 002 (adds columns to cross_division_shares after rebuild)

### 4.2 Migration 001: staff_agents Default → inactive

**File**: `migrations/001_staff_agents_default_inactive.sql`
**Type**: Table rebuild (preserves data, indexes, FKs)
**Risk**: Medium — table rebuild with foreign keys

```bash
# Pre-check
sqlite3 data/council.db "SELECT COUNT(*) FROM staff_agents;"
sqlite3 data/council.db "SELECT sql FROM sqlite_master WHERE name='staff_agents';"
# Verify DEFAULT 'active' present

# Execute
sqlite3 data/council.db < migrations/001_staff_agents_default_inactive.sql

# Post-check
sqlite3 data/council.db "SELECT sql FROM sqlite_master WHERE name='staff_agents';"
# Verify DEFAULT 'inactive' present

sqlite3 data/council.db "PRAGMA foreign_key_check;"
# Expected: no output (zero violations)

sqlite3 data/council.db "SELECT COUNT(*) FROM staff_agents;"
# Verify row count unchanged
```

**Verification Queries:**
```sql
-- New default is inactive
INSERT INTO staff_agents (staff_id, name, role, division_id) VALUES ('test-mig-001', 'Test', 'role', 'div-dev');
SELECT status FROM staff_agents WHERE staff_id = 'test-mig-001';  -- Should be 'inactive'
DELETE FROM staff_agents WHERE staff_id = 'test-mig-001';

-- Indexes recreated
SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='staff_agents';
-- Should include: idx_staff_agents_division, idx_staff_agents_status

-- Dependent records intact
SELECT COUNT(*) FROM division_members;  -- Should match pre-migration count
```

### 4.3 Migration 002: cross_division_shares Founder-Only

**File**: `migrations/002_cross_division_shares_founder_only.sql`
**Type**: Table rebuild with legacy data handling
**Risk**: Medium — table rebuild, legacy grant revocation, audit log creation

```bash
# Pre-check
sqlite3 data/council.db "SELECT COUNT(*) FROM cross_division_shares;"
sqlite3 data/council.db "SELECT granted_by_type, COUNT(*) FROM cross_division_shares GROUP BY granted_by_type;"
# Note counts by type (founder vs division)

# Execute
sqlite3 data/council.db < migrations/002_cross_division_shares_founder_only.sql

# Post-check
sqlite3 data/council.db "SELECT COUNT(*) FROM cross_division_shares;"
# Should equal pre-migration founder grant count only

sqlite3 data/council.db "SELECT granted_by_type, COUNT(*) FROM cross_division_shares GROUP BY granted_by_type;"
# Should show only 'founder'

sqlite3 data/council.db "SELECT COUNT(*) FROM migration_audit WHERE migration_id = '002_cross_division_shares_founder_only';"
# Should equal pre-migration division grant count

sqlite3 data/council.db "PRAGMA foreign_key_check;"
# Expected: no output
```

**Verification Queries:**
```sql
-- CHECK constraint enforces 'founder' only
INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id)
VALUES ('test-fail', 'mem-1', 'div-dev', 'division', 'div-dev');
-- Should FAIL with CHECK constraint violation

-- Founder grants still work
INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id)
VALUES ('test-ok', 'mem-1', 'div-dev', 'founder', 'founder');
-- Should SUCCEED
DELETE FROM cross_division_shares WHERE share_id = 'test-ok';

-- Audit log structure
SELECT * FROM migration_audit WHERE migration_id = '002_cross_division_shares_founder_only';
-- Should have action='revoked', reason mentions "Division-authorized grant not permitted"
```

### 4.4 Migration 003: tasks Additive Columns

**File**: `migrations/003_tasks_add_columns.sql`
**Type**: Safe ALTER TABLE (additive, no data loss)
**Risk**: Low — additive columns only

```bash
# Pre-check
sqlite3 data/council.db "PRAGMA table_info(tasks);"
# Verify columns 'dependencies' and 'deliverable_id' do NOT exist

# Execute
sqlite3 data/council.db < migrations/003_tasks_add_columns.sql

# Post-check
sqlite3 data/council.db "PRAGMA table_info(tasks);"
# Verify both columns exist

sqlite3 data/council.db "SELECT dependencies FROM tasks LIMIT 1;"
# Should return '[]' (default)

sqlite3 data/council.db "SELECT deliverable_id FROM tasks LIMIT 1;"
# Should return NULL (nullable)

sqlite3 data/council.db "PRAGMA foreign_key_check;"
# Expected: no output
```

### 4.5 Migration 004: deliverables Additive Columns

**File**: `migrations/004_deliverables_add_columns.sql`
**Type**: Safe ALTER TABLE (additive, no data loss)
**Risk**: Low — additive columns only

```bash
# Pre-check
sqlite3 data/council.db "PRAGMA table_info(deliverables);"
# Verify columns 'file_references', 'task_relationships', 'audit_log' do NOT exist

# Execute
sqlite3 data/council.db < migrations/004_deliverables_add_columns.sql

# Post-check
sqlite3 data/council.db "PRAGMA table_info(deliverables);"
# Verify all three columns exist

sqlite3 data/council.db "SELECT file_references, task_relationships, audit_log FROM deliverables LIMIT 1;"
# Should return '[]', '[]', '[]' (defaults)

sqlite3 data/council.db "PRAGMA foreign_key_check;"
# Expected: no output
```

### 4.6 Migration 005: cross_division_shares Stage 7 Columns

**File**: `migrations/005_cross_division_shares_stage7.sql`
**Type**: Safe ALTER TABLE with CHECK constraints (additive)
**Risk**: Low — additive columns with constraints

```bash
# Pre-check
sqlite3 data/council.db "PRAGMA table_info(cross_division_shares);"
# Verify new columns do NOT exist: request_type, status, justification, priority, deadline, approved_by_type, approved_by_id, approved_at

# Execute
sqlite3 data/council.db < migrations/005_cross_division_shares_stage7.sql

# Post-check
sqlite3 data/council.db "PRAGMA table_info(cross_division_shares);"
# Verify all 8 new columns exist

sqlite3 data/council.db "
  INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id, request_type, status, priority)
  VALUES ('test-mig-005', 'mem-1', 'div-dev', 'founder', 'founder', 'memory_access', 'pending', 'high');
"
# Should SUCCEED

sqlite3 data/council.db "
  INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id, request_type)
  VALUES ('test-fail', 'mem-1', 'div-dev', 'founder', 'founder', 'invalid_type');
"
# Should FAIL (CHECK constraint on request_type)

sqlite3 data/council.db "DELETE FROM cross_division_shares WHERE share_id = 'test-mig-005';"

sqlite3 data/council.db "PRAGMA foreign_key_check;"
# Expected: no output
```

---

## 5. Post-Execution Verification

### 5.1 Full Schema Verification

```bash
# Run complete verification test suite
npx tsx --test tests/phase6_migration_verification.test.ts
# Expected: 16/16 PASS (now against production schema)

# Comprehensive schema dump
sqlite3 data/council.db ".schema" > data/backups/schema_post_migration_$(date +%Y%m%d_%H%M%S).sql
```

### 5.2 Data Integrity Checks

```sql
-- All tables have expected row counts
SELECT 'divisions', COUNT(*) FROM divisions;
SELECT 'staff_agents', COUNT(*) FROM staff_agents;
SELECT 'division_members', COUNT(*) FROM division_members;
SELECT 'memory_entries', COUNT(*) FROM memory_entries;
SELECT 'cross_division_shares', COUNT(*) FROM cross_division_shares;
SELECT 'tasks', COUNT(*) FROM tasks;
SELECT 'deliverables', COUNT(*) FROM deliverables;

-- Foreign key integrity (CRITICAL)
PRAGMA foreign_key_check;
-- MUST return zero rows

-- FTS5 triggers functional
INSERT INTO memory_entries (memory_id, owner_type, owner_id, category, memory_type, title, content)
VALUES ('verify-fts', 'staff', 'staff-1', 'staff_private', 'note', 'FTS Test', 'Content');
SELECT * FROM memory_fts WHERE memory_id = 'verify-fts';
-- Should return 1 row
DELETE FROM memory_entries WHERE memory_id = 'verify-fts';

-- New defaults functional
INSERT INTO staff_agents (staff_id, name, role, division_id) VALUES ('verify-default', 'Test', 'role', 'div-dev');
SELECT status FROM staff_agents WHERE staff_id = 'verify-default';
-- Should be 'inactive'
DELETE FROM staff_agents WHERE staff_id = 'verify-default';
```

### 5.3 Application Compatibility Smoke Tests

```bash
# Run Phase 1-5 test suite to verify no regressions
npm test
# Expected: 122 tests passing (29 suites)

# Verify specific Phase 4 functionality
npx tsx --test tests/memory-*.test.ts
npx tsx --test tests/council-*.test.ts
```

---

## 6. Rollback Procedures

### 6.1 Full Rollback (All Migrations)

**Use if ANY migration fails or post-verification fails:**

```bash
# 1. Stop application / prevent writes
# 2. Restore from pre-migration backup
sqlite3 data/council.db ".restore data/backups/council_pre_migration_<TIMESTAMP>.db"

# 3. Verify restoration
sqlite3 data/council.db "PRAGMA integrity_check;"
sqlite3 data/council.db "PRAGMA foreign_key_check;"
sqlite3 data/council.db "SELECT sql FROM sqlite_master WHERE name='staff_agents';"
# Should show DEFAULT 'active'

# 4. Run full test suite
npm test
# Expected: 122 tests passing
```

### 6.2 Per-Migration Rollback

| Migration | Rollback Method |
|-----------|-----------------|
| 001 (table rebuild) | Restore from per-migration backup OR re-run Phase 4 CREATE TABLE for staff_agents |
| 002 (table rebuild) | Restore from per-migration backup OR re-run Phase 4 CREATE TABLE for cross_division_shares |
| 003 (ALTER TABLE) | Restore from per-migration backup (SQLite < 3.35 no DROP COLUMN) |
| 004 (ALTER TABLE) | Restore from per-migration backup |
| 005 (ALTER TABLE) | Restore from per-migration backup |

**Example: Rollback Migration 003 only**

```bash
# Restore from pre-003 backup
sqlite3 data/council.db ".restore data/backups/council_pre_003_<TIMESTAMP>.db"

# Verify
sqlite3 data/council.db "PRAGMA table_info(tasks);"
# Should NOT show dependencies, deliverable_id columns
```

### 6.3 Rollback Verification

After ANY rollback:
1. `PRAGMA integrity_check` → `ok`
2. `PRAGMA foreign_key_check` → no output
3. Full test suite → 122 tests passing
4. Application functionality verified

---

## 7. Incident Response

### 7.1 Migration Failure During Execution

| Symptom | Immediate Action |
|---------|------------------|
| SQLite error during migration | STOP. Do not proceed. Rollback from pre-migration backup. |
| Foreign key violation after migration | STOP. Rollback. Investigate data inconsistency. |
| Migration partially applied | Rollback from pre-migration backup. Do not attempt partial rollback. |
| CHECK constraint violation on test insert | Expected for 002, 005. Verify it's the CORRECT constraint failing. |

### 7.2 Post-Migration Issues

| Issue | Response |
|-------|----------|
| Application errors | Check `npm test` — if failing, rollback immediately |
| Performance degradation | Compare query plans pre/post; may need index analysis |
| Data appears missing | Verify row counts; check `migration_audit` for 002 revocations |
| FTS5 search broken | Verify triggers exist; test insert/select on memory_entries |

### 7.3 Escalation Contacts

- **Database Issues**: Founder (schema authority)
- **Application Errors**: Phase 1-5 implementation team
- **Data Loss**: Immediate rollback + backup restoration

---

## 8. Execution Checklist

### Pre-Execution

- [ ] Founder written authorization obtained
- [ ] `PHASE6_FOUNDER_AUTHORIZATION_PACKAGE.md` reviewed
- [ ] Pre-migration backup created and verified
- [ ] Migration verification tests passing (16/16)
- [ ] Phase 1-5 test suite passing (122/122)
- [ ] Maintenance window scheduled / writes prevented
- [ ] Rollback procedure reviewed and tested (dry-run on copy)

### During Execution (Per Migration)

- [ ] Per-migration backup created
- [ ] Pre-migration schema/state documented
- [ ] Migration SQL executed
- [ ] Post-migration verification queries run
- [ ] `PRAGMA foreign_key_check` → clean
- [ ] Results logged with timestamp

### Post-Execution

- [ ] Full verification test suite passing (16/16)
- [ ] Phase 1-5 regression test suite passing (122/122)
- [ ] Post-migration schema dump saved
- [ ] Application smoke tests passing
- [ ] Documentation updated (schema version, migration log)
- [ ] Backup retention policy applied (keep pre-migration for 30 days)

---

## 9. Migration Ledger (Post-Execution Record)

After successful execution, record in `migration_ledger` table (created by application):

| migration_id | filename | checksum | applied_at | applied_by |
|--------------|----------|----------|------------|------------|
| 001 | 001_staff_agents_default_inactive.sql | SHA256 | timestamp | runner |
| 002 | 002_cross_division_shares_founder_only.sql | SHA256 | timestamp | runner |
| 003 | 003_tasks_add_columns.sql | SHA256 | timestamp | runner |
| 004 | 004_deliverables_add_columns.sql | SHA256 | timestamp | runner |
| 005 | 005_cross_division_shares_stage7.sql | SHA256 | timestamp | runner |

**Checksum Verification:**
```bash
# Compute checksums for audit trail
for f in migrations/*.sql; do
  sha256sum "$f"
done
```

---

## 10. Appendix: Migration File Reference

### 10.1 File Sizes and Types

| File | Size | Type | Tables Affected |
|------|------|------|-----------------|
| 001_staff_agents_default_inactive.sql | 1.2 KB | Table Rebuild | staff_agents, division_members (FK) |
| 002_cross_division_shares_founder_only.sql | 2.1 KB | Table Rebuild | cross_division_shares, migration_audit (new) |
| 003_tasks_add_columns.sql | 0.6 KB | ALTER TABLE | tasks |
| 004_deliverables_add_columns.sql | 0.7 KB | ALTER TABLE | deliverables |
| 005_cross_division_shares_stage7.sql | 1.1 KB | ALTER TABLE | cross_division_shares |

### 10.2 Key Schema Changes Summary

| Table | Change | Migration |
|-------|--------|-----------|
| staff_agents | status DEFAULT 'active' → 'inactive' | 001 |
| staff_agents | Indexes recreated (division, status) | 001 |
| cross_division_shares | granted_by_type CHECK ('division','founder') → ('founder') | 002 |
| cross_division_shares | Legacy division grants revoked, logged | 002 |
| migration_audit | New table created | 002 |
| tasks | dependencies (JSON, default '[]') added | 003 |
| tasks | deliverable_id (TEXT, nullable) added | 003 |
| deliverables | file_references (JSON, default '[]') added | 004 |
| deliverables | task_relationships (JSON, default '[]') added | 004 |
| deliverables | audit_log (JSON, default '[]') added | 004 |
| cross_division_shares | request_type (CHECK enum) added | 005 |
| cross_division_shares | status (CHECK enum, default 'pending') added | 005 |
| cross_division_shares | justification (TEXT) added | 005 |
| cross_division_shares | priority (CHECK enum, default 'medium') added | 005 |
| cross_division_shares | deadline (TEXT) added | 005 |
| cross_division_shares | approved_by_type, approved_by_id, approved_at added | 005 |

---

**End of Runbook**

*This document must be reviewed and approved by Founder before any production execution.*
*All migrations tested against temporary databases only. Production database `data/council.db` remains at Phase 4 schema.*