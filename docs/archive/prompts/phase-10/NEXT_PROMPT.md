# COUNCIL BRIDGE — VERIFIED REMEDIATION & DASHBOARD OVERHAUL PLAN

## Project

- Repository: `snowep/council-bridge`
- Local path: `C:\Projects\council-bridge`
- Branch: `refactor/repository-structure`
- Baseline commit: `a04102478093e477ea629ecf432a776da6d638d9`
- Frontend: React, TypeScript, Vite, MUI 9
- Backend: Node.js, TypeScript, Express, SQLite

## Mission

Perform a complete repository review, resolve verified defects without damaging working functionality, and prepare a professional dashboard layout overhaul plan.

This is a controlled remediation task.

**Preserving working code is more important than making unnecessary improvements.**

Do not rewrite functioning modules simply because a different implementation looks cleaner. Do not refactor unrelated features. Do not replace existing architecture without proving that a change is necessary.

The dashboard overhaul must be inspected and planned before implementation.

---

# 0. NON-NEGOTIABLE RULES

### 0.1 Protect the repository

Before doing anything:

1. Run `git status --short`.
2. Record the current branch and HEAD SHA.
3. Confirm whether HEAD is still `a041024` or a descendant.
4. Record all existing modified, staged, deleted, and untracked files.
5. Identify existing local changes and treat them as Founder-owned work.

**Never:**
- Run `git reset`, `git checkout --`, `git clean`, or destructive Git commands.
- Stash, overwrite, discard, or revert existing user changes.
- Delete files simply because they appear unused.
- Replace working implementations with speculative alternatives.
- Modify production database records.
- Run destructive database scripts.
- Drop database indexes or tables.
- Rewrite migration history or existing migration checksums.
- Commit, push, merge, deploy, or rewrite Git history.
- Start unrelated M4 work.

Preserve the existing database and all user data.

### 0.2 Working-code protection

Every proposed code change must have:

- A verified defect or explicitly approved requirement.
- A precise explanation of why the change is necessary.
- A list of affected files.
- A regression test or reproducible verification procedure.
- Evidence that existing behavior remains intact.

If a feature works and no defect is demonstrated, leave it alone.

Do not refactor a complete page merely to introduce Atomic Design components.

Do not change public API contracts unless the current contract is demonstrably incorrect and all affected consumers are identified.

### 0.3 Scope control

Authorized work:

1. Complete repository audit.
2. Reproduce and fix verified defects.
3. Resolve the reported MUI provider deprecation.
4. Resolve the Council constitution 404 handling problem.
5. Investigate the browser performance warning.
6. Revalidate previous backend security, runtime, API, and database findings.
7. Produce a complete dashboard layout overhaul plan.
8. Produce a detailed remediation report and verification evidence.

**Dashboard visual implementation is not authorized yet.**

First inspect the current dashboard, create the redesign plan, and stop dashboard implementation until the Founder approves that plan.

---

# 1. REQUIRED WORKFLOW

Use a controlled workflow:

`Inspect → Reproduce → Diagnose → Plan → Approve scope → Fix → Test → Regression test → Verify → Report`

Never skip a stage.

Do not mark an issue fixed merely because TypeScript compiles or the application builds.

A task is complete only when its expected behavior has been verified.

## 1.1 Use subagents

Use subagents for parallel read-only investigation.

Assign these responsibilities:

| Subagent | Responsibility |
|---|---|
| Backend Security | Authentication, authorization, private memory, deliverable access |
| Runtime Engineering | Runtime lifecycle, sessions, leases, execution permits, concurrency |
| Database Engineering | Schema authority, migrations, backup and integrity tests |
| API Contract Engineering | Backend/frontend endpoints, response types, request validation |
| Dashboard UX Designer | Inspect existing dashboard and prepare the redesign proposal |
| Frontend Architecture | MUI 9, theme architecture, Atomic Design, application shell |
| QA Engineering | Regression tests, integration tests, browser verification, accessibility |

### Subagent restrictions

