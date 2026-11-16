# M2/M3 Development Task List

## Specification Summary
**Source Documents**: 
- `docs/archive/prompts/phase-10/NEXT_PROMPT.md` — Implementation requirements for M2 (Core Communication & Workflow) + M3 (Dashboard Functional Completion)
- `docs/audits/release/M2_M3_BASELINE_REPORT.md` — Baseline audit confirming current state

**Technical Stack**: TypeScript/Node.js backend, React + MUI frontend, SQLite database, MCP bridge for agent communication

**Target Timeline**: 7 batches as defined in NEXT_PROMPT.md

**Branch**: `refactor/repository-structure` (current working branch)

---

## Development Tasks

### BATCH 1 — Baseline and Contracts [COMPLETE]

| Task ID | Batch | Description | Status | Assigned Agent | Dependencies | Acceptance Criteria |
|---------|-------|-------------|--------|----------------|--------------|---------------------|
| B1-T1 | 1 | Complete pre-implementation audit | ✅ COMPLETE | Senior PM | — | M2_M3_BASELINE_REPORT.md created with current status, defects, working functionality, missing functionality, relevant files, dependencies, sequence, risks |
| B1-T2 | 1 | Reconcile message API contracts (id vs message_id, {message} vs direct Message) | ✅ COMPLETE | Backend Architect | — | Single canonical message identifier; normalized API response structures; updated frontend types |
| B1-T3 | 1 | Confirm database and identity assumptions | ✅ COMPLETE | Database Optimizer | — | Schema verified; no assumptions contradicted |
| B1-T4 | 1 | Identify reusable code for M2/M3 | ✅ COMPLETE | Senior Developer | — | Existing services, components, tests documented in baseline report |

---

### BATCH 2 — Chat Core

| Task ID | Batch | Description | Status | Assigned Agent | Dependencies | Acceptance Criteria |
|---------|-------|-------------|--------|----------------|--------------|---------------------|
| B2-T1 | 2 | Fix bidirectional conversation history in `src/communication/messages.ts` | ✅ COMPLETE | Backend Architect | B1-T2 | `listConversations` returns both incoming AND outgoing messages; messages sent by current user appear in history; chronological ordering preserved; no arbitrary 50-message truncation |
| B2-T2 | 2 | Fix conversation retrieval in `checkInbox` to include sent messages | ✅ COMPLETE | Backend Architect | B1-T2 | Messages grouped by conversation/participant pair; sender/recipient attribution preserved; unread counts calculated correctly |
| B2-T3 | 2 | Add pagination/incremental history support to message endpoints | ✅ COMPLETE | Backend Architect | B2-T1, B2-T2 | Support `limit` and `offset` or cursor-based pagination; prevent duplicate messages during refresh |
| B2-T4 | 2 | Implement new conversation creation flow in `ChatPage.tsx` | ✅ COMPLETE | Frontend Developer | B2-T1 | Display available agents from identity records (`src/council/divisions.ts`); support recipient selection; start new conversation; preserve existing history; prevent invalid recipients |
| B2-T5 | 2 | Add agent selection UI component in `frontend/src/features/chat/components/` | ✅ COMPLETE | Frontend Developer | B2-T4 | Modal or dropdown showing registered agents with display names and runtimes; filter by availability/authorization |
| B2-T6 | 2 | Implement reliable polling for conversation list refresh | ✅ COMPLETE | Frontend Developer | B2-T1 | Conversation list refreshes independently (separate from selected conversation); 3s polling cleaned up on unmount; handles network failures gracefully; avoids duplicate polling loops |
| B2-T7 | 2 | Implement unread state management | ✅ COMPLETE | Frontend Developer | B2-T1, B2-T6 | Unread counts update correctly in conversation list; new incoming messages appear without full page reload; message ordering consistent |
| B2-T8 | 2 | Add contract tests for message endpoints (create, list, inbox) | ⬜ TODO | Test Automation Engineer | B1-T2 | Tests cover: message creation, response contract, bidirectional history, authorization, recipient validation, unread counts |
| B2-T9 | 2 | Update frontend TypeScript types in `frontend/src/shared/types/api.ts` to match backend contract | ✅ COMPLETE | Frontend Developer | B1-T2 | Single `Message` interface with `message_id` (canonical); API response types match actual backend; no type mismatches |

