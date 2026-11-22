# COUNCIL BRIDGE — MCP CONNECTION & RUNTIME BEHAVIOR: COMPLETE AUDIT AND REMEDIATION

**Repository:** `C:\Projects\council-bridge`  
**Branch:** `refactor/repository-structure`  
**MCP endpoint:** `http://127.0.0.1:3334/mcp`  
**Primary clients:** Claude Code and Hermes Agent  
**Target:** Reliable, secure, single-active-runtime MCP architecture.

**Execution:** Audit first. Fix second. Test after every fix. Repeat until verified.

**Git:** Do not commit or push.  
**Database:** Do not delete or reset production data.  
**Scope:** MCP, authentication, connections, runtime identity, switching, execution, memory, and related tests.

---

# 1. WHAT WE ARE BUILDING

Council Bridge is one server.

Claude Code and Hermes are two different clients.

Both connect to the SAME server and use the SAME database.

However, only ONE runtime may be active at a time.

The expected behavior is:

```text
                  COUNCIL BRIDGE
                 localhost:3334
                        |
                  MCP ENDPOINT
                        |
              Authentication System
                        |
                 Runtime Control
                        |
              ONE ACTIVE RUNTIME
                        |
              Shared SQLite Database
                        |
                 Shared Memory
```

The two possible operating modes are:

<box>
  <row align="center" gap={3}>
    <box flex="1" border radius="lg" padding={3} gap={2}>
      **Mode A — Claude**

      <badge color="success">Active</badge>
      - Claude authenticates as `claude`.
      - Claude owns the active session.
      - Claude can discover MCP tools.
      - Claude can execute authorized tools.
      - Hermes cannot execute.
    </box>
    <box flex="1" border radius="lg" padding={3} gap={2}>
      **Mode B — Hermes**

      <badge color="success">Active</badge>
      - Hermes authenticates as `hermes`.
      - Hermes owns the active session.
      - Hermes can discover MCP tools.
      - Hermes can execute authorized tools.
      - Claude cannot execute.
    </box>
  </row>
</box>

The user can switch between these modes.

Switching must never create another Council Bridge database.

Switching must never delete organizational memory.

Switching must never recreate agent identities.

Switching must never allow both runtimes to execute simultaneously.

## The five rules

1. Claude must always be identified as Claude.
2. Hermes must always be identified as Hermes.
3. Only one runtime can execute at a time.
4. Both runtimes use the same persistent Bridge memory.
5. An inactive or disconnected runtime cannot execute MCP tools.

These five rules are mandatory.

---

# 2. FIRST: PROTECT THE EXISTING PROJECT

Before doing anything, run:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
git diff --stat
git diff --name-status
```

Record the output.

The user may have uncommitted changes.

You MUST preserve them.

Never run:

```bash
git reset --hard
git clean -fd
git restore .
git checkout -- .
git stash drop
```

Do not:

- Delete untracked files.
- Overwrite user modifications.
- Reset the database.
- Delete execution records.
- Delete Council messages.
- Delete memories.
- Change Council membership.
- Change division or staff identities.
- Change governance rules.
- Commit or push changes.

If a file already contains user modifications, inspect the diff before editing it.

Only modify what is necessary for this task.

---

# 3. AUDIT THE ENTIRE MCP CONNECTION PATH

Do not immediately start changing code.

First understand how a real Claude or Hermes request travels through Council Bridge.

Inspect these files and their actual equivalents:

```text
src/server.ts
src/api/middleware/authentication.ts
src/api/middleware/index.ts
src/auth/founder.ts
src/auth/session.ts
src/auth/runtime-credentials.ts
src/api/routes/runtime.routes.ts
src/runtime/lifecycle.ts
src/runtime/runtime-ownership.middleware.ts
src/runtime/runtime-execution-guard.ts
src/infrastructure/database/database.ts
src/database.ts
```

Also inspect:

```text
tests/unit/
tests/integration/
migrations/
package.json
```

Do not assume every file exists.

Find the actual implementation.

## 3.1 Trace the real connection

Follow this exact sequence:

```text
1. Claude Code or Hermes starts.
             |
             v
2. MCP client reads its configuration.
             |
             v
3. Client connects to localhost:3334/mcp.
             |
             v
4. HTTP request reaches Express.
             |
             v
5. Authentication middleware runs.
             |
             v
6. Bridge determines runtime identity.
             |
             v
