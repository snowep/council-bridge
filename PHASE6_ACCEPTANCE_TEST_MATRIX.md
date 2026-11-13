# Phase 6: Acceptance Test Matrix

## Purpose

This matrix defines test coverage across seven domains: Database, Organizational Management, Permissions, Delegation, Deliverables, Runtime Integration, and Dashboard. Each test entry specifies the test ID, scenario, preconditions, expected result, verification method, and priority. Unit/integration/database/security/e2e test types are distinguished.

Tests reference existing test patterns and Phase 6 planning docs. All 106 existing Phase 1–4 tests must continue passing (regression check).

---

## Database Tests

| Test ID | Scenario | Preconditions | Expected Result | Verification Method | Priority |
|---------|----------|---------------|-----------------|---------------------|----------|
| DB-001 | staff_agents.status default is 'inactive' | Fresh DB (post-Migration 001); staff_agents table rebuilt | New inserts have status='inactive' by default; existing rows preserved with their status values | Execute migration 001 SQL; INSERT without status; SELECT where status='inactive' count matches row count | P0 — Critical |
| DB-002 | cross_division_shares granted_by_type CHECK restricts to 'founder' | Fresh DB (post-Migration 002); division grants revoked | INSERT with granted_by_type='division' rejected by CHECK; INSERT with granted_by_type='founder' accepted | Execute migration 002 SQL; attempt INSERT both types; verify only founder survives | P0 — Critical |
| DB-003 | tasks.dependencies column exists with default '[]' | Post-Migration 003; tasks table has dependencies column | INSERT into tasks without dependencies; column defaults to '[]'; SELECT shows JSON array | Execute migration 003 SQL; INSERT task; verify dependencies = '[]' by default | P0 — Critical |
| DB-004 | tasks.deliverable_id column is nullable | Post-Migration 003; tasks table has deliverable_id column | INSERT into tasks with deliverable_id = NULL succeeds; INSERT with value succeeds (app-layer FK) | Execute migration 003 SQL; INSERT task with NULL deliverable_id; verify row stored | P0 — Critical |
| DB-005 | deliverables.file_references defaults to '[]' | Post-Migration 004; deliverables table has file_references column | New deliverable INSERT shows file_references = '[]' by default | Execute migration 004 SQL; INSERT deliverable; SELECT file_references = '[]' | P0 — Critical |
| DB-006 | deliverables.task_relationships defaults to '[]' | Post-Migration 004; deliverables table has task_relationships column | New deliverable INSERT shows task_relationships = '[]' by default | Execute migration 004 SQL; INSERT deliverable; SELECT task_relationships = '[]' | P0 — Critical |
| DB-007 | deliverables.audit_log defaults to '[]' | Post-Migration 004; deliverables table has audit_log column | New deliverable INSERT shows audit_log = '[]' by default | Execute migration 004 SQL; INSERT deliverable; SELECT audit_log = '[]' | P0 — Critical |
| DB-008 | cross_division_shares request_type CHECK constraint | Post-Migration 005; valid values: task_delegate, deliverable_share, memory_access, resource_request | INSERT with valid request_type accepted; INSERT with invalid value rejected | Execute migration 005 SQL; INSERT with valid/invalid request_type; verify constraint behavior | P0 — Critical |
| DB-009 | cross_division_shares status CHECK constraint | Post-Migration 005; valid values: pending, approved, rejected | INSERT with valid status accepted; INSERT with invalid status rejected | Execute migration 005 SQL; INSERT with valid/invalid status; verify constraint behavior | P0 — Critical |
| DB-010 | cross_division_shares priority CHECK constraint | Post-Migration 005; valid values: low, medium, high, critical | INSERT with valid priority accepted; INSERT with invalid priority rejected | Execute migration 005 SQL; INSERT with valid/invalid priority; verify constraint behavior | P1 — High |
| DB-011 | Foreign key integrity after table rebuilds (001, 002) | Post-Migrations 001 & 002; all FK references valid | PRAGMA foreign_key_check returns 0 violations; all FK records intact | Execute migrations 001+002; run FK integrity check; count violations | P0 — Critical |
| DB-012 | Indexes recreated after table rebuilds | Post-Migrations 001 & 002; expected indexes exist | idx_staff_agents_division, idx_staff_agents_status exist (001); idx_cross_division_shares_memory, idx_cross_division_shares_division exist (002) | Execute migrations; SELECT from sqlite_master indexes; verify all expected indexes present | P1 — High |
| DB-013 | Dependent records survive table rebuilds | Post-Migrations 001 & 002; division_members → staff_agents FK records intact | division_members rows still reference valid staff_agents after rebuild; ON DELETE CASCADE behavior verified | Execute migrations; SELECT from division_members; verify FK references still valid | P1 — High |
| DB-014 | Backup restoration test | Pre-migration backup file exists; restore from backup | Restored DB has same schema and data as pre-migration state; FK integrity passes | Create backup pre-migration; restore; run schema and data verification queries | P1 — High |
| DB-015 | Legacy grant revocation logged to migration_audit | Post-Migration 002; division grants existed before migration | migration_audit rows contain action='revoked' for division-granted entries; legacy_data JSON preserves original row | Execute migration 002; SELECT from migration_audit; verify revoked entries with full legacy data | P1 — High |

