# COUNCIL BRIDGE — UNIFIED CRITICAL REMEDIATION & COMMAND CENTER MILESTONE

**Repository:** `https://github.com/snowep/council-bridge`  
**Local project:** `C:\Projects\council-bridge`  
**Branch:** `refactor/repository-structure`  
**MCP port:** `3334`  
**Claude Code agents:** `C:\Users\L\.claude\agents`

**Mission:** Complete M2/M3 remediation, resolve database and identity inconsistencies, eliminate critical security and data-integrity defects, and deliver a polished, functional Material UI command center.

This is an implementation assignment. Do not return another planning-only document.

---

# 1. EXECUTION AUTHORITY AND OBJECTIVES

Implement all requirements in this prompt in one coordinated milestone.

The work must include:

1. Resolve database integrity and organization-count inconsistencies.
2. Correct agent, Council, division, Division Head, and specialist identity relationships.
3. Complete M2 Chat integration and message lifecycle.
4. Fix message ordering and conversation navigation.
5. Complete M3 Dashboard functionality.
6. Correct theme architecture and frontend navigation.
7. Fix all confirmed critical backend and frontend defects.
8. Improve the UI using vanilla MUI and Google's Material Design system.
9. Run mandatory backend and frontend audits.
10. Inspect browser console, runtime errors, network failures, and frontend behavior.
11. Complete regression, security, and integration testing.
12. Use dedicated Claude Code agents for implementation and Git management.
13. Produce a complete final audit and implementation report.

Do not introduce unrelated features.

Do not redesign functioning architecture unnecessarily.

Prioritize data integrity, security, operational correctness, usability, and maintainability.

# 2. MANDATORY CLAUDE CODE AGENT ORCHESTRATION

You MUST use the agent definitions located at:

`C:\Users\L\.claude\agents`

Do not implement the entire milestone in one agent.

## 2.1 Agent discovery

Before implementation:

1. Inspect all available agent definitions.
2. Identify agents suitable for backend, frontend, database, testing, auditing, and Git operations.
3. Read their actual instructions.
4. Assign responsibilities based on their documented capabilities.
5. Report which agents were selected.

If a suitable agent does not exist, report the limitation. Do not pretend it was used.

## 2.2 Maximum parallelism

**Maximum five agents running in parallel.**

The main Claude Code session is the coordinator and final integration owner.

Required assignments:

| Agent | Responsibility |
|---|---|
| Agent 1 | Database reconciliation, identity integrity, migrations |
| Agent 2 | Backend communication, MCP, messaging, authorization, security |
| Agent 3 | Frontend architecture, MUI command center, theme, navigation |
| Agent 4 | Chat frontend, dashboard workflows, browser and E2E testing |
| Agent 5 | Dedicated Git branch and commit management |

The main coordinator owns cross-module integration, shared contracts, final verification, and conflict resolution.

If the available agent definitions suggest a better division, adapt the allocation while preserving all responsibilities.

## 2.3 Git agent — mandatory

A dedicated agent from `C:\Users\L\.claude\agents` MUST manage Git operations.

Its responsibilities:

- Inspect current branch and remote state.
- Track implementation branches if needed.
- Check for conflicts and unexpected modifications.
- Review commit scope.
- Propose clear, conventional commit messages.
- Maintain commit organization.
- Report commit SHAs and push status.
- Coordinate with the main agent before any Git operation that could affect shared work.

The Git agent must not independently authorize destructive operations.

Do not force-push, rewrite history, merge, deploy, or delete branches without explicit Founder approval.

Do not commit or push until explicitly authorized.

## 2.4 File ownership

Before parallel implementation, establish an explicit file ownership matrix.

Rules:

- Every modified file has exactly one active owner.
- Two agents must NEVER edit the same file simultaneously.
- Agents may inspect other agents' files but cannot modify them.
- Shared types, API contracts, application routing, and integration files have one designated owner.
- If shared changes are necessary, coordinate and perform them sequentially.
- Pause dependent work before changing a shared contract.
- Do not solve merge conflicts by discarding another agent's changes.

## 2.5 Execution waves

**Wave 0 — Repository and environment audit**

- Inspect latest branch SHA.
- Inspect working tree and uncommitted changes.
- Inspect all project instructions.
- Inspect available agents.
- Inspect existing database files and migration state without modifying production data.
- Establish test baselines.
- Establish exclusive file ownership.

**Wave 1 — Independent implementation**