**Files to Modify:**
- `src/communication/messages.ts` — Core message service logic
- `src/api/routes/messages.routes.ts` — REST endpoints
- `src/api/schemas/index.ts` — Zod validation schemas
- `frontend/src/features/chat/pages/ChatPage.tsx` — Main chat component
- `frontend/src/features/chat/components/` — New agent selection component
- `frontend/src/shared/api/client.ts` — API client (if needed)
- `frontend/src/shared/types/api.ts` — TypeScript types
- `tests/` — New contract tests

---

### BATCH 3 — Runtime and Workflow

| Task ID | Batch | Description | Status | Assigned Agent | Dependencies | Acceptance Criteria |
|---------|-------|-------------|--------|----------------|--------------|---------------------|
| B3-T1 | 3 | Verify Claude/Hermes MCP integration end-to-end | ⬜ TODO | Backend Architect | B2-T1..B2-T7 | Document actual status: Founder→Backend→Storage→MCP→Agent→MCP→Backend→Storage→Founder UI workflow verified OR explicitly documented as blocked with exact missing integration and reproducible verification procedure |
| B3-T2 | 3 | Test agent message retrieval via MCP tools | ⬜ TODO | Backend Architect | B3-T1 | Intended agent can retrieve messages; receives correct sender and conversation context; response persisted; Founder sees response in correct conversation; history available after refresh |
| B3-T3 | 3 | Verify task delegation workflow (Council → Divisions → Staff → Delegation → Execution → Deliverable → Approval) | ⬜ TODO | Backend Architect | B1-T4 | Founder can initiate authorized task; task delegated to appropriate division/staff; permission rules enforced; execution status persisted; deliverables associated with correct task; approval decisions authorized; status transitions validated; activity/audit records consistent; error states surfaced |
| B3-T4 | 3 | Verify deliverable reviewer assignment endpoint `PUT /api/deliverables/:id/assign-reviewer` | ⬜ TODO | Backend Architect | B1-T4 | Route registered; request validation; reviewer identity validation; authorization; database persistence; invalid reviewer handling; existing reviewer replacement; frontend integration; regression tests |
| B3-T5 | 3 | Test complete task lifecycle: create → delegate → execute → submit deliverable → assign reviewer → approve | ⬜ TODO | Test Automation Engineer | B3-T3, B3-T4 | All transitions work; audit trail complete; no state leaks |
| B3-T6 | 3 | Add integration tests for task delegation, execution, deliverable workflow, approval | ⬜ TODO | Test Automation Engineer | B3-T3, B3-T4 | Tests for: task creation, delegation, execution, deliverable transitions, approval authorization |
| B3-T7 | 3 | Document Claude/Hermes runtime integration status in `M2_AGENT_RUNTIME_INTEGRATION_REPORT.md` | ⬜ TODO | Technical Writer | B3-T1, B3-T2 | Report distinguishes: implemented, tested/passed, tested/failed, not tested, blocked by external dependencies, deferred by scope; includes actual test commands and results |

**Files to Modify:**
- `src/council/task-delegation.ts` — Task delegation, execution, deliverable workflow
- `src/council/divisions.ts` — Division/staff/task/deliverable operations
- `src/api/routes/deliverables.routes.ts` — Deliverable endpoints (verify assign-reviewer)
- `src/api/routes/tasks.routes.ts` — Task endpoints (if exists)
- `tests/` — Integration tests
- `docs/audits/release/M2_AGENT_RUNTIME_INTEGRATION_REPORT.md` — Report

---

### BATCH 4 — Dashboard Backend

| Task ID | Batch | Description | Status | Assigned Agent | Dependencies | Acceptance Criteria |
|---------|-------|-------------|--------|----------------|--------------|---------------------|
| B4-T1 | 4 | Implement `/api/activity` endpoint in `src/api/routes/activity.routes.ts` (new) | ⬜ TODO | Backend Architect | B1-T3 | Route registered; returns actual persisted activity from database/audit tables; includes useful event metadata (type, actor, target, timestamp); supports pagination/bounded results; sorts newest first; handles empty results; handles server errors |
| B4-T2 | 4 | Fix dashboard statistics retry key mismatches in `DashboardPage.tsx` and backend | ⬜ TODO | Backend Architect / Frontend Developer | B1-T3 | Canonical statistic identifiers established: `divisions` (not `activedivisions`), `staff` (not `staffagents`), `approvals` (not `pendingapprovals`); retry actions target correct request |
| B4-T3 | 4 | Add backend support for quick actions: Create Division, Invite Staff, New Task | ⬜ TODO | Backend Architect | B1-T3 | Use existing division/staff/task APIs; validate input; persist new records; return created resources |
| B4-T4 | 4 | Add activity endpoint tests | ⬜ TODO | Test Automation Engineer | B4-T1 | Tests for: activity endpoint, dashboard statistics, quick-action backend support |
| B4-T5 | 4 | Update dashboard statistics to verify counts against actual database records | ⬜ TODO | Backend Architect | B4-T2 | Counts match DB; dashboard data refreshes after relevant operations (task created, division added, etc.) |

