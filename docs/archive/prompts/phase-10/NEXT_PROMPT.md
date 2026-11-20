# IMPLEMENTATION PROMPT — SINGLE ACTIVE RUNTIME + SHARED PERSISTENT INTELLIGENCE

## Project: Council Bridge
**Repository:** `snowep/council-bridge`  
**Local path:** `C:\Projects\council-bridge`  
**Target branch:** `refactor/repository-structure`  
**Baseline commit:** `56df3fb`  
**Implementation scope:** Runtime connection lifecycle and shared-memory compatibility  
**Execution authority:** Founder-authorized implementation of this specific change only

---

# 1. PRIMARY OBJECTIVE

Implement a runtime architecture in which Council Bridge supports exactly ONE active connected runtime at a time:

- Claude Code
- Hermes Agent

The Founder must be able to use either runtime independently.

Examples:

**Scenario A — Claude Code**
1. Start Council Bridge.
2. Connect Claude Code.
3. Claude Code accesses Council Bridge.
4. Claude Code operates using the existing Council identities, governance, tools, and persistent memory.
5. Hermes remains disconnected.

**Scenario B — Hermes Agent**
1. Disconnect Claude Code.
2. Connect Hermes.
3. Hermes accesses the same Council Bridge.
4. Hermes operates using the same Council identities, governance, tools, and persistent memory.
5. Claude Code remains disconnected.

The critical requirement:

**Switching runtimes MUST NOT switch, duplicate, reset, isolate, delete, or replace the shared memory system.**

Both runtimes must use the same Bridge-owned persistent intelligence infrastructure.

The architecture must be:

> Single Active Runtime + Shared Persistent Intelligence.

This is a runtime lifecycle change, NOT a redesign of Council Bridge's memory architecture.

---

# 2. NON-NEGOTIABLE ARCHITECTURAL PRINCIPLES

## 2.1 Council Bridge owns persistent intelligence

Council Bridge remains the authoritative owner of:

- Agent identities.
- Agent profiles.
- Agent responsibilities.
- Agent capabilities and boundaries.
- Private agent memory.
- Shared Council knowledge.
- Approved knowledge.
- Historical records.
- Message history.
- Council discussions.
- Council decisions.
- Voting records.
- Tasks.
- Delegations.
- Execution records.
- Deliverables.
- Approval records.
- Governance rules.
- Organizational structure.
- Division and staff records.

These records must remain in the existing persistent storage architecture.

Do not transfer ownership of canonical memory to Claude Code or Hermes.

Do not make either runtime the authoritative memory provider.

## 2.2 One shared database

Both runtimes MUST connect to the same existing SQLite database.

Required behavior:

```text
Claude Code ───────┐
                   │
                   ▼
             Council Bridge
                   │
                   ▼
             Existing SQLite
                   ▲
                   │
Hermes Agent ──────┘
```

Only one runtime may be actively connected at any given time.

Both runtimes must use the same database and the same Bridge APIs.

Do not create:

- A Claude-specific database.
- A Hermes-specific database.
- A second Council Bridge instance.
- Separate memory directories.
- Separate Council knowledge stores.
- Runtime-specific copies of agent identities.
- A memory synchronization mechanism between two databases.

There must be no memory synchronization problem because there must be only ONE canonical memory store.

## 2.3 Agent identity is independent of runtime connection

A logical agent identity must survive runtime disconnection.

For example:

```text
Agent Identity:
  agent_id: steve-jobs
  display_name: Steve Jobs
  role: Permanent Council Member
  responsibilities: Existing responsibilities
  capabilities: Existing capabilities
  boundaries: Existing boundaries

Runtime:
  active_runtime: claude | hermes | none
  connection_status: connected | disconnected | switching | error
```

The runtime is an execution environment.

The agent identity is an organizational identity.

Never treat them as the same database entity.

Disconnecting Claude Code must NOT:

- Delete agent identities.
- Deactivate Council members.
- Remove Division Heads.
- Remove specialists.
- Delete agent memory.
- Recreate agent records.
- Change agent responsibilities.
- Change Council membership.
- Reset governance records.

Switching to Hermes must NOT create a second copy of those identities.

## 2.4 Preserve all existing governance

The following must remain unchanged:

- 11 Council seats.
- Four permanent founding Council personas.
- Seven replaceable Council seats.
- Founder authority.
- Six organizational divisions.
- Six Division Heads.
- Forty-five specialists.
- Existing agent identity mappings.
- Existing permissions.
- Existing access boundaries.
- Existing delegation rules.
- Existing approval workflows.

Do not reinterpret, recalculate, seed, or modify organizational records as part of this task.

Do not change the number of agents or Council seats.

---

# 3. FIRST TASK: COMPLETE BASELINE AUDIT

Before changing any file, inspect the actual repository.

Verify:

1. Current branch.
2. Current HEAD commit.
3. Working tree status.
4. Untracked files.
5. Existing runtime registration mechanisms.
6. Existing MCP server lifecycle.
7. Existing Claude Code MCP configuration.
8. Existing Hermes MCP configuration.
9. Existing agent identity model.
10. Existing persistent memory model.
11. Existing database schema and migrations.
12. Existing message and conversation persistence.
13. Existing authentication and authorization.
14. Existing runtime-related API endpoints.
15. Existing runtime-related frontend pages and components.
16. Existing tests involving Claude, Hermes, agents, memory, and MCP connections.

Use commit `56df3fb` as the intended baseline, but do not assume the local repository is identical.

If the local HEAD differs from `56df3fb`, report the difference before proceeding.

If the working tree contains user modifications, preserve them.

Do not reset, clean, overwrite, or discard any existing user changes.

## Baseline report

Create:

`docs/reports/SINGLE_ACTIVE_RUNTIME_BASELINE_AUDIT.md`

Include:

- Current branch and commit.
- Working tree status.
- Existing architecture.
- Relevant files and their responsibilities.
- Existing runtime connection behavior.
- Existing shared-memory behavior.
- Existing database ownership.
- Identified implementation gaps.
- Proposed minimal change list.
- Potential migration requirements.
- Potential compatibility risks.

Do not begin implementation if the audit reveals a conflict with the non-negotiable architecture above.

---

# 4. RUNTIME LIFECYCLE

Implement a centralized runtime lifecycle manager.

The exact module location must follow the existing repository architecture. Do not invent a new architectural layer if an existing service or module can own this responsibility cleanly.

The lifecycle manager must support:

```text
NONE
  │
  ▼
DISCONNECTED
  │
  ▼
CONNECTING
  │
  ▼
CONNECTED
  │
  ▼
DISCONNECTING
  │
  ▼
DISCONNECTED
```

Runtime switching must also support:

```text
CLAUDE_CONNECTED
       │
       ▼
DISCONNECTING_CLAUDE
       │
       ▼
SWITCHING
       │
       ▼
CONNECTING_HERMES
       │
       ▼
HERMES_CONNECTED
```

The reverse direction must work identically.

The supported runtime identifiers must be explicit and validated:

```typescript
type RuntimeType = 'claude' | 'hermes';
```

Do not silently accept arbitrary runtime identifiers.

## 4.1 Required runtime state

Determine whether the existing schema can represent this state before creating new tables or columns.

The runtime lifecycle must expose equivalent information to:

```typescript
interface RuntimeConnectionState {
  activeRuntime: RuntimeType | null;
  connectionStatus:
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'disconnecting'
    | 'switching'
    | 'error';

  sessionId: string | null;
  connectedAt: string | null;
  lastHeartbeatAt: string | null;
  leaseExpiresAt: string | null;
  lastError: string | null;
}
```

This is a behavioral contract, not permission to duplicate existing models.

Reuse existing fields and types where appropriate.

Do not create redundant state representations.

## 4.2 One active runtime invariant

The backend MUST enforce:

```text
ACTIVE_RUNTIME_COUNT <= 1
```

This is a server-side invariant.

Frontend restrictions alone are insufficient.

The invariant must remain valid under:

- Two simultaneous connection requests.
- Two simultaneous switching requests.
- Repeated connection requests.
- Repeated disconnection requests.
- Stale sessions.
- Process restarts.
- Failed connections.
- Network interruptions.
- Concurrent MCP initialization requests.

Use appropriate SQLite transaction semantics and existing concurrency patterns.

If persistent runtime state is required, use the existing SQLite database.

Do not introduce Redis or another external service.

Do not rely exclusively on an in-memory boolean.

Do not use a frontend-only mutex.

Do not implement a time-based lease that can permit two active runtimes after a race.

Any lease mechanism must have explicit ownership, atomic acquisition, safe expiration, and safe release.

The server must reject a second runtime activation while another valid runtime session owns the active connection.

