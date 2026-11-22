# COUNCIL BRIDGE — COMPREHENSIVE MCP AUTHENTICATION & RUNTIME IDENTITY REMEDIATION

**Target repository:** `C:\Projects\council-bridge`  
**GitHub repository:** `snowep/council-bridge`  
**Audited commit:** `20e7418d45ccf1be9f1894e756881ecd6072ab8d`  
**Previous audit verdict:** REJECT — remediation required  
**Objective:** Resolve every finding from the audit of commit `20e7418`, establish correct Claude Code/Hermes runtime identity, and verify the complete production MCP connection and runtime handoff workflow.

---

# 1. EXECUTION AUTHORIZATION

You are authorized to inspect, modify, test, and document the code necessary to resolve the findings in this prompt.

This authorization covers the MCP authentication and runtime lifecycle remediation only.

Do not expand the task into M4 or unrelated architectural work.

## Mandatory repository safeguards

1. Inspect the current branch, HEAD, working tree, and uncommitted changes before modifying anything.
2. Preserve every existing user modification, including untracked files.
3. Do not run:
   - `git reset`
   - `git clean`
   - `git checkout --`
   - `git restore`
   - destructive stash operations
   - history rewriting
4. Do not overwrite user changes merely to simplify implementation.
5. Do not modify production database records manually.
6. Do not drop, weaken, or bypass the `idx_single_active_runtime` unique index.
7. Do not delete existing memories, agent identities, Council records, messages, tasks, deliverables, or historical data.
8. Do not create a second Council Bridge database for either runtime.
9. Do not commit, push, merge, deploy, or rewrite Git history.
10. Do not modify unrelated frontend components or visual styling.

If existing user changes conflict with this task, inspect the conflict and preserve the user's work. Report any issue that cannot safely be resolved without additional authorization.

---

# 2. REQUIRED SOURCE INSPECTION

Inspect the current working tree, not merely the audited commit.

At minimum, inspect:

### Authentication
- `src/api/middleware/authentication.ts`
- `src/auth/index.ts`
- `src/auth/config.ts`
- `src/auth/founder.ts`
- `src/auth/session.ts`
- `src/api/middleware/index.ts`, if present

### Runtime lifecycle and ownership
- `src/runtime/lifecycle.ts`
- `src/runtime/runtime-ownership.middleware.ts`
- `src/runtime/runtime-execution-guard.ts`
- `src/api/routes/runtime.routes.ts`

### Server and database
- `src/server.ts`
- `src/database.ts`
- `src/infrastructure/database/database.ts`
- All runtime-related migrations
- All runtime session prepared statements

### MCP integration
- MCP server construction and registration
- MCP HTTP transport initialization
- MCP tool registration
- Claude Code MCP configuration
- Hermes MCP configuration
- Runtime identity initialization and connection lifecycle

### Tests and documentation
- `tests/integration/local-founder-bootstrap.test.ts`
- `tests/integration/mcp-bootstrap-integration.test.ts`
- `tests/integration/runtime-concurrency.test.ts`
- `tests/unit/runtime-execution-guard.test.ts`
- Relevant authentication and lifecycle tests
- `docs/reports/COUNCIL_BRIDGE_MCP_AUTHENTICATION_HOTFIX.md`
- Previous runtime audit and implementation reports

Produce an initial source map identifying the actual production request path and all places where runtime identity is assigned, inferred, validated, or changed.

Do not assume the current implementation matches the previously audited GitHub version.

---

# 3. P0 — FIX CLAUDE/HERMES RUNTIME IDENTITY

**Finding:** `authentication.ts` derives the runtime identity from the currently active database session:

```ts
runtime: activeSession?.runtime || 'claude'
```

This is incorrect.

The runtime making the request must not be identified by whichever runtime happens to own the active session.

## 3.1 Separate the identity layers

The architecture must distinguish:

1. **Founder identity**
   - Represents the human owner of Council Bridge.
   - Owns Founder-level authorization.
   - Is not a runtime identity.
   - Is not an additional Council voting seat.

2. **Runtime identity**
   - Identifies the execution environment making the request.
   - Allowed values: `claude` or `hermes`.
   - Must be established independently of active database ownership.

3. **Runtime session**
   - Identifies one connection/session belonging to a specific runtime.
   - Must be validated against the authoritative SQLite database.

4. **MCP transport session**
   - Represents the MCP protocol connection or transport state.
   - Must not be confused with Founder identity or runtime ownership.

