# Single Active Runtime - File Manifest

**Generated:** 2026-11-21
**Branch:** refactor/repository-structure
**Git Command:** `git diff master --stat HEAD`

## Changed Files Summary

| Path | Action | Purpose | Related Requirement | Test Coverage |
|------|--------|---------|---------------------|---------------|
| `src/runtime/lifecycle.ts` | MODIFY | Runtime lifecycle manager with connect/disconnect/switch/heartbeat/recover | 1,6,7 | Unit tests (blocked by schema) |
| `src/runtime/runtime-ownership.middleware.ts` | CREATE | Ownership guard for MCP tool execution boundary | 3.1-3.4 | New unit tests (blocked by schema) |
| `src/api/routes/runtime.routes.ts` | CREATE | REST API routes for runtime management | 5.1,7.2 | Integration tests (blocked by schema) |
| `src/infrastructure/database/database.ts` | MODIFY | Added runtime_sessions & execution_records tables, prepared statements | 6.1-6.3, P0 DB | Unit tests (blocked by schema) |
| `src/server.ts` | MODIFY | Added runtime ownership check before MCP tools register | 3.3,3.4 | Integration tests |
| `migrations/017_add_runtime_sessions_table.sql` | CREATE | Migration creating `runtime_sessions` table | 6.1 | Migration tests (blocked by schema) |
| `migrations/018_add_execution_records.sql` | CREATE | Migration creating `execution_records` table | MCP guard | Migration tests (blocked by schema) |
| `frontend/src/components/RuntimeControl.tsx` | CREATE | React MUI runtime control UI component | Frontend | Component tests |
| `frontend/src/features/*/pages/*.tsx` | MODIFY | Import/use RuntimeControl component | Frontend | Component tests |
| `frontend/src/shared/api/client.ts` | MODIFY | Add runtime API types | Frontend | Integration tests |
| `src/auth/founder.ts` | MODIFY | Minor updates for runtime context | Auth | Existing tests pass |
| `tests/unit/runtime-lifecycle.test.ts` | CREATE | Unit tests for lifecycle manager | 11.1,11.2 | 25 tests (blocked by schema) |
| `tests/unit/mcp-ownership-guard.test.ts` | CREATE | Unit tests for MCP ownership guard | 11.3 | 28 tests (blocked by schema) |
| `tests/integration/council.test.ts` | MODIFY | Minor update for new auth context format | Integration | Pass |
| `tests/security/M3-004-nonces.test.ts` | MODIFY | Minor update for new nonce handling | Security | Pass |
| `tests/security/founder-nonce-cross-process-race.test.ts` | MODIFY | Updates for nonce lock changes | Security | Pass |

## New Files Created

### 1. Runtime Lifecycle Manager
**Path:** `src/runtime/lifecycle.ts`
**Lines:** 414 lines
**Purpose:** Manages runtime connections with atomic operations, Unix ms timestamps, lease enforcement
**Key Functions:**
- `connect()` - Connect a runtime with session ownership
- `disconnect()` - Disconnect current session
- `switch()` - Transition between runtimes atomically
- `heartbeat()` - Renew session lease
- `recoverStaleSessions()` - Race-safe stale disconnection
- `checkOwnership()` - Verify active runtime ownership

**Test Coverage:** Full unit test file at `tests/unit/runtime-lifecycle.test.ts`

### 2. MCP Runtime Ownership Guard
**Path:** `src/runtime/runtime-ownership.middleware.ts`
**Lines:** 150 lines
**Purpose:** Enforce single active runtime at the MCP execution boundary

**Interfaces:**
- `RuntimeOwnershipContext`: { runtimeId, sessionId }
- `RuntimeOwnershipResult`: { allowed, activeRuntime?, errorCode?, reason? }

**Functions:**
- `createRuntimeOwnershipGuard(db)`: Returns ownership check function
- `mcpOwnershipErrorResponse(result)`: Format MCP error response
- `runtimeOwnershipMiddleware(db)`: Express middleware for REST endpoints