Return a clear, consistent conflict response.

## 4.3 Connection ownership

Every runtime connection must have a unique session identifier.

The session must identify:

- Runtime type.
- Connection session ID.
- Connection start time.
- Last heartbeat.
- Session status.
- Session ownership.

A disconnect request must be authorized against the current session.

A stale or superseded session must not be allowed to disconnect a newer session.

A connection request from a runtime must not overwrite an existing active session.

Do not use runtime type alone as a session identity.

## 4.4 Safe runtime switching

Implement a controlled switching operation.

Expected behavior:

1. Validate the requested runtime.
2. Read current active runtime.
3. If the requested runtime is already active, return the existing state without creating a duplicate session.
4. If another runtime is active, initiate controlled disconnection.
5. Release the previous session safely.
6. Confirm that no valid active session remains.
7. Acquire the new runtime session atomically.
8. Initialize the new runtime against the existing Bridge.
9. Load the existing agent identities and authorized shared context.
10. Confirm successful connection.
11. Persist the new runtime state.
12. Return the final connection state.

If any step fails:

- Do not leave two active runtimes.
- Do not destroy existing memory.
- Do not delete agent identities.
- Do not corrupt runtime state.
- Return a meaningful error.
- Leave the Bridge in a recoverable state.

Do not claim that a runtime is connected before its connection has actually been established.

## 4.5 Stale session recovery

Implement safe recovery for:

- Crashed runtime processes.
- Abandoned sessions.
- Missing heartbeats.
- Expired sessions.
- Bridge restarts.
- Interrupted switching operations.

A stale session may be released only after verifying that its ownership is no longer valid.

Do not assume every heartbeat failure means the runtime process is dead.

Do not allow a stale-session cleanup operation to release a newer active session.

Recovery must be safe under concurrent requests.

Document the chosen heartbeat interval, timeout, recovery policy, and race protections.

Do not invent arbitrary timeout values without examining existing operational requirements.

---

# 5. SHARED MEMORY REQUIREMENTS

This is the most important functional requirement.

Claude Code and Hermes must share the same persistent intelligence.

## 5.1 Shared memory behavior

Example:

1. Claude Code connects.
2. Claude Code retrieves the existing agent memory for a Council persona.
3. Claude Code records a new approved memory.
4. Claude Code disconnects.
5. Hermes connects.
6. Hermes retrieves the same agent memory.
7. Hermes sees the memory written by Claude Code.
8. Hermes records another approved memory.
9. Hermes disconnects.
10. Claude Code reconnects.
11. Claude Code sees the memory written by Hermes.

This must work through the existing Bridge memory APIs and authorization model.

The reverse direction must work as well.

## 5.2 Memory ownership

The canonical memory must remain Bridge-owned.

Required:

```text
Claude Code ──┐
              │
              ▼
        Bridge Memory API
              │
              ▼
        Shared SQLite DB
              ▲
              │
Hermes Agent ──┘
```

Do not:

- Store canonical agent memory exclusively in Claude Code.
- Store canonical agent memory exclusively in Hermes.
- Create a Claude-only memory database.
- Create a Hermes-only memory database.
- Duplicate memory records when switching.
- Import/export memory as the normal switching mechanism.
- Reset memory during connection initialization.
- Clear memory during disconnection.
- Rebuild identities from runtime-local configuration.

Runtime-local caches may exist only if the existing architecture requires them.

They must never become authoritative.

## 5.3 Memory access and authorization

Both runtimes must use the same existing permission rules.

Do not grant Hermes additional permissions simply because Claude Code disconnects.

Do not grant Claude Code additional permissions simply because Hermes disconnects.

Preserve:

- Agent-private memory boundaries.
- Shared Council knowledge permissions.
- Cross-division authorization.
- Founder-only permissions.
- Approval requirements.
- Existing memory provenance rules.
- Existing audit logging.

Do not let a runtime impersonate another agent.

The identity requesting memory access must be independently authenticated and authorized.

## 5.4 Session context versus persistent memory

Keep these concepts separate:

**Runtime session context**
- Runtime-specific active conversation.
- Runtime-specific execution state.
- Temporary tool invocation context.
- Runtime-specific session metadata.

**Persistent shared intelligence**
- Agent memory.
- Council knowledge.
- Historical messages.
- Decisions.
- Governance.
- Tasks.
- Deliverables.
- Approved records.