---

## Organizational Management Tests

| Test ID | Scenario | Preconditions | Expected Result | Verification Method | Priority |
|---------|----------|---------------|-----------------|---------------------|----------|
| OM-001 | All 6 Division Heads appointed with Founder approval | Founder invokes approve_division_head for each of 6 divisions | All 6 Division Heads recorded in divisions table (head_staff_id set); each division has exactly one head | Founder invokes 6 approval tools; SELECT divisions; count head_staff_id = 6; verify one per division | P0 — Critical |
| OM-002 | 45 specialist agents onboarded with dual-runtime support | Register 45 staff_agents across 6 divisions (5-7 per division) | 45 staff_agents rows exist; each has division_id, status='inactive' (post-migration 001), runtime_instances in [['claude'], ['hermes'], ['claude', 'hermes']] | Register 45 specialists via MCP; SELECT count(staff_id) = 45; verify division distribution; verify runtime_instances | P0 — Critical |
| OM-003 | Division Head can view their division specialists | Division Head authenticated; list_specialists(division_id) called | Returns only specialists assigned to that division_id; count matches expected per-division count | Division Head calls list_specialists; verify returned specialists belong to their division | P1 — High |
| OM-004 | Division Head can assign/reassign specialists within their division | Division Head authenticated; assignSpecialist(staff_id, division_id) called | Specialist reassigned to division; division_members row updated; Division Head can list updated assignment | Division Head calls assignSpecialist; verify division_members updated; list_specialists reflects change | P1 — High |
| OM-005 | Founder can suspend/staff agents | Founder authenticated; suspend_staff_agent(staff_id) called | Staff agent status changed to suspended; runtime_instances cleared or updated; other operations blocked for suspended agent | Founder calls suspend_staff_agent; SELECT status = 'inactive' or suspended state; verify blocked operations | P1 — High |
| OM-006 | Founder can retire staff agents | Founder authenticated; retire_staff_agent(staff_id) called | Staff agent status changed to 'terminated'; row archived via memory_versions; no longer appears in active listings | Founder calls retire_staff_agent; SELECT status = 'terminated'; verify not in active specialist lists | P1 — High |
| OM-007 | Cross-division requests can be submitted by Division Heads | Division Head authenticated; request_cross_division_access called | Request stored in cross_division_shares with request_type, status='pending'; visible in Founder queue | Division Head submits request; SELECT from cross_division_shares where status='pending' and division_id = requestor's division; verify row exists | P1 — High |
| OM-008 | Founder can approve/reject cross-division requests | Founder authenticated; approve_cross_division_access(request_id) or reject_cross_division_access(request_id) | Approved: status changed to 'approved'; cross-division share created. Rejected: status changed to 'revoked'; row removed or marked rejected | Founder invokes approve/revoke; SELECT status from cross_division_shares; verify outcome | P1 — High |
| OM-009 | Memory access boundaries preserved: division can only access its own division_shared | No cross-division shares granted; FTS5 not bypassable from UI | Query for division_shared memories returns only memories where division_id matches; no FTS5 direct bypass | Run query: SELECT * FROM memory_entries WHERE division_id = current_division; verify no cross-division results; attempt FTS5 bypass; verify blocked | P1 — High |
| OM-010 | Founder bypass exists but is audited (memory_access log) | Founder performs any operation | memory_access log entry created with Founder attribution; memory_versions with supersedes_id chain | Founder performs operation; SELECT from memory_access and memory_versions; verify audit trail complete | P1 — High |

