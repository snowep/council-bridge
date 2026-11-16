# Phase 6: Execution Sequence

## Overview

Phase 6 is broken into **10 verifiable stages** with explicit dependencies, file references, DB/API/UI impacts, test requirements, acceptance criteria, rollback considerations, and completion evidence. Stages 1–8 are mandatory; Stages 9–10 are optional (Phase 7 deferrable).

Stages 1–2 are **parallelizable** (independent). Stages 3–7 have inter-dependencies but stages within each can parallelize where files/tables differ. Stage 8 depends on stages 3–7. Stage 9 is optional. Stage 10 is the final integration gate.

---

## Stage 1: Roster Verification

**Goal**: Verify all 6 Division Head definitions and 45 specialist definitions exist; cross-reference with `council-bridge-roster.md` v2.2.

| Item | Details |
|------|---------|
| **Dependencies** | None (prerequisite for all stages) |
| **Files Involved** | `council-bridge-roster.md`, division head files, specialist definition files |
| **DB Impact** | None (verification only; no schema or data changes) |
| **API Impact** | None |
| **UI Impact** | None |
| **Test Requirements** | - Roster count verification script<br>- Gap analysis between reported and actual counts |
| **Acceptance Criteria** | - All 6 Division Heads identified and documented<br>- 45 specialists identified and documented<br>- Discrepancies noted and resolved |
| **Rollback Considerations** | N/A — verification-only; no state change |
| **Completion Evidence** | `ROSTER_VERIFICATION_REPORT.md` with counts, gaps, resolutions |
| **Parallelizable** | Yes — Stage 1 runs independently; Stage 2 depends on its output |

---

## Stage 2: Division and Staff Data Model Readiness

**Goal**: Confirm database schema is FK-ready; tables exist and are idempotent; validate 6 divisions × 5–7 specialists = 45 total.

| Item | Details |
|------|---------|
| **Dependencies** | Stage 1 output (ROSTER_VERIFICATION_REPORT.md) |
| **Files Involved** | Existing `CREATE TABLE IF NOT EXISTS` statements in src/database.ts |
| **DB Impact** | Read-only schema validation; no migrations executed |
| **API Impact** | None |
| **UI Impact** | None |
| **Test Requirements** | - Schema integrity checks (FK validity)<br>- Row count expectations (6 divisions, ~45 staff_agents)<br>- Idempotent CREATE TABLE verification |
| **Acceptance Criteria** | - All 6 core tables exist: `divisions`, `staff_agents`, `division_members`, `cross_division_shares`, `tasks`, `deliverables`<br>- All tables use `CREATE TABLE IF NOT EXISTS` (safe re-run)<br>- FK references valid: `staff_agents.division_id` → `divisions.division_id`, `division_members.staff_id` → `staff_agents.staff_id`<br>- 6 divisions recorded; 45 specialists expected |
| **Rollback Considerations** | N/A — read-only validation |
| **Completion Evidence** | SCHEMA readied for row insertion report; schema validation script output |
| **Parallelizable** | Yes — independent of Stage 1 beyond roster counts |

---

## Stage 3: Division Management Services

**Goal**: Register MCP tools for division operations with formal Zod schemas; service-layer permission enforcement.

| Item | Details |
|------|---------|
| **Dependencies** | Stage 2 (data model ready) |
| **Files Involved** | - New MCP tool registrations<br>- Zod schema definitions<br>- Service functions |
| **DB Impact** | None (tool registration only; no schema changes) |
| **API Impact** | New MCP tools: `create_division`, `assign_division_head`, `update_division`, `list_divisions`, `list_specialists` |
| **UI Impact** | Division management UI sections (read-only display initially) |
| **Test Requirements** | - Zod schema validation tests<br>- MCP tool input/output tests<br>- Permission enforcement tests (non-head cannot create division) |
| **Acceptance Criteria** | - All 5 MCP tools registered and functional<br>- Zod schemas validate all inputs<br>- Founder-only enforcement for `assign_division_head`<br>- Division Head–only enforcement for `update_division`<br>- 25+ existing tools remain functional (regression) |
| **Rollback Considerations** | Disable/new MCP tool removal; revert Zod schema changes; untest registered tools |
| **Completion Evidence** | - MCP tool registration confirmation<br>- Zod schema files documented<br>- Test suite passing for new tools |
| **Parallelizable** | Partially — can parallelize with Stage 4 (both need Zod schemas), but Stage 4 depends on Stage 3's tools existing |