Start no more than five agents in parallel.

**Wave 2 — Controlled integration**

Integrate changes, resolve shared contracts, fix type errors, and run regression tests.

**Wave 3 — Design and runtime verification**

Run frontend audits, browser tests, console inspection, and backend audits.

**Wave 4 — Independent final audit**

Have independent agents review the completed implementation. Fix all critical and high-priority findings.

# 3. REPOSITORY SAFETY RULES

Before changing anything:

1. Inspect `git status`.
2. Confirm current branch and latest commit.
3. Identify uncommitted user changes.
4. Preserve all user changes.
5. Inspect the actual current database schema.
6. Identify the production database path.
7. Identify migration history and applied migrations.
8. Establish a verified backup strategy.
9. Record baseline test results.

Never:

- Reset or clean the working tree destructively.
- Discard uncommitted changes.
- Delete records merely because they resemble test data.
- Modify production data without explicit authorization.
- Run experimental migrations against production.
- Rewrite Git history.
- Force-push.
- Merge.
- Deploy.
- Remove authentication or authorization checks.
- Expose Founder private keys.
- Add Redis without demonstrated necessity.

**Important:** Database analysis and remediation planning are authorized. Production database mutation is not automatically authorized.

Implement migration and cleanup logic in code and verify it against isolated database copies. Stop before applying destructive or irreversible changes to the production database.

# 4. DATABASE RECONCILIATION — HIGHEST PRIORITY

The previous committed database audit identified major inconsistencies.

These are historical snapshot values and MUST be revalidated against the actual current database before any remediation.

## 4.1 Canonical organization model

The canonical organization is:

| Entity | Expected count |
|---|---:|
| Council seats | 11 |
| Permanent Council seats | 4 |
| Vacant Council seats | 7 |
| Founding Council personas | 4 |
| Council runtime mappings | 8 |
| Divisions | 6 |
| Division Heads | 6 |
| Specialists | 45 |
| Total staff identities | 51 |
| Division memberships | 51 |
| Staff runtime mappings | 102 |
| Canonical organizational identities | 62 |

The six divisions are:

1. Developer
2. Marketing
3. Finance
4. Creative
5. Research & Intelligence
6. Business Operations

The four permanent founding Council personas are:

- Steve Jobs
- Virgil Abloh
- Shawn Stüssy
- G-Dragon

The Founder is a separate human authority, not an additional Council voting seat.

Division Heads and specialists are not Council voting members.

Preserve the distinction between:
- Human Founder.
- Council seats.
- Council personas.
- Runtime instances.
- Division Heads.
- Specialists.
- Communication identities.

## 4.2 Previously identified database contamination

The historical database audit reported:

| Table | Historical total | Canonical expected |
|---|---:|---:|
| divisions | 5,427 | 6 |
| staff_agents | 6,925 | 51 |
| division_members | 5,529 | 51 |
| staff_runtime_personas | 938 | 102 |
| agents | 160 | Approximately 11 |
| council_seats | 11 | 11 |
| personas | 4 | 4 |
| runtime_personas | 8 | 8 |
| quality_thresholds | 155 | 1 canonical global configuration |

The previous audit also identified:

- 4,367 invalid `division_members.role` values containing timestamps.
- 70 unresolved division-head references.
- 3 task assignments using `founder` as a staff identity.
- 154 noncanonical quality-threshold records.
- Potential test-generated records persisted in core organization tables.

Do not blindly enforce the expected counts by deleting everything beyond them.

First establish which records are:
- Canonical.
- Legitimate operational records.
- Historical records.
- Test fixtures.
- Orphaned records.
- Duplicate identities.
- Invalid relationships.

## 4.3 Required database audit

Produce a fresh, read-only database integrity report.

Inspect at minimum:

- `agents`
- `council_seats`
- `personas`
- `runtime_personas`
- `divisions`
- `staff_agents`
- `division_members`
- `staff_runtime_personas`
- `tasks`
- `task_audit`
- `messages`
- `conversations`, if present
- `quality_thresholds`
- `task_autonomy_levels`
- `deliverables`
- `deliverable_versions`
- `migration_ledger`
- `founder_nonces`

For each table, report:

- Actual row count.
- Expected canonical count where applicable.
- Duplicate primary or logical identities.
- Invalid references.
- Orphan records.
- Invalid enum/role values.
- Test-like records.
- Missing relationships.
- Runtime mappings.
- Status distribution.