---

## Permissions Tests

| Test ID | Scenario | Preconditions | Expected Result | Verification Method | Priority |
|---------|----------|---------------|-----------------|---------------------|----------|
| PER-001 | Unauthorized access rejection at service layer | Non-Division-Head attempts division-specific operations (createDivisionHead, assignSpecialist, etc.) | Operation rejected with permission denied error; no side effects | Non-Head user invokes tool; expect MCP error response; verify no DB state change | P0 — Critical |
| PER-002 | Division Head cannot modify another division's data | Division Head A tries operations on Division B's data | Operation rejected; access limited to their own division | Division Head A invokes tool with Division B's ID; expect permission denied; verify Division B's data unchanged | P0 — Critical |
| PER-003 | Founder can perform any operation | Founder authenticated; any MCP tool called | Operation succeeds regardless of user role; all Founder-reserved powers available | Founder invokes various tools (including prohibited-for-heads); all succeed | P0 — Critical |
| PER-004 | Cross-division shares only granted via explicit cross_division_shares rows | No cross-division share row for memory_id + division_id combination | Memory not accessible across divisions; query layer enforces | Query memories with cross-division access; verify only rows with matching cross_division_shares entries are accessible | P1 — High |
| PER-005 | No direct FTS5 bypass from UI | UI user attempts FTS5 query directly or via crafted params | FTS5 search blocked or returns only authorized results; no direct index bypass | Attempt FTS5 query via UI paths or direct DB; verify access controlled | P1 — High |
| PER-006 | Session context injected at MCP layer (cannot be spoofed) | User attempts to spoof session/division context via request params | MCP layer validates session; spoofed context rejected; only authenticated user's context accepted | Attempt to invoke MCP tool with spoofed division_id/staff_id; expect validation error | P1 — High |
| PER-007 | Permission levels enforced per role matrix | Role-based access: Founder (all), Division Head (own division), Specialist (own + assigned), Seat (council) | Each role can only perform actions within their permission set | Test each role type against allowed/forbidden actions; verify matrix compliance | P1 — High |

---

## Delegation Tests

