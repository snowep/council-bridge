# SINGLE ACTIVE RUNTIME — COMPLETE REMEDIATION & INTEGRATION PROMPT

## Project

**Repository:** `snowep/council-bridge`  
**Working branch:** `refactor/repository-structure`  
**Baseline commit:** `d610a2a`  
**Scope:** Complete and harden the Single Active Runtime implementation.  
**Primary objective:** Guarantee that only one runtime (Claude Code OR Hermes Agent) can actively communicate with Council Bridge at any given time, while both runtimes retain access to the same persistent organizational memory, identities, Council knowledge, and historical records.

---

# 1. EXECUTION RULES

Follow these instructions strictly.

1. Inspect the current repository and actual implementation before modifying anything.
2. Treat commit `d610a2a` as the starting baseline. Do not assume previous reports accurately describe the current code.
3. Preserve all existing user changes.
4. Do not perform unrelated refactoring.
5. Do not redesign the application.
6. Do not modify Council governance, membership, divisions, staff identities, permissions, tasks, deliverables, or organizational structure.
7. Do not create a separate Bridge instance or database for either runtime.
8. Do not create separate canonical memory stores for Claude and Hermes.
9. Do not remove existing functionality unless a specific defect requires it and the removal is documented.
10. Do not weaken authentication, authorization, signature verification, or Founder security.
11. Do not introduce Redis or another external infrastructure dependency.
12. Do not modify production data or apply production migrations without explicit Founder authorization.
13. Do not commit, push, merge, rebase, force-push, or rewrite Git history.
14. Do not begin M4.
15. Do not mark M3 or Single Active Runtime as accepted. Only the Founder can formally accept them.

Before implementation, produce a short source-based baseline report identifying the actual files, current behavior, and exact implementation gaps.

Then implement the corrections in controlled steps.

---

# 2. ORIGINAL ARCHITECTURAL REQUIREMENT

The system must support two interchangeable execution environments:

- Claude Code
- Hermes Agent

Only one runtime may be active at a time.

The intended workflow is:

**Option A**
1. Open Claude Code.
2. Claude connects to the existing Council Bridge.
3. Claude operates using the existing agent identities and shared organizational memory.
4. Close or disconnect Claude.
5. Open Hermes.
6. Hermes connects to the same Council Bridge.
7. Hermes retrieves the same persistent organizational memory and continues working.

**Option B**

The exact reverse sequence must work.

The runtime is an execution environment, not the owner of an agent identity or organizational memory.

Council Bridge owns:
- Agent identities.
- Council membership and governance.
- Division and staff identities.
- Shared Council knowledge.
- Persistent organizational memory.
- Approved agent memories.
- Message history.
- Tasks and delegation records.
- Deliverables and approvals.
- Runtime connection state and ownership.

Claude and Hermes are interchangeable runtime adapters.

Switching runtimes must never reset, duplicate, delete, or isolate the shared organizational state.

## Non-negotiable invariant

At any given time:

`ACTIVE_RUNTIME_COUNT <= 1`

This must be enforced by the backend and database, not merely by frontend controls.

A second runtime must not be able to bypass the restriction by calling MCP endpoints directly.

---

# 3. PRIORITY 0 — ENFORCE SINGLE ACTIVE RUNTIME AT THE MCP BOUNDARY

## Current known defect

The implementation at `d610a2a` still showed the `/mcp` endpoint registering and executing MCP tools without checking whether the requesting runtime owns the active runtime session.

The current pattern was:

```ts
app.all('/mcp', authMiddleware, async (req, res) => {
  const requestTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  const requestMcpServer = new McpServer(...);

  await requestMcpServer.connect(requestTransport);

  const authContext = getAuthContext(req);

  registerMcpTools(requestMcpServer, db, () => authContext);

  await requestTransport.handleRequest(req, res, req.body);
});
```

This means REST lifecycle protection alone does not guarantee runtime exclusivity.

Both Claude and Hermes could potentially invoke MCP tools while the database reports one active runtime.

## Required implementation

### 3.1 Identify the authenticated runtime

Inspect:
- `src/server.ts`
- `src/auth/`
- `src/runtime/lifecycle.ts`
- MCP authentication middleware.
- Runtime registration and identity resolution.
- MCP tool registration and execution paths.

Determine how an authenticated MCP request identifies its runtime.

Implement a trustworthy runtime identity resolution mechanism.

The runtime identity must come from authenticated server-side context, not:
- A user-controlled request body.
- A frontend selection.
- An arbitrary HTTP header without authentication.
- A client-provided agent ID.
- An unverified query parameter.

Do not confuse:
- Runtime identity.
- Agent identity.
- Council persona identity.
- Runtime session identity.

These are separate concepts.

### 3.2 Enforce ownership before MCP tool execution

Add a reusable backend guard.

Suggested file:

`src/runtime/runtime-ownership.middleware.ts`

Suggested contract:

```ts
interface RuntimeOwnershipContext {
  runtimeId: string;
  sessionId: string;
}

interface RuntimeOwnershipResult {
  allowed: boolean;
  activeRuntimeId?: string;
  reason?: string;
}
```

