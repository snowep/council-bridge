# Phase 6: Test Plan

## Test Categories

### 1. Unit Tests
- Division Head appointment/rejection/suspension/retirement
- Staff agent creation, status updates, division assignment
- Task creation, assignment, status transitions
- Deliverable creation, review, status changes
- Cross-division share grant/revoke
- Runtime instance tracking

### 2. Integration Tests
- End-to-end: Division Head appointment → activation → task creation → deliverable submission
- Cross-division coordination: request → approval → task execution
- Dual-runtime: same staff_id works on Claude + Hermes
- Task delegation across divisions with proper authorization
- Memory ownership: division-owned, staff-owned, founder-owned correctly enforced

### 3. Database Tests
- FK constraints enforced (division_id → divisions, staff_id → staff_agents, task_id → tasks, memory_id → memory_entries)
- ON DELETE CASCADE behavior verified
- CHECK constraints: status values, priority enum (low|medium|high|critical), granted_by_type, assigned_to_type, created_by_type, submitted_by_type
- Primary key uniqueness: staff_id, division_id + staff_id, share_id, task_id, deliverable_id
- Indexes exist and are functional
- Idempotent: CREATE TABLE IF NOT EXISTS re-runs safely

### 4. MCP Tool Tests
- `register_agent`: valid inputs, duplicate staff_id rejection
- `send_message`, `check_inbox`, `reply_message`: message flow across runtimes
- `create_task`, `update_task`, `delegate_task`: task lifecycle
- `create_deliverable`, `update_deliverable`, `get_deliverable`: deliverable lifecycle
- `grant_cross_division_access`, `revoke_cross_division_access`: share management
- `approve_division_head`, `activate_division_head`, `suspend_division_head`, `retire_division_head`: lifecycle tools
- All tools validate permissions at service layer

### 5. Runtime Tests
- Same `staff_id` registers on both Claude Code and Hermes Agent
- `runtime_instances` tracking: ['claude'], ['hermes'], ['claude', 'hermes']
- Offline behavior: messages queued per runtime, delivered when available
- Duplicate execution prevention: task tracking prevents double-execution
- Failure recovery: if one runtime fails, other continues or retry scheduled

### 6. Privacy Tests
- Division Head can only access their own division's memories
- Specialist can only access `staff_private` and assigned `division_shared`
- No FTS5 direct bypass from UI
- Cross-division shares only granted via explicit `cross_division_shares` rows
- Founder bypass exists but is audited (memory_access log)
- Privilege escalation: no UI route grants additional permissions

### 7. Responsive UI Tests
- Dashboard renders correctly at 3-column (desktop), 2-column (tablet ≥768px), 1-column (mobile <768px)
- Navigation works at all screen sizes
- Tap targets ≥44px at mobile widths
- No overflow, clipping, or unreadable content at any breakpoint

### 8. Access Control Tests
- Unauthorized access rejection at service layer
- Restricted information not exposed in UI
- No direct FTS5 bypass through any UI path
- No unintended privilege escalation via request params
- Session context injected at MCP layer (cannot be spoofed)

## Test Commands

```powershell
npm test                              -- 106 existing tests (Phase 1-4)
npm run typecheck                     -- 0 errors
npm run build                         -- dist/ compiles
```
```

## New Test Suites to Add (Phase 6)

After Founder approval, add:

- `tests/phase6.division-head-lifecycle.test.ts` — appointment, activation, suspension, retirement
- `tests/phase6.staff-agent.test.ts` — creation, status updates, dual-runtime
- `tests/phase6.task-lifecycle.test.ts` — creation, assignment, transitions, failure, retry
- `tests/phase6.cross-division.test.ts` — share grant, revocation, inter-division requests
- `tests/phase6.permission-model.test.ts` — permission enforcement at service layer
- `tests/phase6.privacy.test.ts` — division/staff/founder ownership boundaries

## Regression Check

Verify existing tests still pass:
- Phase 1: MCP communication (106 tests)
- Phase 2: Personas and council identity
- Phase 3: Council and meeting engine
- Phase 4: Memory and knowledge architecture (130 planned, 106 actual)

All must continue passing after Phase 6 changes.