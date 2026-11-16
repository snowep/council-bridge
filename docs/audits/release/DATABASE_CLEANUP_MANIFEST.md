# Database Cleanup Manifest — Council Bridge M1

**Generated:** 2026-11-16  
**Database:** `data/council.db` (schema v5.0.0)  
**Current State**: 5,427 divisions, 6,925 staff_agents, 5,529 division_members, 155 quality_thresholds, 147 task_autonomy_levels, 160 agents, 938 staff_runtime_personas  
**Target State**: 6 divisions, 51 staff_agents, 51 division_members, 1 quality_thresholds, 3 task_autonomy_levels, ~11 agents, 102 staff_runtime_personas  

**⚠️ FOUNDER APPROVAL REQUIRED** — Do not execute any DELETE statements without explicit Founder written approval. This manifest proposes exact retention/deletion categories for review.

---

## 📋 KEEP — Canonical & Operational Data (62 identities + system tables)

| Table | Records | Rationale |
|-------|---------|-----------|
| `council_seats` | 11 | Governance foundation — 4 permanent + 7 vacant |
| `personas` | 4 | Constitution-required founding members |
| `runtime_personas` | 8 | Dual-runtime operation (4 personas × 2) |
| `divisions` | 6 | Canonical: developer, marketing, finance, creative, research-intelligence, business-operations |
| `staff_agents` | 51 | 6 heads + 45 specialists |
| `division_members` | 51 | Canonical membership (1 per staff agent) |
| `constitutions` | 1 | Active governance document (v1.0.0) |
| `schema_version` | 4 | Version history |
| `migration_ledger` | 9 | Migration audit trail |
| `founder_nonces` | 4 | Security audit trail |

---

## 🗑️ REMOVE — Verified Disposable Test Data

| Table | Records to Remove | Pattern / Criteria |
|-------|-------------------|---------------------|
| `divisions` | ~5,421 | All divisions NOT in canonical 6: `division_id NOT IN ('developer','marketing','finance','creative','research-intelligence','business-operations')` |
| `staff_agents` | ~6,874 | All staff NOT in canonical 51: `staff_id NOT IN (/* full list of 51 canonical IDs */)` |
| `division_members` | ~5,478 | All members with test division_ids: `division_id IN (test division_ids)` |
| `quality_thresholds` | 154 | All except 1 global: `division_id NOT IN ('developer','marketing','finance','creative','research-intelligence','business-operations','global') OR task_type LIKE 'research-%'` |
| `task_autonomy_levels` | 144 | All research auto-generated: `task_type LIKE 'research-%'` |
| `agents` | ~149 | All non-canonical: `agent_id LIKE 'new-agent-%' OR agent_id LIKE 'test-agent-%' OR agent_id IN ('a1','a2','sender','recipient','agent-1','staff-001','div-001','other-agent')` |
| `staff_runtime_personas` | 836 | All non-canonical staff mappings: `staff_id NOT IN (/* canonical 51 staff_ids */)` |

---

## 📦 ARCHIVE — Historical Data (Move to Audit Tables)

| Table | Records | Destination | Action |
|-------|---------|-------------|--------|
| `memory_entries` | 2,447 | `memory_entries_archive` | Archive before truncation |
| `memory_versions` | 78 | `memory_versions_archive` | Archive before truncation |
| `memory_access` | 78 | `memory_access_archive` | Archive before truncation |
| `deliverables` | 141 | `deliverables_archive` | Archive before truncation |
| `messages` | 391 | `messages_archive` | Archive before truncation |
| `execution_history` | 17 | `execution_history_archive` | Archive before truncation |
| `execution_requests` | 15 | `execution_requests_archive` | Archive before truncation |

---

## 🔍 INVESTIGATE — Requires Founder Input

| Table | Records | Issue | Decision Needed |
|-------|---------|-------|-----------------|
| `tasks` | 3 | Assigned to `founder` (not in staff_agents) | Reassign to valid staff, change type, or delete — Founder must decide |
| `divisions` | 8 | Mismatched division_id/name pairs — likely test artifacts | Investigate individually — some may need removal, others preservation |

---

## 📅 Proposed Execution Order

