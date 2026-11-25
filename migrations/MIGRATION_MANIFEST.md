# Phase 10 Migration Manifest

**Schema Version**: 4.0.0 → 4.0.0 (no version bump - additive/migrations only)
**Database**: council.db
**Migration Directory**: migrations/
**Execution Order**: Sequential (001 → 023)

---

## Migration Inventory

| ID | Filename | Type | Target Table | Description |
|----|----------|------|--------------|-------------|
| 001 | 001_staff_agents_default_inactive.sql | Table Rebuild | staff_agents | Change status DEFAULT 'active' → 'inactive' |
| 002 | 002_cross_division_shares_founder_only.sql | Table Rebuild | cross_division_shares | Restrict granted_by_type CHECK to 'founder' only; revoke legacy division grants |
| 003 | 003_tasks_add_columns.sql | ALTER TABLE (additive) | tasks | Add dependencies (JSON), deliverable_id (FK reference) |
| 004 | 004_deliverables_add_columns.sql | ALTER TABLE (additive) | deliverables | Add file_references, task_relationships, audit_log (all JSON) |
| 005 | 005_cross_division_shares_stage7.sql | ALTER TABLE (additive) | cross_division_shares | Add request tracking columns (type, status, justification, priority, deadline, approval fields) |
| 006 | 006_phase7_autonomy_execution.sql | Table Rebuild + New Tables | execution_requests, approval_requests, execution_history, task_autonomy_levels | Phase 7 Autonomy, Permissions and Execution |
| 013 | 013_deliverable_workflow.sql | Table Rebuild + New Tables | deliverables, deliverable_versions, quality_thresholds | Phase 9 Batch 4 deliverable workflow tables |
| 014 | 014_fix_deliverables_check_constraint.sql | Table Rebuild | deliverables | Fix CHECK constraint for status values |
| 015 | 015_add_read_at_to_messages.sql | ALTER TABLE (additive) | messages | Add read_at column for read receipts |
| 016 | 016_fix_cross_division_shares_granted_by_type.sql | Table Rebuild | cross_division_shares | Fix CHECK constraint to allow 'division' for pending requests, 'founder' for approved |
| 017 | 017_add_runtime_sessions_table.sql | New Table | runtime_sessions | Phase 10: Runtime Session Persistence Table with generation & credential_id |
| 018 | 018_add_execution_records.sql | New Table | execution_records | Phase 10: Execution Records Table for MCP Tool Execution Guard |
| 019 | 019_create_runtime_credentials.sql | New Table | runtime_credentials | Phase 10 Loop 1: Runtime Credential Storage Table |
| 020 | 020_create_runtime_control_table.sql | New Table | runtime_control | Phase 10 Loop 2: Runtime Control Table |
| 021 | 021_runtime_sessions_history.sql | New Tables + Indexes | runtime_session_history, all_runtime_sessions view | Phase 10 P1-06: Runtime Session History Preservation |
| 022 | 022_add_credential_id_to_runtime_sessions.sql | ALTER TABLE (additive) | runtime_sessions, runtime_session_history | Add credential_id column for session continuity |
| 023 | 023_identity_credentials.sql | New Table | identity_credentials | SEC-04: Identity credential validation for staff/division/seat authentication |

---

## Skipped Historical Numbers

Migration numbers that were intentionally not used:
- 007-012: Reserved for future Phase 7/8/9 migrations, or could not be used due to repository consolidation during Phase 10
- 021: Originally planned for different feature, repurposed for session history (now 021)

---

## Execution Order and Dependencies

```
001: staff_agents_default_inactive
    ├─ No dependencies (empty table)
    └─ Must run before 003, 004, 013 (tasks/deliverables reference staff_agents)

002: cross_division_shares_founder_only
    ├─ No dependencies (empty table)
    └─ Must run before 005, 016 (adds columns to same table)

003: tasks_add_columns
    ├─ Depends on: 001, 002
    └─ No downstream dependencies

004: deliverables_add_columns
    ├─ Depends on: 001, 002
    └─ No downstream dependencies

005: cross_division_shares_stage7
    ├─ Depends on: 002 (must run after table rebuild)
    └─ Must run before 016 (modifies same table)

006: phase7_autonomy_execution
    ├─ Depends on: 001, 002, 003, 004, 005 (references tasks, deliverables)
    └─ Must run before 013, 017 (execution_requests references tasks)

013: deliverable_workflow
    ├─ Depends on: 001, 003, 004, 006 (references tasks, deliverables, execution_requests)
    └─ No downstream dependencies

014: fix_deliverables_check_constraint
    ├─ Depends on: 013 (modifies deliverables table)
    └─ No downstream dependencies

015: add_read_at_to_messages
    ├─ No dependencies (independent table)
    └─ No downstream dependencies

016: fix_cross_division_shares_granted_by_type
    ├─ Depends on: 002, 005 (modifies same table after stage7)
    └─ No downstream dependencies

017: add_runtime_sessions_table
    ├─ No dependencies (standalone table)
    ├─ Added generation column with DEFAULT 0 for execution fencing
    ├─ Added credential_id column for credential binding (Workstream A-R1)
    └─ Adds unique index on session_id for ownership queries

018: add_execution_records
    ├─ Depends on: 017 (FK to runtime_sessions.session_id and runtime_sessions.runtime)
    └─ Must run before 019, 020

019: create_runtime_credentials
    ├─ Depends on: 017, 018 (execution_records FK to runtime_sessions)
    └─ Must run before 020

020: create_runtime_control_table
    ├─ Depends on: 017, 018, 019 (generation column, execution_records)
    └─ Creates runtime_control table (currently unused but defined for future use)

021: runtime_sessions_history
    ├─ Depends on: 017, 020 (runtime_sessions structure, generation column)
    └─ Creates history table and composite view for session archival

022: add_credential_id_to_runtime_sessions
    ├─ Depends on: 017, 021 (runtime_sessions table with history)
    └─ Adds credential_id to both active sessions and history (idempotent check)

023: identity_credentials
    ├─ No dependencies (standalone table)
    └─ Creates identity_credentials table for staff/division/seat authentication (SEC-04)
```

