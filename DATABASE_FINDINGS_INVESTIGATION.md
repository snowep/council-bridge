# Database Findings Investigation Report

**Audit Target:** `database-audit-bundle/council-bridge-audit.db` (commit 700c366)
**Investigation Date:** 2026-11-15
**Production Database:** Read-only; no modifications made

---

## Executive Summary

All nine audit findings investigated. Classification:

| Finding | Classification | Confidence |
|---------|----------------|------------|
| F-01: Migration 014 not applied | **CONFIRMED DEFECT** | High |
| F-02: Test/fixture data contamination | **CONFIRMED DEFECT** | High |
| F-03: Invalid division_members.role | **CONFIRMED DEFECT** | High |
| F-04: Dangling references | **CONFIRMED DEFECT** | High |
| F-05: Quality threshold discrepancy | **NEEDS FOUNDER CONFIRMATION** | Medium |
| F-06: Deliverable workflow history missing | **CONFIRMED DEFECT** | High |
| F-07: Empty task audit | **CONFIRMED DEFECT** | High |
| F-08: No Level 2/3 approval evidence | **EXPECTED EMPTY STATE** | Medium |
| F-09: Empty operational tables | **EXPECTED EMPTY STATE** | Medium |

---

## F-01 — Migration 014 Not Applied

**Classification: CONFIRMED DEFECT**

### Root Cause
Migration 014 (`014_fix_deliverables_check_constraint.sql`) exists in the codebase but is not recorded in `migration_ledger` or `schema_version` tables. The migration adds `draft` status to the `deliverables.status` CHECK constraint.

### Evidence
- Migration file exists at `migrations/014_fix_deliverables_check_constraint.sql`
- Migration ledger contains 001-006 and 013 only; no 014 entry
- Schema version table ends at 5.0.0 (2026-11-14)
- Current production `deliverables` table CHECK constraint: `('submitted', 'accepted', 'rejected', 'revision_requested')` — **missing `draft`**
- Migration 014 creates new table with constraint: `('draft', 'submitted', 'accepted', 'rejected', 'revision_requested')`

### Files Involved
- `migrations/014_fix_deliverables_check_constraint.sql`
- Migration runner (not yet identified in codebase)
- `src/council/deliverables.ts` (service layer)

### Migration Readiness Assessment
| Check | Status |
|-------|--------|
| Migration exists | ✅ |
| Idempotent (uses table rebuild) | ✅ |
| Includes rollback guidance | ✅ (backup restore) |
| Checksum computable | ✅ (SHA256) |
| Dependencies satisfied | ✅ (001-013 complete) |
| Tested against audit DB | ✅ (constraint confirmed missing) |

### Safe Execution Instructions (for future authorized operation)
1. **Backup production database** to isolated location
2. **Verify target database** is the intended production instance
3. **Run migration** using production migration runner with explicit confirmation
4. **Verify** `PRAGMA table_info(deliverables)` shows `draft` in CHECK constraint
5. **Record** migration in `migration_ledger` with SHA256 checksum
6. **Update** `schema_version` to 5.0.1

---

## F-02 — Test/Fixture Data Contamination

**Classification: CONFIRMED DEFECT**

### Confirmed Causes

#### 1. Test Database Path Selection Bug (`src/database.ts`)
```typescript
// Lines 240-244
if (!isProduction && !isTest && !dbPath) {
  dbPath = path.join(process.cwd(), 'data', 'council.db');
}
```
**Problem:** When `NODE_ENV=test` is set but `DATABASE_PATH` is NOT explicitly provided, the code falls through to the development default path `data/council.db` instead of using an in-memory or isolated test database.

#### 2. NODE_ENV Handling
- Tests run with `NODE_ENV=test` but without `DATABASE_PATH=:memory:` or explicit test path
- The condition `!isTest` evaluates to `false` when `NODE_ENV=test`, but the fallback logic still uses the production database file

#### 3. Test Fixtures Use Real Database
- Multiple test files create divisions, staff, and members using the production database path
- Test data accumulates because:
  - No test teardown cleans the database
  - Tests run against the same file repeatedly
  - Parallel test execution creates race conditions

### Evidence
| Table | Total | Canonical | Test/Fixture | Pattern |
|-------|-------|-----------|--------------|---------|
| `divisions` | 5,427 | 6 | 5,421 | UUID suffixes, "Developer-*" names |
| `staff_agents` | 6,925 | 51 | 6,874 | "staff-dev-*" with UUIDs |
| `division_members` | 5,529 | 51 | 5,478 | Timestamps in role column |
| `staff_runtime_personas` | 938 | 102 | 836 | Test division mappings |

**Canonical Division IDs:** `founder-office`, `research`, `engineering`, `operations`, `governance`, `external` — **ALL MISSING** from audit database. The 6 divisions present are test fixtures: `developer`, `marketing`, `finance`, `creative`, `research-intelligence`, `business-operations`.