| Test ID | Scenario | Preconditions | Expected Result | Verification Method | Priority |
|---------|----------|---------------|-----------------|---------------------|----------|
| DEL-001 | Task creation by Founder | Founder authenticated; create_task called with valid inputs | Task created with status='pending'; all fields stored; assigned_to_type/assigned_to_id set correctly | Founder creates task; SELECT from tasks; verify all fields including dependencies='[]', priority default='medium' | P0 — Critical |
| DEL-002 | Task creation by Division Head (their division) | Division Head authenticated; create_task with assigned_to_type='division' or assigned_to_type='staff' (their division) | Task created; all staff in division see it; Division Head can reassign within division | Division Head creates task; verify task appears in list_tasks for their division; reassign test | P0 — Critical |
| DEL-003 | Task creation by Specialist (own tasks) | Specialist authenticated; create_task with assigned_to_type='staff', assigned_to_id=their_staff_id | Task created; assigned to specialist; appears in their task list | Specialist creates task; SELECT list_tasks with their staff_id; verify task appears | P1 — High |
| DEL-004 | Dependency cycle detection at task creation | Task creation with cyclic dependency (task A depends on B, B depends on A) | Creation rejected; error returned; no cyclic task stored | Attempt task creation with cycle; expect validation error; verify no task created with cyclic deps | P1 — High |
| DEL-005 | Dependency resolution: when dep completes, dependent can start | Task A depends on Task B; Task B completed first | After Task B → completed, Task A can transition from pending → in_progress automatically or via claim | Complete Task B; verify Task A transitions or can be claimed; check dependency resolution logic | P1 — High |
| DEL-006 | Task priority enum validation (low|medium|high|critical) | Task creation with priority values outside enum | INSERT/reject rejected; only low|medium|high|critical accepted | Create tasks with valid and invalid priorities; verify constraint enforcement | P1 — High |
| DEL-007 | Deliverable creation linked to exactly one task | Deliverable created with task_id FK (app-layer validated) | Deliverable row has task_id; task-deliverable relationship visible; content JSON payload stored | Create deliverable with task_id; SELECT deliverable with task join; verify content stored | P1 — High |
| DEL-008 | Deliverable review workflow: submitted → accepted/rejected/revision_requested | Deliverable in 'submitted' status; reviewer invokes update_deliverable | Status changes to accepted/rejected/revision_requested; reviewed_by_type/id recorded; audit_log entry appended | Deliverable submitted; review invoked; SELECT status, reviewed_by, audit_log; verify workflow | P1 — High |
| DEL-009 | File references JSON column stores file paths | Deliverable created with file_references JSON | file_references = JSON array of file paths; paths stored as-string entries | Create deliverable with file_references; SELECT file_references; verify JSON structure | P1 — High |
| DEL-010 | Task relationships JSON column stores task_ids | Deliverable created with task_relationships JSON | task_relationships = JSON array of task_ids; which tasks this deliverable relates to | Create deliverable with task_relationships; SELECT task_relationships; verify JSON structure | P1 — High |
| DEL-011 | Audit log append-only: each status change appends entry | Deliverable status changes multiple times | audit_log grows with each change; entries immutable; historical versions retrievable by reading audit_log in order | Multiple status changes on same deliverable; SELECT audit_log; verify entries appended in chronological order; no modifications | P1 — High |
| DEL-012 | Budget tracking per task | Task created with budget_allocated | budget_allocated stored as REAL DEFAULT 0; visible in task listing | Create task with budget_allocated; SELECT budget from task; verify value stored | P2 — Medium |

---

## Runtime Integration Tests

| Test ID | Scenario | Preconditions | Expected Result | Verification Method | Priority |
|---------|----------|---------------|-----------------|---------------------|----------|
| RI-001 | Same staff_id registers on both Claude Code and Hermes Agent | staff_id exists; runtime_instances tracking | staff_id appears on both runtimes; runtime_instances tracks which runtimes active | Register same staff_id on Claude Code and Hermes; verify runtime_instances on both; dual-runtime test | P0 — Critical |
| RI-002 | runtime_instances: ['claude'] only | Staff agent on Claude Code only | runtime_instances = ['claude']; Hermes operations may fail or be queued | Set runtime_instances via register or manual; verify only Claude can operate | P1 — High |
| RI-003 | runtime_instances: ['hermes'] only | Staff agent on Hermes Agent only | runtime_instances = ['hermes']; Claude operations may fail or be queued | Set runtime_instances via register or manual; verify only Hermes can operate | P1 — High |
| RI-004 | runtime_instances: ['claude', 'hermes'] dual | Staff agent on both runtimes | runtime_instances = ['claude', 'hermes']; both can operate independently | Set/runtime_instances to both; verify operations on both succeed; no corruption | P1 — High |
| RI-005 | Offline behavior: messages queued per runtime, delivered when available | One runtime offline; message sent from online runtime | Messages queued per runtime; delivered when offline runtime comes back online | Simulate offline runtime; send messages; verify queuing; bring online; verify delivery | P1 — High |
| RI-006 | Duplicate execution prevention: task tracking prevents double-execution | Task already completed; second execution attempt | Second execution blocked or returns 'already completed' status; no double-execution | Attempt task execution twice; verify second attempt handles idempotently; status still 'completed' | P1 — High |
| RI-007 | Failure recovery: if one runtime fails, other continues or retry scheduled | One runtime crashes/fails; other still running | Other runtime continues operating; retry scheduled for failed runtime; no data loss | Crash one runtime; continue on other; verify no corruption; restart failed; verify recovery | P2 — Medium |
| RI-008 | MCP tool contract validation across runtimes | Same tool registered on both Claude Code and Hermes Agent | Identical input/output schemas; same validation logic; same error handling | Run contract tests on both runtimes; compare results; schemas must match | P1 — High |