- Initial investigations must be read-only.
- Each subagent must return exact file paths, relevant code locations, evidence, and recommendations.
- Subagents must not independently edit shared files.
- No two agents may edit the same file concurrently.
- The coordinator owns integration and final verification.
- Do not accept recommendations without checking the actual implementation.
- If a subagent cannot verify something, classify it as unverified.

Use the dashboard UX Designer for the dashboard-specific design work. Invoke the installed `$ui-ux-designer` skill if available. Use its dashboard/SaaS, redesign, layout hierarchy, component design, and accessibility guidance. Do not install another design framework or dependency.

---

# 2. BASELINE AUDIT — READ ONLY

Before editing source code, inspect the complete repository structure and all relevant implementation paths.

Read:

- `README.md`
- `DESIGN.md`
- `STACK.md`, if present
- `CONVENTIONS.md`, if present
- `PROJECT.md`, if present
- Existing architecture and security documentation
- Migration manifest and numbered migrations
- Current implementation reports
- Previous remediation reports
- Root and frontend package scripts
- TypeScript configurations
- Test configurations
- Git status and recent history

Inspect backend, frontend, scripts, migrations, tests, documentation, and configuration.

Do not assume previous audit findings still apply. Revalidate every finding against the current HEAD.

## 2.1 Create an audit inventory

Create:

`docs/reports/REPOSITORY_REMEDIATION_AUDIT.md`

For every finding include:

- Finding ID
- Priority: P0, P1, P2, or P3
- Exact file and relevant code location
- Observed behavior
- Expected behavior
- Reproduction steps
- Root cause
- Affected dependencies
- Whether the issue is confirmed, suspected, or unverified
- Proposed fix
- Regression tests required
- Risk of changing the implementation
- Whether the code should remain untouched

Do not report a suspected issue as confirmed.

## 2.2 Establish a baseline

Run the existing verification commands without modifying code.

Record:

- Backend test results
- Frontend test results
- TypeScript results
- Frontend production build
- Lint and formatting results
- Existing failing tests
- Existing skipped tests
- Existing warnings
- Browser console errors, if the application can be run safely

The previously reported baseline was 776 passing tests and one migration test failure. Verify the current result instead of assuming it.

The known failure is:

`tests/integration/phase10_batch1_migration_backup.test.ts:265`

Do not delete, skip, weaken, or rewrite this test merely to obtain a green test count.

Determine whether its historical schema fixture is invalid or whether the migration path has a real defect. Document the exact reason.

---

# 3. REPORTED CONSOLE DEFECTS

These issues must receive dedicated remediation tasks.

## C1 — MUI deprecated provider

File:

`frontend/src/shared/theme/use-theme-store.tsx`

Current reported warning:

`Experimental_CssVarsProvider has been ported into ThemeProvider.`

Required work:

1. Inspect the installed MUI 9 version and its supported CSS theme-variable API.
2. Inspect the existing light and dark themes.
3. Inspect the current `createDesignSystemTheme()` implementation.
4. Identify which theme implementation is actually used by the application.
5. Determine whether CSS variables are required by existing components.
6. Replace the deprecated provider with the supported MUI 9 `ThemeProvider` architecture.
7. Preserve theme switching and persistence.
8. Preserve the existing palette, typography, spacing, radius, and visual appearance.
9. Avoid creating a second theme state system.
10. Remove the deprecated provider import and usage.

Do not blindly replace the import without verifying that CSS-variable behavior remains correct.

**Acceptance criteria:**
- No `Experimental_CssVarsProvider` remains in active application code.
- Light mode works.
- Dark mode works.
- Theme preference persists after reload.
- Existing components render correctly.
- Frontend build succeeds.
- Theme tests pass.
- No palette or typography regression.

## C2 — Council constitution HTTP 404

Files:

- `frontend/src/features/council/pages/CouncilPage.tsx`
- `src/api/routes/council.routes.ts`
- `src/council/divisions.ts`

The endpoint is:

`GET /api/council/constitution`

The backend query looks for a constitution with `status = 'active'`.

Investigate the actual cause of the 404.

Check:

- Whether the route is registered.
- Whether the Vite proxy reaches the correct backend.
- Whether the active constitution exists.
- Whether the database contains a constitution with another status.
- Whether the query and schema agree.
- Whether local configuration points to the intended database.

Use read-only database inspection.

**Never create, seed, or modify constitution records automatically.**

### Frontend resilience

The Council page currently loads several resources together. A missing constitution must not prevent the other Council data from appearing.

Refactor only the necessary loading behavior.

Required behavior:

- Seats load independently.
- Personas load independently.
- Runtime assignments load independently.
- Approvals load independently.
- Constitution loads independently.
- A missing constitution displays a clear empty state.
- Other successful sections remain visible.
- A failed section has its own retry action.
- No fake constitution content or success state.

Add tests for:
1. Active constitution exists.
2. Constitution is absent.
3. Constitution request fails.
4. Other Council resources still render when constitution fails.

## C3 — Browser performance warning

Reported:

`[Violation] 'message' handler took 336ms`

Do not guess which component causes this.

Required:

1. Run the application in a safe development environment.
2. Use browser Performance profiling if available.
3. Identify the expensive message handler.
4. Trace the handler to its actual source.
5. Use React Profiler to inspect excessive renders where relevant.
6. Check expensive computations, event listeners, repeated state updates, and unnecessary subscriptions.
7. Fix only the measured bottleneck.
8. Reprofile and compare results.

If the warning cannot be reproduced, document that. Do not introduce speculative memoization throughout the application.

---

# 4. REVALIDATE BACKEND SECURITY AND RUNTIME FINDINGS

The previous audit identified the following risks. Verify each against the current source before changing anything.

## B1 — Runtime session stability

Inspect:

- `src/api/middleware/authentication.ts`
- `src/auth/runtime-credentials.ts`
- `src/runtime/lifecycle.ts`
- `src/runtime/runtime-types.ts`
- `src/infrastructure/database/database.ts`
- `src/server.ts`

Verify:

- Runtime identity comes from valid runtime credentials.
- Claude and Hermes remain distinct runtime identities.
- A runtime keeps a stable session across ordinary MCP requests.
- Repeated authenticated requests do not create replacement sessions.
- Execution history is not deleted during ordinary reconnection.
- Concurrent requests do not replace one another's session.
- Only one runtime can be active.
- Runtime switching does not erase shared memory or organizational identities.

Do not redesign the runtime architecture unless the current implementation requires it.

## B2 — Execution permits and fencing

Inspect:

`src/runtime/runtime-execution-guard.ts`

Verify:

- Execution permits remain valid during legitimate long-running operations.
- Execution permits have their own renewal lifecycle.
- Runtime heartbeat renewal is not incorrectly treated as execution permit renewal.
- A stale runtime cannot perform protected side effects.
- Runtime switching cannot allow an old execution to continue making unauthorized changes.
- Generation/session ownership is checked at the actual protected side-effect boundary.

Add genuine concurrency tests, not sequential tests with concurrency-related names.

## B3 — Runtime lifecycle authorization

Inspect:

`src/api/routes/runtime.routes.ts`

Verify that:

- Connect, disconnect, switch, heartbeat, and recovery operations have appropriate authorization.
- Runtime/session identifiers are bound to the authenticated principal.
- Missing session IDs cannot bypass ownership checks.
- A runtime cannot operate on another runtime's session.
- Founder control-plane authority remains distinct from runtime identity.

Do not weaken authentication to make local development easier.

## B4 — Private memory authorization

Inspect:

`src/api/routes/memory.routes.ts`

Verify authorization on:

- Memory detail
- Memory list
- Memory versions
- Memory links
- Memory history
- Any other memory retrieval path

A caller who knows a private memory ID must not be able to retrieve it without authorization.

Test actual unauthorized retrieval attempts.

## B5 — Deliverable history authorization

Inspect:

`src/api/routes/deliverables.routes.ts`

Remove hardcoded Founder identity construction only if it is still present.

Pass the authenticated requester context through the service layer and enforce resource authorization.

Do not grant additional permissions.

## B6 — Runtime credential status

Inspect:

`src/auth/runtime-credentials.ts`