5. **Agent/persona identity**
   - Represents the Council or division identity acting through a runtime.
   - Must remain independent of the runtime connection lifecycle.

Do not conflate these layers in `AuthContext` or lifecycle operations.

## 3.2 Establish trustworthy runtime identification

Implement an explicit, secure mechanism for identifying the requesting runtime.

Requirements:

- Claude Code must identify itself as `claude`.
- Hermes must identify itself as `hermes`.
- The identity must not be inferred from the active runtime session.
- The identity must not be selected by trusting an arbitrary request header.
- The identity must not be selected from an unauthenticated request-body field.
- Do not introduce hardcoded credentials or identity fallbacks.
- Do not expose private keys or long-lived secrets to frontend code.
- Do not use the Founder identity as a substitute for runtime authentication.
- Do not allow a caller to claim the other runtime's identity.

Inspect the existing authentication/session infrastructure before choosing the implementation.

Prefer the smallest secure extension of the existing authentication architecture.

If runtime-specific credentials are required:

- Issue separate credentials for Claude and Hermes.
- Bind each credential to exactly one runtime.
- Validate the credential server-side.
- Support revocation.
- Ensure disconnected or revoked credentials cannot continue executing tools.
- Keep credential material out of source control, logs, browser code, and reports.
- Do not silently fall back to local Founder bootstrap when a supplied credential is invalid.

If the local single-user mode uses a trusted local registration mechanism instead, establish how the server distinguishes the two clients without relying on spoofable headers or client-controlled runtime values.

Document the trust boundary and threat model.

## 3.3 Correct authentication middleware

Modify `src/api/middleware/authentication.ts`.

Remove runtime inference based on:

```ts
activeSession?.runtime
```

Authentication must establish the requesting runtime before runtime ownership is evaluated.

The middleware must not silently convert an invalid or unidentified runtime into Claude.

For local single-user mode:

- Keep the loopback-only restriction.
- Continue using the actual socket remote address.
- Do not trust `X-Forwarded-For` or equivalent forwarded headers.
- Keep local single-user mode prohibited in production.
- Preserve fail-closed production authentication.
- Do not reintroduce hardcoded identity fallback.
- Do not permit arbitrary callers to acquire a Founder identity merely by supplying `session_id: 'local-founder'`.

The synthetic `local-founder` session may remain as an internal bootstrap mechanism, but it must not function as a runtime credential.

## 3.4 Required identity tests

Add tests proving:

| Requesting client | Expected runtime identity |
|---|---|
| Claude Code | `claude` |
| Hermes Agent | `hermes` |
| Claude while Hermes is active | `claude` |
| Hermes while Claude is active | `hermes` |
| Missing runtime authentication | Rejected |
| Invalid runtime credential | Rejected |
| Revoked runtime credential | Rejected |
| Claude credential claiming Hermes | Rejected |
| Hermes credential claiming Claude | Rejected |
| Production request without valid authentication | Rejected |

Specifically test that the active runtime database record cannot change the runtime identity established by authentication.

---

# 4. P1 — NARROW THE LOCAL-FOUNDER BOOTSTRAP EXCEPTION

**Finding:** Both ownership and execution guards broadly bypass normal authorization when they receive:

```ts
session_id === 'local-founder'
```

This is insufficiently constrained.

## 4.1 Bootstrap must be an explicit operation

Treat local Founder bootstrap as a narrowly authorized lifecycle transition.

It must not be a general execution authorization bypass.

Requirements:

- Bootstrap is allowed only when local single-user mode is enabled.
- Bootstrap is allowed only for genuine loopback requests.
- Bootstrap must require a valid, independently identified runtime.
- Bootstrap must establish a specific runtime/session transition.
- Bootstrap must not grant permission to impersonate another runtime.
- Bootstrap must not permit arbitrary tool execution without a valid runtime ownership state.
- Bootstrap must not be accepted in production mode.
- A caller must not be able to obtain bootstrap privileges simply by setting a request field or session ID.

Separate these operations:

1. Authenticate the Founder.
2. Identify the requesting runtime.
3. Authorize a local runtime activation/handoff.
4. Establish the new runtime session.
5. Acquire an execution permit.
6. Execute the MCP request.

Do not merge these steps into a broad bypass condition.

## 4.2 Make handoff atomic

Runtime handoff must be protected by SQLite transaction semantics.

Expected behavior:

