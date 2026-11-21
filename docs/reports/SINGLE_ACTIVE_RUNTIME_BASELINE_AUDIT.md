# Single Active Runtime - Baseline Audit

**Commit:** d610a2a  
**Branch:** refactor/repository-structure  

## Architecture Overview

### Runtime Lifecycle
- **File:** `src/runtime/lifecycle.ts`
- **Classes:** `RuntimeLifecycleManager`
- **States:** `disconnected` | `connecting` | `connected` | `disconnecting` | `switching` | `error`
- **Lease Duration:** 10 minutes (600,000 ms)
- **Timestamps:** Unix milliseconds string format

### MCP Endpoint Architecture
- **File:** `src/server.ts` line 470
- **Route:** `app.all('/mcp', authMiddleware, ...)` 
- **Pattern:** Creates new `McpServer` and `StreamableHTTPServerTransport` per request (stateless)
- **Tool Registration:** `registerMcpTools()` after auth middleware

### Authentication Flow
- **File:** `src/auth/session.ts`
- **Tokens:** Generated via `generateSessionToken()` with runtime, session_id in payload
- **SessionContext:** Contains `runtime`, `session_id`, `owner_type`, `owner_id`, `permissions`, `expires_at`

### Database Schema (Migration 017)
- **Table:** `runtime_sessions`
- **Columns:** runtime, session_id (PK), connection_status, connected_at, last_heartbeat_at, lease_expires_at, client_ip, user_agent, last_error, created_at, updated_at
- **Constraint:** `idx_single_active_runtime` - UNIQUE index on (connection_status) WHERE connection_status = 'connected'

## Identified Defects

### Defect 1: Missing MCP Runtime Ownership Check
**Location:** `src/server.ts:470`
**Severity:** P0
**Description:** The `/mcp` endpoint authenticates requests but does NOT verify that the authenticated runtime owns the active session. A Claude session could execute tools while a Hermes session is active.
**Impact:** Two runtimes could potentially have active sessions; unauthorized tool execution.

### Defect 2: Heartbeat Not Automatically Renewed
**Location:** Runtime connection layer
**Severity:** P0
**Description:** Server-side heartbeat API exists (`POST /api/runtime/heartbeat`) but actual runtime connections do not auto-renew leases. Dashboard polling is not lease renewal.
**Impact:** Sessions expire after 10 minutes without action.

### Defect 3: Timestamp Inconsistency (FIXED)
**Location:** `src/runtime/lifecycle.ts`
**Status:** Fixed in current commit
**Description:** `switch()` used `addMillisecondsToISO()` returning ISO format, while `heartbeat()` expected Unix ms.
**Fix:** Both now use `String(Number(now) + LEASE_DURATION_MS)`

### Defect 4: Non-Atomic Heartbeat Updates
**Location:** `src/infrastructure/database/database.ts`
**Status:** Fixed in current commit  
**Description:** Original heartbeat did not check connection_status or expiry in SQL.
**Fix:** SQL WHERE clause now includes `connection_status = 'connected'` and `lease_expires_at` check.

## Current MCP Tool Execution Flow

```
Request → authMiddleware → getAuthContext(req) → registerMcpTools() → handleRequest()
                                             ↑
                                             └── AuthContext has runtime & session_id
```

**Missing:** Ownership verification between auth and tool execution.

## Required Changes

1. Add ownership middleware that checks active session matches auth context
2. Apply middleware before `registerMcpTools()` in `/mcp` endpoint
3. Create heartbeat manager for automatic renewal
4. Implement proper state machine transitions
5. Add cross-process concurrency tests
6. Update documentation

## Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `src/runtime/runtime-ownership.middleware.ts` | CREATE | Ownership guard for MCP |
| `src/runtime/heartbeat-manager.ts` | CREATE | Auto-renewal logic |
| `src/server.ts` | MODIFY | Add ownership check before MCP tools |
| `src/runtime/lifecycle.ts` | MODIFY | State machine, heartbeat integration |
| `tests/integration/runtime-concurrency.test.ts` | CREATE | Cross-process tests |
| `docs/reports/*.md` | CREATE/UPDATE | Documentation |
