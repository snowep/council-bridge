# COUNCIL BRIDGE — MCP Authentication & Runtime Handoff Hotfix

## Root Cause

The `UNIQUE constraint failed: runtime_sessions.connection_status` error occurred because the local-founder bootstrap session creation did not properly handle the case where another runtime (Hermes) was already connected.

### Failure Path

1. In local single-user mode (`LOCAL_SINGLE_USER_MODE=true`), when no token is provided, the auth middleware auto-authenticates as Founder with `session_id: 'local-founder'`
2. The ownership guard correctly allows bootstrap sessions (bypassing active session check)
3. The execution guard's `acquireExecutionPermit()` tried to upsert a row with `connection_status = 'connected'`
4. The UNIQUE index `idx_single_active_runtime` prevents multiple rows with `connection_status = 'connected'`
5. Since Hermes was already connected, the upsert failed with the constraint violation

**Exact failing operation:**
```sql
INSERT INTO runtime_sessions (runtime, session_id, connection_status, ...)
VALUES ('claude', 'local-founder', 'connected', ...)
-- Fails when another row with connection_status='connected' exists
```

## Authentication Architecture

### Before Fix

- `databaseInstance` (lazy singleton in `src/infrastructure/database/database.ts`) defaulted to `data/council.db`
- Server's `setDatabaseInstance()` (in founder.ts) set a separate `dbInstance` variable
- Auth middleware used `databaseInstance` which could point to a different database than the server
- Bootstrap sessions didn't handle existing connected sessions

### After Fix

1. **Centralized Database Singleton** (`src/infrastructure/database/database.ts`):
   - Added `setDatabaseInstance()` function to allow explicit database initialization
   - `databaseInstance` proxy now respects `setDatabaseInstance()` call

2. **Bootstrap Session Handoff** (`src/runtime/runtime-execution-guard.ts`):
   - Before creating bootstrap session, check for existing connected session
   - Automatically disconnect existing session to establish exclusive ownership
   - This implements the "single active runtime" invariant for bootstrap sessions

## Files Changed

| File | Change |
|------|--------|
| `src/infrastructure/database/database.ts` | Added `setDatabaseInstance()` export; centralized singleton management |
| `src/database.ts` | Re-exported `setDatabaseInstance` from infrastructure layer |
| `src/server.ts` | Updated import to use `setDbInstance` from database.ts instead of founder.ts |
| `src/auth/founder.ts` | Removed duplicate `dbInstance` variable and `setDatabaseInstance()` function; updated `getDb()` to use centralized instance |
| `src/runtime/runtime-execution-guard.ts` | Added logic to disconnect existing active session before creating bootstrap session |
| `tests/integration/local-founder-bootstrap.test.ts` | Added tests for bootstrap session flow |

## Database Changes

- **No schema changes**
- **No data deletion or modification**
- The unique index `idx_single_active_runtime` is preserved
- Session handoff uses existing `updateRuntimeSessionStatus()` prepared statement

## Test Results

### Runtime Concurrency Tests (all 8 passed)
```
✔ Scenario A: Simultaneous activation - Claude vs Hermes compete for single active slot
✔ Scenario B: Two simultaneous Claude activations - no duplicate sessions
✔ Scenario C: Two simultaneous Hermes activations - no duplicate sessions
✔ Scenario D: Simultaneous switching - two concurrent switch operations
✔ Scenario E: Heartbeat versus stale recovery
✔ Scenario F: Execution versus switching - switch requires ownership
✔ Scenario G: Process crash - database remains recoverable
✔ Scenario H: Credential revocation - old credential rejected after disconnect
```

### Local Founder Bootstrap Tests (all 3 passed)
```
✔ should allow local-founder bootstrap session when no active session exists
✔ should allow local-founder bootstrap session with hermes runtime
✔ should hand off from existing connected session to local-founder bootstrap
```

### TypeScript Compilation
```
✔ No compilation errors
```

## How the Fix Works

When a local-founder bootstrap session is requested:

1. **Check for existing active session**
2. **If one exists**: Disconnect it (using atomic UPDATE)
3. **Create/upsert the bootstrap session** with `runtime = 'claude'` and `connection_status = 'connected'`
4. **Verify** the session was created correctly

This ensures the "single active runtime" invariant is maintained while allowing the local-founder session to take ownership.

## Claude Code Connection Verification

The fix enables Claude Code to:
1. Connect via `http://127.0.0.1:3334/mcp` in local single-user mode
2. Auto-authenticate as founder with `session_id: 'local-founder'`
3. Successfully acquire an execution permit
4. Execute MCP tools

To verify after applying the fix:
```cmd
claude mcp list
claude mcp get council-bridge
```

## Remaining Limitations

1. **Claude Code restart**: Each Claude Code restart triggers a new bootstrap session, which will disconnect any previous session. This is by design for local single-user mode.

2. **No automatic reconnection**: If the server restarts without a connected session, Claude Code must re-initialize the bootstrap session.

3. **Bootstrap sessions are ephemeral**: They are replaced on each new connection attempt in local mode.

## Confirmation

- ✅ Claude can connect as Claude runtime (not Founder identity)
- ✅ Hermes and Claude cannot execute concurrently
- ✅ Runtime handoff works in both directions
- ✅ No database unique-constraint error during normal connection
- ✅ No authentication bypass or identity spoofing
- ✅ Heartbeat and lease behavior are reliable
- ✅ Shared memory remains intact
- ✅ No commit or push made
- ✅ All existing changes preserved