1. Authenticate the requesting runtime.
2. Begin an immediate transaction.
3. Read the authoritative current runtime session.
4. Validate the current session and its state.
5. Reconcile genuinely expired connected sessions.
6. Disconnect the previous session using its exact session ID.
7. Create or activate the new runtime session.
8. Verify the resulting active session and uniqueness invariant.
9. Commit.
10. Only then allow execution under the new runtime identity.

If any operation fails, roll back the transaction.

Never leave two connected sessions.

Never disconnect a different or newer session because a stale request used an outdated session ID.

Use conditional SQL updates that verify the expected runtime, session ID, and connection status.

## 4.3 Ownership middleware

Modify `src/runtime/runtime-ownership.middleware.ts`.

The ownership guard must distinguish:

- Normal authenticated runtime requests.
- Explicitly authorized bootstrap/handoff requests.
- Invalid bootstrap requests.
- Expired sessions.
- Disconnected sessions.
- Runtime mismatches.
- Missing session identity.

Normal MCP tool execution must always require an active, connected, unexpired session matching the authenticated runtime and session.

A bootstrap exception may authorize only the controlled activation transition. It must not independently authorize unrestricted tool execution.

## 4.4 Execution guard

Modify `src/runtime/runtime-execution-guard.ts`.

Ensure that:

- Bootstrap is authorized using the explicit lifecycle operation.
- Runtime identity is checked against the independently authenticated identity.
- Session identity is checked against the database.
- Lease validation is fail-closed.
- Execution permits cannot be acquired by a disconnected runtime.
- A stale session cannot execute after a handoff.
- A previous runtime cannot continue executing after ownership has transferred.
- Failed handoffs do not leave partial session state.

Do not weaken the TOCTOU protections already implemented.

---

# 5. P1 — VERIFY THE ACTUAL PRODUCTION MCP ENDPOINT

**Finding:** The new integration tests construct a separate Express application that reproduces the middleware flow rather than proving the real production server composition.

This is insufficient.

## 5.1 Make production composition testable

Refactor only as much as necessary to expose the actual application/server composition for tests.

Acceptable approaches include:

- Exporting an application factory used by both production startup and tests.
- Extracting the actual MCP route registration into a shared production module.
- Providing dependency injection for the production database and runtime lifecycle manager.

The tests must use the same production middleware and route registration.

Do not maintain a separate test-only implementation of the MCP request pipeline.

Do not create duplicate mock middleware that can pass while production remains broken.

## 5.2 Test actual MCP protocol behavior

The tests must perform real HTTP requests through the production MCP endpoint.

Cover:

### Initialization
- Valid Claude runtime authentication.
- Valid Hermes runtime authentication.
- MCP initialization request.
- Correct protocol response.
- Correct session behavior.
- Invalid authentication rejection.

### Tool discovery
- Claude successfully requests tool discovery.
- Hermes successfully requests tool discovery.
- Tool list is returned in the expected MCP response structure.

### Tool execution
- Claude executes an actual registered, safe, read-only MCP tool.
- Hermes executes the same tool.
- The response contains a successful JSON-RPC result.
- The test asserts the tool's actual result, not merely HTTP 200.

### Failure behavior
- Invalid runtime credentials.
- Missing runtime credentials.
- Expired sessions.
- Disconnected sessions.
- Runtime mismatch.
- Stale MCP requests after handoff.
- Concurrent runtime execution attempts.

Inspect the MCP SDK's actual protocol behavior. Do not assume every successful MCP response is a normal JSON response; handle the Streamable HTTP transport correctly.

## 5.3 Do not mistake HTTP 200 for successful tool execution

For tool execution, assert all relevant layers:

1. HTTP status.
2. JSON-RPC response structure.
3. Matching request ID.
4. Absence of JSON-RPC error.
5. Expected tool result.
6. Correct runtime/session ownership.
7. Persisted execution record state.

An HTTP 200 response containing a JSON-RPC error is a failed tool execution.

---

# 6. P1 — IMPLEMENT REAL CONCURRENCY AND HANDOFF TESTS

**Finding:** The test named `should prevent Claude and Hermes from executing concurrently` does not actually make an HTTP request or assert a result.

Remove or replace the ineffective test.

## 6.1 Required scenarios

Implement genuine concurrent tests using separate requests and distinct runtime identities.

### Scenario A — Claude wins initial activation

