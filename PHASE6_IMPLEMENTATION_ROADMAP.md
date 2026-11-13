# Phase 6: Implementation Roadmap

## Dependency-Aware Sequence

### Stage 1: Existing Architecture and Roster Verification (1 week)
- Verify all 6 Division Head definitions exist in filesystem
- Verify all 45 specialist definitions exist
- Cross-reference with `council-bridge-roster.md` v2.2
- Identify discrepancies between reported and actual
- Document: 6 heads found? 45 specialists found? Gaps?
- Output: `ROSTER_VERIFICATION_REPORT.md`
- Dependency: None (prerequisite for all stages)

### Stage 2: Division and Staff Data Model (1 week)
- Confirm database schema readiness (already FK-ready)
- Tables exist: divisions, staff_agents, division_members, cross_division_shares, tasks, deliverables
- All `CREATE TABLE IF NOT EXISTS` — idempotent, safe
- Validate: 6 divisions × 5-7 specialists = 45 total
- Define: division names, head assignments, specialist roles
- Output: SCHEMA readied for row insertion
- Dependency: Stage 1 (roster verification)

### Stage 3: Division Management Services (1 week)
- MCP tools for division operations (with formal Zod schemas):
  - `create_division(name, description, budget_limit, strategic_objectives)`
  - `assign_division_head(staff_id, division_id)` — Founder-only
  - `update_division(head_staff_id, budget_limit, objectives)` — Division Head–only
  - `list_divisions()` — all seats
  - `list_specialists(division_id)` — specialists in division
- Service-layer permission enforcement
- **Formal Zod schemas** (resolves A5):
  ```typescript
  const CreateDivisionSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    budget_limit: z.number().min(0).default(0),
    strategic_objectives: z.array(z.string()).default([])
  });
  
  const AssignDivisionHeadSchema = z.object({
    staff_id: z.string().uuid(),
    division_id: z.string().min(1)
  });
  
  const UpdateDivisionSchema = z.object({
    division_id: z.string().min(1),
    head_staff_id: z.string().uuid().optional(),
    budget_limit: z.number().min(0).optional(),
    strategic_objectives: z.array(z.string()).optional()
  });
  
  const ListSpecialistsSchema = z.object({
    division_id: z.string().min(1)
  });
  ```
- Output: new MCP tools + service functions
- Dependency: Stage 2 (data model ready)

### Stage 4: Founder Appointment and Approval Workflow (1 week)
- MCP tools for Founder approval sequence (with formal Zod schemas):
  - `approve_division_head(candidate_staff_id, division_id)`
  - `reject_division_head(candidate_staff_id)`
  - `authorize_division_head_activation(staff_id, division_id)`
  - `suspend_division_head(staff_id, reason)`
  - `retire_division_head(staff_id)`
- Audit logging via `memory_versions` + `memory_access` log
- **Formal Zod schemas** (resolves A5):
  ```typescript
  const ApproveDivisionHeadSchema = z.object({
    candidate_staff_id: z.string().uuid(),
    division_id: z.string().min(1)
  });
  
  const RejectDivisionHeadSchema = z.object({
    candidate_staff_id: z.string().uuid()
  });
  
  const AuthorizeActivationSchema = z.object({
    staff_id: z.string().uuid(),
    division_id: z.string().min(1)
  });
  
  const SuspendDivisionHeadSchema = z.object({
    staff_id: z.string().uuid(),
    reason: z.string().min(1)
  });
  
  const RetireDivisionHeadSchema = z.object({
    staff_id: z.string().uuid()
  });
  ```
- Output: approved Founder workflow tools
- Dependency: Stage 3 (division services)

### Stage 5: Staff Onboarding and Lifecycle (1 week)
- MCP tools for specialist management (with formal Zod schemas):
  - `register_staff_agent(staff_id, name, role, division_id, runtime_instances)`
  - `update_staff_status(staff_id, status)`
  - `update_staff_permissions(staff_id, permissions)`
  - `suspend_staff_agent(staff_id)`
  - `retire_staff_agent(staff_id)`
- 5-7 specialists per division = 45 total
- Runtime instance tracking: `['claude']`, `['hermes']`, `['claude', 'hermes']`
- **Formal Zod schemas** (resolves A5):
  ```typescript
  const RegisterStaffAgentSchema = z.object({
    staff_id: z.string().uuid(),
    name: z.string().min(1),
    role: z.string().min(1),
    division_id: z.string().min(1),
    runtime_instances: z.array(z.enum(['claude', 'hermes'])).min(1)
  });
  
  const UpdateStaffStatusSchema = z.object({
    staff_id: z.string().uuid(),
    status: z.enum(['active', 'inactive', 'terminated'])
  });
  
  const UpdateStaffPermissionsSchema = z.object({
    staff_id: z.string().uuid(),
    permissions: z.array(z.string())
  });
  
  const SuspendStaffAgentSchema = z.object({
    staff_id: z.string().uuid()
  });
  
  const RetireStaffAgentSchema = z.object({
    staff_id: z.string().uuid()
  });
  ```
