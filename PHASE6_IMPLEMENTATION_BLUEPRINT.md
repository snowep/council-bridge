# Phase 6: Implementation Blueprint

## Overview

This blueprint maps every Phase 6 planned feature to the existing architecture in `src/database.ts`, `src/server.ts`, `src/memory.ts`, `src/council.ts`, and the Phase 6 planning docs (`PHASE6_ARCHITECTURE.md`, `PHASE6_IMPLEMENTATION_ROADMAP.md`, `PHASE6_SCHEMA_PLAN.md`, `PHASE6_DATABASE_MIGRATION_PLAN.md`).

**Philosophy**: Preserve existing single-row deliverable design and append-only audit-log approach. Do not redesign unrelated UI functionality. All database changes require Founder approval.

---

## A. Division Management

### Existing Architecture

**Database tables** (already exist in `src/database.ts`, created by Phase 4):
- `divisions` — 6 rows, one per division (Developer, Marketing, Finance, Creative, Research & Intelligence, Business Operations)
- `staff_agents` — staff agents with `division_id` FK
- `division_members` — links `division_id` + `staff_id` + `role` (head | member | specialist)

**Existing columns** in `divisions`:
- `division_id` TEXT PRIMARY KEY
- `name` TEXT NOT NULL UNIQUE
- `description` TEXT NOT NULL DEFAULT ''
- `head_staff_id` TEXT (validated at app layer, no circular FK)
- `budget_limit` REAL NOT NULL DEFAULT 0
- `permissions` TEXT NOT NULL DEFAULT '[]'
- `strategic_objectives` TEXT NOT NULL DEFAULT '[]'
- `created_at`, `updated_at`

**Existing columns** in `staff_agents`:
- `staff_id` TEXT PRIMARY KEY
- `name` TEXT NOT NULL
- `role` TEXT NOT NULL
- `division_id` TEXT NOT NULL FK → `divisions.division_id`
- `runtime_instances` TEXT NOT NULL DEFAULT '[]'
- `permissions` TEXT NOT NULL DEFAULT '[]'
- `status` TEXT NOT NULL DEFAULT 'active' ← **Phase 6: change to 'inactive'**
- `created_at`, `updated_at`

**Existing columns** in `division_members`:
- `division_id`, `staff_id` (PK composite)
- `role` TEXT NOT NULL DEFAULT 'member' ('head' | 'member' | 'specialist')
- `joined_at`

### Phase 6 Mapping

| Feature | Existing Arch | Phase 6 Change |
|---|---|---|
| List divisions | `listDivisions()` in council.ts, `getDivisionById`/`listDivisions` stmt | No change needed |
| Assign division head | App-layer: set `divisions.head_staff_id` | Founder-only via `assign_division_head` MCP tool |
| Update division | App-layer: `updateDivision()` in council.ts | Division Head–only via `update_division` MCP tool |
| List division specialists | `getStaffAgentsByDivision()` in council.ts + `division_members` | New `list_specialists` MCP tool |
| Verify one head per division | App-layer validation in `updateSeatStatus`/`seatApprovedCandidate` pattern | Enforce in service layer |

### New MCP Tools (Stage 3)

- `create_division(name, description, budget_limit, strategic_objectives)` — Founder-only
- `assign_division_head(staff_id, division_id)` — Founder-only
- `update_division(head_staff_id, budget_limit, objectives)` — Division Head–only
- `list_divisions()` — all divisions
- `list_specialists(division_id)` — specialists in division

### Service-Layer Enforcement

```typescript
// Division Head can only update their own division
update_division(division_id: string, head_staff_id?: string, budget_limit?: number, strategic_objectives?: string[]) {
  const division = this.getDivision(division_id);
  if (!division) throw new Error(`Division '${division_id}' not found`);
  
  // Verify current head matches or user is Founder
  if (division.head_staff_id && division.head_staff_id !== head_staff_id) {
    // Check if caller is Founder (ctx.owner_type === 'founder')
  }
  
  dbInstance.stmt.updateDivision.run(
    division_id,
    head_staff_id ?? division.head_staff_id,
    budget_limit ?? division.budget_limit,
    strategic_objectives ?? division.strategic_objectives
  );
}
```

