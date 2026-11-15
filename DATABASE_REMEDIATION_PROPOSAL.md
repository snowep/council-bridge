# Database Remediation Proposal

**Repository:** `C:\Projects\council-bridge`
**Proposal Date:** 2026-11-15
**Related:** `DATABASE_FINDINGS_INVESTIGATION.md`, `DATABASE_TEST_ISOLATION_AUDIT.md`
**Authorization:** **Required** — No production changes without explicit Founder approval

---

## Executive Summary

This proposal outlines the remediation actions needed to address the nine database audit findings. All actions are proposed only; **no production database modifications will be made without explicit authorization.**

---

## Remediation Actions by Finding

### F-01: Migration 014 Not Applied

| Action | Type | Risk | Prerequisites |
|--------|------|------|---------------|
| Apply Migration 014 | Schema change | Low | Production backup verified, migration runner tested |
| Add `draft` to CHECK constraint | Schema change | Low | Migration 014 is idempotent table rebuild |
| Record in migration_ledger | Metadata | None | SHA256 checksum computed |
| Update schema_version to 5.0.1 | Metadata | None | Migration recorded |

**Proposed Migration Execution:**
```bash
# 1. Verify target
sqlite3 data/council.db ".backup /tmp/council_pre_014_backup.db"

# 2. Run migration
sqlite3 data/council.db < migrations/014_fix_deliverables_check_constraint.sql

# 3. Verify
sqlite3 data/council.db "PRAGMA table_info(deliverables);" | grep draft

# 4. Record (via migration runner)
# migration-runner apply 014
```

**Rollback:** Restore from backup `/tmp/council_pre_014_backup.db`

---

### F-02: Test/Fixture Data Contamination

| Action | Type | Risk | Prerequisites |
|--------|------|------|---------------|
| Fix database path bug | Code fix | Low | Tested in isolation |
| Create test-database.ts | Code fix | Low | New file only |
| Add Vitest setup/teardown | Code fix | Low | Config changes |
| Add test ID prefixing | Code fix | Low | Test utilities |
| Quarantine test data | Data operation | **High** | Classification verified, Founder approval |
| Delete quarantined test data | Data deletion | **Critical** | Quarantine verified, Founder approval |

**Quarantine Procedure (Non-Destructive First Step):**
```sql
-- Create quarantine tables
CREATE TABLE quarantine_divisions AS SELECT * FROM divisions WHERE 1=0;
CREATE TABLE quarantine_staff_agents AS SELECT * FROM staff_agents WHERE 1=0;
CREATE TABLE quarantine_division_members AS SELECT * FROM division_members WHERE 1=0;
CREATE TABLE quarantine_staff_runtime_personas AS SELECT * FROM staff_runtime_personas WHERE 1=0;
CREATE TABLE quarantine_quality_thresholds AS SELECT * FROM quality_thresholds WHERE 1=0;
CREATE TABLE quarantine_task_autonomy_levels AS SELECT * FROM task_autonomy_levels WHERE 1=0;
CREATE TABLE quarantine_tasks AS SELECT * FROM tasks WHERE 1=0;
CREATE TABLE quarantine_messages AS SELECT * FROM messages WHERE 1=0;
CREATE TABLE quarantine_memory_entries AS SELECT * FROM memory_entries WHERE 1=0;

-- Classify test divisions
INSERT INTO quarantine_divisions SELECT * FROM divisions
WHERE division_id LIKE 'test-%'
   OR division_id GLOB '*-*-*-*-*'
   OR name LIKE 'Test %'
   OR name LIKE 'Developer-%'
   OR name LIKE 'Marketing-%'
   OR name LIKE 'Finance-%'
   OR name LIKE 'Creative-%'
   OR name LIKE 'Research-%'
   OR name LIKE 'Business Operations-%';

-- Classify test staff
INSERT INTO quarantine_staff_agents SELECT * FROM staff_agents
WHERE staff_id LIKE 'test-%'
   OR staff_id = 'staff-head'
   OR staff_id GLOB 'staff-*-*-*-*-*';

-- Classify test memberships
INSERT INTO quarantine_division_members SELECT * FROM division_members
WHERE division_id IN (SELECT division_id FROM quarantine_divisions)
   OR staff_id IN (SELECT staff_id FROM quarantine_staff_agents)
   OR role GLOB '202*-*-*T*:*:*.*Z';

-- Classify test runtime personas
INSERT INTO quarantine_staff_runtime_personas SELECT * FROM staff_runtime_personas
WHERE staff_id IN (SELECT staff_id FROM quarantine_staff_agents);

-- Classify test quality thresholds
INSERT INTO quarantine_quality_thresholds SELECT * FROM quality_thresholds
WHERE division_id IN (SELECT division_id FROM quarantine_divisions);

-- Classify test task autonomy levels (by task_type pattern)
INSERT INTO quarantine_task_autonomy_levels SELECT * FROM task_autonomy_levels
WHERE task_type LIKE 'test-%' OR task_type LIKE 'Test %';

-- Classify test tasks
INSERT INTO quarantine_tasks SELECT * FROM tasks
WHERE title = 'Test task'
   OR assigned_to_id IN (SELECT staff_id FROM quarantine_staff_agents)
   OR assigned_to_id = 'founder';

-- Classify test messages
INSERT INTO quarantine_messages SELECT * FROM messages
WHERE sender_id IN (SELECT staff_id FROM quarantine_staff_agents)
   OR recipient_id IN (SELECT staff_id FROM quarantine_staff_agents)
   OR sender_id = 'founder'
   OR recipient_id = 'founder';

-- Classify test memory entries
INSERT INTO quarantine_memory_entries SELECT * FROM memory_entries
WHERE owner_id IN (SELECT staff_id FROM quarantine_staff_agents)
   OR owner_id IN (SELECT division_id FROM quarantine_divisions)
   OR division_id IN (SELECT division_id FROM quarantine_divisions);
```

