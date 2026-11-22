COUNCIL BRIDGE — COMPLETE REPOSITORY IMPROVEMENT & REMEDIATION

Project: snowep/council-bridge
Local repository: C:\Projects\council-bridge
Target branch: refactor/repository-structure
Audit baseline: 705e37ed1dfcbdc1e161f7f9f0ae947cbaf5c719
Task: Complete repository-wide implementation remediation, architecture synchronization, testing, and documentation reconciliation.

1. YOUR ROLE

You are the senior engineer responsible for repairing and synchronizing the entire Council Bridge repository.

You are not being asked to perform another superficial audit or write a list of suggestions.

You must inspect the actual repository, understand the existing implementation, fix confirmed problems, add missing functionality where required, test the changes, and verify that related files agree with one another.

Work carefully. Make minimal, controlled changes. Do not create unnecessary abstractions or redesign working features without a concrete reason.

A problem is not solved simply because TypeScript passes or a unit test passes.

A fix is complete only when:

The actual source code is corrected.

All dependent files are synchronized.

The relevant tests exercise the real behavior.

Existing functionality still works.

Security boundaries remain intact.

Documentation reflects the actual implementation.

Evidence supports the reported result.

Do not declare success because a change looks correct.

2. CRITICAL RULES

These rules apply to the entire implementation.

2.1 Protect the existing repository

Before doing anything:

Inspect the current Git branch.

Record the current HEAD.

Run git status --short.

Record all modified, deleted, and untracked files.

Inspect existing local changes.

Identify changes that existed before you started.

Preserve every existing user change.

Never execute these commands or their destructive equivalents:

git reset --hard

git clean -fd

git checkout -- .

git restore .

git stash

Force-push.

Delete or recreate the working branch.

Rewrite Git history.

Do not overwrite an existing user modification just because it conflicts with your preferred implementation.

When a conflict occurs, inspect both versions and merge the necessary changes.

Do not commit or push anything.

2.2 Protect the database

The operational database is not a test database.

You must not:

Modify data/council.db as part of implementation testing.

Run seed scripts against an operational database.

Delete production or operational records.

Drop operational tables.

Run experimental migrations against the operational database.

Reset database contents to make tests pass.

Rebuild the operational database from seed data.

Modify production data to match expected test counts.

Use isolated temporary SQLite databases for every migration and integration test.

When testing migration compatibility, construct representative legacy databases with realistic records.

A migration must demonstrate that existing data is preserved before it can be considered ready.

Do not apply new production migrations. Prepare and test them against isolated databases only.

2.3 Respect project scope

Do not start M4 implementation.

Do not claim that Phase 9, M2, M3, or any other unaccepted milestone has been formally accepted.

Do not introduce unrelated product features.

Do not change the Council's governance rules, membership, voting rights, divisions, staff structure, or Founder authority.

Do not change the product into a multi-user SaaS application.

2.4 Preserve product and design decisions

These are established product requirements:

Council Bridge is a persistent organizational coordination system, not another chatbot.

Claude Code and Hermes are separate execution runtimes.

Only one runtime may actively own the Bridge connection at a time.

Both runtimes use the same Bridge database.

Both runtimes share the same authorized organizational knowledge and memory.

Runtime switching must not delete historical records.

Agent identities are separate from runtime identities.

Founder authority is separate from runtime authority.

Council governance remains centralized.

Council membership remains 11 seats.

Four founding seats remain permanent.

Seven seats remain replaceable.

Division Heads and specialists are not Council voting members.

Six divisions and 51 logical division staff remain the organizational target.

Founder retains final authority.

Frontend rules

React 19.

React Router.

MUI 9.

Google Material Design.

Prefer official MUI components.

Do not add custom components when an official MUI component already provides the required behavior.

Do not add unnecessary libraries.

Do not introduce generic AI-generated dashboard styling.

Preserve existing approved colors, theme definitions, design tokens, and typography.

Do not change the palette as part of functional remediation.

Responsive and accessibility fixes may adjust layout, spacing, component arrangement, and interactions without changing approved visual styling.

Custom CSS is permitted only where official MUI functionality is insufficient.

3. THE NON-NEGOTIABLE ARCHITECTURE

Before implementing anything, understand and preserve these relationships.

FOUNDER
  |
  | Governs and authorizes
  v
COUNCIL BRIDGE
  |
  |-- Identity Registry
  |-- Council Governance
  |-- Divisions and Staff
  |-- Communication
  |-- Memory and Knowledge
  |-- Tasks and Delegation
  |-- Approvals and Execution Records
  |-- Database and Audit History
  |-- Runtime Lifecycle
  |
  +-------------------------+
  |                         |
  v                         v
CLAUDE CODE               HERMES
Runtime A                 Runtime B
  |                         |
  +-----------+-------------+
              |
              v
      SHARED BRIDGE DATABASE

Claude and Hermes are execution environments, not separate organizations.

They must never receive separate copies of canonical Bridge memory.

The database belongs to Council Bridge, not to Claude or Hermes.

3.1 Separate four identities

The implementation must distinguish:

A. Founder identity

The human Founder. Has authority defined by the project's security and governance rules.

B. Runtime identity

Identifies the authenticated execution environment:

claude

hermes

A runtime credential proves which runtime is connecting. It does not prove that the runtime is the Founder.

C. Organizational agent identity

Identifies the actual organizational actor:

Founder

Council seat

Division

Staff agent

A runtime can execute work for an authorized organizational agent. It must not impersonate another agent or acquire Founder authority simply because it uses Claude or Hermes.

D. Runtime session identity

Identifies one particular connection/activation of a runtime.

A session is not the agent identity. Disconnecting a runtime must not deactivate or recreate organizational identities.

Keep these identities separate throughout authentication, API requests, MCP handlers, database records, logs, and permission checks.

4. IMPLEMENTATION EXECUTION RULE

Work in the following order.

Do not skip a phase because another file appears to work.

Do not implement a later phase while an earlier phase has unresolved critical defects.

At the beginning of each phase:

Inspect the relevant existing code.

Trace the actual execution path.

Identify every dependent file.

Check existing tests.

Write down the exact problem.

Implement the smallest safe correction.

Add or update tests.

Run the tests.

Inspect the final code again.

Record the result.

Use this repeatable loop:

INSPECT
   |
   v
TRACE THE REAL EXECUTION PATH
   |
   v
IDENTIFY ROOT CAUSE
   |
   v
IMPLEMENT MINIMAL FIX
   |
   v
UPDATE DEPENDENT FILES
   |
   v
ADD REGRESSION TEST
   |
   v
RUN TESTS
   |
   +------ Failed ------+
   |                    |
   v                    |
READ ACTUAL ERROR       |
   |                    |
   v                    |
FIND ROOT CAUSE         |
   |                    |
   v                    |
FIX AND REPEAT --------+
   |
   v
RUN REGRESSION TESTS
   |
   v
VERIFY RELATED FILES
   |
   v
RECORD EVIDENCE

Never hide or suppress a failing test simply to achieve a green result.

Never replace a real test with a mock that avoids the failure.

Never weaken an assertion to make a broken implementation pass.

When a problem cannot be resolved safely, record the exact blocker, affected files, attempted correction, and remaining work. Continue with unrelated work where safe.