**Files to Modify:**
- `src/api/routes/activity.routes.ts` — NEW FILE
- `src/api/routes/dashboard.routes.ts` — Statistics endpoints (if exists, or create)
- `src/api/routes/divisions.routes.ts` — Division creation (verify)
- `src/api/routes/staff.routes.ts` — Staff invitation (verify)
- `src/api/routes/tasks.routes.ts` — Task creation (verify)
- `src/council/divisions.ts` — Division operations
- `frontend/src/features/dashboard/pages/DashboardPage.tsx` — Fix retry keys, connect to new endpoints
- `tests/` — Backend tests for activity, statistics, quick actions

---

### BATCH 5 — Dashboard and Frontend

| Task ID | Batch | Description | Status | Assigned Agent | Dependencies | Acceptance Criteria |
|---------|-------|-------------|--------|----------------|--------------|---------------------|
| B5-T1 | 5 | Implement Create Division quick action workflow | ⬜ TODO | Frontend Developer | B4-T3 | Opens actual creation dialog/form; validates form; uses backend API; persists division; updates dashboard and organization views |
| B5-T2 | 5 | Implement Invite Staff quick action workflow | ⬜ TODO | Frontend Developer | B4-T3 | Opens actual staff creation/invitation workflow; respects identity/division relationships; validates input; uses authorization; updates views after success; no fake invitations |
| B5-T3 | 5 | Implement New Task quick action workflow | ⬜ TODO | Frontend Developer | B4-T3 | Opens actual task creation interface; supports valid task details/assignment; validates required fields; persists task; refreshes task and dashboard views; not just navigation with ignored query param |
| B5-T4 | 5 | Consolidate theme ownership — single authoritative theme state | ⬜ TODO | Frontend Developer | B1-T3 | Remove dual state (App ThemeWrapper + Layout darkMode); ThemeWrapper is single source; immediate switching without page reload; persist preference using existing storage; all pages/components use same theme; verify contrast/readability in both modes |
| B5-T5 | 5 | Fix invalid nested CSS selectors in NavLink styles in `Layout.tsx` | ⬜ TODO | Frontend Developer | — | Use MUI `sx` or `styled` approach; active/hover/focus states work; keyboard accessible; drawer behavior; responsive navigation; mobile/desktop layouts |
| B5-T6 | 5 | Implement proper 404/not-found page | ⬜ TODO | Frontend Developer | — | Unknown paths show clear 404 state; route back to dashboard; no blank pages; no silent redirects to unrelated pages |
| B5-T7 | 5 | Implement Settings and Profile actions (or label as unavailable) | ⬜ TODO | Frontend Developer | — | Actions within MVP scope implemented; deferred actions clearly labeled "Coming Soon" or "Unavailable"; no inert clickable controls |
| B5-T8 | 5 | Label Council and Meetings tabs as "Coming Soon" or hide from navigation | ⬜ TODO | Frontend Developer | — | Deferred pages clearly marked or hidden; preserve existing routes and data |
| B5-T9 | 5 | Verify responsive UI across Dashboard, Chat, Organization, Divisions, Staff, Tasks, Deliverables, Settings, Profile, 404 | ⬜ TODO | Frontend Developer | B5-T4, B5-T5, B5-T6 | Mobile and desktop layouts usable; consistent spacing/typography; readable contrast; predictable navigation |
| B5-T10 | 5 | Add frontend tests for dashboard activity, statistics, retry, quick actions, theme, navigation, 404 | ⬜ TODO | Test Automation Engineer | B5-T1..B5-T9 | Tests cover: dashboard activity, statistics, retry behavior, quick actions, theme switching, navigation, not-found page, deliverable reviewer assignment, responsive behavior |

