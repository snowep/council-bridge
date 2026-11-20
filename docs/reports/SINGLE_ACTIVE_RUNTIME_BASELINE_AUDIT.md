# Single Active Runtime - Baseline Audit Report

**Date:** 2026-11-20
**Branch:** refactor/repository-structure
**Baseline Commit:** 56df3fb

---

## 1. Current Branch and Commit

- **Current Branch:** `refactor/repository-structure`
- **Current HEAD:** `8b23f2c` (chore: M3-004 remediation fixes)
- **Baseline Commit:** `56df3fb` (finalize(M3): Complete M3-004 nonce security fix and revert unauthorized Dashboard changes)

**Difference from baseline:**
- HEAD is ahead of baseline by 3 commits (M3-004 remediation work)
- Baseline was: Finalize M3-004 nonce security fix

---

## 2. Working Tree Status

```
git status --short
 M docs/archive/prompts/phase-10/NEXT_PROMPT.md
```

**Working tree:** Clean, one modified file (NEXT_PROMPT.md itself - documentation of the task)

---

## 3. Existing Architecture

### 3.1 Project Structure
- **Backend:** TypeScript/Node.js with Express.js API
- **Frontend:** React + TypeScript (Vite build, MUI)
- **Database:** SQLite with better-sqlite3
- **Authentication:** Session tokens with HMAC signatures

### 3.2 Key Directories
```
src/
├── api/middleware/
│   ├── authentication.ts  # Core auth middleware with runtime awareness
│   └── error-handler.ts
├── api/routes/
│   ├── hermes-bridge.routes.ts  # Hermes webhook endpoints
│   └── ... (other resource routes)
├── auth/
│   ├── config.ts      # Auth configuration
│   ├── session.ts     # Session token management
│   ├── founder.ts     # Founder key management
│   └── index.ts       # Auth module exports
├── council/
│   ├── types.ts        # Core types
│   └── operations.ts   # Task/execution operations
├── migration-runner/   # Database migration system
├── mcp/
│   ├── tools.ts        # MCP tool definitions
│   └── hermes-bridge.ts # Hermes bridge adapter
├── infrastructure/database/
│   └── database.ts     # Database schema and statements
└── server.ts           # Main Express server
```

---

## 4. Existing Runtime Registration Mechanisms

### 4.1 Current RuntimeType Definition
**File:** `src/auth/session.ts`
```typescript
export type RuntimeType = 'claude' | 'hermes';
```

**Status:** Type already defined in SessionContext, used in session validation.

### 4.2 Session Management (In-Memory)
- Sessions stored in `Map<string, SessionContext>`
- Token format: `session_id|timestamp|random|signature`
- Validation includes optional runtime parameter

### 4.3 Agent Registration
- `hermes-bridge.routes.ts` - Webhook endpoints for Hermes agent registration
- `hermes_adapter.hermesRegister()` - Registers Hermes agents
- Agent runtime tracked in `agents` table (`runtime TEXT NOT NULL`)

---

## 5. Existing MCP Server Lifecycle

### 5.1 MCP Endpoint (server.ts)
```typescript
app.all('/mcp', authMiddleware, async (req, res, next) => {
  const requestTransport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const requestMcpServer = new McpServer({ name: 'council-bridge', version: '1.0.0' }, { capabilities: { tools: {} } });
  await requestMcpServer.connect(requestTransport);
  const authContext = getAuthContext(req);
  registerMcpTools(requestMcpServer, db, () => authContext);
  await requestTransport.handleRequest(req, res, req.body);
});
```

**Status:** Stateless MCP handler - creates new server/transport per request

---

## 6. Existing Agent Identity Model

### 6.1 Agent Types
- **Founder:** `owner_type: 'founder'` (hardcoded)
- **Staff:** `owner_type: 'staff'` (database: `staff_agents`)
- **Division:** `owner_type: 'division'` (database: `divisions`)
- **Seat:** `owner_type: 'seat'` (database: `council_seats`)

### 6.2 Runtime in Agent Model
- `agents.runtime` column tracks which runtime "owns" the agent connection
- `staff_agents.runtime_instances` JSON array tracks agent affinity

---

## 7. Existing Persistent Memory Model

### 7.1 Memory Tables
- `memory_entries` - Core memory storage with owner_type, owner_id, category, runtime tracking
- `memory_versions` - Version history with `changed_by_runtime` column
- `memory_links` - Cross-memory relationships with `created_by_runtime`
- `memory_access` - Access log with `accessor_runtime`
- `memory_fts` - Full-text search virtual table

### 7.2 Key Observation
Memory already tracks runtime provenance in multiple tables. This is the foundation needed for Phase 10.

---

## 8. Database Schema

### 8.1 Current Schema Version
`SCHEMA_VERSION = '16.0.0'`

### 8.2 No Runtime Session Tracking Table
Current schema lacks dedicated runtime session state. Sessions are in-memory only.

**Missing:**
- Table to persist `activeRuntime`, `connectionStatus`, `sessionId`, etc.

---

## 9. Authentication and Authorization

### 9.1 Auth Flow
1. `POST /api/auth/session` - Create session token
2. `authMiddleware` - Validates Bearer token
3. Founder signature verification via `verifyFounderOperation()`

### 9.2 Local Single-User Mode
- Loopback-only connection restriction
- Auto-authentication as Founder in local mode
- `isLocalSingleUserMode()` function exists

