COUNCIL BRIDGE — COMPLETE BACKEND REMEDIATION & FRONTEND OVERHAUL

Repository: snowep/council-bridge
Working directory: C:\Projects\council-bridge
Branch: refactor/repository-structure
Starting commit: 1604e631f69686aeb0251b93ca6efaad624dec10

1. Mission

Execute the complete repository remediation and frontend overhaul based on the source audit of the starting commit.

This is an implementation task, not another planning-only exercise.

You must:

Fix the identified backend security, runtime, database, and API problems.

Reconcile frontend/backend contracts.

Redesign the complete frontend layout.

Introduce a pragmatic Atomic Design architecture across the frontend.

Keep React, TypeScript, and MUI v9.

Preserve existing product functionality and user data.

Test and verify every implementation.

Produce accurate reports and evidence.

Do not stop after auditing, writing recommendations, creating a roadmap, or completing the design system. Implement the approved work.

2. Mandatory instructions

Read the complete repository before changing files.

Read DESIGN.md, README.md, project conventions, migration history, and relevant reports.

Use the installed Redesign workflow: redesign-existing-projects.

Use the installed DesignSystem workflow: Impeccable document.

Use Taste and frontend engineering as supporting workflows, not replacements for the existing MUI stack.

Preserve MUI v9. Do not introduce Tailwind, shadcn, another component framework, or unnecessary dependencies.

Preserve existing user modifications. Inspect git status before work and record every pre-existing modification.

Never reset, stash, overwrite, or discard user changes.

Never commit, push, merge, deploy, or rewrite Git history.

Never modify the production database or run production migrations.

Do not weaken authentication, authorization, runtime isolation, or security checks to make tests pass.

Do not delete historical execution records, messages, memories, deliverables, or identities as a shortcut.

Do not fabricate test results or mark incomplete tasks as complete.

Do not skip difficult findings. If a task is blocked, document the exact blocker and continue with independent tasks.

Do not start unrelated roadmap work or M4 implementation.

The starting commit is an audit reference, not permission to discard subsequent local changes.

3. Execution workflow

Step 1 — Establish the execution board

Create:

docs/reports/REPOSITORY_OVERHAUL_EXECUTION_PLAN.md

Include:

Every finding from the source audit.

Unique task ID.

Priority: P0, P1, P2.

Affected files.

Dependencies.

Assigned subagent.

Acceptance criteria.

Verification commands.

Status: pending, in progress, blocked, verified.

Do not omit findings because they are inconvenient or require architectural changes.

Create a dependency graph and execute tasks in the correct order.

Step 2 — Use subagents

Use Claude Code subagents for parallel investigation and bounded implementation.

Assign these responsibilities:

Subagent

Responsibility

Backend Security

Authentication, principal separation, authorization, protected resources

Runtime Engineering

Session lifecycle, execution permits, heartbeat, fencing, concurrency

Database Engineering

Schema authority, migration reconciliation, data integrity

API Contract Engineering

Backend routes, request/response schemas, frontend contract compatibility

Frontend Architecture

MUI design system, Atomic Design, application shell, reusable components

Frontend Feature Engineering

Feature-page implementation and workflow preservation

QA Engineering

Unit, integration, E2E, accessibility, responsive, regression verification

Rules:

Start with parallel read-only investigations.

Have each subagent report exact files, findings, dependencies, and proposed changes.

The coordinator reviews and reconciles their findings before implementation.

Delegate implementation only when file ownership and dependencies are clear.

Do not allow two agents to edit the same files simultaneously.

The coordinator owns integration, conflict resolution, final verification, and acceptance.

Subagents must return actual implementation and test evidence, not just recommendations.

Use the Task tool to create and track these assignments.

Step 3 — Use /loop for execution supervision

Start a Claude Code loop:

/loop 5m Review REPOSITORY_OVERHAUL_EXECUTION_PLAN.md. Identify pending, blocked, or incomplete tasks. Dispatch or continue the next dependency-ready task. Check whether assigned subagents have returned implementation and verification evidence. Update task status only when evidence exists. Never duplicate completed work, never overwrite user changes, and never stop while authorized tasks remain incomplete. Stop the loop only when all tasks are verified or explicitly documented as blocked.

The loop is a supervisor, not a substitute for implementation. Continue executing tasks between loop checks. Do not wait passively for the next interval.

4. Backend remediation

Complete every item below.

B1 — Runtime authentication and identity

Files include:

src/api/middleware/authentication.ts

src/auth/runtime-credentials.ts

src/auth/index.ts