---

## Dashboard Tests

| Test ID | Scenario | Preconditions | Expected Result | Verification Method | Priority |
|---------|----------|---------------|-----------------|---------------------|----------|
| DASH-001 | Dashboard renders correctly at 3-column (desktop) | Full-width screen ≥1200px | 3-column layout; all sections visible; no overflow; tap targets adequate | Render dashboard at desktop width; verify 3-column grid; check no clipping or overflow | P0 — Critical |
| DASH-002 | Dashboard renders correctly at 2-column (tablet ≥768px) | Screen width 768–1199px | 2-column layout; all sections visible; no overflow; tap targets ≥44px | Render dashboard at tablet width; verify 2-column grid; measure tap targets | P0 — Critical |
| DASH-003 | Dashboard renders correctly at 1-column (mobile <768px) | Screen width <768px | 1-column layout; vertical stack; all content accessible; no horizontal scrolling | Render dashboard at mobile width; verify 1-column stack; check all content visible without horizontal scroll | P0 — Critical |
| DASH-004 | Navigation works at all screen sizes | Navigate between sections at mobile/desktop widths | Navigation functional at all breakpoints; active section highlighted; no broken links | Navigate at each breakpoint; verify page transitions work; check URL/hash state | P1 — High |
| DASH-005 | Tap targets ≥44px at mobile widths | Interactive elements at mobile width | All tap targets (buttons, links, cards) have minimum 44px height/width; no cramped targets | Measure tap targets at mobile width; verify ≥44px; screenreader test | P1 — High |
| DASH-006 | No overflow, clipping, or unreadable content at any breakpoint | Viewport resized through all breakpoints | No CSS overflow: hidden cutting off content; no clipped text; readability maintained | Resize through all breakpoints; inspect visually; check for overflow clips or unreadable text | P1 — High |
| DASH-007 | Phase 5 functionality intact (chat, council, memory, meetings) | Dashboard includes Phase 5 sections | Chat, council, memory, meetings UI still works; no regression from Phase 6 additions | Use Phase 5 chat/council/memory/meetings; verify all functional; check no breakage from new code | P1 — High |
| DASH-008 | Phase 6 sections added without regression | New organization/specialist/task/deliverable/cross-division sections added | New sections render; existing Phase 5 unchanged; no CSS/JS conflicts | Add Phase 6 dashboard sections; verify Phase 5 still works; check for JS errors or CSS conflicts | P1 — High |

---

## Test Type Definitions

| Type | Description | Scope | Examples |
|------|-------------|-------|----------|
| **Unit** | Isolated function/method tests; mock dependencies | Single component, no DB or IPC | Zod schema validation; individual tool input/output; enum constraint checks |
| **Integration** | Multiple components/work together; real DB (temp); no full IPC | Several components, temp database | Migration execution; FK integrity; tool registration + DB state; task+deli worklfow end-to-end |
| **Database** | SQL-level constraints, schema, migrations, FK, indexes | Raw SQL against DB | CHECK constraints; FK integrity; index presence; migration rollback; backup restore |
| **Security** | Authorization, privilege escalation, boundary enforcement | Access control, audit | Permission rejection tests; FTS5 bypass attempts; session spoofing; Founder audit logging |