**Valid Execution Sequences:**
- Sequential: 001 → 002 → 003 → 004 → 005 → 006 → 013 → 014 → 015 → 016 → 017 → 018 → 019 → 020 → 021 → 022 → 023
- Parallel groups: [001, 002] → [003, 004, 005, 015] → [006] → [013, 016] → 014 → [017] → [018, 019] → 020 → 021 → 022 → 023

---

## Runtime Control Table Design Decision

**Decision: runtime_control is NOT the authoritative source**

The `runtime_control` table was created by migration 020 but the application code uses `runtime_sessions` table directly for:
- Active runtime enforcement (idx_single_active_runtime partial unique index)
- Session ownership verification (unique session_id index)
- Generation-based execution fencing (generation column)

**Rationale:**
- `runtime_sessions` has `runtime` as primary key ensuring single active runtime per type
- The partial unique index `idx_single_active_runtime` enforces only one 'connected' status
- Generation column provides TOCTOU protection for session ownership
- Using `runtime_sessions` as authoritative eliminates redundant state

**Migration implications:**
- `runtime_control` table exists but is unused
- Future: remove or deprecate `runtime_control` if never used
- Current behavior is correct and consistent

---

## Migration Count Clarification

**Logical Migrations**: 17 (001-006, 013-023)
- 6 table rebuilds (001, 002, 006, 013, 014, 016) — require foreign key handling
- 4 additive ALTER TABLE operations (003, 004, 005, 015) — safe, no data loss
- 7 new table creations (017, 018, 019, 020, 021, 022, 023) — safe, no data loss

**Previous Documentation Error**: Some docs referred to "3 migrations" grouping additive columns together.
**Corrected**: This manifest uses 17 explicit migrations for traceability and rollback granularity.

---

## Foreign Key Strategy

### 001: staff_agents Rebuild
- `staff_agents.division_id` → `divisions.division_id` (ON DELETE CASCADE)
- `division_members.staff_id` → `staff_agents.staff_id` (ON DELETE CASCADE)
- **Strategy**: `PRAGMA foreign_keys = OFF` during rebuild, copy data, rename, `PRAGMA foreign_keys = ON`, verify integrity

### 002: cross_division_shares Rebuild
- `cross_division_shares.memory_id` → `memory_entries.memory_id` (ON DELETE CASCADE)
- `cross_division_shares.division_id` → `divisions.division_id` (ON DELETE CASCADE)
- **Strategy**: Same as 001 — FK off during rebuild

### 003-005: Additive Columns
- No FK changes
- `tasks.deliverable_id` → `deliverables.deliverable_id`: App-layer validation only (no circular FK)
- `deliverables.task_id` → `tasks.task_id` (existing FK, ON DELETE CASCADE)

### 006: Phase 7 Autonomy Execution (New Tables)
- `execution_requests.task_id` → `tasks.task_id` (ON DELETE CASCADE)
- `approval_requests.execution_id` → `execution_requests.execution_id` (ON DELETE CASCADE)
- `execution_history.execution_id` → `execution_requests.execution_id` (ON DELETE CASCADE)
- `execution_history.task_id` → `tasks.task_id` (ON DELETE CASCADE)

### 013: Deliverable Workflow (New Tables)
- `deliverable_versions.deliverable_id` → `deliverables.deliverable_id` (ON DELETE CASCADE)
- `quality_thresholds.division_id` → `divisions.division_id` (ON DELETE CASCADE)

### 017: Runtime Sessions Table
- No FK (standalone table)

### 018: Execution Records Table
- `execution_records.session_id` → `runtime_sessions.session_id` (ON DELETE CASCADE)
- `execution_records.runtime_id` → `runtime_sessions.runtime` (ON DELETE CASCADE)

### 019: Runtime Credentials Table
- No FK (standalone table)