src/auth/session.ts

src/council/operations.ts

src/mcp/tools.ts

Requirements:

Accept only active, valid, non-revoked runtime credentials.

Reject expired, revoked, malformed, and invalid credentials.

Never fall back from invalid MCP credentials to Founder authentication.

Keep Founder, runtime, organizational agent, and runtime session as separate identities.

Runtime identity must come from verified credentials, never request bodies or spoofable headers.

Bind acting organizational agents to authenticated runtimes using verified assignments and permissions.

Never allow arbitrary agent_id values to elevate permissions.

Preserve Founder control-plane authorization separately from MCP runtime authentication.

B2 — Runtime lifecycle and execution safety

Files include:

src/runtime/lifecycle.ts

src/runtime/runtime-execution-guard.ts

src/runtime/runtime-ownership.middleware.ts

src/runtime/runtime-types.ts

src/server.ts

src/api/routes/runtime.routes.ts

Requirements:

Maintain a stable runtime session across MCP HTTP requests.

Do not create a new session for every request.

Enforce one active runtime server-side.

Require explicit Founder authorization for runtime control operations.

Bind lifecycle operations to the authenticated session.

Do not allow omitted session IDs to bypass ownership checks.

Separate runtime lease renewal from execution permit renewal.

Renew execution permits while operations are running.

Enforce generation fencing at protected side-effect boundaries.

Make switching safe when an operation is already executing.

Implement race-safe stale-session recovery.

Implement an explicit, authenticated idle liveness or reconnect policy.

Ensure MCP request cleanup releases timers and execution resources.

Never delete execution history to replace runtime sessions.

Test both switching directions:

Hermes → Claude.

Claude → Hermes.

Verify that disconnected runtimes cannot execute tools.

B3 — Memory and resource authorization

Files include:

src/api/routes/memory.routes.ts

src/api/routes/deliverables.routes.ts

src/api/routes/tasks.routes.ts

src/council/memory.ts

Relevant service and permission modules.

Requirements:

Enforce ownership and category authorization on memory detail operations.

Apply resource-level authorization to tasks, deliverables, versions, history, messages, and executions.

Remove hardcoded Founder contexts from requester-dependent operations.

Use the authenticated caller context.

Add authorized MCP memory read/write capabilities.

Keep shared memory Bridge-owned and stored in the existing shared database.

Verify Claude-written shared memory can be read by Hermes and vice versa.

Prove private-memory isolation using genuinely private memory records.

Do not create separate runtime memory databases.

B4 — Database and migration integrity

Files include:

src/infrastructure/database/database.ts

src/database.ts

src/migration-runner/

migrations/

Requirements:

Establish one authoritative schema/migration process.

Resolve inline schema initialization versus numbered migration drift.

Reconcile runtime_sessions, runtime_control, and execution_records.

Preserve historical sessions and execution records.

Correct foreign-key relationships and generation handling.

Correct migration CLI database-path configuration.

Preserve existing migration files and checksums.

Create forward migrations only.

Test fresh database creation.

Test upgrades from representative legacy schemas.

Verify all records survive migrations.

Verify foreign-key integrity and SQLite integrity.

Test rollback behavior using isolated test databases.

Never run migrations against the production database.

B5 — Production MCP integration

Do not duplicate production middleware composition inside tests.

Create a testable production application/route factory or shared production route registration.

Test the actual /mcp endpoint:

MCP initialization.

tools/list.

Actual registered tool execution.

Invalid runtime credential rejection.

Runtime ownership rejection.

Runtime switching.

Concurrent requests from different runtimes.

Session stability across multiple HTTP requests.

Execution-permit renewal.

Shared memory across runtime switching.

Tool authorization against organizational agent identity.

Assert JSON-RPC results, not merely HTTP 200.

B6 — CORS and HTTP behavior

Handle OPTIONS /mcp preflight without runtime authentication.

Authenticate actual MCP requests.

Preserve explicit CORS origin policy.

Test preflight and authenticated requests separately.

5. API contract reconciliation

Inspect every backend route and every frontend API consumer.

Create a single typed API contract layer.

Fix all known mismatches, including:

Council seats: { seats }.

Constitution: { data }.

Deliverables: { deliverables }.

Execution list: { executions }.

Autonomy levels: { autonomyLevels }.

Execution detail: { execution }.

Execution history: { history }.

Tasks: { tasks }.

Quality thresholds: { thresholds }.

Reviewer seats: { seats }.

Execution creation: use the actual supported backend endpoint.

Founder lookup: implement the required endpoint or remove the unsupported consumer.