---

## Stage 4: Founder Appointment and Approval Workflow

**Goal**: Register MCP tools for Founder approval sequence with Zod schemas; audit logging via `memory_versions` + `memory_access` log.

| Item | Details |
|------|---------|
| **Dependencies** | Stage 3 (division services registered) |
| **Files Involved** | - New MCP tools: `approve_division_head`, `reject_division_head`, `authorize_division_head_activation`, `suspend_division_head`, `retire_division_head`<br>- Zod schemas for all 5 tools<br>- Audit logging integration |
| **DB Impact** | None (tool + audit logging; no schema changes beyond existing `memory_versions`/`memory_access`) |
| **API Impact** | New MCP tools for Founder approval workflow |
| **UI Impact** | Founder-facing approval dashboard; Division Head appointment UI |
| **Test Requirements** | - Zod schema validation tests<br>- Founder-only permission tests<br>- Audit log entry verification<br>- Rejection/approval flow end-to-end |
| **Acceptance Criteria** | - All 5 Founder MCP tools registered and functional<br>- Zod schemas validate all inputs<br>- Only Founder can invoke approval tools<br>- Every approval/rejection creates `memory_versions` audit entry<br>- `memory_access` log tracks Founder actions |
| **Rollback Considerations** | Remove newly registered MCP tools; revert Zod schemas; clear audit entries created during testing (if rollback is pre-execution) |
| **Completion Evidence** | - MCP tool registration confirmation<br>- Zod schema files<br>- Audit logging verification report |
| **Parallelizable** | No — depends on Stage 3's MCP tools being registered first |

---

## Stage 5: Staff Onboarding and Lifecycle

**Goal**: Register MCP tools for specialist management (register, update status, suspend, retire) with Zod schemas; 45 specialists onboardable with dual-runtime support.

| Item | Details |
|------|---------|
| **Dependencies** | Stage 3 (data model) + Stage 4 (approval workflow) |
| **Files Involved** | - New MCP tools: `register_staff_agent`, `update_staff_status`, `update_staff_permissions`, `suspend_staff_agent`, `retire_staff_agent`<br>- Zod schemas for all 5 tools<br>- Runtime instance tracking logic |
| **DB Impact** | None (tool registration; runtime_instances column already exists in `staff_agents`) |
| **API Impact** | New MCP tools for staff onboarding and lifecycle |
| **UI Impact** | Specialist onboarding UI; status management panel |
| **Test Requirements** | - Zod schema validation tests<br>- Duplicate staff_id rejection tests<br>- Runtime instance tracking tests (['claude'], ['hermes'], ['claude', 'hermes'])<br>- Status transition valid tests |
| **Acceptance Criteria** | - All 5 MCP tools registered and functional<br>- Zod schemas validate all inputs<br>- `register_staff_agent` rejects duplicate staff_id<br>- Runtime instances tracked correctly<br>- Status transitions: active ↔ inactive ↔ terminated work as expected<br>- 45 specialists can be onboarded |
| **Rollback Considerations** | Remove newly registered MCP tools; revert Zod schemas; undo test onboarding data |
| **Completion Evidence** | - MCP tool registration confirmation<br>- Zod schema files<br>- Onboarding test results (45 specialists registered) |
| **Parallelizable** | No — depends on Stage 3 and Stage 4 |