The exact types may be adjusted to match existing conventions.

The guard must:

1. Resolve the authenticated runtime.
2. Resolve its current runtime session.
3. Read the authoritative active session from SQLite.
4. Verify that the session belongs to the requesting runtime.
5. Verify that its status is `connected`.
6. Verify that the session lease has not expired.
7. Reject requests without a valid active session.
8. Reject requests from another runtime.
9. Reject stale sessions.
10. Fail closed if the database cannot establish ownership.

### 3.3 Enforce the guard at the correct execution boundary

Do not rely exclusively on Express route middleware if MCP tools can be registered or executed through another path.

Inspect the MCP server architecture and identify every path through which an MCP tool can execute.

Enforce runtime ownership at the shared MCP tool execution boundary wherever possible.

If tools are registered through:

`registerMcpTools(...)`

inspect the registration mechanism and determine whether a shared wrapper can protect every tool.

If so, implement a central wrapper rather than manually duplicating ownership checks across dozens of tools.

If certain tools require different permissions, preserve their existing authorization checks and add runtime ownership as an additional requirement.

Required execution sequence:

```text
Incoming MCP request
        |
        v
Authentication
        |
        v
Authenticated runtime resolution
        |
        v
Active session resolution
        |
        v
Runtime ownership validation
        |
        v
Existing tool-specific authorization
        |
        v
MCP tool execution
```

No tool should execute before the ownership check succeeds.

### 3.4 Reject unauthorized runtime requests

When a runtime does not own the active session:

- Do not execute the requested tool.
- Do not modify memory.
- Do not create messages.
- Do not create tasks.
- Do not modify deliverables.
- Do not modify Council records.
- Do not create a replacement session automatically.
- Return a structured authorization error.

Use an appropriate HTTP status and MCP error representation consistent with the existing protocol implementation.

Suggested error:

```json
{
  "error": "RUNTIME_NOT_ACTIVE",
  "message": "This runtime does not own the active Council Bridge session.",
  "activeRuntime": "claude"
}
```

Do not expose private session tokens, internal secrets, or sensitive runtime metadata.

### 3.5 Protect every MCP transport path

Inspect:
- `/mcp`
- Any legacy MCP endpoints.
- Any alternate MCP transport.
- Internal MCP tool invocation paths.
- Webhook-triggered MCP execution, if applicable.

Ensure there is no unprotected execution path.

### 3.6 Required tests

Add tests proving:

1. Active Claude can execute MCP tools.
2. Inactive Hermes cannot execute MCP tools.
3. Active Hermes can execute MCP tools after a valid switch.
4. Inactive Claude cannot execute MCP tools after the switch.
5. Missing runtime identity is rejected.
6. Missing session identity is rejected.
7. Expired sessions are rejected.
8. Disconnected sessions are rejected.
9. Unknown sessions are rejected.
10. Database errors fail closed.
11. A request cannot impersonate another runtime through request-body fields.
12. A request cannot impersonate another runtime through arbitrary headers.
13. Existing tool-level authorization remains effective.
14. Existing MCP functionality still works for the active runtime.

Include a test that attempts to invoke a real registered MCP tool through the actual MCP HTTP transport.

A unit test of the ownership helper alone is insufficient.

**Acceptance condition:** No MCP tool can execute through an inactive runtime.

---

# 4. PRIORITY 0 — IMPLEMENT REAL HEARTBEAT RENEWAL

## Current known gap

The lifecycle API supports heartbeat renewal, but there is no established evidence that the actual active runtime connection periodically invokes it.

Dashboard polling is not heartbeat renewal.

A frontend polling the runtime status every five seconds does not renew the lease.

The system currently uses approximately:
- 10-minute runtime lease.
- 30-second heartbeat interval.

Preserve these values unless the existing architecture provides a documented reason to change them.

## Required implementation

### 4.1 Identify the real runtime connection owner

Inspect:
- MCP transport creation.
- Runtime registration.
- Runtime lifecycle manager.
- Claude MCP configuration and connection flow.
- Hermes MCP configuration and connection flow.
- Server-side runtime session ownership.

Determine which component actually knows when a runtime connects and disconnects.

Do not implement a fake heartbeat in the Dashboard.

Do not treat browser polling as proof of runtime liveness.

### 4.2 Add a runtime heartbeat manager

Suggested file:

`src/runtime/heartbeat-manager.ts`

Suggested responsibilities:

- Start heartbeat renewal after successful runtime activation.
- Renew the exact active session.
- Use the session ID and runtime ID associated with that connection.
- Run approximately every 30 seconds.
- Stop when the runtime disconnects.
- Stop when the session is replaced.
- Stop when the runtime loses ownership.
- Prevent duplicate heartbeat loops.
- Avoid overlapping heartbeat requests.
- Handle temporary database or network failures.
- Emit structured operational logs without exposing credentials.

Example conceptual interface:

```ts
interface RuntimeHeartbeatManager {
  start(runtimeId: string, sessionId: string): void;
  stop(sessionId: string): void;
  stopAll(): void;
  isRunning(sessionId: string): boolean;
}
```

Adapt this to the existing project architecture.

### 4.3 Heartbeat renewal requirements

Every heartbeat must verify:

- Runtime ID matches the session owner.
- Session ID matches the active session.
- Session is connected.
- Lease has not already expired.
- The session has not been superseded.
- The update affects exactly the intended session.

Use an atomic SQL update.

Do not:
1. Read a session.
2. Release the database transaction.
3. Update a session later without rechecking ownership.

The ownership and expiry conditions must be part of the actual UPDATE statement.

A heartbeat must not revive an expired or revoked session.

### 4.4 Handle heartbeat failure

Define explicit behavior.

If a heartbeat fails because:
- The session is disconnected.
- The session has expired.
- The session was replaced.
- Another runtime owns the active lease.
- The database is unavailable.

The old heartbeat loop must not continue renewing a session.

The runtime must transition to a safe disconnected or ownership-lost state.

A transient database failure must not silently create a new runtime session.

Do not automatically reactivate a runtime after losing ownership.

Require a deliberate reconnect or recovery operation.

### 4.5 Handle connection termination

When a runtime disconnects:

1. Stop its heartbeat loop.
2. Release its exact session.
3. Mark the session disconnected.
4. Prevent future heartbeat renewal.
5. Ensure an old heartbeat cannot revive the session.

Use exact session ownership in SQL.

### 4.6 Required tests

Add tests for:

- Heartbeat starts after successful activation.
- Heartbeat renews the correct session.
- Heartbeat uses the correct runtime identity.
- Heartbeat stops after disconnect.
- Heartbeat stops after switching.
- Heartbeat does not renew a replaced session.
- Heartbeat does not renew an expired session.
- Heartbeat does not renew another runtime's session.
- Duplicate heartbeat loops are prevented.
- Overlapping heartbeat calls are prevented.
- Temporary database failures are handled safely.
- Recovery after a temporary failure does not create duplicate sessions.

Include at least one test that exercises the actual connection lifecycle rather than testing only the heartbeat helper.

**Acceptance condition:** A genuinely connected runtime renews its lease automatically without relying on Dashboard polling.

---

# 5. PRIORITY 0 — COMPLETE RUNTIME SWITCHING

## Required behavior

Switching from Claude to Hermes, or Hermes to Claude, must be a controlled lifecycle operation.

A database update alone is not sufficient to prove that the old runtime has disconnected or that the new runtime is operational.

## 5.1 Implement an explicit switching state machine

Define and document the valid states.

Suggested states:

```text
disconnected
    |
    v
connecting
    |
    v
connected
    |
    v
switching
    |
    v
disconnected
    |
    v
connecting
    |
    v
connected
```

Error and recovery states must also be defined.

Do not allow invalid transitions.

Suggested transition rules:

| Current state | Operation | Expected result |
|---|---|---|
| disconnected | connect | connecting |
| connecting | successful activation | connected |
| connecting | failed activation | disconnected or error |
| connected | disconnect | disconnected |
| connected | switch | switching |
| switching | old session released | disconnected |
| switching | new runtime activated | connected |
| switching | new activation fails | disconnected or recoverable error |
| connected | lease expires | disconnected |
| connected | ownership revoked | disconnected |

Use the existing status model where possible.

Do not add unnecessary state names if existing schema can express the required transitions.

## 5.2 Switching sequence

Implement the following logical sequence:

1. Authenticate the Founder or authorized caller.
2. Validate the requested target runtime.
3. Acquire the lifecycle transaction/lock.
4. Read the authoritative current session.
5. Mark the transition as switching.
6. Stop the previous runtime's heartbeat manager.
7. Revoke or disconnect the previous session.
8. Confirm the old session no longer owns the active lease.
9. Establish the new runtime session.
10. Initialize the new runtime connection using the actual available transport mechanism.
11. Confirm successful initialization.
12. Start the new heartbeat manager.
13. Mark the new session connected.
14. Commit the transition.
15. Return the actual final state.

If the new runtime cannot initialize, do not report it as connected.

If the runtime transport cannot be actively controlled by Council Bridge, explicitly distinguish:
- Database session revocation.
- Server-side request rejection.
- Physical process termination.

Do not claim that the Bridge can terminate an external Claude or Hermes process unless the implementation genuinely has that capability.

The old runtime must still be blocked from tool execution after revocation, even if its process remains open.

## 5.3 Atomicity and failure recovery

Use SQLite transactions and the existing `BEGIN IMMEDIATE` approach where appropriate.

Prevent:
- Two concurrent switch operations.
- Duplicate active sessions.
- Stale session ownership.
- An old runtime reclaiming ownership.
- A failed switch leaving two active sessions.
- A failed connection being displayed as connected.
- Heartbeat renewal during revocation.

Ensure database rollback leaves a consistent recoverable state.

## 5.4 Session ownership