7. Runtime ownership is checked.
             |
             v
8. Execution permission is checked.
             |
             v
9. MCP transport handles the request.
             |
             v
10. MCP tools are registered/discovered.
             |
             v
11. Client calls a tool.
             |
             v
12. Tool executes through Bridge services.
             |
             v
13. Database operation is completed.
             |
             v
14. Execution permit is released.
```

At every step, answer:

- Which file handles this step?
- What data enters?
- What data leaves?
- What can fail?
- What happens when it fails?
- Does the error reach the client?
- Can an unauthorized request continue?

Create:

`docs/reports/MCP_CONNECTION_ARCHITECTURE_AUDIT.md`

Include the complete request flow.

---

# 4. LOOP 1 — FIX CLAUDE AND HERMES IDENTITY

**Priority: P0**

## Problem

Claude and Hermes must have different identities.

The server must not guess which client is connecting.

It must not use the active runtime to decide the identity of the incoming client.

It must not automatically identify every local connection as Claude.

It must not turn a runtime credential into Founder authorization.

## Expected behavior

```text
Claude credential
       |
       v
Verified credential
       |
       v
Runtime identity = claude


Hermes credential
       |
       v
Verified credential
       |
       v
Runtime identity = hermes
```

These identities must remain different even when the other runtime is active.

## What to inspect

Inspect:

```text
src/api/middleware/authentication.ts
src/auth/session.ts
src/auth/founder.ts
src/auth/runtime-credentials.ts
```

Search for:

```bash
rg "activeSession?.runtime"
rg "runtime: 'claude'"
rg "runtime: 'hermes'"
rg "local-founder"
rg "owner_type"
rg "founder_signed"
rg "Authorization"
```

Review every result.

## Required changes

### A. Separate three identities

Do not mix these concepts:

**Founder**

The human administrator who controls runtime switching.

**Runtime**

The execution client: Claude or Hermes.

**Agent/persona**

The organizational identity represented by a runtime when performing Council work.

These are different things.

### B. Give Claude and Hermes separate credentials

Each runtime must have its own secret credential.

Store only credential hashes in the database.

Never expose secrets in:

- Frontend code.
- Git.
- Logs.
- Error messages.
- Test output.

### C. Reject invalid credentials

Expected:

| Request | Result |
|---|---|
| Valid Claude credential | Claude |
| Valid Hermes credential | Hermes |
| Missing credential | Reject |
| Invalid credential | Reject |
| Revoked credential | Reject |
| Expired credential | Reject |
| Claude credential claiming Hermes | Reject |
| Hermes credential claiming Claude | Reject |

If an Authorization header is supplied but invalid, never fall back to local Founder authentication.

### D. Fix the ESM import problem

The previous audit found a runtime credential loading path using:

```ts
require('../../auth/runtime-credentials.js')
```

The project uses ESM.

Check whether this import can actually load.

Use the project's proper TypeScript/ESM import convention.

Do not catch import failures and silently allow authentication to continue.

A missing authentication module must cause authentication to fail closed.

## Tests

Create or update:

`tests/unit/runtime-authentication.test.ts`

Test every case in the table above.

Also test:

1. Claude remains Claude when Hermes is active.
2. Hermes remains Hermes when Claude is active.
3. Founder is not treated as Claude.
4. Runtime credentials cannot access Founder-only operations.

## Error correction loop

If Claude appears as Hermes:

1. Inspect credential lookup.
2. Inspect the returned runtime ID.
3. Inspect session creation.
4. Remove active-session identity inference.
5. Repeat the test.

If Hermes appears as Claude:

1. Inspect local auto-authentication.
2. Inspect default runtime values.
3. Inspect Hermes's Authorization header.
4. Verify its credential record.
5. Repeat the test.

If invalid credentials are accepted:

1. Inspect middleware order.
2. Inspect fallback behavior.
3. Reject invalid credentials immediately.
4. Repeat the test.

**Do not continue until both identities are independently verified.**

---

# 5. LOOP 2 — FIX MCP CLIENT CONNECTION

**Priority: P0**

## Problem

A correct identity is useless if the actual MCP client cannot connect.

Test the real client connection, not only an internal function.

## Inspect

- `src/server.ts`
- MCP SDK package and version.
- MCP transport initialization.
- Express route registration.
- Client-specific MCP configuration.
- Authentication headers.
- Session initialization and termination.
- Server shutdown.

## Verify the server

Start Council Bridge using the repository's actual startup command.

Check:

```bash
curl.exe -i http://127.0.0.1:3334/health
```

Then inspect the MCP endpoint.

Do not assume a GET request is a complete MCP test.

Use the installed MCP SDK's actual protocol and initialization requirements.

## Verify Claude configuration

Inspect the actual Claude Code configuration.

Confirm:

- Correct server name.
- Correct URL.
- Correct transport type.
- Correct Authorization header.
- Correct credential source.
- No plaintext secret committed to the repository.

## Verify Hermes configuration

Do the same for Hermes.

Hermes must use its own credential.

Never copy Claude's credential into Hermes configuration.

## Test actual connection

For each runtime:

1. Start the MCP client.
2. Connect to Council Bridge.
3. Complete MCP initialization.
4. Verify the negotiated protocol version.
5. Discover tools.
6. Verify tool names.
7. Call one safe read-only tool.
8. Verify the actual result.
9. Disconnect.

HTTP 200 does not mean MCP succeeded.

A JSON-RPC error inside HTTP 200 is still a failed operation.

## Possible connection errors

| Error | What to inspect | Required fix |
|---|---|---|
| Connection refused | Server process and port | Start correct server |
| 404 | Route registration | Correct `/mcp` route |
| 401 | Bearer credential | Correct authentication |
| 403 | Ownership and execution authorization | Correct active session |
| 500 | Stack trace and database | Fix actual backend error |
| Invalid JSON-RPC | MCP transport | Correct protocol handling |
| Initialize timeout | Transport lifecycle | Fix initialization |
| Tools missing | Tool registration | Register production tools |
| Needs authentication | Client header/config | Fix supported credential injection |
| Connection drops | Session and transport lifecycle | Fix connection handling |

Never disable authentication just to make a client connect.

## Required tests

Create or update:

`tests/integration/mcp-client-connection.test.ts`

The test must use the same production application and route registration as the real server.

Do not construct a separate fake Express app that copies the production logic.

**Loop completion:** Both clients must be capable of authenticating and discovering the expected tools independently.

If live clients are unavailable, mark live verification as pending. Do not pretend it passed.

---

# 6. LOOP 3 — FIX MCP INITIALIZATION AND TOOL DISCOVERY

**Priority: P1**

## Problem

The client may connect successfully but still fail to initialize or discover tools.

Inspect the actual MCP server implementation.

Verify:

- MCP SDK compatibility.
- Initialization lifecycle.
- Transport reuse rules.
- Tool registration timing.
- Session ownership.
- Request IDs.
- JSON-RPC error handling.
- Connection termination.

## Required behavior

For both Claude and Hermes:

```text
Connect
  |
  v
