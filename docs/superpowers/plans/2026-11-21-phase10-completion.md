# Phase 10 Single Active Runtime - Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Phase 10 Single Active Runtime implementation with proper fail-closed validation, MCP execution guard, and integration tests.

**Architecture:** This plan implements the remaining security hardening for the Single Active Runtime invariant (`ACTIVE_RUNTIME_COUNT <= 1`). The key missing pieces are: fail-closed lease validation, MCP execution guard to prevent TOCTOU races, cross-process concurrency tests, and shared memory integration tests.

**Tech Stack:** TypeScript, SQLite (better-sqlite3), Node.js, Express, MCP SDK

**Spec:** `docs/archive/prompts/phase-10/NEXT_PROMPT.md`

## Global Constraints

- Do not modify production database records or apply production migrations
- Do not weaken authentication, authorization, or Founder security
- Never expose Founder private keys or credentials in frontend code, browser storage, API responses, logs, or Git
- Active Runtime Count <= 1 must be enforced by backend and database
- SQLite partial unique index: `ON runtime_sessions(connection_status) WHERE connection_status = 'connected'`
- Lease duration: approximately 10 minutes (600000ms)
- Heartbeat interval: approximately 30 seconds

## Review Focus

- Invalid/malformed lease timestamps must reject (fail-closed)
- MCP tools must execute only under valid ownership
- Concurrent runtime activation must be safely handled
- Shared memory must persist across runtime switches
- Expired sessions cannot be revived by heartbeat

---

### Task 1: Fix Fail-Open Lease Validation in runtime-ownership.middleware.ts

**Files:**
- Modify: `src/runtime/runtime-ownership.middleware.ts:63-74`
- Modify: `tests/unit/mcp-ownership-guard.test.ts` (add tests for invalid timestamps)

**Interfaces:**
- Consumes: `parseUnixMs()` from lifecycle.ts
- Produces: Fail-closed validation for all lease timestamp edge cases

- [ ] **Step 1: Write failing tests for invalid lease timestamps**

```typescript
// Tests to add to mcp-ownership-guard.test.ts
it('should reject request with null lease_expires_at', async () => {
  db.db.prepare(`
    INSERT INTO runtime_sessions (runtime, session_id, connection_status, connected_at, lease_expires_at, created_at, updated_at)
    VALUES ('claude', 'session-1', 'connected', '1732123456789', null, datetime('now'), datetime('now'))
  `).run();
  // Should reject - missing lease timestamp
});

it('should reject request with empty string lease_expires_at', async () => {
  // Should reject - empty string is invalid
});

it('should reject request with whitespace lease_expires_at', async () => {
  // Should reject - whitespace is not a valid timestamp
});

it('should reject request with malformed lease timestamp', async () => {
  // Should reject - 'abc123' is not a valid timestamp
});

it('should reject request when lease_expires_at is zero', async () => {
  // Should reject - zero is not a valid future timestamp
});

it('should reject request when lease_expires_at is negative', async () => {
  // Should reject - negative timestamps are invalid
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/mcp-ownership-guard.test.ts`
Expected: FAIL - middleware accepts invalid timestamps

- [ ] **Step 3: Implement fail-closed lease validation**

The middleware must reject when:
- `leaseExpires` is null
- `leaseExpires` is undefined
- `leaseExpires` is an empty string
- `leaseExpires` contains whitespace
- `leaseExpires` is malformed (parseUnixMs returns null)
- `leaseExpires` is zero or negative
- `leaseExpires` is in the past or equals current time

```typescript
// Replace lines 63-74 with:
const leaseExpires = activeSession.leaseExpiresAt;
const leaseExpiresMs = parseUnixMs(leaseExpires);

if (leaseExpiresMs === null) {
  return {
    allowed: false,
    reason: 'Runtime session has an invalid or missing lease timestamp',
    errorCode: 'INVALID_SESSION_LEASE'
  };
}

if (leaseExpiresMs <= Date.now()) {
  return {
    allowed: false,
    reason: 'Session lease has expired',
    errorCode: 'SESSION_EXPIRED'
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/mcp-ownership-guard.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/runtime/runtime-ownership.middleware.ts tests/unit/mcp-ownership-guard.test.ts
git commit -m "fix: fail-closed lease validation in ownership middleware

- Reject null/undefined/empty lease_expires_at timestamps
- Reject malformed timestamps (parseUnixMs returns null)
- Reject zero and negative timestamps
- Reject expired/invalid lease timestamps
- Adds comprehensive tests for all invalid timestamp cases

This ensures fail-closed authorization at the MCP execution boundary."
```

