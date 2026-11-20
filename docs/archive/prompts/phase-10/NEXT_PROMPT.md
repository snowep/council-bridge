# COUNCIL BRIDGE — SINGLE ACTIVE RUNTIME REMEDIATION

## Critical implementation remediation
**Repository:** `snowep/council-bridge`  
**Branch:** `refactor/repository-structure`  
**Starting commit:** `1b46398`  
**Previous baseline:** `56df3fb`  
**Scope:** Remediate the Single Active Runtime implementation using the audit findings.  
**Authority:** Founder-authorized remediation of this specific implementation only.

---

# 1. MISSION

Remediate the Single Active Runtime implementation.

The previous implementation introduced runtime lifecycle management, SQLite persistence, REST endpoints, and a frontend control.

However, source-code inspection identified important gaps:

1. MCP requests are not demonstrably restricted to the active runtime.
2. Runtime switching updates database state without proving an actual MCP connection transition.
3. Session ownership checks are incomplete.
4. Stale-session recovery has race conditions.
5. Lease timestamps use inconsistent formats.
6. Heartbeat renewal is not integrated with actual runtime connections.
7. Migration 017 is not demonstrably integrated into database initialization.
8. Tests do not prove concurrent exclusion or cross-runtime shared-memory behavior.
9. The file-change manifest does not accurately describe all committed changes.
10. Required implementation and test-evidence reports are missing.

The objective is to fix these issues without redesigning Council Bridge.

The required architecture remains:

**Single Active Runtime + Shared Persistent Intelligence.**

Claude Code and Hermes must be mutually exclusive as active runtime connections, but both must access the same persistent Bridge-owned organizational intelligence.

This is a remediation task, not authorization for new features or another milestone.

---

# 2. ABSOLUTE ARCHITECTURAL REQUIREMENTS

These requirements override implementation convenience.

## 2.1 One active runtime

At any moment:

```text
ACTIVE_RUNTIME_COUNT <= 1
```

The restriction must be enforced by the backend at the actual MCP request/connection boundary.

It must not exist only in:

- The frontend.
- REST endpoints.
- SQLite state.
- Client configuration.
- Documentation.

A runtime whose session is not the current valid owner must not execute MCP tools.

## 2.2 Shared persistent intelligence

Both runtimes must use:

- The same Council Bridge instance.
- The same SQLite database.
- The same memory APIs.
- The same agent identities.
- The same Council knowledge.
- The same historical organizational records.
- The same authorization model.

Switching runtimes must not:

- Reset memory.
- Duplicate memory.
- Create another database.
- Recreate agent identities.
- Deactivate Council members.
- Change agent responsibilities.
- Delete tasks or deliverables.
- Modify governance.
- Transfer canonical memory ownership to a runtime.

## 2.3 Preserve organizational structure

Do not change:

- The 11 Council seats.
- Four permanent founding personas.
- Seven replaceable seats.
- Founder authority.
- Six divisions.
- Six Division Heads.
- Forty-five specialists.
- Existing agent identity mappings.
- Existing permission boundaries.

No organizational reseeding or database cleanup is authorized.

---

# 3. STAGE 0 — REVALIDATE THE BASELINE

Before editing files:

1. Verify current branch.
2. Verify current HEAD.
3. Verify working tree.
4. Identify untracked files.
5. Verify whether commit `1b46398` is the current HEAD.
6. Inspect all changes since `56df3fb`.
7. Preserve every existing user modification.
8. Identify the exact current migration system.
9. Identify the exact MCP transport and server lifecycle.
10. Identify how Claude Code and Hermes authenticate.
11. Identify how the existing MCP tools resolve authenticated agent identity.
12. Identify how memory APIs resolve permissions.

If the branch or commit differs, stop and report the discrepancy.

Do not reset, clean, stash, overwrite, or discard user changes.

Create:

`docs/reports/SINGLE_ACTIVE_RUNTIME_REMEDIATION_BASELINE.md`

Document the current state and the precise files that require remediation.

---

# 4. P0 — ENFORCE RUNTIME OWNERSHIP AT THE MCP BOUNDARY

This is the highest-priority requirement.

## 4.1 Inspect the actual MCP request lifecycle