---

## B. Staff Agent Management

### Existing Architecture

**Database schema** (`src/database.ts:671-683`):
- `staff_agents` table with FK to `divisions.division_id` ON DELETE CASCADE
- `division_members` links `staff_id` to divisions
- `head_staff_id` in `divisions` references staff agent but no FK (app-layer)

**Key constraints**:
- `status` IN ('active', 'inactive', 'terminated')
- `runtime_instances` JSON: `['claude']`, `['hermes']`, `['claude', 'hermes']`
- One staff agent per division membership via `division_members`

### Phase 6 Mapping

**Critical Change** (Migration 001): `staff_agents.status` DEFAULT changes from `'active'` to `'inactive'`. Staff agents start inactive until explicit Founder activation. This is the foundation for the approval workflow.

**Owner Model Extension** (from `PHASE6_SCHEMA_PLAN.md`):
- Staff agents have external approval state tracked in `council_shared` memory with `memory_type: 'division_head_approval'` or `'specialist_approval'`
- Agent remains `status = 'inactive'` until explicit Founder activation
- Dual-runtime: same `staff_id` works on both Claude Code and Hermes

### New MCP Tools (Stage 5)

- `register_staff_agent(staff_id, name, role, division_id, runtime_instances)` — onboards specialist
- `update_staff_status(staff_id, status)` — active/inactive/terminated
- `update_staff_permissions(staff_id, permissions)` — JSON array
- `suspend_staff_agent(staff_id)` — sets status to 'inactive'
- `retire_staff_agent(staff_id)` — sets status to 'terminated', removes from division_members

### Runtime Instance Tracking

| `runtime_instances` | Meaning |
|---|---|
| `['claude']` | Active only on Claude Code |
| `['hermes']` | Active only on Hermes Agent |
| `['claude', 'hermes']` | Dual-runtime, same logical employee |

### Service-Layer Enforcement

```typescript
register_staff_agent(input) {
  // Validate division exists
  const division = dbInstance.stmt.getDivisionById.get(input.division_id);
  if (!division) throw new Error(`Division '${input.division_id}' not found`);
  
  // Check division doesn't already have too many specialists
  const count = dbInstance.stmt.listStaffAgentsByDivision.all(input.division_id).length;
  if (count >= 7) throw new Error(`Division '${input.division_id}' max specialists reached`);
  
  // Check not already registered
  const existing = dbInstance.stmt.getStaffAgentById.get(input.staff_id);
  if (existing) throw new Error(`Staff agent '${input.staff_id}' already exists`);
  
  // Insert into staff_agents
  dbInstance.stmt.insertStaffAgent.run(
    input.staff_id, input.name, input.role, input.division_id,
    JSON.stringify(input.runtime_instances), JSON.stringify(input.permissions), 'inactive'
  );
  
  // Insert into division_members (role: specialist)
  dbInstance.stmt.insertDivisionMember.run(input.division_id, input.staff_id, 'specialist');
}
```

---

## C. Task Delegation

### Existing Architecture

**Database schema** (`src/database.ts:715-738`):
- `tasks` table with columns: task_id, title, description, assigned_to_type, assigned_to_id, created_by_type, created_by_id, status, priority, budget_allocated, due_at, completed_at

**Existing CHECK constraints**:
- `assigned_to_type` IN ('division', 'staff')
- `created_by_type` IN ('founder', 'council', 'division_head')
- `status` IN ('pending', 'in_progress', 'review', 'completed', 'cancelled')
- `priority` IN ('low', 'medium', 'high', 'critical')

### Phase 6 Mapping

**Migration 003 additions** (from `PHASE6_SCHEMA_PLAN.md`):
- `dependencies` TEXT DEFAULT '[]' — JSON array of task_ids for dependency tracking
- `deliverable_id` TEXT — **NOT a database FK** (Option B: app-layer validated, matches `deliverables.task_id`)