Authenticate
  |
  v
Initialize
  |
  v
Receive initialization result
  |
  v
Discover tools
  |
  v
Receive registered tool list
  |
  v
Execute authorized tool
  |
  v
Receive actual tool result
```

Tool discovery must not require the runtime to bypass authentication.

Do not register tools only for a test environment.

Use actual production tool registration.

## Tests

Test:

- Initialization succeeds.
- Duplicate initialization behaves correctly.
- Tool discovery succeeds.
- Unknown tool returns a valid error.
- Invalid arguments return a valid error.
- Tool execution errors are returned correctly.
- Disconnected sessions cannot continue using tools.

Do not claim success from HTTP status alone.

Parse and assert the actual JSON-RPC response.

---

# 7. LOOP 4 — FIX SINGLE-ACTIVE-RUNTIME CONNECTION BEHAVIOR

**Priority: P0**

## Problem

The server must never allow Claude and Hermes to execute at the same time.

However, both identities must remain valid.

Being authenticated does not mean being active.

## Expected behavior

Example: Claude is active.

```text
Claude connects
      |
      v
Claude authenticates
      |
      v
Claude becomes active
      |
      v
Claude executes
      |
      v
Hermes authenticates
      |
      v
Hermes is NOT active
      |
      v
Hermes cannot execute
```

After Founder-authorized switching:

```text
Founder requests switch to Hermes
      |
      v
Check current Claude session
      |
      v
Check active executions
      |
      v
Safely drain or cancel eligible work
      |
      v
Disconnect exact Claude session
      |
      v
Increase generation
      |
      v
Activate Hermes session
      |
      v
