# Council Bridge — M2/M3 Final Verification, Critical Remediation & Repository Hardening

## 1. Role

Act as the Principal Software Architect, Senior Backend Engineer, Security Engineer, Database Engineer, Frontend Architect, and QA Lead for Council Bridge.

Your task is to complete the outstanding M2/M3 remediation, resolve the newly identified repository issues, verify the implementation, and prepare a final Founder review report.

This is an implementation and verification task, not merely an audit.

Work directly in the existing repository. Preserve established architecture, existing user data, security invariants, and accepted phases.

## 2. Repository Context

Repository: `snowep/council-bridge`

Current branch: `refactor/repository-structure`

Latest reported commit: `02d8150`

Before changing anything:

1. Verify the current branch and HEAD commit.
2. Confirm the working tree state.
3. Inspect commits since the previous verified baseline.
4. Read the existing project documentation and current M2/M3 reports.
5. Inspect the actual source code rather than trusting historical reports.
6. Identify whether the working tree contains user changes or generated artifacts.
7. Do not overwrite or discard existing changes.

### What this repository does

Council Bridge is an MCP server and REST API for structured multi-agent collaboration.

It provides:
- Message bus and agent communication.
- Council meetings and governance.
- Task delegation and execution.
- Approval workflows.
- Memory and knowledge management.
- Founder-signed authorization for privileged operations.

### Backend

- Express 5.
- MCP SDK 1.32.
- SQLite using `better-sqlite3`.
- SQLite WAL mode.
- Session-based authentication with JWT-style tokens.
- Founder Ed25519 signature verification for privileged operations.
- Local single-user Founder mode restricted to loopback connections.

### Frontend

- React 19.
- Vite.
- MUI 9.
- Separate `frontend/` package.

### Operating assumptions

- Default mode: single-user local development.
- Default bind address: `127.0.0.1`.
- Production requires an explicit persistent database path and Founder keys.
- Production authentication must remain fail-closed.

Do not introduce Redis, additional infrastructure, or unnecessary dependencies.

---

# 3. Non-Negotiable Rules

## Security

- Never weaken production authentication to make tests pass.
- Never introduce hardcoded Founder identity fallbacks.
- Never expose Founder private keys to the browser or repository.
- Never bypass Founder Ed25519 signature verification.
- Never allow forwarded-IP spoofing to bypass loopback restrictions.
- Never trust client-provided identity without server-side validation.
- Never weaken authorization to make MCP tests pass.
- Keep local single-user mode isolated from production mode.
- Preserve nonce replay protection and Founder key ownership validation.

## Database

- Never delete production records to force canonical counts.
- Never run database cleanup or bootstrap operations without explicit Founder authorization.
- Never modify the production database as part of this task.
- Never execute unapproved migrations against production.
- Preserve existing data.
- Use isolated temporary databases for tests.
- Maintain migration checksums and dependency validation.
- Preserve migration backups and recovery guarantees.

## Git

- Do not commit.
- Do not push.
- Do not merge.
- Do not deploy.
- Do not force-push.
- Do not rewrite shared Git history.
- Do not reset or discard user changes.

Prepare commit recommendations only. Wait for explicit authorization.

## Project governance

- Phases 1–8 are formally accepted.
- Phase 9 implementation is reported complete but formal acceptance remains pending.
- Phase 10 is formally accepted.
- M2/M3 implementation is reported complete but formal acceptance remains pending.
- Do not mark M2/M3 accepted.
- Do not change the formal acceptance status of any phase.

---

# 4. Execution Strategy

Use the available Claude Code agents.

Maximum parallel agents: 5.

Use strict file ownership. Two agents must never edit the same file simultaneously.

Before starting parallel work:

1. Read agent definitions in `C:\Users\L\.claude\agents`.
2. Select agents based on their actual capabilities.
3. Assign explicit file and directory ownership.
4. Define integration dependencies.
5. Establish a shared findings and handoff format.
6. Use a dedicated Git agent from that directory for branch inspection and commit-message recommendations only. It must not commit or push.

Suggested workstreams:

| Agent | Responsibility |
|---|---|
| Backend Architect | Database TypeScript errors, initialization, query API |
| MCP/Auth Engineer | MCP test suite, HTTP auth integration tests |
| Database Engineer | Message pagination, migration registry, rollback safety |
| Frontend Architect | M2/M3 frontend and interaction verification |
| QA/Security Engineer | Regression tests, integration tests, security audit |

The primary agent owns integration, conflict resolution, final verification, and reporting.

If parallel work creates overlapping changes, stop and resolve ownership before proceeding.

---

# 5. Wave 0 — Baseline and Repository Inspection

Inspect the entire relevant implementation.

At minimum inspect:

- `src/infrastructure/database/database.ts`
- `src/communication/messages.ts`
- `src/auth/`
- `src/mcp/`
- `src/mcp/tools.ts`
- `src/api/`
- `src/api/routes/`
- `src/migration-runner/`
- `tests/unit/mcp-tools.test.ts`
- Authentication tests.
- Migration tests.
- Message tests.
- Frontend chat implementation.
- Frontend theme implementation.
- Dashboard and activity implementation.
- Navigation and routing.
- Docker and CI configuration.
- `.gitignore`.
- Existing M2/M3 reports and migration documentation.

Run baseline checks and record their actual output.

Establish:

- Current TypeScript errors.
- Current test failures.
- Current frontend build status.
- Current lint status.
- Existing test artifact directories.
- Existing uncommitted changes.
- Existing migration state without applying migrations.
- Current database configuration and initialization behavior.

Do not assume any reported failure is pre-existing until its origin is established.

---

# 6. Wave 1 — Critical Backend Fixes

## 6.1 TypeScript compilation errors

File:

`src/infrastructure/database/database.ts`

Reported problems:

- `query()` returns an array with additional `get` and `all` methods.
- TypeScript sees the return value as `unknown[]`.
- Array augmentation is not represented by the declared return type.
- `generateId` proxy has implicit `any` types.

Required work:

1. Inspect all callers of `query()`.
2. Determine the intended public API.
3. Define explicit TypeScript interfaces/types for the query result.
4. Type the augmented array and its helper methods correctly.
5. Avoid unsafe casts where a proper type can be defined.
6. Add explicit proxy and handler types for `generateId`.
7. Preserve existing runtime behavior unless a behavior change is necessary.
8. Update affected callers if the corrected type exposes existing mistakes.
9. Add focused tests for the query helpers.
10. Run the complete backend typecheck.

Acceptance criteria:

- `npm run typecheck` passes.
- No new implicit `any` types.
- No unnecessary `any` or broad `unknown` escapes.
- Existing query callers remain functional.
- Tests verify `get`, `all`, and ordinary array behavior.

## 6.2 MCP tools test suite hangs and returns 401

File:

`tests/unit/mcp-tools.test.ts`

Reported problem:

- More than 40 tests are cancelled or time out.
- Initial request receives 401 Unauthorized where the test expects success.
- Server/test authentication configuration is inconsistent.

Required work:

1. Trace the complete test setup.
2. Inspect MCP server initialization.
3. Inspect authentication middleware and mode selection.
4. Determine why the test request receives 401.
5. Identify whether the test expects local, development, or production behavior.
6. Correct the test environment or mock boundary without weakening real authentication.
7. Ensure every test creates and closes its server, MCP transport, database, and timers.
8. Ensure failures produce useful error messages rather than hanging.
9. Add explicit timeouts only where justified; do not conceal hanging tests with excessive timeout values.
10. Run the MCP suite independently and as part of the complete suite.

Important:

Do not automatically set `AUTH_MODE=development` and `allow_hardcoded_fallback=true` simply to make tests pass.

First establish the intended security contract.

If a test requires development authentication, configure that explicitly in the isolated test environment and test the real production mode separately.

If mocking is appropriate, mock only the intended external boundary. Do not mock the middleware behavior that the test is supposed to verify.

Acceptance criteria:

- All MCP tools tests complete.
- No unexplained 401 responses.
- No hanging tests.
- Production authentication tests remain fail-closed.
- Test setup and teardown reliably release resources.

## 6.3 Lazy database initialization race condition

File:

`src/infrastructure/database/database.ts`

Reported problem:

`_databaseInstance` is initialized lazily through `getInstance()`.

Multiple callers could potentially create more than one connection.

Required work:

1. Inspect the actual initialization path.
2. Determine whether initialization is synchronous or asynchronous.
3. Determine whether concurrent calls can actually overlap.
4. If initialization is synchronous, document why JavaScript execution prevents the alleged race.
5. If initialization can overlap, implement a safe single-initialization guard.
6. Avoid unnecessary asynchronous complexity.
7. Ensure initialization failures do not leave the singleton permanently corrupted.
8. Ensure all proxy exports reference the same database instance.
9. Add tests that exercise concurrent initialization where relevant.

Do not implement a promise-based guard automatically if the underlying initialization is synchronous and cannot race. Use the simplest correct solution.

Acceptance criteria:

- Exactly one active database connection per configured instance.
- Initialization failures can be recovered safely.
- No accidental connection leaks.
- Tests demonstrate the actual initialization contract.

---

# 7. Wave 2 — Database and Message Bus Improvements

## 7.1 SQL-level message pagination

File:

`src/communication/messages.ts`

Reported problem:

When `conversation_id` is absent, `listMessages()` retrieves up to 500 messages, sorts them in JavaScript, and slices the result in memory.

Required work:

1. Inspect every `listMessages()` query path.
2. Preserve bidirectional participant filtering.
3. Move ordering and pagination into SQL.
4. Add a separate count query where total counts are required.
5. Ensure filtering occurs before pagination.
6. Preserve deterministic ordering.
7. Handle equal timestamps with a stable secondary sort key.
8. Avoid fetching records that are not required by the requested page.
9. Validate limit and offset inputs.
10. Add indexes if query plans demonstrate a need.
11. Test both conversation-specific and general message retrieval.

Acceptance criteria:

- Pagination is performed by SQLite.
- No arbitrary 500-message fetch followed by JavaScript slicing.
- Correct total counts.
- Correct bidirectional results.
- Stable ordering across pages.
- No duplicate or missing messages between pages.

## 7.2 Batch mark-as-read updates

File:

`src/communication/messages.ts`

Reported problem:

`markMessagesAsRead()` updates individual messages inside a loop.

Required work:

- Replace N+1 updates with a parameterized batch update where appropriate.
- Use a safe parameterized `IN` clause or another efficient SQLite-supported approach.
- Handle empty ID arrays.
- Respect recipient ownership and existing authorization conditions.
- Avoid marking another agent's messages as read.
- Preserve idempotency.
- Add tests for large batches and unauthorized IDs.

Do not construct SQL by interpolating untrusted message IDs.

## 7.3 Migration dependency parsing

File:

`src/migration-runner/registry.ts`

Reported problem:

Dependencies are parsed from comments using regex, including ranges such as `001-005`.

Required work:

1. Inspect current migration conventions.
2. Preserve compatibility with existing migration files.
3. Validate all declared dependencies against the discovered registry.
4. Reject missing dependencies.
5. Detect circular dependencies.
6. Detect self-dependencies.
7. Detect duplicate dependency declarations.
8. Ensure range expansion is deterministic and correctly handles boundaries.
9. Produce clear errors identifying the migration and invalid dependency.
10. Add tests for malformed declarations and dependency graph failures.

Do not migrate every SQL file to JSON front matter unless the benefits justify a repository-wide format change.

Prefer a backward-compatible structured parser with strict validation.

Acceptance criteria:

- Missing dependencies fail at registry load.
- Cycles are detected.
- Valid existing migrations continue to load.
- Dependency ordering is deterministic.
- No silent dependency omission.

## 7.4 Cross-division shares CHECK constraint

Inspect:

- Migration 005.
- Migration 016.
- Current schema in `database.ts`.
- Current Phase 6 authorization decisions.
- Current cross-division share implementation.

Reported discrepancy:

A comment suggests `granted_by_type` supports `founder` and `division`, while the CHECK constraint only permits `founder`.

Determine the intended authorization model from accepted project decisions and implementation.

If Founder-only is intentional:

- Keep the constraint.
- Correct misleading comments.
- Document why division grants are excluded.

If division grants are explicitly authorized by the established design:

- Propose the necessary schema and authorization changes.
- Do not apply production migrations.
- Do not silently broaden privileges.

Acceptance criteria:

- Documentation, schema, and authorization behavior agree.
- No accidental permission expansion.

## 7.5 Test artifacts and temporary directories

Reported issue:

Test runs create directories such as:

- `test-corrupt-*`
- `test-recovery-*`
- `test-rollbacks-*`

in the repository root.

Required work:

1. Find every test creating these directories.
2. Identify which tests own them.
3. Move generated test data to `os.tmpdir()` or a dedicated ignored test-data location.
4. Ensure each test uses unique isolated paths.
5. Add cleanup in reliable teardown/finally blocks.
6. Add appropriate `.gitignore` patterns.
7. Preserve any legitimate tracked fixtures.
8. Do not delete user-created directories.
9. Remove only artifacts proven to be generated and safe to remove.

Acceptance criteria:

- Test runs do not pollute the repository root.
- Temporary databases are isolated.
- Cleanup works after both success and failure.
- Git status remains free of generated artifacts after tests.

---

# 8. Wave 3 — Authentication and Security Integration Testing

## 8.1 Real HTTP middleware integration tests

Current reported gap:

Existing Phase 8 authentication tests do not fully exercise the actual Express middleware chain with real HTTP requests.

Required work:

Use Supertest or the existing established HTTP testing approach.

Test the real server instance and actual middleware chain.

Cover at least:

### Local mode

- Loopback requests.
- Non-loopback requests.
- IPv4 loopback.
- IPv6 loopback where supported.
- Forwarded-IP spoofing attempts.
- Missing identity.
- Invalid identity.
- Correct local Founder identity behavior.

### Development mode

- Explicit development configuration.
- Invalid session.
- Valid session.
- Missing token.
- Expired token.
- Invalid signature.
- Configuration with fallback disabled.
- Configuration with fallback enabled, if that option remains supported.

### Production mode

- Missing Founder keys.
- Missing persistent database path.
- Missing session secret.
- Invalid session.
- Expired session.
- Invalid Founder signature.
- Valid Founder signature.
- Replay attempts.
- Unauthorized privileged operation.
- Valid authorized privileged operation.

### Middleware behavior

- Correct HTTP status codes.
- Consistent error response format.
- No identity fallback.
- No accidental bypass through route ordering.
- No accidental authorization differences between REST and MCP.
- Correct resource cleanup after each test.

Use isolated databases, temporary keys, and test-only configuration.

Never use production credentials or real private keys in test fixtures.

Acceptance criteria:

- Tests exercise real HTTP requests.
- Tests cover actual middleware behavior.
- Production fail-closed behavior is verified.
- Local mode remains loopback restricted.
- Founder signature and replay protections remain intact.

## 8.2 Founder token parsing

Reported issue:

Token format:

`session_id|owner_type|owner_id|signature`

A pipe character in a field could break parsing.

Required work:

1. Inspect the current token contract.
2. Determine whether each field is restricted to a character set that already excludes `|`.
3. Determine whether compatibility with existing sessions is required.
4. If parsing is genuinely ambiguous, implement a versioned structured format using JSON plus base64url or another unambiguous encoding.
5. Validate all fields and reject malformed tokens.
6. Preserve signature verification and canonical signed payload behavior.
7. Add tests for delimiters, malformed encoding, Unicode, empty fields, invalid signatures, and legacy compatibility where required.
8. Do not silently invalidate existing valid sessions.

Do not change cryptographic semantics without reviewing the Founder signature contract.

Acceptance criteria:

- Token parsing is unambiguous.
- Signature verification remains correct.
- Malformed tokens fail safely.
- Compatibility behavior is documented.

## 8.3 Nonce cleanup function

File:

`src/auth/founder.ts`

Reported issue:

`cleanupExpiredNonces()` is an exported no-op, while actual cleanup is performed through `startNonceCleanupInterval()`.

Required work:

1. Search all callers.
2. Determine whether external compatibility requires retaining the export.
3. If retained, add an explicit `@deprecated` JSDoc comment and explain the actual cleanup mechanism.
4. If removed, update every caller and test.
5. Do not accidentally stop scheduled cleanup.
6. Ensure the interval is started and stopped safely.
7. Ensure tests do not leak timers.

Acceptance criteria:

- No misleading undocumented no-op API.
- Nonce cleanup remains operational.
- No timer leaks.

---

# 9. Wave 4 — Database Export and Proxy Simplification

File:

`src/infrastructure/database/database.ts`

Reported issue:

Four exports appear to provide overlapping proxy access:

- `databaseInstance`
- `db`
- `stmt`
- `generateId`

Required work:

1. Inspect all imports and callers.
2. Establish the canonical database access API.
3. Determine whether `db` and `databaseInstance` are actually identical.
4. Preserve compatibility where callers depend on existing exports.
5. Remove redundant proxies only when safe.
6. Avoid unnecessary public API changes.
7. Ensure every retained export resolves to the same intended instance.
8. Add tests for proxy behavior and initialization.
9. Update documentation and imports as necessary.

Do not refactor the entire database layer merely to reduce a few lines.

Acceptance criteria:

- One clear canonical access pattern.
- No duplicate initialization paths.
- Existing callers continue to work.
- No new circular dependencies.
- TypeScript passes.

---

# 10. Wave 5 — M2/M3 Remediation Verification

The previous remediation report listed commit `02d8150`.

Verify the actual implementation at the current HEAD.

## 10.1 Chat and message bus

Verify:

- Bidirectional conversation SQL.
- Correct sender/recipient filtering.
- Stable message IDs across backend and frontend.
- Optimistic message replacement.
- Failed-send retry behavior.
- Successful retry updates conversation state and preview.
- Pending, failed, sent, and read indicators.
- Oldest message at top.
- Newest message at bottom.
- Scroll-to-bottom when opening a conversation.
- No forced scrolling when the user is reading older messages.
- Viewport preservation when loading older pages.
- New-message indicator when appropriate.
- Correct unread counts.
- Correct mark-as-read behavior.
- SQL-level pagination.
- No arbitrary in-memory pagination cap.
- Correct message retrieval for both agents.

Verify actual browser behavior. Do not rely only on source-code inspection.

## 10.2 Agent identity registry

Verify:

- Canonical logical identities are distinct from runtime instances.
- Communication registry and organization registry remain synchronized.
- Startup synchronization is deterministic and idempotent.
- Organization changes update the registry correctly.
- Stable IDs are preserved.
- No permission expansion occurs during synchronization.
- Invalid sender/recipient identities produce clear errors.
- Runtime identity mappings are correct.

## 10.3 Claude and Hermes delivery

Distinguish message persistence from actual runtime delivery.

Verify the complete workflow independently for both runtimes:

1. Founder sends a message.
2. Message is persisted.
3. Target agent retrieves the message.
4. Target agent replies.
5. Reply is persisted.
6. Founder retrieves the reply.
7. Message status is updated correctly.

If an agent runtime is unavailable:

- Record the exact connection failure.
- Identify whether the MCP server is listening.
- Identify the expected connection endpoint.
- Record the missing dependency.
- Do not claim end-to-end delivery works.

## 10.4 Theme system

Verify:

- One authoritative theme state.
- No duplicate theme state in App and Layout.
- MUI ThemeProvider consumes the same state.
- Theme switching does not reload the page.
- Preference persistence works.
- System theme behavior is correct if supported.
- Subscription cleanup works.
- No listener leaks.
- Both light and dark modes are readable.

## 10.5 Dashboard and activity

Verify:

- Dashboard counts are correct and distinguish logical identities from runtime instances.
- Create Division action actually opens the creation workflow.
- Invite Staff action actually opens the invitation workflow.
- New Task action actually opens the task creation workflow.
- View All Activity points to a valid route.
- Activity page exists and handles loading, empty, and error states separately.
- Activity pagination does not omit records during source merging.
- Authorization filters prevent cross-division information leakage.
- Coming Soon labels are present where features are not implemented.
- No inert buttons or misleading interactions remain.