Inspect:

- `src/server.ts`
- Existing MCP transport initialization.
- Streamable HTTP request handling.
- MCP session creation and termination.
- Authentication middleware.
- Agent identity resolution.
- Tool registration.
- Tool invocation dispatch.
- Existing request context propagation.

Understand how an MCP request moves from HTTP authentication to MCP tool execution.

Do not implement a disconnected runtime check that is never invoked by actual MCP requests.

## 4.2 Introduce a mandatory runtime authorization guard

Every authenticated MCP request must be associated with:

- Runtime type.
- Runtime session ID.
- Authenticated agent identity.
- Request identity.
- Current runtime ownership state.

The guard must verify:

1. The runtime type is valid.
2. A runtime session exists.
3. The session is active.
4. The session ID matches the current owner.
5. The runtime type matches the owner.
6. The session has not expired.
7. The authenticated identity remains valid.
8. The request is authorized for the requested operation.

Reject the request before tool execution if any condition fails.

The check must apply to every protected MCP operation, not merely initialization.

## 4.3 Prevent stale MCP sessions

A runtime switch must invalidate the previous runtime's ability to execute tools.

A previously initialized MCP session must not remain authorized merely because its transport connection remains open.

If the old transport remains alive:

- Reject its subsequent protected requests.
- Prevent it from modifying Bridge state.
- Prevent it from reading protected memory.
- Prevent it from invoking Council tools.
- Prevent it from using stale authentication context.

Use the actual session ownership record as the authority.

Do not trust a client-supplied runtime type or session ID without authentication and ownership verification.

## 4.4 Ensure authorization cannot be bypassed

Check every MCP entry point.

Include:

- Initial connection.
- Existing session requests.
- Tool calls.
- Notifications that can affect state.
- Resource reads.
- Prompt/resource handlers if implemented.
- Any custom MCP routes.
- Any alternate API path that permits the same operation.

If some MCP operations are intentionally exempt, document and justify each exception.

No protected operation may bypass runtime ownership.

## 4.5 MCP connection conflict

If Claude Code is active and Hermes connects:

- Reject Hermes activation.
- Return a clear conflict response.
- Preserve Claude's active session.
- Do not create a second active session.

The reverse must behave identically.

Do not silently replace the existing owner.

Add an integration test that proves the rejected runtime cannot invoke tools.

---

# 5. P0 — CORRECT RUNTIME SWITCHING

The existing `switch()` implementation must be audited and corrected.

## 5.1 Distinguish connection state from database state

A database record marked `connected` is not proof of an actual connected MCP runtime.

Define the exact meaning of each lifecycle state.

At minimum:

- disconnected
- connecting
- connected
- disconnecting
- switching
- error

A transition to `connected` must require successful establishment and verification of the runtime connection.

Do not mark a runtime connected immediately after inserting a SQLite record.

## 5.2 Define the actual connection ownership model

Inspect whether MCP transport sessions can be tracked directly.

The implementation must have a reliable relationship between:

- Runtime session.
- MCP transport session.
- Authenticated identity.
- Runtime owner.
- Active lifecycle state.

Do not invent a second unrelated session-management system.

Use the existing transport's session identity where possible.

If an explicit runtime lease/session is required, associate it with the actual MCP connection.

## 5.3 Safe switching sequence

Implement the following semantics:

1. Authenticate the Founder or authorized switching actor.
2. Validate the requested runtime.
3. Acquire the lifecycle lock atomically.
4. Read the existing active owner.
5. If the target is already active, return its current state idempotently.
6. Mark the old session as disconnecting.
7. Invalidate the old session's authorization.
8. Close or terminate the old MCP transport where supported.
9. Confirm the old session can no longer execute protected operations.
10. Release the old session ownership.
11. Create the new runtime session.
12. Establish the new runtime connection.
13. Verify the new connection.
14. Mark the new session connected.
15. Release the lifecycle lock.
16. Return the confirmed final state.

If the new connection fails:

- Do not leave two active sessions.
- Do not restore authorization to an invalidated old session.
- Do not delete memory.
- Do not recreate identities.
- Return a clear recoverable error.
- Leave the system in a consistent state.

If rollback or recovery is necessary, document the exact behavior.