**Deletion (Only After Quarantine Verification):**
```sql
-- Verify quarantine counts match expected
SELECT 'divisions' AS table_name, COUNT(*) FROM quarantine_divisions
UNION ALL SELECT 'staff_agents', COUNT(*) FROM quarantine_staff_agents
UNION ALL SELECT 'division_members', COUNT(*) FROM quarantine_division_members
UNION ALL SELECT 'staff_runtime_personas', COUNT(*) FROM quarantine_staff_runtime_personas
UNION ALL SELECT 'quality_thresholds', COUNT(*) FROM quarantine_quality_thresholds
UNION ALL SELECT 'task_autonomy_levels', COUNT(*) FROM quarantine_task_autonomy_levels
UNION ALL SELECT 'tasks', COUNT(*) FROM quarantine_tasks
UNION ALL SELECT 'messages', COUNT(*) FROM quarantine_messages
UNION ALL SELECT 'memory_entries', COUNT(*) FROM quarantine_memory_entries;

-- If verified, delete from production tables
DELETE FROM divisions WHERE division_id IN (SELECT division_id FROM quarantine_divisions);
DELETE FROM staff_agents WHERE staff_id IN (SELECT staff_id FROM quarantine_staff_agents);
DELETE FROM division_members WHERE division_id IN (SELECT division_id FROM quarantine_divisions)
   OR staff_id IN (SELECT staff_id FROM quarantine_staff_agents)
   OR role GLOB '202*-*-*T*:*:*.*Z';
DELETE FROM staff_runtime_personas WHERE staff_id IN (SELECT staff_id FROM quarantine_staff_agents);
DELETE FROM quality_thresholds WHERE division_id IN (SELECT division_id FROM quarantine_divisions);
DELETE FROM task_autonomy_levels WHERE task_type IN (SELECT task_type FROM quarantine_task_autonomy_levels);
DELETE FROM tasks WHERE task_id IN (SELECT task_id FROM quarantine_tasks);
DELETE FROM messages WHERE access_id IN (SELECT access_id FROM quarantine_messages);
DELETE FROM memory_entries WHERE memory_id IN (SELECT memory_id FROM quarantine_memory_entries);
```

---

### F-03: Invalid division_members.role Values

| Action | Type | Risk | Prerequisites |
|--------|------|------|---------------|
| Add Zod validation schema | Code fix | Low | New validation layer |
| Fix argument ordering in insertDivisionMember | Code fix | Low | Verify all call sites |
| Add CHECK constraint (migration) | Schema change | Medium | Migration 015 proposed |
| Quarantine invalid rows | Data operation | **High** | Part of F-02 quarantine |