PHASE 0 — REPOSITORY BASELINE AND FILE OWNERSHIP

Objective

Establish the actual current repository state before changing any code.

The previous audit used a GitHub snapshot. Your task must work against the current local repository.

Inspect

Git branch and HEAD.

Working tree modifications.

Root files.

Backend structure.

Frontend structure.

All migrations.

All tests.

All active documentation.

All scripts and skills.

Git submodules.

Package manifests and lockfiles.

Create a complete tracked-file inventory.

Do not rely solely on the previous report's file count. The local repository may have changed.

Required checks

Check:

Files referenced by imports.

Files referenced by package scripts.

Files referenced by documentation.

Files referenced by runtime configuration.

Files referenced by tests.

Files that no longer have any consumers.

Duplicate implementation files.

Historical documentation that incorrectly describes current behavior.

Files that are tracked despite being ignored.

Missing files referenced by active instructions.

Missing submodule configuration.

Pay particular attention to:

.claude/skills/codegraph

.gitmodules

README.md

PRODUCT.md

DESIGN.md

package.json

frontend/package.json

tsconfig.json

frontend/tsconfig.json

migrations/

scripts/

skills/

docs/

tests/

Git submodule

The audit found a submodule entry for:

.claude/skills/codegraph

but no .gitmodules file in the audited tree.

Determine the correct submodule URL from reliable repository metadata.

Do not invent a URL.

If the original URL cannot be established, preserve the submodule entry and record the problem. Do not silently delete the submodule.

Expected result

Create:

docs/reports/REPO_BASELINE_INVENTORY.md

Record:

Branch and HEAD.

Original working-tree state.

Tracked-file inventory.

Directory structure.

Missing references.

Duplicate implementations.

Unused files.

Submodule condition.

Baseline test scripts.

Known discrepancies.

Do not perform cleanup yet.

PHASE 1 — AUTHENTICATION AND IDENTITY SEPARATION

Priority: Critical

This phase must be completed before the MCP runtime implementation is considered usable.

Main files

Inspect and reconcile:

src/auth/index.ts

src/auth/config.ts

src/auth/session.ts

src/auth/middleware.ts

src/auth/founder.ts

src/auth/runtime-credentials.ts

src/api/middleware/authentication.ts

src/api/middleware/index.ts

src/council/operations.ts

src/mcp/tools.ts

src/api/routes/hermes-bridge.routes.ts

src/api/routes/runtime.routes.ts

src/server.ts

Also search the entire repository for:

owner_type === 'founder'

owner_type !== 'founder'

founder_signed

requireFounder

requirePermission

hasPermission

runtime

session_id

local-founder

dev-fallback

Do not fix only the authentication middleware. Fix every authorization helper that consumes its result.

Problem A — Runtime credentials use the wrong token format

The previous implementation had this mismatch:

Authentication middleware removes the Bearer  prefix.

validateRuntimeCredential() expects a value with the Bearer  prefix.

Consequently, valid runtime tokens can fail validation.

Required behavior

Choose one consistent token contract.

Recommended approach:

HTTP middleware parses the Authorization header.

Middleware validates the Bearer scheme.

Middleware extracts the raw token exactly once.

Credential validator accepts only the raw token.

Validator hashes and looks up that raw token.

No second prefix extraction occurs.

Invalid tokens always fail closed.

Add tests for:

Valid Claude token.

Valid Hermes token.

Missing token.

Empty token.

Invalid token.

Revoked token.

Expired token.

Incorrect token scheme.

Oversized token.

Invalid database state.

Credential database unavailable.

Problem B — Runtime credentials must not become Founder credentials

The current authentication model incorrectly represents runtime credentials using Founder ownership.

Remove this design.

A runtime credential must not produce:

{
  owner_type: 'founder'
}

merely because the runtime is allowed to execute MCP operations.

Required architecture

Use a clearly defined discriminated authentication principal.

For example:

type AuthPrincipal =
  | {
      type: 'founder';
      founderId: 'founder';
      authenticationMethod: 'signed' | 'local-control';
    }
  | {
      type: 'runtime';
      runtimeId: 'claude' | 'hermes';
      credentialId: string;
    }
  | {
      type: 'agent';
      agentId: string;
      runtimeId: 'claude' | 'hermes';
    };

Adapt the actual type names and fields to the repository's conventions, but preserve the separation.

Do not use the old owner_type field as a substitute for authenticated principal type.

The runtime principal must never automatically receive:

Founder permissions.

Founder signatures.

Founder approval rights.

Founder ownership.

Unrestricted database access.

founder_signed must reflect actual verified Founder authorization, not a default value.

Problem C — Runtime identity cannot be inferred from the request body

Remove runtime identity inference from:

req.body.runtime

A caller cannot prove that it is Claude or Hermes by supplying a string.

Runtime identity must come from the credential validated against the database.

Do not trust:

Request body runtime values.

X-Runtime headers.

X-Session-ID headers.

Caller-supplied owner identifiers.

Unverified forwarded IP information.

Problem D — Local Founder mode and MCP runtime mode must be separate

Preserve local single-user Founder mode for the local dashboard.

However, local Founder authentication must not automatically authenticate an MCP request as a runtime.

Implement separate authentication policies:

Browser/API control plane

Local Founder mode may authorize the local Founder dashboard.

Loopback restriction remains enforced.

Never trust spoofed forwarded IP addresses.

Never allow local mode in production.

Preserve explicit Founder authorization boundaries.

MCP runtime endpoint

Requires a valid runtime credential.

Does not fall back to Founder authentication.

Does not accept local-founder as a general execution identity.

Does not trust runtime values in request bodies.

Invalid supplied credentials fail closed.

An absent runtime credential is rejected.

A local Founder browser session may manage runtime activation and switching, but it cannot be reused as the runtime's authentication credential.

Problem E — One random session ID per HTTP request is incorrect

The previous implementation generated:

session_id: randomUUID()

during authentication.

This creates a new identity for every HTTP request.

A runtime connection needs a stable, persistent session identity.

Required behavior

Authenticate the runtime credential.

Resolve the currently authorized runtime session.

Associate requests with the correct session.

Keep the same session identity across requests belonging to the same activation.

Generate a new session ID only when a genuinely new runtime activation is established.

Record a new activation without overwriting earlier session history.

Reject requests from a runtime that no longer owns the active connection.

Never infer the session from a client-supplied session ID without verifying ownership.

Problem F — Organizational agent identity

A runtime credential identifies Claude or Hermes. It does not automatically identify the organizational agent performing a task.

Implement an explicit identity resolution mechanism.

For a runtime request:

Resolve the authenticated runtime from its credential.

Resolve the requested organizational agent, where an agent context is required.

Verify the agent exists and is active.

Verify that the agent is authorized to use the authenticated runtime.

Build the effective operation context from verified database records.

Reject arbitrary or unauthorized agent identities.

Never allow a runtime request to impersonate Founder.

A runtime can represent several authorized agents, but the caller cannot freely select another agent's identity.

Use the existing runtime persona assignments and identity registry as the authoritative source wherever appropriate.

Problem G — Centralize authorization

Currently, authorization behavior differs between:

src/auth/index.ts

src/auth/session.ts

src/auth/middleware.ts

