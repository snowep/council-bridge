# Unified Implementation Prompt — M2 + M3 Completion
## Council Bridge | Chat Integration, Dashboard, UI/UX, Security & Reliability

**Repository:** `https://github.com/snowep/council-bridge`  
**Local project:** `C:\Projects\council-bridge`  
**Current working branch:** `refactor/repository-structure`  
**MCP port:** `3334`  
**Agent definitions:** `C:\Users\L\.claude\agents`

---

# 1. Mission

Complete M2 (Chat Integration) and M3 (Dashboard and Core UI) in one coordinated implementation milestone.

This is an implementation task, not another planning-only exercise.

Preserve the existing architecture, functionality, visual direction, security boundaries, and completed work from Phases 1–10, M1, M2, and M3.

Resolve all previously identified M2 and M3 defects, implement the additional findings in this document, add missing tests, and produce a complete implementation and verification report.

Do not start unrelated new features.

Do not redesign the application unnecessarily.

The objective is a reliable, usable local Founder dashboard and a working communication interface between the Founder, Claude Code, and Hermes Agent.

**Important:** A feature is not complete merely because its UI exists, its API returns HTTP 200, or its tests mock the expected behavior. Verify actual behavior wherever the required runtime or environment is available.

# 2. Mandatory Agent Orchestration

You MUST use Claude Code subagents defined under:

`C:\Users\L\.claude\agents`

Do not perform this entire implementation as one agent.

## Agent requirements

1. Inspect the available agent definitions before assigning work.
2. Use the most relevant existing agents.
3. If an appropriate agent does not exist, report that limitation. Do not silently pretend an agent was used.
4. Maximum **5 agents running in parallel**.
5. Each agent must receive a clearly bounded task and explicit file ownership.
6. Two agents must NEVER edit the same file concurrently.
7. An agent may inspect files owned by another agent, but must not modify them.
8. Shared contracts and integration files must have one designated owner.
9. The main Claude Code session acts as coordinator and integration owner.
10. Agents must report changed files, implementation details, tests executed, and unresolved issues.

## Required work allocation

Use this allocation as the default. Adjust only when repository inspection demonstrates a better division. Preserve exclusive write ownership.

| Agent | Responsibility | Primary file ownership |
|---|---|---|
| Agent 1 | Chat backend, identity registry, messaging, history, read receipts, MCP communication | `src/communication/**`, relevant `src/api/routes/messages.routes.ts`, communication services and tests |
| Agent 2 | MCP authentication, Founder nonce cleanup, activity authorization, migration rollback tests | `src/auth/**`, `src/council/memory.ts`, `src/migration-runner/rollback.ts`, corresponding backend tests |
| Agent 3 | Theme architecture, navigation, routing, 404, settings/profile, placeholder states | `frontend/src/app/**`, `frontend/src/shared/theme/**`, corresponding frontend tests |
| Agent 4 | Chat frontend, conversation history UI, agent selection, retry, delivery/read states | `frontend/src/features/chat/**`, corresponding frontend tests |
| Agent 5 | Dashboard, activity feed, quick actions, statistics, integration verification and E2E tests | `frontend/src/features/dashboard/**`, activity feature files, E2E test files and relevant reports |

**Coordination rules:**

- Before starting, map every target file to exactly one owner.
- If a file falls outside the assigned boundaries, the main coordinator must assign it explicitly.
- Do not let Agent 1 and Agent 4 edit the same API contract or shared type file. The coordinator owns shared contracts and integrates changes.
- Do not let Agent 2 and Agent 1 edit the same backend route or service file. Assign each file to one owner.
- Do not let Agent 3 and Agent 5 edit the same App, Layout, or route file. Agent 3 owns application shell and routing; Agent 5 owns dashboard feature files.
- If a shared file needs changes, stop the affected parallel work, nominate one owner, and integrate the change sequentially.
- Run parallel agents only for independent tasks.
- Integrate and test in controlled stages.

## Execution waves

**Wave 0 — Coordinator**
- Inspect repository state, current branch, latest commit, working tree, existing agent definitions, and project instructions.
- Review the latest implementation rather than assuming the previous audit commit is still current.
- Establish the file ownership map.
- Establish the baseline test results.

**Wave 1 — Parallel implementation**
- Start up to five agents using the ownership allocation above.
- Agents implement their isolated tasks and run their own tests.
- No shared-file editing.