Verify that only active, valid, non-revoked credentials are accepted.

Test:

- Active credentials
- Revoked credentials
- Expired credentials
- Credentials with expired timestamps
- Malformed credentials
- Invalid signatures or tokens

## B7 — MCP preflight

Inspect the `/mcp` OPTIONS route and global CORS configuration.

Verify that browser preflight is handled correctly before runtime authentication, while actual MCP requests remain authenticated.

## B8 — Shared memory

Preserve the architecture:

- Council Bridge owns persistent shared memory.
- Claude and Hermes use the same Bridge database.
- Runtime-specific sessions must not create isolated canonical memory stores.
- Private memory remains protected by its own authorization rules.

Verify both directions:

1. Claude writes shared memory → switch to Hermes → Hermes reads it.
2. Hermes writes shared memory → switch to Claude → Claude reads it.

Do not create duplicate memory databases.

## B9 — Database and migration authority

Inspect:

- `src/database.ts`
- `src/infrastructure/database/database.ts`
- `src/migration-runner/`
- `migrations/`
- Database initialization and startup code
- Migration tests

Verify whether inline schema initialization and numbered migrations still act as competing schema authorities.

Check the historical migration chain and the reported Phase 4 schema fixture failure.

Do not:
- Change production data.
- Apply migrations to the production database.
- Rewrite historical migrations.
- Modify migration checksums.
- Drop indexes or tables to bypass failures.

If a schema correction is required, propose a forward-only migration and test it against isolated databases.

---

# 5. FRONTEND API CONTRACT AUDIT

Inspect every frontend API call and its matching backend route.

Do not limit this to the Dashboard.

Create a contract matrix:

| Feature | Frontend request | Backend route | Request schema | Response schema | Status |
|---|---|---|---|---|---|

Include:

- Dashboard
- Activity
- Chat
- Council
- Meetings
- Memory
- Organization
- Tasks
- Executions
- Deliverables
- Approvals
- Profile
- Settings
- Runtime control

Verify:

- HTTP methods
- URL paths
- Query parameters
- Request payloads
- Response wrappers
- Nullability
- Error responses
- Authentication requirements
- Resource permissions

Use shared TypeScript contracts where appropriate.

Do not change a working API contract merely to make frontend code look more consistent.

If a mismatch is confirmed, update the backend/frontend together and add an integration test.

Do not convert failed API requests into successful empty arrays without showing the error state.

---

# 6. DASHBOARD LAYOUT OVERHAUL — DESIGN AND PLAN ONLY

**This section is mandatory. Do not implement the visual redesign yet.**

The dashboard is the main command center of Council Bridge. It should provide an accurate operational overview, not merely a collection of cards.

Before designing anything, inspect the actual dashboard in the browser if a safe development environment is available.

Use existing data only. Do not seed or mutate the database to create a better-looking screenshot.

If browser inspection is unavailable, perform a source-level review and clearly state that visual inspection was not performed.

## 6.1 Inspect the existing dashboard

Read:

- `frontend/src/features/dashboard/pages/DashboardPage.tsx`
- `frontend/src/app/layouts/Layout.tsx`
- `frontend/src/app/App.tsx`
- `frontend/src/shared/theme/`
- `frontend/src/shared/ui/`
- `frontend/src/shared/api/`
- `frontend/src/shared/types/`
- `DESIGN.md`

Inspect all dashboard interactions, including:

- KPI cards
- Refresh behavior
- Recent Activity
- Quick Actions
- Create Division dialog
- Invite Staff dialog
- Create Task dialog
- Loading states
- Error states
- Empty states
- Navigation
- Responsive behavior

Record which interactions are functional and which are only visual.

Do not remove or rewrite existing actions during the planning stage.

## 6.2 Dashboard design objective

Design a professional operational command center for a Founder overseeing an AI-powered organization.

The dashboard should answer these questions quickly:

1. What is happening across the organization?
2. What needs my attention?
3. Which approvals or executions are waiting?
4. What has recently changed?
5. What can I do immediately?

Avoid decorative analytics, redundant cards, unnecessary charts, and generic AI-generated SaaS layouts.

