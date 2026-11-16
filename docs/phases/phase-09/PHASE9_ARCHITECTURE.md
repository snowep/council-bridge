# PHASE 9: Organization & Execution Engine - Architecture

## Overview

Phase 9 extends the existing modular architecture to complete the organization activation workflow and task delegation engine. The architecture follows the established patterns from Phases 6-8 with enhanced operational semantics.

## Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │           Founder Session               │
                    │         (Authorization)                 │
                    └─────────────┬───────────────────────────┘
                                  │ approve_* operations
                                  ▼
                    ┌─────────────────────────────────────────┐
                    │      Appointment Service                │
                    │  (src/council/divisions.ts)             │
                    │  - approveDivisionHead()                 │
                    │  - approveSpecialist()                   │
                    │  - activateStaffAgent()                  │
                    └─────────────┬───────────────────────────┘
                                  │
                    ┌─────────────┴───────────────────────────┐
                    │                                         │
                    ▼                                         ▼
        ┌───────────────────────┐              ┌───────────────────────┐
        │    Division Heads       │              │    Specialists        │
        │  (6 active)           │              │  (45 active)          │
        └──────────┬────────────┘              └──────────┬────────────┘
                   │                                        │
                   │ division_memberships                     │
                   │                                        │
                   ▼                                        ▼
        ┌───────────────────────────────────────────────────────────────┐
        │                  Task Delegation Engine                        │
        │  (src/council/operations.ts - enhanced)                       │
        │                                                              │
        │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
        │  │   Task CRUD     │  │  Delegation     │  │  Deliverable │ │
        │  │   Operations    │  │   Engine        │  │   Workflow   │ │
        │  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘ │
        │           │                    │                    │           │
        │           ▼                    ▼                    ▼           │
        │  ┌──────────────────────────────────────────────────────────┐   │
        │  │           Execution Request System (Phase 7 core)        │   │
        │  │  - requestExecution()                                    │   │
        │  │  - approveExecution()                                    │   │
        │  │  - executeExecutionRequest()                             │   │
        │  │  - Execution history with HITL gates                    │   │
        │  └──────────────────────────────────────────────────────────┘   │
        └─────────────────────────────────────────────────────────────────┘
```

## Module Extension Points

### 1. divisions.ts Enhancements

**New Functions**:
```typescript
// Approve a Division Head appointment (Founder-only)
approveDivisionHead(ctx, input: { division_id: string; staff_id: string }): Division;

// Approve a specialist (Founder-only)
approveSpecialist(ctx, input: { staff_id: string; division_id: string }): StaffAgent;

// Activate a staff agent in specific runtimes
activateStaffAgent(ctx, input: { staff_id: string; runtimes: ('claude' | 'hermes')[] }): StaffAgent;
```

**Database Operations**:
- `updateStaffStatus` with 'active' status
- `insertRuntimePersona` for each runtime
- Audit memory creation in `division_shared`

### 2. operations.ts Enhancements

**Task Operations Extension**:
```typescript
// Delegation with pattern selection
delegateTask(db, ctx, input: {
  task_id: string;
  pattern: 'sequential' | 'parallel' | 'hierarchical' | 'evaluator-optimizer';
  delegates: Array<{ task_id: string; delegatee_id: string }>;
}): { success: boolean; delegated_tasks: string[] };

// Get delegation tree
getDelegationTree(db, taskId: string): DelegationNode;

// Deliverable submission with version
submitDeliverable(db, ctx, input: {
  task_id: string;
  version: number;
  content: any;
  quality_score?: number;
}): Deliverable;
```

### 3. New Module: delegation.ts

**Purpose**: Pure delegation logic, separate from task CRUD

**Exports**:
- `validateDelegationPattern()` - Verify pattern compatibility
- `calculateDependencyGraph()` - Build task dependency tree
- `generateSubtasks()` - Create downstream tasks
- `validateDeliverable()` - Quality/content checks

## Data Flow: Appointment Ceremony

```
1. Founder Session (authenticated)
            │
            ▼
2. approve_division_head(staff_id, division_id)
            │
            ▼