Every disconnect, heartbeat, switch, and recovery operation must use the exact session ID.

Do not update sessions by runtime ID alone where multiple historical sessions may exist.

Do not let a caller disconnect another session by omitting the session ID.

If a session ID is mandatory, enforce it at the schema/API boundary.

## 5.5 Required tests

Test:
- Claude → Hermes.
- Hermes → Claude.
- Switching while already disconnected.
- Switching to the currently active runtime.
- Switching during a heartbeat.
- Switching during another switch.
- Switching when the target runtime fails initialization.
- Switching when the old session has expired.
- Switching with a stale session ID.
- Switching with an invalid runtime ID.
- Concurrent switch requests.
- Rollback after failed activation.
- Old runtime cannot execute MCP tools after switching.
- New runtime can execute MCP tools after successful switching.

**Acceptance condition:** Switching never produces two active runtime owners, and the new runtime is not reported as connected before successful activation.

---

# 6. PRIORITY 1 — HARDEN SQLITE SESSION OWNERSHIP AND CONCURRENCY

## Current known implementation

The `d610a2a` implementation uses SQLite-backed runtime sessions and `BEGIN IMMEDIATE`.

It also uses Unix millisecond timestamps in `connect()` and `switch()`, atomic heartbeat SQL, and conditional stale recovery.

Preserve the existing architecture.

Do not replace it with an external lock service.

## 6.1 Inspect all lifecycle SQL

Inspect every query related to:
- Session creation.
- Session activation.
- Session disconnection.
- Heartbeat renewal.
- Session switching.
- Stale-session recovery.
- Ownership lookup.
- Runtime recovery.

Ensure all operations use consistent timestamp representation.

Use Unix milliseconds consistently.

Do not mix:
- ISO strings.
- SQLite datetime strings.
- Unix seconds.
- Unix milliseconds.

### 6.2 Strict timestamp parsing

The existing `parseUnixMs()` implementation was reported to use permissive `parseInt()` behavior.

Replace permissive parsing with strict numeric validation.

Requirements:

- Accept only a valid integer representation of Unix milliseconds.
- Reject partially numeric strings.
- Reject empty strings.
- Reject whitespace-only values.
- Reject `NaN`.
- Reject `Infinity`.
- Reject negative values where invalid.
- Reject malformed timestamps.
- Never silently reinterpret an invalid timestamp.

Suggested approach:

```ts
function parseUnixMs(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const parsed = typeof value === 'number'
    ? value
    : Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}
```

Adjust according to actual schema and timestamp requirements.

Do not copy this blindly if the project has a stronger existing validation convention.

Add tests for:
- `"123abc"`
- `"2026-11-20T10:00:00.000Z"`
- `""`
- `" "`
- `"NaN"`
- `"Infinity"`
- `-1`
- `0`
- unsafe integers
- valid Unix millisecond timestamps.

### 6.3 SQLite uniqueness and invariants

Inspect the runtime session schema and migration 017.

Ensure the database enforces the single-active-runtime invariant.

A transaction-only implementation is not sufficient if a future code path can bypass the lifecycle manager.

Evaluate whether the schema should include a partial unique index or another database-level constraint ensuring that only one active session can exist.

