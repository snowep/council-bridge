# Phase 6: Permission Implementation Specification

This document translates the Phase 6 Permission Model into implementable rules covering all permission aspects. Each operation specifies: who may perform it, conditions, data access, recording requirements, and failure behavior.

---

## 1. Founder Authority

### 1.1 Founder Operations Table

| Operation | Who | Conditions | Data Access | Recording | Failure Behavior |
|-----------|-----|------------|-------------|-----------|------------------|
| Create Division Head appointment | Founder | Valid candidate, valid division | `divisions.head_staff_id`, `council_shared` memory | `memory_versions` chain, `memory_access` log | Rejects invalid staff_id or division_id |
| Activate Division Head | Founder | Appointment exists, not activated | `staff_agents.status`, `council_shared` memory | `memory_access` log | Requires `activation_authorized = true` |
| Suspend Division Head | Founder | Active status | `staff_agents.status` | `memory_access` log | Rejects if already inactive |
| Retire Division Head | Founder | Valid staff_id | `divisions.head_staff_id`, `staff_agents.status` | `memory_access` log | Rejects if not head or not found |
| Grant cross-division access | Founder | Valid memory_id, valid division_id | `cross_division_shares` table | `memory_access` log | Rejects if memory or division invalid |
| Revoke cross-division access | Founder | Active share exists | `cross_division_shares` table | `memory_access` log | Silently succeeds if no active share |
| Create task | Founder | Valid input | `tasks` table | Auto via `task_history` | Rejects invalid assigned_to_type/id |
| Update any memory | Founder | Valid memory access | Any memory category | `memory_access` log | None (Founder has full access) |
| Approve constitution | Founder | Valid version | `constitutions` table | `founder_approvals` table | None |
| Create candidate | Founder seat only | Valid proposal | `candidates` table | `memory_access` log | Rejects non-founder seat |
| Vote on candidate | Founder seat only | Valid candidate | `founder_votes` table | Audit by design | Rejects duplicate vote |

### 1.2 Founder Bypass with Audit Requirements

```sql
-- Every Founder action creates:
-- 1. memory_version entry (if memory modified)
-- 2. memory_access log entry
-- 3. founder_approvals entry (for Constitution/Appointment actions)
```

---

## 2. Division Head Authority

### 2.1 Division Head Operations Table

| Operation | Who | Conditions | Data Access | Recording | Failure Behavior |
|-----------|-----|------------|-------------|-----------|------------------|
| Assign/ reassign specialists | Division Head | Within division scope | `division_members`, `staff_agents` | N/A | Rejects cross-division assignment |
| Create task (own division) | Division Head | Valid division | `tasks` table | `task_history` via trigger | Rejects if division mismatch |
| Update task status (own division) | Division Head | Task assigned to division | `tasks` table | `task_history` | Rejects if task not in division |
| Create deliverable | Division Head | Task in division | `deliverables` table | `task_history` | Rejects if task not in division |
| Review deliverable | Division Head | Task assigned to division | `deliverables`, `tasks` | `memory_access` log | Rejects if not assigned to division |
| Request cross-division share | Division Head | Valid memory, valid target division | Request logged in `council_shared` memory | `memory_versions` | Request must be Founder-approved |

### 2.2 Division-Level Memory Access Rules

| Category | Read | Write | Notes |
|----------|------|-------|-------|
| `division_shared` | All division members | All division members | Ownership type = division |
| `division_private` | Division Head only | Division Head only | `owner_type = division`, `owner_id = division_id` |
| `task_history` | Task assignee, creator, Founder, Division Head | Task system only | Scoped by task assignment |

---

## 3. Specialist Authority

### 3.1 Specialist Operations Table

| Operation | Who | Conditions | Data Access | Recording | Failure Behavior |
|-----------|-----|------------|-------------|-----------|------------------|
| Submit task update | Specialist | Assigned to self or division | `tasks.status` | `task_history` | Rejects if not assigned |
| Submit deliverable | Specialist | Linked task | `deliverables` table | `task_history` | Rejects if task not assigned to self/division |
| Review task | Specialist | Division Head review | N/A | N/A | Specialist cannot self-review |

### 3.2 Staff Private Memory Access

| Operation | Who | Conditions | Data Access |
|-----------|-----|------------|-------------|
| Read `staff_private` | Own staff agent (both runtimes) | Valid staff_id | `owner_type = staff` |
| Write `staff_private` | Own staff agent (both runtimes) | Valid staff_id | `owner_type = staff` |

---

## 4. Founder-Private Memory

### 4.1 Rules

| Operation | Who | Conditions | Data Access |
|-----------|-----|------------|-------------|
| Create | Founder only | N/A | `owner_type = founder` |
| Read | Founder only | N/A | `memory_entries` with `owner_type = founder` |
| Write | Founder only | N/A | Versioned updates via `memory_versions` |
| Delete | Founder only | Archival only | `archived_at` set |