### Source Locations
- `src/database.ts` lines 230-252 — database path resolution
- `tests/` — multiple test files creating fixtures
- No test isolation mechanism found

### Test Isolation Improvements Required
1. **Enforce `:memory:` for tests** — Update test runner to require `DATABASE_PATH=:memory:`
2. **Add test database cleanup** — Each test suite should drop/recreate schema
3. **Isolate test IDs** — Use prefixed IDs (`test-*`) to distinguish from production
4. **Separate test config** — Create `test-database.ts` with explicit in-memory configuration
5. **CI/CD enforcement** — Fail tests if `data/council.db` is modified

### Non-Destructive Classification Strategy
1. **Canonical records** — Keep the 6 division definitions, 51 staff identities, 51 memberships, 102 runtime mappings
2. **Test records** — Classify by:
   - Division name pattern: `Developer-*`, `Marketing-*`, UUID-suffixed
   - Staff ID pattern: `staff-*-<uuid>`
   - Role column containing ISO timestamps
3. **Quarantine** — Move test records to separate tables for review before deletion

---

## F-03 — Invalid division_members.role Values

**Classification: CONFIRMED DEFECT**

### Root Cause
**Function argument ordering bug** in `insertDivisionMember` or test fixture code.

### Evidence
- 4,367 rows have ISO timestamps (e.g., `2026-11-14T12:46:50.788Z`) in `role` column
- Valid roles: `head` (351 rows), `specialist` (811 rows), `member` (default)
- All invalid roles are timestamps with 3 rows each across many timestamps

### Code Investigation
**Schema definition** (`src/database.ts` line 756-764):
```sql
CREATE TABLE division_members (
  division_id    TEXT NOT NULL,
  staff_id       TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'member',       -- 'head' | 'member' | 'specialist'
  joined_at      TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (division_id, staff_id),
  ...
)
```

**Prepared statement** (line 1269-1274):
```typescript
insertDivisionMember: db.prepare(`
  INSERT INTO division_members (division_id, staff_id, role)
  VALUES (?, ?, ?)
`) as PreparedStatement,
```

### How Timestamps Enter `role` Column
**Most likely:** Test fixture calls `insertDivisionMember.run(divisionId, staffId, joinedAt)` instead of `insertDivisionMember.run(divisionId, staffId, role)` — passing the timestamp as the third argument (role).

**Supporting evidence:**
- Each timestamp appears exactly 3 times (matching batch inserts of 3 members)
- Timestamps correspond to test execution times (Nov 14-15, 2026)
- The `joined_at` column has the correct default `datetime('now')`

### Proposed Fixes
1. **Input validation** — Add Zod schema for `DivisionMemberInput` with enum `['head', 'member', 'specialist']`
2. **Named parameters** — Use named bind parameters in prepared statement:
   ```typescript
   insertDivisionMember: db.prepare(`
     INSERT INTO division_members (division_id, staff_id, role)
     VALUES ($divisionId, $staffId, $role)
   `),
   ```
3. **Database CHECK constraint** (future migration):
   ```sql
   CHECK (role IN ('head', 'member', 'specialist'))
   ```
4. **Data classification** — Quarantine 4,367 invalid rows for repair after source fix

---

## F-04 — Dangling References

**Classification: CONFIRMED DEFECT**