src/api/middleware/authentication.ts

src/council/operations.ts

Individual route files.

MCP tool handlers.

Create a coherent authorization layer.

Do not leave multiple independent implementations with contradictory Founder checks.

All authorization decisions must consider:

Principal type.

Organizational identity.

Runtime identity.

Runtime session.

Resource ownership.

Required permission.

Founder signature, where required.

Runtime assignment, where required.

Founder-only operations must require actual Founder authorization.

Required tests

Test the same permission through:

Authentication helper.

REST route.

Service function.

MCP tool.

Production request composition.

All layers must return consistent authorization results.

PHASE 2 — DATABASE AND RUNTIME SESSION ARCHITECTURE

Priority: Critical

Main files

src/infrastructure/database/database.ts

src/database.ts

src/runtime/runtime-types.ts

src/runtime/lifecycle.ts

src/runtime/runtime-execution-guard.ts

src/runtime/runtime-ownership.middleware.ts

migrations/017_add_runtime_sessions_table.sql

migrations/018_add_execution_records.sql

migrations/019_create_runtime_credentials.sql

migrations/020_create_runtime_control_table.sql

migrations/MIGRATION_MANIFEST.md, if present.

Problem A — Runtime sessions cannot be historical records

The existing model uses:

runtime TEXT PRIMARY KEY

This means only one session row can exist for each runtime.

That is not a proper session-history model.

A runtime can connect, disconnect, reconnect, switch away, and reconnect again. Each activation must remain independently identifiable.

Required behavior

Design a persistent runtime session table that supports:

Multiple historical Claude sessions.

Multiple historical Hermes sessions.

Exactly one active runtime session.

Stable session IDs.

Session generation.

Credential association.

Connection timestamps.

Heartbeat timestamps.

Lease expiry.

Disconnect timestamps.

Session status.

Failure details.

Use a session-oriented primary key.

For example:

runtime_sessions
  session_id
  runtime_id
  credential_id
  connection_status
  generation
  connected_at
  last_heartbeat_at
  lease_expires_at
  disconnected_at
  created_at
  updated_at
  last_error

Adapt names to existing conventions.

Do not delete the historical session just because another runtime connects.

Problem B — Runtime control must have one authoritative source

The repository contains a runtime_control table, but the lifecycle implementation does not consistently use it as the authoritative runtime pointer.

Fix this.

runtime_control must represent exactly one active runtime session or no active runtime.

Its state must agree with:

Runtime session records.

Runtime connection status.

Generation.

Execution permits.

Runtime API responses.

Every connect, disconnect, switch, recovery, and activation operation must update the control state atomically.

Use SQLite transactions with appropriate locking.

Do not perform a read outside a transaction and assume ownership remains unchanged.

Problem C — One active runtime invariant

The system must enforce:

ACTIVE RUNTIME COUNT <= 1

This must be enforced by both:

Transactional application logic.

A database-level constraint or equivalent final integrity mechanism.

Do not depend solely on React state or frontend button disabling.

Concurrent Claude and Hermes requests must never produce two active sessions.

Do not drop a unique index merely to make a constraint error disappear.

Design the new schema and indexes for the actual session-history model.

Problem D — Execution record foreign keys

The existing execution_records schema references runtime-session fields in ways that conflict with a historical session model.

Inspect all actual foreign keys using SQLite metadata.

The corrected design must ensure:

An execution belongs to an exact runtime session.

A historical execution cannot be deleted by reconnecting a runtime.

A runtime session cannot be deleted while dependent execution history exists.

Session ID reuse cannot corrupt execution history.

Historical execution records retain the correct runtime and generation.

Runtime history survives repeated switching.

Prefer restrictive deletion semantics for historical records.

Do not use cascading deletion for records that must be retained.

Problem E — Schema and prepared statement mismatch

Search every prepared statement and every caller.

For each statement, verify:

Correct table.

Correct column names.

Correct argument count.

Correct argument order.

Correct placeholder count.

Correct timestamp format.

Correct transaction boundaries.

Correct returned data type.

In particular inspect:

upsertRuntimeSession

getRuntimeSessionByRuntime

getRuntimeSessionBySession

getActiveRuntimeSession

getRuntimeControl

updateRuntimeControl

updateRuntimeSessionStatus

updateRuntimeSessionHeartbeat

insertExecutionRecord

getExecutionRecordBySession

completeExecutionRecord

cleanupExpiredExecutionRecords

Add tests that execute every prepared statement against a real isolated SQLite database.

Do not rely only on TypeScript to detect SQL parameter mismatches.

PHASE 3 — RUNTIME GENERATION AND EXECUTION SAFETY

Priority: Critical

Main files

src/runtime/lifecycle.ts

src/runtime/runtime-execution-guard.ts

src/runtime/runtime-ownership.middleware.ts

src/runtime/runtime-types.ts

src/infrastructure/database/database.ts

src/server.ts

Problem A — Generation is not propagated

The previous implementation added generation columns but did not consistently use them.

Correct the complete lifecycle.

Every activation and handoff must have a generation value.

For example:

Claude session A — generation 1
Hermes session B — generation 2
Claude session C — generation 3
Hermes session D — generation 4

The counter must be derived from authoritative persistent state.

Do not reset it to 1 for each new session.

Do not calculate it only in JavaScript memory.

Problem B — Execution permit must bind to exact session and generation

When an MCP tool begins execution:

Authenticate runtime.

Resolve active session.

Read current runtime-control generation.

Verify session identity.

Verify runtime identity.

Verify session status.

Verify lease.

Verify generation.

Check existing execution conflicts.

Create an execution record.

Commit the transaction.

Execute the tool.

The execution record must contain:

Execution ID.

Session ID.

Runtime ID.

Generation.

Start timestamp.

Status.

Execution heartbeat or renewal information.

Completion timestamp.

Error details, where applicable.

At every state-changing boundary, validate that the operation still belongs to the current generation.

Problem C — Switching while execution is running

Do not mark an execution complete merely because a runtime switch occurred.

Do not assume that updating a database row stops an already-running JavaScript callback.

A switch must handle running executions explicitly.

Required behavior:

If a running operation cannot be safely interrupted, do not silently treat it as cancelled.

Either wait for it to finish or reject the switch with a clear conflict.

If the operation supports safe cancellation, implement and verify cancellation.

Stale executions must be classified explicitly.

Never delete execution history as a way to clear a conflict.

A stale execution must not perform new protected state changes after losing its generation.

Test a tool that continues running while another runtime attempts to switch.

Problem D — Execution permit expiry

The existing implementation uses a 30-second execution permit and a five-minute heartbeat interval.

That relationship is incorrect.

A permit can expire before its heartbeat runs.

Separate:

Runtime session lease

Determines whether the runtime currently owns the Bridge connection.

Execution lease

Determines whether a particular tool execution is still active.

Execution renewal must be independent of runtime session renewal.

Never delete a running operation solely because its original 30-second expiry passed.

Add active-operation heartbeat renewal or another safe execution-liveness mechanism.

Test:

30-second execution.

Longer-than-30-second execution.

Five-minute execution.

Failed execution.

Abandoned execution.

Runtime switch during execution.

Process termination during execution.

Recovery after server restart.

Use controllable clocks where possible rather than making tests wait several real minutes.