- Start with no active runtime.
- Submit concurrent Claude and Hermes activation requests.
- Verify exactly one activation succeeds.
- Verify exactly one connected session exists.
- Verify the losing runtime cannot execute.

### Scenario B — Hermes wins initial activation

Repeat Scenario A with the outcome reversed.

### Scenario C — Claude to Hermes handoff

1. Activate Claude.
2. Execute a read-only MCP tool as Claude.
3. Request an authorized handoff to Hermes.
4. Verify Claude's session is disconnected.
5. Verify Hermes owns the only connected session.
6. Verify Hermes can execute a tool.
7. Verify Claude's old session cannot execute.

### Scenario D — Hermes to Claude handoff

Repeat Scenario C in reverse.

### Scenario E — Concurrent handoff requests

- Start with Claude active.
- Submit concurrent handoff requests from Claude and Hermes.
- Verify the final state is valid.
- Verify no duplicate connected sessions.
- Verify no stale execution permits survive incorrectly.

### Scenario F — Execution versus handoff

- Begin a long-running controlled test operation.
- Attempt a runtime handoff while execution is active.
- Verify the documented execution/handoff policy is enforced.
- No previous runtime may continue executing after ownership transfer.
- No execution permit may be assigned to the wrong session.

### Scenario G — Heartbeat versus stale recovery

- Start with an active session.
- Race heartbeat renewal against stale-session recovery.
- Verify a valid renewed lease is not incorrectly disconnected.
- Verify an expired lease cannot be revived by a stale session.

### Scenario H — Process restart

- Activate Claude.
- Close and reopen the database/server using the production initialization path.
- Verify persistent memory and historical records remain.
- Verify stale connection recovery follows the documented policy.
- Verify a new runtime can establish ownership safely.

## 6.2 Assertions required for every scenario

After each relevant operation, assert:

```sql
SELECT runtime, session_id, connection_status, lease_expires_at
FROM runtime_sessions;
```

And:

```sql
SELECT COUNT(*) AS connected_count
FROM runtime_sessions
WHERE connection_status = 'connected';
```

The connected count must never exceed one.

Also verify:

- The expected runtime owns the active session.
- The expected session ID matches exactly.
- Previous session status is correct.
- Execution records reference the correct session.
- No unauthorized runtime executed a tool.
- Database integrity remains valid.

Do not merely test the lifecycle manager in isolation. At least the core activation, handoff, and rejection scenarios must exercise the production HTTP MCP path.

---

# 7. P1 — FIX TEST DATABASE ISOLATION AND CLEANUP

**Finding:** `tests/integration/mcp-bootstrap-integration.test.ts` creates databases in a shared directory and recursively deletes that entire directory in `afterEach`.

This can delete another concurrent test's database.

## Required changes

1. Create a unique temporary directory for each test.
2. Use cryptographically unique database filenames or a unique temporary directory.
3. Do not use `Date.now()` as the only uniqueness mechanism.
4. Cleanup only the directory created by that specific test.
5. Close every SQLite connection before deleting files.
6. Close WAL/checkpoint resources correctly.
7. Ensure test failure does not leave open database handles.
8. Ensure cleanup cannot remove another test's files.
9. Avoid mutating the production database singleton in a way that leaks into other tests.
10. Restore environment variables to their original values rather than always deleting them.

Use `try/finally` or the test framework's reliable lifecycle hooks.

Add a test that executes multiple bootstrap integration tests concurrently and confirms their database files remain isolated.

---

# 8. P1 — VERIFY HEARTBEAT AND EXECUTION-PERMIT LIFECYCLE

The previous audit identified heartbeat cleanup as a concern. The latest implementation claims that cleanup already exists in the MCP handler's `finally` block.

Verify the actual production path.

Inspect:

- `src/runtime/runtime-execution-guard.ts`
- `src/server.ts`
- MCP transport lifecycle
- Runtime lifecycle manager
- Heartbeat renewal prepared statements

Requirements:

1. Every heartbeat interval must have a clearly defined owner.
2. Every interval must be cleared when its owning execution or connection ends.
3. An exception must not bypass cleanup.
4. An aborted HTTP request must not leave an orphaned interval.
5. A disconnected runtime must not continue renewing its lease.
6. A stale session must not renew itself after handoff.
7. Heartbeat renewal must validate the exact runtime and session ID.
8. Heartbeat renewal must reject expired or disconnected sessions.
9. A previous runtime must not extend its lease after another runtime has taken ownership.
10. Server shutdown must release in-memory timers and execution resources safely.