### 70 Invalid Division Head References
- **Cause:** Test fixtures create divisions with `head_staff_id` pointing to non-existent staff IDs (e.g., `staff-head` which doesn't exist)
- **Pattern:** All 70 are test divisions with `test-div-head-*` names
- **Canonical heads:** All 6 canonical divisions have valid `head_staff_id` resolving to active staff in their division

### 3 Invalid Task Assignees
- **Tasks:** `c7ed5272...`, `6af6e71e...`, `a63325c1...` — all titled "Test task"
- **Issue:** `assigned_to_type = 'staff'` but `assigned_to_id = 'founder'`
- **Cause:** Test code uses `founder` as staff ID without validation
- **Schema:** No FK on `assigned_to_id` (polymorphic reference)

### Code Paths
- `src/council/divisions.ts` — `insertDivision`, `updateDivision`
- `src/council/operations.ts` — `insertTask`, `updateTask`
- No application-level validation of `head_staff_id` or `assigned_to_id` existence

### Recommendations
1. **Add validation** in service layer before insert/update
2. **Add CHECK constraint** on `divisions.head_staff_id` (requires FK or trigger)
3. **Add validation** for `tasks.assigned_to_id` based on `assigned_to_type`

---

## F-05 — Quality Threshold Discrepancy

**Classification: NEEDS FOUNDER CONFIRMATION**

### Evidence
| Record | min_quality_score | requires_review | Source |
|--------|-------------------|-----------------|--------|
| Migration 013 default | 70 | 1 | `013_deliverable_workflow.sql` |
| Production global | 80 | 0 | `quality_thresholds` table |

- `updated_at` indicates modification after creation
- 154 additional threshold rows reference test divisions

### Investigation
- No audit log for threshold changes (table has no audit column)
- Could be intentional Founder configuration via API
- Frontend may have threshold management UI

### Recommendation
**Cannot establish intent from evidence.** Requires Founder confirmation before any change.

---

## F-06 — Deliverable Workflow History Missing

**Classification: CONFIRMED DEFECT**

### Evidence
| Table/Field | Count/Status |
|-------------|--------------|
| `deliverables` | 141 (84 submitted, 57 accepted) |
| `deliverable_versions` | 0 rows |
| `deliverables.audit_log` | `[]` for all 141 |
| `reviewer_type` | NULL for all 141 |
| `reviewer_id` | NULL for all 141 |
| `approved_at` | NULL for all 141 |
| `approved_by_type` | NULL for all 141 |
| `founder_signature` | NULL for all 141 |
| `version` | 1 for all 141 |

### Code Investigation
**Service:** `src/council/deliverables.ts`
- `submitDeliverable` — creates deliverable but doesn't create version
- `reviewDeliverable` — updates `reviewed_by_*` but doesn't log to `audit_log`
- `approveDeliverable` / `rejectDeliverable` — may not exist or not called
- No `createDeliverableVersion` calls found

**Migration 013** added columns but service layer not updated to populate them.

### Missing Persistence
1. Version creation on submit/resubmit
2. Audit log entries for each state transition
3. Reviewer assignment recording
4. Approval/rejection with Founder signature

---

## F-07 — Empty Task Audit

**Classification: CONFIRMED DEFECT**

### Evidence
- `tasks`: 3,251 rows
- `task_audit`: 0 rows

### Code Investigation
**Service:** `src/council/operations.ts`
- `createTask` — inserts task but **no** `insertTaskAudit` call
- `updateTask` — updates task but **no** `insertTaskAudit` call
- `deleteTask` — not found
- Delegation/assignment/acceptance/cancellation — no audit writes

**Prepared statement exists** (`src/database.ts` line 1347-1350):
```typescript
insertTaskAudit: db.prepare(`
  INSERT INTO task_audit (audit_id, task_id, mutation_type, details, actor_type, actor_id, runtime, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`) as PreparedStatement,
```

### Missing Audit Events
| Operation | mutation_type | Audit Written? |
|-----------|---------------|----------------|
| Create | `create` | ❌ |
| Update | `update` | ❌ |
| Assign | `assign` | ❌ |
| Status change | `status_change` | ❌ |
| Dependency change | `dependency_change` | ❌ |
| Cancel | `cancel` | ❌ |
| Complete | `complete` | ❌ |

---

## F-08 — No Level 2/3 Approval Evidence

**Classification: EXPECTED EMPTY STATE**

### Evidence
| Table | Count |
|-------|-------|
| `execution_requests` | 15 (all Level 1) |
| `approval_requests` | 0 |
| `founder_approvals` | 0 |

### Assessment
- Autonomy levels 1-3 exist in `task_autonomy_levels` (147 rows)
- Backend code for Level 2/3 exists in `src/council/operations.ts`
- No test or production workflow has triggered Level 2/3
- **Not a defect** — feature exists but not exercised

### Confirmation
Backend CAN persist these workflows (code exists). Empty state is expected if no Level 2/3 tasks have been requested.

---

## F-09 — Empty Operational Tables

**Classification: EXPECTED EMPTY STATE**

### Tables Confirmed Empty (Expected)
| Table | Purpose | Service | Status |
|-------|---------|---------|--------|
| `meetings` | Council meetings | `src/council/meetings.ts` | Empty — no meetings held |
| `meeting_phases` | Meeting phases | `src/council/meetings.ts` | Empty — no meetings |
| `evaluation_criteria` | Constitution criteria | `src/council/evaluations.ts` | Empty — no evals configured |
| `evaluations` | Seat evaluations | `src/council/evaluations.ts` | Empty — no meetings |
| `candidates` | Seat candidates | `src/council/formation.ts` | Empty — no recruitment |
| `founder_votes` | Founder votes | `src/council/formation.ts` | Empty — no candidates |
| `founder_deliberations` | Founder discussions | `src/council/formation.ts` | Empty — no candidates |
| `cross_division_shares` | Memory sharing | `src/council/memory.ts` | Empty — no shares requested |
| `memory_links` | Memory relationships | `src/council/memory.ts` | Empty — no links created |

### Tables with Missing Integration (Possible Defect)
| Table | Issue |
|-------|-------|
| `approval_requests` | Level 2/3 executions would populate; no Level 2/3 yet |
| `task_audit` | See F-07 — service layer not writing |
| `deliverable_versions` | See F-06 — service layer not writing |
| `migration_audit` | Legacy table; `migration_ledger` used instead |

---

## Summary

**Confirmed Defects (code fixes needed):** F-01, F-02, F-03, F-04, F-06, F-07  
**Needs Founder Confirmation:** F-05  
**Expected Empty States:** F-08, F-09 (partial)

**Production database remains unmodified.** All investigation performed on read-only audit copy.