# Phase 6 Migration Manifest

**Schema Version**: 4.0.0 → 4.0.0 (no version bump - additive/migrations only)
**Database**: council.db
**Migration Directory**: migrations/
**Execution Order**: Sequential (001 → 005)

---

## Migration Inventory

| ID | Filename | Type | Target Table | Description |
|----|----------|------|--------------|-------------|
| 001 | 001_staff_agents_default_inactive.sql | Table Rebuild | staff_agents | Change status DEFAULT 'active' → 'inactive' |
| 002 | 002_cross_division_shares_founder_only.sql | Table Rebuild | cross_division_shares | Restrict granted_by_type CHECK to 'founder' only; revoke legacy division grants |
| 003 | 003_tasks_add_columns.sql | ALTER TABLE (additive) | tasks | Add dependencies (JSON), deliverable_id (FK reference) |
| 004 | 004_deliverables_add_columns.sql | ALTER TABLE (additive) | deliverables | Add file_references, task_relationships, audit_log (all JSON) |
| 005 | 005_cross_division_shares_stage7.sql | ALTER TABLE (additive) | cross_division_shares | Add request tracking columns (type, status, justification, priority, deadline, approval fields) |
| 013 | 013_deliverable_workflow.sql | Table Rebuild | deliverables, deliverable_versions, quality_thresholds, task_autonomy_levels | Phase 9 Batch 4 deliverable workflow tables |
| 014 | 014_fix_deliverables_check_constraint.sql | Table Rebuild | deliverables | Fix CHECK constraint for status values |
| 015 | 015_add_read_at_to_messages.sql | ALTER TABLE (additive) | messages | Add read_at column for read receipts |
| 016 | 016_fix_cross_division_shares_granted_by_type.sql | Table Rebuild | cross_division_shares | Fix CHECK constraint to allow 'division' for pending requests, 'founder' for approved |

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

013: deliverable_workflow
    ├─ Depends on: 001, 003, 004 (references tasks, deliverables)
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
```

**Valid Execution Sequences:**
- Sequential: 001 → 002 → 003 → 004 → 005 → 013 → 014 → 015 → 016 (recommended)
- Parallel groups: [001, 002] → [003, 004, 005, 015] → [013, 016] → 014

---

## Migration Count Clarification

**Logical Migrations**: 9 (001-005, 013-016)
- 5 table rebuilds (001, 002, 013, 014, 016) — require foreign key handling
- 4 additive ALTER TABLE operations (003, 004, 005, 015) — safe, no data loss

**Previous Documentation Error**: Some docs referred to "3 migrations" grouping additive columns together.
**Corrected**: This manifest uses 9 explicit migrations for traceability and rollback granularity.

---

## Foreign Key Strategy

### 001: staff_agents Rebuild
- `staff_agents.division_id` → `divisions.division_id` (ON DELETE CASCADE)
- `division_members.staff_id` → `staff_agents.staff_id` (ON DELETE CASCADE)
- **Strategy**: `PRAGMA foreign_keys = OFF` during rebuild, copy data, rename, `PRAGMA foreign_keys = ON`, verify integrity
- **Risk**: `divisions.head_staff_id` has NO FK (circular dependency avoided in schema) — app-layer validation only

### 002: cross_division_shares Rebuild
- `cross_division_shares.memory_id` → `memory_entries.memory_id` (ON DELETE CASCADE)
- `cross_division_shares.division_id` → `divisions.division_id` (ON DELETE CASCADE)
- **Strategy**: Same as 001 — FK off during rebuild
- **Legacy Handling**: Division-authorized grants NOT copied; logged to `migration_audit` table

### 003-005: Additive Columns
- No FK changes
- `tasks.deliverable_id` → `deliverables.deliverable_id`: App-layer validation only (no circular FK)
- `deliverables.task_id` → `tasks.task_id` (existing FK, ON DELETE CASCADE)

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

**Test Coverage (16 tests, all passing)**:
| Category | Tests | Type | Description |
|----------|-------|------|-------------|
| Actual SQL execution (001-005) | 5 | Substantive | Each migration file read and executed directly |
| Full sequence integration | 1 | Substantive (Integration) | All 5 migrations in order on same DB |
| Table rebuild preservation | 2 | Substantive (Integration) | Indexes, FK records, dependent tables |
| Backup & rollback (file-backed) | 1 | Substantive (Integration) | File copy backup, migration, restore, FK check |
| Migration ledger design validation | 2 | Design Validation (Proposed) | SHA-256 checksum tracking, transaction boundaries |
| Test classification | 5 | Placeholder (Documentation) | Unit, integration, application-layer distinction |
| **TOTAL** | **16** | **11 Substantive + 5 Placeholder** | |

**Verification Scope**:
- All five committed SQL files executed by tests
- Legacy grant conversion tested against actual Migration 002 file
- Foreign-key checks pass after table rebuilds (`PRAGMA foreign_key_check`)
- Standard indexes recreated after table rebuilds
- Dependent records survive table rebuilds
- Backup restoration tested against file-backed temporary database
- Migration ledger design validated (SHA-256 checksums, transaction boundaries); **proposed mechanism — no production runner implemented**
- Clear distinction: SQL file tests, integration tests, application-layer (not tested here)

---

## Production Safety Checklist

- [ ] All migrations tested against temporary database
- [ ] No migration executed against production `council.db`
- [ ] Phase 6 implementation remains unauthorized
- [ ] Phase 1-5 functionality verified unchanged
- [ ] Founder review and explicit authorization required before execution