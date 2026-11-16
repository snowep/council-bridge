# COUNCIL BRIDGE — CORE MVP COMPLETION
## M1 Closure, Security Remediation, Chat Completion & Dashboard Functional Integration

Repository: `snowep/council-bridge`  
Local path: `C:\Projects\council-bridge`  
Current working branch: `refactor/repository-structure`

Latest audited commit:
`73f632d531678360a79b5af30825636651fd1caa`

## OBJECTIVE

Make Council Bridge usable as quickly as possible.

This milestone must focus exclusively on:

1. Core system security and correctness.
2. M1 closure.
3. Chat and Claude/Hermes communication.
4. Dashboard functionality.
5. Essential UI/UX corrections.
6. End-to-end verification.

Do not redesign the architecture, introduce unnecessary infrastructure, or expand the product scope.

Preserve the Founder's latest dashboard UI direction.

---

# PART 1 — PRESERVE CURRENT STATE

Before changes:

- Inspect Git status, branch, and commit SHA.
- Identify all uncommitted changes.
- Preserve the latest dashboard modifications.
- Read the existing M0 and M1 audit documents.
- Verify the current repository against the previous audit findings.
- Do not assume previously reported work is complete without checking the code.

Do not reset, overwrite, stash, or discard user changes.

---

# PART 2 — CRITICAL FOUNDER KEY INCIDENT

The published public repository contains:

`.secrets/founder-keys.json`

This file contains private-key material.

Treat every Founder private key ever committed to the public repository as compromised.

### Required remediation

1. Inspect all currently tracked `.secrets` files.
2. Update `.gitignore` to exclude the entire `.secrets/` directory.
3. Untrack the existing active key file without destroying unrelated local data.
4. Generate a completely new Founder key pair.
5. Write the replacement only to the ignored local `.secrets/` directory.
6. Never print, log, commit, or include the private key in reports.
7. Do not archive compromised private keys.
8. Verify the replacement directory has mode `0700` and key file has mode `0600` where supported.
9. Verify the replacement key can sign and verify a valid Founder request.
10. Verify signatures from the previous key are rejected.
11. Verify the public-key endpoint exposes only the new public key and key ID.
12. Identify any local clients or configurations that require the new public key.

Do not use the existing compromised key to generate or authorize the replacement.

### Git history

Prepare:

`docs/audits/release/SECRET_HISTORY_PURGE_PLAN.md`

Document:
- Every affected tracked key path.
- Whether private-key material remains in historical commits.
- A safe Git history removal procedure.
- Affected branches and tags.
- Required collaborator/repository coordination.
- Post-purge verification commands.

Do not rewrite shared Git history, force-push, or alter remote branches without explicit Founder approval.

Key rotation and revocation must not wait for history rewriting.

---

# PART 3 — REPOSITORY TRACKING CORRECTION

The current `.gitignore` incorrectly excludes important source files.

Review and correct:

- `docs/audits/release/*.md`
- `migrations/`
- New security test files.
- New integration test files.
- Generated test artifacts.
- `.secrets/`

Required:

1. M1 reports must be trackable.
2. Security test source files must be trackable.
3. Migration source files must be trackable.
4. Generated test output must remain ignored.
5. Do not broadly ignore source directories.
6. Do not accidentally commit private keys or database files.

Use `git check-ignore -v` and `git ls-files` to verify the result.

Confirm that the published branch contains the required M1 reports and test sources after implementation.

---

# PART 4 — CLOSE REMAINING M1 FINDINGS

### SEC-02: Founder key permissions

The implementation in `src/auth/founder.ts` already contains restrictive permission handling.

Verify:
- Directory permissions.
- File permissions.
- Existing-file behavior.
- Windows compatibility.
- Error handling.
- Actual key generation behavior.

Add and retain a regression test.

### SEC-05: Deliverable authorization

Inspect:
- `src/council/divisions.ts`
- `src/council/legacy.ts`
- `src/council/task-delegation.ts`
- `src/api/routes/deliverables.routes.ts`