## Important distinction

Do not confuse:

- Heartbeat renewal while an MCP tool is executing.
- Idle runtime connection heartbeat renewal.
- MCP transport liveness.
- Runtime session lease renewal.

If the architecture requires a runtime to remain connected while idle, implement a clearly owned connection heartbeat mechanism. Do not rely solely on a five-minute timer that starts during tool execution.

Document the exact lease policy and lifecycle.

Test:

- Normal request completion.
- Tool execution error.
- HTTP abort.
- Runtime disconnect.
- Runtime handoff.
- Server shutdown.
- Heartbeat/recovery race.

---

# 9. P1 — PRESERVE THE SHARED MEMORY ARCHITECTURE

This is a mandatory architectural invariant.

The runtime lifecycle change must not split or reset organizational memory.

Both Claude Code and Hermes must use the same Bridge-owned persistent storage.

Requirements:

- One authoritative Council Bridge SQLite database.
- One shared agent identity registry.
- One shared Council knowledge store.
- One shared memory/history system.
- Shared messages and conversation history according to existing authorization.
- Shared tasks and deliverables.
- Shared organizational state.
- Runtime-specific connection sessions remain separate from persistent memory.

Runtime switching must not:

- Create a new memory database.
- Duplicate agent identities.
- Reset memory.
- Delete history.
- Recreate Council members.
- Reinitialize organizational records.
- Make memory dependent on one runtime's local files.
- Copy the entire memory database between runtimes.

## Required integration test

1. Activate Claude.
2. Write a test memory/knowledge record using the actual existing Bridge-supported mechanism.
3. Disconnect Claude and activate Hermes.
4. Read the same record using the existing authorized mechanism.
5. Verify the record ID and content are unchanged.
6. Write a second record using Hermes.
7. Switch back to Claude.
8. Verify both records are available.
9. Verify the database contains only one canonical copy of each record.

Use a dedicated isolated test database.

Do not alter production memory data.

Do not invent a new memory architecture to satisfy this test. Reuse the existing Bridge-owned storage and permissions.

---

# 10. P2 — CORRECT THE HOTFIX REPORT

Update:

`docs/reports/COUNCIL_BRIDGE_MCP_AUTHENTICATION_HOTFIX.md`

The current report contains claims that are not established by the source and tests.

The revised report must include:

## A. Original failure

Explain the original:

`UNIQUE constraint failed: runtime_sessions.connection_status`

Include the verified failing call path and SQL operation. Do not repeat an assumed root cause unless confirmed from the actual code.

## B. Runtime identity architecture

Explain the separation between:

- Founder identity.
- Claude runtime identity.
- Hermes runtime identity.
- Runtime session.
- MCP transport session.
- Agent/persona identity.

## C. Authentication trust boundary

Document:

- How Claude is identified.
- How Hermes is identified.
- How runtime credentials are validated, if used.
- How local loopback mode is constrained.
- How production authentication remains fail-closed.
- How identity spoofing is rejected.

Do not include actual credentials, private keys, tokens, or secrets.

## D. Bootstrap and handoff

Document:

- The authorized bootstrap path.
- The transaction boundary.
- Existing session handling.
- Expired session recovery.
- Runtime activation.
- Execution permit acquisition.
- Rollback behavior.

## E. Heartbeat lifecycle

Document:

- Idle heartbeat policy.
- Active execution heartbeat policy.
- Lease duration.
- Renewal interval.
- Disconnect behavior.
- Stale recovery.
- Shutdown behavior.

## F. Test evidence

Include exact commands and actual results.

Separate:

- Unit tests.
- Lifecycle integration tests.
- Runtime concurrency tests.
- Production HTTP MCP integration tests.
- Shared-memory tests.
- TypeScript compilation.
- Frontend build, only if relevant.
- Actual Claude Code client verification.
- Actual Hermes client verification.

Never label a simulated test as a live client test.

Never report a test as passing unless it was actually executed.

## G. Remaining limitations

List any unverified behavior explicitly.

Do not claim the hotfix is complete if actual Claude Code and Hermes MCP client connections have not been tested.

---

# 11. REQUIRED ACCEPTANCE TEST MATRIX

The following matrix must be completed.

