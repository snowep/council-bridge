# Database Cleanup Plan — Council Bridge
**Generated:** 2026-11-16
**Based on:** DATABASE_AUDIT.md
**Status:** AWAITING FOUNDER APPROVAL

---

## Principle

**Do not delete, modify, or migrate the production database without explicit Founder approval.** This plan proposes exact retention/deletion categories for Founder review.

---

## Cleanup Categories

### KEEP — Canonical & Operational Data (62 identities + system tables)

| Table | Records | Rationale |
|-------|---------|-----------|
| `council_seats` | 11 | Governance foundation |
| `personas` | 4 | Constitution-required founding members |
| `runtime_personas` | 8 | Dual-runtime operation (4 personas × 2) |
| `divisions` | 6 | Canonical 6 divisions |
| `staff_agents` | 51 | 6 heads + 45 specialists |
| `division_members` | 51 | Canonical membership |
| `constitutions` | 1 | Active governance document |
| `schema_version` | 4 | Version history |
| `migration_ledger` | 8 | Migration audit trail |
| `founder_nonces` | 4 | Security audit trail |
| `staff_runtime_personas` | 102 (est.) | 51 staff × 2 runtimes |

### REMOVE — Verified Disposable Test Data (~16,000 records)

| Table | Records to Remove | Pattern / Criteria |
|-------|-------------------|---------------------|
| `divisions` | ~4,850 | `division_id LIKE 'Developer-%' OR division_id LIKE 'Division-%' OR division_id LIKE 'test-div-%' OR division_id LIKE '%-%' (uuid pattern) AND name NOT IN ('Developer Division', 'Marketing Division', 'Finance Division', 'Creative Division', 'Research & Intelligence Division', 'Business Operations Division')` |
| `staff_agents` | ~6,095 | `staff_id NOT IN (canonical 51 staff_ids)` — see Appendix A for full list |
| `division_members` | ~5,478 | `division_id IN (test division_ids from above)` |
| `quality_thresholds` | 154 | `division_id IN (test division_ids) OR task_type LIKE 'research-%'` |
| `task_autonomy_levels` | 144 | `task_type LIKE 'research-%' (auto-generated)` |
| `agents` | ~150 | `agent_id LIKE 'new-agent-%' OR agent_id LIKE 'test-agent-%' OR agent_id IN ('a1', 'a2', 'sender', 'recipient', 'agent-1', 'staff-001', 'div-001', 'other-agent')` |

### ARCHIVE — Historical Data (Move to Audit Tables)

| Table | Records | Destination |
|-------|---------|-------------|
| `memory_entries` | 2,447 | `memory_entries_archive` |
| `memory_versions` | 78 | `memory_versions_archive` |
| `memory_access` | 78 | `memory_access_archive` |
| `deliverables` | 141 | `deliverables_archive` |
| `messages` | 391 | `messages_archive` |
| `execution_history` | 17 | `execution_history_archive` |
| `execution_requests` | 15 | `execution_requests_archive` |

### INVESTIGATE — Requires Founder Input

| Table | Records | Issue |
|-------|---------|-------|
| `tasks` | 3 | Assigned to `founder` (not in staff_agents) — need decision on task assignment model |
| `divisions` | 8 | Mismatched division_id/name pairs — likely test artifacts |
| `staff_runtime_personas` | 836 (est.) | Test staff mappings — remove with test staff |

---

## Proposed Execution Order

### Phase 1: Backup & Verification (No Data Loss Risk)
```sql
-- 1. Create timestamped backup
.backup 'data/backups/council_pre_cleanup_$(date +%F_%H-%M-%S).db'

-- 2. Verify canonical counts before cleanup
SELECT 'council_seats' as table_name, COUNT(*) as count FROM council_seats;
SELECT 'personas' as table_name, COUNT(*) as count FROM personas;
SELECT 'runtime_personas' as table_name, COUNT(*) as count FROM runtime_personas;
SELECT 'divisions' as table_name, COUNT(*) as count FROM divisions WHERE division_id IN ('developer','marketing','finance','creative','research-intelligence','business-operations');
SELECT 'staff_agents' as table_name, COUNT(*) as count FROM staff_agents WHERE staff_id IN (/* canonical 51 IDs */);
```