### 4.2 Implementation

```sql
-- Query filter: only founder can access
WHERE owner_type = 'founder' AND owner_id = 'founder'
-- OR
WHERE owner_type = 'founder'  -- Founder has full access
```

---

## 5. Division-Owned Memory

### 5.1 Access Control Matrix

| Operation | Division Head | Specialist |
|-----------|---------------|------------|
| Read `division_shared` | Yes | Yes |
| Write `division_shared` | Yes | Yes |
| Read `division_private` | Yes | No |
| Write `division_private` | Yes | No |
| Create task (division scope) | Yes | Yes (self-assigned only) |
| Create task (staff scope) | Yes | Yes |

### 5.2 Query Layer Enforcement

```sql
-- Division context queries include:
WHERE division_id = ? AND (
  m.category = 'division_shared'
  OR (m.category = 'division_private' AND m.owner_id = division_id)
)
```

---

## 6. Cross-Division Sharing

### 6.1 Sharing Request Workflow

| Step | Actor | Action | Conditions | Result |
|------|-------|--------|------------|--------|
| 1 | Division Head A | Request share | Valid memory_id, target division_id | Request stored in `cross_division_shares` with `status = 'pending'` |
| 2 | System | Notify Founder | Request exists | Email/MCP message sent |
| 3 | Founder | Approve/Reject | Valid request | `status = 'approved'` or `'rejected'`, `approved_by_type/id/at` set |
| 4 | System | Update permissions | Approved request | Division gains query access |

### 6.2 Cross-Division Access Query Filter

```sql
-- For division context:
WHERE m.memory_id IN (
  SELECT memory_id FROM cross_division_shares
  WHERE division_id = ? AND revoked_at IS NULL AND status = 'approved'
)
```

### 6.3 Implementation Constraints

```sql
-- Migration 002 enforces Founder-only grants:
CHECK (granted_by_type IN ('founder'))
-- 'division' value removed from valid options
```

---

## 7. Task Ownership

### 7.1 Task Assignment Rules

| Assignment Type | Creator Allowed | Notes |
|-----------------|-----------------|-------|
| `assigned_to_type = 'staff'` | Founder, Division Head, Specialist | Individual assignment |
| `assigned_to_type = 'division'` | Founder, Division Head | Division-wide assignment |

### 7.2 Task Status Transition Permissions

| From → To | Who Can Transition | Conditions |
|-----------|-------------------|------------|
| `pending` → `in_progress` | Division Head, Assignee | Valid assignee status |
| `in_progress` → `review` | Division Head, Assignee | Deliverable exists or self-review |
| `review` → `completed` | Division Head, Founder | Review approved |
| `review` → `pending` | Division Head, Founder | Task rejected |
| Any → `cancelled` | Founder only | Explicit cancellation |

### 7.3 Task Creation Input Schema

```typescript
type CreateTaskInput = {
  title: string;
  description?: string;
  assigned_to_type: 'staff' | 'division';
  assigned_to_id: string;  // staff_id or division_id
  created_by_type: 'founder' | 'council' | 'division_head';
  created_by_id: string;   // seat_id or staff_id or division_id
  status?: 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  budget_allocated?: number;
  due_at?: string;         // ISO datetime
  dependencies?: string[]; // task_ids
  deliverable_id?: string; // app-layer reference
};
```

---

## 8. Deliverable Ownership

### 8.1 Deliverable Lifecycle Permissions

| Operation | Who | Conditions | Data Access | Recording |
|-----------|-----|------------|-------------|-----------|
| Submit | Task assignee (staff or division) | Valid task_id | `deliverables` table | `task_history` |
| Review | Division Head (own division), Founder | Linked task | `deliverables`, `tasks` | `memory_access` log |
| Accept | Division Head, Founder | Submitted deliverable | Update status | `audit_log` column |
| Reject | Division Head, Founder | Submitted deliverable | Update status | `audit_log` column |
| Request revision | Division Head, Founder | Submitted deliverable | Update status | `audit_log` column |

### 8.2 Deliverable Data Structure

```sql
-- Migration 004 adds:
file_references: JSON DEFAULT '[]'    -- List of file paths
task_relationships: JSON DEFAULT '[]' -- Related task_ids
audit_log: JSON DEFAULT '[]'          -- Append-only history
```

---

## 9. Read/Write Permissions

### 9.1 Permission Levels Matrix