Verify exactly one active session
      |
      v
Hermes executes
```

## Inspect

```text
src/runtime/lifecycle.ts
src/runtime/runtime-ownership.middleware.ts
src/runtime/runtime-execution-guard.ts
src/api/routes/runtime.routes.ts
src/infrastructure/database/database.ts
```

## Required changes

1. Keep one authoritative active-runtime record.
2. Use atomic SQLite transactions.
3. Use exact session IDs.
4. Use monotonically increasing generations.
5. Reject stale generations.
6. Preserve historical session records.
7. Keep the existing unique active-session constraint.
8. Require Founder authorization for takeover.
9. Reject inactive-runtime execution.
10. Verify database consistency after every transition.

## Important: Do not delete session history

The previous implementation used:

```sql
DELETE FROM runtime_sessions WHERE runtime = ?;
```

Do not use destructive deletion as a way to solve a UNIQUE constraint.

A runtime switch must preserve:

- Historical sessions.
- Execution records.
- Audit information.
- Memory.
- Messages.
- Tasks.
- Deliverables.

Create a new session ID for each activation.

If the schema has an incorrect uniqueness rule, fix the schema through a proper migration.

Do not destroy records to work around a schema problem.

## Test both directions

Claude → Hermes:

- Claude active.
- Hermes requests activation.
- Founder authorizes switching.
- Claude disconnects.
- Hermes activates.
- Claude cannot execute.
- Hermes can execute.

Hermes → Claude:

Repeat in reverse.

Also test two activation requests arriving at the same time.

Exactly one must win.

---

# 8. LOOP 5 — FIX SESSION OWNERSHIP AND DATABASE CONSISTENCY

**Priority: P0**

## Problem

The previous audit found inconsistencies between:

- Runtime session table.
- Session IDs.
- Generation fields.
- Prepared statement arguments.
- Execution records.
- Migration definitions.

Do not assume TypeScript catches SQL errors.

## Inspect the actual database schema

Inspect:

```sql
PRAGMA table_info(runtime_sessions);
PRAGMA index_list(runtime_sessions);
PRAGMA foreign_key_list(runtime_sessions);
PRAGMA table_info(execution_records);
```

Inspect the migration registry.

Compare:

1. Migration SQL.
2. Database initialization SQL.
3. Prepared statements.
4. TypeScript interfaces.
5. Actual test database schema.

All five must agree.

## Check prepared statements

Inspect:

- Number of columns.
- Number of placeholders.
- Number of supplied arguments.
- Column types.
- Foreign keys.
- Unique constraints.

The previous audit found an apparent mismatch between lifecycle arguments and the runtime session insert statement.

Resolve this in the actual source.

## Required session behavior

Every new activation receives a new unique session ID.

Every session has:

- Runtime ID.
- Session ID.
- Generation.
- Connection status.
- Lease expiration.
- Creation time.
- Disconnection time.

Historical session rows must remain available.

## Required execution behavior

Execution records must reference valid sessions.

Do not cascade-delete historical execution records when a runtime switches.

If a session is disconnected, its execution history remains.

## Error handling

**UNIQUE constraint failed**

1. Identify the exact failing SQL.
2. Inspect existing rows.
3. Determine which unique constraint failed.
4. Correct session creation or transaction logic.
5. Preserve historical data.

Do not drop the constraint.

**FOREIGN KEY constraint failed**

1. Identify the parent and child tables.
2. Check deletion and insertion order.
3. Inspect cascade rules.
4. Preserve historical execution records.
5. Add a regression test.

**Generation column missing**

1. Inspect migration registry.
2. Add the next correct migration.
3. Update database initialization.
4. Update prepared statements.
5. Test fresh DB and upgrade DB.

Do not edit production records manually.

---

# 9. LOOP 6 — FIX EXECUTION PERMITS

**Priority: P0**

## Problem

A runtime may pass authentication but still be unauthorized to execute.

The execution guard must enforce ownership.

Inspect:

`src/runtime/runtime-execution-guard.ts`

## Required behavior

Before a tool executes, verify:

1. Runtime credential is valid.
2. Runtime identity is correct.
3. Session ID belongs to that runtime.
4. Session is connected.
5. Session is the active session.
6. Generation matches.
7. Lease has not expired.
8. Execution permit is valid.
9. Existing execution policy allows the operation.

## Prevent stale execution

Example:

```text
Claude generation 4 starts work
       |
       v
