# COUNCIL BRIDGE — M2 + M3
## Core Communication, Workflow Completion & Dashboard/UI/UX Functional Integration

**Repository:** `snowep/council-bridge`  
**Branch:** `refactor/repository-structure`  
**Local path:** `C:\Projects\council-bridge`  
**MCP port:** `3334`

**Execution authorization:** Implement M2 and M3 together.  
**Scope:** Core communication, agent integration, task workflows, dashboard functionality, and UI/UX completion.

---

# 1. PRIMARY OBJECTIVE

Make Council Bridge function as a usable local single-user coordination system.

The Founder must be able to:

1. Communicate with agents through the Chat interface.
2. Receive and review agent responses.
3. Create and manage conversations.
4. Delegate work to divisions and staff.
5. Track execution and deliverables.
6. Review and approve deliverables.
7. Monitor actual system activity through the dashboard.
8. Access functional navigation and dashboard actions.
9. Use the application without encountering misleading, broken, or inert UI controls.

Preserve the existing architecture and visual direction.

Do not redesign the entire application unnecessarily.

Do not implement unrelated future features.

# 2. PRE-IMPLEMENTATION AUDIT

Before modifying code:

1. Inspect the latest branch and commit.
2. Inspect the complete current repository structure.
3. Read the relevant architecture, API, database, security, UI, and convention documentation.
4. Inspect the current implementation of Chat, messages, MCP tools, task delegation, execution, deliverables, dashboard, routing, layout, and theme.
5. Identify existing user changes and preserve them.
6. Verify the reported M1 changes without unnecessarily reimplementing completed work.
7. Identify existing tests and reusable implementations.

Create:

`docs/audits/release/M2_M3_BASELINE_REPORT.md`

Document:
- Current implementation status.
- Confirmed defects.
- Existing working functionality.
- Missing functionality.
- Relevant files.
- Dependencies.
- Implementation sequence.
- Risks.

Do not start by replacing existing implementations.

# 3. M2 — CORE COMMUNICATION & WORKFLOW COMPLETION

## 3.1 Chat API Contract

Inspect and reconcile the complete message contract between:

- Backend message model.
- REST API.
- MCP message tools.
- Frontend API types.
- Chat components.

Previously identified discrepancies include:

- Backend uses `id`, frontend expects `message_id`.
- Backend POST response returns `{ message }`, frontend expects a direct Message.

Establish one consistent contract.

Requirements:

- Use one canonical message identifier.
- Normalize API response structures.
- Validate request and response schemas.
- Preserve message sender and recipient identities.
- Preserve timestamps and delivery status.
- Handle validation and authorization errors consistently.
- Update frontend types to match the actual backend contract.

Add contract tests covering every affected endpoint.

## 3.2 Bidirectional Conversation History

Current inbox retrieval reportedly uses recipient-only filtering and excludes messages sent by the current user.

Fix conversation retrieval.

Requirements:

- Include incoming and outgoing messages.
- Group messages by conversation or participant pair using a consistent model.
- Preserve chronological ordering.
- Support pagination or incremental history retrieval.
- Do not arbitrarily truncate history to the latest 50 messages.
- Prevent duplicate messages during refresh.
- Persist messages correctly.
- Maintain sender and recipient attribution.
- Calculate unread state correctly.

Verify that the Founder can see both sides of a conversation after refreshing or reopening the application.

## 3.3 New Conversation and Agent Selection

Implement a functional way to initiate a conversation.

Requirements:

- Display available agents using existing identity records.
- Support selection of the intended recipient.
- Start a new conversation.
- Display existing conversations.
- Preserve existing conversation history.
- Prevent invalid recipients.
- Respect existing authorization boundaries.

Do not invent new agents or identities.

Use the established Council Bridge identity model.

## 3.4 Chat Refresh and Unread State

Fix conversation synchronization.

Requirements:

- Selected conversation refreshes reliably.
- Conversation list refreshes independently.
- Unread counts update correctly.
- New incoming messages appear without manually reloading the entire page.
- Message ordering remains consistent.
- Avoid duplicate polling loops.
- Clean up polling when components unmount.
- Handle network failures and recovery.
- Avoid unnecessary requests.

Use the existing architecture. Do not introduce WebSockets or another infrastructure dependency unless the current implementation demonstrably requires it.

## 3.5 Claude and Hermes Runtime Integration

Verify actual communication through the MCP bridge.

Required workflow:

`Founder UI → Backend → Message Storage → MCP → Agent Runtime → MCP → Backend → Message Storage → Founder UI`

Verify:

1. Founder sends a message.
2. Message is persisted.
3. Intended agent can retrieve it.
4. Agent receives the correct sender and conversation context.
5. Agent sends a response.
6. Response is persisted.
7. Founder sees the response in the correct conversation.
8. History remains available after refresh.

Test Claude and Hermes independently where their runtime environments are available.

IMPORTANT:

Do not claim real-time agent communication is operational merely because MCP tools exist.

If an external runtime is unavailable, document the exact missing integration and provide a reproducible verification procedure.

Do not simulate a successful runtime response and report it as real agent execution.

## 3.6 Task Delegation and Execution

Inspect the existing workflow:

Council → Divisions → Staff → Delegation → Execution → Deliverable → Approval

Verify every transition.

Requirements:

- Founder can initiate an authorized task.
- Task can be delegated to an appropriate division or staff member.
- Existing permission rules are enforced.
- Execution status is persisted.
- Deliverables are associated with the correct task.
- Approval decisions are authorized.
- Status transitions are validated.
- Activity and audit records remain consistent.
- Error states are surfaced clearly.

Do not change Council governance or authorization semantics.

## 3.7 Deliverable Reviewer Assignment

The reviewer assignment endpoint was previously missing.

An endpoint has reportedly been added:

`PUT /api/deliverables/:id/assign-reviewer`

Verify:

- Route registration.
- Request validation.
- Reviewer identity validation.
- Authorization.
- Database persistence.
- Invalid reviewer handling.
- Existing reviewer replacement behavior.
- Frontend integration.
- Regression tests.

Do not duplicate an existing implementation.

# 4. M3 — DASHBOARD FUNCTIONAL COMPLETION

## 4.1 Dashboard Activity

Previously identified issue:

`DashboardPage.tsx` requests `/api/activity`, but the backend does not register the corresponding route.

Implement a real activity endpoint using existing database and audit information.

Requirements:

- Register the correct endpoint.
- Return actual persisted activity.
- Include useful event metadata.
- Support pagination or a reasonable bounded result.
- Sort newest first.
- Handle empty results.
- Handle server errors.
- Connect the View All Activity action to a working destination.

Do not fabricate activity records or display placeholder data as real activity.

## 4.2 Dashboard Statistics

Fix dashboard statistics and retry behavior.

Previously identified retry key mismatches include:

- `activedivisions` vs `divisions`
- `staffagents` vs `staff`
- `pendingapprovals` vs `approvals`

Requirements:

- Establish canonical statistic identifiers.
- Ensure retry actions target the correct request.
- Display loading, success, empty, and error states.
- Avoid unnecessary repeated requests.
- Verify counts against actual database records.
- Ensure dashboard data refreshes after relevant operations.

## 4.3 Dashboard Quick Actions

Make every visible quick action functional.

### Create Division

- Open an actual creation workflow.
- Validate the form.
- Use existing backend APIs.
- Persist the new division.
- Update dashboard and organization views.

### Invite Staff

- Open an actual staff creation/invitation workflow.
- Respect existing staff identity and division relationships.
- Validate input.
- Use existing authorization.
- Update relevant views after success.

Do not create fake invitations if the system has no external invitation mechanism. Implement the supported local staff onboarding workflow instead.

### New Task

- Open the actual task creation interface.
- Support valid task details and assignment.
- Validate required fields.
- Persist the task.
- Refresh task and dashboard views.

Do not merely navigate to a page with an ignored query parameter.

## 4.4 Theme State

Previously identified issue:

- App ThemeWrapper manages MUI theme state.
- Layout maintains a separate darkMode state.
- Layout triggers a full page reload.

Consolidate theme ownership.

Requirements:

- One authoritative theme state.
- Consistent light and dark mode.
- Immediate theme switching without page reload.
- Persist preference using the existing supported storage approach.
- Ensure all pages and components use the same theme.
- Verify contrast and readability in both modes.

Preserve the existing design system and palette.

## 4.5 Navigation and Layout

Fix invalid nested CSS selectors in inline NavLink styles.

Use the supported MUI styling approach, such as `sx` or `styled`.

Verify:

- Active navigation state.
- Hover state.
- Focus state.
- Keyboard accessibility.
- Drawer behavior.
- Responsive navigation.
- Mobile and desktop layouts.

Do not introduce an unnecessary custom component framework.

Prefer existing MUI components.

## 4.6 Routing

Implement a proper not-found page.

Requirements:

- Unknown paths show a clear 404 state.
- Provide a route back to the dashboard.
- Avoid blank pages.
- Avoid silently redirecting unknown routes to unrelated pages.

Verify all existing navigation destinations.

## 4.7 Settings and Profile Actions

Inspect Settings and Profile menu items.

Requirements:

- Implement actions that are already within current MVP scope.
- If an action is intentionally deferred, label it clearly as unavailable or coming soon.
- Do not leave clickable inert controls.
- Do not imply unsupported functionality exists.

## 4.8 Deferred Pages

Council and Meetings placeholder tabs remain deferred.

Do not implement the full Council or Meetings feature scope as part of M2/M3.

Either:
- Clearly label these sections as Coming Soon; or
- Hide unavailable navigation entries where appropriate.

Preserve existing routes and data.

# 5. UI/UX QUALITY REQUIREMENTS

Review the application as a complete user-facing product.

Prioritize:

- Clear information hierarchy.
- Consistent spacing.
- Consistent typography.
- Readable contrast.
- Predictable navigation.
- Responsive layouts.
- Clear form validation.
- Useful error messages.
- Loading indicators.
- Empty states.
- Success feedback.
- Accessible keyboard interactions.
- Consistent MUI component usage.

Inspect at minimum:

- Dashboard.
- Chat.
- Organization.
- Divisions and Staff.
- Tasks.
- Deliverables.
- Settings.
- Profile.
- Not-found state.

Preserve the current dashboard visual direction and established theme.

Do not introduce decorative redesigns that reduce usability.

# 6. TESTING REQUIREMENTS

## 6.1 Backend

Add or update tests for:

- Message creation.
- Message response contract.
- Bidirectional conversation history.
- Message authorization.
- Recipient validation.
- Unread counts.
- Activity endpoint.
- Dashboard statistics.
- Deliverable reviewer assignment.
- Task creation.
- Delegation.
- Execution.
- Deliverable transitions.
- Approval authorization.

## 6.2 Frontend

Add or update tests for:

- Chat API contract.
- Conversation creation.
- Message rendering.
- Incoming and outgoing messages.
- Unread state.
- Chat refresh behavior.
- Dashboard activity.
- Dashboard statistics.
- Retry behavior.
- Quick actions.
- Theme switching.
- Navigation.
- Not-found page.
- Deliverable reviewer assignment.
- Responsive behavior.

## 6.3 End-to-End

Verify these workflows:

**E2E-01: Founder Chat**
- Founder creates a conversation.
- Sends a message.
- Message persists.
- History is displayed correctly.

**E2E-02: Agent Communication**
- Founder sends a message.
- Claude or Hermes retrieves it.
- Agent replies through MCP.
- Reply appears in the Founder conversation.

**E2E-03: Task Lifecycle**
- Founder creates a task.
- Task is delegated.
- Staff executes it.
- Deliverable is submitted.
- Reviewer is assigned.
- Authorized approval is completed.

**E2E-04: Dashboard**
- Dashboard loads actual statistics.
- Activity appears.
- Retry works.
- Quick actions open their correct workflows.

**E2E-05: Theme and Navigation**
- Theme switches without reload.
- Navigation works.
- Unknown routes display 404.
- Responsive layouts remain usable.

## 6.4 Test Isolation

The reported security tests pass individually but have intermittent failures when executed together.

Investigate shared test state.

Requirements:

- Identify shared database, filesystem, environment variables, mocks, module caches, and global state.
- Ensure each test suite has isolated setup and teardown.
- Prevent concurrent tests from modifying the same fixtures.
- Use separate temporary databases where appropriate.
- Restore modified environment variables.
- Close open database connections and servers.
- Avoid changing production code to conceal test failures.
- Run the full suite repeatedly to establish reproducibility.

Report individual test results separately from combined-suite results.

Do not claim the complete test suite passes if it does not.

# 7. SECURITY AND DATABASE BOUNDARIES

Preserve all established Phase 8 and M1 security invariants.

- Production authentication remains fail-closed.
- No hardcoded identity fallback.
- No Founder private keys exposed to browser code.
- No secrets committed to Git.
- Local single-user mode remains restricted to loopback.
- No spoofed forwarded IP trust.
- No weakened permission checks.
- Founder remains the final approval authority where required.
- Division Heads cannot bypass Founder approval for cross-division access.
- Existing database migration runner remains authoritative.
- Migration checksums and backup requirements remain intact.

## Explicitly prohibited without further Founder approval

1. Executing database cleanup operations from `DATABASE_CLEANUP_MANIFEST.md`.
2. Deleting or archiving active database records.
3. Resetting the production database.
4. Applying cleanup migrations.
5. Rewriting Git history.
6. Running `git filter-repo` against shared history.
7. Force-pushing.
8. Merging or deploying.
9. Changing Council seats, founding personas, or staff identities.
10. Introducing Redis or unnecessary infrastructure.

The history purge plan and database cleanup manifest must remain available for later Founder review.