**Key design decisions from roadmap**:
- Tasks can be assigned to division or staff
- Created by founder, council, or division_head
- Priority: low | medium | high | critical (enum string, not integer)
- Lifecycle: pending → in_progress → review → completed/cancelled

### New MCP Tools (Stage 6)

- `create_task(title, description, assigned_to_type, assigned_to_id, priority, due_at, dependencies, budget_allocated)`
- `update_task(task_id, status, priority, due_at)`
- `list_tasks(assigned_to_type, assigned_to_id, status, priority)`
- `complete_task(task_id)`

### Dependency Tracking

- `dependencies` is a JSON array of task_ids
- Service-layer validation must prevent cycles (no task depends on itself transitively)
- A task can only start when all its dependencies are 'completed'

### Service-Layer Enforcement

```typescript
create_task(input) {
  // Validate assigned_to_type and assigned_to_id
  if (input.assigned_to_type === 'division') {
    const division = dbInstance.stmt.getDivisionById.get(input.assigned_to_id);
    if (!division) throw new Error(`Division '${input.assigned_to_id}' not found`);
  } else if (input.assigned_to_type === 'staff') {
    const agent = dbInstance.stmt.getStaffAgentById.get(input.assigned_to_id);
    if (!agent || agent.division_id !== input.assigned_to_id?.division_id) {
      // or just check agent exists in that division via division_members
    }
  }
  
  // Validate dependencies exist and are in a completable state
  if (input.dependencies && input.dependencies.length > 0) {
    for (const depId of input.dependencies) {
      const depTask = dbInstance.stmt.getTaskById.get(depId);
      if (!depTask) throw new Error(`Dependency task '${depId}' not found`);
      if (depTask.status !== 'completed') {
        throw new Error(`Dependency task '${depId}' must be completed before creating dependent task`);
      }
    }
  }
  
  const taskId = dbInstance.generateId();
  dbInstance.stmt.insertTask.run(
    taskId, input.title, input.description, input.assigned_to_type, input.assigned_to_id,
    input.created_by_type, input.created_by_id, 'pending', input.priority ?? 'medium',
    input.budget_allocated ?? 0, input.due_at ?? null,
    JSON.stringify(input.dependencies ?? []), null, null
  );
  
  return taskId;
}
```

### Deliverable Relationship: Option B (App-Level)

Per `PHASE6_SCHEMA_PLAN.md`:
- `tasks.deliverable_id` is **NOT a database FK**
- It is an application-level reference validated at the service layer
- On task creation: `deliverable_id` is nullable
- On deliverable submission: validate `deliverable.task_id === task.task_id`
- On deliverable deletion: clear `task.deliverable_id` or mark task for review

---

## D. Deliverable Management

### Existing Architecture

**Database schema** (`src/database.ts:740-757`):
- `deliverables` table with columns: deliverable_id, task_id, submitted_by_type, submitted_by_id, content, status, reviewed_by_type, reviewed_by_id, reviewed_at, created_at

**Existing CHECK constraints**:
- `submitted_by_type` IN ('staff', 'division')
- `status` IN ('submitted', 'accepted', 'rejected', 'revision_requested')

### Phase 6 Mapping

**Migration 004 additions** (from `PHASE6_SCHEMA_PLAN.md`):
- `file_references` TEXT DEFAULT '[]' — JSON array of file paths
- `task_relationships` TEXT DEFAULT '[]' — JSON array of task_ids
- `audit_log` TEXT DEFAULT '[]' — JSON array of `{by_type, by_id, action, timestamp, before, after}`

**Critical design** (from `PHASE6_SCHEMA_PLAN.md`):
- **Single-row deliverable design**: each deliverable is ONE row in the `deliverables` table
- **Append-only audit_log**: new entries appended, never modified
- Historical versions retrieved by reading `audit_log` entries in order
- `updated_at` on the row tracks last modification time
- No separate `deliverable_versions` table needed (matches `memory_versions` pattern)
- If full content versioning needed later, add `deliverable_versions` table referencing `deliverables`