PHASE 4 — CLAUDE AND HERMES MCP CONNECTION BEHAVIOR

Priority: Critical

This is the main product requirement of the current work.

Main files

src/server.ts

src/api/middleware/authentication.ts

src/api/routes/runtime.routes.ts

src/runtime/lifecycle.ts

src/runtime/runtime-ownership.middleware.ts

src/runtime/runtime-execution-guard.ts

src/mcp/tools.ts

src/auth/runtime-credentials.ts

frontend/src/components/RuntimeControl.tsx

docs/reports/MCP_CLIENT_CONFIG.md

Inspect the actual MCP SDK version installed in the repository.

Understand the actual behavior of:

McpServer

StreamableHTTPServerTransport

sessionIdGenerator

Initialization.

Request handling.

Tool discovery.

Tool calls.

Session termination.

Client reconnect behavior.

Do not invent SDK behavior.

Required runtime behavior

Scenario A — Start Claude

Claude Code connects to the Bridge MCP endpoint.

The request authenticates using Claude's credential.

The server identifies the runtime as Claude.

If the slot is empty, establish a Claude runtime session.

Persist the session and generation.

Set Claude as the active runtime.

Return successful MCP initialization.

Claude discovers available tools.

Claude executes an authorized tool.

The tool uses the shared Bridge database.

Scenario B — Start Hermes while Claude is active

Hermes authenticates using Hermes credentials.

The server identifies Hermes correctly.

The server checks the current active runtime.

It must not silently impersonate Claude.

It must not create a second active session.

It must not take over merely because the request contains runtime: "hermes".

Return a clear runtime conflict unless an authorized handoff has taken place.

Scenario C — Switch Claude to Hermes

Founder authorizes the switch, or the existing explicit authorized lifecycle process is used.

Validate the current runtime session.

Check active executions.

Prevent unsafe handoff while protected work is running.

Mark the previous session disconnected.

Preserve all old session and execution records.

Increment generation.

Create or activate a distinct Hermes session.

Update runtime control in the same transaction.

Verify Hermes ownership.

Allow Hermes MCP requests.

Reject requests from the stale Claude session.

Scenario D — Switch Hermes to Claude

The same rules apply in reverse.

Scenario E — Repeat switching

Test:

Claude
  -> Hermes
  -> Claude
  -> Hermes
  -> Claude

After every transition, verify:

Exactly one active runtime.

Unique session IDs.

Correct generation.

Correct runtime credential.

Preserved history.

Preserved execution records.

Shared memory.

Correct authorization.

Rejected stale sessions.

Important: MCP is not automatically a live process connection

The database may say connected, but that does not prove an external process is currently connected.

Do not falsely present a database flag as proof of a live transport.

Define precisely what connected means.

Inspect the actual MCP transport and client behavior, then implement a reliable lifecycle policy.

Heartbeat policy

Do not use a server-only timer that renews a runtime forever without checking whether the client remains alive.

A server-only heartbeat can keep a dead client marked connected indefinitely.

Choose a mechanism supported by the actual MCP connection behavior:

Protocol-level session/liveness mechanism, where available.

Authenticated client heartbeat.

Request-activity lease renewal with a documented inactivity/reconnect policy.

If the current Claude Code or Hermes MCP client does not support an independent idle heartbeat, do not pretend it does.

Use a clear lease-expiry and reconnect policy instead.

A genuine authenticated request may renew the current runtime's session only when that runtime still owns the authoritative active session.

A stale runtime must not be able to reclaim the slot after another runtime has taken ownership.

MCP response correctness

Check actual JSON-RPC results.

HTTP 200 does not necessarily mean MCP tool execution succeeded.

Test the response's JSON-RPC body.

Verify:

Initialize returns protocol capabilities.

Tool discovery returns the actual registered tools.

Tool calls return real data.

Tool errors are represented correctly.

Authentication failures have meaningful codes.

Runtime conflicts have meaningful codes.

Invalid sessions are rejected.

PHASE 5 — SHARED MEMORY AND ORGANIZATIONAL AUTHORIZATION

Priority: Critical

Main files

src/council/memory.ts

src/council/operations.ts

src/mcp/tools.ts

src/api/routes/memory.routes.ts

src/api/routes/tasks.routes.ts

src/api/routes/deliverables.routes.ts

src/api/routes/messages.routes.ts

src/runtime/runtime-shared-memory.test.ts, if present.

tests/integration/runtime-shared-memory.test.ts

Problem A — Private memory detail endpoint

The existing memory detail route calls requireAuth() and then retrieves memory directly.

This is insufficient.

An authenticated user must not be allowed to retrieve another agent's private memory merely by knowing its ID.

Required fix

Use the same centralized authorization policy for:

Memory listing.

Memory detail.

Memory search.

Memory update.

Memory deletion, if supported.

MCP memory tools.

REST memory routes.

The authorization check must happen before returning the memory content.

Test unauthorized access using a real private memory record.

Problem B — Shared memory must actually work from MCP

The shared SQLite database is necessary but not sufficient.

The organizational runtimes need actual authorized ways to access their memories.

Inspect the current MCP tool registry.

Implement the required memory capabilities through the MCP interface, reusing existing memory services.

Do not create a second memory service or a second memory database.

The memory tools must use the authenticated and validated organizational agent identity.

Support the appropriate categories already defined in the project, including:

Council shared memory.

Approved organizational knowledge.

Division shared/private memory.

Staff private memory.

Persona-specific memory.

Historical memory.

Preserve existing category semantics.

Do not broaden private access to make Claude/Hermes sharing easier.

Problem C — Shared-memory tests

Test the actual authorized MCP workflow.

Example:

1. Claude authenticates.
2. Claude acts as an authorized agent.
3. Claude writes a shared memory record.
4. Claude disconnects.
5. Hermes connects.
6. Hermes acts as an authorized agent.
7. Hermes reads the same shared memory record.
8. Hermes writes another shared record.
9. Claude reconnects.
10. Claude reads Hermes's shared record.

Verify that both runtimes use the same persistent database.

Also prove that unauthorized access to private memories is denied.

A council_shared record does not prove private-memory isolation.

Problem D — Audit the rest of the resource authorization

Inspect every REST endpoint and MCP tool.

At minimum verify:

Task listing.

Task detail.

Task assignment.

Task status changes.

Execution requests.

Execution approvals.

Execution history.

Deliverable listing.

Deliverable detail.

Deliverable history.

Deliverable review.

Deliverable approval.

Messages.

Conversations.

Council information.

Division information.

Staff information.

Memory.

Activity.

Use central service-layer authorization.

Do not rely on hiding information in the frontend.

Specific issue — hardcoded Founder context

Inspect src/api/routes/deliverables.routes.ts.

The deliverable history route currently constructs a Founder context directly.

Remove this behavior.

Use the authenticated requester context and the proper service-layer access policy.

Never manufacture a Founder identity inside an ordinary endpoint to bypass authorization.

PHASE 6 — API CONTRACT AND FRONTEND/BACKEND SYNCHRONIZATION

Priority: High

The frontend and backend must agree on the same response contract.

Do not fix frontend pages independently without inspecting the associated API.

Main backend files

src/api/routes/council.routes.ts

src/api/routes/tasks.routes.ts