Founder switches to Hermes
       |
       v
Hermes generation 5 becomes active
       |
       v
Claude generation 4 tries another tool
       |
       v
REJECT
```

Claude must not continue executing with generation 4.

## Fix permit lifetime

The previous implementation had:

- A 30-second execution permit.
- A five-minute heartbeat renewal interval.

This is unsafe for long-running operations.

A permit may expire before the heartbeat renews it.

Fix this.

Use a clearly defined execution lease policy.

An operation that is genuinely running must not be mistaken for a completed operation merely because its original expiration timestamp passed.

## Required cleanup

Use `try/finally`.

Release the exact execution permit.

Clear associated timers.

Handle:

- Normal completion.
- Tool error.
- Client disconnect.
- Request abort.
- Runtime handoff.
- Server shutdown.

## Tests

- Active Claude executes.
- Inactive Hermes rejected.
- Active Hermes executes.
- Inactive Claude rejected.
- Old generation rejected.
- Expired session rejected.
- Long-running operation remains protected.
- Permit released after success.
- Permit released after error.
- Permit released after abort.

---

# 10. LOOP 7 — FIX HEARTBEAT AND CONNECTION LIVENESS

**Priority: P1**

## Problem

An MCP client may be connected but idle.

The runtime lease must not expire simply because no tool is being executed.

There are two different heartbeats:

**Connection heartbeat:** Keeps an active runtime session alive.

**Execution heartbeat:** Keeps a running operation authorized.

Do not confuse them.

## Required behavior

```text
Runtime connects
      |
      v
Session becomes active
      |
      v
Idle heartbeat starts
      |
      v
Tool starts
      |
      v
Execution heartbeat is maintained
      |
      v
Tool completes
      |
      v
Execution heartbeat stops
      |
      v
Idle heartbeat continues
      |
      v
Runtime disconnects
      |
      v
All associated timers stop
```

## Inspect

- `src/runtime/lifecycle.ts`
- `src/runtime/runtime-execution-guard.ts`
- `src/server.ts`
- MCP transport callbacks.
- Runtime routes.

## Required tests

- Idle Claude remains active.
- Idle Hermes remains active.
- Heartbeat renews the correct session.
- Old session heartbeat is rejected.
- Disconnected runtime cannot renew.
- Handoff stops the old runtime heartbeat.
- Server shutdown stops timers.
- No duplicate heartbeat intervals.

If the MCP transport does not support the required heartbeat behavior, implement an appropriate authenticated Bridge lifecycle endpoint or reconnect policy.

Do not pretend that execution-time heartbeat solves idle connection liveness.

---

# 11. LOOP 8 — VERIFY SHARED MEMORY

**Priority: P0**

## Problem

Claude and Hermes must use one shared organizational memory system.

The runtime switching feature must not create isolated memory stores.

## Required behavior

```text
Claude
  |
  v
Council Bridge Database
  |
  v
Shared Memory
  ^
  |
Hermes
```

Both runtimes access the same canonical Bridge database.

Do not create:

- Claude memory database.
- Hermes memory database.
- Separate Council Bridge instances.
- Separate Council history.
- Separate organizational knowledge stores.

## Test

1. Activate Claude.
2. Create a temporary shared-memory record using an authorized MCP tool.
3. Record its ID.
4. Switch to Hermes.
5. Read that exact record.
6. Verify the content and ID.
7. Create another record using Hermes.
8. Switch back to Claude.
9. Read both records.
10. Verify there is one canonical record for each write.

## Private memory

Also verify:

- Shared Council memory remains accessible according to existing permissions.
- Private agent memory remains private.
- Runtime switching does not grant extra memory permissions.
- A runtime cannot impersonate an agent by submitting another agent's ID.

Do not call a shared-memory test a private-memory test.

---

# 12. LOOP 9 — TEST THE REAL PRODUCTION MCP SERVER

**Priority: P0**

## Problem

Previous tests created separate Express applications that copied production behavior.

That is not enough.

The test must exercise the same application and MCP route used by the actual clients.

## Required change

Expose the production application through a reusable factory if necessary.

For example:

```text
Production server
       |
       v
createApplication()
       |
       +---- Authentication
       |
       +---- Runtime ownership
       |
       +---- Execution guard
       |
       +---- MCP endpoint
       |
       +---- Registered tools