3. Validate: Staff belongs to division
            │
            ▼
4. Update division.head_staff_id
            │
            ▼
5. Log in council_shared memory: "Division Head appointed: staff-dev-head-001 for Developer Division"
            │
            ▼
6. Initialize division_shared/ddivision_private memories
            │
            ▼
7. Return: Division with head_staff_id populated
```

## Data Flow: Task Delegation

```
1. Staff creates task (via createTask)
            │
            ▼
2. Set task.status = 'pending'
            │
            ▼
3. Staff requests execution (requestExecution)
            │
            ▼
4. Determine autonomy level from task title/category
            │
            ▼
5. Level 1: queued → auto-approve → running → completed
   Level 2: queued → permission_check → approval_required
   Level 3: queued → founder_approval → running → completed
            │
            ▼
6. On approval: executeExecutionRequest()
            │
            ▼
7. Task status → 'in_progress' → 'completed'
            │
            ▼
8. Staff submits deliverable
            │
            ▼
9. Division Head/HITL reviews deliverable
            │
            ▼
10. Deliverable status → 'submitted' → 'reviewed' → 'approved' | 'rejected'
```

## Interface Contracts

### Task Interface Extension

```typescript
interface Task {
  task_id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  created_by_type: 'founder' | 'seat' | 'division_head';
  created_by_id: string;
  assigned_to_type?: 'division' | 'staff';
  assigned_to_id?: string;
  delegation_pattern?: 'sequential' | 'parallel' | 'hierarchical';
  dependencies?: string[];  // task_id references
  estimated_hours?: number;
  due_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}
```

### Deliverable Interface

```typescript
interface Deliverable {
  deliverable_id: string;
  task_id: string;
  version: number;
  content: any;
  quality_score?: number;
  submitted_by_type: 'staff' | 'division';
  submitted_by_id: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  review_notes?: string;
  reviewer?: { type: string; id: string };
  reviewed_at?: string;
  created_at: string;
}
```

## Security Boundaries

### Founder-Only Operations (HITL Gates)

These operations require founder signature verification:

1. `approve_execution` (Level 3 autonomous tasks)
2. `approve_division_head` - Division head appointments
3. `approve_specialist` - Specialist activation
4. `approve_cross_division_access` - Cross-division memory sharing

### Founder Bypass Rules

Founder can:
- Create/modify any division or staff record
- Approve/reject any execution request
- Access any memory (privacy bypass logged)
- Override HITL gates (logged with justification)

### Session Validation

All operations validate:
- Session not expired
- Session not revoked
- Permissions match operation requirements
- Founder signature valid (if required)

## Migration Compatibility

Phase 9 is fully backward compatible:

- No SQL schema changes (tables pre-created in Phase 4)
- MCP tools extend existing API (no breaking changes)
- Memory categories already defined (Phase 4)
- Authorization model already enforced (Phase 8)

## Performance Considerations

- Task dependency graph: O(n) traversal with caching
- Delegation pattern validation: O(1) lookup
- Deliverable quality check: Inline, no external service
- Memory audit logging: Async batch write (existing pattern)

## Testability Strategy

### Unit Tests (phase9_delegation.test.ts)
- Task delegation pattern validation
- Dependency cycle detection
- Deliverable quality scoring
- Status transition enforcement

### Integration Tests (phase9_appointment.test.ts)
- Full appointment ceremony workflow
- Member cross-checks post-activation
- Memory audit verification

### End-to-End Tests (phase9_e2e.test.ts)
- Staff → Request Execution → Approve → Complete → Deliverable flow
- Cross-division task collaboration
- HITL gate integration

## Rollout Sequence

1. **Batch 1**: Appointment ceremony tools (founder auth verified)
2. **Batch 2**: Division population & staff activation (database verified)
3. **Batch 3**: Task delegation extensions (execution tests pass)
4. **Batch 4**: Deliverable workflow (quality gates pass)
5. **Batch 5**: Full E2E integration (all tests passing)

---

**Next**: PHASE9_IMPLEMENTATION_ROADMAP.md for detailed batch breakdown