### Phase 1: Backup & Verification (No Data Loss Risk)
1. Create timestamped backup: `.backup 'data/backups/council_pre_cleanup_$(date +%F_%H-%M-%S).db'`
2. Verify canonical counts before cleanup (see baseline report)
3. Record current database checksum

### Phase 2: Remove Test Data (Idempotent DELETE Statements)
1. **2a**: Remove test divisions (cascades to division_members via FK)
   ```sql
   DELETE FROM divisions
   WHERE division_id NOT IN ('developer','marketing','finance','creative','research-intelligence','business-operations');
   ```
2. **2b**: Remove test staff agents
   ```sql
   DELETE FROM staff_agents
   WHERE staff_id NOT IN (/* canonical 51 staff_ids */);
   ```
3. **2c**: Remove test quality thresholds
   ```sql
   DELETE FROM quality_thresholds
   WHERE division_id NOT IN ('developer','marketing','finance','creative','research-intelligence','business-operations', 'global')
      OR task_type LIKE 'research-%';
   ```
4. **2d**: Remove test task autonomy levels
   ```sql
   DELETE FROM task_autonomy_levels
   WHERE task_type LIKE 'research-%';
   ```
5. **2e**: Remove test agents
   ```sql
   DELETE FROM agents
   WHERE agent_id LIKE 'new-agent-%'
      OR agent_id LIKE 'test-agent-%'
      OR agent_id IN ('a1','a2','sender','recipient','agent-1','staff-001','div-001','other-agent');
   ```
6. **2f**: Remove test staff runtime personas
   ```sql
   DELETE FROM staff_runtime_personas
   WHERE staff_id NOT IN (/* canonical 51 staff_ids */);
   ```

### Phase 3: Fix Data Integrity Issues
1. **3a**: Fix 3 orphaned tasks assigned to 'founder'
   - Option A: Reassign to a valid staff member (requires Founder decision on which)
   - Option B: Change assigned_to_type to 'founder' (if model supports it)
   - Option C: Delete if truly orphaned (requires Founder decision)
2. **3b**: Fix 8 mismatched division IDs (investigate individually after Phase 2)
3. **3c**: Add FK constraints after cleanup
   ```sql
   ALTER TABLE tasks ADD CONSTRAINT fk_tasks_staff
       FOREIGN KEY (assigned_to_id) REFERENCES staff_agents(staff_id);
   ALTER TABLE tasks ADD CONSTRAINT fk_tasks_division
       FOREIGN KEY (assigned_to_id) REFERENCES divisions(division_id);
   ```

### Phase 4: Archive Historical Data (Optional — Can Defer)
1. Create archive tables with same schema
2. Optionally truncate active tables if not needed for operations

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

-- Integrity checks
PRAGMA integrity_check;
PRAGMA foreign_key_check;
```

---

## ⚠️ Critical Constraints

1. **Do not classify ambiguous records as REMOVE** — classify as INVESTIGATE instead
2. **Preserve canonical organization**: 11 council seats, 4 founding personas, 6 divisions, 51 staff
3. **Do not delete production records** without Founder approval
4. **Run integrity checks after cleanup**: `PRAGMA integrity_check; PRAGMA foreign_key_check;`
5. **Provide rollback/recovery procedure** — backup before any destructive operation

---

## 👤 Founder Approval Required

This manifest must be reviewed and explicitly approved by the Founder before any DELETE or ARCHIVE operations are executed. Please review the following:

1. ✅ KEEP category — canonical data preservation
2. ✅ REMOVE category — verified test data removal candidates
3. ✅ ARCHIVE category — historical data archival
4. ✅ INVESTIGATE category — tasks assigned to founder (3 records), mismatched divisions (8 records)
5. ✅ Execution order — Phase 1 through Phase 5
6. ✅ Backup and verification procedures
7. ✅ Rollback/recovery procedure

**Please approve or request modifications before proceeding.**

---

**Manifest generated:** 2026-11-16  
**Database:** `data/council.db`  
**Founder approval required:** Yes — before any destructive operations  
**Next step**: Founder review → Idempotent cleanup migration (015_cleanup_test_data.sql)