---

## Stage 6: Task and Deliverable Management

**Goal**: Register MCP tools for task lifecycle and deliverable management with Zod schemas; review/approval workflow.

| Item | Details |
|------|---------|
| **Dependencies** | Stage 3 (data model) + Stage 5 (staff agents) |
| **Files Involved** | - New MCP tools: `create_task`, `update_task`, `list_tasks`, `complete_task`, `create_deliverable`, `update_deliverable`, `list_deliverables_by_task`<br>- Zod schemas for all tools (task schemas: CreateTask, UpdateTask; deliverable schemas: CreateDeliverable, UpdateDeliverable)<br>- Review/approval workflow logic |
| **DB Impact** | None (tool registration; columns `dependencies`, `deliverable_id`, `file_references`, `task_relationships`, `audit_log` added via migrations 003/004 during implementation) |
| **API Impact** | New MCP tools for task and deliverable management |
| **UI Impact** | Task creation/management UI; deliverable browser and review UI |
| **Test Requirements** | - Zod schema validation tests<br>- Task creation with dependencies tests<br>- Deliverable creation and review workflow tests<br>- Dependency cycle detection tests<br>- Priority enum validation (low|medium|high|critical) |
| **Acceptance Criteria** | - All 7 MCP tools registered and functional<br>- Zod schemas validate all inputs<br>- Task creation validates no cyclic dependencies<br>- Deliverable review workflow: submitted → accepted/rejected/revision_requested<br>- Priority enum validated<br>- `deliverable_id` app-layer relationship (Option B) works without DB FK |
| **Rollback Considerations** | Remove newly registered MCP tools; revert Zod schemas; undo migration 003/004 column additions if rollback is pre-execution |
| **Completion Evidence** | - MCP tool registration confirmation<br>- Zod schema files<br>- Task/deliverable test results |
| **Parallelizable** | Can parallelize with Stage 7 (both need MCP tool registration), but Stage 7 depends on Stage 6's tools existing |

---

## Stage 7: Cross-Division Coordination

**Goal**: Extend `cross_division_shares` with request-tracking columns; register MCP tools for inter-division requests with Zod schemas.