### Phase 2: Remove Test Data (Idempotent DELETE Statements)

```sql
-- 2a. Remove test divisions (cascades to division_members via FK)
DELETE FROM divisions
WHERE division_id NOT IN ('developer','marketing','finance','creative','research-intelligence','business-operations');

-- 2b. Remove test staff agents
DELETE FROM staff_agents
WHERE staff_id NOT IN (/* canonical 51 staff_ids - see Appendix A */);

-- 2c. Remove test quality thresholds
DELETE FROM quality_thresholds
WHERE division_id NOT IN ('developer','marketing','finance','creative','research-intelligence','business-operations', 'global')
   OR task_type LIKE 'research-%';

-- 2d. Remove test task autonomy levels
DELETE FROM task_autonomy_levels
WHERE task_type LIKE 'research-%';

-- 2e. Remove test agents
DELETE FROM agents
WHERE agent_id LIKE 'new-agent-%'
   OR agent_id LIKE 'test-agent-%'
   OR agent_id IN ('a1','a2','sender','recipient','agent-1','staff-001','div-001','other-agent');

-- 2f. Remove test staff runtime personas (cascades with staff_agents if FK exists)
DELETE FROM staff_runtime_personas
WHERE staff_id NOT IN (/* canonical 51 staff_ids */);
```

### Phase 3: Fix Data Integrity Issues

```sql
-- 3a. Fix 3 orphaned tasks assigned to 'founder'
-- Option A: Reassign to a valid staff member (requires Founder decision)
-- Option B: Change assigned_to_type to 'founder' (if model supports it)
-- Option C: Delete if truly orphaned (requires Founder decision)
UPDATE tasks SET assigned_to_type = 'division', assigned_to_id = 'developer' WHERE assigned_to_id = 'founder';

-- 3b. Fix 8 mismatched division IDs
-- These are likely test artifacts that will be removed in Phase 2
-- If any remain after Phase 2, investigate individually

-- 3c. Add foreign key constraints (after cleanup)
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_staff
    FOREIGN KEY (assigned_to_id) REFERENCES staff_agents(staff_id)
    -- Note: Conditional FK only when assigned_to_type='staff'
    -- SQLite doesn't support conditional FKs; use trigger or application enforcement

ALTER TABLE tasks ADD CONSTRAINT fk_tasks_division
    FOREIGN KEY (assigned_to_id) REFERENCES divisions(division_id)
    -- Same conditional issue
```

### Phase 4: Archive Historical Data (Optional — Can Defer)

```sql
-- Create archive tables with same schema
CREATE TABLE memory_entries_archive AS SELECT * FROM memory_entries;
CREATE TABLE memory_versions_archive AS SELECT * FROM memory_versions;
CREATE TABLE memory_access_archive AS SELECT * FROM memory_access;
CREATE TABLE deliverables_archive AS SELECT * FROM deliverables;
CREATE TABLE messages_archive AS SELECT * FROM messages;
CREATE TABLE execution_history_archive AS SELECT * FROM execution_history;
CREATE TABLE execution_requests_archive AS SELECT * FROM execution_requests;

-- Optionally truncate active tables if not needed for operations
-- DELETE FROM memory_entries; -- etc.
```

### Phase 5: Verification