Verify all declared foreign keys using SQLite integrity checks.

Also verify logical relationships that are not protected by foreign keys.

## 4.4 Canonical identity invariants

Enforce these invariants in application logic and database constraints where appropriate:

1. Exactly six canonical divisions.
2. Exactly six active Division Heads.
3. Exactly 45 canonical specialists.
4. Exactly 51 canonical staff identities.
5. Exactly 51 canonical division memberships.
6. Each staff identity belongs to the correct division.
7. Every Division Head reference resolves to the correct active staff member.
8. No specialist is accidentally classified as a Council voting member.
9. No Division Head is accidentally classified as a Council voting member.
10. Every canonical staff identity has one Claude and one Hermes runtime mapping.
11. Council seats and personas are not duplicated by runtime instance.
12. Founder remains separate from Council voting seats.
13. Communication identities resolve to the correct canonical organization identities.

Do not use display names as primary identity keys.

Use stable IDs and explicit mapping relationships.

## 4.5 Repair invalid references

Investigate and resolve:

- Invalid division membership roles.
- Unresolved division-head references.
- Invalid task staff assignees.
- Duplicate identities.
- Orphaned runtime mappings.
- Communication identities not synchronized with staff and divisions.

Do not replace invalid values with arbitrary defaults without understanding their original meaning.

Where a record cannot be safely mapped, quarantine it or produce a proposed repair requiring Founder approval.

## 4.6 Cleanup and preservation

Implement a safe reconciliation strategy.

Requirements:

- Preserve existing legitimate tasks, messages, deliverables, memory, audit logs, and operational records.
- Never delete canonical records.
- Do not delete historical records without evidence and explicit approval.
- Use backups and transactional migrations.
- Produce before/after count reports.
- Produce a rollback plan.
- Maintain migration checksums.
- Record all applied changes.
- Verify referential integrity after every migration.

If safe automated cleanup cannot be proven, leave the records untouched and provide a precise cleanup manifest for approval.

# 5. COMMUNICATION IDENTITY REGISTRY

**Priority: P0**

Previous audit found that the communication `agents` registry and organization tables are not reliably synchronized.

The Chat UI can show staff or divisions that the messaging service cannot resolve.

Fix this properly.

Requirements:

1. Define the authoritative identity registry.
2. Establish deterministic mappings between organization identities and communication identities.
3. Register Founder through the established bootstrap process.
4. Register Claude and Hermes runtime identities.
5. Support Council persona runtime mappings.
6. Support Division Head and specialist runtime identities.
7. Ensure registration is idempotent.
8. Prevent duplicate identities.
9. Preserve stable IDs.
10. Never grant permissions merely because an identity was synchronized.
11. Enforce authenticated identity ownership.
12. Verify synchronization on application startup and relevant organization changes.
13. Handle failed synchronization visibly.
14. Do not silently swallow identity registration errors.

Add tests for:
- Fresh database initialization.
- Application restart.
- Duplicate registration.
- Staff registration.
- Division registration.
- Runtime mapping.
- Missing identities.
- Unknown recipients.
- Unauthorized senders.
- Identity consistency.

The communication registry must not become a second, conflicting source of truth.

# 6. M2 — CHAT AND MCP REMEDIATION

## 6.1 Correct conversation participant SQL

**Priority: P0**

The previous audit found incorrect conversation participant filtering in `src/communication/messages.ts`.

The current logical predicate can exclude messages in one direction.

Implement correct two-direction participant-pair filtering.

For a conversation between A and B, retrieve:

- A → B
- B → A

Do not return unrelated messages.

Apply the same logic consistently to:
- REST conversation retrieval.
- MCP history retrieval.
- Inbox retrieval.
- Unread counts.
- Read-state updates.

Add regression tests for both message directions.

## 6.2 Message identity contract

**Priority: P1**

The backend uses `id`, while the frontend expects `message_id`.

Establish one canonical API contract.

Requirements:
- Consistent identifier naming.
- Consistent REST and MCP response structures.
- Stable React keys.
- Correct optimistic message replacement.
- No duplicate messages after polling.
- No frontend/backend type mismatch.

Update shared types and tests.

## 6.3 Message ordering — explicit Founder requirement

**Priority: P0**

The Founder reported that Chat messages appear backwards.

Correct the message timeline.

Required behavior:

1. Oldest message appears at the top.
2. Newest message appears at the bottom.
3. New outgoing messages append at the bottom.
4. Incoming messages appear in correct chronological position.
5. Refresh preserves chronological order.
6. Pagination loads older messages without reversing the timeline.
7. Optimistic messages appear in the correct position.
8. Failed messages remain in their correct chronological position.
9. Retry does not duplicate or reorder messages.
10. Scroll behavior is correct.

When opening a conversation:
- Load the latest messages.
- Position the viewport at the bottom.
- Preserve chronological order.

When older messages are loaded:
- Preserve the user's viewport position.
- Do not jump to the bottom unexpectedly.

When a new message arrives:
- Scroll to the bottom only if the user was already near the bottom.
- Otherwise show a new-message indicator.

Use appropriate flexbox, MUI layout, and scroll behavior.

Do not reverse the backend array simply to hide a database ordering problem.

Verify the actual browser DOM order and rendered behavior.

## 6.4 Conversation sidebar ordering

New conversations should appear at the top of the conversation sidebar.

Requirements:
- Most recently active conversation first.
- Preview reflects the latest message.
- Last activity timestamp is correct.
- Empty new conversations behave predictably.
- Message polling updates the correct conversation.
- No arbitrary global 500-message cap determines conversation ordering.

The conversation sidebar and the message timeline have different ordering rules. Implement them separately.

## 6.5 Database-level pagination

Previous audit found pagination occurring after message retrieval.

Fix this.

Requirements:
- Conversation filtering in SQL.
- Stable chronological ordering.
- Database-level pagination.
- Consistent limit and cursor/offset semantics.
- Accurate pagination metadata.
- Unread filters applied before pagination.
- No cross-conversation contamination.
- No arbitrary global cap that hides older conversations.

Add tests with several conversations and more messages than the page size.

## 6.6 Mark-as-read

Fix the previously identified SQL parameter-order mismatch.

Requirements:
- Only intended recipient messages are marked read.
- Only the intended conversation is affected.
- Correct unread counts.
- Idempotent updates.
- REST and MCP behavior consistent.

## 6.7 checkInbox

Define predictable behavior for optional `conversationId`.

- Supplied ID: strictly filter to that conversation.
- Omitted ID: return the documented inbox scope.
- MCP and REST must agree.
- Add tests for both behaviors.

## 6.8 Failed-send and retry lifecycle

Fix the failed-send implementation.

Requirements:
- Preserve text until server confirmation.
- Display pending state.
- Display failed state.
- Allow retry.
- Preserve the original conversation.
- Prevent duplicate submissions.
- Update message history after successful retry.
- Update conversation preview and timestamp.
- Remove failed state only after successful persistence.
- Handle network failure without data loss.

## 6.9 Delivery and read states

Distinguish actual states:

- Pending: persisted but not retrieved by the target agent.
- Retrieved: target agent retrieved it.
- Replied: response persisted.
- Failed: a known failure occurred.

Read status is separate.

Do not claim that retrieval proves the agent processed the message.

## 6.10 Claude and Hermes runtime

Verify actual authenticated MCP connectivity.

Test independently:

- Claude Code.
- Hermes Agent.

Required workflow:

Founder sends → database persists → target agent retrieves → agent processes → agent replies → reply persists → Founder receives reply → history survives refresh.

Also test offline behavior and reconnect.

If a runtime is unavailable:
- Mark its E2E test BLOCKED.
- Document the missing dependency.
- Provide manual verification instructions.
- Do not report mocked tests as real runtime success.

# 7. BACKEND SECURITY AND RELIABILITY

## 7.1 Cross-division memory authorization

**Priority: P0**

Previous audit found a query that includes cross-division activity without filtering against the authenticated user's authorized division.

Fix the authorization boundary in `src/council/memory.ts`.

Requirements:

1. Inspect the actual permission model.
2. Resolve authenticated owner type and owner ID.
3. Restrict cross-division activity to explicitly authorized shares.
4. Verify ownership and access scope.
5. Prevent unrelated divisions from seeing activity.
6. Preserve Founder access according to existing rules.
7. Add multi-user and multi-division security tests.
8. Verify no unauthorized metadata leaks through pagination or counts.

Do not invent new access rules.

## 7.2 Activity feed correctness

Fix:
- Incomplete source merging.
- Pagination errors.
- Incorrect global ordering.
- Authorization inconsistency.
- Silent backend errors.

The frontend must distinguish:
- Loading.
- Successful empty result.
- Successful populated result.
- Failed request.