src/api/routes/executions.routes.ts

src/api/routes/approvals.routes.ts

src/api/routes/deliverables.routes.ts

src/api/routes/quality.routes.ts

src/api/routes/activity.routes.ts

src/api/routes/memory.routes.ts

src/api/routes/runtime.routes.ts

src/api/routes/messages.routes.ts

Main frontend files

frontend/src/features/council/pages/CouncilPage.tsx

frontend/src/features/tasks/pages/TasksPage.tsx

frontend/src/features/executions/pages/ExecutionsPage.tsx

frontend/src/features/approvals/pages/ApprovalsPage.tsx

frontend/src/features/deliverables/pages/DeliverablesPage.tsx

frontend/src/features/activity/pages/ActivityPage.tsx

frontend/src/features/memory/pages/MemoryPage.tsx

frontend/src/features/chat/pages/ChatPage.tsx

frontend/src/components/RuntimeControl.tsx

frontend/src/shared/api/client.ts

frontend/src/shared/types/api.ts

Problem A — Define one response contract

The previous audit identified these mismatches.

Verify each one against current source.

Endpoint

Backend response observed

Frontend issue observed

/api/council/seats

{ seats }

Reads data

/api/council/constitution

{ data }

Stores wrapper

/api/deliverables

{ deliverables }

Reads data

/api/deliverables/:id

{ deliverable }

Stores wrapper

/api/deliverables/:id/versions

{ versions }

Reads data

/api/tasks

{ tasks }

Some consumers read data

/api/quality-thresholds

{ thresholds }

Reads data

/api/executions

{ executions }

Reads data

/api/executions/autonomy-levels

{ autonomyLevels }

Reads data

/api/executions/:id

{ execution }

Stores wrapper

/api/executions/:id/history

{ history }

Reads data

Recheck actual files before changing them.

Required solution

Define explicit TypeScript response types in:

frontend/src/shared/types/api.ts

Use those types consistently.

Do not use any just to avoid resolving a mismatch.

The API client should return typed response bodies.

Avoid changing a backend response shape if multiple existing consumers depend on it without updating those consumers.

Where possible, keep a single consistent response envelope.

Problem B — Wrong execution creation endpoint

Verify:

Frontend currently posts to /api/executions.

Backend previously exposed /api/executions/request.

Implement one authoritative endpoint.

Update the backend, frontend, tests, and API documentation together.

Do not leave two ambiguous creation endpoints.

Problem C — Deliverable listing

The existing list route obtains deliverables through:

listDeliverablesByTask(db, task_id ?? '')

When the UI omits task_id, this returns no matching task records.

Implement proper list behavior.

The endpoint should support the existing documented filters, including:

Task.

Status.

Submitter.

Pagination.

Do not fetch every deliverable and arbitrarily slice large datasets when database pagination is feasible.

Enforce authorization in the database query or service layer.

Problem D — Reviewer options

The frontend requests /api/founders.

Verify whether this endpoint exists.

If it does not:

Do not invent a fake response.

Do not silently swallow the missing endpoint.

Determine the actual intended reviewer source.

Implement a properly authorized endpoint if required.

Otherwise remove the unsupported request and correct the reviewer workflow.

Problem E — Council vacancies

The Council has 11 constitutional seats.

The Council API must expose the complete constitutional roster, including vacant seats.

Do not hide seven vacant seats merely because they have no current occupant.

The UI should clearly distinguish:

Permanent founding seats.

Replaceable occupied seats.

Vacant replaceable seats.

Do not create additional voting members to fill vacancies.

Problem F — Frontend behavior

Verify each page's:

Loading state.

Empty state.

Error state.

Retry behavior.

Form validation.

Success notification.

Error notification.

Pagination.

Detail retrieval.

Permission-based actions.

Refresh behavior.

A page must not report success when an API request failed.

Do not silently turn failed requests into empty arrays when doing so misrepresents the system state.

Use a real error state.

Do not change approved theme colors or typography.

PHASE 7 — DATABASE MIGRATION AND PATH SAFETY

Priority: Critical

Main files

src/database.ts

src/infrastructure/database/database.ts

src/migration-runner/cli.ts

src/migration-runner/registry.ts

src/migration-runner/ledger.ts

src/migration-runner/executor.ts

src/migration-runner/backup.ts

src/migration-runner/validator.ts

src/security/database-seeding-guard.ts

migrations/

Problem A — Two competing schema authorities

The existing repository uses:

Inline schema initialization in database.ts.

Numbered SQL migrations.

These must not silently drift apart.

Determine the current intended database initialization lifecycle.

Establish one authoritative, documented mechanism for schema evolution.

The application must not silently create a different runtime schema from the migration runner.

Every schema change must have:

A version.

A migration or canonical schema definition.

A verification test.

A documented upgrade path.

A data-preservation test.

Problem B — Do not edit applied migrations carelessly

Do not modify old migration files simply to make a fresh test database pass.

Existing migration checksums and deployment history matter.

For a correction to an already-existing schema:

Inspect migration history.

Inspect the actual legacy schema.

Construct a representative isolated legacy database.

Verify its existing data.

Create a new forward migration using the next available migration ID.

Test the migration against legacy and fresh database states.

Verify foreign keys.

Verify indexes.

Verify execution records.

Verify runtime session history.

Verify database integrity.

Do not assume that the next ID is necessarily 021. Inspect the registry and existing migrations.

Use an idempotent migration strategy appropriate for SQLite.

Problem C — Runtime table conversion

The historical-session requirement may require rebuilding runtime_sessions and execution_records.

Before writing a migration:

Inspect all foreign keys.

Inspect all indexes.

Inspect all prepared statements.

Inspect all table consumers.

Inspect any triggers.

Inspect whether tables are referenced elsewhere.

Understand SQLite table-rebuild behavior.

The migration must preserve:

Existing runtime sessions.

Existing execution records.

Runtime credentials.

Historical ownership metadata.

Timestamps.

Generation values.

Other dependent records.

Do not drop a table until its replacement has been verified.

Do not use ON DELETE CASCADE where it would remove historical execution data.

Test both:

Fresh database initialization.

Upgrade from the previous runtime schema.

Problem D — Migration runner path

The previous CLI uses a hardcoded:

const DB_PATH = 'data/council.db';

Remove this configuration mismatch.

Use one explicit database-path resolution function shared by the application and migration runner.

Resolve the path consistently from the supported environment configuration.

Before any migration command:

Print the canonical target path.

Print the environment.

Print the migration IDs to be applied.

Require explicit production authorization where applicable.

Refuse ambiguous database paths.

Production startup must not silently run unapproved schema changes.

If the production database is missing a required migration, fail with a clear message and provide the documented migration procedure.

Problem E — Migration ledger consistency

Reconcile:

schema_version.

migration_ledger.

Actual SQLite schema.

Migration registry.

Migration checksums.

Startup validation.

Do not blindly mark migrations as applied.

A migration may be recorded as complete only after verifying its actual postconditions.

If a historical database has an existing schema but incomplete ledger records, implement a carefully validated reconciliation procedure.

Do not infer that a migration ran merely because a schema version string is present.

Problem F — Rollback safety

Inspect RollbackEngine.

