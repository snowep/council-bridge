# Database Audit Report
**Project:** council-bridge  
**Database:** `data/council.db` (SQLite)  
**Date:** 2026-11-16  
**Schema Version:** 5.0.0  

---

## 1. Database File

| Property | Value |
|----------|-------|
| **Path** | `C:\Projects\council-bridge\data\council.db` |
| **Type** | SQLite 3 |
| **Schema Version** | 5.0.0 (per `schema_version` table) |
| **Size** | ~15-20 MB (estimated from record counts) |

---

## 2. Schema Overview

### Tables (38 total, excluding FTS internal tables)

| Table | Rows | Purpose |
|-------|------|---------|
| `council_seats` | 11 | Council seat definitions (4 permanent + 7 vacant) |
| `personas` | 4 | Council personas (only 4 founding members created) |
| `runtime_personas` | 8 | Runtime mappings (4 personas × 2 runtimes = 8) |
| `divisions` | 5,427 | Division definitions (6 canonical + ~4,850 test) |
| `staff_agents` | 6,925 | Staff agents (51 canonical + ~6,095 test) |
| `division_members` | 5,529 | Division membership (51 canonical + ~5,478 test) |
| `tasks` | 3,251 | Task tracking |
| `deliverables` | 141 | Deliverable submissions |
| `deliverable_versions` | 0 | Version history for deliverables |
| `messages` | 391 | Inter-agent messaging |
| `agents` | 160 | Runtime agent registry |
| `staff_runtime_personas` | 938 | Staff runtime mappings |
| `constitutions` | 1 | Constitution v1.0.0 |
| `migration_ledger` | 8 | Migration history (001-006, 013-014) |
| `schema_version` | 4 | Schema version history |
| `quality_thresholds` | 155 | Quality gates (1 canonical + 154 test) |
| `task_autonomy_levels` | 147 | Autonomy levels (3 canonical + 144 test) |
| `memory_entries` | 2,447 | Memory system entries |
| `memory_versions` | 78 | Memory version history |
| `memory_access` | 78 | Memory access logs |
| `execution_requests` | 15 | Execution framework |
| `execution_history` | 17 | Execution audit trail |
| `founder_nonces` | 4 | Founder nonce tracking |
| *20 other tables* | 0-57 | Governance, evaluation, meeting, challenge, etc. |

---

## 3. Migration History

| Migration ID | Filename | Status | Applied At | Notes |
|--------------|----------|--------|------------|-------|
| 001 | 001_staff_agents_default_inactive.sql | success | 2026-11-13 06:09:40 | Change status default to 'inactive' |
| 002 | 002_cross_division_shares_founder_only.sql | success | 2026-11-13 06:09:40 | Restrict grants to founder-only |
| 003 | 003_tasks_add_columns.sql | success | 2026-11-13 06:09:40 | Add dependencies, deliverable_id |
| 004 | 004_deliverables_add_columns.sql | success | 2026-11-13 06:09:41 | Add file_references, task_relationships, audit_log |
| 005 | 005_cross_division_shares_stage7.sql | success | 2026-11-13 06:09:41 | Add request tracking columns |
| 006 | 006_phase7_autonomy_execution.sql | success | 2026-11-13 06:55:48 | Phase 7 autonomy framework |
| 013 | 013_deliverable_workflow.sql | success | 2026-11-14 20:23:12 | Deliverable workflow tables |
| 014 | 014_fix_deliverables_check_constraint.sql | success | 2026-11-15 18:23:41 | Fix check constraint |

**Schema version history:** 2.0.0 → 3.0.0 → 4.0.0 → 5.0.0

---

## 4. Seed Data Verification

### 4.1 Council Seeds (`scripts/seed/initialize-council.ts`)

**FOUNDING_MEMBERS (4 permanent seats):**
| Seat | Name | Status | Persona ID |
|------|------|--------|------------|
| seat-01 | Steve Jobs | permanent | persona-steve-jobs |
| seat-02 | Virgil Abloh | permanent | persona-virgil-abloh |
| seat-03 | Shawn Stüssy | permanent | persona-shawn-stussy |
| seat-04 | G-Dragon (Kwon Ji-yong) | permanent | persona-g-dragon |