A runtime switch may end a runtime-specific session.

It must not erase or reset persistent shared intelligence.

Do not merge Claude Code's private local conversation history with Hermes's private local conversation history unless an existing explicit feature already supports this.

The requirement is shared Bridge-owned memory and organizational history, not forced merging of unrelated runtime-local chat transcripts.

---

# 6. MCP INTEGRATION

Inspect the existing MCP server implementation and both runtime configurations.

Both clients must connect to the same Council Bridge MCP endpoint.

The server must remain the same server.

The database must remain the same database.

The MCP tool definitions must remain consistent across runtimes.

## 6.1 Claude Code

Preserve the existing Claude Code MCP configuration format and connection behavior.

Verify:

- Server URL.
- Transport.
- Authentication.
- Tool discovery.
- Tool invocation.
- Connection lifecycle.
- Disconnect behavior.

Do not introduce a second Claude-specific Bridge server.

## 6.2 Hermes Agent

Preserve the existing Hermes MCP configuration format and connection behavior.

Verify:

- Server URL.
- Transport.
- Authentication.
- Tool discovery.
- Tool invocation.
- Connection lifecycle.
- Disconnect behavior.

Do not introduce a second Hermes-specific Bridge server.

## 6.3 MCP initialization

Runtime registration must not be confused with agent registration.

An MCP client connecting must not create duplicate organizational identities.

An existing identity must be reused.

If the runtime connection is rejected because another runtime is active, return a clear error explaining:

- Which runtime currently owns the connection.
- Why the new connection was rejected.
- How to disconnect or switch safely.

Never expose secrets, private keys, tokens, or sensitive session metadata in error messages.

## 6.4 Preserve MCP compatibility

Do not remove or rename existing MCP tools merely to support runtime switching.

Do not change existing tool input schemas without necessity.

Do not break:

- Messaging.
- Inbox retrieval.
- Replies.
- Thread history.
- Agent registration.
- Identity verification.
- Council tools.
- Memory tools.
- Task tools.
- Delegation tools.
- Execution tools.
- Deliverable tools.
- Approval tools.

If a schema change is unavoidable, document it and add backward-compatibility tests.

---

# 7. API REQUIREMENTS

Inspect existing route conventions first.

Reuse existing endpoints where possible.

Avoid unnecessary API duplication.

The implementation must provide equivalent functionality for:

- Reading active runtime state.
- Connecting a runtime.
- Disconnecting the active runtime.
- Switching runtime.
- Heartbeat/session renewal.
- Recovering stale sessions, if exposed through an API.

Possible conceptual interface:

```text
GET    /api/runtime
POST   /api/runtime/connect
POST   /api/runtime/disconnect
POST   /api/runtime/switch
POST   /api/runtime/heartbeat
```

These are proposed endpoint names, NOT mandatory names.

Follow the repository's existing route conventions.

Use existing authentication and authorization middleware.

Validate request bodies with the project's existing Zod conventions.

Use consistent response structures.

Use correct HTTP status codes.

Recommended semantics:

| Situation | Expected response |
|---|---|
| Successful connection | 200 or 201 |
| Successful disconnection | 200 |
| Runtime already active | 200, idempotent |
| Another runtime owns connection | 409 |
| Invalid runtime identifier | 400 |
| Unauthorized operation | 401/403 |
| Invalid session ownership | 403 or 409 |
| Internal lifecycle failure | 500 |

Do not expose stack traces or internal secrets.

Do not bypass existing authentication to simplify local testing.

---

# 8. FRONTEND REQUIREMENTS

Inspect the existing frontend and design system before implementation.

Use:

- React 19.
- Vite.
- TypeScript.
- MUI 9.
- Existing Google Material Design system.
- Existing vanilla MUI components.

Do not introduce a new component library.

Do not add custom visual styling unless necessary.

Do not change:

- Existing palette.
- Theme definitions.
- Design tokens.
- Typography.
- Approved visual styling.
- Existing page layout outside this feature.

Do not add generic AI-themed visual patterns.

## 8.1 Runtime control

Provide a clear way to see and manage the active runtime.

The UI must show:

- Active runtime.
- Connection status.
- Session state where appropriate.
- Last heartbeat where useful.
- Available alternative runtime.
- Current switching progress.
- Connection failure information.

The user must be able to:

- Connect Claude Code.
- Connect Hermes.
- Disconnect the active runtime.
- Switch from Claude Code to Hermes.
- Switch from Hermes to Claude Code.

Do not show two runtimes as simultaneously connected.

## 8.2 Accurate state representation

The UI must reflect backend-confirmed state.

Do not optimistically display a successful connection before the server confirms it.

During switching, show the actual transition.

Prevent accidental duplicate submissions in the UI, but do not rely on the UI for server-side safety.

Show actionable errors without exposing sensitive details.

## 8.3 No unrelated dashboard changes

Do not modify unrelated dashboard actions.

Do not redesign the Dashboard.

Do not alter keyboard shortcuts.

Do not add decorative gradients or governance badge styling.

Do not alter existing theme behavior.

Do not modify Profile, Settings, Activity, or other pages unless a direct integration requirement makes it necessary.

If another page must change, justify the exact change in the implementation report.

---

# 9. DATABASE AND MIGRATION REQUIREMENTS

Inspect the current schema and migration history before changing the database.

First determine whether runtime lifecycle state can be represented using existing tables.

If a schema change is necessary:

1. Create a new sequential migration.
2. Follow the existing migration naming convention.
3. Preserve existing data.
4. Add appropriate constraints and indexes.
5. Use transactions.
6. Include migration tests.
7. Include rollback or recovery considerations according to the existing migration system.
8. Verify database integrity.
9. Verify foreign-key integrity.
10. Verify existing records remain unchanged.

Do not edit old migrations that have already been applied.

Do not modify production databases.

Do not run production migrations.

Do not seed or delete agent identities.

Do not alter existing memory records.

Do not introduce another SQLite database for runtime state unless the current architecture makes that technically unavoidable. The default and required approach is to reuse the existing Council Bridge database.

---

# 10. SECURITY REQUIREMENTS

Preserve the existing security architecture.

Specifically:

- Production authentication remains fail-closed.
- No hardcoded identity fallback.
- No identity spoofing.
- No forwarded-IP trust bypass.
- No browser exposure of Founder private keys.
- No private-key generation or signature-generation shortcut.
- No authentication bypass for runtime switching.
- No permission escalation.
- No unauthorized session takeover.
- No cross-agent memory leakage.
- No cross-division permission bypass.
- No runtime impersonation.

Runtime switching must be an authenticated and authorized operation.

Session ownership must be verified server-side.

A runtime must not disconnect or replace another runtime's session without the appropriate authorization.

All important lifecycle events must be auditable.

Audit events should include:

- Runtime connection requested.
- Runtime connection accepted.
- Runtime connection rejected.
- Runtime disconnection requested.
- Runtime disconnection completed.
- Runtime switch initiated.
- Runtime switch completed.
- Runtime switch failed.
- Stale session detected.
- Stale session recovered.

Do not log:

- Private keys.
- Authentication tokens.
- Sensitive memory contents.
- Full secrets.
- Unnecessary private session data.

---

# 11. TESTING REQUIREMENTS

Tests must verify actual behavior, not merely function existence.

Use the existing test framework and conventions.

Do not weaken existing tests.

Do not replace integration tests with mocks when a real SQLite integration test is feasible.

## 11.1 Runtime lifecycle unit tests

Test:

1. No active runtime initially.
2. Claude Code can connect.
3. Hermes can connect.
4. Unknown runtime is rejected.
5. Repeated connection is idempotent where appropriate.
6. Disconnection succeeds.
7. Repeated disconnection is safe.
8. Runtime state is accurate.
9. Failed connection leaves recoverable state.
10. Invalid session ownership is rejected.

## 11.2 Single-active-runtime integration tests

Test:

1. Claude connects; Hermes connection is rejected.
2. Hermes connects; Claude connection is rejected.
3. Claude disconnects; Hermes can connect.
4. Hermes disconnects; Claude can connect.
5. Two simultaneous connection attempts result in at most one active runtime.
6. Two simultaneous switch attempts cannot create two active sessions.
7. Duplicate requests do not create duplicate sessions.
8. A stale session cannot disconnect a newer session.
9. A superseded session cannot perform authorized operations.
10. Bridge restart restores a safe disconnected or recoverable state.
11. A crashed runtime can be recovered safely.
12. Database transaction rollback does not leave a false active session.

Use independent child processes for concurrency tests where practical.

Do not use sequential tests to claim concurrent race safety.

## 11.3 Shared-memory integration tests