- Output: staff onboarding tools + lifecycle management
- Dependency: Stage 3 (data model) + Stage 4 (approval workflow)

### Stage 6: Task and Deliverable Management (1 week)
- MCP tools for task delegation (with formal Zod schemas):
  - `create_task(title, description, assigned_to_type, assigned_to_id, priority, due_at, dependencies, budget_allocated)`
  - `update_task(task_id, status, priority, due_at)`
  - `list_tasks(assigned_to_type, assigned_to_id, status, priority)`
  - `complete_task(task_id)`
- MCP tools for deliverables:
  - `create_deliverable(task_id, content, submitted_by_type, submitted_by_id)`
  - `update_deliverable(deliverable_id, status, reviewed_by_type, reviewed_by_id)`
  - `list_deliverables_by_task(task_id)`
- Review/approval workflow
- **Formal Zod schemas for all new tools** (resolves A5):
  ```typescript
  // Task schemas
  const CreateTaskSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    assigned_to_type: z.enum(['division', 'staff']),
    assigned_to_id: z.string().min(1),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    due_at: z.string().datetime().optional(),
    dependencies: z.array(z.string()).optional(),
    budget_allocated: z.number().min(0).optional()
  });
  
  const UpdateTaskSchema = z.object({
    task_id: z.string().uuid(),
    status: z.enum(['pending', 'in_progress', 'review', 'completed', 'cancelled']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    due_at: z.string().datetime().optional()
  });
  
  // Deliverable schemas
  const CreateDeliverableSchema = z.object({
    task_id: z.string().uuid(),
    content: z.string(), // JSON payload
    submitted_by_type: z.enum(['staff', 'division']),
    submitted_by_id: z.string().min(1)
  });
  
  const UpdateDeliverableSchema = z.object({
    deliverable_id: z.string().uuid(),
    status: z.enum(['submitted', 'accepted', 'rejected', 'revision_requested']),
    reviewed_by_type: z.enum(['founder', 'council', 'division_head']),
    reviewed_by_id: z.string().min(1)
  });
  ```
- Output: task + deliverable management tools with validated contracts
- Dependency: Stage 3 (data model) + Stage 5 (staff agents)

### Stage 7: Cross-Division Coordination (0.5 week)
- **Cross-division request storage** (resolves A6): extend `cross_division_shares` with:
  - `request_type` TEXT: 'task_delegate' | 'deliverable_share' | 'memory_access' | 'resource_request'
  - `status` TEXT: 'pending' | 'approved' | 'rejected' (CHECK constraint)
  - `justification` TEXT
  - `priority` TEXT: 'low' | 'medium' | 'high' | 'critical'
  - `deadline` TEXT (ISO datetime, nullable)
  - `approved_by_type` TEXT, `approved_by_id` TEXT (nullable)
  - `approved_at` TEXT (nullable)
- MCP tools for inter-division requests (with formal Zod schemas):
  - `request_cross_division_access(from_division, to_division, memory_id, justification, priority, deadline, request_type)`
  - `approve_cross_division_access(request_id)` — Founder
  - `revoke_cross_division_access(request_id)`
  - `list_pending_cross_division_requests(division_id)`
- Query-layer cross-division access enforcement
- **Formal Zod schemas** (resolves A5):
  ```typescript
  const RequestCrossDivisionAccessSchema = z.object({
    from_division: z.string().min(1),
    to_division: z.string().min(1),
    memory_id: z.string().optional(),
    justification: z.string().min(1),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    deadline: z.string().datetime().optional(),
    request_type: z.enum(['task_delegate', 'deliverable_share', 'memory_access', 'resource_request'])
  });
  
  const ApproveCrossDivisionAccessSchema = z.object({
    request_id: z.string().uuid()
  });
  
  const RevokeCrossDivisionAccessSchema = z.object({
    request_id: z.string().uuid()
  });
  ```
- Output: cross-division coordination tools with validated contracts
- Dependency: Stage 3 (data model) + Stage 4 (Founder workflow)

### Stage 8: MCP Integration (0.5 week)
- Register new tools with existing MCP server
- Ensure 25+ existing tools remain functional
- Validate tool contracts: inputs, outputs, validation, error handling
- Test dual-runtime: same tools work on Claude Code + Hermes Agent
- Output: integrated MCP server with new Phase 6 tools
- Dependency: Stages 3-7 (all service functions ready)