Add retry.

Do not convert errors into empty success states.

## 7.3 Founder nonce cleanup

Replace probabilistic cleanup with deterministic scheduling.

Requirements:
- One cleanup scheduler.
- No duplicate timers.
- Correct startup/shutdown lifecycle.
- Test cleanup and expiration.
- Preserve replay protection.
- Do not weaken authentication.

## 7.4 Migration rollback

**Priority: P0 — Data integrity**

The previous audit found hardcoded production database restoration behavior in `src/migration-runner/rollback.ts`.

Correct it.

Requirements:

1. Rollback must target the database instance supplied to the migration runner.
2. Never hardcode `data/council.db` as the destination.
3. Isolate production and test database paths.
4. Verify backup identity and target identity.
5. Preserve checksums and migration ledger.
6. Handle failure safely.
7. Do not claim file restoration is transactionally protected by SQLite transactions.
8. Implement a verified recovery strategy.
9. Add isolated integration tests.

Test:
- Apply migration.
- Verify schema.
- Insert test data.
- Roll back.
- Verify schema restoration.
- Verify data integrity.
- Verify ledger state.
- Simulate failed rollback.
- Verify recovery.

Never run rollback tests against production.

## 7.5 Authentication and security regression

Preserve all accepted Phase 8 security rules:

- Production authentication fails closed.
- No hardcoded identity fallback.
- Founder key ownership and signature verification.
- Nonce replay protection.
- Local single-user mode restricted to loopback.
- No forwarded-IP spoofing.
- No browser exposure of private keys.
- Explicit cross-division permissions.
- Authorization on all relevant message, task, and memory routes.

Do not weaken security to make the application work.

# 8. M3 — DASHBOARD FUNCTIONALITY

## 8.1 Dashboard quick actions

Implement real workflows.

**New Task**
- Opens actual task creation.
- Supports validation.
- Persists through the backend.
- Shows success/error feedback.

**Create Division**
- Opens actual division creation.
- Uses existing permissions.
- Persists through the backend.
- Does not create duplicate divisions.

**Invite Staff**
- Opens the supported staff registration/onboarding workflow.
- Registers the identity correctly.
- Synchronizes communication identity.
- Shows validation and error states.

No silently inert buttons.

If a feature cannot be implemented safely, disable it and mark it Coming Soon.

## 8.2 Activity page

Implement and register `/activity`.

Requirements:
- Correct authorization.
- Correct pagination.
- Loading, empty, and error states.
- Retry.
- Working Dashboard navigation.
- Correct ordering.

## 8.3 Dashboard statistics

Use real backend values.

Display accurate counts for:
- Total staff agents.
- Division Heads.
- Specialists.
- Divisions.
- Council seats.
- Permanent Council members.
- Vacant Council seats.
- Runtime agents.
- Online/offline agents, where supported by actual presence signals.

Avoid double-counting runtime instances as logical staff identities.

Clearly distinguish:
- Logical identities.
- Runtime instances.
- Council seats.
- Communication agents.

All statistics must agree with the canonical database and API responses.

## 8.4 Agent and organization management

Review the Organization page and relevant dashboard views.

The UI must accurately represent:
- 11 Council seats.
- 4 permanent founding personas.
- 7 vacant seats.
- 6 divisions.
- 6 Division Heads.
- 45 specialists.
- 51 staff identities.
- 102 staff runtime mappings.

Do not show inflated counts from test records as legitimate organizational totals.

Where noncanonical records remain, distinguish them from canonical operational records.

# 9. FRONTEND DESIGN — STRICT DESIGN DIRECTION

**This section is mandatory.**

The application must use vanilla MUI components and Google's Material Design system.

## 9.1 Design reference

Inspect and use the installed:

`design-taste-frontend` skill.

Read its complete instructions and relevant reference files before redesigning or polishing the interface.

Also use the official MUI components and APIs already installed in the project.

## 9.2 Design philosophy

The UI must feel like a professional command center / control panel.

Visual direction:
- Clean.
- Structured.
- Information-dense but readable.
- Functional.
- Calm.
- Precise.
- Consistent.
- Operational.

Avoid:
- Generic AI dashboard design.
- Excessive gradients.
- Glowing borders.
- Glassmorphism used decoratively.
- Oversized hero sections.
- Decorative blobs.
- Excessive rounded cards.
- Random colorful accents.
- Unnecessary animations.
- Decorative charts without operational meaning.
- Large empty spaces.
- Unnecessary visual effects.
- Generic AI-generated design patterns.