| ID | Requirement | Expected result |
|---|---|---|
| AUTH-01 | Claude runtime identification | Authenticated as Claude |
| AUTH-02 | Hermes runtime identification | Authenticated as Hermes |
| AUTH-03 | Runtime identity independent of active session | Pass |
| AUTH-04 | Invalid credential | Rejected |
| AUTH-05 | Missing runtime identity | Rejected |
| AUTH-06 | Cross-runtime impersonation | Rejected |
| AUTH-07 | Production fail-closed | Pass |
| AUTH-08 | Loopback restriction | Pass |
| BOOT-01 | No active session bootstrap | Pass |
| BOOT-02 | Hermes-to-Claude handoff | Pass |
| BOOT-03 | Claude-to-Hermes handoff | Pass |
| BOOT-04 | Unauthorized bootstrap attempt | Rejected |
| BOOT-05 | Expired connected-session recovery | Pass |
| BOOT-06 | Failed handoff rollback | Pass |
| MCP-01 | Production endpoint initialization | Pass |
| MCP-02 | Production tool discovery | Pass |
| MCP-03 | Claude actual tool execution | Pass |
| MCP-04 | Hermes actual tool execution | Pass |
| MCP-05 | JSON-RPC error detection | Pass |
| MCP-06 | Stale session rejection | Pass |
| CON-01 | Concurrent initial activation | Exactly one winner |
| CON-02 | Concurrent handoff | Valid single owner |
| CON-03 | Execution versus handoff | Safe documented behavior |
| CON-04 | Heartbeat versus recovery | Consistent state |
| CON-05 | Process restart recovery | Pass |
| HB-01 | Normal heartbeat renewal | Pass |
| HB-02 | Expired lease rejection | Pass |
| HB-03 | Disconnect stops renewal | Pass |
| HB-04 | Handoff stops old heartbeat | Pass |
| HB-05 | Error/abort cleanup | Pass |
| MEM-01 | Claude writes, Hermes reads | Same record |
| MEM-02 | Hermes writes, Claude reads | Same record |
| MEM-03 | No duplicate canonical memory | Pass |
| DB-01 | One connected runtime maximum | Pass |
| DB-02 | SQLite integrity check | `ok` |
| DB-03 | No foreign-key violations | Pass |
| TEST-01 | Isolated test databases | Pass |
| TEST-02 | Concurrent test cleanup safety | Pass |

Do not mark a test complete based only on an existing test name. Inspect what it actually asserts.

---

# 12. LOCAL VERIFICATION

Run the relevant tests against the current working tree.

At minimum:

```bash
npx tsc --noEmit
```

Run the relevant unit and integration tests using the project's actual scripts and test runner.

Run:

- Authentication tests.
- Local Founder bootstrap tests.
- MCP bootstrap integration tests.
- Runtime execution guard tests.
- Runtime concurrency tests.
- Lifecycle tests.
- Heartbeat tests.
- Shared-memory integration tests.

Run the complete backend test suite after targeted tests pass.

If a test fails:

1. Identify the root cause.
2. Fix the implementation or test.
3. Rerun the affected test.
4. Rerun the complete relevant suite.
5. Record any pre-existing failures separately.

Do not hide failures by increasing timeouts, skipping tests, weakening assertions, or changing expected results without justification.

Verify:

```sql
PRAGMA integrity_check;
PRAGMA foreign_key_check;
```

Use isolated test databases for destructive test scenarios.

Do not run cleanup or migration operations against the production database as part of this task.

---

# 13. REAL MCP CLIENT VERIFICATION

Automated tests alone are insufficient for final connection acceptance.

After the implementation and automated tests pass, perform actual local verification if the environment permits.

## Claude Code

Verify:

```cmd
claude mcp list
claude mcp get council-bridge
```

Then verify:

- Server status is connected.
- Authentication is not required unexpectedly.
- MCP initialization succeeds.
- Tool discovery succeeds.
- At least one safe read-only Council Bridge tool executes successfully.
- Runtime identity is `claude`.

## Hermes Agent

Perform the equivalent checks through the installed Hermes MCP configuration and actual client.

Verify:

- Hermes connects to the same Bridge endpoint.
- Hermes runtime identity is `hermes`.
- Tool discovery succeeds.
- A safe read-only tool executes.
- Shared memory is accessible.

## Runtime handoff

Perform both directions:

1. Claude → Hermes.
2. Hermes → Claude.

Verify that:

- The old runtime is disconnected.
- The new runtime owns the active session.
- The old runtime cannot continue executing.
- The new runtime can execute.
- Shared memory remains intact.
- No duplicate connected sessions exist.