### New MCP Tools (Stage 6)

- `create_deliverable(task_id, content, submitted_by_type, submitted_by_id)`
- `update_deliverable(deliverable_id, status, reviewed_by_type, reviewed_by_id)`
- `list_deliverables_by_task(task_id)`

### Audit Log Format

Each audit_log entry: `{by_type, by_id, action, timestamp, before, after}`
- `by_type`: 'founder' | 'council' | 'division_head'
- `by_id`: the actor's ID
- `action`: 'status_change' | 'content_update' | 'review'
- `timestamp`: ISO datetime
- `before`: previous state (JSON-safe)
- `after`: new state (JSON-safe)

### Service-Layer Enforcement

```typescript
create_deliverable(input) {
  // Validate task exists
  const task = dbInstance.stmt.getTaskById.get(input.task_id);
  if (!task) throw new Error(`Task '${input.task_id}' not found`);
  
  // Validate submitted_by_type
  if (input.submitted_by_type !== 'staff' && input.submitted_by_type !== 'division') {
    throw new Error(`submitted_by_type must be 'staff' or 'division'`);
  }
  
  const deliverableId = dbInstance.generateId();
  const now = new Date().toISOString();
  
  dbInstance.stmt.insertDeliverable.run(
    deliverableId, input.task_id, input.submitted_by_type, input.submitted_by_id,
    JSON.stringify(input.content ?? {}), 'submitted', null, null, now, now
  );
  
  // Link deliverable to task (app-level: set task.deliverable_id)
  // This is done at the app layer, not via DB FK
  
  return deliverableId;
}

update_deliverable(deliverable_id, input) {
  const deliverable = dbInstance.stmt.getDeliverableById.get(deliverable_id);
  if (!deliverable) throw new Error(`Deliverable '${deliverable_id}' not found`);
  
  // Build audit log entry
  const now = new Date().toISOString();
  const before = {
    status: deliverable.status,
    reviewed_by_type: deliverable.reviewed_by_type,
    reviewed_by_id: deliverable.reviewed_by_id,
    reviewed_at: deliverable.reviewed_at
  };
  
  // Update the deliverable row
  dbInstance.stmt.updateDeliverable.run(
    deliverable_id,
    input.status ?? deliverable.status,
    input.reviewed_by_type ?? deliverable.reviewed_by_type,
    input.reviewed_by_id ?? deliverable.reviewed_by_id,
    input.reviewed_at ?? deliverable.reviewed_at,
    now
  );
  
  // Append to audit_log — this requires careful handling since SQLite JSON
  // We store the audit_log as JSON and append entries
  const currentAudit = deliverable.audit_log ? JSON.parse(deliverable.audit_log) : [];
  currentAudit.push({
    by_type: input.reviewed_by_type ?? 'system',
    by_id: input.reviewed_by_id ?? 'system',
    action: 'status_change',
    timestamp: now,
    before,
    after: { status: input.status ?? deliverable.status }
  });
  
  // Update the row with new audit_log
  dbInstance.stmt.updateDeliverable.run(
    deliverable_id,
    input.status ?? deliverable.status,
    input.reviewed_by_type ?? deliverable.reviewed_by_type,
    input.reviewed_by_id ?? deliverable.reviewed_by_id,
    input.reviewed_at ?? deliverable.reviewed_at,
    now,
    JSON.stringify(currentAudit)
  );
  
  return dbInstance.stmt.getDeliverableById.get(deliverable_id);
}
```

---

## E. Cross-Division Collaboration

### Existing Architecture

**Database schema** (`src/database.ts:698-713`):
- `cross_division_shares` table with columns: share_id, memory_id, division_id, granted_by_type, granted_by_id, granted_at, revoked_at

**Existing CHECK constraint**:
- `granted_by_type` IN ('division', 'founder')

**Existing indexes**:
- `idx_cross_division_shares_memory` on memory_id
- `idx_cross_division_shares_division` on division_id

### Phase 6 Mapping