Verify:
- Staff can perform authorized content updates.
- Division Heads cannot bypass Founder approval.
- Only authorized users can approve or reject deliverables.
- Status transitions follow the existing governance model.
- REST and MCP paths enforce equivalent authorization.

Add regression tests.

### DB-02: Cross-division sharing

Inspect:
- Database schema and migration history.
- `src/council/memory.ts`
- `src/council/legacy.ts`
- Cross-division request and approval workflows.

Resolve the contradiction:

- Database CHECK currently restricts `granted_by_type` to Founder.
- Legacy code permits Division Heads to create pending requests using `granted_by_type = 'division'`.

Preserve the distinction between:
- Division Head submitting a request.
- Founder approving the request.
- Approved cross-division access.

Do not bypass Founder approval or misrepresent the request creator.

If the database schema must change, create a new migration and add migration tests. Do not modify production databases.

### DB-01: Migration dependencies

Verify transitive dependency resolution.

Test:
- Direct dependencies.
- Multiple dependency levels.
- Missing dependencies.
- Invalid migration graphs.
- Correct execution ordering.
- Already-applied migrations.

Do not run migrations against the active production database.

### Other security verification

Recheck:
- Session signing secret.
- Production authentication fallback.
- Founder startup validation.
- Founder signature ownership binding.
- Concurrent nonce replay.
- SQL parameterization in privacy filters.
- Deliverable authorization.

Preserve existing security guarantees.

---

# PART 5 — CHAT COMPLETION

This is the highest-priority functional feature.

Relevant files:

- `frontend/src/features/chat/pages/ChatPage.tsx`
- `frontend/src/shared/types/api.ts`
- `frontend/src/api/client.ts` or its current shared API client path
- `src/api/routes/messages.routes.ts`
- `src/communication/messages.ts`
- `src/mcp/tools.ts`
- Agent registry and database message statements.

### 5.1 API contract consistency

The current backend returns `Message.id`, while the frontend expects `message_id`.

The backend POST response is `{ message }`, while the frontend expects a direct `Message`.

Resolve all API contract inconsistencies.

Choose one canonical message model and use it consistently in:
- Backend service.
- REST response.
- MCP response where applicable.
- Frontend TypeScript types.
- Chat rendering.
- Optimistic updates.
- Tests.

Do not use unsafe type casts to conceal mismatches.

### 5.2 Conversation history

Fix `checkInbox` and conversation retrieval.

A conversation must contain messages in both directions:
- Messages sent by the current identity.
- Messages received by the current identity.

Requirements:
- Correct participant filtering.
- Correct chronological ordering.
- Persistent history.
- Pagination for long conversations.
- Read-state updates.
- Correct unread counts.
- No arbitrary history truncation that silently removes earlier messages.

Verify that marking a conversation as read affects only the intended recipient's messages.

### 5.3 Start new conversations

The current UI only lists existing conversations.

Add a practical way for the Founder to start a conversation with a registered agent.

Requirements:
- Select an available canonical agent.
- Display its correct identity and runtime.
- Prevent selecting nonexistent or inactive agents.
- Start the conversation by sending the first message.
- Avoid creating duplicate organizational identities.
- Preserve authentication and authorization.

Use the existing canonical registry and runtime mappings.

### 5.4 Incoming updates

Implement reliable polling suitable for the existing REST architecture.

Requirements:
- Refresh the selected conversation every 2–5 seconds.
- Refresh conversation previews and unread counts.
- Stop polling when no longer needed.
- Avoid overlapping requests.
- Avoid state updates after unmount.
- Avoid unnecessary polling when the browser tab is inactive.
- Preserve manual refresh and retry behavior.

WebSockets are not required for this MVP.

### 5.5 Claude and Hermes integration

The MCP message tools currently provide message sending and inbox retrieval.

Verify the actual agent connection workflow.

Acceptance:

Founder → Chat → Bridge → Claude/Hermes → Bridge → Chat → Persistent history.

Test each runtime independently.

Do not claim that Claude or Hermes is connected merely because an MCP endpoint exists.