Also:

Reconcile memory categories and owner types.

Implement Activity filters and authoritative pagination/counts.

Return all 11 Council seats, including vacancies.

Correct Meetings and Council tabs that currently have no real backend workflow.

Ensure API errors are visible and not silently converted into empty arrays.

Ensure frontend types match actual backend schemas.

Add contract tests for every affected route.

6. Frontend redesign and Atomic Design

Design direction

Read DESIGN.md first.

Use the existing Governance Ledger direction as the baseline:

Institutional, clear, information-dense interface.

Existing approved palette and semantic colors.

Existing typography direction unless a documented inconsistency is found.

Consistent spacing and hierarchy.

Functional light and dark themes.

The user authorizes a layout overhaul. Do not interpret this as permission to replace the entire brand identity or randomly change approved colors.

Keep MUI v9 and improve how it is structured and used.

F1 — Establish the design system

Create or refactor:

frontend/src/shared/theme/

Include:

Semantic color tokens.

Typography scale.

Spacing scale.

Radius scale.

Elevation scale.

Breakpoints.

Z-index scale.

Light and dark theme definitions.

MUI component overrides.

Theme documentation.

Use semantic tokens, not arbitrary hardcoded colors.

Fix existing theme inconsistencies, including fixed-color overrides that break dark mode.

Use one supported MUI 9 theming architecture. Remove obsolete or experimental theme patterns only after confirming the replacement works.

F2 — Implement pragmatic Atomic Design

Use this hierarchy:

shared/
  theme/
    tokens/
    create-theme.ts
    component-overrides.ts

  ui/
    primitives/
    molecules/
    organisms/
    templates/

  api/
    client/
    contracts/

  hooks/
  utils/
  types/

features/
  dashboard/
  council/
  organization/
  meetings/
  tasks/
  executions/
  deliverables/
  approvals/
  chat/
  memory/
  activity/
  profile/
  settings/

Rules:

MUI components are the primitive foundation.

Do not create pointless wrappers around every MUI component.

Extract repeated patterns into molecules and organisms.

Extract a component when it has a clear reusable purpose and appears in at least three places.

Keep feature-specific components inside their feature.

Keep business logic out of presentation components.

Use feature hooks/services for data fetching and mutations.

Use shared templates for repeated page structures.

Keep components focused and maintainable.

Avoid giant page files and components exceeding approximately 200 lines unless there is a documented reason.

Build reusable patterns for:

PageHeader.

PageContainer.

SearchField.

FilterBar.

StatusIndicator.

LoadingState.

EmptyState.

ErrorState.

PermissionDeniedState.

ConfirmAction.

DataTable.

DetailPanel.

FormSection.

ActivityTimeline.

NotificationFeedback.

F3 — Rebuild the application shell

Redesign:

Sidebar navigation.

Navigation grouping.

Global header.

Runtime status/control area.

User menu.

Theme controls.

Responsive navigation.

Main content container.

Page-header conventions.

Group navigation into:

Workspace

Dashboard

Activity

Chat

Governance

Council

Meetings

Memory

Operations

Organization

Tasks

Executions

Deliverables

Approvals

System

Profile

Settings

Use MUI Drawer variants appropriately for desktop and mobile.

Use a maximum content width consistent with DESIGN.md.

Integrate RuntimeControl properly through the authenticated API client. Do not leave it as an unused component.

F4 — Redesign every feature page

No page may be skipped.

Dashboard

Activity

Chat

Council

Meetings

Memory

Organization

Tasks

Executions

Deliverables

Approvals

Profile

Settings

Login

Not Found

For each page:

Audit existing functionality.

Fix API contracts.

Preserve working business workflows.

Improve information hierarchy.

Standardize page headers and content layout.

Implement loading, empty, error, success, and permission states.

Ensure all visible controls perform real actions.

Remove unsupported or decorative controls.

Use consistent MUI dialogs, drawers, snackbars, forms, tables, and filters.

Add responsive layouts.

Preserve accessible keyboard and screen-reader behavior.

Specific requirements:

Chat remains a dedicated conversation workspace.

Tasks, Executions, and Deliverables should use appropriate list/detail layouts.

Approvals must not use browser alert() or window.confirm().

Activity must use React Router navigation.

Council must display all 11 seats, including vacancies.

Meetings and Council tabs must correspond to working backend functionality.

Profile and Settings must accurately communicate which features are functional and which are unavailable.

Do not display fake statistics or fabricated organizational data.

7. Accessibility and responsive quality

Target WCAG 2.2 AA.