**Wave 2 — Integration**
- Coordinator reviews agent changes.
- Resolve shared contracts and cross-module integration.
- Fix TypeScript, import, API contract, and migration compatibility problems.
- Run backend and frontend test suites.

**Wave 3 — Cross-system verification**
- Verify the complete Founder → Chat → Agent → Reply → Dashboard workflow.
- Test both Claude and Hermes independently where runtimes are available.
- Run security and regression checks.

**Wave 4 — Independent final audit**
- Use an available independent review agent.
- Review implementation against every requirement in this prompt.
- Fix all critical and high-priority findings before declaring completion.

# 3. Initial Repository Safety Checks

Before modifying anything:

1. Inspect the latest commit on `refactor/repository-structure`.
2. Confirm the current branch.
3. Inspect `git status`.
4. Identify uncommitted user changes.
5. Preserve all existing user changes.
6. Review existing architecture, conventions, tests, migration history, and project instructions.
7. Identify the current database schema and migration state without modifying the production database.
8. Record baseline test results.

Do not:
- Reset the working tree.
- Discard user changes.
- Rewrite Git history.
- Force-push.
- Merge branches.
- Deploy.
- Modify the production database.
- Run database cleanup.
- Execute the Git history purge.
- Rotate or replace production credentials.
- Add Redis or unnecessary dependencies.

Do not commit or push unless explicitly authorized.

If a migration is necessary, implement it through the established migration system. Test it against an isolated test database. Do not apply it to the production database.

# 4. M2 — Chat Integration Closure

## 4.1 Communication identity registry

**Priority: P0**

Previous audit found an identity mismatch:

- Chat UI retrieves agents from `/api/staff` and `/api/divisions`.
- Message service validates sender and recipient against the communication `agents` table.
- Staff registration writes to `staff_agents`.
- Division creation writes to `divisions`.
- No reliable synchronization was found between these registries.

This can cause the UI to display recipients that the messaging backend cannot actually contact.

Implement one reliable identity-registration strategy.

Requirements:

1. Identify the authoritative identity registry.
2. Define how Founder, Claude, Hermes, Division Heads, and specialists map to communication identities.
3. Ensure registered staff and divisions can be resolved by the messaging service.
4. Ensure agent registration is idempotent.
5. Prevent duplicate identities.
6. Preserve existing IDs and relationships.
7. Do not create duplicate agent records to work around inconsistent identity mapping.
8. Do not automatically grant permissions during synchronization.
9. Preserve authentication and authorization checks.
10. Ensure a fresh installation has a valid Founder communication identity through the established bootstrap process.

Add tests covering:
- Founder identity availability.
- Claude and Hermes registration.
- Staff registration.
- Division identity registration.
- Duplicate registration.
- Unknown recipient rejection.
- Permission boundaries.
- Identity consistency after restart.

## 4.2 Actual message delivery and agent consumption

**Priority: P0**

The previous audit found that POST `/api/messages` persists messages to SQLite but does not establish automatic live dispatch.

MCP tools allow independently connected agents to retrieve messages.

Do not describe this as automatic delivery unless a real delivery mechanism exists and is verified.

Implement or complete a reliable message-consumption mechanism compatible with the existing MCP architecture.

Requirements:

1. Messages are durably persisted before being acknowledged.
2. Claude and Hermes can independently retrieve messages addressed to them.
3. Agents can identify unread and pending messages.
4. Message consumption does not silently discard messages.
5. Repeated polling does not create duplicate messages.
6. Replies are persisted and associated with the correct conversation.
7. Agent disconnection does not lose pending messages.
8. Messages remain available after application restart.
9. Authentication and identity ownership are enforced.
10. Delivery failures are visible and recoverable.

Use the existing architecture unless repository inspection proves it inadequate.

Do not introduce a new queue infrastructure or Redis without demonstrated necessity.

If automatic dispatch is not feasible with the available runtimes, implement reliable persistent mailbox semantics and expose truthful pending/retrieved/failed states.

## 4.3 Claude and Hermes MCP connectivity

**Priority: P0**

Inspect the existing MCP implementation:

- `/mcp`
- Streamable HTTP transport
- `send_message`
- `get_messages`
- `check_inbox`
- `reply_message`
- `list_messages`

Requirements:

1. Verify MCP authentication behavior.
2. Verify each tool's input and output schemas.
3. Verify authenticated agent identity resolution.
4. Verify Claude can retrieve and reply to messages.
5. Verify Hermes can retrieve and reply to messages.
6. Verify one agent cannot impersonate another.
7. Verify unauthorized requests fail closed.
8. Verify reconnect and polling behavior.
9. Document the exact Claude and Hermes connection configuration.
10. Provide a diagnostic procedure for runtime connectivity.

If a runtime is unavailable, report it as BLOCKED. Do not fabricate successful integration tests or substitute mocked tests for real runtime verification.

## 4.4 Conversation history and pagination

**Priority: P1**

Previous audit identified these problems:

- Conversation history retrieves a limited global message set before filtering.
- Older messages may disappear from a conversation.
- REST offset is applied after the limited result.
- MCP `list_messages` accepts pagination arguments that the underlying service ignores.

Fix the retrieval architecture.

Requirements:

1. Filter by conversation in the database query.
2. Apply pagination in the database query, not after an arbitrary global limit.
3. Support deterministic ordering.
4. Use stable pagination semantics.
5. Respect `limit`, `offset` or cursor parameters consistently.
6. Respect unread-only filters.
7. Preserve chronological display order.
8. Ensure one conversation cannot consume another conversation's history limit.
9. Return accurate pagination metadata.

Add tests with multiple conversations and more messages than the configured page size.

## 4.5 Mark-as-read correction

**Priority: P1**

Previous audit found a mismatch between SQL parameter ordering and service invocation in `markMessagesAsRead()`.

Inspect the actual current implementation before changing it.

Ensure:
- SQL parameters match their intended fields.
- Only messages belonging to the intended recipient and conversation are marked read.
- Messages from other conversations remain unread.
- Unread counts update correctly.
- Repeated mark-as-read calls are safe.
- REST and MCP behavior are consistent.

Add regression tests.

## 4.6 `checkInbox` conversation filtering

**Priority: P1**

Previous audit found that `checkInbox` accepts an optional `conversationId`, but callers may receive all messages when they expect a filtered result. The MCP `check_inbox` tool does not consistently pass the conversation ID.

Requirements:
- Define and document the intended optional-parameter behavior.
- Ensure an explicitly supplied conversation ID always filters results.
- Ensure omitted conversation ID has predictable documented behavior.
- Update MCP tool input schema if needed.
- Add tests for both filtered and unfiltered calls.

## 4.7 Failed-send retry

**Priority: P1**

Previous audit found that ChatPage clears the input before the send request completes. When sending fails, the optimistic message is removed but the text is lost. The retry action then has no message to resend.

Fix the send lifecycle.

Requirements:
1. Preserve the user's message text until the request succeeds.
2. Show a clear pending state.
3. Show a truthful failed state.
4. Allow retry without retyping.
5. Prevent accidental duplicate sends.
6. Preserve conversation identity during retries.
7. Recover gracefully from network errors.
8. Do not display a message as delivered before server confirmation.

Add frontend tests for failed send, retry, duplicate prevention, and successful recovery.

## 4.8 Delivery and read states

Implement truthful message states, using the simplest model supported by the architecture.

At minimum distinguish:
- Pending: persisted but not yet retrieved by the intended agent.
- Retrieved: agent has retrieved the message.
- Replied: a response has been persisted.
- Failed: delivery or processing failure is known.

Read state must be separate from delivery state.

Do not claim that an agent has read or processed a message merely because it retrieved it.

Ensure the UI displays only states supported by actual backend evidence.

## 4.9 Runtime presence

Implement or expose truthful online/offline status for Claude and Hermes.

Requirements:
- Presence must be based on authenticated check-ins or another verified signal.
- Define a documented heartbeat expiry.
- Offline agents must not appear online indefinitely.
- Show last-seen information where appropriate.
- Do not infer online status from a configured agent record alone.

# 5. M3 — Dashboard and Frontend Completion

## 5.1 Dashboard activity authorization

**Priority: P1 — Security**

Previous audit found that `listActivity()` in `src/council/memory.ts` returns task audit entries without filtering by authenticated owner context.

Fix the authorization boundary.