If runtime clients cannot be accessed during testing:
- Complete the message bus and Chat implementation.
- Document the missing runtime configuration.
- Clearly mark E2E runtime verification as blocked.
- Do not simulate successful agent responses.

### 5.6 Chat UX

Provide:
- Agent selection.
- Conversation list.
- Message history.
- New conversation action.
- Clear sender/recipient presentation.
- Sending state.
- Delivery or processing status where supported by real data.
- Retry on failure.
- Read/unread indicators.
- Mobile responsive layout.
- Accessible input and keyboard behavior.
- Empty state with a clear way to start a conversation.

---

# PART 6 — DASHBOARD FUNCTIONAL INTEGRATION

Relevant files:

- `frontend/src/features/dashboard/pages/DashboardPage.tsx`
- `frontend/src/app/App.tsx`
- `frontend/src/app/layouts/Layout.tsx`
- `frontend/src/shared/theme/index.ts`
- Backend API route registration and existing services.

Preserve the current dashboard visual direction.

### 6.1 Recent Activity

The dashboard currently requests `/api/activity`, but no such route is registered.

Implement a real database-backed activity endpoint using existing task, deliverable, execution, meeting, and approval records where appropriate.

Requirements:
- Real records only.
- Correct timestamps.
- Correct event types.
- Authorization filtering.
- Pagination or a bounded recent-event response.
- Loading, empty, and error states.

If a reliable activity aggregation is not feasible without expanding scope, remove the misleading widget and its dead navigation rather than returning fake data.

### 6.2 Dashboard statistics

Verify:
- Active divisions.
- Total divisions.
- Active staff.
- Total staff.
- Pending approvals.

Correct the retry handler. Current label-to-key conversion produces keys that do not match the dashboard loading state.

Ensure every retry button actually retries its intended section.

### 6.3 Quick actions

Review every dashboard action.

Current problems:
- Create Division navigates to a read-only Organization page.
- Invite Staff navigates using a query parameter the page ignores.
- New Task navigates to Tasks but does not open the creation dialog.

Make every action perform its advertised behavior.

Prefer using existing functionality:
- Open Organization.
- View Staff.
- Open Task creation.
- Review Approvals.
- Start Chat.

If an action cannot be implemented without a new workflow, replace it with a truthful navigation action or remove it from the MVP dashboard.

Do not leave decorative or nonfunctional buttons.

### 6.4 Theme management

Consolidate theme state.

Requirements:
- One source of truth for light/dark mode.
- Persist the selected mode.
- Respect system preference on first visit.
- Update ThemeProvider without a full page reload.
- Keep the selected mode consistent across all pages.
- Prevent theme initialization flicker where practical.

### 6.5 Navigation and layout

Fix:
- NavLink active styles using appropriate MUI styling.
- Mobile drawer behavior.
- AppBar contrast in both themes.
- Unknown-route handling.
- Inert Settings/Profile menu actions.
- Accessible labels and keyboard navigation.

Do not introduce unnecessary custom components or replace the existing MUI architecture.

### 6.6 Dashboard UX verification

Test:
- Loading.
- Empty state.
- API failure.
- Retry.
- Theme persistence.
- Navigation.
- Quick actions.
- Desktop layout.
- Mobile layout.

---

# PART 7 — DELIVERABLE WORKFLOW INTEGRATION

The current DeliverablesPage calls:

`PUT /api/deliverables/:id/assign-reviewer`

The published backend route does not implement this endpoint.

Resolve the mismatch.

Either:
- Implement the correctly authorized REST endpoint using existing reviewer assignment logic; or
- Remove the unsupported action from the UI if it is outside MVP scope.

Verify the entire workflow:

Task → Draft → Submit → Review → Approve/Reject/Revision → Resubmit.

Ensure the Founder approval requirement cannot be bypassed through REST or MCP.

---

# PART 8 — UI/UX SCOPE CONTROL

The following are not required for the first usable release:

- Council Decisions tab.
- Council Voting tab.
- Meetings Decisions tab.
- Meetings Action Items tab.
- WebSockets.
- Redis.
- Advanced analytics.
- Advanced autonomous behavior.

Keep these clearly marked as deferred.