**VACANT_SEATS (7 replaceable seats):**
| Seat | Name | Status |
|------|------|--------|
| seat-05 through seat-11 | Seat XX - Vacant | vacant |

**RUNTIMES:** `claude`, `hermes` — each persona assigned to both runtimes (8 total runtime_personas)

**CONSTITUTION:** v1.0.0 created with full governance rules

### 4.2 Database State vs Seed

| Metric | Seed Spec | Database Actual | Match |
|--------|-----------|-----------------|-------|
| Council seats | 11 | 11 | ✅ |
| Permanent seats | 4 | 4 | ✅ |
| Vacant seats | 7 | 7 | ✅ |
| Personas created | 4 | 4 | ✅ |
| Runtime mappings | 8 | 8 | ✅ |
| Constitution v1.0.0 | 1 | 1 | ✅ |

**Note:** Only the 4 founding member personas exist in the `personas` table. The 7 vacant seats have no personas (as designed).

---

## 5. Organizational Data — Canonical Invariants

### 5.1 Canonical Divisions (6 Expected)

| Division ID | Name | Head Staff ID | Staff Count | Member Count |
|-------------|------|---------------|-------------|--------------|
| developer | Developer Division | staff-dev-head-001 | 10 | 10 |
| marketing | Marketing Division | staff-marketing-head-001 | 8 | 8 |
| finance | Finance Division | staff-finance-head-001 | 8 | 8 |
| creative | Creative Division | staff-creative-head-001 | 11 | 11 |
| research-intelligence | Research & Intelligence Division | staff-research-head-001 | 6 | 6 |
| business-operations | Business Operations Division | staff-ops-head-001 | 8 | 8 |

### 5.2 Canonical Staff (51 Total)

| Division | Division Head (1) | Specialists (non-head) | Total |
|----------|-------------------|------------------------|-------|
| Developer | 1 | 9 | 10 |
| Marketing | 1 | 7 | 8 |
| Finance | 1 | 7 | 8 |
| Creative | 1 | 10 | 11 |
| Research & Intelligence | 1 | 5 | 6 |
| Business Operations | 1 | 7 | 8 |
| **Total** | **6** | **45** | **51** |

### 5.3 Canonical Identity Counts

| Category | Expected | Actual | Status |
|----------|----------|--------|--------|
| Council seats | 11 | 11 | ✅ |
| Division heads | 6 | 6 | ✅ |
| Specialists | 45 | 45 | ✅ |
| **Total logical identities** | **62** | **62** | ✅ |

**Note:** The requirement stated "51 total logical division identities" — this appears to be the 6 division heads + 45 specialists = 51. Adding 11 council seats = 62 total organizational identities.

### 5.4 Key Invariant Verification

- ✅ **4 permanent council seats** (Steve Jobs, Virgil Abloh, Shawn Stüssy, G-Dragon)
- ✅ **7 replaceable/vacant council seats** (seat-05 through seat-11)
- ✅ **6 divisions** with correct names and heads
- ✅ **6 division heads** (one per division) — NOT council voting members
- ✅ **45 specialists** across 6 divisions — NOT council voting members
- ✅ **Claude/Hermes** are runtime mappings (8 runtime_personas for 4 personas), not duplicate org identities

---

## 6. Test/Development Data Analysis

### 6.1 Test Division Patterns

| Pattern | Count | Description |
|---------|-------|-------------|
| `Developer-%` | ~4,800+ | Auto-generated Developer divisions with hex suffixes |
| `Division-%` | ~50+ | Generic test divisions |
| `test-div-%` | ~10+ | Explicit test divisions |

**Total test divisions: ~4,850+** (vs 6 canonical)

### 6.2 Test Staff Agents

- **Total staff:** 6,925
- **Canonical (active, in 6 divisions):** 51
- **Test (inactive, in test divisions):** ~6,095+
- **Status breakdown:** 6,096 active / 829 inactive (most test staff are `active` status)

### 6.3 Test Division Members

- **Total members:** 5,529
- **Canonical:** 51
- **Test:** ~5,478+

### 6.4 Test Tasks

- **Total tasks:** 3,251
- **Assigned to test divisions:** 275
- **Assigned to staff (mostly test):** 2,976
- **Assigned to divisions:** 275