The existing backup-based rollback must be treated carefully because the database may still be open while a backup is restored.

Verify:

Database connection state.

Backup consistency.

WAL handling.

Restore target.

Ledger consistency.

Foreign-key consistency.

Data preservation.

Do not describe rollback as complete if the implementation is only partially supported.

Document any rollback method that remains unavailable.

Problem G — Database path guard

Inspect:

src/security/database-seeding-guard.ts

All bootstrap scripts.

src/server.ts.

Database initialization.

The guard must distinguish exact approved targets.

Do not classify a database as safe merely because its path contains the segment data.

Use canonical paths and a strict allowlist.

Test:

Relative paths.

Absolute paths.

Windows paths.

Symlinked directories.

Traversal attempts.

Missing nested directories.

Conflicting environment variables.

Production-like paths.

Test directories.

Development directories.

Production path authorization must require an explicitly approved path.

The server must validate its database target before opening or modifying the database.

Do not weaken production restrictions.

PHASE 8 — FOUNDER SIGNATURE AND SECURITY REVIEW

Priority: Critical

Main files

src/auth/founder.ts

src/security/database-seeding-guard.ts

scripts/bootstrap-database.ts

scripts/bootstrap-signed.ts

scripts/run-bootstrap.ts

tests/security/

Verify that the current implementation still meets the established Phase 8 security requirements.

Signature requirements

Verify the correct cryptographic algorithm.

Verify the correct public key.

Verify the key ID.

Verify operation binding.

Verify payload binding.

Verify timestamp tolerance.

Verify nonce replay protection.

Verify nonce storage.

Verify cross-process locking.

Verify failure behavior.

Critical checks

Invalid signatures must fail closed.

Invalid public keys must fail closed.

Missing keys must fail closed where required.

Corrupt nonce storage must fail closed.

Concurrent replay attempts must not both succeed.

Nonce lock ownership must be verified.

Lock release must not remove another process's lock.

Bootstrap authorization must occur before database mutation.

Production verification must not require loading the private key.

Private Founder keys must never reach the frontend.

Founder-only operations must use actual Founder authorization.

Runtime credentials must never substitute for Founder signatures.

Cryptographic consistency

The previous audit identified a documentation discrepancy:

README describes Ed25519.

src/auth/founder.ts generates RSA-2048.

Determine the actual intended and supported algorithm.

Do not change the algorithm just to match documentation.

Keep backward compatibility where necessary.

Update documentation only after verifying the real implementation.

Testing

Use the production nonce implementation in cross-process tests.

Do not copy a separate lock implementation into a worker and call that proof of production safety.

Test real child processes importing and executing the production implementation.

PHASE 9 — REST AND MCP TOOL REGISTRY

Priority: High

Main files

src/mcp/tools.ts

src/server.ts

src/api/routes/

src/council/operations.ts

src/council/memory.ts

src/council/divisions.ts

src/council/task-delegation.ts

Objective

Make the REST API and MCP tool registry consistent with the same services and authorization rules.

Do not duplicate business logic between REST and MCP.

Both interfaces should call shared service functions.

MCP tools

Inspect every registered tool.

For each tool, document:

Name.

Purpose.

Input schema.

Output schema.

Required identity.

Permission requirements.

Service function.

Error behavior.

Tests.

Check every tool for caller-controlled identity fields.

Examples include:

sender_id

agent_id

recipient_id

owner_id

requested_by_id

runtime

Never trust a supplied actor identity without validating it against authenticated context.

A tool must not be able to impersonate Founder.

Do not allow runtime identity to override organizational agent identity.

Tool registry completeness

Compare the actual registry against the project's product requirements.

Include communication, Council operations, task delegation, execution approval, deliverable workflows, and authorized memory capabilities.

Do not remove existing working tools just to simplify the registry.

Do not add tools without implementing their service and authorization behavior.

Error responses

Use consistent MCP error responses.

Distinguish:

Authentication failure.

Authorization failure.

Inactive runtime.

Runtime conflict.

Invalid session.

Expired lease.

Execution conflict.

Resource not found.

Validation error.

Database failure.

Do not leak secrets, SQL details, private memory contents, or sensitive internal state in client-facing error responses.

PHASE 10 — FRONTEND AUTHENTICATION AND RUNTIME CONTROL

Priority: High

Main files

frontend/src/app/App.tsx

frontend/src/app/auth-context.tsx

frontend/src/app/use-app-auth.ts

frontend/src/app/constants.ts

frontend/src/shared/api/client.ts

frontend/src/shared/types/api.ts

frontend/src/components/RuntimeControl.tsx

frontend/src/app/layouts/Layout.tsx

frontend/src/features/auth/pages/LoginPage.tsx

frontend/src/features/profile/pages/ProfilePage.tsx

frontend/src/features/settings/pages/SettingsPage.tsx

Problem A — Frontend and backend local mode disagree

The frontend currently enables local single-user behavior when:

LOCAL_SINGLE_USER_MODE === true || import.meta.env.DEV

The backend uses a separate environment setting.

This can cause the frontend to believe Founder mode is active while the backend is not operating under that mode.

Use an explicit shared configuration contract.

The backend remains authoritative.

Do not allow the frontend to grant itself permissions.

Problem B — Login workflow

Inspect the production login flow.

The existing login form sends owner type, owner ID, and runtime but does not provide the Founder signature required by production session creation.

Implement a correct supported authentication workflow.

Do not present preset development accounts as available production accounts.

Do not allow the user to select a Founder identity without real Founder authorization.

Problem C — Runtime control

The Runtime Control component must display real server state.

It must not fabricate a connected state.

It must show:

Active runtime.

Connection state.

Session status.

Last heartbeat or last request activity, as applicable.

Lease expiry, if used.

Runtime switch errors.

Disconnected state.

Recovery state.

Switching controls must be bound to real backend authorization.

The backend must validate Founder authority and session ownership.

Do not rely on disabling a button as a security control.

Show a clear error when a runtime switch is rejected because an execution is still running.

After a successful switch, refresh state from the server.

Problem D — Profile and Settings

Inspect existing behavior.

Do not claim password changes are supported when no password-management service exists.

Do not simulate profile persistence.

Do not claim email or push notifications are active when they are only local preferences.

Make the available functionality and unavailable functionality clear.

Preserve the approved UI theme.

PHASE 11 — TESTING AND CI

Priority: Critical

Root package

Inspect and correct:

package.json

package-lock.json

tsconfig.json

The previous audit found that:

The root test script references tests/migrations/**/*.test.ts, although that directory was absent.

The root test script does not include the E2E suite.

Root TypeScript checking does not include tests.

No GitHub Actions workflows were present.

Verify current state before modifying.

Test scripts

Create clear, reliable scripts for:

Backend unit tests.

Backend integration tests.

Backend security tests.

Migration tests.

E2E tests.

Backend typecheck.

Frontend typecheck/build.

Frontend lint.

Complete verification.

Do not combine unrelated test commands into a script that silently ignores errors.

Do not make the entire test suite pass by excluding problematic tests.

Test database isolation

Every integration test must own its database.

Use unique temporary paths.

Do not allow test cleanup to recursively delete a shared directory used by other tests.

Restore environment variables after each test.

Restore database singletons after each test.

Close all database handles.

Stop timers.