For example, where compatible with the existing schema:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS
idx_runtime_sessions_single_active
ON runtime_sessions(connection_status)
WHERE connection_status = 'connected';
```

Do not apply this exact index without verifying that the schema's status model and historical data support it.

If the existing schema requires a different index, implement the correct one.

The database must prevent multiple connected sessions even if two application requests race.

### 6.4 Atomic stale-session recovery

Recovery must update only sessions that remain expired at the moment of the UPDATE.

Do not:
1. Read expired sessions.
2. Later update them by runtime ID alone.

Use an expiry condition inside the UPDATE statement.

Ensure a concurrent heartbeat cannot be overwritten by stale recovery.

### 6.5 Deterministic concurrent process tests

The existing evidence described the heartbeat/recovery race test as passing, but the inspected test was sequential.

A sequential test is not proof of a concurrent race.

Add actual child-process concurrency tests using independent SQLite connections.

Test at least:

**Scenario A — Identical nonce**
- Start multiple child processes.
- Submit the same nonce concurrently.
- Exactly one operation succeeds.
- All others fail safely.
- Database contains exactly one accepted operation.

**Scenario B — Distinct nonces**
- Start multiple child processes.
- Submit different valid nonces concurrently.
- All operations that satisfy the business rules succeed.
- No accidental duplicate or lost records occur.

**Scenario C — Heartbeat versus stale recovery**
- Process A attempts heartbeat renewal.
- Process B attempts stale recovery.
- Force controlled overlapping execution.
- Verify the final session state is consistent.
- A valid renewed session must not be disconnected by stale recovery.

**Scenario D — Concurrent runtime activation**
- Claude and Hermes attempt activation simultaneously.
- Exactly one obtains active ownership.
- The other is rejected.
- Database contains at most one connected session.

**Scenario E — Concurrent switch**
- Two switch requests run concurrently.
- Exactly one valid transition wins.
- No duplicate active session is created.

Use synchronization barriers or another deterministic coordination mechanism.

Do not rely only on `setTimeout()` or timing luck.

Each child process must use an independent database connection.

Clean up child processes, temporary databases, and test directories reliably.

### 6.6 Migration verification

Inspect migration 017 and the migration runner.

Verify:
- Migration 017 is registered.
- Fresh database creation applies it.
- Existing database upgrade applies it.
- Re-running migration is safe according to project conventions.
- Migration failures do not leave partial schema changes.
- Existing session records remain intact.
- Indexes and constraints are present after migration.
- Existing database version tracking remains accurate.

Do not apply the migration to the production database.

Use temporary test databases.

**Acceptance condition:** Database constraints, transactions, and independent-process tests establish the single-active-session invariant.

---

# 7. PRIORITY 1 — SHARED MEMORY MUST REMAIN RUNTIME-INDEPENDENT

## Non-negotiable requirement

Claude and Hermes must use the same persistent organizational memory.

Switching runtimes must not create isolated memory environments.

Canonical memory must remain owned by Council Bridge.

Do not move canonical memory into:
- Hermes local memory.
- Claude Code local memory.
- Runtime-specific files.
- Runtime-specific SQLite databases.
- Separate Council Bridge instances.

## 7.1 Inspect the existing memory architecture

Inspect:
- Memory services.
- Memory repositories.
- Agent memory storage.
- Shared Council knowledge.
- Message history.
- Memory approval/provenance.
- Agent identity resolution.
- Database initialization.
- MCP memory tools.

Identify the authoritative persistent storage for each memory category.

Do not create a second memory architecture.

## 7.2 Preserve the existing memory boundaries

The system must preserve the existing separation:

### Private/personal agent memory
Memory belonging to an individual agent, subject to its existing authorization boundaries.

### Shared Council knowledge
Approved and properly provenanced organizational knowledge available to authorized agents.

### Historical memory
Persistent records of prior messages, decisions, meetings, tasks, and other historical events.

Do not automatically convert private agent memory into shared Council knowledge.

Do not weaken existing permissions to make cross-runtime access easier.

## 7.3 Runtime-independent memory access

The memory lookup must use stable agent identity and authorization context, not the runtime's local filesystem.

Conceptual relationship:

```text
Claude Runtime ──────┐
                     |
                     v
              Council Bridge
                     |
                     v
             Shared SQLite DB
                     |
        ┌────────────┼────────────┐
        |            |            |
   Agent Memory  Council      History
                 Knowledge