Do not claim the old runtime is disconnected if its protected operations remain authorized.

## 5.4 Avoid unsafe assumptions

Do not assume the Bridge can remotely start or stop Claude Code or Hermes unless a real supported mechanism exists.

If the runtime process cannot be started or terminated by Bridge:

- Clearly separate runtime process management from Bridge authorization.
- Implement authoritative Bridge-side session revocation.
- Ensure the old client cannot invoke protected tools.
- Document that the user may need to close or reconnect the local runtime client.
- Do not falsely report process termination.

The Founder must still be able to select the desired runtime without concurrent Bridge authorization.

---

# 6. P0 — FIX SESSION OWNERSHIP

Inspect and correct:

`src/runtime/lifecycle.ts`

Audit every operation that:

- Creates a session.
- Reuses a session.
- Renews a lease.
- Disconnects a session.
- Switches runtime.
- Recovers stale sessions.

## 6.1 Exact session ownership

All mutations must be bound to the exact session ID.

Do not update by runtime type alone when a session ID is available.

For example, this is insufficient:

```sql
UPDATE runtime_sessions
SET status = 'disconnected'
WHERE runtime = ?;
```

The operation must target the expected session and verify ownership.

Use conditional updates and transaction checks.

A stale session must not disconnect a newer session.

## 6.2 Connect idempotency

Repeated requests from the same valid session must not create duplicate sessions.

A new session must not silently replace an existing active session.

If the same runtime has an existing valid session, return the existing state only when ownership has been established.

Do not treat runtime type alone as sufficient ownership.

## 6.3 Switch ownership

A switch must require valid authority.

A missing session ID must not silently bypass ownership checks.

Determine whether the operation is:

- Founder-authorized administrative switching, or
- Runtime-owned switching.

Enforce the appropriate existing authorization policy.

Do not invent new privileges.

## 6.4 Disconnect ownership

The disconnect operation must:

1. Verify the exact session ID.
2. Verify the session is still current.
3. Verify the caller is authorized.
4. Perform the update conditionally.
5. Confirm exactly the intended session was changed.

If the session has already been superseded, return an appropriate conflict response.

---

# 7. P0 — FIX SQLITE CONCURRENCY AND STALE RECOVERY

The database must enforce the single-active-runtime invariant.

Use the existing SQLite infrastructure.

Do not introduce Redis or another external service.

## 7.1 Transaction scope

Inspect the complete transaction boundary.

A transaction must protect the entire critical state transition, not only the initial read or lock acquisition.

Use appropriate SQLite locking semantics, such as `BEGIN IMMEDIATE`, where supported by the existing database wrapper.

The same database connection must own the transaction from beginning to commit or rollback.

Do not:

- Commit the lock before performing the protected mutation.
- Read outside the transaction and mutate stale data later.
- Use separate connections for the critical transaction.
- Rely on a JavaScript mutex as the only concurrency control.

## 7.2 Atomic active-session ownership

Use appropriate database constraints.

The schema should make it impossible for two valid active runtime sessions to coexist.

Inspect whether a partial unique index is appropriate, for example:

```sql
CREATE UNIQUE INDEX ...
ON runtime_sessions(status)
WHERE status IN ('connecting', 'connected', 'switching');
```

This is illustrative only.

Choose the correct constraint based on the lifecycle state machine.

Do not create an index that prevents legitimate recovery or disconnection transitions.

Document how database constraints and transactions jointly enforce the invariant.

## 7.3 Stale-session recovery

Inspect `recoverStaleSessions()`.

The current implementation retrieves expired sessions before its transaction and updates by runtime identifier.

Replace this with atomic, exact-session recovery.

Required behavior:

1. Begin transaction.
2. Identify expired sessions.
3. Verify the exact session remains expired.
4. Verify ownership has not changed.
5. Update only the exact session.
6. Record recovery information.
7. Commit.
8. Roll back on failure.

A heartbeat racing with recovery must have deterministic, safe behavior.

A newer session must never be disconnected by an older recovery operation.

## 7.4 Process crash recovery

Test:

- Crash before session acquisition commits.
- Crash after acquisition commits.
- Crash during switching.
- Crash during disconnection.
- Bridge restart with an active session.
- Bridge restart with an expired session.
- Recovery while another process is connecting.