Do not make the UI look like a marketing landing page.

## 9.3 Vanilla MUI requirement

Prefer official MUI components:

- AppBar.
- Drawer.
- Toolbar.
- Box.
- Stack.
- Grid.
- Paper.
- Card.
- CardContent.
- Typography.
- Button.
- IconButton.
- Chip.
- Badge.
- Avatar.
- List.
- ListItem.
- Tabs.
- Table.
- Dialog.
- Menu.
- Tooltip.
- Snackbar.
- Alert.
- LinearProgress.
- CircularProgress.
- Divider.
- Skeleton.

Use existing MUI theme tokens and component APIs.

Do not introduce a parallel styling system.

**Extra CSS is allowed only when genuinely necessary.**

Before writing custom CSS, determine whether MUI `sx`, theme overrides, or existing components can achieve the result.

Do not install additional UI libraries without demonstrating a real need.

## 9.4 Command center structure

Review the existing application shell and organize information around operational tasks.

Suggested hierarchy:

**Primary navigation**
- Dashboard.
- Chat.
- Organization.
- Tasks.
- Deliverables.
- Activity.

**Deferred navigation**
- Council — Coming Soon if still incomplete.
- Meetings — Coming Soon if still incomplete.

**Dashboard**
- Organization overview.
- Agent/runtime status.
- Active tasks.
- Pending approvals.
- Recent activity.
- Operational alerts.
- Quick actions.

Do not create redundant dashboard widgets.

Use compact layouts and consistent spacing.

## 9.5 Theme architecture

Create one authoritative theme store.

Preferred:
- Existing Zustand, if installed and appropriate.
- Otherwise React Context.

Requirements:
- One source of truth.
- Shared by App and Layout.
- One localStorage owner.
- No full page reload.
- Immediate theme update.
- Light and dark themes.
- Preserve MUI design tokens.
- Correct initialization.
- Correct subscription cleanup.

Remove duplicate state and direct localStorage logic from components.

## 9.6 Navigation and accessibility

Fix:
- Invalid nested CSS in inline styles.
- Hover states.
- Keyboard focus.
- Active route.
- Light/dark contrast.
- Responsive drawer behavior.

Use MUI `sx` or `styled()` correctly.

## 9.7 404 and placeholder pages

Add a real 404 page with a Dashboard link.

Settings/Profile:
- Implement if supported.
- Otherwise remove or disable with Coming Soon.

Council/Meetings:
- Clearly show Coming Soon.
- Do not present incomplete pages as finished.

# 10. FRONTEND RUNTIME AND CONSOLE AUDIT

This is mandatory.

Do not rely exclusively on TypeScript compilation or production builds.

Run the application in a browser using the available development/test environment.

Inspect:

1. Browser console errors.
2. Browser console warnings.
3. React warnings.
4. React key warnings.
5. MUI warnings.
6. Failed network requests.
7. HTTP 4xx/5xx responses.
8. Failed asset loads.
9. Unhandled promise rejections.
10. Runtime exceptions.
11. Infinite or excessive re-rendering.
12. Broken route transitions.
13. Theme initialization errors.
14. Scroll and layout errors.
15. Dialog and form interaction failures.

Fix errors caused by the application.

Do not suppress errors simply to produce a clean console.

Distinguish:
- Actual application errors.
- Expected development warnings.
- External runtime failures.
- Browser/tooling limitations.

## Browser workflow verification

Test at minimum:

- Dashboard loading.
- Chat open and conversation selection.
- Message send.
- Message retry.
- Chronological message ordering.
- Scroll-to-bottom behavior.
- Loading older messages.
- Conversation sidebar ordering.
- Theme toggle without reload.
- Organization page.
- Create Division.
- Invite Staff.
- New Task.
- Activity page.
- 404 route.
- Council/Meetings placeholders.
- Light and dark mode.
- Responsive layout.

Capture console errors and failed requests in the final report.

# 11. MANDATORY AUDIT TOOLS

Run both audits. These are required deliverables, not optional suggestions.

## 11.1 Ponytail — Backend

Use the available Ponytail skill/tool.

Run a full backend audit covering:

- Architecture.
- Security.
- Authentication.
- Authorization.
- Database integrity.
- Query correctness.
- Transactions.
- Migration safety.
- Error handling.
- API contracts.
- MCP implementation.
- Performance.
- Reliability.
- Test coverage.
- TypeScript quality.
- Dependency risks.