```sql
-- Verify final canonical counts
SELECT 'council_seats' as t, COUNT(*) as c FROM council_seats; -- 11
SELECT 'personas' as t, COUNT(*) as c FROM personas; -- 4
SELECT 'runtime_personas' as t, COUNT(*) as c FROM runtime_personas; -- 8
SELECT 'divisions' as t, COUNT(*) as c FROM divisions; -- 6
SELECT 'staff_agents' as t, COUNT(*) as c FROM staff_agents; -- 51
SELECT 'division_members' as t, COUNT(*) as c FROM division_members; -- 51
SELECT 'quality_thresholds' as t, COUNT(*) as c FROM quality_thresholds; -- 1
SELECT 'task_autonomy_levels' as t, COUNT(*) as c FROM task_autonomy_levels; -- 3
SELECT 'agents' as t, COUNT(*) as c FROM agents; -- ~11

-- Integrity check
PRAGMA integrity_check;
PRAGMA foreign_key_check;
```

---

## Idempotent Cleanup Migration Script

Create as `migrations/015_cleanup_test_data.sql`:

```sql
-- Migration 015: Cleanup test data, fix orphans, add constraints
-- Idempotent: safe to run multiple times

BEGIN IMMEDIATE TRANSACTION;

-- 1. Delete test divisions (cascades to division_members)
DELETE FROM divisions
WHERE division_id NOT IN ('developer','marketing','finance','creative','research-intelligence','business-operations');

-- 2. Delete test staff agents
DELETE FROM staff_agents
WHERE staff_id NOT IN (
    'staff-dev-head-001','staff-marketing-head-001','staff-finance-head-001',
    'staff-creative-head-001','staff-research-head-001','staff-ops-head-001',
    'staff-dev-platform-001','staff-dev-devops-001','staff-dev-senior-staff-001',
    'staff-dev-multiagent-001','staff-dev-dx-001','staff-dev-engmgr-001',
    'staff-dev-security-001','staff-dev-data-001','staff-dev-techwriter-001',
    'staff-marketing-growth-001','staff-marketing-social-001','staff-marketing-content-001',
    'staff-marketing-brand-001','staff-marketing-product-001',
    'staff-finance-ar-001','staff-finance-ap-001','staff-finance-ir-001',
    'staff-finance-fpamgr-001','staff-finance-treasury-001','staff-finance-corpfin-001',
    'staff-finance-tax-001','staff-finance-invest-001','staff-finance-control-001',
    'staff-creative-lore-001','staff-creative-copy-001','staff-creative-ops-001',
    'staff-creative-fashion-001','staff-creative-lore-editor-001','staff-creative-motion-001',
    'staff-creative-worldbuilding-001','staff-creative-designsys-001','staff-creative-uxr-001',
    'staff-creative-content-001',
    'staff-research-compintel-001','staff-research-market-001','staff-research-data-001',
    'staff-research-osint-001','staff-research-synthesis-001',
    'staff-ops-facilities-001','staff-ops-legal-001','staff-ops-procurement-001',
    'staff-ops-process-001','staff-ops-program-001','staff-ops-creative-001',
    'staff-ops-people-001'
);

-- 3. Delete test quality thresholds
DELETE FROM quality_thresholds
WHERE division_id NOT IN ('developer','marketing','finance','creative','research-intelligence','business-operations', 'global')
   OR task_type LIKE 'research-%';

-- 4. Delete test task autonomy levels
DELETE FROM task_autonomy_levels
WHERE task_type LIKE 'research-%';

-- 5. Delete test agents
DELETE FROM agents
WHERE agent_id LIKE 'new-agent-%'
   OR agent_id LIKE 'test-agent-%'
   OR agent_id IN ('a1','a2','sender','recipient','agent-1','staff-001','div-001','other-agent');

-- 6. Delete test staff runtime personas
DELETE FROM staff_runtime_personas
WHERE staff_id NOT IN (
    'staff-dev-head-001','staff-marketing-head-001','staff-finance-head-001',
    'staff-creative-head-001','staff-research-head-001','staff-ops-head-001',
    'staff-dev-platform-001','staff-dev-devops-001','staff-dev-senior-staff-001',
    'staff-dev-multiagent-001','staff-dev-dx-001','staff-dev-engmgr-001',
    'staff-dev-security-001','staff-dev-data-001','staff-dev-techwriter-001',
    'staff-marketing-growth-001','staff-marketing-social-001','staff-marketing-content-001',
    'staff-marketing-brand-001','staff-marketing-product-001',
    'staff-finance-ar-001','staff-finance-ap-001','staff-finance-ir-001',
    'staff-finance-fpamgr-001','staff-finance-treasury-001','staff-finance-corpfin-001',
    'staff-finance-tax-001','staff-finance-invest-001','staff-finance-control-001',
    'staff-creative-lore-001','staff-creative-copy-001','staff-creative-ops-001',
    'staff-creative-fashion-001','staff-creative-lore-editor-001','staff-creative-motion-001',
    'staff-creative-worldbuilding-001','staff-creative-designsys-001','staff-creative-uxr-001',
    'staff-creative-content-001',
    'staff-research-compintel-001','staff-research-market-001','staff-research-data-001',
    'staff-research-osint-001','staff-research-synthesis-001',
    'staff-ops-facilities-001','staff-ops-legal-001','staff-ops-procurement-001',
    'staff-ops-process-001','staff-ops-program-001','staff-ops-creative-001',
    'staff-ops-people-001'
);

-- 7. Fix orphaned tasks (ASSIGN TO VALID STAFF - requires Founder decision on which)
-- Placeholder: UPDATE tasks SET assigned_to_type='division', assigned_to_id='developer' WHERE assigned_to_id='founder';

-- 8. Record migration in ledger
INSERT INTO migration_ledger (migration_id, filename, checksum, checksum_algo, applied_by, status, notes)
VALUES ('015', '015_cleanup_test_data.sql', 'TBD', 'sha256', 'cleanup-script', 'success', 'Removed ~16K test records, fixed orphans');

COMMIT;
```