# 8. IMPLEMENTATION ORDER

Execute in controlled batches.

### Batch 1 — Baseline and Contracts
- Complete pre-implementation audit.
- Reconcile message API contracts.
- Confirm database and identity assumptions.
- Identify reusable code.

### Batch 2 — Chat Core
- Bidirectional history.
- Conversation creation.
- Agent selection.
- Message persistence.
- Unread state.
- Refresh behavior.

### Batch 3 — Runtime and Workflow
- Claude/Hermes MCP integration verification.
- Task delegation.
- Execution lifecycle.
- Deliverable reviewer assignment.
- Approval workflow.

### Batch 4 — Dashboard Backend
- Activity endpoint.
- Dashboard statistics.
- Correct retry identifiers.
- Quick-action backend support.

### Batch 5 — Dashboard and Frontend
- Quick-action interfaces.
- Theme consolidation.
- Navigation styling.
- Not-found page.
- Settings/Profile actions.
- Responsive UI.

### Batch 6 — Regression and Integration
- Test isolation fixes.
- Backend tests.
- Frontend tests.
- Full E2E tests.
- Security regression tests.
- Build and TypeScript verification.

### Batch 7 — Final Audit
- Review all changed files.
- Check for regressions.
- Verify Git tracking.
- Review documentation.
- Prepare reports.
- Produce next milestone recommendation.

Do not skip batches or silently mark incomplete work as finished.

# 9. REQUIRED REPORTS

Create and track these reports:

1. `docs/audits/release/M2_BASELINE_REPORT.md`
2. `docs/audits/release/M2_CHAT_COMPLETION_REPORT.md`
3. `docs/audits/release/M2_AGENT_RUNTIME_INTEGRATION_REPORT.md`
4. `docs/audits/release/M2_WORKFLOW_INTEGRATION_REPORT.md`
5. `docs/audits/release/M3_DASHBOARD_FUNCTIONALITY_REPORT.md`
6. `docs/audits/release/M3_UI_UX_AUDIT_REPORT.md`
7. `docs/audits/release/M2_M3_TEST_REPORT.md`
8. `docs/audits/release/M2_M3_SECURITY_REGRESSION_REPORT.md`
9. `docs/audits/release/M2_M3_FINAL_ACCEPTANCE_REPORT.md`

Every report must distinguish:

- Implemented.
- Tested and passed.
- Tested and failed.
- Not tested.
- Blocked by external dependencies.
- Deferred by scope.

Include actual test commands and results.

Do not fabricate test results.

# 10. GIT AND DELIVERY RULES

- Work on the current authorized feature branch.
- Preserve all existing user changes.
- Do not reset or overwrite user work.
- Do not force-push.
- Do not merge.
- Do not deploy.
- Do not commit secrets, databases, test artifacts, or generated temporary files.
- Verify `.gitignore` does not hide source files, migrations, tests, or audit reports.
- Review `git status` and changed-file lists before delivery.

You may create local commits if consistent with the existing workflow, but do not push without explicit authorization.

# 11. FINAL ACCEPTANCE CRITERIA

M2 and M3 are complete only when:

- Chat API contracts are consistent.
- Incoming and outgoing history works.
- New conversations can be created.
- Agent selection uses valid identities.
- Message refresh and unread state work.
- Claude/Hermes integration is verified or explicitly documented as blocked.
- Task delegation and execution work.
- Deliverable reviewer assignment works end-to-end.
- Approval authorization remains enforced.
- Dashboard activity displays actual data.
- Dashboard statistics and retry work.
- Create Division, Invite Staff, and New Task actions work.
- Theme switching works without reload.
- Navigation works.
- Unknown routes show a proper 404 page.
- No visible MVP action is silently inert.
- Responsive UI has been verified.
- Backend and frontend tests have been executed.
- Test isolation issues have been resolved or precisely documented.
- TypeScript compilation is clean.
- Production frontend build succeeds.
- No critical/high security regression exists.
- All required reports are tracked.

# 12. FINAL DELIVERY FORMAT

At completion, provide:

1. M2 status.
2. M3 status.
3. Commit SHA(s), if committed.
4. Files created, modified, moved, or removed.
5. Backend test results.
6. Frontend test results.
7. E2E results.
8. Claude/Hermes runtime integration results.
9. TypeScript and production build results.
10. Security regression results.
11. Outstanding defects.
12. External blockers.
13. Database and Git approval gates still pending.
14. Required Founder decisions.
15. Recommended next milestone.

**Do not declare M2 or M3 formally accepted.**

Implementation completion and Founder acceptance are separate decisions.

Wait for the Founder to review the final reports and explicitly accept both milestones.