Do not build them in this milestone.

Replace browser `alert()` calls in core task and deliverable workflows with consistent MUI Snackbar/Alert handling where practical.

Keep the interface responsive and predictable.

---

# PART 9 — DATABASE CLEANUP APPROVAL GATE

The database cleanup manifest still requires explicit Founder approval.

Do not:
- Delete test records.
- Archive production records.
- Apply cleanup migrations.
- Reset the active database.
- Modify the active production database.

You may:
- Inspect schema.
- Verify cleanup manifest consistency.
- Check foreign keys in an isolated test database.
- Prepare dry-run tooling.
- Document rollback and recovery.

Stop before destructive operations.

---

# PART 10 — TESTING AND ACCEPTANCE

Run and record actual results.

### Backend
- Authentication tests.
- Founder signature tests.
- Migration tests.
- Cross-division access tests.
- Deliverable authorization tests.
- Message service tests.
- API contract tests.

### Frontend
- TypeScript typecheck.
- Production build.
- Lint.
- Chat component tests.
- Dashboard component tests.
- API integration tests.

### E2E

Verify these workflows:

1. Founder opens dashboard.
2. Dashboard displays real organizational statistics.
3. Founder starts a new conversation.
4. Founder sends a message to Claude.
5. Claude receives and responds.
6. Founder sees the reply.
7. Conversation persists after restart.
8. Repeat for Hermes.
9. Founder creates a task.
10. Task is assigned to an authorized agent.
11. Agent updates task status.
12. Agent creates and submits a deliverable.
13. Founder reviews and approves it.
14. Founder requests and verifies an execution workflow.

Do not report unexecuted tests as passing.

Do not weaken tests to obtain a green result.

---

# PART 11 — REQUIRED REPORTS

Create or update:

1. `docs/audits/release/M1_CLOSURE_REPORT.md`
2. `docs/audits/release/SECRET_EXPOSURE_REMEDIATION_REPORT.md`
3. `docs/audits/release/M1_REGRESSION_REPORT.md`
4. `docs/audits/release/CHAT_COMPLETION_REPORT.md`
5. `docs/audits/release/DASHBOARD_FUNCTIONALITY_REPORT.md`
6. `docs/audits/release/DELIVERABLE_WORKFLOW_REPORT.md`
7. `docs/audits/release/CORE_MVP_ACCEPTANCE_REPORT.md`

All reports must be tracked by Git.

Include:
- Findings.
- Files changed.
- Tests executed.
- Results.
- Remaining blockers.
- Runtime integration evidence.
- Database cleanup approval status.
- Known limitations.

Never include private keys, tokens, or secret values.

---

# STRICT EXECUTION BOUNDARIES

Authorized:
- Non-destructive code fixes.
- Founder key rotation into an ignored local secret directory.
- Removal of secrets from the current Git index.
- `.gitignore` corrections.
- Tests.
- Documentation.
- UI/UX fixes.
- Local isolated test database operations.

Not authorized:
- Production database deletion.
- Production cleanup migration.
- Database reset.
- Production deployment.
- Git history rewrite.
- Force push.
- Merge into master.
- Changing Council membership.
- Changing canonical divisions or staff identities.
- Weakening authentication.
- Introducing Redis without a demonstrated MVP requirement.

Do not push or merge.

Preserve all user changes.

# COMPLETION CONDITION

This milestone is complete when:

1. Founder key exposure is remediated locally and the old key is rejected.
2. No private key remains tracked in the current Git tree.
3. Git ignore rules permit reports, migrations, and tests to be tracked.
4. Remaining M1 security and database findings are resolved or explicitly blocked.
5. Chat API contracts are consistent.
6. Founder can start and use agent conversations.
7. Claude and Hermes runtime communication is verified or explicitly marked blocked.
8. Dashboard actions work as advertised.
9. Core deliverable workflows work through the REST API.
10. All critical regression tests pass.
11. Reports are present in the repository.
12. No destructive database cleanup has occurred without approval.

Stop and present the completion report.

The objective is a secure, usable Council Bridge MVP, not a larger architecture.