**Migration 002** (from `PHASE6_DATABASE_MIGRATION_PLAN.md`): `granted_by_type` CHECK changes from `('division', 'founder')` to `('founder')` only. Division head grants are revoked and logged to `migration_audit`.

**Migration 005** (from `PHASE6_DATABASE_MIGRATION_PLAN.md`): Stage 7 additions:
- `request_type` TEXT CHECK ('task_delegate' | 'deliverable_share' | 'memory_access' | 'resource_request')
- `status` TEXT CHECK ('pending' | 'approved' | 'rejected') DEFAULT 'pending'
- `justification` TEXT
- `priority` TEXT CHECK ('low' | 'medium' | 'high' | 'critical') DEFAULT 'medium'
- `deadline` TEXT (ISO datetime, nullable)
- `approved_by_type` TEXT (nullable) — always 'founder'
- `approved_by_id` TEXT (nullable) — founder's staff_id
- `approved_at` TEXT (nullable)

### Grant Treatment Table (from migration plan)

| Grant Type | Action | Rationale |
|---|---|---|
| `granted_by_type = 'founder'` | **Preserved** — copied to new table | Legitimate Founder authorization |
| `granted_by_type = 'division'` | **Revoked** — NOT copied, logged to `migration_audit` | No fabricated Founder approval; requires explicit reauthorization |

### New MCP Tools (Stage 7)

- `grant_cross_division_access(memory_id, division_id)` — Founder-only (existing, validated)
- `revoke_cross_division_access(memory_id, division_id)` — Founder-only (existing, validated)
- `list_pending_cross_division_requests(division_id)` — list requests awaiting Founder approval
- `request_cross_division_access(from_division, to_division, memory_id, justification, priority, deadline, request_type)` — Division Head requests
- `approve_cross_division_access(request_id)` — Founder-only
- `revoke_cross_division_access(request_id)` — Founder-only

### Service-Layer Enforcement (cross-division requests)

```typescript
request_cross_division_access(input) {
  const fromDivision = dbInstance.stmt.getDivisionById.get(input.from_division);
  if (!fromDivision) throw new Error(`From division '${input.from_division}' not found`);
  
  const toDivision = dbInstance.stmt.getDivisionById.get(input.to_division);
  if (!toDivision) throw new Error(`To division '${input.to_division}' not found`);
  
  // Only Division Heads can request
  // Check if requester is Division Head of from_division
  // (app-layer: validate ctx.owner_type === 'division' && ctx.owner_id === from_division)
  
  const requestId = dbInstance.generateId();
  const now = new Date().toISOString();
  
  dbInstance.stmt.insertCrossDivisionShare.run(
    requestId, input.memory_id ?? dbInstance.generateId(), input.to_division,
    'division', input.from_division, now, null,  // revoked_at null = active pending request
    input.request_type, 'pending', input.justification,
    input.priority ?? 'medium', input.deadline ?? null,
    null, null, null  // approved_by_type, approved_by_id, approved_at
  );
  
  return requestId;
}

approve_cross_division_access(request_id) {
  // Founder-only check
  const share = dbInstance.stmt.getCrossDivisionShares.all(request_id);
  if (!share.length) throw new Error(`Cross-division share '${request_id}' not found`);
  
  const shareRow = share[0];
  if (shareRow.granted_by_type !== 'founder') throw new Error(`Only Founder can approve; this was a division request`);
  
  if (shareRow.status === 'approved') throw new Error(`Request '${request_id}' already approved`);
  
  const now = new Date().toISOString();
  dbInstance.stmt.updateCrossDivisionShare.run(
    'approved', now, request_id  // status=approved, approved_at=now, where share_id=request_id
  );
  
  // Log access
  dbInstance.stmt.insertMemoryAccess.run(
    dbInstance.generateId(), request_id, shareRow.memory_version,
    'founder', 'founder', 'claude', 'link', now
  );
  
  return { success: true, request_id, status: 'approved' };
}
```

### Cross-Division Share Grant (Founder-only, preserved from Phase 4)