---

### Task 2: Create MCP Execution Guard for TOCTOU Protection

**Files:**
- Create: `src/runtime/runtime-execution-guard.ts`
- Modify: `src/server.ts` (use execution guard in MCP handler)
- Modify: `src/infrastructure/database/database.ts` (add execution_records table)
- Create: `migrations/018_add_execution_records.sql`
- Create: `tests/unit/runtime-execution-guard.test.ts`
- Create: `tests/integration/mcp-execution-guard.test.ts`

**Interfaces:**
- Consumes: DatabaseInstance, AuthContext
- Produces: `RuntimeExecutionContext` interface, `wrapMcpTool()` function

- [ ] **Step 1: Write failing tests for execution guard**

```typescript
// tests/unit/runtime-execution-guard.test.ts
describe('Runtime Execution Guard', () => {
  it('should allow tool execution under valid ownership', () => {
    // Test successful execution permit acquisition
  });

  it('should reject tool execution when session disconnected', () => {
    // Test rejection after disconnect
  });

  it('should reject tool execution after switch', () => {
    // Test that old session cannot execute after switch
  });

  it('should prevent switch during active execution', () => {
    // Test that concurrent switch is rejected when execution in progress
  });

  it('should release execution permit on completion', () => {
    // Test that permit is properly released
  });

  it('should release execution permit on error', () => {
    // Test cleanup in finally block
  });
});
```

- [ ] **Step 2: Create execution_records table migration**

```sql
-- migrations/018_add_execution_records.sql
CREATE TABLE IF NOT EXISTS execution_records (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  completed INTEGER DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES runtime_sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_execution_records_session ON execution_records(session_id);
CREATE INDEX IF NOT EXISTS idx_execution_records_expires ON execution_records(expires_at);
```

- [ ] **Step 3: Implement runtime-execution-guard.ts**

```typescript
export interface RuntimeExecutionContext {
  runtimeId: 'claude' | 'hermes';
  sessionId: string;
  executionId: string;
}

export interface ExecutionGuardResult {
  allowed: boolean;
  context?: RuntimeExecutionContext;
  error?: string;
  errorCode?: string;
}

export function createRuntimeExecutionGuard(db: DatabaseInstance) {
  return function guardExecution(
    authContext: AuthContext
  ): ExecutionGuardResult {
    // Implementation with atomic SQLite transaction
    // - BEGIN IMMEDIATE
    // - Verify active session is connected with valid lease
    // - Insert execution record
    // - Return context for tool execution
  };
}
```

- [ ] **Step 4: Integrate execution guard into MCP handler**

Modify `src/server.ts` to wrap tool registration with execution guard:

```typescript
// After ownership check, wrap tool registration
if (!ownershipResult.allowed) {
  // ... error handling
}

// Create execution guard and acquire permit
const executionGuard = createRuntimeExecutionGuard(db);
const executionInit = executionGuard(authContext);
if (!executionInit.allowed) {
  res.status(403).json({ error: 'RUNTIME_NOT_ACTIVE', message: executionInit.error });
  return;
}

try {
  // Register and execute tools
  const requestMcpServer = new McpServer(...);
  await requestMcpServer.connect(requestTransport);
  registerMcpTools(requestMcpServer, db, authContext, executionInit.context!);
  await requestTransport.handleRequest(req, res, req.body);
} finally {
  // Release execution permit
  db.prepare('UPDATE execution_records SET completed = 1 WHERE execution_id = ?').run(executionInit.context!.executionId);
}
```

- [ ] **Step 5: Write integration tests for MCP execution guard**

Create `tests/integration/mcp-execution-guard.test.ts` with:
1. Active Claude executes tool successfully
2. Inactive Hermes is rejected
3. After switch, old session is rejected
4. Switch during execution is rejected
5. Expired session is rejected
6. Database failure causes fail-closed

