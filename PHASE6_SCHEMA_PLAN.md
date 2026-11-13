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
- **Default: 'inactive'** — newly created agents are non-operational
- `runtime_instances`: JSON array, shared across both runtimes
- **Approval state tracked externally**: Founder approval recorded in `council_shared` memory with `memory_type: 'division_head_approval'` or `specialist_approval`. Agent remains `status = 'inactive'` until explicit Founder activation.

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
```sql
CREATE TABLE IF NOT EXISTS cross_division_shares (
  share_id        TEXT PRIMARY KEY,
  memory_id       TEXT NOT NULL,
  division_id     TEXT NOT NULL,                       -- Division granted access
  granted_by_type TEXT NOT NULL                        -- 'founder'
    CHECK (granted_by_type IN ('founder')),
  granted_by_id   TEXT NOT NULL,                       -- 'founder'
  granted_at      TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at      TEXT,                                -- NULL = active
  FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
  UNIQUE(memory_id, division_id)
);
```
- Explicit memory access grants between divisions
- Granted by Founder only
- Links to `memory_entries.memory_id` via FK
- `revoked_at` tracks revocation (NULL = active grant)
- UNIQUE constraint prevents duplicate grants

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
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
```
- Task lifecycle: pending → in_progress → review → completed/cancelled
- Priority: low | medium | high | critical (enum, not integer)
- Assignment types: division | staff (seat and founder removed in actual DB)
- Created by: founder | council | division_head
- Budget allocation tracked per task
- Dependencies and deliverable_id not in current DB — add during implementation if needed

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
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);
```
- Lifecycle: submitted → accepted | rejected | revision_requested
- Submitted by: staff | division (seat and founder removed in actual DB)
- Reviewed by: founder | council | division_head
- Content: JSON payload (not file path/summary)
- `file_references`, `task_relationships`, `audit_log` not in current DB — add during implementation if needed

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

## Migration Strategy
- Tables are `CREATE TABLE IF NOT EXISTS` — idempotent, safe to re-run
- No data to migrate (tables empty from Phases 1-4)
- Add rows via app-layer scripts after Founder approval
- Schema v4.0.0 already baked into Phase 4; no version bump needed
- **Implementation additions** (empty tables, safe to ALTER):
  - `tasks.dependencies` JSON column
  - `tasks.deliverable_id` FK column
  - `deliverables.file_references` JSON column
  - `deliverables.task_relationships` JSON column
  - `deliverables.audit_log` JSON column

## Deliverable Versioning Strategy (Resolves A1)

**Approach: Single-row with `audit_log` JSON column (to be added during implementation)**

- Each deliverable is a single row in `deliverables` table
- `audit_log` JSON array records every status change: `{by_type, by_id, action, timestamp, before, after}`
- Immutable append-only: new entries appended, never modified
- Historical versions retrieved by reading `audit_log` entries in order
- Approval history preserved in `reviewed_by_type`, `reviewed_by_id`, `reviewed_at` + `audit_log`
- `updated_at` on the row tracks last modification time
- No separate `deliverable_versions` table needed (simpler, matches DB pattern from `memory_versions`)
- If full content versioning needed later, add `deliverable_versions` table referencing `deliverables`