Clean up WAL and SHM files.

Do not leave pending asynchronous handles.

Required runtime tests

Create real production-composition tests for:

Claude authentication.

Hermes authentication.

Invalid runtime credential.

Revoked runtime credential.

Missing credential.

Runtime activation.

Runtime conflict.

Authorized switch.

Unauthorized switch.

Reverse switch.

Repeated switching.

Concurrent activation.

Concurrent switching.

Stale session rejection.

Generation mismatch rejection.

Execution during switch.

Long-running execution.

Session-history preservation.

Execution-history preservation.

Idle lease expiry/reconnect behavior.

Required MCP tests

Test the actual production HTTP application and route composition.

Do not create a second test-only Express implementation that merely imitates production.

Provide a testable production app factory or shared route-registration function.

The tests must verify:

MCP initialize.

MCP tool discovery.

Tool calls.

Correct response bodies.

Runtime authentication.

Runtime ownership.

Permission enforcement.

Successful handoff.

Rejection of stale runtime.

Actual shared-memory operations.

For tool discovery, assert the tool names and schemas rather than only checking HTTP status.

For tool execution, assert the returned data and database changes.

Required API contract tests

Every frontend-consumed endpoint must have a test checking its response shape.

Use shared response types where possible.

Test that frontend pages consume the correct data keys.

Cross-process tests

Use real child processes and independent SQLite connections for concurrency-sensitive logic.

Test simultaneous:

Runtime activation.

Runtime handoff.

Execution permit acquisition.

Heartbeat.

Stale recovery.

Founder nonce consumption.

Do not call sequential operations a concurrency test.

CI

Add a GitHub Actions workflow if none exists.

Use a Node version compatible with the checked-in frontend dependencies.

The pipeline should run:

Root install.

Backend tests.

Backend typecheck.

Frontend install.

Frontend build/typecheck.

Frontend lint.

Applicable E2E and security tests.

Do not mark an unexecuted check as passing.

PHASE 12 — DOCUMENTATION AND ARCHITECTURE SYNCHRONIZATION

Priority: High

After implementation, reconcile the active documentation with the actual source.

Files to inspect

README.md

PRODUCT.md

DESIGN.md

docs/hand_off.md

migrations/MIGRATION_MANIFEST.md

migrations/ledger_schema.sql

docs/reports/MCP_CONNECTION_AUDIT_REPORT.json

docs/reports/MCP_RUNTIME_IDENTITY_REMEDIATION_REPORT.md

docs/reports/MCP_RUNTIME_IDENTITY_CHANGE_MANIFEST.md

docs/reports/MCP_CLIENT_CONFIG.md

skills/database-seeding.md

Also inspect every active document that describes:

Authentication.

Founder signatures.

Runtime identity.

MCP configuration.

Runtime switching.

Memory architecture.

Database schema.

Migrations.

API endpoints.

Frontend setup.

Test commands.

Seed workflows.

Rules

Do not delete historical audit reports.

Mark superseded reports clearly.

Do not leave historical claims presented as current behavior.

Do not claim tests passed unless the exact tests were executed.

Do not claim live Claude/Hermes behavior without live evidence.

Do not claim shared private memory access without authorization tests.

Do not claim a migration is production-applied when it was only tested locally.

Use exact current package scripts and environment variable names.

Document actual Founder signature algorithms.

Document actual runtime client authentication requirements.

Document the actual runtime connection and expiration policy.

Document how to provision and revoke runtime credentials.

Document recovery procedures.

Document migration safety and backup requirements.

The database seeding skill currently references a script that was not present in the audited tree.

Find the actual supported seed entry point.

Correct the skill rather than creating a fake script reference.

Do not run the seed script against an operational database.

PHASE 13 — REPOSITORY HYGIENE AND STRUCTURE

Priority: Medium

Inspect the complete repository for obsolete files and unclear ownership.

Previously identified candidates include:

Root debug scripts.

Empty root npm and output.txt.

test_schema.mjs.

Debug files under tests/.

Tracked Playwright artifacts.

Historical debug utilities under scripts/archive/.

Duplicate legacy Council implementations.

The old CommonJS nonce worker.

The database-seeding skill's nonexistent script reference.

Missing submodule configuration.

Do not delete files just because their names look temporary.

For every candidate:

Search all references.

Check whether it is imported.

Check whether any package script uses it.

Check whether it is a fixture.

Check whether a historical workflow still needs it.

Determine whether it contains user-created material.

Decide whether it should remain, move, or be removed.

Record the decision.

Prefer moving historical utilities into a clearly named archive over destroying useful history.

Update .gitignore appropriately.

Do not ignore files needed by the project.

Do not modify the established MUI design merely to clean the frontend structure.

PHASE 14 — COMPLETE REGRESSION AND FINAL VERIFICATION

This phase begins only after the previous implementation phases have been completed or their blockers documented.

Run the complete applicable verification suite.

Backend

Unit tests.

Integration tests.

Security tests.

Migration tests.

E2E tests.

TypeScript.

Runtime authentication.

MCP production composition.

Database integrity.

Foreign-key checks.

Concurrency tests.

Frontend

TypeScript.

Production build.

Lint.

Playwright tests.

Responsive tests.

Accessibility tests.

API response-contract tests.

Database integrity

On isolated test databases, verify:

PRAGMA integrity_check;
PRAGMA foreign_key_check;

Verify:

Exactly one active runtime or none.

No duplicate runtime session IDs.

Correct active runtime-control pointer.

Generation consistency.

Execution history preserved.

Memory records preserved.

Foreign keys valid.

No orphaned execution records.

No unexpected duplicate identities.

Runtime switching acceptance sequence

Execute this exact sequence using the actual production application composition:

1. No runtime connected.
2. Claude authenticates.
3. Claude initializes MCP.
4. Claude discovers tools.
5. Claude reads authorized shared memory.
6. Claude writes authorized shared memory.
7. Claude performs an authorized communication operation.
8. Hermes attempts to initialize while Claude is active.
9. Hermes is rejected with a correct conflict.
10. Founder authorizes a Claude-to-Hermes handoff.
11. Claude is disconnected.
12. Hermes becomes the only active runtime.
13. Hermes initializes MCP.
14. Hermes discovers tools.
15. Hermes reads the shared record written by Claude.
16. Hermes writes another shared record.
17. Claude attempts to use its stale session.
18. Claude is rejected.
19. Founder authorizes a Hermes-to-Claude handoff.
20. Claude reconnects with a new session.
21. Claude reads the shared record written by Hermes.
22. Verify old sessions remain in history.
23. Verify old execution records remain in history.
24. Verify only one active runtime exists.
25. Restart the Bridge.
26. Verify persistent memory and history remain.
27. Verify stale connections are handled according to the documented lease policy.

A successful database-only simulation does not satisfy this acceptance sequence.

Exercise actual MCP HTTP requests and assert actual tool results.

Live Claude Code and Hermes client testing must be separately recorded. Do not claim it has passed if the clients were not available during testing.

5. REQUIRED FILES AND CHANGE MANAGEMENT

Update or create the following reports.

5.1 Implementation plan

docs/reports/REPO_WIDE_REMEDIATION_PLAN.md

Include:

Confirmed findings.

Findings already resolved in the current local source.