| Role | Can View | Can Create | Can Modify | Can Approve | Can Delete |
|------|----------|------------|------------|-------------|------------|
| Founder | All | All | All | All | All |
| Division Head | Their division + own division memories | Tasks, deliverables (own division) | Tasks, deliverables (own division) | Own division tasks, deliverables | Own division tasks (soft) |
| Specialist | Own staff_private + assigned division_shared | — | — | — | — |
| Seat (Council) | Relevant council records | Council proposals, evaluations | Council decisions (with quorum) | Council votes | — |

### 9.2 Runtime Identity Resolution

```typescript
type RuntimeContext = {
  owner_type: 'seat' | 'division' | 'staff' | 'founder';
  owner_id: string;    // seat_id | division_id | staff_id | 'founder'
  runtime: 'claude' | 'hermes';
};
```

---

## 10. Permission Inheritance

### 10.1 Identity Hierarchy

```
Founder (owner_type = 'founder')
  └─ Division Head (owner_type = 'division' when acting as head)
        └─ Specialist (owner_type = 'staff')
```

### 10.2 Inheritance Rules

| From | Inherits Access To | Notes |
|------|-------------------|-------|
| Founder | All | Explicit override, not inheritance |
| Division Head | Own division | `division_id` must match |
| Specialist | Own division (via division_members) | Cannot inherit from Division Head beyond division scope |

### 10.3 Runtime Inheritance

```sql
-- Dual-runtime: same staff_id works on both runtimes
-- runtime_instances JSON: ['claude'] | ['hermes'] | ['claude', 'hermes']
-- Both runtimes write as same owner_id for audit purposes
```

---

## 11. Permission Revocation

### 11.1 Cross-Division Share Revocation

| Step | Actor | Action | Conditions | Result |
|------|-------|--------|------------|--------|
| 1 | Founder/Division Head | Call `revoke_cross_division_access` | Active share exists | `revoked_at` set |
| 2 | System | Update query filter | `revoked_at IS NOT NULL` | Division loses access |
| 3 | Audit | Log entry | Record in `memory_access` | Complete audit trail |

### 11.2 Division Head Suspension

| Operation | Required | Effect |
|-----------|----------|--------|
| Suspend | Founder only | `staff_agents.status = 'inactive'` |
| Reactivate | Founder only | `staff_agents.status = 'active'` |
| Terminate | Founder only | `staff_agents.status = 'terminated'`, `head_staff_id = NULL` |

---

## 12. Unauthorized Access Attempts

### 12.1 Access Check Logic

```typescript
function checkMemoryAccess(ctx, memory): boolean {
  // Founder always succeeds
  if (ctx.owner_type === 'founder') return true;

  // Seat-level categories
  if (memory.category === 'individual_persona')
    return ctx.owner_type === 'seat' && memory.owner_id === ctx.owner_id;

  if (memory.category === 'division_private')
    return ctx.owner_type === 'division' && memory.owner_id === ctx.owner_id;

  if (memory.category === 'staff_private' && memory.owner_type === 'staff')
    return ctx.owner_type === 'staff' && memory.owner_id === ctx.owner_id;

  // Cross-division requires explicit grant
  if (memory.category === 'cross_division' && memory.division_id) {
    if (memory.owner_type === ctx.owner_type && memory.owner_id === ctx.owner_id)
      return true;
    return checkCrossDivisionGrant(ctx, memory);
  }

  // ... additional checks
  return false;
}
```

### 12.2 Unauthorized Query Response

| Scenario | Response | Logging |
|----------|----------|---------|
| Query with no matching data | Return empty array `[]` | No access log (no data accessed) |
| Attempt to update unauthorized memory | Throw error | Access attempt NOT logged |
| Attempt to create in wrong category | Throw error (validation) | None |

---

## 13. Audit Logging

### 13.1 Memory Access Log Table