These are mandatory.

Test the following using the same persistent SQLite database:

**Test A — Claude writes, Hermes reads**
1. Connect Claude.
2. Authenticate as a test agent.
3. Write a memory record through the Bridge memory API.
4. Disconnect Claude.
5. Connect Hermes.
6. Authenticate as the same logical test agent.
7. Read the memory.
8. Assert exact content and provenance match.

**Test B — Hermes writes, Claude reads**
1. Connect Hermes.
2. Write another memory record.
3. Disconnect Hermes.
4. Connect Claude.
5. Read the record.
6. Assert exact content and provenance match.

**Test C — Memory survives process restart**
1. Write memory through Claude.
2. Stop/restart Bridge.
3. Connect Hermes.
4. Verify the same record remains available.

**Test D — Shared Council knowledge**
1. Write an approved Council knowledge record through one runtime.
2. Switch runtime.
3. Verify the other runtime can retrieve it under the same authorization rules.

**Test E — Private memory boundaries**
1. Write private memory for Agent A.
2. Connect the other runtime.
3. Attempt retrieval as Agent B.
4. Verify access remains denied.

**Test F — No duplicate memory**
1. Switch Claude → Hermes → Claude.
2. Verify existing memory record counts remain unchanged unless an explicit write occurs.
3. Verify no duplicated agent identities or memory records were created.

## 11.4 MCP end-to-end tests

Test both actual client configurations against the same Bridge instance.

Verify:

- MCP initialization.
- Tool discovery.
- Tool invocation.
- Authentication.
- Runtime ownership.
- Runtime switching.
- Shared memory reads.
- Shared memory writes.
- Message history.
- Existing Council workflows.

Use actual MCP protocol behavior where feasible.

Do not mark a configuration verified merely because its JSON parses.

## 11.5 Regression tests

Run existing tests covering:

- Authentication.
- Founder authorization.
- Identity.
- Council.
- Messaging.
- Memory.
- Knowledge.
- Tasks.
- Delegation.
- Execution.
- Deliverables.
- Approvals.
- Database migrations.
- Dashboard.
- Runtime integration.

Report pre-existing failures separately.

Do not silently change unrelated code to make the new tests pass.

---

# 12. REQUIRED DOCUMENTATION

Update only the documentation directly relevant to this architecture.

Create:

`docs/architecture/SINGLE_ACTIVE_RUNTIME.md`

It must explain:

1. The architecture.
2. Why only one runtime is active at a time.
3. Why memory remains shared.
4. Bridge ownership of canonical memory.
5. Agent identity versus runtime connection.
6. Connection lifecycle.
7. Switching sequence.
8. Session ownership.
9. Stale session recovery.
10. Database consistency.
11. MCP client configuration.
12. Authentication and authorization.
13. Failure handling.
14. Operational instructions.
15. Known limitations.

Update existing architecture or setup documentation only where necessary.

Do not duplicate entire documents.

Do not rewrite unrelated documentation.

---

# 13. IMPLEMENTATION BOUNDARIES

This task is specifically about:

- Runtime lifecycle.
- Single-active-runtime enforcement.
- Runtime switching.
- Shared-memory compatibility.
- MCP connection integration.
- Minimal UI control.
- Security.
- Tests.
- Directly relevant documentation.

The following are OUT OF SCOPE:

- New Council governance features.
- New Council members.
- New divisions.
- New specialists.
- Changes to agent identities.
- Changes to the memory architecture.
- New memory algorithms.
- New AI models.
- Model routing.
- Simultaneous multi-runtime execution.
- Runtime load balancing.
- Distributed deployment.
- Cloud hosting.
- Redis.
- New databases.
- Broad repository refactoring.
- Unrelated UI redesign.
- Theme changes.
- Palette changes.
- Typography changes.
- Changes to existing governance rules.
- M4 implementation.
- Production database modifications.
- Git history rewriting.
- Branch deletion.
- Commit or push operations.

Do not interpret this prompt as permission to expand scope.

---

# 14. FILE-LEVEL CHANGE CONTROL

Every file change must be justified.

Before editing a file, identify:

- File path.
- Existing responsibility.
- Why it must change.
- Exact intended modification.
- Related tests.
- Whether the change is necessary or optional.

Create:

`docs/reports/SINGLE_ACTIVE_RUNTIME_FILE_CHANGE_MANIFEST.md`

Use this structure:

| File | Existing responsibility | Change type | Exact change | Reason | Tests |
|---|---|---|---|---|---|

Change types:

- ADD
- MODIFY
- DELETE
- MOVE

Rules:

1. No file may be modified without appearing in the manifest.
2. No file may be deleted without explicit justification.
3. No file may be moved as a convenience.
4. No broad formatting changes.
5. No unrelated semicolon, import-order, whitespace, naming, or formatting changes.
6. Do not reformat entire files.
7. Do not change semicolons, quotes, trailing commas, or line endings unless directly required by the implementation or existing lint rules.
8. Preserve existing code conventions.
9. Preserve comments unless they become demonstrably incorrect.
10. Preserve all existing user modifications.
11. Do not modify generated files unless the existing build process requires it.
12. Do not introduce dependencies unless technically necessary and documented.

**A one-character change is still a change and must be justified.**

Before implementation, produce the manifest.

After implementation, compare the actual Git diff against the manifest.

Every changed line must be attributable to an approved requirement.

If an unrelated change appears, revert only that unrelated change while preserving user work.

Do not silently expand the implementation.

---

# 15. DEFINITION OF DONE

The implementation is complete only when every applicable item below is verified.

## Architecture
- [ ] Claude Code and Hermes use the same Council Bridge instance.
- [ ] Both runtimes use the same SQLite database.
- [ ] Exactly one runtime can be active.
- [ ] The invariant is enforced server-side.
- [ ] Runtime identity is separate from agent identity.
- [ ] Runtime disconnection does not deactivate agents.
- [ ] Switching does not recreate identities.
- [ ] No duplicate memory database exists.
- [ ] No runtime-specific canonical memory store exists.

## Lifecycle
- [ ] Claude can connect.
- [ ] Hermes can connect.
- [ ] Claude can disconnect.
- [ ] Hermes can disconnect.
- [ ] Claude → Hermes switching works.
- [ ] Hermes → Claude switching works.
- [ ] Concurrent activation is safe.
- [ ] Session ownership is enforced.
- [ ] Stale-session recovery is safe.
- [ ] Bridge restart is safe.
- [ ] Failed switching leaves recoverable state.

## Shared intelligence
- [ ] Claude-written memory is visible to Hermes.
- [ ] Hermes-written memory is visible to Claude.
- [ ] Shared Council knowledge is visible under existing authorization.
- [ ] Memory survives Bridge restart.
- [ ] Private memory boundaries remain enforced.
- [ ] Switching does not duplicate memory.
- [ ] Existing agent identities remain unchanged.
- [ ] Existing Council history remains unchanged.
- [ ] Existing tasks and deliverables remain unchanged.

## MCP
- [ ] Claude MCP configuration works.
- [ ] Hermes MCP configuration works.
- [ ] Both use the same Bridge endpoint.
- [ ] Tool discovery works.
- [ ] Tool invocation works.
- [ ] Existing MCP tools remain compatible.
- [ ] Rejected connections return clear errors.

## Security
- [ ] Production authentication remains fail-closed.
- [ ] No identity fallback is introduced.
- [ ] No private key is exposed.
- [ ] No session takeover vulnerability exists.
- [ ] No cross-agent memory leakage exists.
- [ ] No permission escalation exists.
- [ ] Lifecycle events are auditable.

## Frontend
- [ ] Active runtime is visible.
- [ ] Connection state is accurate.
- [ ] Runtime switching works.
- [ ] Errors are understandable.
- [ ] Existing palette is unchanged.
- [ ] Existing theme is unchanged.
- [ ] Existing typography is unchanged.
- [ ] No unrelated page changes exist.

## Quality
- [ ] Targeted unit tests pass.
- [ ] Targeted integration tests pass.
- [ ] Cross-process concurrency tests pass.
- [ ] Shared-memory tests pass.
- [ ] MCP end-to-end tests pass.
- [ ] Existing regression suite passes, or pre-existing failures are documented.
- [ ] TypeScript has zero new errors.
- [ ] Production build succeeds.
- [ ] Database integrity is verified.
- [ ] Foreign-key integrity is verified.
- [ ] Actual diff matches the file manifest.
- [ ] Documentation is complete.

A checkbox may only be marked complete when evidence exists.

Do not mark untested behavior as complete.

---

# 16. REQUIRED FINAL REPORTS

Create:

`docs/reports/SINGLE_ACTIVE_RUNTIME_IMPLEMENTATION_REPORT.md`

Include:

1. Executive summary.
2. Baseline commit.
3. Final working-tree status.
4. Architecture implemented.
5. Runtime lifecycle implementation.
6. Single-active-runtime enforcement.
7. Shared-memory verification.
8. MCP compatibility verification.
9. Database changes, if any.
10. Security verification.
11. Frontend changes.
12. Exact files added.
13. Exact files modified.
14. Exact files deleted, if any.
15. Test commands executed.
16. Test results.
17. TypeScript result.
18. Build result.
19. Database integrity result.
20. Known limitations.
21. Unresolved issues.
22. Definition of Done checklist.
23. Git diff summary.
24. Confirmation that no unauthorized work occurred.

Also create:

`docs/reports/SINGLE_ACTIVE_RUNTIME_TEST_EVIDENCE.md`

Include actual test commands and outputs or reliable summaries of the executed test results.

Do not fabricate test evidence.

Do not report a test as passing if it was skipped, mocked inadequately, or not executed.

---

# 17. EXECUTION ORDER

Follow this sequence exactly:

**Stage 1 — Baseline**
- Inspect repository.
- Verify branch and commit.
- Inspect working tree.
- Map relevant files.
- Audit existing architecture.
- Write baseline report.

**Stage 2 — Design**
- Define the minimal architecture.
- Identify existing reusable components.
- Define lifecycle state.
- Define session ownership.
- Define concurrency and recovery behavior.
- Confirm shared-memory ownership.
- Produce the file-change manifest.

**Stage 3 — Backend**
- Implement runtime lifecycle.
- Implement single-active-runtime enforcement.
- Implement safe switching.
- Implement session ownership.
- Implement heartbeat/recovery if required.
- Preserve existing authentication.
- Preserve existing memory APIs.

**Stage 4 — Database**
- Add a migration only if necessary.
- Test transaction behavior.
- Test restart persistence.
- Verify integrity.

**Stage 5 — MCP**
- Integrate Claude.
- Integrate Hermes.
- Verify same endpoint.
- Verify same persistent storage.
- Verify runtime conflict behavior.

**Stage 6 — Frontend**
- Add minimal runtime controls.
- Connect UI to actual backend state.
- Verify switching.
- Preserve existing visual system.

**Stage 7 — Testing**
- Unit tests.
- Integration tests.
- Cross-process concurrency tests.
- Shared-memory tests.
- MCP end-to-end tests.
- Security regression tests.
- Full regression suite.

**Stage 8 — Audit**
- Inspect every changed file.
- Compare diff against manifest.
- Check for unrelated changes.
- Verify all requirements.
- Verify documentation.
- Produce final reports.

Do not skip stages.

If a stage cannot be completed, stop and report the blocker rather than pretending completion.

---

# 18. GIT AND AUTHORIZATION RULES

Work only on:

`refactor/repository-structure`

Do not switch branches without authorization.

Do not modify `master`.

Do not:

- Commit.
- Push.
- Merge.
- Rebase.
- Force-push.
- Rewrite Git history.
- Delete branches.
- Reset the working tree.
- Run destructive cleanup.
- Modify production databases.
- Apply production migrations.

Leave all implementation changes uncommitted.

Preserve the existing working tree and all user changes.

---

# 19. FINAL INSTRUCTION

The objective is not to make Claude Code and Hermes share an active session.

The objective is to let the Founder choose which runtime to use while both runtimes retain access to the same persistent organizational intelligence.

The final architecture must satisfy:

```text
                 FOUNDER
                    │
                    ▼
             Choose Runtime
                    │
            ┌───────┴───────┐
            │               │
            ▼               ▼
        Claude Code       Hermes
            │               │
            └───────┬───────┘
                    │
          Only ONE connected
             at a time
                    │
                    ▼
             COUNCIL BRIDGE
                    │
       ┌────────────┼────────────┐
       │            │            │
       ▼            ▼            ▼
    Identity      Memory      Governance
       │            │            │
       └────────────┼────────────┘
                    │
                    ▼
             Shared SQLite
```

The runtime can change.

The agent identities cannot be reset.

The memory cannot be isolated.

The organization cannot be duplicated.

The governance cannot be bypassed.

The Bridge remains the single source of truth.

**Implement only this scope. Verify every requirement. Document every file change. Leave all changes uncommitted and unpushed.**