Every dashboard section must have a clear operational purpose.

## 6.3 Proposed information architecture

Evaluate this initial structure. Improve it where the existing product data or user workflow supports a better arrangement.

### A. Dashboard header

- Page title: Organization Dashboard.
- Short operational summary.
- Last updated timestamp.
- Refresh action.
- Primary action, if appropriate.

Keep the header compact and consistent with the rest of the application.

### B. Organization overview

Use the existing verified metrics:

- Active Divisions
- Staff Agents
- Pending Approvals
- Execution Requests

Each metric must:
- Have a precise definition.
- Use a verified backend data source.
- Show a loading state.
- Show an error state.
- Show a meaningful empty/zero state.
- Navigate to the relevant feature when clicked.

Do not invent new metrics.

If task completion, runtime health, or other metrics are desired, first verify that reliable backend data exists. Mark unavailable metrics as future enhancements.

### C. Attention and work queue

Evaluate a section dedicated to pending operational work.

Potential content:

- Pending approvals
- Execution requests awaiting action
- Other genuinely actionable items supported by existing APIs

Each row should show:
- Item title
- Type
- Current status
- Relevant owner or assignee, when available
- Timestamp, when available
- A clear action or destination

Do not invent a queue by combining incompatible or incomplete data.

### D. Recent activity

Create a compact, readable activity timeline.

Evaluate:
- Activity type
- Event title
- Timestamp
- Relevant entity
- Navigation destination

Use semantic status labels and consistent icon treatment.

Do not show misleading timestamps or broken navigation links.

### E. Quick Actions

Evaluate a clear and restrained action area.

Existing actions to preserve:

- Create Division
- Invite Staff
- Review Approvals
- New Task

Keep existing handlers and API behavior intact.

Only propose additional actions when their backend workflows are confirmed to exist.

### F. Organization snapshot

Evaluate whether a small organization summary is useful.

Potential content:
- Division count
- Staff count
- Division status
- Organizational activity

Use only reliable data and avoid duplicating the KPI row.

If this section adds no useful information, omit it.

## 6.4 Layout proposal

Use the existing 12-column desktop grid and 8-point spacing system.

Prepare concrete wireframes for:

### Desktop: 1440px

Consider:
- A clear page header.
- Four balanced overview metrics.
- A primary operational attention area.
- A recent activity area.
- A compact quick-action area.
- Consistent content alignment and max width.

### Laptop: 1024px

Ensure:
- No horizontal overflow.
- The content hierarchy remains intact.
- Cards and columns reflow without becoming cramped.
- Navigation and page content have sufficient space.

### Tablet: 768px

Ensure:
- Appropriate two-column or single-column arrangements.
- Readable data rows.
- Accessible action controls.
- No clipped content.

### Mobile: 375px and 320px

Ensure:
- Single-column content.
- Compact but readable metrics.
- No horizontal scrolling.
- Actions remain discoverable.
- Important pending work appears before secondary information.
- Dialogs and forms remain usable.

Do not solve mobile layout by simply shrinking desktop elements.

## 6.5 Design principles

Preserve the existing `DESIGN.md` identity.

- MUI 9 remains the component framework.
- Inter remains the typography.
- Governance Blue remains the primary accent.
- Organization Purple remains the secondary accent.
- Existing light and dark palette values remain unchanged.
- Existing 8px spacing rhythm remains.
- Existing border-radius language remains.
- Content max width remains 1200px unless a documented, compelling reason is approved.
- Keep information density purposeful.
- Avoid heavy shadows, excessive gradients, oversized decorative icons, and generic AI-dashboard patterns.
- Status must use text as well as color.
- Use semantic MUI components.

Do not introduce Tailwind, shadcn, a second component framework, or a replacement design system.

## 6.6 Atomic Design usage

Use Atomic Design pragmatically.

- Atoms: MUI primitives and truly reusable small controls.
- Molecules: metric content, status labels, activity rows, filter controls.
- Organisms: KPI group, attention queue, activity panel, quick-action panel.
- Templates: consistent page structure and responsive content grid.
- Pages: feature-specific composition and data orchestration.

