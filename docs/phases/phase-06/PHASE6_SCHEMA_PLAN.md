# Phase 6: Schema Plan

## Database Tables (already exist, FK-ready)

### Divisions
```sql
CREATE TABLE IF NOT EXISTS divisions (
  division_id       TEXT PRIMARY KEY,
  name              TEXT NOT NULL UNIQUE,
  description       TEXT NOT NULL DEFAULT '',
  head_staff_id     TEXT,                              -- Staff agent serving as division head
  budget_limit      REAL NOT NULL DEFAULT 0,
  permissions       TEXT NOT NULL DEFAULT '[]',        -- JSON array of permission strings
  strategic_objectives TEXT NOT NULL DEFAULT '[]',     -- JSON array
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
```
- 6 rows (one per division)
- `head_staff_id` FK to staff_agents — validated at app layer, no circular FK
- Index on `head_staff_id`

### Staff Agents

**Current Database Schema (src/database.ts):**
```sql
CREATE TABLE IF NOT EXISTS staff_agents (
  staff_id          TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  role              TEXT NOT NULL,                     -- Professional role/title
  division_id       TEXT NOT NULL,                     -- Division membership
  runtime_instances TEXT NOT NULL DEFAULT '[]',        -- JSON: ['claude', 'hermes']
  permissions       TEXT NOT NULL DEFAULT '[]',        -- JSON array of permission strings
  status            TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'terminated')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
);
```

**Proposed Phase 6 Target Schema (requires migration 001):**
```sql
CREATE TABLE IF NOT EXISTS staff_agents (
  staff_id          TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  role              TEXT NOT NULL,                     -- Professional role/title
  division_id       TEXT NOT NULL,                     -- Division membership
  runtime_instances TEXT NOT NULL DEFAULT '[]',        -- JSON: ['claude', 'hermes']
  permissions       TEXT NOT NULL DEFAULT '[]',        -- JSON array of permission strings
  status            TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active', 'inactive', 'terminated')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
);
```

- 45 rows (one per specialist)
- `division_id` FK to divisions
- `status`: active | inactive | terminated
- **Current default: 'active'** (Phase 6 target: 'inactive' — migration 001 required)
- `runtime_instances`: JSON array, shared across both runtimes
- **Approval state tracked externally**: Founder approval recorded in `council_shared` memory with `memory_type: 'division_head_approval'` or `'specialist_approval'`. Agent remains `status = 'inactive'` until explicit Founder activation.
- **Migration required**: Change DEFAULT from 'active' to 'inactive'. See `PHASE6_DATABASE_MIGRATION_PLAN.md`.

### Division Members
```sql
CREATE TABLE IF NOT EXISTS division_members (
  division_id    TEXT NOT NULL,
  staff_id       TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'member',       -- 'head' | 'member' | 'specialist'
  joined_at      TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (division_id, staff_id),
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES staff_agents(staff_id) ON DELETE CASCADE
);
```
- 45+6=51 rows total (links staff to divisions)
- role: head | member | specialist
- Enforces one Division Head per division via app-layer validation

### Cross-Division Shares

**Current Database Schema (src/database.ts):**
```sql
CREATE TABLE IF NOT EXISTS cross_division_shares (
  share_id        TEXT PRIMARY KEY,
  memory_id       TEXT NOT NULL,
  division_id     TEXT NOT NULL,                       -- Division granted access
  granted_by_type TEXT NOT NULL                        -- 'division' | 'founder'
    CHECK (granted_by_type IN ('division', 'founder')),
  granted_by_id   TEXT NOT NULL,                       -- division_id | 'founder'
  granted_at      TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at      TEXT,                                -- NULL = active
  FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
  UNIQUE(memory_id, division_id)
);
```

**Proposed Phase 6 Target Schema (requires migration 002 + 005):**
```sql
CREATE TABLE IF NOT EXISTS cross_division_shares (
  share_id        TEXT PRIMARY KEY,
  memory_id       TEXT NOT NULL,
  division_id     TEXT NOT NULL,                       -- Division granted access
  granted_by_type TEXT NOT NULL                        -- 'founder' only
    CHECK (granted_by_type IN ('founder')),
  granted_by_id   TEXT NOT NULL,                       -- 'founder'
  granted_at      TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at      TEXT,                                -- NULL = active
  -- Stage 7 additions (migration 005):
  request_type    TEXT CHECK (request_type IN ('task_delegate', 'deliverable_share', 'memory_access', 'resource_request')),
  status          TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  justification   TEXT,
  priority        TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  deadline        TEXT,
  approved_by_type TEXT,
  approved_by_id   TEXT,
  approved_at      TEXT,
  FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
  UNIQUE(memory_id, division_id)
);
```

- Explicit memory access grants between divisions
- **Current: Granted by division head or founder** (`granted_by_type` allows both)
- **Phase 6 target: Granted by Founder only** (migration 002 required — restricts CHECK constraint)
- Links to `memory_entries.memory_id` via FK
- `revoked_at` tracks revocation (NULL = active grant)
- UNIQUE constraint prevents duplicate grants
- **Migration required**: Restrict `granted_by_type` CHECK constraint to 'founder' only. Handle existing 'division' records via revocation + audit log.