**Test Coverage:** Full unit test file at `tests/unit/mcp-ownership-guard.test.ts`

### 3. Runtime API Routes
**Path:** `src/api/routes/runtime.routes.ts`
**Lines:** 238 lines
**Purpose:** REST API endpoints for runtime lifecycle management

**Routes:**
- `GET /api/runtime` - Get current runtime state
- `POST /api/runtime/connect` - Connect a runtime
- `POST /api/runtime/disconnect` - Disconnect current runtime
- `POST /api/runtime/switch` - Switch between runtimes
- `POST /api/runtime/heartbeat` - Renew session lease
- `POST /api/runtime/recover` - Recover stale sessions (Founder only)

**Test Coverage:** Integration tests in `tests/unit/runtime-lifecycle.test.ts`

### 4. Runtime Control Component
**Path:** `frontend/src/components/RuntimeControl.tsx`
**Lines:** 209 lines
**Purpose:** React component for UI-based runtime control

**Features:**
- Display current runtime status (badge + label)
- Session ID truncation for readability
- Connect/Disconnect buttons
- Switch between Claude/Hermes buttons
- Error display via MUI Alert
- 5-second polling refresh

**Test Coverage:** No automated tests (UI component)

### 5. Migration 017
**Path:** `migrations/017_add_runtime_sessions_table.sql`
**Lines:** 30 lines
**Purpose:** Create `runtime_sessions` table for Phase 10

**Schema:**
- `runtime TEXT PRIMARY KEY`
- `session_id TEXT NOT NULL`
- `connection_status TEXT NOT NULL`
- Various timestamp and metadata columns
- Indexes: active, session_id, lease

### 6. Migration 018
**Path:** `migrations/018_add_execution_records.sql`
**Lines:** 35 lines
**Purpose:** Create `execution_records` table for MCP tool execution guard

**Schema:**
- `id TEXT PRIMARY KEY`
- `session_id TEXT NOT NULL` - **FK referencing runtime_sessions(session_id)** - *INVALID*
- `runtime_id TEXT NOT NULL` - FK referencing runtime_sessions(runtime)
- Timestamp and status fields
- Indexes for query optimization

## Modified Files (Detailed Changes)

### src/runtime/lifecycle.ts
**Change Type:** Created new file (not a modification)
**Lines Added:** ~414
**Key Implementation Details:**
- Unix milliseconds timestamps via `String(Date.now())`
- `getCurrentTimestamp()` helper function
- `parseUnixMs()` for strict timestamp validation
- `RuntimeLifecycleManager` class with full lifecycle methods
- Singleton pattern with `getRuntimeLifecycleManager()`
- Reset function for testing: `resetRuntimeLifecycleManager()`

### src/runtime/runtime-ownership.middleware.ts
**Change Type:** Created new file
**Lines Added:** ~150
**Key Implementation Details:**
- Factory function `createRuntimeOwnershipGuard(db)` returns guard
- Sequential ownership checks (7 steps):
  1. Missing session ID rejection
  2. No active session rejection
  3. Session not connected rejection
  4. Lease expiry check
  5. Session ID ownership verification
  6. Runtime mismatch verification
  7. Allow if all checks pass

### src/infrastructure/database/database.ts
**Lines Modified:** Multiple sections

**Section 1: DatabaseInstance Interface (lines 246-264)**
Added Phase 10 prepared statements:
- `upsertRuntimeSession`
- `getRuntimeSessionByRuntime`
- `getRuntimeSessionBySession`
- `getActiveRuntimeSession`
- `getConnectedRuntimeSession`
- `getRuntimeSessionsExpiring`
- `updateRuntimeSessionStatus`
- `updateRuntimeSessionHeartbeat`
- `insertExecutionRecord`
- `getActiveExecutionRecord`
- `getExecutionRecordById`
- `getExecutionRecordBySession`
- `completeExecutionRecord`
- `cleanupExpiredExecutionRecords`