### 6.5 Test Quality Thresholds

- **Total:** 155
- **Canonical (global default only):** 1
- **Test (per test division/task_type):** 154

### 6.6 Test Task Autonomy Levels

- **Total:** 147
- **Canonical:** 3 (`research`=1, `Permission Task`=2, `Founder Task`=3)
- **Test (auto-generated `research-XXXXXX`):** 144

### 6.7 Test Agents

- **Total agents:** 160
- **Canonical estimate:** ~11 (founder, council personas × 2 runtimes, etc.)
- **Test:** ~150+ (mostly `hermes` runtime with auto-generated IDs)

### 6.8 Test Deliverables & Memory

- **Deliverables:** 141 (mostly `submitted` status, no quality scores)
- **Memory entries:** 2,447 (1,878 council_shared, 491 task_history, 78 staff_private)
- **Messages:** 391 (mostly from `founder` sender_id)

---

## 7. Orphaned Records

| Table | Orphan Type | Count | Details |
|-------|-------------|-------|---------|
| `staff_agents` | Invalid `division_id` | 0 | All staff reference valid divisions |
| `division_members` | Invalid `division_id` or `staff_id` | 0 | All members valid |
| `tasks` | `assigned_to_type=staff` but `assigned_to_id` not in staff_agents | 3 | All 3 assigned to `founder` (not a staff_id) |
| `tasks` | `assigned_to_type=division` but `assigned_to_id` not in divisions | 0 | All valid |
| `deliverables` | `task_id` not in tasks | 0 | All valid |

**Orphaned Tasks (3):**
| Task ID | Assigned To Type | Assigned To ID |
|---------|------------------|----------------|
| c7ed5272-fbe5-4c75-b768-119ae9106393 | staff | founder |
| 6af6e71e-a872-40a9-8485-4528749c0e33 | staff | founder |
| a63325c1-76d5-43fb-a2f4-2a4375160208 | staff | founder |

**Assessment:** These 3 tasks reference `founder` as a staff_id, but `founder` exists in `agents` table, not `staff_agents`. This is a data modeling issue — tasks assigned to founder should use a different `assigned_to_type` or the founder should be in staff_agents.

---

## 8. Duplicate Records

### 8.1 Duplicate Division Names
**None found** — all division names are unique (even test divisions use unique hex suffixes).

### 8.2 Duplicate Staff Roles in Same Division
**Many found in test divisions** — e.g., multiple "Researcher" roles per test division (2 per division in hundreds of test divisions). This is expected for auto-generated test data.

**Canonical divisions:** No duplicate roles — each role is unique within its division.

### 8.3 Duplicate Division IDs with Different Names
| Division ID | Name 1 | Name 2 |
|-------------|--------|--------|
| Developer-337d34d2 | Developer-337d34d2 | Developer-004add8b |
| Developer-6699d740 | Developer-6699d740 | Developer-0073a056 |
| Developer-3474af2c | Developer-3474af2c | Developer-7c8bf454 |
| Developer-f3a940dc | Developer-f3a940dc | Developer-a0d6fa21 |
| Developer-c3df4623 | Developer-c3df4623 | Developer-f3c56752 |
| Developer-778a2223 | Developer-778a2223 | Developer-778a2223 (same) |
| Developer-88f63e96 | Developer-88f63e96 | Developer-34e06ae7 |
| Developer-5ed829bb | Developer-5ed829bb | Developer-bb30f7be |

**Count:** ~8 division_ids with mismatched names (likely migration artifacts or bugs in test data generation).

---

## 9. Record Classification