Fix all critical and high findings.

Do not suppress findings without documenting why.

Produce:

`docs/audits/remediation/PONYTAIL_BACKEND_AUDIT.md`

## 11.2 Impeccable — Frontend

Use the available Impeccable skill/tool.

Run a full frontend audit covering:

- Design consistency.
- Material Design compliance.
- MUI usage.
- Visual hierarchy.
- Layout.
- Typography.
- Spacing.
- Color.
- Accessibility.
- Responsive behavior.
- Interaction states.
- Empty/loading/error states.
- Forms.
- Navigation.
- Component consistency.
- CSS quality.
- Console errors.
- Runtime behavior.

Fix all critical and high findings.

Produce:

`docs/audits/remediation/IMPECCABLE_FRONTEND_AUDIT.md`

If either audit tool is unavailable, report the exact limitation. Do not substitute a self-written checklist and claim the official audit ran.

# 12. TESTING REQUIREMENTS

Run the complete available test suites.

## Backend

- Full existing backend suite.
- Communication identity tests.
- Message participant filtering tests.
- Conversation history tests.
- Pagination tests.
- Read-state tests.
- Inbox filtering tests.
- MCP authentication tests.
- Claude/Hermes identity tests.
- Cross-division authorization tests.
- Activity authorization tests.
- Nonce cleanup tests.
- Migration rollback tests.
- Database reconciliation tests.
- API contract tests.

## Frontend

- TypeScript typecheck.
- Full frontend unit/component suite.
- Production build.
- Theme tests.
- Navigation tests.
- Chat timeline tests.
- Optimistic send tests.
- Retry tests.
- Conversation ordering tests.
- Activity tests.
- Quick action tests.
- Organization statistics tests.
- Error/empty/loading state tests.
- Accessibility checks.

## E2E

Use the existing Playwright setup if available. Otherwise assess whether adding it is justified.

Required real workflows:

### A. Founder → Claude
Send, retrieve through authenticated MCP, reply, persist, display, refresh.

### B. Founder → Hermes
Repeat independently.

### C. Offline agent
Send while offline, reconnect, retrieve, reply, verify no data loss.

### D. Chat ordering
Send multiple messages in both directions, refresh, load older messages, and verify correct chronological order and scroll position.

### E. Database identity
Verify all canonical counts and identity mappings against the actual database.

### F. Authorization
Use separate owners and divisions. Verify no unauthorized messages, tasks, or memory activity leak.

### G. Dashboard
Exercise all quick actions and activity navigation.

### H. Theme and navigation
Verify no reload, correct focus/hover/active states, and 404 behavior.

### I. Browser console
Verify no unexplained application runtime errors or failed requests.

Never count mocked tests as real runtime E2E.

If external runtimes are unavailable, mark the relevant test BLOCKED.

# 13. REGRESSION AND COMPLETION REQUIREMENTS

The following must be true before submitting the milestone:

- [ ] Current repository and database state inspected.
- [ ] Agent orchestration completed.
- [ ] Maximum five agents in parallel.
- [ ] Dedicated Git agent used.
- [ ] No concurrent file edits.
- [ ] Canonical organization counts verified.
- [ ] Database integrity verified.
- [ ] Invalid references identified and safely addressed.
- [ ] Communication identity registry synchronized.
- [ ] Founder identity correctly separated from Council seats.
- [ ] Chat conversation SQL fixed.
- [ ] Message ID contract consistent.
- [ ] Newest message appears at bottom.
- [ ] Conversation sidebar newest-first.
- [ ] Scroll behavior verified.
- [ ] Database-level message pagination works.
- [ ] Read receipts work.
- [ ] Inbox filtering works.
- [ ] Failed-send retry works.
- [ ] Delivery states are truthful.
- [ ] Claude runtime tested or explicitly blocked.
- [ ] Hermes runtime tested or explicitly blocked.
- [ ] Cross-division authorization fixed.
- [ ] Activity pagination and ordering correct.
- [ ] Dashboard quick actions functional.
- [ ] Activity page functional.
- [ ] Dashboard counts correct.
- [ ] Migration rollback target corrected.
- [ ] Rollback integration tests pass.
- [ ] Founder nonce cleanup deterministic.
- [ ] MUI theme has one source of truth.
- [ ] No page reload for theme changes.
- [ ] Navigation states accessible.
- [ ] 404 works.
- [ ] No silently inert controls.
- [ ] Council/Meetings correctly labeled.
- [ ] Vanilla MUI design direction followed.
- [ ] `design-taste-frontend` consulted.
- [ ] Ponytail backend audit completed.
- [ ] Impeccable frontend audit completed.
- [ ] Browser console inspected.
- [ ] Runtime/network errors inspected.
- [ ] Backend tests pass.
- [ ] Frontend tests pass.
- [ ] TypeScript passes.
- [ ] Production build passes.
- [ ] E2E results documented.
- [ ] Security regression passes.
- [ ] Documentation updated.
- [ ] Independent final audit completed.