---

## 10. Runtime-Related API Endpoints

### 10.1 Existing Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/session` | POST | Create session token |
| `/api/auth/session` | DELETE | Invalidate session |
| `/api/auth/status` | GET | Get auth status |
| `/api/hermes/webhook` | POST | Hermes webhook |
| `/api/hermes/session` | POST | Hermes session token |
| `/api/hermes/agents` | GET | List Hermes agents |
| `/mcp` | ALL | MCP tool invocation |

### 10.2 Missing Endpoints
- `GET /api/runtime` - Get active runtime state
- `POST /api/runtime/connect` - Connect runtime
- `POST /api/runtime/disconnect` - Disconnect runtime
- `POST /api/runtime/switch` - Switch runtime

---

## 11. Frontend Pages and Components

### 11.1 Existing Structure
```
frontend/src/
├── features/
│   ├── auth/pages/LoginPage.tsx
│   ├── dashboard/pages/DashboardPage.tsx
│   └── ... (other feature pages)
├── shared/
│   ├── theme/ - Theme definitions (light/dark)
│   └── api/client.ts - API client
└── app/
    ├── App.tsx
    └── auth-context.tsx
```

### 11.2 No Runtime Control UI
No existing UI for runtime connection management.

---

## 12. Tests Involving Claude, Hermes, Agents, Memory

### 12.1 Phase 9 Tests Exist
- `tests/unit/phase9_*.test.ts` - Task and delegation tests
- `tests/integration/*.test.ts` - Core functionality
- `tests/e2e/live-claude-hermes-messaging*.test.ts` - Live messaging tests

### 12.2 No Phase 10 Tests
No tests exist for runtime lifecycle management.

---

## 13. Identified Implementation Gaps

### 13.1 Runtime State Persistence
❌ No database table for runtime session state
❌ Sessions are in-memory only (lost on restart)

### 13.2 Single-Active-Runtime Enforcement
❌ No server-side invariant enforcement
❌ Multiple runtimes could theoretically connect simultaneously

### 13.3 Runtime Control API
❌ No dedicated runtime management endpoints
❌ No way for Founder to switch runtimes via API

### 13.4 Frontend Runtime UI
❌ No UI for runtime status
❌ No switch controls

### 13.5 Session Ownership
❌ Sessions not tracked with ownership semantics
❌ No safe recovery for stale sessions

---

## 14. Proposed Minimal Change List

### Phase 1: Database Migration (REQUIRED)
1. Create `runtime_sessions` table with:
   - `runtime` (claude|hermes)
   - `session_id` (unique)
   - `connection_status` (enum)
   - `connected_at`, `last_heartbeat`, `lease_expires_at`
   - `created_at`, `updated_at`

### Phase 2: Runtime Lifecycle Manager
1. Create `src/runtime/lifecycle.ts` with:
   - `RuntimeConnectionState` interface
   - State machine (NONE → DISCONNECTED → CONNECTING → CONNECTED → DISCONNECTING → DISCONNECTED)
   - Switching operation
   - Session ownership verification

### Phase 3: API Routes
1. Create `src/api/routes/runtime.routes.ts` with:
   - `GET /api/runtime` - Get current state
   - `POST /api/runtime/connect` - Connect runtime
   - `POST /api/runtime/disconnect` - Disconnect runtime
   - `POST /api/runtime/switch` - Switch runtime

### Phase 4: Middleware Enhancement
1. Update `authentication.ts` to check runtime ownership
2. Reject requests when wrong runtime is active

### Phase 5: Frontend UI
1. Create minimal runtime control component
2. Add to Layout or Dashboard

### Phase 6: Tests
1. Unit tests for lifecycle manager
2. Integration tests for API endpoints
3. Shared-memory tests (Claude↔Hermes memory visibility)
4. Concurrency tests (safe runtime switching)

---

## 15. Potential Migration Requirements

### 15.1 No Schema Migration Needed for Initial State
- Database will start with `active_runtime = NULL`
- All existing data preserved

### 15.2 Session Migration
- New sessions use new lifetime management
- Old in-memory sessions will be transitioned

### 15.3 Heartbeat Interval
Should examine existing patterns:
- Session timeout: 5 minutes (from `SESSION_TIMEOUT_MS`)
- Cleanup interval: 5 minutes (from `CLEANUP_INTERVAL_MS`)

**Recommendation:** Use 30-second heartbeat, 5-minute timeout

---

## 16. Potential Compatibility Risks

### 16.1 Existing Tests May Fail
- Tests that don't expect runtime enforcement may fail
- Need to ensure local mode still works

### 16.2 MCP Connection Flow
- Current MCP uses `authMiddleware`
- May need to handle "runtime already active" scenario

### 16.3 Founder Mode
- Local single-user mode must coexist with runtime management
- Need to ensure loopback restriction still enforced

### 16.4 Session Management
- Current sessions in-memory could cause issues during transition
- Need graceful handling of in-flight connections

---

## Summary

The current codebase has:
- ✅ `RuntimeType` type already defined
- ✅ Session token system in place
- ✅ Memory tables track runtime provenance
- ❌ No runtime session persistence
- ❌ No single-active-runtime enforcement
- ❌ No runtime control API
- ❌ No runtime control UI

The foundation exists but runtime lifecycle management needs to be built from scratch.