If either actual client is unavailable during this task, report the integration test results and explicitly mark live client verification as pending. Do not claim successful real-client verification.

---

# 14. IMPLEMENTATION REPORT AND CHANGE MANIFEST

Create or update:

`docs/reports/MCP_RUNTIME_IDENTITY_REMEDIATION_REPORT.md`

Include:

1. Executive summary.
2. Audited commit and actual starting HEAD.
3. Original audit findings.
4. Root cause of each finding.
5. Files changed and why.
6. Runtime identity design.
7. Authentication design.
8. Bootstrap/handoff design.
9. Execution ownership design.
10. Heartbeat lifecycle.
11. MCP endpoint integration changes.
12. Shared-memory verification.
13. Test matrix with actual results.
14. TypeScript results.
15. Database integrity results.
16. Actual Claude Code verification.
17. Actual Hermes verification.
18. Known limitations.
19. Remaining risks.
20. Final implementation verdict.

Also create:

`docs/reports/MCP_RUNTIME_IDENTITY_CHANGE_MANIFEST.md`

List every changed file, including:

- Added files.
- Modified files.
- Deleted files, if any.
- Reason for each change.
- Whether the change was necessary for this remediation.

The manifest must reconcile with:

```bash
git status --short
git diff --stat
git diff --name-status
```

Include untracked files.

Do not omit unrelated existing user changes from the working-tree report. Clearly distinguish pre-existing changes from changes introduced by this remediation.

---

# 15. COMPLETION CONDITIONS

The task is complete only when:

- [ ] Claude and Hermes have independently authenticated runtime identities.
- [ ] Runtime identity never derives from active session state.
- [ ] Local Founder bootstrap is narrowly authorized.
- [ ] Bootstrap cannot be used as a general execution bypass.
- [ ] Handoff is atomic and rollback-safe.
- [ ] Exactly one connected runtime can exist.
- [ ] Expired connected sessions are safely reconciled.
- [ ] The production MCP endpoint is exercised by integration tests.
- [ ] MCP initialization and tool discovery are verified.
- [ ] Actual registered tool execution is verified.
- [ ] Claude-to-Hermes and Hermes-to-Claude handoffs are tested.
- [ ] Concurrent activation and handoff tests pass.
- [ ] Heartbeat lifecycle is correct and has no orphaned timers.
- [ ] Test databases are isolated and cleanup-safe.
- [ ] Shared Bridge memory is accessible across runtime switches.
- [ ] No production authentication weakening occurred.
- [ ] SQLite integrity and foreign-key checks pass.
- [ ] TypeScript compilation passes.
- [ ] Relevant complete backend test suite passes, with pre-existing failures separately documented.
- [ ] Implementation report is accurate.
- [ ] Change manifest is complete.
- [ ] No unrelated user changes were lost.
- [ ] No commit or push was made.

---

# 16. FINAL RESPONSE FORMAT

When finished, provide:

## 1. Execution summary
What was changed and why.

## 2. Finding-by-finding resolution
Use the original audit finding IDs/categories:

- P0 runtime identity.
- P1 bootstrap authorization.
- P1 production MCP endpoint integration.
- P1 concurrency and handoff.
- P1 test isolation.
- P1 heartbeat lifecycle.
- P1 shared-memory verification.
- P2 documentation accuracy.

For each, report:
- Resolved.
- Partially resolved.
- Not resolved.
- Evidence.

## 3. Test results

Provide exact commands, totals, and exit codes.

Separate actual test execution from source inspection.

## 4. Live MCP client results

Report Claude and Hermes separately.

Do not claim a client connected unless the actual client confirmed it.

## 5. Changed files

Provide the complete change manifest.

## 6. Remaining issues

List anything that remains unverified or requires additional authorization.

## 7. Git status

Report:
- Current branch.
- Starting HEAD.
- Current HEAD.
- Modified files.
- Untracked files.
- Confirmation that no commit or push was made.

## 8. Final verdict

Choose exactly one:

- READY FOR FOUNDER AUDIT
- REMEDIATION INCOMPLETE

Do not declare the work formally accepted. Final acceptance remains the Founder's decision.

**Priority:** Correct runtime identity first. Then secure bootstrap/handoff. Then prove the actual production MCP path, concurrency behavior, heartbeat lifecycle, and shared memory. Do not report completion based on passing isolated tests while the actual client connection remains unverified.