## 10.6 Navigation and design

Verify:

- 404 page.
- All registered routes.
- No broken navigation links.
- Responsive layout.
- MUI 9 usage.
- Accessible interaction states.
- Readable light and dark themes.
- No invalid inline CSS objects.
- No unnecessary custom styling.
- No decorative controls without functionality.

Design direction:

Use a clean, functional command center/control panel.

Prioritize:
- Clear hierarchy.
- Operational status visibility.
- Useful information density.
- Consistent spacing.
- Readability.
- Predictable navigation.
- Functional controls.

Use official MUI components wherever possible. Additional CSS is permitted only when MUI cannot reasonably provide the required behavior or presentation.

Avoid generic AI-dashboard aesthetics, unnecessary gradients, decorative cards, excessive animation, and visual clutter.

---

# 11. Wave 6 — Additional Repository Audits

## 11.1 Ponytail backend audit

Run the available Ponytail backend audit against the final implementation.

Inspect:

- Correctness.
- Security.
- Type safety.
- Error handling.
- Resource lifecycle.
- Database access.
- SQL correctness.
- API contracts.
- Test quality.
- Maintainability.
- Dead code.
- Unnecessary abstractions.

Fix critical and high-priority findings.

Do not blindly follow automated suggestions that conflict with the established security or architecture invariants.

## 11.2 Impeccable frontend audit

Run the available Impeccable frontend audit.

Inspect:

- Component structure.
- State management.
- Theme implementation.
- MUI usage.
- Accessibility.
- Navigation.
- Responsive behavior.
- Loading and error states.
- Performance.
- Unnecessary CSS.
- Dead components.
- Inert controls.

Fix critical and high-priority findings.

## 11.3 Design skill

Read and apply the `design-taste-frontend` skill before making frontend design changes.

Use it to improve practical interface quality, not to justify unnecessary redesign.

---

# 12. Wave 7 — Database Bootstrap Review

There is an outstanding request to bootstrap canonical organizational identities.

Reported target counts:

- 6 divisions.
- 51 staff identities.
- 11 Council seats.
- 4 permanent founding personas.
- 7 replaceable Council seats.

Before proposing any bootstrap operation:

1. Inspect the current database without modifying it.
2. Determine the actual current counts.
3. Identify duplicates, test records, orphaned references, and legitimate records.
4. Inspect existing IDs and relationships.
5. Compare the database with the canonical organizational specification.
6. Identify missing records.
7. Identify invalid relationships.
8. Identify records that must be preserved.
9. Inspect foreign keys and uniqueness constraints.
10. Produce a safe, idempotent bootstrap plan.

Important:

The historical database snapshot is not authoritative for the current database.

Do not assume current counts match historical reports.

Do not insert the 62 canonical identities simply because an earlier report proposed doing so. First establish which records already exist and which are genuinely missing.

Do not delete records to achieve target counts.

Do not execute the bootstrap.

Produce:

- Current database inventory.
- Canonical-versus-actual reconciliation.
- Proposed inserts and relationship repairs.
- Duplicate/orphan classification.
- Backup requirements.
- Migration or bootstrap script proposal.
- Rollback strategy.
- Explicit authorization checklist.

The Founder must approve database writes separately.

---

# 13. Wave 8 — Testing and Verification

Run tests in increasing scope.

### Backend

- TypeScript typecheck.
- Database unit tests.
- Message tests.
- MCP tool tests.
- Authentication tests.
- Nonce tests.
- Migration registry tests.
- Migration runner tests.
- Rollback isolation tests.
- API integration tests.
- Full backend test suite.

### Frontend

- TypeScript typecheck.
- Lint.
- Production build.
- Component tests.
- Chat tests.
- Theme tests.
- Dashboard tests.
- Navigation tests.
- Activity tests.
- Responsive browser tests.

### End-to-end

Test:

- Founder login.
- Dashboard.
- Navigation.
- Division creation.
- Staff invitation.
- Task creation.
- Message sending.
- Message retrieval.
- Message retry.
- Unread/read status.
- Activity.
- Theme persistence.
- Authorization boundaries.

### Runtime integration