# 14. REQUIRED DOCUMENTATION

Use the existing documentation structure. Do not create duplicate reports if canonical equivalents already exist.

Create or update:

1. `UNIFIED_REMEDIATION_REPORT.md`
2. `DATABASE_RECONCILIATION_REPORT.md`
3. `IDENTITY_REGISTRY_REPORT.md`
4. `M2_CHAT_REMEDIATION_REPORT.md`
5. `M3_COMMAND_CENTER_REPORT.md`
6. `PONYTAIL_BACKEND_AUDIT.md`
7. `IMPECCABLE_FRONTEND_AUDIT.md`
8. `BROWSER_CONSOLE_AUDIT.md`
9. `MIGRATION_ROLLBACK_VERIFICATION.md`
10. `E2E_VERIFICATION_REPORT.md`
11. `KNOWN_LIMITATIONS.md`

For each finding, record:
- Finding ID.
- Original issue.
- Severity.
- Root cause.
- Files changed.
- Fix.
- Tests.
- Verification evidence.
- Remaining risks.

Update previous M2/M3 reports so their status reflects the actual latest implementation.

# 15. FINAL REPORT

Submit the final report in this exact structure.

## A. Executive Summary
- Overall result.
- Critical issues resolved.
- M2 status.
- M3 status.
- Database status.
- Security status.
- UI status.

## B. Agent Execution
- Agent names.
- Agent definitions used.
- Responsibilities.
- Files owned.
- Parallel execution waves.
- Git management agent activity.

## C. Database Reconciliation
- Before counts.
- Canonical counts.
- After counts.
- Invalid records.
- Repaired relationships.
- Preserved records.
- Records awaiting Founder approval.

## D. Communication and Chat
- Identity synchronization.
- MCP connectivity.
- Message persistence.
- Conversation filtering.
- Pagination.
- Read state.
- Retry.
- Delivery states.
- Message ordering and scroll verification.

## E. Frontend and Design
- MUI implementation.
- Material Design compliance.
- Command center layout.
- Theme architecture.
- Navigation.
- Dashboard.
- Organization management.
- Accessibility.
- Responsive verification.

## F. Audit Results
- Ponytail findings and closure.
- Impeccable findings and closure.
- Console errors.
- Runtime errors.
- Network errors.

## G. Testing
Provide exact numbers:
- Backend tests passed/failed.
- Frontend tests passed/failed.
- E2E passed/failed/blocked.
- Security tests.
- Database tests.
- Migration rollback tests.
- TypeScript.
- Production build.

## H. Remaining Issues
List all blocked, deferred, or unresolved issues.

## I. Git Report
- Branch.
- Latest SHA.
- Commits.
- Working tree.
- Push status.
- Git agent actions.

## J. Founder Acceptance

End with:

**Unified remediation milestone submitted for Founder review.**

Do not mark M2/M3 or the unified remediation milestone formally accepted. Only the Founder can accept it.

---

# FINAL EXECUTION DIRECTIVE

Execute every requirement in this prompt.

Do not stop after producing a plan.

Do not skip the database reconciliation.

Do not skip Ponytail.

Do not skip Impeccable.

Do not skip browser console inspection.

Do not substitute mock tests for actual runtime verification.

Do not introduce a new visual design system. Use vanilla MUI and Google's Material Design system.

Do not use more than five parallel agents.

Use a dedicated Git-management agent from `C:\Users\L\.claude\agents`.

Do not allow agents to modify the same files concurrently.

Preserve user data and existing functionality.

Fix critical issues before polishing low-priority details.

If an action requires production database mutation, destructive Git operations, or deployment, stop and request explicit Founder authorization.

Begin with Wave 0. Continue through implementation, integration, testing, audits, and final reporting.