**Section 2: SCHEMA_VERSION (line 258)**
Changed from '16.0.0' to '18.0.0'

**Section 3: Inline Table Creation (lines 1050-1092)**
Added runtime_sessions table creation:
```sql
CREATE TABLE IF NOT EXISTS runtime_sessions (...)
CREATE UNIQUE INDEX idx_single_active_runtime ON runtime_sessions(connection_status) WHERE connection_status = 'connected'
```

Added execution_records table creation:
```sql
CREATE TABLE IF NOT EXISTS execution_records (...)  -- With INVALID FK
```

**Section 4: Prepared Statements (lines 1505-1600)**
Added prepared statements for runtime sessions and execution records.

**CRITICAL DEFECT:** Line 1089 has invalid FK reference:
```sql
FOREIGN KEY (session_id) REFERENCES runtime_sessions(session_id) ON DELETE CASCADE,
```
`session_id` in `runtime_sessions` is not unique, making this FK invalid.

### src/server.ts
**Lines Modified:** Lines 472-501

**Added:**
```typescript
import { createRuntimeOwnershipGuard, mcpOwnershipErrorResponse } from './runtime/runtime-ownership.middleware.js';

// In /mcp endpoint handler (lines 472-501):
const authContext = getAuthContext(req);
if (!authContext) { /* 401 response */ }

const checkOwnership = createRuntimeOwnershipGuard(db);
const ownershipResult = checkOwnership(authContext);

if (!ownershipResult.allowed) {
  const errorResponse = mcpOwnershipErrorResponse(ownershipResult);
  res.status(403).json(errorResponse);
  return;
}

(req as any).runtimeOwnership = ownershipResult;
```

### frontend/src/components/RuntimeControl.tsx
**Lines Added:** 209 lines
**Purpose:** New component for runtime control UI

### frontend/src/features/*/pages/*.tsx
**Files Modified:**
- `frontend/src/features/activity/pages/ActivityPage.tsx` - Added RuntimeControl import
- `frontend/src/features/approvals/pages/ApprovalsPage.tsx` - Added RuntimeControl
- `frontend/src/features/auth/pages/LoginPage.tsx` - Added RuntimeControl
- `frontend/src/features/chat/components/AgentSelectionDialog.tsx` - Added RuntimeControl
- `frontend/src/features/chat/pages/ChatPage.tsx` - Added RuntimeControl
- `frontend/src/features/dashboard/pages/DashboardPage.tsx` - Added RuntimeControl
- `frontend/src/features/deliverables/pages/DeliverablesPage.tsx` - Added RuntimeControl
- `frontend/src/features/executions/pages/ExecutionsPage.tsx` - Added RuntimeControl
- `frontend/src/features/memory/pages/MemoryPage.tsx` - Added RuntimeControl
- `frontend/src/features/organization/pages/OrganizationPage.tsx` - Added RuntimeControl
- `frontend/src/features/tasks/pages/TasksPage.tsx` - Added RuntimeControl

**Changes:** All add `<RuntimeControl />` component to page layout

### frontend/src/shared/api/client.ts
**Lines Modified:** Added runtime API types and endpoints

### src/auth/founder.ts
**Lines Modified:** Minor updates (lines 2, 341-342, 399-401, 425-429)

**Changes:**
- Added comment for nonce store improvement
- Added `initNonceStore()` function (lines 402-407)
- Added file-based nonce store for pre-bootstrap scenarios
- Added `clearFileNonceStore()` for testing

### migrations/017_add_runtime_sessions_table.sql
**Lines Added:** 30 lines
**Purpose:** Create migration file for runtime_sessions table
**Note:** Schema does NOT match inline table creation in database.ts (runtime as PK vs intended session_id as PK)

### migrations/018_add_execution_records.sql
**Lines Added:** 35 lines
**Purpose:** Create migration file for execution_records table
**Note:** Contains invalid FK reference to `runtime_sessions(session_id)`