Requirements:
1. Inspect the actual ownership model and authentication context.
2. Filter task audit entries by the correct task ownership relationship.
3. Apply the same authorization logic to every activity source.
4. Prevent non-Founder users from seeing unrelated task audit trails.
5. Preserve the Founder permissions defined by the existing security model.
6. Do not invent new permission rules.
7. Add tests using multiple owners and multiple tasks.
8. Verify unauthorized records never appear in API responses.

The previous suggested `assigned_to_id` / `created_by_id` approach is not automatically authoritative. Inspect the real schema and use the existing authorization model.

## 5.2 Activity query completeness

Previous audit found that three separate queries each retrieve approximately one-third of the requested limit before JavaScript merging and sorting.

This can omit recent records from one source.

Fix the behavior so the returned activity feed is correctly ordered and complete for the requested page.

A single SQL `UNION` query is optional, not mandatory.

Requirements:
- Correct global ordering.
- Correct pagination.
- No source is unfairly truncated before global ordering.
- Consistent authorization across sources.
- Appropriate handling of empty and failed sources.
- Tests with uneven activity distributions.

Keep the implementation simple. Do not optimize prematurely.

## 5.3 Activity error handling

The Dashboard currently risks treating an activity-fetch error as an empty activity list.

Differentiate:
- Loading.
- Successfully loaded with activity.
- Successfully loaded with no activity.
- Failed to load.

Provide an appropriate retry action.

Never silently convert a backend failure into an empty-state success.

## 5.4 Dashboard quick actions

Previous audit found that several quick actions are incomplete:

- Create Division navigates to Organization but does not open a creation workflow.
- Invite Staff navigates to the staff tab but does not initiate an invitation/onboarding workflow.
- New Task navigates to `/tasks?create`, but TasksPage ignores the query parameter.

Implement functional behavior.

Requirements:
1. New Task opens the actual task creation interface.
2. Create Division opens the actual division creation interface.
3. Invite Staff opens an actual staff registration/invitation workflow supported by the existing architecture.
4. Query parameters and navigation state work correctly.
5. Forms validate inputs.
6. Success and error states are visible.
7. Existing permission checks remain enforced.
8. No quick action silently does nothing.

If a workflow genuinely cannot be implemented within existing backend capabilities, label it Coming Soon and disable it. Do not present a nonfunctional action as operational.

## 5.5 View All Activity

Previous audit found that the Dashboard links to `/activity`, but the route is not registered.

Implement a functional Activity page and route.

Requirements:
- Register the route.
- Display authorized activity records.
- Support loading, empty, and error states.
- Provide appropriate pagination or incremental loading.
- Respect the same authorization rules as the Dashboard activity feed.
- Provide a working navigation path back to the Dashboard.

## 5.6 Dashboard statistics and data integrity

Verify that dashboard statistics are sourced from actual API/database data.

Requirements:
- No fabricated counts.
- No hardcoded operational success.
- Loading and error states.
- Correct zero states.
- Refresh behavior.
- Consistent API contracts.

## 5.7 Theme architecture — single source of truth

**Priority: P1**

Files previously identified:
- `frontend/src/app/App.tsx`
- `frontend/src/app/layouts/Layout.tsx`

Problem:
- App.tsx ThemeWrapper owns MUI theme state.
- Layout.tsx maintains a separate `darkMode` state.
- Layout writes to localStorage independently.
- Theme toggle calls `window.location.reload()`.
- Reload destroys application state and may lose form data.

Fix:

Create:

`frontend/src/shared/theme/use-theme-store.ts`

Use Zustand if already available and appropriate. Otherwise use React Context. Do not add a dependency solely for this if the existing stack can support it cleanly.

Requirements:
1. One authoritative theme state.
2. App and Layout consume the same state.
3. One owner for localStorage initialization and persistence.
4. No duplicate theme initialization.
5. No `window.location.reload()` for theme changes.
6. Theme changes apply immediately.
7. Preserve user preference across refresh.
8. Support light and dark modes.
9. Prevent initialization flicker where reasonably possible.
10. Preserve existing MUI theme tokens and component styling.

Add tests for initialization, toggling, persistence, and shared state.

## 5.8 Navigation hover, focus, and active states

**Priority: P1**

File previously identified:

`frontend/src/app/layouts/Layout.tsx`

Problem:
`NavLink` uses React inline `style` with nested CSS selectors such as `&:hover`. Plain inline styles do not support CSS pseudo-selectors.

Fix using MUI `sx`, `styled()`, or another valid existing styling approach.