**Proposed Migration 015:**
```sql
-- Migration 015: Add CHECK constraint to division_members.role
-- Dependencies: F-02 quarantine complete, F-03 code fix deployed

PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE TRANSACTION;

CREATE TABLE division_members_new (
  division_id    TEXT NOT NULL,
  staff_id       TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('head', 'member', 'specialist')),
  joined_at      TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (division_id, staff_id),
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES staff_agents(staff_id) ON DELETE CASCADE
);

INSERT INTO division_members_new (division_id, staff_id, role, joined_at)
SELECT division_id, staff_id,
  CASE
    WHEN role IN ('head', 'member', 'specialist') THEN role
    ELSE 'member'
  END,
  joined_at
FROM division_members;

DROP TABLE division_members;
ALTER TABLE division_members_new RENAME TO division_members;

COMMIT;
PRAGMA foreign_keys = ON;
```

---

### F-04: Dangling References

| Action | Type | Risk | Prerequisites |
|--------|------|------|---------------|
| Add validation in divisions service | Code fix | Low | Service layer update |
| Add validation in tasks service | Code fix | Low | Service layer update |
| Add FK or trigger for head_staff_id | Schema change | Medium | Migration proposed |
| Quarantine invalid divisions | Data operation | **High** | Part of F-02 quarantine |
| Fix 3 invalid tasks | Data operation | Low | Direct update |

**Proposed Fixes:**
1. **Divisions service** (`src/council/divisions.ts`):
   ```typescript
   // Before insert/update division
   if (head_staff_id) {
     const staff = getStaffAgentById(db, head_staff_id);
     if (!staff) throw new Error(`Invalid head_staff_id: ${head_staff_id}`);
     if (staff.division_id !== division_id) throw new Error('Head must belong to division');
   }
   ```

2. **Tasks service** (`src/council/operations.ts`):
   ```typescript
   // Before insert/update task
   if (assigned_to_type === 'staff') {
     const staff = getStaffAgentById(db, assigned_to_id);
     if (!staff) throw new Error(`Invalid staff assignee: ${assigned_to_id}`);
   }
   ```

3. **Fix 3 invalid tasks:**
   ```sql
   UPDATE tasks SET assigned_to_type = 'division', assigned_to_id = 'engineering'
   WHERE task_id IN ('c7ed5272-fbe5-4c75-b768-119ae9106393',
                     '6af6e71e-a872-40a9-8485-4528749c0e33',
                     'a63325c1-76d5-43fb-a2f4-2a4375160208');
   ```

---

### F-05: Quality Threshold Discrepancy

| Action | Type | Risk | Prerequisites |
|--------|------|------|---------------|
| Confirm intent with Founder | Decision | None | Founder response |
| If intentional: document | Documentation | None | Founder confirmation |
| If unintentional: revert to 70/1 | Data fix | Low | Founder approval |

**No action without Founder confirmation.**

---

### F-06: Deliverable Workflow History Missing

| Action | Type | Risk | Prerequisites |
|--------|------|------|---------------|
| Add version creation on submit | Code fix | Low | Service update |
| Add audit_log entries | Code fix | Low | Service update |
| Add reviewer assignment recording | Code fix | Low | Service update |
| Add approval/rejection persistence | Code fix | Low | Service update |
| Backfill historical data | Data operation | **High** | Not recommended |

**Code Changes in `src/council/deliverables.ts`:**
```typescript
// submitDeliverable
async function submitDeliverable(input: SubmitDeliverableInput) {
  const deliverable = createDeliverable(db, { ...input, status: 'submitted' });
  await createDeliverableVersion(db, deliverable.deliverable_id, 1, input.content);
  await appendAuditLog(db, deliverable.deliverable_id, 'submitted', ctx);
  return deliverable;
}

// reviewDeliverable
async function reviewDeliverable(input: ReviewDeliverableInput) {
  const deliverable = updateDeliverable(db, {
    deliverable_id: input.deliverable_id,
    reviewer_type: ctx.owner_type,
    reviewer_id: ctx.owner_id,
    reviewed_at: new Date().toISOString(),
    status: 'reviewed'
  });
  await appendAuditLog(db, input.deliverable_id, 'reviewed', { reviewer: ctx });
  return deliverable;
}

// approveDeliverable
async function approveDeliverable(input: ApproveDeliverableInput) {
  const deliverable = updateDeliverable(db, {
    deliverable_id: input.deliverable_id,
    status: 'accepted',
    approved_by_type: ctx.owner_type,
    approved_by_id: ctx.owner_id,
    approved_at: new Date().toISOString(),
    founder_signature: input.founder_signature,
    founder_signed_at: input.founder_signed_at
  });
  await appendAuditLog(db, input.deliverable_id, 'approved', { approver: ctx });
  return deliverable;
}
```