```

Tests must use that same composition.

Do not write a second fake MCP server for testing.

## Test actual HTTP/MCP behavior

For Claude and Hermes independently:

- Initialize MCP.
- Discover tools.
- Call a safe tool.
- Verify the result.
- Verify database state.
- Verify runtime ownership.
- Verify execution record.

Also test:

- Invalid credentials.
- Inactive runtime.
- Stale session.
- Stale generation.
- Revoked credentials.
- Handoff during an operation.
- Duplicate requests.
- Transport disconnect.

Parse JSON-RPC results.

HTTP 200 alone is not proof of success.

---

# 13. LOOP 10 — TEST REAL CONCURRENCY

**Priority: P1**

## Problem

Sequential calls are not concurrency tests.

Do not write:

```ts
connectClaude();
connectHermes();
```

and label the test simultaneous.

## Required tests

### A. Claude and Hermes activate simultaneously

Submit both requests at the same time.

Expected:

- Exactly one wins.
- Exactly one connected session.
- No duplicate active runtime.

### B. Two simultaneous handoffs

Submit two competing switch requests.

Expected:

- Consistent final state.
- Correct generation.
- No duplicate active sessions.

### C. Execution and handoff race

Start a delayed operation.

Request a switch.

Expected:

- Safe drain or supported cancellation.
- No stale writes.
- No simultaneous execution.

### D. Heartbeat and recovery race

Run heartbeat and stale recovery concurrently.

Expected:

- A renewed lease is not disconnected.
- A genuinely expired session is recovered.

### E. Process restart

- Start a runtime.
- Stop the test server.
- Reopen the database.
- Recover stale sessions.
- Reconnect safely.
- Preserve memory and execution history.

Use separate connections or child processes when necessary.

Use synchronization barriers.

Do not depend on arbitrary delays to simulate races.

---

# 14. LOOP 11 — FIX TEST INFRASTRUCTURE

**Priority: P1**

The latest reported failure:

`tests/unit/runtime-execution-guard.test.ts`

All 64 tests reportedly pass, but the test file exits with a failure because of pending asynchronous handles.

The five-minute heartbeat interval is a suspected cause.

Inspect the actual timer lifecycle.

## Required changes

1. Track every heartbeat timer.
2. Associate timers with their execution permits.
3. Stop the correct timer when its permit ends.
4. Make cleanup idempotent.
5. Stop timers after failed requests.
6. Stop timers after aborted requests.
7. Stop timers after disconnect.
8. Stop timers after server shutdown.
9. Close test databases.
10. Remove only test-owned temporary files.

Do not call this a Node.js test-runner bug without evidence.

Do not fix it by shortening the interval until the root cause is known.

## Test database isolation

Every test must use its own database.

Do not let one test delete another test's directory.

Restore:

- Environment variables.
- Database singletons.
- Global state.
- Timers.
- Event listeners.

Run the test file alone and in the full suite.

Expected:

- All assertions pass.
- Process exits successfully.
- No open handles.
- No database leaks.

---

# 15. LOOP 12 — CHECK EVERY POSSIBLE CONNECTION FAILURE

Create:

`docs/reports/MCP_FAILURE_SCENARIO_MATRIX.md`

Use this matrix.

| Scenario | Expected behavior |
|---|---|
| Bridge server stopped | Client cannot connect |
| Wrong port | Connection refused |
| Wrong endpoint | 404 |
| Missing token | 401 |
| Invalid token | 401 |
| Revoked token | 401 |
| Expired token | 401 |
| Claude token used by Hermes | Reject or identify only as Claude; never impersonate Hermes |
| Hermes token used by Claude | Reject or identify only as Hermes; never impersonate Claude |
| Runtime not active | Reject tool execution |
| Old session used | Reject |
| Old generation used | Reject |
| Lease expired | Reject |
| Database unavailable | Fail closed |
| SQLite busy | Safe retry or clear failure |
| Unique constraint violation | Diagnose and preserve data |
| MCP initialization failure | Return protocol error |
| Tool discovery failure | Return protocol error |
| Unknown tool | Return tool-not-found error |
| Tool execution failure | Return execution error |
| Client disconnect | Clean up resources |
| Server restart | Safe recovery |
| Runtime switch | Old runtime fenced out |
| Both clients request activation | One active runtime only |
| Shared memory read | Same canonical record |
| Private memory read | Existing permission rules enforced |

For every failure, record:

- How it happens.
- What the client sees.
- What the server logs.
- Whether the database changes.
- Whether a retry is safe.
- How recovery works.
- Which test proves the behavior.

Never hide a database error behind a generic successful response.

Never allow a failed authentication operation to continue.

---

# 16. LOOP 13 — CHECK DATABASE MIGRATIONS AND DATA PRESERVATION

Inspect the actual migration registry.

Inspect:

- Runtime sessions.
- Execution records.
- Runtime credentials.
- Runtime control.
- Memory tables.
- Agent tables.
- Foreign keys.
- Unique indexes.

Compare:

```text
Migration SQL
Database initialization
Prepared statements
TypeScript models
Actual test database
```

They must agree.

If a migration is needed:

1. Select the next unused migration version.
2. Add the migration.
3. Register it correctly.
4. Test a fresh database.
5. Test upgrading an existing database copy.
6. Verify rollback behavior where supported.
7. Verify existing records remain intact.

Do not apply it to the production database without explicit authorization.

Run:

```sql
PRAGMA integrity_check;
PRAGMA foreign_key_check;
```

Verify that runtime switching does not delete:

- Execution records.
- Memory.
- Messages.
- Agent identities.
- Tasks.
- Deliverables.
- Historical sessions.

---

# 17. FILES TO INSPECT AND CHANGE

Use existing files where possible. Do not duplicate modules.

| File | Required work |
|---|---|
| `src/server.ts` | Actual production MCP route and transport lifecycle |
| `src/api/middleware/authentication.ts` | Correct independent runtime authentication |
| `src/auth/session.ts` | Separate Founder and runtime principals |
| `src/auth/founder.ts` | Founder-only control-plane authentication |
| `src/auth/runtime-credentials.ts` | Credential verification/provisioning if absent |
| `src/api/routes/runtime.routes.ts` | Secure runtime lifecycle endpoints |
| `src/runtime/lifecycle.ts` | Connect, disconnect, switch, heartbeat, recovery |
| `src/runtime/runtime-ownership.middleware.ts` | Active runtime authorization |
| `src/runtime/runtime-execution-guard.ts` | Execution permit and generation enforcement |
| `src/infrastructure/database/database.ts` | Correct schema and SQL statements |
| `src/database.ts` | Correct database initialization |
| `migrations/` | Only necessary new migrations |
| `tests/unit/` | Authentication, lifecycle, permit, heartbeat tests |
| `tests/integration/` | Actual MCP, switching, concurrency, shared-memory tests |
| `docs/reports/` | Audit, evidence, implementation, failure matrix |

Every file modification must have a reason.

Do not perform unrelated refactoring.

---

# 18. IMPLEMENTATION LOOP — HOW TO WORK

Follow this exact process.

```text
START
  |
  v