- [ ] **Step 6: Run all tests**

Run: `npm test -- tests/unit/runtime-execution-guard.test.ts tests/integration/mcp-execution-guard.test.ts`
Expected: All tests pass

- [ ] **Step 7: Commit changes**

```bash
git add src/runtime/runtime-execution-guard.ts migrations/018_add_execution_records.sql \
  src/server.ts src/infrastructure/database/database.ts \
  tests/unit/runtime-execution-guard.test.ts tests/integration/mcp-execution-guard.test.ts
git commit -m "feat: add MCP execution guard for TOCTOU protection

- Creates execution_records table for tracking in-flight tool executions
- Implements runtime-execution-guard.ts with atomic permit acquisition
- Integrates guard into MCP handler in server.ts
- Adds comprehensive unit and integration tests
- Prevents tool execution during ownership transition
- Closes time-of-check/time-of-use vulnerability"
```

---

### Task 3: Create Cross-Process Concurrency Tests

**Files:**
- Create: `tests/integration/runtime-concurrency.test.ts`

**Interfaces:**
- Uses: child_process.fork, shared SQLite database, prepared lifecycle operations

- [ ] **Step 1: Create concurrency test file**

```typescript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { fork } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync, rmSync } from 'node:fs';
import { once } from 'node:events';
```

- [ ] **Step 2: Implement Scenario A - Simultaneous activation**

```typescript
it('Scenario A: Simultaneous activation - exactly one wins', async () => {
  const dbPath = '/tmp/test-concurrency.db';
  
  // Clean up any existing database
  try { rmSync(dbPath); } catch {}

  // Fork two child processes that compete for activation
  const child1 = fork(join(process.cwd(), 'tests/helpers/concurrency-worker.ts'), [dbPath, 'claude']);
  const child2 = fork(join(process.cwd(), 'tests/helpers/concurrency-worker.ts'), [dbPath, 'hermes']);

  // Send start signal to both simultaneously
  child1.send('activate');
  child2.send('activate');

  // Wait for results
  const [result1] = await once(child1, 'message') as any;
  const [result2] = await once(child2, 'message') as any;

  // Exactly one should succeed
  const successes = [result1, result2].filter((r: any) => r.success).length;
  assert.strictEqual(successes, 1, 'Exactly one activation should succeed');

  // Clean up
  child1.kill();
  child2.kill();
  rmSync(dbPath, { recursive: true, force: true });
});
```

- [ ] **Step 3: Implement Scenario B-G (similar pattern)**

Scenarios:
- B: Two simultaneous Claude activations
- C: Two simultaneous Hermes activations  
- D: Simultaneous switching
- E: Heartbeat vs stale recovery
- F: Execution vs switching
- G: Process crash recovery
- H: Credential revocation

- [ ] **Step 4: Run concurrency tests**

Run: `npm test -- tests/integration/runtime-concurrency.test.ts`
Expected: All 8 scenarios pass

- [ ] **Step 5: Commit changes**

```bash
git add tests/integration/runtime-concurrency.test.ts tests/helpers/concurrency-worker.ts
git commit -m "test: add cross-process concurrency tests for runtime ownership

- Tests simultaneous activation with child processes
- Tests concurrent switching operations
- Tests heartbeat vs stale recovery race condition
- Tests execution vs switching safety
- Tests crash recovery integrity
- Tests credential revocation
- Uses isolated SQLite database for test isolation
- Verifies database state after each scenario"
```

---

### Task 4: Create Shared Memory Integration Tests

**Files:**
- Create: `tests/integration/runtime-shared-memory.test.ts`

**Interfaces:**
- Uses: Actual MCP memory tools, runtime authentication, database persistence

- [ ] **Step 1: Create shared memory test file**

```typescript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createDatabase } from '../../src/database.js';
import { RuntimeLifecycleManager } from '../../src/runtime/lifecycle.js';
```

- [ ] **Step 2: Implement Test A - Claude writes, Hermes reads**