```

Hermes must use the same path.

A runtime switch must not:
- Clone memories.
- Reinitialize memories.
- Reset memory IDs.
- Change agent ownership.
- Duplicate Council knowledge.
- Delete history.
- Change memory approval status.
- Create runtime-specific copies of canonical memory.

## 7.4 Add actual shared-memory integration tests

Implement real integration tests using the existing Bridge memory APIs and the same temporary SQLite database.

Required scenario A:

1. Activate Claude.
2. Authenticate Claude.
3. Write a memory through the real MCP memory tool.
4. Verify the memory exists in Bridge-owned SQLite.
5. Disconnect Claude.
6. Activate Hermes.
7. Authenticate Hermes.
8. Read the memory through the real MCP memory tool.
9. Verify the exact record is accessible according to its permissions.

Required scenario B:

1. Activate Hermes.
2. Write an authorized memory.
3. Disconnect Hermes.
4. Activate Claude.
5. Read the same record.
6. Verify it remains accessible.

Required scenario C — Shared Council knowledge:

1. Write approved Council knowledge through Claude.
2. Switch to Hermes.
3. Retrieve the same approved knowledge.
4. Verify its ID and provenance remain unchanged.

Required scenario D — Private memory isolation:

1. Create private memory for Agent A.
2. Attempt access through an unauthorized agent using Claude.
3. Verify access is denied.
4. Switch to Hermes.
5. Attempt the same unauthorized access.
6. Verify access remains denied.

Required scenario E — History persistence:

1. Create messages and a task through Claude.
2. Switch to Hermes.
3. Verify authorized history and task records remain accessible.
4. Verify no duplicate records were created by switching.

Tests must exercise the actual memory services and authorization paths.

Do not use a mocked memory repository as the sole proof.

**Acceptance condition:** Both runtimes access the same persistent Bridge-owned organizational data while preserving private-memory isolation and authorization.

---

# 8. PRIORITY 1 — CORRECT THE RUNTIME CONTROL API

Inspect:

- `src/api/routes/runtime.routes.ts`
- `src/runtime/lifecycle.ts`
- Runtime database repository.
- Authentication middleware.
- Frontend runtime control component.

Ensure the API represents real backend state.

## Required API behavior

The API must support the existing lifecycle operations where applicable:

- Get active runtime.
- Get runtime session state.
- Connect.
- Disconnect.
- Switch.
- Heartbeat.
- Recover stale sessions.

Do not add redundant endpoints if an existing endpoint already provides the required behavior.

### 8.1 Validate every request

Validate:
- Runtime ID.
- Session ID.
- Operation type.
- Caller authorization.
- Session ownership.
- Required fields.

Use existing Zod schemas or the project's established validation system.

Reject malformed input.

### 8.2 Prevent ownership bypass

A caller must not:
- Disconnect another runtime's session.
- Renew another runtime's session.
- Switch without appropriate authorization.
- Recover arbitrary sessions.
- Supply a fake active runtime identity.
- Omit mandatory ownership information.

Founder-only recovery must remain Founder-only.

Preserve production authentication fail-closed behavior.

### 8.3 Accurate status response

Return enough information for the frontend to display the actual state:

```ts
interface RuntimeStatusResponse {
  activeRuntime: 'claude' | 'hermes' | null;
  connectionStatus:
    | 'connected'
    | 'disconnected'
    | 'switching'
    | 'error';
  sessionId?: string;
  leaseExpiresAt?: number;
  lastHeartbeatAt?: number;
  updatedAt: number;
}
```

Adapt to existing conventions.

Do not expose internal secrets or sensitive session tokens.

Do not report `connected` simply because a database row was inserted.

The status must represent the actual verified lifecycle state.

---

# 9. PRIORITY 2 — FRONTEND RUNTIME CONTROL

Inspect:

`frontend/src/components/RuntimeControl.tsx`

Also inspect the page/layout that owns this component.

Preserve the current MUI 9 and Google Material Design system.

Use existing vanilla MUI components.

Do not introduce generic AI-dashboard styling.

Do not redesign unrelated pages.

## Required frontend behavior

The runtime control must clearly display:

- Active runtime.
- Connection status.
- Current session state.
- Last successful heartbeat.
- Lease expiry, if useful and safe to display.
- Current transition state.
- Errors returned by the backend.

### 9.1 Switching

When the user switches runtime:

1. Disable duplicate switch actions.
2. Show switching state.
3. Call the backend.
4. Wait for the backend's verified result.
5. Display the actual new runtime state.
6. Show an actionable error if activation fails.
7. Never optimistically display a runtime as connected before backend confirmation.

### 9.2 Polling

Polling may be used to display runtime state.

Polling must not be represented as heartbeat renewal.

Do not implement duplicate frontend heartbeat logic if heartbeat ownership belongs to the server-side runtime connection manager.

### 9.3 Error handling

Handle:
- Runtime not active.
- Session expired.
- Switch failed.
- Authentication failure.
- Database unavailable.
- Runtime initialization failure.
- Ownership conflict.

Use existing Snackbar patterns.

Do not show success messages for failed or incomplete transitions.

### 9.4 Accessibility and responsiveness

Verify:
- Keyboard accessibility.
- Focus management.
- Accessible labels.
- Loading state announcements.
- Error announcements.
- Mobile and desktop layout.

Preserve the existing approved color palette, theme definitions, design tokens, typography, and styling.

Do not change approved styling as part of this runtime remediation.

---

# 10. PRIORITY 2 — OBSERVABILITY AND RECOVERY

Implement useful, minimal operational logging.

Log:
- Runtime activation requested.
- Runtime activation succeeded.
- Runtime activation failed.
- Runtime disconnected.
- Runtime switched.
- Heartbeat succeeded.
- Heartbeat failed.
- Ownership rejected.
- Lease expired.
- Stale session recovered.
- Concurrent activation rejected.

Each event should include, where appropriate:
- Runtime ID.
- Session ID.
- Timestamp.
- Operation.
- Result.
- Failure reason.

Never log:
- Private keys.
- Authentication tokens.
- HMAC secrets.
- Founder private credentials.
- Sensitive memory contents.

## Recovery behavior

Inspect the existing Founder-only recovery endpoint.

Ensure recovery:
- Requires the correct authorization.
- Uses atomic stale-session checks.
- Does not disconnect valid renewed sessions.
- Does not arbitrarily reset the active runtime.
- Does not delete memory or history.
- Does not create a new active runtime automatically.

Document manual recovery steps for a genuinely stuck session.

---

# 11. PRIORITY 2 — TESTING REQUIREMENTS

The final test suite must cover unit, integration, concurrency, MCP transport, memory, and frontend behavior.

Do not claim complete verification based only on lifecycle unit tests.

## 11.1 Unit tests

Cover:
- Timestamp parsing.
- Session ownership.
- Lifecycle transitions.
- Heartbeat behavior.
- Expiry.
- Recovery.
- Session replacement.
- Invalid input.
- Authorization failures.

## 11.2 Integration tests

Cover:
- Real SQLite session persistence.
- Runtime activation.
- Runtime switching.
- MCP ownership guard.
- Runtime disconnect.
- Heartbeat renewal.
- Database migration.
- Shared memory access.
- Private-memory isolation.
- Historical data persistence.

## 11.3 Cross-process tests

Use independent Node.js processes and SQLite connections.

Prove:
- Concurrent activation.
- Concurrent switching.
- Heartbeat/recovery race behavior.
- Nonce uniqueness.
- No duplicate active sessions.

The tests must coordinate concurrency deterministically.

## 11.4 MCP end-to-end tests

Use the real MCP HTTP transport and actual registered tools.

Prove:
- Claude can execute when active.
- Hermes is blocked when inactive.
- Hermes can execute after a successful switch.
- Claude is blocked after switching to Hermes.
- The inactive runtime cannot write memory or modify organizational records.

## 11.5 Frontend tests

Cover:
- Runtime status display.
- Switching.
- Loading.
- Failed switching.
- Expired sessions.
- Ownership conflict.
- Responsive layout.
- Keyboard accessibility.

## 11.6 Regression suite

Run all existing relevant tests.

Do not dismiss previously failing tests as pre-existing without comparing them against the baseline.

Report:
- Total tests.
- Passed.
- Failed.
- Skipped.
- Test suites.
- Exit code.
- Duration.

Include exact commands used.

## 11.7 Quality gates

Run:

```bash
npx tsc --noEmit
```

Run the existing backend test command.

Run the existing frontend test command.

Run the frontend production build.

Run ESLint and formatting checks according to repository conventions.

Do not modify unrelated tests merely to obtain a passing result.

Do not increase timeouts as a substitute for identifying the cause of a hanging test.

---

# 12. REQUIRED DOCUMENTATION AND REPORTS

Create or update the following files under `docs/reports/`.

## 12.1 SINGLE_ACTIVE_RUNTIME_BASELINE_AUDIT.md

Document:
- Baseline commit.
- Current architecture.
- Actual runtime lifecycle.
- Actual MCP execution path.
- Current memory architecture.
- Existing database schema.
- Existing tests.
- Every identified defect.
- Exact files affected.

## 12.2 SINGLE_ACTIVE_RUNTIME_FILE_MANIFEST.md

List every changed file.

For each file include:
- Path.
- Added / modified / deleted.
- Purpose.
- Reason for change.
- Related requirement.
- Test coverage.

The manifest must reconcile exactly with the actual Git diff.

Do not claim a complete manifest if files are omitted.

## 12.3 SINGLE_ACTIVE_RUNTIME_IMPLEMENTATION_REPORT.md

Document:
- Implemented architecture.
- Runtime lifecycle.
- MCP ownership enforcement.
- Heartbeat integration.
- Switching behavior.
- Database invariants.
- Migration integration.
- Shared memory behavior.
- Frontend behavior.
- Recovery behavior.
- Known limitations.

Clearly distinguish implemented behavior from planned behavior.

## 12.4 SINGLE_ACTIVE_RUNTIME_TEST_EVIDENCE.md

For each test category provide:
- Test file.
- Exact test name or scenario.
- Command.
- Result.
- Evidence.
- Whether it was a unit, integration, E2E, or cross-process test.

Do not label sequential tests as concurrent race tests.

Do not label mocked tests as actual MCP integration tests.

Do not label a lifecycle unit test as proof of actual runtime heartbeat integration.

## 12.5 SINGLE_ACTIVE_RUNTIME_FINAL_AUDIT.md

Include:
- Requirements checklist.
- Source verification.
- Test verification.
- Migration verification.
- Security review.
- Regression review.
- Remaining limitations.
- Unresolved defects.
- Final readiness recommendation.

## 12.6 Update the implementation prompt

Update the relevant `NEXT_PROMPT.md` only if it is the canonical project workflow document and the changes are appropriate.

Do not overwrite unrelated or pending M3 instructions.

Do not silently remove previous project requirements.

---

# 13. DEFINITION OF DONE

Every item must be explicitly classified as:

- PASS — independently verified from source and/or test evidence.
- PARTIAL — implemented but not completely verified.
- FAIL — not implemented or verification failed.
- NOT APPLICABLE — justified with an explanation.

## A. Runtime exclusivity

- [ ] Only one runtime can own an active session.
- [ ] Database enforces the single-active invariant.
- [ ] Concurrent activation is safe.
- [ ] Concurrent switching is safe.
- [ ] Stale sessions cannot reclaim ownership.
- [ ] Inactive runtime cannot execute MCP tools.
- [ ] All MCP execution paths enforce ownership.
- [ ] Authentication remains fail-closed.

## B. Heartbeat

- [ ] Actual active runtime automatically renews its lease.
- [ ] Heartbeat interval is approximately 30 seconds.
- [ ] Lease duration remains approximately 10 minutes.
- [ ] Heartbeat is tied to exact runtime and session ownership.
- [ ] Duplicate heartbeat loops are prevented.
- [ ] Heartbeat stops after disconnect or switching.
- [ ] Expired sessions cannot be revived.
- [ ] Heartbeat/recovery race is tested with real concurrency.

## C. Switching

- [ ] Claude → Hermes works.
- [ ] Hermes → Claude works.
- [ ] Previous session is revoked.
- [ ] Old runtime cannot execute tools after switching.
- [ ] New runtime is verified before being reported connected.
- [ ] Failed activation is recoverable.
- [ ] Concurrent switch operations are safe.
- [ ] Runtime process termination limitations are documented accurately.

## D. Database and migration

- [ ] All timestamps use consistent Unix milliseconds.
- [ ] Strict timestamp parsing is implemented.
- [ ] Atomic heartbeat SQL is correct.
- [ ] Stale recovery is race-safe.
- [ ] Session ownership uses exact session IDs.
- [ ] Migration 017 is integrated.
- [ ] Fresh database migration passes.
- [ ] Existing database migration passes using a temporary database.
- [ ] Historical records are preserved.
- [ ] No production database changes were made.

## E. Shared memory

- [ ] Claude and Hermes use the same Bridge-owned database.
- [ ] Claude-written memory is readable by Hermes under authorization.
- [ ] Hermes-written memory is readable by Claude under authorization.
- [ ] Shared Council knowledge remains shared.
- [ ] Private memory remains isolated.
- [ ] Message history persists.
- [ ] Tasks and deliverables persist.
- [ ] Runtime switching does not duplicate or reset organizational data.
- [ ] No runtime-specific canonical memory database exists.

## F. Frontend

- [ ] Runtime status reflects verified backend state.
- [ ] Switching UI reflects real lifecycle state.
- [ ] Error handling works.
- [ ] Duplicate operations are prevented.
- [ ] Accessibility is verified.
- [ ] Responsive behavior is verified.
- [ ] Existing approved palette and styling remain unchanged.

## G. Verification and reporting

- [ ] All relevant unit tests pass.
- [ ] Integration tests pass.
- [ ] Cross-process concurrency tests pass.
- [ ] Real MCP E2E tests pass.
- [ ] Shared-memory integration tests pass.
- [ ] Frontend tests pass.
- [ ] TypeScript passes.
- [ ] Production build passes.
- [ ] Existing regression suite is evaluated.
- [ ] Reports are complete and accurate.
- [ ] File manifest matches the actual diff.
- [ ] No unauthorized Git operations occurred.

---

# 14. REQUIRED EXECUTION ORDER

Implement in this order:

| Order | Work package | Priority |
|---|---|---|
| 0 | Baseline source audit | Mandatory |
| 1 | MCP runtime ownership enforcement | P0 |
| 2 | Actual runtime heartbeat integration | P0 |
| 3 | Safe runtime switching and state machine | P0 |
| 4 | SQLite constraints and lifecycle concurrency | P1 |
| 5 | Shared-memory integration and isolation tests | P1 |
| 6 | API validation and authorization | P1 |
| 7 | Frontend runtime control | P2 |
| 8 | Recovery and observability | P2 |
| 9 | Complete test and regression suite | Mandatory |
| 10 | Documentation and final audit | Mandatory |

Do not skip directly to frontend polish.

Do not report the implementation complete while P0 items remain unresolved.

If an implementation requirement cannot be completed because the actual Claude Code or Hermes connection mechanism does not expose the necessary lifecycle event, document the precise technical limitation and implement the strongest safe server-side enforcement available.

Do not fabricate runtime integration.

---

# 15. FINAL RESPONSE FORMAT

When implementation is complete, provide:

## 1. Executive result
- COMPLETE / PARTIALLY COMPLETE / BLOCKED.
- Whether Single Active Runtime is ready for Founder acceptance.

## 2. Implementation summary
Explain what changed in the actual code.

## 3. Architecture confirmation
Explain how:
- Claude connects.
- Hermes connects.
- Runtime switching works.
- Shared memory remains persistent.
- Inactive runtime access is blocked.

## 4. Changed files
Provide the complete file manifest.

## 5. Test evidence
Provide exact commands and actual results.

Separate:
- Unit tests.
- Integration tests.
- Cross-process tests.
- MCP E2E tests.
- Shared-memory tests.
- Frontend tests.
- TypeScript.
- Production build.

## 6. Definition of Done
Provide the completed PASS / PARTIAL / FAIL checklist.

## 7. Remaining issues
List every unresolved issue and its severity.

## 8. Git status
Report:
- Current branch.
- Starting commit.
- Working tree changes.
- Whether any commits were created.
- Whether anything was pushed.

No commit or push is authorized.

## 9. Final recommendation
Choose one:
- READY FOR FOUNDER ACCEPTANCE.
- NOT READY FOR FOUNDER ACCEPTANCE.
- BLOCKED BY EXTERNAL RUNTIME LIMITATION.

Do not mark it accepted.

---

# FINAL ARCHITECTURAL PRINCIPLE

**Council Bridge is the organization. Claude Code and Hermes are interchangeable execution environments.**

The organization must continue to exist independently of whichever runtime is currently connected.

Switching runtimes changes who executes work. It must not change who the agents are, what the Council knows, what the organization remembers, what work is in progress, or what has already happened.

The final implementation must prove this through actual MCP execution, SQLite persistence, cross-process concurrency testing, and real shared-memory integration tests.

Do not settle for a UI that says only one runtime is active. Enforce it at the backend, database, and MCP execution boundary.