Test Claude and Hermes independently when their runtimes are available.

Do not replace missing runtime verification with mocked tests and then claim live integration passed.

### Regression

Run all relevant Phase 8 and Phase 9 security and reliability tests.

Report any known pre-existing failure only after establishing that it existed before the current changes.

For every failing test, report:

- Test name.
- Failure message.
- Whether it is a regression.
- Root cause.
- Whether it blocks acceptance.
- Proposed resolution.

Never hide failures by skipping tests, loosening assertions, or increasing timeouts without justification.

---

# 14. Wave 9 — Documentation and Reports

Update the documentation to reflect the actual implementation.

Required reports:

1. `M2_M3_FINAL_VERIFICATION_REPORT.md`
2. `M2_M3_REMEDIATION_REPORT.md`
3. `DATABASE_BOOTSTRAP_REVIEW.md`
4. `AUTHENTICATION_INTEGRATION_TEST_REPORT.md`
5. `MCP_TEST_FAILURE_ANALYSIS.md`
6. `BACKEND_AUDIT_REPORT.md`
7. `FRONTEND_AUDIT_REPORT.md`
8. `FINAL_TEST_RESULTS.md`

Use existing documentation conventions and directory structure.

Do not create duplicate reports if an appropriate existing report can be updated.

Every report must distinguish:

- Implemented.
- Independently tested.
- Reported but not independently verified.
- Blocked by environment.
- Requires Founder authorization.
- Unresolved.

Do not describe a feature as complete merely because code exists.

---

# 15. Final Acceptance Criteria

M2/M3 may be submitted for Founder acceptance only when:

- Backend TypeScript passes.
- Frontend TypeScript passes.
- Frontend production build passes.
- MCP tests complete without hangs.
- Authentication integration tests pass.
- Production auth remains fail-closed.
- Database initialization is safe.
- Rollback isolation is verified.
- Message retrieval and pagination are correct.
- Message status and ordering work correctly.
- M2/M3 frontend workflows function in the browser.
- Authorization boundaries are tested.
- No critical or high security findings remain.
- All test failures are classified.
- Documentation matches actual implementation.
- Database bootstrap is documented but not executed without approval.
- Runtime integration limitations are explicitly disclosed.

Claude/Hermes live E2E may remain blocked if the external runtimes cannot be started, but this must be reported as an unresolved integration verification item, not as a passing test.

Do not grant formal acceptance yourself.

---

# 16. Final Response Format

When finished, provide a concise but complete report:

## A. Execution Summary
- Work completed.
- Agents used.
- Files changed.
- Current branch and HEAD SHA.

## B. Critical Fixes
For each:
- Original issue.
- Root cause.
- Implementation.
- Verification.

## C. M2/M3 Status
Separate backend, frontend, chat, identity registry, dashboard, activity, and runtime integration.

## D. Test Results
Actual passing, failing, skipped, and blocked counts.

## E. Security
Authentication modes, Founder signatures, loopback restrictions, nonce replay protection, authorization, and remaining risks.

## F. Database
Current inventory, bootstrap review, migration integrity, rollback verification, and pending Founder authorization.

## G. Audit Findings
Ponytail backend and Impeccable frontend findings, with severity and remediation status.

## H. Remaining Blockers
List each blocker, its cause, and what is required to resolve it.

## I. Git Status
- Current branch.
- HEAD SHA.
- Working tree status.
- Changed files.
- No commits or pushes unless separately authorized.

## J. Founder Decisions Required
List only decisions that genuinely require Founder authorization.

## K. Acceptance Recommendation
Choose exactly one:

- READY FOR FOUNDER ACCEPTANCE
- NOT READY — REMEDIATION REQUIRED
- BLOCKED — EXTERNAL DEPENDENCY

Do not mark M2/M3 formally accepted.

---

# Final Instruction

Execute the work systematically.

Prioritize correctness, security, data integrity, and actual functionality over reducing line count or producing impressive reports.

Do not expand scope unnecessarily.

Do not make architectural changes without evidence that they are needed.

Do not conceal unresolved failures.

Do not modify production data.

Do not commit or push.

Return the final evidence-based report and wait for Founder instructions.