```typescript
grantCrossDivisionAccess(ctx, input) {
  const memory = dbInstance.stmt.getMemoryById.get(input.memory_id);
  if (!memory) throw new Error(`Memory '${input.memory_id}' not found`);
  if (memory.category !== 'cross_division') {
    throw new Error(`Cross-division sharing only allowed for 'cross_division' category`);
  }
  
  // Only division head or founder can grant (Phase 4 existing)
  // Phase 6 tightens to Founder only per migration 002
  if (ctx.owner_type !== 'division' && ctx.owner_type !== 'founder') {
    throw new Error(`Only division head or founder can grant cross-division access`);
  }
  
  // ... existing logic
}
```

---

## F. Dashboard Integration

### Existing Architecture

The dashboard UI currently covers Phase 5 functionality:
- Council meetings, personas, memory, messages
- No division/staff/task/deliverable views yet

Per `PHASE6_IMPLEMENTATION_ROADMAP.md:231-241`, Stage 9 Dashboard Integration is **optional** and must **preserve existing Phase 5 UI**. No new UI components should break existing functionality.

### Phase 6 Mapping

**Optional UI enhancements** (Stage 9, defer to Phase 7):

| Section | Existing Pattern | Phase 6 Addition |
|---|---|---|
| Organization overview | Not implemented (Phase 5) | Optional: division list with head indicators |
| Divisions list | Not implemented | Optional: show 6 divisions, head status |
| Division details | Not implemented | Optional: specialist directory per division |
| Agent status panels | Not implemented | Optional: staff agent status (active/inactive/terminated) |
| Task management | Not implemented | Optional: task list, create/update, deliverable review |
| Deliverable browser | Not implemented | Optional: submit, review, status tracking |
| Cross-division request queue | Not implemented | Optional: pending requests, approval flow |

**Critical constraint**: Any UI changes must not break the existing 106+ Phase 1-4 tests. The dashboard should remain backward-compatible.

### MCP Tool Exports for Dashboard

The new MCP tools registered in Stage 8 make data available to any frontend:

```typescript
// These tools are already registered in server.ts and available to any client
// Division management: create_division, assign_division_head, update_division, list_divisions, list_specialists
// Staff lifecycle: register_staff_agent, update_staff_status, update_staff_permissions, suspend_staff_agent, retire_staff_agent  
// Task management: create_task, update_task, list_tasks, complete_task
// Deliverable management: create_deliverable, update_deliverable, list_deliverables_by_task
// Cross-division: grant_cross_division_access, revoke_cross_division_access, list_pending_cross_division_requests, request_cross_division_access, approve_cross_division_access, revoke_cross_division_access
```

### Integration Checklist

- [ ] All 25+ existing MCP tools remain functional (verified by test suite)
- [ ] New tools registered with formal Zod schemas (per roadmap)
- [ ] Dashboard renders at 3-column (desktop), 2-column (tablet ≥768px), 1-column (mobile <768px)
- [ ] Navigation works at all screen sizes
- [ ] Tap targets ≥44px at mobile widths
- [ ] No overflow, clipping, or unreadable content at any breakpoint
- [ ] No regression in Phase 5 UI: council, memory, meetings, chat

---

## Migration Summary

| # | Migration | Target | Founder Approval |
|---|---|---|---|
| 001 | `staff_agents.status` DEFAULT 'active' → 'inactive' | Table rebuild | ✅ Yes |
| 002 | `cross_division_shares.granted_by_type` → 'founder' only | Table rebuild | ✅ Yes |
| 003 | `tasks`: add `dependencies` TEXT, `deliverable_id` TEXT (app-level) | ALTER TABLE | ✅ Yes |
| 004 | `deliverables`: add `file_references`, `task_relationships`, `audit_log` TEXT columns | ALTER TABLE | ✅ Yes |
| 005 | `cross_division_shares`: add request-tracking columns (request_type, status, justification, priority, deadline, approved_by_type, approved_by_id, approved_at) | ALTER TABLE | ✅ Yes |