Requirements:
- Visible hover state.
- Visible keyboard focus state.
- Clear active-route state.
- Accessible color contrast.
- Correct behavior in light and dark themes.
- Preserve current navigation layout.

Add tests where practical.

## 5.9 404 page

**Priority: P1**

File previously identified:

`frontend/src/app/App.tsx`

Implement a real Not Found page.

Requirements:
- Add a catch-all route.
- Display a clear 404 message.
- Provide a working link to `/dashboard`.
- Preserve the existing layout and visual language.
- Ensure unknown routes never render a blank page.

## 5.10 Settings and Profile menu actions

**Priority: P1**

File previously identified:

`frontend/src/app/layouts/Layout.tsx`

The existing Settings and Profile menu entries only close the menu.

This is not acceptable as an operational MVP action.

Choose one:
- Implement the actual route and functionality.
- Remove the menu item.
- Display a disabled item with an explicit Coming Soon label.

Do not leave silently inert clickable controls.

Do not invent a profile or settings backend simply to make the menu appear functional.

## 5.11 Council and Meetings placeholders

**Priority: P1**

The `/council` and `/meetings` routes currently render placeholders.

Requirements:
- Keep them accessible if appropriate.
- Clearly label them Coming Soon.
- Do not make placeholders appear like completed features.
- Preserve existing routes and avoid breaking navigation.
- Use the existing MUI Chip component or another consistent visual indicator.

# 6. Additional Backend Reliability Findings

## 6.1 Founder nonce cleanup

**Priority: P1**

File previously identified:

`src/auth/founder.ts`

Problem:
Expired nonce cleanup runs probabilistically with a 1% condition.

Replace probabilistic cleanup with deterministic cleanup.

Requirements:
1. Use a predictable scheduled cleanup strategy.
2. Avoid creating multiple timers during repeated initialization.
3. Ensure cleanup stops appropriately during shutdown or test teardown.
4. Keep nonce validation and replay protection unchanged.
5. Ensure expired nonce records do not accumulate indefinitely.
6. Add tests for expiration and cleanup.
7. Avoid making authentication requests depend on unpredictable cleanup behavior.

Use a simple fixed interval or another deterministic mechanism compatible with the existing lifecycle.

Do not weaken replay protection.

## 6.2 Migration rollback tests

**Priority: P1**

File previously identified:

`src/migration-runner/rollback.ts`

Add integration tests for rollback behavior.

Required test sequence:

1. Create an isolated temporary SQLite database.
2. Record the original schema and relevant data.
3. Apply a test migration.
4. Verify the expected schema changes.
5. Insert representative test data where appropriate.
6. Roll back the migration.
7. Verify the original schema is restored.
8. Verify data integrity.
9. Verify migration tracking metadata.
10. Verify failure behavior when rollback cannot safely proceed.

Important:
- Do not test by rolling back the production database.
- Do not assume every migration is reversible.
- Preserve existing migration safeguards.
- Test transaction handling and failure recovery.

# 7. Additional Low-Priority Cleanup

Implement these only after all functional and security work passes.

## 7.1 Layout bundle size

`frontend/src/app/layouts/Layout.tsx` imports more than 20 MUI components/icons.

Inspect actual bundle output.

Do not add dynamic imports automatically. MUI tree-shaking may already handle these imports.

Only change import strategy if measurable improvement justifies the added complexity.

## 7.2 Activity query optimization

A single SQL UNION query may replace three queries and JavaScript sorting.

This is optional.

Prioritize correctness, authorization, and pagination over optimization.

## 7.3 Duplicate database import

`src/api/routes/activity.routes.ts`

Remove the duplicate or unused `databaseInstance` import if it still exists.

Confirm no behavior changes.

# 8. API and Contract Consistency

Review the backend/frontend shared API contracts.

Ensure:
- Chat request and response schemas match.
- Agent identity fields are consistent.
- Conversation IDs are stable.
- Pagination metadata is consistent.
- Delivery and read states are represented accurately.
- Error responses are predictable.
- Dashboard activity types match backend output.
- No UI component depends on undocumented response fields.
- MCP tools and REST endpoints agree on message semantics.

Avoid unnecessary abstractions.

Do not duplicate business logic between REST and MCP handlers. Reuse the existing service layer.

# 9. Testing Requirements