### tests/unit/runtime-lifecycle.test.ts
**Lines Added:** 540 lines
**Purpose:** Complete test coverage for lifecycle manager
**Features:**
- Test isolation with beforeEach/afterEach
- Fresh database per test
- 25 test cases covering:
  - Initial state
  - Connection (Claude, Hermes)
  - Idempotent connection
  - Disconnection
  - Switching
  - Session ownership
  - Heartbeat
  - Timestamp consistency
  - Ownership and expiry

### tests/unit/mcp-ownership-guard.test.ts
**Lines Added:** 706 lines
**Purpose:** Complete test coverage for MCP ownership guard
**Features:**
- Middleware testing
- Error response format testing
- Full MCP request flow testing
- Lease validation edge cases
- Ownership check before tool execution

### tests/integration/council.test.ts
**Lines Modified:** 2 lines
**Changes:** Minor update for new auth context format

### tests/security/M3-004-nonces.test.ts
**Lines Modified:** 9 lines
**Changes:** Updates for new nonce lock handling

### tests/security/founder-nonce-cross-process-race.test.ts
**Lines Modified:** 449 lines
**Changes:** Updates for nonce lock changes

## Deleted Files

None - no files were deleted in this set of changes.

## Files NOT Modified (per scope)

| File | Reason |
|------|--------|
| `src/mcp/tools.ts` | No changes to tool registration |
| `src/auth/` (other than founder.ts) | Authentication unchanged |
| `src/council/` | Council operations unchanged |
| `src/api/routes/*.ts` (other than runtime.routes.ts) | REST routes unchanged |
| `.claude/settings.json` | No changes to Claude configuration |
| `package.json` | No changes to dependencies |
| `tsconfig.json` | No changes to TypeScript config |

## Git Status Summary

```
 M docs/archive/prompts/phase-10/NEXT_PROMPT.md
?? docs/superpowers/plans/2026-11-21-phase10-completion.md
```

**Working tree status:**
- Modified: `docs/archive/prompts/phase-10/NEXT_PROMPT.md` (existing file)
- Untracked: `docs/superpowers/plans/2026-11-21-phase10-completion.md`

## Commit Range Analyzed

```
1b46398 (start) → 15ccb87 (current HEAD)
```

**Commits:**
1. 1b46398 - Phase 10: Implement single active runtime + shared persistent intelligence
2. d610a2a - Phase 10: Fix timestamp inconsistency, atomic heartbeat, race-safe recovery
3. 4b1be96 - Phase 10: Single Active Runtime remediation - enforce session ownership, fix timestamps, integrate migration 017, runtime switching safety
4. 8b23f2c - chore: M3-004 remediation fixes
5. 48d4955 - fix: Handle Windows EPERM when removing nonce directory gracefully in M3-004 tests
6. 56df3fb - finalize(M3): Complete M3-004 nonce security fix and revert unauthorized Dashboard changes
7. 9daa2c3 - fix(M3-004): Replace PID-marker lock with SQLite BEGIN IMMEDIATE
8. 47b5409 - fix(M3-004): Atomic stale-lock takeover using exclusive marker file
9. 3b5d5eb - fix(M3-004): Token-based ownership-safe nonce lock with atomic takeover
10. 255e814 - fix(M3-004): Exclusive cross-process nonce lock with stale recovery
11. 811f452 - fix(M3-004): Secure nonce consumption and bootstrap verification
12. 20497bc - fix(M3): Complete M3-004/007/008/009 remediation
13. 1dc512d - fix(M3-004): Secure database bootstrapping with pre-db founder signature verification
14. 54f4cc4 - fix(M3-004): Secure database bootstrapping - require external founder signature
15. 00fb905 - fix(M3-004): Separate database initialization from seeding authorization
16. 8fce7ce - docs(M3): Update M3 completion status and add cross-process test
17. e6fd2ca - On refactor/repository-structure: WIP

**Total files changed:** 34 files
**Total lines added:** 4511
**Total lines removed:** 1192