The resulting database state must be recoverable and must never authorize two runtimes.

---

# 8. P0 — FIX TIMESTAMP AND LEASE SEMANTICS

The current implementation uses ISO timestamps containing `T` and `Z`, while SQL compares values against SQLite `datetime('now')`.

Correct this inconsistency.

Choose one canonical timestamp representation.

Preferred options:

- Integer Unix milliseconds, or
- Consistent UTC ISO-8601 values parsed and compared as timestamps.

Use one representation consistently across:

- Connection creation.
- Heartbeat.
- Lease expiry.
- Active-session queries.
- Stale recovery.
- API serialization.
- Tests.

Do not compare incompatible timestamp strings.

## 8.1 Heartbeat

The current design uses:

- 10-minute lease.
- 30-second heartbeat.

Inspect whether those values are appropriate for the actual MCP transport and client behavior.

Do not assume frontend polling renews a runtime lease.

The heartbeat must be tied to an authenticated runtime session.

Only the current valid owner may renew its lease.

A heartbeat from an old session must not extend a new session or restore an expired session without the authorized recovery process.

## 8.2 Actual heartbeat integration

Determine how Claude Code and Hermes can provide reliable connection liveness.

If a runtime-side heartbeat cannot be implemented through the existing clients, do not fabricate one.

Instead:

- Use actual transport/session activity where reliable.
- Implement server-side expiration.
- Document the limitations.
- Ensure expiration cannot cause concurrent active ownership.
- Provide a safe reconnect path.

Test heartbeat renewal, lease expiry, and heartbeat/recovery races.

---

# 9. P0 — FIX MIGRATION 017 INITIALIZATION

Inspect:

- `migrations/017_add_runtime_sessions_table.sql`
- `src/infrastructure/database/database.ts`
- The migration registry.
- The migration runner.
- `src/server.ts`.
- Database startup and initialization order.
- Existing migration tests.

The previous audit found that runtime statements reference `runtime_sessions`, but migration 017 was not demonstrably integrated into startup initialization.

Resolve this.

## 9.1 Required behavior

A clean database must initialize correctly.

An existing database must migrate correctly through the official migration runner.

A database already at schema version 17 must not apply migration 017 twice.

A failed migration must roll back safely.

A database with existing organizational records must preserve them.

Do not edit previously applied migrations.

Do not create a second migration system.

Do not create the runtime table through an unrelated hidden startup side effect.

## 9.2 Verify compatibility

Test:

1. Empty database initialization.
2. Existing database migration to version 17.
3. Repeated startup.
4. Migration failure and rollback.
5. Existing agent records preserved.
6. Existing memory records preserved.
7. Existing messages preserved.
8. Existing tasks preserved.
9. Existing deliverables preserved.
10. SQLite integrity.
11. Foreign-key integrity.

## 9.3 Production restriction

Do not run the migration against the production database.

Do not modify:

`C:\Projects\council-bridge\data\council.db`

Do not generate a production migration backup or apply schema changes.

The task authorizes code and test changes only.

---

# 10. P0 — SHARED MEMORY INTEGRATION TESTS

These tests are mandatory.

Do not substitute mocks for the real Bridge memory API and SQLite database when integration tests are feasible.

Use an isolated temporary test database.

Do not use production data.

## Test A — Claude writes, Hermes reads

1. Initialize one Bridge instance.
2. Connect Claude through the actual MCP integration.
3. Authenticate a test agent.
4. Write memory using the existing memory tool/API.
5. Record the returned memory ID.
6. Disconnect or revoke Claude's session.
7. Verify Claude's old session cannot execute tools.
8. Connect Hermes.
9. Authenticate the same logical test agent.
10. Retrieve the memory through the existing memory API/tool.
11. Assert the same memory ID.
12. Assert exact content.
13. Assert provenance and authorization metadata.

## Test B — Hermes writes, Claude reads

Repeat the reverse direction.

## Test C — Memory survives process restart

1. Write memory through Claude.
2. Close the Bridge process.
3. Restart Bridge using the same test database.
4. Connect Hermes.
5. Retrieve the exact memory record.