```sql
CREATE TABLE memory_access (
  access_id        TEXT PRIMARY KEY,
  memory_id        TEXT NOT NULL,
  version_accessed INTEGER,
  accessor_type    TEXT NOT NULL CHECK (accessor_type IN ('seat', 'division', 'staff', 'founder')),
  accessor_id      TEXT NOT NULL,
  accessor_runtime TEXT NOT NULL CHECK (accessor_runtime IN ('claude', 'hermes')),
  access_type      TEXT NOT NULL CHECK (access_type IN ('create', 'read', 'update', 'link', 'search')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 13.2 Audit Events

| Event Type | When Logged | Required Fields |
|------------|-------------|-----------------|
| `create` | On memory insert | `memory_id`, `accessor_type`, `accessor_id`, `accessor_runtime` |
| `read` | On SELECT (batched) | `memory_id`, `version_accessed` (optional), accessor fields |
| `update` | On memory update | Same as create + `change_summary` in memory_versions |
| `link` | On memory link insert | Both source and target logged |
| `search` | On FTS query | Query logged, not individual records |

### 13.3 Migration Audit Log

```sql
CREATE TABLE migration_audit (
  audit_id    TEXT PRIMARY KEY,
  migration_id TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_pk   TEXT NOT NULL,
  action      TEXT NOT NULL,  -- 'preserved' | 'revoked' | 'quarantined'
  reason      TEXT NOT NULL,
  legacy_data TEXT NOT NULL,
  migrated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 14. Runtime Identity Verification

### 14.1 Identity Resolution Flow

1. MCP session authenticates via transport (Claude Code or Hermes Agent)
2. Session middleware resolves transport → `owner_type` + `owner_id` + `runtime`
3. Identity injected into tool context (NOT from request parameters)
4. Both runtimes share logical identity: same `staff_id` for both `claude` and `hermes`
5. `runtime` field distinguishes physical instance for audit only

### 14.2 Validation Functions

```typescript
// Check if staff agent is active in requested runtime
function validateStaffRuntime(staffId: string, runtime: string): boolean {
  const staff = db.stmt.getStaffAgentById.get(staffId);
  if (!staff || staff.status !== 'active') return false;
  const instances = JSON.parse(staff.runtime_instances || '[]');
  return instances.includes(runtime);
}

// Check if Division Head owns division
function validateDivisionHead(staffId: string, divisionId: string): boolean {
  const division = db.stmt.getDivisionById.get(divisionId);
  return division?.head_staff_id === staffId;
}

// Check if seat is occupied by runtime
function validateSeatOccupation(seatId: string, runtime: string): boolean {
  const seat = db.stmt.getSeatById.get(seatId);
  if (!seat || seat.status === 'vacant') return false;
  const personas = db.stmt.getRuntimePersonas.all(runtime);
  return personas.some(p => p.seat_id === seatId);
}
```

---

## 15. Founder Decision Required (New Permissions)

The following operations require explicit Founder decision and are NOT implemented without documentation:

| Permission | Required Owner | Decision Mechanism |
|------------|---------------|-------------------|
| Division Head cross-division grant | Founder | Approval state in `council_shared` memory |
| Automatic staff assignment between divisions | Founder | Manual approval workflow |
| Task delegation between divisions | Founder | Cross-division request process |
| Deliverable ownership transfer | Founder | Explicit approval tracked |
| Memory archival by Council consensus | Founder | 6/11 votes recorded in memory |
| Constitution amendments | Founder | Formal approval process |

---

## 16. Security Considerations

### 16.1 SQL Injection Prevention

All queries use parameterized statements. Query layer builds SQL dynamically but uses `?` placeholders with separate values array.

### 16.2 Privilege Escalation Prevention

| Attack Vector | Prevention |
|---------------|------------|
| Direct table write | No direct MCP tools for internal tables |
| SQL injection in query layer | Parameterized queries only |
| Identity spoofing | Runtime-derived context, not parameter |
| Cross-division bypass | CHECK constraint on `granted_by_type` |

### 16.3 Data Integrity

- All writes use transactions (`BEGIN IMMEDIATE`)
- Foreign keys enforced (`PRAGMA foreign_keys = ON`)
- Constraints validated at DB and service layer
- Audit trail immutable (append-only writes)

---

## 17. Implementation Checklist

### Phase 6.1: Division & Staff Agent Permissions

- [ ] Add Division service layer with `validateDivisionHead` function
- [ ] Add Staff service layer with `validateStaffRuntime` function
- [ ] Implement `isDivisionHead(ctx, divisionId)` check function
- [ ] Implement `isDivisionMember(ctx, divisionId)` check function
- [ ] Add permission validation middleware for runtime contexts

### Phase 6.2: Task & Deliverable Permissions

- [ ] Add task assignment validation in `createTask`
- [ ] Add task status transition validation in `updateTask`
- [ ] Add deliverable review validation in `updateDeliverable`
- [ ] Link task_history entries to memory_access log

### Phase 6.3: Cross-Division Sharing

- [ ] Remove `division` from `granted_by_type` CHECK (Migration 002 applied)
- [ ] Add `request_type`, `status`, `justification`, `priority`, `deadline`, `approved_by_*` columns (Migration 005)
- [ ] Implement request/approval workflow in memory

### Phase 6.4: Audit & Logging

- [ ] Ensure all MCP tools log `memory_access` entries
- [ ] Implement Founder action detection for enhanced logging
- [ ] Add query to "Who accessed what when?" dashboard

---

## 18. References

- `PHASE6_PERMISSION_MODEL.md` - Original permission model
- `src/database.ts` - Database schema definitions
- `src/council.ts` - Service layer with checkMemoryAccess
- `src/server.ts` - MCP tool contracts
- `migrations/002_cross_division_shares_founder_only.sql` - Founder-only enforcement
- `migrations/005_cross_division_shares_stage7.sql` - Request workflow columns