### Stage 9: Dashboard Integration (1 week, optional Phase 7)
- UI sections (planned, not implemented in this task):
  - Organization overview
  - Divisions list with head indicators
  - Division details and specialist directories
  - Agent status panels
  - Task management interface
  - Deliverable browser and review
  - Cross-division request queue
- Preserve existing Phase 5 UI: dashboard, chat, council, memory, meetings
- Output: optional UI enhancements (deferred to Phase 7)
- Dependency: Stage 8 (MCP tools integrated)

### Stage 10: Integration Testing and Acceptance (1 week)
- Run full test suite: `npm test` → 106+ new Phase 6 tests
- Verify regression: all Phase 1-4 tests still pass
- Runtime testing: Claude Code + Hermes Agent dual-operation
- Privacy and access control verification
- Responsive UI verification at 768px breakpoint
- Output: ACCEPTANCE REPORT → Founder authorizes Phase 6
- Dependency: All stages 1-9 complete

## Milestones and Acceptance Criteria

| Milestone | Criteria | Owner | Duration |
|-----------|----------|-------|----------|
| M1: Roster Verification | All 6 Division Heads + 45 specialists identified | Architect | 1 week |
| M2: Data Model Ready | DB tables FK-ready, idempotent migrations | DB Architect | 1 week |
| M3: Division Services | MCP tools registered, permission-enforced | Backend Lead | 1 week |
| M4: Founder Workflow | Approval/activation tools, audit logging | Founder + Backend | 1 week |
| M5: Staff Onboarding | 45 specialists registerable, dual-runtime | Backend Lead | 1 week |
| M6: Task/Deliverable | Full lifecycle MCP tools, review workflow | Backend Lead | 1 week |
| M7: Cross-Division | Share grant/revoke tools, query-layer enforcement | Backend Lead | 0.5 week |
| M8: MCP Integration | All new tools registered, 25+ existing intact | DevOps | 0.5 week |
| M9: Dashboard (opt.) | UI sections, preserve Phase 5 functionality | Frontend Lead | 1 week |
| M10: Acceptance | `npm test` passes, regression verified, Founder sign-off | All | 1 week |

**Total estimated duration: 8–10 weeks** (depending on Founder approval velocity)

## Risks and Unresolved Decisions

1. **Roster discrepancies**: If actual Division Heads/specialists differ from `council-bridge-roster.md` v2.2, verification delay.

2. **Dual-runtime ownership**: Ensuring one `staff_id` = one logical employee across Claude Code + Hermes Agent requires careful `runtime_instances` tracking. Risk of desynchronization.

3. **Founder approval velocity**: Roadmap stages 4, 6, 10 depend on Founder decisions. Delays cascade.

4. **Cross-division authorization complexity**: Explicit `cross_division_shares` grants could become administratively burdensome if many divisions need ad-hoc access.

5. **Task dependency cycles**: Detection at creation time must be robust; edge cases could cause bugs.

6. **Database migration**: Tables are `CREATE TABLE IF NOT EXISTS` — safe, but row insertion strategy after Founder approval needs coordination. **New columns for tasks/deliverables (dependencies, deliverable_id, file_references, task_relationships, audit_log) will be added via ALTER TABLE during implementation.**

7. **Dashboard integration scope**: If Stage 9 grows beyond optional, could delay Stage 10 acceptance. Keep strictly optional per instructions.

8. **Schema sync completed**: Planning docs now match actual DB schema for `tasks`, `deliverables`, `cross_division_shares`. No further sync needed before Stage 2.

## Success Criteria for Phase 6 Acceptance

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

## Files Created (this planning session)

| File | Purpose |
|------|---------|
| `PHASE6_ARCHITECTURE.md` | Overall hierarchy, entities, ownership, lifecycle |
| `PHASE6_SCHEMA_PLAN.md` | Database design, relationships, constraints, indexes, migration |
| `PHASE6_PERMISSION_MODEL.md` | Division Head authority, staff permissions, Founder-reserved approvals |
| `PHASE6_AGENT_LIFECYCLE.md` | Appointment, approval, onboarding, activation, suspension, retirement |
| `PHASE6_TASK_DELEGATION.md` | Task lifecycle, delegation, routing, review, deliverables, coordination |
| `PHASE6_TEST_PLAN.md` | Unit, integration, database, MCP, runtime, privacy, security, regression tests |
| `PHASE6_IMPLEMENTATION_ROADMAP.md` | Dependency-aware sequence, milestones, acceptance criteria, risks |

**No source code was modified. No database schemas were changed. No agents were created or activated. No Division Heads were appointed. No staff agents were onboarded.**