| Table / Data | Classification | Rationale |
|--------------|----------------|-----------|
| **Canonical divisions (6)** | **KEEP** | Core organizational structure |
| **Canonical staff (51)** | **KEEP** | Core operational staff |
| **Canonical division members (51)** | **KEEP** | Core membership |
| **Council seats (11)** | **KEEP** | Governance foundation |
| **Personas (4 founding)** | **KEEP** | Required by constitution |
| **Runtime mappings (8)** | **KEEP** | Required for dual-runtime operation |
| **Constitution v1.0.0** | **KEEP** | Active governance document |
| **Schema version history** | **KEEP** | Audit trail |
| **Migration ledger (8)** | **KEEP** | Migration audit trail |
| **Test divisions (~4,850)** | **REMOVE** | Auto-generated test pollution |
| **Test staff (~6,095)** | **REMOVE** | Auto-generated test pollution |
| **Test division members (~5,478)** | **REMOVE** | Auto-generated test pollution |
| **Test quality thresholds (154)** | **REMOVE** | Per-test-division noise |
| **Test task autonomy levels (144)** | **REMOVE** | Auto-generated noise |
| **Test agents (~150)** | **REMOVE** | Test runtime registrations |
| **Test tasks (275 to test divisions)** | **REMOVE** | Orphaned by test division removal |
| **Orphaned tasks (3 to 'founder')** | **INVESTIGATE** | Data modeling issue |
| **Mismatched division IDs (8)** | **INVESTIGATE** | Likely migration bugs |
| **Memory entries (2,447)** | **ARCHIVE** | Mostly council_shared history |
| **Deliverables (141)** | **ARCHIVE** | Historical submissions |
| **Messages (391)** | **ARCHIVE** | Communication history |
| **Execution history (17)** | **ARCHIVE** | Audit trail |
| **Memory versions/access (156)** | **ARCHIVE** | System audit logs |

---

## 10. Summary Statistics

### Canonical Data (KEEP)
| Entity | Count |
|--------|-------|
| Council seats | 11 |
| Personas | 4 |
| Runtime personas | 8 |
| Divisions | 6 |
| Division heads | 6 |
| Specialists | 45 |
| Division members | 51 |
| Staff agents | 51 |
| Constitution | 1 |
| Quality thresholds (global) | 1 |
| Task autonomy levels (canonical) | 3 |

### Test Data (REMOVE)
| Entity | Count |
|--------|-------|
| Divisions | ~4,850 |
| Staff agents | ~6,095 |
| Division members | ~5,478 |
| Quality thresholds | 154 |
| Task autonomy levels | 144 |
| Agents | ~150 |
| Tasks (to test divisions) | 275 |

### Archive Data
| Entity | Count |
|--------|-------|
| Memory entries | 2,447 |
| Deliverables | 141 |
| Messages | 391 |
| Execution history | 17 |
| Memory versions/access | 156 |

---

## 11. Recommendations

### Immediate (Must Fix)
1. **Remove all test divisions** (`Developer-%`, `Division-%`, `test-div-%`) — ~4,850 records
2. **Remove all test staff agents** in test divisions — ~6,095 records
3. **Remove all test division members** in test divisions — ~5,478 records
4. **Remove test quality thresholds** (154) and **test task autonomy levels** (144)
5. **Remove test agents** (~150 auto-generated hermes agents)

### Data Integrity (Investigate)
6. **Fix 3 orphaned tasks** assigned to `founder` (staff_id not in staff_agents)
7. **Investigate 8 division_ids with mismatched names** — likely test data generation bugs

### Schema/Constraints
8. **Add foreign key** from `tasks.assigned_to_id` (when type=staff) to `staff_agents.staff_id`
9. **Add foreign key** from `tasks.assigned_to_id` (when type=division) to `divisions.division_id`
10. **Consider unique constraint** on `divisions.name` to prevent future duplicates

### Archival
11. **Archive memory_entries, deliverables, messages, execution_history** to separate audit tables if not needed for active operations

---

## 12. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Deleting test data breaks tests | High | Medium | Run test suite after cleanup; tests should use isolated databases |
| Orphaned tasks reference founder | Low | Low | Fix task assignment model |
| Division ID/name mismatches | Low | Low | Clean up during test data removal |
| FK constraints on existing data | Medium | High | Validate before adding FKs; current data is clean for canonical |

---

## 13. Verdict

**Database Health: POOR** — The canonical data (62 organizational identities, 6 divisions, 51 staff) is correct and matches all invariants. However, the database is **severely polluted** with ~16,000+ test records across divisions, staff, members, thresholds, autonomy levels, and agents — likely from automated test runs that didn't clean up.

**Priority:** Remove test data (~90% of database) before production use. Canonical data is intact and correct.

**Lean Potential:** ~16,000 rows removable, reducing database size by ~85-90%.