---

## Objective Acceptance Criteria

Phase 6 is accepted when **ALL** of the following are satisfied:

### Database Criteria (P0–P1)
- [ ] All 15 DB tests (DB-001 through DB-015) pass
- [ ] All CHECK constraints enforce correct enums (status, granted_by_type, request_type, status, priority)
- [ ] All FK integrity checks pass after table rebuilds (001, 002)
- [ ] All expected indexes exist and are functional
- [ ] Backup restoration succeeds from file-backed temporary database
- [ ] Legacy grant revocation properly logged to migration_audit with full legacy data

### Organizational Management Criteria (P0–P1)
- [ ] All 10 OM tests (OM-001 through OM-010) pass
- [ ] All 6 Division Heads appointed with Founder approval (one per division)
- [ ] 45 specialist agents onboarded with correct division assignments and runtime instances
- [ ] Division Head permissions limited to their own division (no cross-division modification)
- [ ] Founder can suspend/retire staff agents
- [ ] Cross-division requests submit, approve/reject workflow works end-to-end
- [ ] Memory access boundaries preserved; no FTS5 bypass from UI
- [ ] Founder bypass audited in memory_access log + memory_versions

### Permissions Criteria (P0–P1)
- [ ] All 7 PER tests (PER-001 through PER-007) pass
- [ ] Unauthorized access rejected at service layer for all role types
- [ ] Division Head cannot modify another division's data
- [ ] Founder can perform any operation (all-reserved powers)
- [ ] Cross-division access only via explicit cross_division_shares grants
- [ ] No direct FTS5 bypass from any UI path
- [ ] Session context cannot be spoofed at MCP layer

### Delegation Criteria (P0–P1)
- [ ] All 12 DEL tests (DEL-001 through DEL-012) pass
- [ ] Task creation works for Founder, Division Head, and Specialist (different assigned_to_type values)
- [ ] Dependency cycle detection prevents cyclic task creation
- [ ] Priority enum validated (low|medium|high|critical); invalid values rejected
- [ ] Deliverable review workflow: submitted → accepted/rejected/revision_requested
- [ ] File references, task relationships, audit_log JSON columns work correctly
- [ ] Budget tracking per task functions

### Runtime Integration Criteria (P0–P1)
- [ ] All 8 RI tests (RI-001 through RI-008) pass
- [ ] Same staff_id registers on both Claude Code and Hermes Agent (dual-runtime)
- [ ] Runtime instances tracked correctly for all three states: ['claude'], ['hermes'], ['claude', 'hermes']
- [ ] Offline message queuing and delivery when runtime returns
- [ ] Duplicate execution prevention works (no double-execution)
- [ ] Failure recovery: other runtime continues if one fails
- [ ] MCP tool contracts identical across both runtimes

### Dashboard Criteria (P0–P1)
- [ ] All 8 DASH tests (DASH-001 through DASH-008) pass
- [ ] Dashboard renders at 3-col (desktop), 2-col (tablet ≥768px), 1-col (mobile <768px)
- [ ] Navigation works at all screen sizes
- [ ] Tap targets ≥44px at mobile widths
- [ ] No overflow, clipping, or unreadable content at any breakpoint
- [ ] Phase 5 functionality intact (chat, council, memory, meetings)
- [ ] Phase 6 sections added without regression

### Regression Criteria
- [ ] All 106 existing Phase 1–4 tests still pass (`npm test`)
- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm run build` compiles clean (dist/ builds)
- [ ] No new SQLite migration errors or constraint violations

### Founder Authorization
- [ ] Explicit Founder authorization granted for Phase 6 implementation (documented separately)
- [ ] All stages requiring Founder approval have recorded authorization

---