**All 5 migrations require explicit Founder authorization before execution.** No data to migrate (tables empty from Phases 1-4). Row insertion happens via app-layer scripts after Founder approval.

---

## Tool Registration Checklist (Stage 8)

All new MCP tools must be registered with the existing MCP server in `src/server.ts`, following the pattern of existing tools:

- [ ] `create_division` — Zod schema: `{name, description?, budget_limit?, strategic_objectives?}`
- [ ] `assign_division_head` — Zod schema: `{staff_id: uuid, division_id}`
- [ ] `update_division` — Zod schema: `{division_id, head_staff_id?: uuid, budget_limit?: number, strategic_objectives?: string[]}`
- [ ] `list_divisions` — no params (already exists, verify)
- [ ] `list_specialists` — Zod schema: `{division_id}`
- [ ] `register_staff_agent` — Zod schema: `{staff_id: uuid, name, role, division_id, runtime_instances: enum[]}`
- [ ] `update_staff_status` — Zod schema: `{staff_id: uuid, status: enum['active','inactive','terminated']}`
- [ ] `update_staff_permissions` — Zod schema: `{staff_id: uuid, permissions: string[]}`
- [ ] `suspend_staff_agent` — Zod schema: `{staff_id: uuid}`
- [ ] `retire_staff_agent` — Zod schema: `{staff_id: uuid}`
- [ ] `create_task` — Zod schema: full task creation schema (per roadmap)
- [ ] `update_task` — Zod schema: `{task_id: uuid, status?, priority?, due_at?}`
- [ ] `list_tasks` — Zod schema: filter options
- [ ] `complete_task` — Zod schema: `{task_id: uuid}`
- [ ] `create_deliverable` — Zod schema: `{task_id: uuid, content: string, submitted_by_type: enum, submitted_by_id}`
- [ ] `update_deliverable` — Zod schema: `{deliverable_id: uuid, status?, reviewed_by_type?, reviewed_by_id?}`
- [ ] `list_deliverables_by_task` — Zod schema: `{task_id}`
- [ ] `grant_cross_division_access` — already exists, verify Zod schema
- [ ] `revoke_cross_division_access` — already exists, verify Zod schema
- [ ] `request_cross_division_access` — Zod schema: `{from_division, to_division, memory_id?, justification, priority?, deadline?, request_type}`
- [ ] `approve_cross_division_access` — Zod schema: `{request_id: uuid}`
- [ ] `revoke_cross_division_access` (request) — Zod schema: `{request_id: uuid}`
- [ ] `list_pending_cross_division_requests` — Zod schema: `{division_id}`

All tools must follow the existing pattern: register on `mcpServer`, handle in `/mcp` POST route, return `{content: [{type: 'text', text: JSON.stringify(result)}]}`.

---

## Verification

After implementing all Phase 6 changes, run:

```powershell
npm test              -- 106+ existing tests must still pass
npm run typecheck     -- 0 TypeScript errors
npm run build         -- dist/ compiles clean
sqlite3 data/council.db ".schema" -- verify migration SQL produces correct schema
npx tsx --test tests/phase6_migration_verification.test.ts -- all 16 tests PASS
```

**Acceptance Criteria** (from `PHASE6_IMPLEMENTATION_ROADMAP.md:292-303`):
- [ ] All 6 Division Heads appointed with Founder approval
- [ ] All 45 specialist agents onboarded with dual-runtime support
- [ ] Database: 6 divisions, 45 staff_agents, division_members links populated
- [ ] MCP: All new tools registered and functional (task, deliverable, cross-division, lifecycle)
- [ ] Permission model: Division Head authority enforced at service layer; Founder-respected
- [ ] Privacy: Division/staff/founder ownership boundaries preserved; no FTS5 bypass
- [ ] Tests: `npm test` passes (106 existing + new Phase 6 suites)
- [ ] Build: `tsc --noEmit` 0 errors, `npm run build` clean
- [ ] Dashboard: Phase 5 functionality intact; optional Phase 6 sections added without regression
- [ ] Founder: Explicit authorization granted for Phase 6 implementation