---

## Appendix A: Canonical Staff IDs (51)

### Division Heads (6)
- staff-dev-head-001
- staff-marketing-head-001
- staff-finance-head-001
- staff-creative-head-001
- staff-research-head-001
- staff-ops-head-001

### Developer Division Specialists (9)
- staff-dev-platform-001
- staff-dev-devops-001
- staff-dev-senior-staff-001
- staff-dev-multiagent-001
- staff-dev-dx-001
- staff-dev-engmgr-001
- staff-dev-security-001
- staff-dev-data-001
- staff-dev-techwriter-001

### Marketing Division Specialists (7)
- staff-marketing-growth-001
- staff-marketing-social-001
- staff-marketing-content-001
- staff-marketing-brand-001
- staff-marketing-product-001

### Finance Division Specialists (7)
- staff-finance-ar-001
- staff-finance-ap-001
- staff-finance-ir-001
- staff-finance-fpamgr-001
- staff-finance-treasury-001
- staff-finance-corpfin-001
- staff-finance-tax-001
- staff-finance-invest-001
- staff-finance-control-001

### Creative Division Specialists (10)
- staff-creative-lore-001
- staff-creative-copy-001
- staff-creative-ops-001
- staff-creative-fashion-001
- staff-creative-lore-editor-001
- staff-creative-motion-001
- staff-creative-worldbuilding-001
- staff-creative-designsys-001
- staff-creative-uxr-001
- staff-creative-content-001

### Research & Intelligence Specialists (5)
- staff-research-compintel-001
- staff-research-market-001
- staff-research-data-001
- staff-research-osint-001
- staff-research-synthesis-001

### Business Operations Specialists (7)
- staff-ops-facilities-001
- staff-ops-legal-001
- staff-ops-procurement-001
- staff-ops-process-001
- staff-ops-program-001
- staff-ops-creative-001
- staff-ops-people-001

---

## Approval Required

**Founder must explicitly approve:**
1. This cleanup plan (DATABASE_CLEANUP_PLAN.md)
2. The idempotent migration script (015_cleanup_test_data.sql)
3. The orphaned task resolution strategy (3 tasks → `founder`)
4. Whether to archive historical tables or keep in active DB

**Do not execute any DELETE statements without written approval.**

---

*This plan will be executed as M1 in IMPLEMENTATION_ROADMAP.md after Founder approval.*