Rules:

1. Do not wrap every MUI component in a custom component.
2. Extract components when repetition or complexity justifies it.
3. Keep dashboard-specific components in the dashboard feature.
4. Put genuinely shared components in `shared/ui`.
5. Promote a feature component to shared only when multiple real consumers exist.
6. Do not use the current `DataTable` until its sorting, pagination, stable keys, and accessibility behavior are verified.
7. Do not refactor working feature pages merely to make the folder structure appear more atomic.

## 6.7 Dashboard plan deliverable

Create:

`docs/reports/DASHBOARD_LAYOUT_OVERHAUL_PLAN.md`

The document must include:

1. Current dashboard audit.
2. Existing functional behavior that must be preserved.
3. UX problems and supporting evidence.
4. Dashboard goals and primary user questions.
5. Proposed information architecture.
6. Desktop wireframe.
7. Laptop wireframe.
8. Tablet wireframe.
9. Mobile wireframe.
10. Component inventory.
11. Proposed Atomic Design mapping.
12. API/data-source mapping for every proposed section.
13. Loading, error, empty, and success states.
14. Interaction specifications.
15. Accessibility requirements.
16. Responsive behavior.
17. Exact proposed file changes.
18. Components/files that must remain untouched.
19. Implementation sequence.
20. Regression and acceptance tests.
21. Risks, dependencies, and unresolved questions.

Include text wireframes or Mermaid diagrams where useful.

For every proposed component, specify:
- Purpose
- Data source
- Props
- User interactions
- Loading/error/empty states
- Responsive behavior
- Accessibility behavior

The plan must be detailed enough that another developer can implement it without inventing missing requirements.

**Do not implement this dashboard plan until the Founder approves it.**

---

# 7. DESIGN SYSTEM AND APPLICATION SHELL REVIEW

Inspect the existing Atomic Design foundation and current application shell.

Relevant files include:

- `frontend/src/shared/ui/tokens/`
- `frontend/src/shared/ui/primitives/`
- `frontend/src/shared/ui/molecules/`
- `frontend/src/shared/ui/organisms/`
- `frontend/src/shared/ui/templates/`
- `frontend/src/app/layouts/Layout.tsx`
- `frontend/src/shared/theme/`

Determine:

- Which components are actually used.
- Which components are duplicated.
- Which components are incomplete.
- Which components are safe to reuse.
- Which components are feature-specific.
- Whether the design-system theme factory is integrated.
- Whether the existing theme implementation can be consolidated safely.

Produce a component adoption map.

Do not migrate all pages to Atomic Design in one pass.

The application shell redesign should be included in the dashboard plan only where it affects dashboard usability. Do not implement a global navigation redesign as an unapproved side effect.

Preserve existing routes, authentication behavior, user menu, logout, and theme switching.

---

# 8. IMPLEMENTATION RULES FOR VERIFIED BUGS

After the read-only audit and task plan are complete, proceed only with narrowly scoped, verified fixes covered by this prompt.

For each defect:

1. Reproduce it.
2. Identify the root cause.
3. Identify the smallest safe change.
4. Write or update a regression test.
5. Implement the fix.
6. Run the targeted test.
7. Run relevant regression tests.
8. Run TypeScript and build checks.
9. Inspect the diff.
10. Document the result.

If a fix requires a broad architectural change, migration, or data modification, stop and document the required approval.

Do not combine unrelated fixes into one large refactor.

Do not change the dashboard layout implementation while the dashboard plan is awaiting approval.

---

# 9. TESTING AND QUALITY GATES

Run the relevant tests after each task, then the complete available verification suite.

### Backend
- Unit tests
- Integration tests
- Authentication tests
- Authorization tests
- Runtime lifecycle tests
- Runtime concurrency tests
- MCP HTTP integration tests
- Memory authorization tests
- Migration tests
- Database integrity tests

### Frontend
- TypeScript
- Production build
- Lint
- Formatting
- Component tests
- Page tests
- API contract tests
- Browser E2E

### Browser verification