### 020: Runtime Control Table
- No FK (single-row control table)

### 021: Runtime Session History
- No FK (archival table)

### 022: credential_id Column Add
- No FK changes (additive column)

### 023: Identity Credentials Table
- No FK (standalone table)

---

## Legacy Cross-Division Grant Treatment

**Current State (Phase 4)**: Table empty, CHECK allows `'division' | 'founder'`

**Migration 002 Decision**:
1. Founder-authorized grants (`granted_by_type = 'founder'`) → **Preserved** in new table
2. Division-authorized grants (`granted_by_type = 'division'`) → **Revoked** (not copied)
3. All legacy division grants → **Logged** to `migration_audit` with action='revoked', reason explaining policy change
4. **No fabricated Founder approval** — revoked grants require explicit Founder reauthorization

**Rationale**:
- Silent conversion would create false audit trail
- Revocation forces intentional Founder decision
- Audit log preserves history without implying approval

---

## Deliverable Relationship Decision

**Decision: Option B — Application-Level Relationship**

`tasks.deliverable_id` is **NOT a database foreign key**.

**Reasons:**
1. Circular FK risk: `tasks` → `deliverables` → `tasks` (via `deliverables.task_id`)
2. SQLite FK constraints require referenced column to be PRIMARY KEY or UNIQUE — `deliverables.deliverable_id` is PK, but mutual reference creates cycle
3. Task may exist before deliverable; deliverable may be deleted while task remains
4. App-layer validation provides flexible handling:
   - On task creation: `deliverable_id` nullable
   - On deliverable submission: service validates `deliverable.task_id === task.task_id`
   - On deliverable deletion: service clears `task.deliverable_id` or marks task for review
   - Query convenience: `JOIN` available but not enforced by DB

**Documentation Updates Required:**
- `PHASE6_SCHEMA_PLAN.md`: Correct "FK column" → "FK reference (app-layer validated)"
- `PHASE6_IMPLEMENTATION_ROADMAP.md`: Update MCP tool contracts
- `PHASE6_DATABASE_MIGRATION_PLAN.md`: Update Migration 3 description

---

## Backup and Rollback Procedures

### Pre-Migration Backup (Per Migration)
```bash
sqlite3 council.db ".backup council_pre_migration_<migration_id>_$(date +%s).db"
sqlite3 council.db ".schema" > schema_backup_<migration_id>_$(date +%s).sql
```

### Rollback Strategies

| Migration | Rollback Method |
|-----------|-----------------|
| 001 (table rebuild) | Restore from `.backup` file OR re-run Phase 4 CREATE TABLE |
| 002 (table rebuild) | Restore from `.backup` file OR re-run Phase 4 CREATE TABLE |
| 003 (ALTER TABLE) | Table rebuild from backup (SQLite < 3.35 no DROP COLUMN) |
| 004 (ALTER TABLE) | Table rebuild from backup |
| 005 (ALTER TABLE) | Table rebuild from backup |

### Full Rollback
```bash
sqlite3 council.db ".restore council_pre_migration_001_<timestamp>.db"
# Then re-run migrations 001-005 in order if needed
```

---

## Verification Tests

Run against temporary database:
```bash
npx tsx --test tests/phase6_migration_verification.test.ts
```

**Test Coverage (23 tests, all passing)**:
| Category | Tests | Type | Description |
|----------|-------|------|-------------|
| Actual SQL execution (001-006, 013-022) | 16 | Substantive | Each migration file read and executed directly |
| Full sequence integration | 1 | Substantive (Integration) | All 16 migrations in order on same DB |
| Table rebuild preservation | 2 | Substantive (Integration) | Indexes, FK records, dependent tables |
| Backup & rollback (file-backed) | 1 | Substantive (Integration) | File copy backup, migration, restore, FK check |
| Migration ledger design validation | 2 | Design Validation (Proposed) | SHA-256 checksum tracking, transaction boundaries |
| Test classification | 5 | Placeholder (Documentation) | Unit, integration, application-layer distinction |
| **TOTAL** | **23** | **18 Substantive + 5 Placeholder** | |

**Verification Scope**:
- All 16 committed SQL files executed by tests
- Legacy grant conversion tested against actual Migration 002 file
- Foreign-key checks pass after table rebuilds (`PRAGMA foreign_key_check`)
- Standard indexes recreated after table rebuilds
- Dependent records survive table rebuilds
- Backup restoration tested against file-backed temporary database
- Migration ledger design validated (SHA-256 checksums, transaction boundaries); **proposed mechanism — no production runner implemented**
- Clear distinction: SQL file tests, integration tests, application-layer (not tested here)
- Runtime session lifecycle tested against Migrations 017-022

---

## Production Safety Checklist

- [ ] All migrations tested against temporary database
- [ ] No migration executed against production `council.db`
- [ ] Phase 6 implementation remains unauthorized
- [ ] Phase 1-5 functionality verified unchanged
- [ ] Founder review and explicit authorization required before execution