## Test D — Council knowledge

1. Write an approved Council knowledge record through one runtime.
2. Switch runtime.
3. Retrieve the record through the other runtime.
4. Verify authorization and provenance.

## Test E — Private memory boundaries

1. Create private memory for Agent A.
2. Switch runtime.
3. Attempt retrieval as Agent B.
4. Verify access is denied.
5. Verify no sensitive content leaks in the response.

## Test F — No duplication

Switch repeatedly:

```text
Claude → Hermes → Claude → Hermes → Claude
```

Verify:

- No duplicate agent identities.
- No duplicate memory records.
- No duplicate Council knowledge.
- No accidental reset.
- No memory count changes without explicit writes.

---

# 11. P0 — REAL CONCURRENT PROCESS TESTS

The previous test suite used sequential operations to support a concurrency claim.

That is insufficient.

Implement tests using independent child processes and the same isolated SQLite database.

## Required tests

1. Claude and Hermes request activation simultaneously.
2. Exactly one activation succeeds.
3. Exactly one active owner remains.
4. The losing request receives a conflict.
5. Two simultaneous Claude connection requests do not create duplicate sessions.
6. Two simultaneous Hermes connection requests do not create duplicate sessions.
7. Two simultaneous switching requests cannot leave multiple owners.
8. A heartbeat races with stale-session recovery.
9. A stale disconnect races with a new connection.
10. Bridge crashes during switching.
11. A previous session attempts tool execution after switching.
12. The old session is rejected.

The tests must verify actual database state after each race.

Do not use timing assumptions or sleeps as the only synchronization mechanism.

Use explicit barriers, IPC coordination, or other deterministic synchronization.

Repeat important race tests sufficiently to expose concurrency defects.

Report the number of executions and the result of each test.

---

# 12. P0 — MCP END-TO-END VERIFICATION

The core requirement must be proven through the actual MCP interface.

REST API tests alone are insufficient.

Test both Claude Code and Hermes configurations against one Bridge instance.

Verify:

1. Claude MCP initialization.
2. Hermes MCP initialization.
3. Runtime identity association.
4. Authentication.
5. Tool discovery.
6. Tool invocation.
7. Active runtime enforcement.
8. Rejected second runtime.
9. Previous session revocation.
10. Memory write.
11. Cross-runtime memory read.
12. Council knowledge access.
13. Existing messaging.
14. Existing task operations.
15. Existing deliverable operations.

If actual Claude Code and Hermes clients cannot be launched in the automated test environment, distinguish:

- Real MCP protocol integration tests.
- Configuration validation.
- Manual client verification.

Do not describe configuration validation as a successful end-to-end client test.

---

# 13. FRONTEND REMEDIATION

Inspect:

`frontend/src/components/RuntimeControl.tsx`

Ensure the frontend displays backend-confirmed state.

Required:

- Active runtime.
- Connection status.
- Current session state.
- Lease/heartbeat status where appropriate.
- Switching progress.
- Connection errors.
- Rejected connection conflicts.

The UI must not claim a runtime is connected merely because a REST request returned successfully before MCP initialization.

Use the existing React 19, Vite, TypeScript, and MUI 9 architecture.

Preserve:

- Palette.
- Theme.
- Typography.
- Design tokens.
- Approved component styling.
- Existing page layouts.

Do not modify unrelated frontend pages.

Do not add decorative AI-themed patterns.

Do not add unrelated keyboard shortcuts.

Do not introduce another UI component library.

---

# 14. FILE CHANGE CONTROL

The previous implementation changed 24 files relative to `56df3fb`, including unrelated frontend pages and `NEXT_PROMPT.md`.

The existing manifest does not accurately account for those changes.

Correct the manifest.

Create or update:

`docs/reports/SINGLE_ACTIVE_RUNTIME_REMEDIATION_FILE_MANIFEST.md`

For every changed file include:

| Field | Required information |
|---|---|
| Path | Exact repository path |
| Previous responsibility | What the file did before remediation |
| Change type | ADD / MODIFY / DELETE |
| Exact modification | What changed |
| Reason | Which audit finding requires it |
| Related requirement | P0/P1/P2 reference |
| Tests | Which tests verify it |

Rules:

1. Every changed file must appear.
2. Every deleted file must be justified.
3. Every changed line must be attributable to the authorized remediation.
4. Do not reformat entire files.
5. Do not make unrelated semicolon changes.
6. Do not change quote style.
7. Do not reorder unrelated imports.
8. Do not alter line endings unnecessarily.
9. Do not rename unrelated variables.
10. Do not modify unrelated documentation.
11. Do not remove user changes.
12. Do not hide changes by regenerating files unnecessarily.

A one-character change is still a change and must be justified.

## 14.1 Unrelated changes

Inspect the following previous changes:

- `frontend/src/features/activity/pages/ActivityPage.tsx`
- `frontend/src/features/approvals/pages/ApprovalsPage.tsx`
- `frontend/src/features/auth/pages/LoginPage.tsx`
- `frontend/src/features/chat/components/AgentSelectionDialog.tsx`
- `frontend/src/features/chat/pages/ChatPage.tsx`
- `frontend/src/features/dashboard/pages/DashboardPage.tsx`
- `frontend/src/features/deliverables/pages/DeliverablesPage.tsx`
- `frontend/src/features/executions/pages/ExecutionsPage.tsx`
- `frontend/src/features/memory/pages/MemoryPage.tsx`
- `frontend/src/features/organization/pages/OrganizationPage.tsx`
- `frontend/src/features/tasks/pages/TasksPage.tsx`
- `frontend/src/shared/api/client.ts`
- `docs/archive/prompts/phase-10/NEXT_PROMPT.md`
- `tests/security/M3-004-nonces.test.ts`
- `.claude/scheduled_tasks.lock`

Determine whether each change is necessary.

Do not automatically revert existing changes.

Do not preserve unrelated changes merely because they were included in the previous commit.

If an unrelated change is already committed, do not rewrite Git history.

Any cleanup must be limited to the current authorized working-tree remediation and must preserve the existing branch history.

Document each decision.

---

# 15. REQUIRED REPORTS

Produce the following reports.

## Report A — Remediation Baseline

`docs/reports/SINGLE_ACTIVE_RUNTIME_REMEDIATION_BASELINE.md`

Include:

- Starting commit.
- Branch.
- Working-tree status.
- Existing implementation.
- Audit findings.
- Required remediation.

## Report B — Remediation File Manifest

`docs/reports/SINGLE_ACTIVE_RUNTIME_REMEDIATION_FILE_MANIFEST.md`

Include every changed file and its justification.

## Report C — Implementation Report

`docs/reports/SINGLE_ACTIVE_RUNTIME_IMPLEMENTATION_REPORT.md`

Include:

- Architecture.
- Actual MCP enforcement.
- Connection lifecycle.
- Runtime switching.
- Session ownership.
- Concurrency protection.
- Heartbeat and lease behavior.
- Migration behavior.
- Shared-memory verification.
- Security.
- Frontend behavior.
- File changes.
- Known limitations.

## Report D — Test Evidence

`docs/reports/SINGLE_ACTIVE_RUNTIME_TEST_EVIDENCE.md`

Include:

- Exact test commands.
- Test environment.
- Database setup.
- Actual test counts.
- Passed tests.
- Failed tests.
- Skipped tests.
- Cross-process race results.
- MCP integration results.
- Shared-memory test results.
- TypeScript output.
- Production build output.
- Database integrity output.

## Report E — Final Audit Checklist

`docs/reports/SINGLE_ACTIVE_RUNTIME_FINAL_AUDIT.md`

Include a requirement-by-requirement checklist.

Every completed requirement must reference evidence.

Every incomplete requirement must be explicitly marked.

---

# 16. DEFINITION OF DONE

## P0 — Architecture
- [ ] Exactly one runtime can execute protected MCP operations.
- [ ] Enforcement occurs at the actual MCP request boundary.
- [ ] Previous MCP sessions lose authorization after switching.
- [ ] Runtime switching verifies actual connection state.
- [ ] Runtime identity is separate from agent identity.
- [ ] Both runtimes use the same Bridge.
- [ ] Both runtimes use the same SQLite database.