Inspect one problem
  |
  v
Understand its real cause
  |
  v
Write expected behavior
  |
  v
Modify the smallest necessary code
  |
  v
Run the relevant test
  |
  +------ PASS ------> Run regression tests
  |                         |
  |                         v
  |                    Record evidence
  |                         |
  |                         v
  |                    Next problem
  |
  +------ FAIL ------> Capture full error
                            |
                            v
                      Find root cause
                            |
                            v
                      Fix root cause
                            |
                            v
                      Rerun failed test
                            |
                            v
                      Rerun regression
                            |
                            v
                      Repeat until PASS
```

Do not move to the next dependent problem while the current one is failing.

For each loop, report:

```text
LOOP NUMBER:
PROBLEM:
FILES INSPECTED:
FILES CHANGED:
EXPECTED RESULT:
ACTUAL RESULT:
ERROR:
ROOT CAUSE:
FIX:
TEST COMMAND:
TEST RESULT:
REGRESSION RESULT:
STATUS: PASS / FAIL / BLOCKED
```

Do not report PASS without actual test evidence.

---

# 19. FINAL TEST REQUIREMENTS

Run the repository's actual test scripts.

At minimum:

```bash
npx tsc --noEmit
```

Then run:

- Runtime authentication tests.
- Credential tests.
- Founder authorization tests.
- Runtime lifecycle tests.
- Runtime ownership tests.
- Execution guard tests.
- Heartbeat tests.
- MCP connection tests.
- MCP initialization tests.
- MCP tool discovery tests.
- MCP execution tests.
- Runtime concurrency tests.
- Shared-memory tests.
- Database migration tests.
- Security tests.

Finally run the complete backend suite.

Run frontend tests/build only if frontend files were changed.

Do not invent test totals.

Record actual:

- Passed.
- Failed.
- Skipped.
- Exit code.
- Duration.

---

# 20. FINAL ACCEPTANCE CHECKLIST

Every item must be verified.

## Authentication

- [ ] Claude has its own verified credential.
- [ ] Hermes has its own verified credential.
- [ ] Founder is separate from both runtimes.
- [ ] Invalid credentials are rejected.
- [ ] Runtime identity never comes from the active session.
- [ ] No silent local Founder fallback exists on the MCP path.

## MCP connection

- [ ] Bridge starts correctly.
- [ ] Claude connects.
- [ ] Hermes connects.
- [ ] Both use the same MCP endpoint.
- [ ] Both initialize successfully.
- [ ] Both discover registered tools.
- [ ] Actual tool calls return correct results.
- [ ] Errors are reported correctly.

## Runtime lifecycle

- [ ] Only one runtime is active.
- [ ] Claude → Hermes works.
- [ ] Hermes → Claude works.
- [ ] Founder authorizes switching.
- [ ] Old sessions cannot execute.
- [ ] Old generations cannot execute.
- [ ] Session history is preserved.

## Heartbeat and execution

- [ ] Idle heartbeat works.
- [ ] Execution heartbeat works.
- [ ] Stale heartbeat is rejected.
- [ ] Long-running tools remain protected.
- [ ] All timers are cleaned up.
- [ ] All permits are released.

## Memory

- [ ] Claude can write shared memory.
- [ ] Hermes can read that memory.
- [ ] Hermes can write shared memory.
- [ ] Claude can read that memory.
- [ ] Only one canonical record exists.
- [ ] Private-memory restrictions remain intact.

## Reliability

- [ ] Real concurrent activation test passes.
- [ ] Real concurrent handoff test passes.
- [ ] Execution/handoff race passes.
- [ ] Heartbeat/recovery race passes.
- [ ] Process restart recovery passes.
- [ ] SQLite integrity is `ok`.
- [ ] No foreign-key violations.
- [ ] Test files exit successfully.
- [ ] No leaked handles.

---

# 21. REQUIRED FINAL REPORTS

Create:

1. `docs/reports/MCP_CONNECTION_ARCHITECTURE_AUDIT.md`
2. `docs/reports/MCP_FAILURE_SCENARIO_MATRIX.md`
3. `docs/reports/MCP_CONNECTION_IMPLEMENTATION_REPORT.md`
4. `docs/reports/MCP_CONNECTION_CHANGE_MANIFEST.md`
5. `docs/reports/MCP_CONNECTION_TEST_EVIDENCE.md`

The final report must clearly separate:

- Source code inspected.
- Source code changed.
- Unit tests.
- Integration tests.
- Actual production HTTP/MCP tests.
- Actual Claude Code tests.
- Actual Hermes tests.
- Shared-memory tests.
- Tests not performed.

Do not claim a live client connection from a simulated test.

Do not claim shared memory works because two functions use the same database object in a unit test.

---

# 22. FINAL RESULT

The finished system must behave like this:

**When Claude is active:**

- Claude connects to Council Bridge.
- Claude is identified as Claude.
- Claude discovers tools.
- Claude executes authorized tools.
- Hermes cannot execute.
- Both still use the same persistent organizational memory.

**When Hermes is active:**

- Hermes connects to Council Bridge.
- Hermes is identified as Hermes.
- Hermes discovers tools.
- Hermes executes authorized tools.
- Claude cannot execute.
- Both still use the same persistent organizational memory.

**When switching:**

- Founder authorizes the switch.
- Existing execution is handled safely.
- Old runtime is disconnected and fenced out.
- New runtime receives a new session.
- Generation advances.
- New runtime becomes the only active runtime.
- No memory or execution history is deleted.

## Final verdict

Choose exactly one:

- `READY FOR FOUNDER AUDIT`
- `REMEDIATION INCOMPLETE`

Do not claim formal acceptance.

Do not commit or push.

Do not apply production migrations.

Do not modify unrelated M4 work.

**START NOW: Perform the complete MCP connection audit first. Then execute the remediation loops in order. Preserve existing work and report every result with evidence.**