Check at:

- 320px
- 375px
- 768px
- 1024px
- 1440px

Verify:
- No horizontal overflow.
- No broken navigation.
- No uncaught runtime errors.
- No deprecated MUI provider warning.
- No Council page-wide failure when constitution is missing.
- Light/dark theme behavior.
- Keyboard navigation.
- Visible focus.
- Screen-reader labels.
- WCAG 2.2 AA requirements.

Do not claim a browser check passed unless it was actually run.

Do not hide failing or skipped tests.

Keep the known migration failure visible until its root cause is resolved or its precise deferral is documented.

---

# 10. TASK TRACKING AND /LOOP

Create:

`docs/reports/REPOSITORY_REMEDIATION_EXECUTION_PLAN.md`

Track each task with:

- ID
- Priority
- Description
- Assigned agent
- File ownership
- Dependencies
- Status: Pending / In Progress / Blocked / Verified
- Test evidence
- Remaining work

Use dependency ordering. Do not dispatch tasks before their prerequisites are complete.

Use this `/loop` instruction:

`/loop 5m Review docs/reports/REPOSITORY_REMEDIATION_EXECUTION_PLAN.md. Identify pending, blocked, or incomplete authorized remediation tasks. Check subagent reports and verification evidence. Dispatch or continue the next dependency-ready task. Inspect git status before every write. Never overwrite user changes, never duplicate completed work, never edit dashboard layout while its plan awaits Founder approval, and never mark a task complete without test evidence. Continue until all authorized remediation tasks are verified or explicitly blocked. Stop when the dashboard plan is ready for Founder review.`

The loop must not:
- Repeatedly rerun completed work.
- Start unapproved dashboard implementation.
- Start M4.
- Perform production database operations.
- Commit or push changes.

---

# 11. FINAL REPORT

Create:

`docs/reports/REPOSITORY_REMEDIATION_FINAL_REPORT.md`

Include:

1. Baseline commit and final local HEAD.
2. Repository audit summary.
3. Confirmed defects.
4. Suspected/unverified findings.
5. Fixes implemented.
6. Files changed and reasons.
7. Files deliberately left untouched.
8. Tests executed and exact results.
9. Previously failing tests and their disposition.
10. TypeScript and build results.
11. Browser verification.
12. Security and authorization results.
13. Database/migration findings.
14. Dashboard plan location.
15. Dashboard implementation items awaiting Founder approval.
16. Remaining risks and blockers.
17. Final `git diff --stat` and `git status --short`.

Create an accurate file-change manifest.

Do not rewrite historical reports. If a historical report is inaccurate, mark it as superseded through a new report or a clearly dated addendum. Do not silently replace historical records.

---

# 12. DEFINITION OF DONE

The authorized remediation work is complete only when:

- [ ] Repository baseline and user changes are preserved.
- [ ] Full audit inventory is documented.
- [ ] Every confirmed defect has a verified disposition.
- [ ] MUI deprecated provider is removed safely.
- [ ] Council constitution absence no longer breaks the entire Council page.
- [ ] Browser performance warning is profiled or explicitly documented as unreproduced.
- [ ] Backend security findings are revalidated.
- [ ] Confirmed critical authorization defects are fixed and tested.
- [ ] Runtime session and execution behavior is verified.
- [ ] API contracts are reconciled where actual mismatches exist.
- [ ] Existing working features remain functional.
- [ ] Frontend TypeScript and production build pass.
- [ ] Relevant backend and frontend tests pass.
- [ ] Known migration test failure is accurately documented.
- [ ] Dashboard layout overhaul plan is complete.
- [ ] Final report and change manifest are complete.
- [ ] No production database changes were made.
- [ ] No commits or pushes were made.

## Final instruction

Do not optimize for the number of files changed.

Optimize for correctness, stability, security, and preservation of working functionality.

Fix proven problems. Leave working code alone.

Prepare a dashboard redesign plan based on the actual application, its available data, and the existing Governance Ledger design system.

**Stop after delivering the remediation results and dashboard plan. Wait for the Founder's approval before implementing the dashboard overhaul.**