## P0 — Security
- [ ] Exact session ownership is enforced.
- [ ] Stale sessions cannot disconnect newer sessions.
- [ ] Old sessions cannot execute tools after switching.
- [ ] Unauthorized runtime activation is rejected.
- [ ] Existing authentication remains fail-closed.
- [ ] Existing agent authorization remains intact.
- [ ] Private memory boundaries remain intact.
- [ ] No private keys or tokens are exposed.

## P0 — Concurrency
- [ ] SQLite transactions protect the full critical operation.
- [ ] Database constraints enforce single ownership.
- [ ] Independent child-process tests pass.
- [ ] Simultaneous activation leaves exactly one owner.
- [ ] Recovery and heartbeat races are safe.
- [ ] Crash recovery is safe.

## P0 — Shared intelligence
- [ ] Claude writes and Hermes reads the same memory.
- [ ] Hermes writes and Claude reads the same memory.
- [ ] Shared Council knowledge survives switching.
- [ ] Memory survives Bridge restart.
- [ ] Private memory remains isolated.
- [ ] Switching creates no duplicates.

## P0 — Database
- [ ] Migration 017 is correctly registered.
- [ ] Clean database initialization works.
- [ ] Existing database migration works.
- [ ] Repeated startup is safe.
- [ ] Rollback works.
- [ ] Existing records remain intact.
- [ ] SQLite integrity passes.
- [ ] Foreign-key integrity passes.
- [ ] Production database remains untouched.

## P1 — Integration and quality
- [ ] Claude MCP integration verified.
- [ ] Hermes MCP integration verified.
- [ ] Existing MCP tools remain functional.
- [ ] Existing Council workflows remain functional.
- [ ] Frontend reflects actual backend state.
- [ ] TypeScript has zero new errors.
- [ ] Production build succeeds.
- [ ] Regression tests pass or pre-existing failures are documented.
- [ ] All required reports exist.
- [ ] File manifest matches actual diff.

A test that was not executed must remain incomplete.

A behavior that was tested only through a mock must not be described as real end-to-end verification.

A runtime marked `connected` in SQLite is not sufficient proof of an actual MCP connection.

---

# 17. EXECUTION ORDER

Follow this order:

1. Revalidate baseline.
2. Write remediation baseline.
3. Inspect MCP transport and lifecycle.
4. Correct actual MCP runtime authorization.
5. Correct session ownership.
6. Correct switching.
7. Correct SQLite transaction boundaries.
8. Correct stale recovery.
9. Correct timestamp and heartbeat semantics.
10. Integrate migration 017.
11. Add cross-process tests.
12. Add shared-memory integration tests.
13. Add MCP end-to-end tests.
14. Correct frontend state representation.
15. Run regression tests.
16. Audit every changed file.
17. Produce all five reports.

Do not start M4.

Do not expand the task into unrelated architecture work.

If a requirement cannot be implemented because the current MCP transport or runtime client lacks a necessary capability, stop and document the limitation. Do not simulate successful behavior.

---

# 18. GIT AND PRODUCTION RESTRICTIONS

Work only on:

`refactor/repository-structure`

Do not modify `master`.

Do not:

- Commit.
- Push.
- Merge.
- Rebase.
- Force-push.
- Rewrite history.
- Delete branches.
- Reset the working tree.
- Run destructive cleanup.
- Modify production databases.
- Apply production migrations.

Leave all remediation changes uncommitted.

Preserve all existing user modifications.

---

# 19. FINAL RESPONSE REQUIRED FROM CLAUDE CODE

When finished, provide:

1. Starting commit.
2. Final HEAD SHA.
3. Current branch.
4. Working-tree status.
5. Files added.
6. Files modified.
7. Files deleted.
8. Files moved.
9. P0 findings resolved.
10. P0 findings unresolved.
11. Actual MCP enforcement evidence.
12. Cross-process concurrency results.
13. Shared-memory test results.
14. Migration verification results.
15. TypeScript result.
16. Production build result.
17. Full regression test result.
18. Database integrity result.
19. Known limitations.
20. Links or paths to all five reports.

Do not claim completion if any P0 requirement remains unverified.

**Final objective: Claude Code and Hermes must be mutually exclusive execution clients, while Council Bridge remains the single authoritative source of shared persistent intelligence.**