| Item | Details |
|------|---------|
| **Dependencies** | Stage 3 (data model) + Stage 4 (Founder workflow) |
| **Files Involved** | - Migration 005: `005_cross_division_shares_stage7.sql` (adds `request_type`, `status`, `justification`, `priority`, `deadline`, `approved_by_type`, `approved_by_id`, `approved_at` columns)<br>- New MCP tools: `request_cross_division_access`, `approve_cross_division_access`, `revoke_cross_division_access`, `list_pending_cross_division_requests`<br>- Zod schemas for all 4 tools |
| **DB Impact** | Migration 005 ALTER TABLE adding 8 columns to `cross_division_shares`; CHECK constraints on `request_type`, `status`, `priority` |
| **API Impact** | New MCP tools for cross-division request management |
| **UI Impact** | Cross-division request queue UI; Founder approval workflow UI |
| **Test Requirements** | - Migration 005 execution against temporary DB<br>- CHECK constraint validation (invalid request_type/status/priority rejected)<br>- MCP tool input validation tests<br>- Founder-only enforcement for approve/revoke<br>- Pending request listing tests |
| **Acceptance Criteria** | - Migration 005 executed; all 8 columns exist with correct defaults<br>- CHECK constraints enforce valid enums<br>- Division Head can submit cross-division requests via MCP<br>- Founder can approve/reject requests<br>- Revoked requests removed immediately from query layer<br>- Audit log entries for all approval/rejection actions |
| **Rollback Considerations** | Table rebuild from backup (Migration 005 is ALTER TABLE; SQLite < 3.35 doesn't support DROP COLUMN easily); revert cross_division_shares to pre-migration state; re-run migrations 001-005 in order if full rollback needed |
| **Completion Evidence** | - Migration 005 SQL file verified executed<br>- MCP tool registration confirmation<br>- Zod schema files<br>- Constraint validation test results |
| **Parallelizable** | Partially — migration 005 can run after Stage 8 begins, but tool registration depends on it; can parallelize with Stage 6's MCP tool registration |

---

## Stage 8: MCP Integration

**Goal**: Register all new tools with existing MCP server; ensure 25+ existing tools remain functional; validate tool contracts; test dual-runtime.

| Item | Details |
|------|---------|
| **Dependencies** | Stages 3–7 (all service functions ready) |
| **Files Involved** | - MCP server configuration updates<br>- Tool registration scripts<br>- Contract validation tests<br>- Dual-runtime test suite |
| **DB Impact** | None (MCP server configuration; no schema changes) |
| **API Impact** | All new Phase 6 tools registered; 25+ existing tools verified intact |
| **UI Impact** | None (backend infrastructure) |
| **Test Requirements** | - MCP server startup test<br>- Tool contract validation (inputs, outputs, error handling)<br>- 25+ existing tool regression tests<br>- Dual-runtime: same tools work on Claude Code + Hermes Agent |
| **Acceptance Criteria** | - MCP server starts successfully with all new tools registered<br>- 25+ existing tools still functional (no breakage)<br>- New tool contracts validated: inputs, outputs, validation, error handling<br>- Dual-runtime testing passes: identical behavior on both runtimes |
| **Rollback Considerations** | Unregister new tools; revert MCP server configuration; re-run regression tests to confirm existing tools still work |
| **Completion Evidence** | - MCP server configuration validated<br>- Regression test results (all 25+ existing tools pass)<br>- Dual-runtime test report |
| **Parallelizable** | No — depends on all stages 3–7 completing first |

---

## Stage 9: Dashboard Integration (Optional, Phase 7)

**Goal**: UI sections for organization overview, divisions, specialists, tasks, deliverables, cross-division requests; preserve existing Phase 5 UI.

| Item | Details |
|------|---------|
| **Dependencies** | Stage 8 (MCP tools integrated) |
| **Files Involved** | - UI components: organization overview, divisions list, division details, specialist directories, agent status panels, task management, deliverable browser, cross-division request queue<br>- Phase 5 UI preservation checks |
| **DB Impact** | None (UI reads existing schema) |
| **API Impact** | UI calls to newly registered MCP tools |
| **UI Impact** | New dashboard sections; existing Phase 5 functionality unchanged |
| **Test Requirements** | - Responsive UI tests at 3-col (desktop), 2-col (tablet ≥768px), 1-col (mobile <768px)<br>- Navigation tests at all screen sizes<br>- Tap target ≥44px at mobile widths<br>- No overflow/clipping at breakpoints<br>- Existing Phase 5 UI still functional |
| **Acceptance Criteria** | - Dashboard renders correctly at all breakpoints<br>- Navigation works at all screen sizes<br>- Tap targets ≥44px at mobile widths<br>- No overflow, clipping, or unreadable content<br>- Phase 5 functionality intact (chat, council, memory, meetings)<br>- Phase 6 sections added without regression |
| **Rollback Considerations** | Disable new UI components; revert to Phase 5-only dashboard; UI is frontend—rollback = feature toggle off |
| **Completion Evidence** | - UI component gallery<br>- Responsive test results<br>- Regression test report |
| **Parallelizable** | No — depends on Stage 8; optional and deferrable to Phase 7 |

---

## Stage 10: Integration Testing and Acceptance

**Goal**: Run full test suite; verify regression; runtime testing; privacy and access control verification; responsive UI verification; Founder sign-off.

| Item | Details |
|------|---------|
| **Dependencies** | All stages 1–9 complete |
| **Files Involved** | - `npm test` → 106 existing + new Phase 6 test suites<br>- Runtime testing: Claude Code + Hermes Agent dual-operation<br>- Privacy and access control verification<br>- Responsive UI verification at 768px breakpoint |
| **DB Impact** | None (test-only) |
| **API Impact** | None (test-only) |
| **UI Impact** | None (test-only) |
| **Test Requirements** | - Full test suite: `npm test` → all Phase 1–5 + Phase 6 tests pass<br>- Regression: all Phase 1–4 tests still pass<br>- Runtime testing: dual-runtime operation<br>- Privacy/access control verification<br>- Responsive UI verification at 768px |
| **Acceptance Criteria** | - `npm test` passes (106 existing + new Phase 6 suites)<br>- Regression: all Phase 1–4 tests still pass<br>- Runtime testing: Claude Code + Hermes Agent dual-operation verified<br>- Privacy and access control boundaries verified<br>- Responsive UI verification at 768px breakpoint<br>- Founder explicit authorization granted for Phase 6 |
| **Rollback Considerations** | If `npm test` fails: identify failing test, fix root cause, re-run. If critical breakage: revert the stage that introduced the breakage. Full rollback = revert to pre-Phase 6 state (database backup, MCP tool unregistration, UI revert). |
| **Completion Evidence** | - Full test suite report (pass/fail per test)<br>- Regression test results<br>- Runtime testing report<br>- Privacy/access control verification report<br>- UI responsive test results<br>- Founder authorization record |
| **Parallelizable** | No — final gate; runs after all stages 1–9 complete |

---

## Parallelizable Work Summary

| Parallel Group | Stages | Reason |
|----------------|--------|--------|
| **Group A** | Stage 1, Stage 2 | Both are verification/read-only; no dependencies between them; Stage 2 depends on roster counts from Stage 1 but can run immediately after |
| **Group B** | Stage 3, Stage 4 | Stage 4 depends on Stage 3, but Zod schema work in both can start in parallel; Stage 3 tools registered first, then Stage 4 |
| **Group C** | Stage 5, Stage 6 | Both register MCP tools with Zod schemas; can parallelize tool registration work, but Stage 6 depends on Stage 5's staff agents being onboardable |
| **Group D** | Stage 7, Stage 8 | Stage 8 depends on all stages 3–7; Stage 7 can start once Stages 3+4 are done (its dependencies), migration 005 can run in parallel with Stage 8's contract validation |

**Critical Path**: Stage 1 → Stage 2 → Stage 3 → Stage 4 → Stage 5 → Stage 6 → Stage 7 → Stage 8 → Stage 10 (≈8–10 weeks)

**Total estimated duration**: 8–10 weeks (depending on Founder approval velocity)

---

## Migration Execution Parallelism (from Manifest)

The 5 SQL migrations have internal parallelism:

```
Group 1 (parallel):     [001, 002] — table rebuilds, no dependencies between them
Group 2 (sequential):   [003, 004, 005] — additive ALTER TABLE, 005 depends on 002 completed

Valid sequences:
- Sequential: 001 → 002 → 003 → 004 → 005 (recommended)
- Parallel groups: [001, 002] → [003, 004, 005]
```

Migration 001 (staff_agents rebuild) and 002 (cross_division_shares rebuild) can run in parallel since they target different tables with no cross-dependencies. However, the recommended sequential order is 001 → 002 → 003 → 004 → 005 for simplicity and to avoid race conditions in tooling.

---

## Founder Authorization Checkpoint

**All 10 stages require explicit Founder authorization before execution.** The critical path passes through stages requiring Founder approval:

- Stage 4: Founder appointment/approval workflow
- Stage 5: Staff onboarding (45 specialists)
- Stage 6: Task/deliverable management (part of implementation scope)
- Stage 7: Cross-division coordination (policy change)
- Stage 10: Final acceptance and Founder sign-off

Without Founder authorization, phases 1–3 (verification/data model) and stage 8 (MCP integration without functional changes) can proceed, but the critical path to production readiness stalls.