**Files to Modify:**
- `frontend/src/features/dashboard/pages/DashboardPage.tsx` — Quick action handlers, retry keys
- `frontend/src/app/layouts/Layout.tsx` — Navigation, theme state removal, NavLink styles
- `frontend/src/app/App.tsx` — ThemeWrapper as single source, 404 route
- `frontend/src/shared/theme/index.ts` — Theme system consolidation
- `frontend/src/features/dashboard/components/` — Quick action dialogs/components
- `frontend/src/features/settings/pages/SettingsPage.tsx` — Settings actions
- `frontend/src/features/profile/pages/ProfilePage.tsx` — Profile actions
- `frontend/src/app/routes.tsx` (or routing config) — 404 route, Coming Soon labels
- `tests/` — Frontend tests

---

### BATCH 6 — Regression and Integration

| Task ID | Batch | Description | Status | Assigned Agent | Dependencies | Acceptance Criteria |
|---------|-------|-------------|--------|----------------|--------------|---------------------|
| B6-T1 | 6 | Fix test isolation issues in security tests | ⬜ TODO | Test Automation Engineer | B1-T4 | Identify shared state (filesystem `.secrets/`, `process.env`, in-memory DB nonce table); ensure each test suite has isolated setup/teardown; prevent concurrent test interference; use separate temporary databases; restore env vars; close DB connections/servers; run full suite repeatedly to establish reproducibility |
| B6-T2 | 6 | Run backend test suite (all unit + integration) | ⬜ TODO | Test Automation Engineer | B2-T8, B3-T6, B4-T4 | All backend tests pass; individual results reported separately from combined suite results |
| B6-T3 | 6 | Run frontend test suite | ⬜ TODO | Test Automation Engineer | B2-T8, B5-T10 | All frontend tests pass |
| B6-T4 | 6 | Run full E2E test suite (E2E-01 through E2E-05) | ⬜ TODO | Test Automation Engineer | B2-T1..B2-T7, B3-T5, B4-T1..B4-T3, B5-T1..B5-T9 | E2E-01: Founder Chat workflow complete; E2E-02: Agent Communication verified or blocked documented; E2E-03: Task Lifecycle complete; E2E-04: Dashboard functional; E2E-05: Theme and Navigation functional |
| B6-T5 | 6 | Run security regression tests (SEC-01..06) | ⬜ TODO | Security Architect | B1-T4 | All 61 security tests pass individually AND combined; no critical/high security regression |
| B6-T6 | 6 | TypeScript compilation verification | ⬜ TODO | Frontend Developer / Backend Architect | All prior | `tsc --noEmit` passes cleanly for both frontend and backend |
| B6-T7 | 6 | Production frontend build verification | ⬜ TODO | Frontend Developer | B6-T6 | `npm run build` succeeds without errors |
| B6-T8 | 6 | Create `M2_M3_TEST_REPORT.md` with all test results | ⬜ TODO | Technical Writer | B6-T1..B6-T7 | Report distinguishes: implemented, tested/passed, tested/failed, not tested, blocked, deferred; includes actual commands and results |
| B6-T9 | 6 | Create `M2_M3_SECURITY_REGRESSION_REPORT.md` | ⬜ TODO | Security Architect | B6-T5 | Security test results documented; no regressions |

**Files to Modify:**
- `tests/security/*.test.ts` — Fix shared state isolation
- `tests/` — Any test infrastructure changes
- `package.json` — Test scripts if needed
- `docs/audits/release/M2_M3_TEST_REPORT.md` — Report
- `docs/audits/release/M2_M3_SECURITY_REGRESSION_REPORT.md` — Report

---

### BATCH 7 — Final Audit

| Task ID | Batch | Description | Status | Assigned Agent | Dependencies | Acceptance Criteria |
|---------|-------|-------------|--------|----------------|--------------|---------------------|
| B7-T1 | 7 | Review all changed files for regressions | ⬜ TODO | Senior PM / Code Reviewer | B6-T1..B6-T7 | No unintended changes; all M1 security fixes intact; migration 016 preserved; Founder key rotation preserved |
| B7-T2 | 7 | Verify Git tracking and .gitignore | ⬜ TODO | Senior PM | B7-T1 | `.gitignore` does not hide source files, migrations, tests, audit reports; `git status` clean; no secrets, databases, test artifacts, temp files committed |
| B7-T3 | 7 | Review and finalize all required reports | ⬜ TODO | Technical Writer | B6-T8, B6-T9 | All 9 reports tracked and complete: M2_BASELINE, M2_CHAT_COMPLETION, M2_AGENT_RUNTIME_INTEGRATION, M2_WORKFLOW_INTEGRATION, M3_DASHBOARD_FUNCTIONALITY, M3_UI_UX_AUDIT, M2_M3_TEST_REPORT, M2_M3_SECURITY_REGRESSION, M2_M3_FINAL_ACCEPTANCE |
| B7-T4 | 7 | Produce final acceptance checklist against NEXT_PROMPT.md Section 11 | ⬜ TODO | Senior PM | B7-T1..B7-T3 | All 23 acceptance criteria verified with evidence |
| B7-T5 | 7 | Prepare next milestone recommendation | ⬜ TODO | Senior PM | B7-T4 | Documented in M2_M3_FINAL_ACCEPTANCE_REPORT.md with: outstanding defects, external blockers, pending approval gates, required Founder decisions, recommended next milestone |
| B7-T6 | 7 | Final delivery summary: M2 status, M3 status, commit SHA, files changed, test results, integration results, build results, security results, defects, blockers, approval gates | ⬜ TODO | Senior PM | B7-T4, B7-T5 | Complete delivery format per NEXT_PROMPT.md Section 12 |