---

### F-07: Empty Task Audit

| Action | Type | Risk | Prerequisites |
|--------|------|------|---------------|
| Add audit writes to createTask | Code fix | Low | Service update |
| Add audit writes to updateTask | Code fix | Low | Service update |
| Add audit writes to assign/delegate | Code fix | Low | Service update |
| Add audit writes to status changes | Code fix | Low | Service update |
| Add audit writes to cancel/complete | Code fix | Low | Service update |

**Code Changes in `src/council/operations.ts`:**
```typescript
// Wrap each mutation with audit write
async function createTask(input: CreateTaskInput, ctx: AuthContext) {
  const task = insertTask(db, input);
  await insertTaskAudit(db, {
    audit_id: generateId(),
    task_id: task.task_id,
    mutation_type: 'create',
    details: JSON.stringify(input),
    actor_type: ctx.owner_type,
    actor_id: ctx.owner_id,
    runtime: ctx.runtime,
    created_at: new Date().toISOString()
  });
  return task;
}

async function updateTask(input: UpdateTaskInput, ctx: AuthContext) {
  const oldTask = getTaskById(db, input.task_id);
  const task = updateTask(db, input);
  await insertTaskAudit(db, {
    audit_id: generateId(),
    task_id: task.task_id,
    mutation_type: 'update',
    details: JSON.stringify({ before: oldTask, after: task }),
    actor_type: ctx.owner_type,
    actor_id: ctx.owner_id,
    runtime: ctx.runtime,
    created_at: new Date().toISOString()
  });
  return task;
}

// Similar for: assignTask, updateTaskStatus, cancelTask, completeTask
```

---

### F-08: No Level 2/3 Approval Evidence

| Action | Type | Risk | Prerequisites |
|--------|------|------|---------------|
| Verify Level 2/3 code paths | Verification | None | Test with isolated DB |
| Add integration test for Level 2 | Test | Low | Test database |
| Add integration test for Level 3 | Test | Low | Test database |
| Document workflow in README | Documentation | None | N/A |

**No production changes needed.** Feature exists; needs testing and documentation.

---

### F-09: Empty Operational Tables

| Action | Type | Risk | Prerequisites |
|--------|------|------|---------------|
| Verify meetings workflow | Verification | None | Test with isolated DB |
| Verify evaluations workflow | Verification | None | Test with isolated DB |
| Verify formation workflow | Verification | None | Test with isolated DB |
| Verify memory_links workflow | Verification | None | Test with isolated DB |
| Document which are truly unused | Documentation | None | N/A |

**No production changes needed.** Empty state is expected for unused workflows.

---

## Remediation Priority Order

| Phase | Actions | Authorization |
|-------|---------|---------------|
| **1. Code Fixes (No DB Changes)** | F-01 code review, F-02 test isolation fixes, F-03 validation, F-04 service validation, F-06 deliverable service, F-07 task audit service, F-08/F-09 verification | **Can proceed** — source code only |
| **2. Schema Migrations** | F-01 Migration 014, F-03 Migration 015 (CHECK constraint) | **Requires Founder approval** |
| **3. Data Quarantine** | F-02 quarantine procedure, F-03 invalid roles quarantine, F-04 dangling refs quarantine | **Requires Founder approval** |
| **4. Data Cleanup** | F-02 delete quarantined test data, F-04 fix 3 tasks | **Requires Founder approval** |
| **5. Configuration** | F-05 threshold decision (Founder confirmation) | **Requires Founder decision** |

---

## Safety Checklist

Before any production database operation:

- [ ] Production backup created and verified
- [ ] Migration tested against audit database copy
- [ ] Rollback procedure documented and tested
- [ ] Founder explicit written approval obtained
- [ ] Operation scheduled during maintenance window
- [ ] Monitoring/alerting configured for migration
- [ ] Post-migration verification queries prepared

---

## Estimated Effort

| Category | Files | Est. Hours |
|----------|-------|------------|
| Code fixes (Phase 1) | ~15 files | 16-24 |
| Migrations (Phase 2) | 2 migrations | 4-6 |
| Data quarantine (Phase 3) | SQL scripts | 4-8 |
| Data cleanup (Phase 4) | SQL scripts | 2-4 |
| Testing/Verification | Test files | 8-12 |
| **Total** | | **34-54 hours** |

---

**This proposal does not authorize any production changes.** All actions require explicit Founder approval before execution.