Verify:

Keyboard navigation.

Visible focus states.

Semantic headings.

Accessible form labels.

Screen-reader labels for icon buttons.

Dialog focus management.

Color contrast.

Non-color status indicators.

Reduced-motion behavior.

Touch target sizing.

200% zoom behavior.

Test at:

320px

375px

768px

1024px

1440px

Preserve the approved design tokens while resolving accessibility issues. Document any contrast exception that cannot be corrected without changing an approved visual decision.

8. Testing and CI

Create reliable verification scripts and GitHub Actions workflows.

Required checks:

Backend

Unit tests.

Integration tests.

Authentication tests.

Authorization tests.

Runtime concurrency tests.

MCP HTTP integration tests.

Memory isolation tests.

Migration tests.

Database integrity tests.

Frontend

TypeScript strict type checking.

ESLint.

Prettier.

Production build.

Component tests.

API contract tests.

E2E workflows.

Accessibility tests.

Responsive viewport tests.

End-to-end workflows

Verify actual user workflows:

Founder authentication.

Claude runtime authentication.

Hermes runtime authentication.

Runtime handoff in both directions.

Agent registration and identity.

Agent messaging and replies.

Council operations.

Division and staff management.

Task creation and delegation.

Execution lifecycle.

Deliverable creation and review.

Approval and rejection.

Shared memory read/write across runtimes.

Private-memory access denial.

Dashboard and navigation.

Settings and theme persistence.

Do not hide failures, silently skip tests, or downgrade assertions to make suites pass.

Report pre-existing failures separately from newly introduced failures.

9. Documentation and reports

Update active documentation to match verified implementation.

Create:

docs/reports/REPOSITORY_OVERHAUL_FINAL_REPORT.md

Include:

Starting commit and final working-tree state.

Every task ID and status.

Files created, modified, moved, or removed.

Backend findings and resolutions.

Frontend findings and resolutions.

Design-system architecture.

Atomic Design component inventory.

API contract changes.

Database and migration changes.

Security improvements.

Test commands and exact results.

E2E evidence.

Accessibility and responsive evidence.

Remaining limitations.

Explicitly blocked tasks and reasons.

Also update:

README.md

DESIGN.md

API documentation.

Migration documentation.

Relevant architecture documentation.

Relevant project skills and scripts.

Preserve historical reports. Mark superseded reports as historical rather than rewriting evidence from previous milestones.

Create a complete file-change manifest.

10. Execution and acceptance rules

Work in dependency order:

Repository baseline and execution board.

Backend security and runtime remediation.

Database and migration consistency.

Shared memory and organizational identity integration.

API contract reconciliation.

Design-system foundation.

Atomic Design component architecture.

Application shell redesign.

All feature-page redesigns.

Accessibility and responsive work.

Full regression and E2E verification.

Documentation and final audit.

After each task:

Inspect the relevant implementation.

Make the change.

Run targeted tests.

Fix failures.

Run regression tests.

Record actual evidence.

Mark the task verified only after it passes.

If a task fails:

Diagnose the actual failure.

Fix the underlying cause.

Re-run the affected test.

Re-run relevant regression tests.

Do not simply increase timeouts, skip assertions, or change expected results without justification.

If an architectural decision is necessary, inspect existing conventions and dependencies, choose the safest compatible solution, document it, and proceed. Ask the user only when an irreversible action or genuinely unavailable decision is required.

11. Definition of done

The task is complete only when:

Every P0 finding is fixed and verified.

Every P1 finding is fixed and verified.

P2 cleanup is completed where safe, with remaining items documented.

Runtime sessions remain stable across requests.

Execution permits remain valid throughout active operations.

Runtime handoff is safe in both directions.

Founder and runtime privileges remain separate.

Shared memory works across Claude and Hermes.

Private memory authorization is tested.

Database migrations are consistent and tested on isolated databases.

Backend and frontend API contracts agree.

All 15 frontend pages have been reviewed and addressed.

MUI v9 remains the component foundation.

Atomic Design architecture is implemented pragmatically.

All major page layouts have been redesigned.

Light and dark themes work.

Responsive tests pass at all required widths.

Accessibility checks pass or exceptions are explicitly documented.

TypeScript, lint, build, unit, integration, and E2E checks pass.

Documentation and reports reflect actual implementation.

No unrelated user changes were discarded.

No production database was modified.

No commit or push was performed.

Do not report completion while any required task remains pending, unverified, or silently skipped.

Begin by inspecting the actual working tree and establishing the execution board. Then execute the work until the definition of done is satisfied.