```typescript
it('Test A - Claude writes, Hermes reads same memory', async () => {
  const db = createDatabase(':memory:');
  const lifecycle = new RuntimeLifecycleManager(db);
  
  // Activate Claude
  lifecycle.connect({ runtime: 'claude', clientIp: '127.0.0.1' });
  
  // Write memory through MCP tool (using test MCP client)
  // Verify memory exists in database
  
  // Switch to Hermes
  lifecycle.switch({ newRuntime: 'hermes' });
  
  // Read same memory through MCP tool
  // Verify content matches
  
  db.close();
});
```

- [ ] **Step 3: Implement Test B-F**

Tests:
- B: Hermes writes, Claude reads
- C: Shared Council knowledge survives switching
- D: Private memory isolation enforced
- E: History persistence across switches
- F: Bridge restart persistence

- [ ] **Step 4: Run shared memory tests**

Run: `npm test -- tests/integration/runtime-shared-memory.test.ts`
Expected: All 6 tests pass

- [ ] **Step 5: Commit changes**

```bash
git add tests/integration/runtime-shared-memory.test.ts
git commit -m "test: add shared memory integration tests for runtime switching

- Tests Claude-to-Hermes memory read/write
- Tests Hermes-to-Claude memory read/write
- Tests Council knowledge persistence across switches
- Tests private memory isolation
- Tests history and task persistence
- Tests bridge restart database persistence
- Uses actual MCP memory tools and database
- Verifies no data loss or duplication on switching"
```

---

### Task 5: Create Required Documentation Reports

**Files:**
- Create: `docs/reports/SINGLE_ACTIVE_RUNTIME_REMEDIATION_BASELINE.md`
- Create: `docs/reports/SINGLE_ACTIVE_RUNTIME_IMPLEMENTATION_REPORT.md`
- Create: `docs/reports/SINGLE_ACTIVE_RUNTIME_TEST_EVIDENCE.md`
- Create: `docs/reports/SINGLE_ACTIVE_RUNTIME_FINAL_AUDIT.md`
- Create: `docs/reports/SINGLE_ACTIVE_RUNTIME_FILE_MANIFEST.md`

- [ ] **Step 1: Write remediation baseline report**

Document:
- Actual current behavior after Phase 10 commit 4b1be96
- Exact source locations for all implemented changes
- Security corrections applied
- Remaining gaps identified

- [ ] **Step 2: Write implementation report**

Document:
- Final architecture for Single Active Runtime
- Control-plane authentication (Founder)
- Runtime authentication (Claude/Hermes)
- Runtime session credentials
- Lifecycle management
- MCP execution guard
- Heartbeat integration
- Database invariants

- [ ] **Step 3: Write test evidence report**

Document:
- Unit test results
- Integration test results
- Concurrency test results
- MCP E2E test results
- Build status

- [ ] **Step 4: Write final audit report**

Document:
- Complete Requirements checklist (PASS/PARTIAL/FAIL)
- Source-level verification
- Security review
- Concurrency review
- Memory review

- [ ] **Step 5: Write file manifest**

Document all files created/modified with:
- Path
- Added/Modified/Deleted
- Purpose
- Related requirement

- [ ] **Step 6: Commit documentation**

```bash
git add docs/reports/*.md
git commit -m "docs: add Phase 10 completion documentation reports

- SINGLE_ACTIVE_RUNTIME_REMEDIATION_BASELINE.md
- SINGLE_ACTIVE_RUNTIME_IMPLEMENTATION_REPORT.md
- SINGLE_ACTIVE_RUNTIME_TEST_EVIDENCE.md
- SINGLE_ACTIVE_RUNTIME_FINAL_AUDIT.md
- SINGLE_ACTIVE_RUNTIME_FILE_MANIFEST.md

All reports document the completed Single Active Runtime implementation
with verification evidence and readiness assessment."
```

---

## Summary

This plan completes Phase 10 implementation with:
1. Fail-closed lease validation (security critical)
2. MCP execution guard (prevents TOCTOU race conditions)
3. Cross-process concurrency tests (proves database-level invariant)
4. Shared memory integration tests (proves runtime interchangeability)
5. Complete documentation reports (required for Founder acceptance)

Total estimated tasks: 5 major phases with 50+ atomic steps.

**Note:** Items 7-12 (heartbeat integration, frontend control, observability) may require actual Claude/Hermes client access for full verification and are marked as potentially BLOCKED if external runtime access is unavailable.