Remaining findings.

Priority.

Dependencies.

Exact files involved.

Planned implementation order.

5.2 Change manifest

docs/reports/REPO_WIDE_CHANGE_MANIFEST.md

For every changed file, record:

Field

Required information

File

Exact path

Previous behavior

What it did before

Problem

Why it needed change

New behavior

What it does now

Dependencies

Related files changed

Tests

Tests covering the change

Result

Pass, fail, or pending

Include all modified, added, moved, and removed files.

Do not omit files.

5.3 Test evidence

docs/reports/REPO_WIDE_TEST_EVIDENCE.md

For each test command, record:

Exact command.

Environment.

Database used.

Number of tests.

Passed.

Failed.

Skipped.

Exit code.

Important output.

Known limitations.

Separate:

Unit results.

Integration results.

Security results.

Migration results.

E2E results.

Live MCP results.

Frontend results.

Distinguish source inspection from executed verification.

5.4 Architecture report

docs/reports/COUNCIL_BRIDGE_ARCHITECTURE_RECONCILIATION.md

Describe the actual architecture after implementation.

Include:

Authentication principals.

Founder authorization.

Runtime credentials.

Runtime sessions.

Runtime control.

Generation fencing.

Execution permits.

MCP transport behavior.

Shared memory.

Organizational identity mapping.

Database and migrations.

API contracts.

5.5 Final audit report

docs/reports/REPO_WIDE_FINAL_REMEDIATION_AUDIT.md

Recheck the complete repository after all changes.

Every original finding must have one result:

Resolved and verified.

Resolved but awaiting external/live verification.

Partially resolved.

Not resolved.

Not applicable, with explanation.

Do not simply copy the implementation report into the final audit.

Independently inspect the final source.

6. EXACT IMPLEMENTATION ACCEPTANCE CRITERIA

The following conditions are mandatory.

Authentication

Runtime credentials authenticate correctly.

Claude and Hermes have separate credentials.

Runtime identity cannot be selected through a request body.

Invalid credentials fail closed.

Revoked credentials fail closed.

Founder identity is separate.

Founder permissions are never inherited by runtime credentials.

Organizational agent identity is separately verified.

Local Founder mode cannot bypass MCP runtime authentication.

No spoofable forwarded-IP identity is trusted.

Runtime

One active runtime maximum.

One authoritative runtime-control record.

Stable session identity for each activation.

Historical sessions preserved.

No session deletion to bypass uniqueness.

No execution-history cascade deletion.

Generation is monotonic and persistent.

Generation is checked during execution.

Runtime ownership is checked at the real MCP execution boundary.

Unauthorized switching is rejected.

Claude-to-Hermes works.

Hermes-to-Claude works.

Repeated switching works.

Stale sessions are rejected.

Heartbeat and lease behavior is real and documented.

Long-running executions cannot silently lose protection.

MCP

Actual /mcp route is tested.

Initialization succeeds.

Tool discovery succeeds.

Tool calls execute.

JSON-RPC errors are asserted.

Runtime conflict is clear.

Old runtime requests are rejected after handoff.

MCP tools use authorized organizational identities.

Runtime credentials cannot invoke Founder-only operations.

Memory

Claude and Hermes use one Bridge-owned database.

Shared memory survives runtime switching.

Shared memory survives Bridge restart.

Private memory is protected.

Memory detail endpoints enforce authorization.

MCP memory capabilities use existing memory services.

Memory categories remain consistent.

Database and migrations

Schema authority is documented.

Runtime schema matches migrations.

Prepared statements match actual schema.

Parameter counts are correct.

Migration runner uses the configured database path.

Fresh database initialization passes.

Legacy schema upgrade passes.

Existing data is preserved.

Foreign keys are valid.

Rollback behavior is accurately documented.

Production database was not modified.

REST and frontend

Backend response contracts are explicit.

Frontend types match backend responses.

Correct endpoint paths are used.

Council shows all 11 seats.

Vacancies are represented correctly.

Task workflows work.

Execution workflows work.

Deliverable workflows work.

Approval workflows work.

Memory detail authorization works.

Runtime controls reflect actual server state.

Local development authentication configuration is consistent.

Profile and Settings do not claim unsupported functionality.

Verification and documentation

Correct package scripts.

Test files are included in the intended test/typecheck strategy.

Genuine concurrency tests exist.

Production MCP composition tests exist.

Frontend build passes.

Backend typecheck passes.

Security tests pass.

Migration tests pass.

CI workflow exists and runs the intended checks.

README matches actual setup.

Migration manifest matches actual migrations.

Client configuration guide matches actual authentication.

Historical reports are clearly marked.

All changed files appear in the change manifest.

7. RULES FOR HANDLING FAILURES

When a test fails:

Capture the complete error.

Identify the exact test.

Identify the actual source function.

Trace the call chain.

Determine the root cause.

Fix the root cause.

Add a regression test.

Run the failed test again.

Run related tests.

Run the full relevant suite.

Record the result.

Do not:

Delete the failing test.

Skip the failing test.

Increase timeouts without identifying the cause.

Add catch blocks merely to suppress errors.

Replace real execution with simulated success.

Replace production code testing with duplicated test-only implementations.

Weaken authorization.

Remove database constraints merely to avoid failures.

Hardcode test identities into production code.

Claim that an HTTP 200 proves MCP tool execution worked.

When a failure is caused by a pre-existing problem, fix it if it falls within this remediation scope.

Do not label a known failure as pre-existing without evidence.

8. FINAL RESPONSE FORMAT

When implementation is finished, respond with the following structure.

A. Overall result

Exactly one status:

READY FOR FOUNDER AUDIT

REMEDIATION INCOMPLETE

Do not use ACCEPTED.

Only the Founder can formally accept a milestone.

B. Work completed

Summarize the actual changes by phase.

C. Critical findings

List P0 and P1 findings that remain.

If none remain, state that and reference the evidence.

D. Tests

Provide exact test commands and real results.

Do not combine reported and executed results.

E. MCP verification

Report separately:

Backend MCP integration.

Claude Code live connection.

Hermes live connection.

Claude-to-Hermes switching.

Hermes-to-Claude switching.

Shared memory.

Stale-session rejection.

F. Database

State:

Which isolated databases were used.

Which migrations were tested.

Whether data preservation passed.

Whether foreign-key and integrity checks passed.

Confirm that no production database was modified.

G. Changed files

Link to the change manifest and provide a summary.

H. Remaining blockers

List anything that still needs an external credential, live client, Founder action, or unavailable environment.

I. Final reports

Provide the exact report paths.

9. FINAL INSTRUCTIONS

Start with Phase 0.

Then implement Phases 1–14 in order.

Do not stop after writing an audit.

Do not stop after writing the remediation plan.

Do not stop after fixing only MCP authentication.

The objective is to make the whole repository internally consistent.

Every affected file must agree with the actual implementation.

Every critical behavior must have a real test.

Every claimed success must have evidence.

Preserve all existing user changes and operational data.

Do not commit or push.

Do not apply migrations to production.

Do not start M4.

Do not claim formal acceptance.

Work methodically. Fix the actual cause. Test the actual behavior. Verify the entire dependency chain. Repeat until the work is genuinely complete or a precisely documented blocker remains.