**Files to Create/Modify:**
- `docs/audits/release/M2_BASELINE_REPORT.md` — (from baseline)
- `docs/audits/release/M2_CHAT_COMPLETION_REPORT.md`
- `docs/audits/release/M2_AGENT_RUNTIME_INTEGRATION_REPORT.md` — (from B3-T7)
- `docs/audits/release/M2_WORKFLOW_INTEGRATION_REPORT.md`
- `docs/audits/release/M3_DASHBOARD_FUNCTIONALITY_REPORT.md`
- `docs/audits/release/M3_UI_UX_AUDIT_REPORT.md`
- `docs/audits/release/M2_M3_TEST_REPORT.md` — (from B6-T8)
- `docs/audits/release/M2_M3_SECURITY_REGRESSION_REPORT.md` — (from B6-T9)
- `docs/audits/release/M2_M3_FINAL_ACCEPTANCE_REPORT.md` — (from B7-T3, B7-T5, B7-T6)

---

## Quality Requirements

- [ ] All backend tests pass individually AND in combined suite
- [ ] All frontend tests pass
- [ ] All E2E workflows verified (or explicitly documented as blocked)
- [ ] TypeScript compilation clean (`tsc --noEmit`)
- [ ] Production frontend build succeeds (`npm run build`)
- [ ] No critical/high security regressions
- [ ] All 9 required reports created and tracked
- [ ] Git history clean, no force-push, no secrets committed
- [ ] M1 security invariants preserved (fail-closed auth, no hardcoded fallbacks, no private keys in browser, loopback-only local mode, Founder final approval authority, Division Heads cannot bypass Founder approval, migration runner authoritative)

---

## Technical Notes

**Development Stack**: 
- Backend: TypeScript/Node.js, Express, SQLite, MCP bridge
- Frontend: React 18, MUI v5, Vite, TypeScript
- Testing: Vitest (unit/integration), Playwright (E2E)

**Special Instructions from NEXT_PROMPT.md**:
- Do not introduce WebSockets or Redis — polling acceptable
- Do not implement full Council/Meetings scope — label as Coming Soon
- Do not execute database cleanup operations from MANIFEST
- Do not reset production database
- Do not force-push or merge without explicit authorization
- Preserve all existing user changes on branch
- Verify `.gitignore` does not hide source files, migrations, tests, audit reports

**Timeline Expectations**: 
- Batch 2: ~2-3 days (Chat Core)
- Batch 3: ~2-3 days (Runtime/Workflow)
- Batch 4: ~1-2 days (Dashboard Backend)
- Batch 5: ~2-3 days (Dashboard Frontend)
- Batch 6: ~2-3 days (Regression/Integration)
- Batch 7: ~1 day (Final Audit)

**External Blockers**: 
- Claude/Hermes runtime access for E2E-02 verification (may be unavailable — document if blocked)

---

## Task Summary by Status

| Batch | Total Tasks | Complete | In Progress | TODO |
|-------|-------------|----------|-------------|------|
| 1 | 4 | 4 | 0 | 0 |
| 2 | 9 | 0 | 0 | 9 |
| 3 | 7 | 0 | 0 | 7 |
| 4 | 5 | 0 | 0 | 5 |
| 5 | 10 | 0 | 0 | 10 |
| 6 | 9 | 0 | 0 | 9 |
| 7 | 6 | 0 | 0 | 6 |
| **TOTAL** | **50** | **4** | **0** | **46** |

---

*Generated: 2026-11-16 | Based on NEXT_PROMPT.md and M2_M3_BASELINE_REPORT.md | Branch: refactor/repository-structure*