### Tasks
```sql
CREATE TABLE IF NOT EXISTS tasks (
  task_id           TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  assigned_to_type  TEXT NOT NULL                      -- 'division' | 'staff'
    CHECK (assigned_to_type IN ('division', 'staff')),
  assigned_to_id    TEXT NOT NULL,                     -- division_id | staff_id
  created_by_type   TEXT NOT NULL                      -- 'founder' | 'council' | 'division_head'
    CHECK (created_by_type IN ('founder', 'council', 'division_head')),
  created_by_id     TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'review', 'completed', 'cancelled')),
  priority          TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  budget_allocated  REAL NOT NULL DEFAULT 0,
  due_at            TEXT,
  completed_at      TEXT,
  -- Migration 003 additions:
  dependencies      TEXT DEFAULT '[]',                  -- JSON array of task_ids
  deliverable_id    TEXT,                               -- FK reference (app-layer validated)
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
```
- Task lifecycle: pending → in_progress → review → completed/cancelled
- Priority: low | medium | high | critical (enum, not integer)
- Assignment types: division | staff
- Created by: founder | council | division_head
- Budget allocation tracked per task
- **`dependencies`**: JSON array of task_ids for dependency tracking (migration 003)
- **`deliverable_id`**: Reference to deliverables table — **NOT a database FK** (Option B: app-layer validated). See rationale below.

### Deliverables
```sql
CREATE TABLE IF NOT EXISTS deliverables (
  deliverable_id    TEXT PRIMARY KEY,
  task_id           TEXT NOT NULL,
  submitted_by_type TEXT NOT NULL                      -- 'staff' | 'division'
    CHECK (submitted_by_type IN ('staff', 'division')),
  submitted_by_id   TEXT NOT NULL,
  content           TEXT NOT NULL,                     -- JSON payload
  status            TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'accepted', 'rejected', 'revision_requested')),
  reviewed_by_type  TEXT,                              -- 'founder' | 'council' | 'division_head'
  reviewed_by_id    TEXT,
  reviewed_at       TEXT,
  -- Migration 004 additions:
  file_references   TEXT DEFAULT '[]',                 -- JSON array of file paths
  task_relationships TEXT DEFAULT '[]',                -- JSON array of task_ids
  audit_log         TEXT DEFAULT '[]',                 -- JSON array of {by_type, by_id, action, timestamp, before, after}
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);
```
- Lifecycle: submitted → accepted | rejected | revision_requested
- Submitted by: staff | division
- Reviewed by: founder | council | division_head
- Content: JSON payload
- **Migration 004 additions**: `file_references`, `task_relationships`, `audit_log` (all JSON)

---

## Deliverable Relationship Decision: Option B — Application-Level

**Decision**: `tasks.deliverable_id` is **NOT a database foreign key**. It is an application-level reference validated at the service layer.

**Rationale**:
1. **Circular FK risk**: `tasks` → `deliverables` (via `deliverable_id`) and `deliverables` → `tasks` (via existing `task_id` FK) creates a cycle SQLite cannot enforce cleanly
2. **Temporal flexibility**: Task may exist before deliverable; deliverable may be deleted while task remains
3. **Service-layer validation provides**:
   - On task creation: `deliverable_id` nullable
   - On deliverable submission: validate `deliverable.task_id === task.task_id`
   - On deliverable deletion: clear `task.deliverable_id` or mark task for review
   - Queries: `JOIN` available but not DB-enforced

**Documentation Updated**:
- `PHASE6_DATABASE_MIGRATION_PLAN.md`: Migration 003 description corrected
- `PHASE6_IMPLEMENTATION_ROADMAP.md`: MCP tool contracts updated
- This file: Explicit Option B declaration

---

## Indexes (already created)
- `idx_divisions_head` on divisions(head_staff_id)
- `idx_staff_agents_division` on staff_agents(division_id)
- `idx_staff_agents_status` on staff_agents(status)
- `idx_division_members_division` on division_members(division_id)
- `idx_division_members_staff` on division_members(staff_id)
- `idx_cross_division_shares_division` on cross_division_shares(division_id)
- `idx_cross_division_shares_memory` on cross_division_shares(memory_id)
- `idx_tasks_assigned` on tasks(assigned_to_type, assigned_to_id)
- `idx_tasks_status` on tasks(status)
- `idx_tasks_created_by` on tasks(created_by_type, created_by_id)
- `idx_deliverables_task` on deliverables(task_id)
- `idx_deliverables_status` on deliverables(status)

---

## Migration Strategy

| Migration | File | Type | Target Table | Depends On |
|-----------|------|------|--------------|------------|
| 001 | 001_staff_agents_default_inactive.sql | Table Rebuild | staff_agents | None |
| 002 | 002_cross_division_shares_founder_only.sql | Table Rebuild | cross_division_shares | None |
| 003 | 003_tasks_add_columns.sql | ALTER TABLE | tasks | 001, 002 |
| 004 | 004_deliverables_add_columns.sql | ALTER TABLE | deliverables | 001, 002 |
| 005 | 005_cross_division_shares_stage7.sql | ALTER TABLE | cross_division_shares | 002 |

**Total**: 5 logical migrations (2 rebuilds + 3 additive)
- Tables are `CREATE TABLE IF NOT EXISTS` — idempotent, safe to re-run
- No data to migrate (tables empty from Phases 1-4)
- Add rows via app-layer scripts after Founder approval
- Schema v4.0.0 already baked into Phase 4; no version bump needed

See `PHASE6_DATABASE_MIGRATION_PLAN.md` for complete migration details, backup/rollback procedures, and verification tests.

---

## Deliverable Versioning Strategy (Resolves A1)

**Approach: Single-row with `audit_log` JSON column (added by migration 004)**

- Each deliverable is a single row in `deliverables` table
- `audit_log` JSON array records every status change: `{by_type, by_id, action, timestamp, before, after}`
- Immutable append-only: new entries appended, never modified
- Historical versions retrieved by reading `audit_log` entries in order
- Approval history preserved in `reviewed_by_type`, `reviewed_by_id`, `reviewed_at` + `audit_log`
- `updated_at` on the row tracks last modification time
- No separate `deliverable_versions` table needed (simpler, matches DB pattern from `memory_versions`)
- If full content versioning needed later, add `deliverable_versions` table referencing `deliverables`