Run all relevant tests and report actual results.

## Backend
- Existing backend regression suite.
- Communication service tests.
- Identity registry tests.
- Message persistence and retrieval tests.
- Conversation pagination tests.
- Mark-as-read tests.
- `checkInbox` filtering tests.
- MCP authentication tests.
- Claude/Hermes identity and authorization tests.
- Founder nonce cleanup tests.
- Activity authorization tests.
- Activity pagination tests.
- Migration rollback integration tests.

## Frontend
- TypeScript typecheck.
- Production build.
- Theme store tests.
- Theme persistence tests.
- Navigation interaction tests.
- 404 route tests.
- Settings/Profile action tests.
- Coming Soon placeholder tests.
- Chat send/retry tests.
- Conversation history tests.
- Message status tests.
- Dashboard quick action tests.
- Activity page tests.
- Loading, empty, and error states.

## End-to-end

Create or extend an actual E2E test suite. Use Playwright if already available or if adding it is justified and compatible with the repository.

Do not count unit tests or mocked API tests as E2E tests.

Required scenarios:

**Scenario A — Founder to Claude**
1. Founder opens Chat.
2. Claude appears as a valid registered recipient.
3. Founder creates or opens a conversation.
4. Founder sends a message.
5. Message is persisted.
6. Claude retrieves the message through authenticated MCP.
7. Claude processes it and replies.
8. Reply is persisted.
9. Founder receives the reply.
10. Conversation history remains correct after refresh.

**Scenario B — Founder to Hermes**
Repeat the complete flow independently with Hermes.

**Scenario C — Offline agent**
1. Agent is offline.
2. Founder sends a message.
3. Message remains persisted and pending.
4. Agent reconnects.
5. Agent retrieves and replies.
6. Message is not lost or duplicated.

**Scenario D — Failed send**
1. Simulate a network failure.
2. Confirm the user's message text remains available.
3. Retry.
4. Confirm one successful message is persisted.

**Scenario E — Conversation isolation**
1. Create multiple conversations.
2. Add more messages than the pagination limit.
3. Retrieve one conversation.
4. Confirm no cross-conversation contamination.
5. Confirm older messages remain accessible.

**Scenario F — Authorization**
1. Create separate owner contexts.
2. Generate task activity for each.
3. Request activity as each owner.
4. Confirm no unauthorized task audit records leak.

**Scenario G — Frontend usability**
1. Change theme without page reload.
2. Navigate using hover and keyboard focus.
3. Visit an unknown URL and receive a 404 page.
4. Use New Task, Create Division, and Invite Staff.
5. Open View All Activity.
6. Confirm no silently inert controls remain.

If Claude or Hermes runtime access is unavailable, mark the corresponding runtime E2E as BLOCKED. Provide the exact missing dependency and manual verification steps.

Do not fabricate passing tests.

# 10. Security and Regression Guardrails

All previously accepted security decisions remain authoritative.

Preserve:
- Fail-closed production authentication.
- Founder key ownership and signature verification.
- Nonce replay protection.
- Explicit authorization boundaries.
- Local single-user Founder mode only for loopback use.
- No forwarded-IP spoofing.
- No hardcoded production identity fallback.
- No private key exposure to the frontend.
- Existing cross-division authorization.
- Existing migration safeguards.
- Existing append-only audit requirements where applicable.

Do not:
- Weaken authentication to make chat work.
- Allow unauthenticated MCP access.
- Trust client-supplied agent identity.
- Expose messages across unauthorized identities.
- Expose task audit records across owners.
- Remove security tests to make the suite pass.
- Change production permissions without an explicit requirement.

# 11. Documentation and Reports

Update documentation to match actual implementation.

Create or update the following reports in the repository's existing documentation/report structure:

1. `M2_M3_UNIFIED_IMPLEMENTATION_REPORT.md`
2. `M2_CHAT_INTEGRATION_REPORT.md`
3. `M3_UI_COMPLETION_REPORT.md`
4. `SECURITY_REGRESSION_REPORT.md`
5. `DATABASE_ROLLBACK_TEST_REPORT.md`
6. `E2E_VERIFICATION_REPORT.md`
7. `KNOWN_LIMITATIONS.md`

Do not create duplicate documentation if equivalent reports already exist. Update the existing canonical documents instead.

Reports must distinguish:

- Implemented.
- Tested and passing.
- Tested and failing.
- Not tested.
- Blocked by external dependency.
- Deferred.
- Known limitation.

For each issue, include:
- Original finding.
- Root cause.
- Changed files.
- Fix implemented.
- Tests executed.
- Test results.
- Remaining risk.

Update README only where actual usage or configuration has changed.

# 12. Completion Criteria

The unified milestone is ready for Founder review only when:

- [ ] Latest branch and working-tree state inspected.
- [ ] Agent orchestration followed.
- [ ] Maximum five agents used in parallel.
- [ ] No concurrent edits to the same files.
- [ ] Communication identities are consistent.
- [ ] Founder can send and retrieve persistent messages.
- [ ] Claude MCP communication verified where runtime is available.
- [ ] Hermes MCP communication verified where runtime is available.
- [ ] Offline messages remain available.
- [ ] Replies are persisted and displayed correctly.
- [ ] Conversation filtering and pagination work.
- [ ] Mark-as-read works.
- [ ] `checkInbox` behavior is consistent.
- [ ] Failed-send retry works.
- [ ] Message delivery/read states are truthful.
- [ ] Runtime presence is based on actual check-ins.
- [ ] Activity authorization is enforced.
- [ ] Activity ordering and pagination are correct.
- [ ] Activity errors are distinguishable from empty states.
- [ ] Dashboard quick actions work.
- [ ] View All Activity works.
- [ ] Theme has one source of truth.
- [ ] Theme toggle does not reload the page.
- [ ] Navigation hover/focus states work.
- [ ] 404 page works.
- [ ] No silently inert Settings/Profile controls remain.
- [ ] Council and Meetings are visibly marked Coming Soon.
- [ ] Founder nonce cleanup is deterministic.
- [ ] Migration rollback integration tests pass.
- [ ] Backend tests pass.
- [ ] Frontend tests pass.
- [ ] TypeScript typecheck passes.
- [ ] Production build passes.
- [ ] E2E tests pass where dependencies are available.
- [ ] Security regression checks pass.
- [ ] Documentation reflects actual behavior.
- [ ] Independent final audit completed.
- [ ] No unapproved production DB changes.
- [ ] No unapproved Git history rewrite, force-push, merge, or deployment.

A runtime integration test blocked by unavailable external infrastructure must be reported honestly. It must not be marked complete.

# 13. Final Report Format

At completion, provide:

## A. Executive Summary
- Overall result.
- M2 status.
- M3 status.
- Security status.
- Runtime connectivity status.

## B. Agent Execution
- Agent names.
- Assigned tasks.
- Files changed.
- Parallel execution waves.
- Integration work performed.

## C. Implementation Summary
Group changes by:
- Communication and identity.
- MCP and runtime connectivity.
- Chat frontend.
- Dashboard and activity.
- Theme and navigation.
- Security and reliability.
- Database migrations.
- Documentation.

## D. Test Results
Provide exact counts:
- Backend tests.
- Frontend tests.
- E2E tests.
- TypeScript.
- Production build.
- Security tests.
- Migration rollback tests.

Clearly separate actual runtime E2E from mocked or simulated tests.

## E. Finding Closure Matrix
List every numbered finding in this prompt and classify it:
- Fixed and verified.
- Fixed, not independently verified.
- Partially fixed.
- Blocked.
- Deferred.

## F. Remaining Issues
List all outstanding defects and external dependencies.

## G. Git Status
Report:
- Branch.
- Latest commit SHA.
- Working tree status.
- Files changed.
- Whether changes were committed.
- Whether changes were pushed.

Do not commit or push unless separately authorized.

## H. Founder Acceptance

End with a clear statement:

**M2 + M3 implementation is submitted for Founder review.**

Do not declare M2 or M3 formally accepted. Acceptance requires explicit Founder approval.

---

# Final Instruction

Execute this as one coordinated M2 + M3 completion milestone.

Use the existing agent ecosystem under `C:\Users\L\.claude\agents`. Maximum five parallel agents. Enforce exclusive file ownership and controlled integration.

Prioritize functional correctness, data integrity, security, and real runtime verification over adding features or polishing superficial UI.

Do not skip a finding because it is inconvenient. Do not report unverified work as complete. Do not modify production data or perform destructive Git operations.

Begin with Wave 0 and proceed through all waves until the implementation is ready for Founder review.