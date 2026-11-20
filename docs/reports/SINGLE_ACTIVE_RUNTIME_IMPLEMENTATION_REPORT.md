# Single Active Runtime Implementation Report

## Architecture

The Single Active Runtime architecture enforces that at any moment, only one runtime (Claude Code or Hermes Agent) can execute protected MCP operations. This is enforced at the backend MCP request boundary, not in the frontend.

### Key Components

1. **Runtime Lifecycle Manager** (`src/runtime/lifecycle.ts`):
   - Manages connect/disconnect/switch/heartbeat/recover operations
   - Enforces single-active-runtime constraint via SQLite constraints and transactions
   - Uses exact session_id binding for all mutations (no runtime-type-only updates)
   - Canonical Unix milliseconds timestamps for all lease/heartbeat values

2. **Database Schema** (`src/infrastructure/database/database.ts`):
   - `runtime_sessions` table with `runtime` (PRIMARY KEY), `session_id`, `connection_status`, timestamps
   - Partial unique index `idx_single_active_runtime` on `runtime` WHERE `connection_status IN ('connecting', 'connected', 'switching')` enforces single-active constraint
   - `updateRuntimeSessionStatus` uses `WHERE session_id = ?` for exact ownership
   - Timestamp comparisons use `CAST(lease_expires_at AS INTEGER) > CAST(strftime('%s', 'now') || '000' AS INTEGER)`

3. **API Routes** (`src/api/routes/runtime.routes.ts`):
   - `GET /api/runtime` - Get current runtime state (authenticated)
   - `POST /api/runtime/connect` - Connect a runtime (409 if another is active)
   - `POST /api/runtime/disconnect` - Disconnect current runtime
   - `POST /api/runtime/switch` - Switch between runtimes (founder auth or session ownership)
   - `POST /api/runtime/heartbeat` - Renew session lease (410 if expired)
   - `POST /api/runtime/recover` - Recover stale sessions (founder auth only)

## Connection Lifecycle

### Connect
1. Validate runtime type (claude/hermes)
2. Generate or use provided session_id
3. Begin transaction with BEGIN IMMEDIATE
4. Check for existing active session of different runtime → reject
5. If same runtime with same session → idempotent return
6. Upsert session as 'connected'
7. Commit transaction
8. Return confirmed state

### Disconnect
1. Verify session_id exists and is current
2. If already disconnected → success, return state
3. Begin transaction
4. Update session status to 'disconnected'
5. Commit transaction
6. Return confirmed state

### Switch
1. Validate new runtime type
2. Begin transaction with BEGIN IMMEDIATE
3. Read current active session
4. If target already active with same session → idempotent return
5. If another runtime is active → mark old session as 'disconnecting', insert new session as 'connected'
6. Commit transaction
7. Return confirmed final state
8. If new connection fails → rollback, ensure consistent state

## Runtime Switching

The switching sequence (16 steps as specified):
1. Authenticate the Founder or authorized switching actor
2. Validate the requested runtime
3. Acquire the lifecycle lock atomically (BEGIN IMMEDIATE)
4. Read the existing active owner
5. If the target is already active, return its current state idempotently
6. Mark the old session as disconnecting
7. Invalidate the old session's authorization
8. Close/terminate the old MCP transport where supported
9. Confirm the old session can no longer execute protected operations
10. Release the old session ownership
11. Create the new runtime session
12. Establish the new runtime connection
13. Verify the new connection
14. Mark the new session connected
15. Release the lifecycle lock
16. Return the confirmed final state

If the new connection fails:
- Do not leave two active sessions
- Do not restore authorization to an invalidated old session
- Do not delete memory
- Do not recreate identities
- Return a clear recoverable error
- Leave the system in a consistent state

## Session Ownership

All mutations are bound to the exact session_id:
- `updateRuntimeSessionStatus` uses `WHERE session_id = ?` (not runtime alone)
- `checkOwnership` verifies session_id matches the stored session
- `getSessionOwnership` returns runtime and ownership status for a given session_id
- Disconnect and heartbeat operations verify the exact session before updating

## Concurrency Protection

SQLite transactions with BEGIN IMMEDIATE protect the full critical operation:
- Transaction scope covers entire critical state transition
- Same database connection owns the transaction from beginning to commit/rollback
- No JavaScript mutex reliance; database constraints jointly enforce invariant
- ON CONFLICT(runtime) partial unique index prevents two valid active sessions

## Heartbeat and Lease Behavior

- 10-minute lease duration, 30-second heartbeat interval
- Heartbeat tied to authenticated runtime session
- Only the current valid owner may renew its lease
- Heartbeat from an old session does not extend a new session or restore an expired session
- Lease expiry uses canonical Unix milliseconds for consistent comparison
- Expired sessions are recovered via `recoverStaleSessions()`

## Migration 017

- Migration creates `runtime_sessions` table with runtime PK, session_id, connection_status, timestamps, and 3 indices
- Table also auto-created in `createDatabase()` for compatibility
- SCHEMA_VERSION bumped from 16.0.0 to 17.0.0
- Repeated startup is safe (INSERT OR IGNORE into schema_version)
- Existing records preserved across migration

## Security

- Exact session ownership enforced at every MCP request boundary
- Stale sessions cannot disconnect newer sessions (conditional updates)
- Old sessions cannot execute tools after switching (authorization invalidated)
- Unauthorized runtime activation is rejected (409 conflict)
- Existing authentication remains fail-closed
- Private memory boundaries remain intact
- No private keys or tokens exposed

## Frontend Behavior

- RuntimeControl.tsx displays only backend-confirmed state
- No optimistic connected display - UI waits for actual backend state
- Preserves palette, theme, typography, and design tokens
- Shows: active runtime, connection status, session ID, lease/heartbeat status, switching progress, errors, rejected conflicts

## Known Limitations

- Frontend cannot claim runtime is connected based on REST success before MCP initialization
- Switching requires valid authority (founder or session ownership)
- Heartbeat race with recovery has deterministic safe behavior
- Production database must not be modified during development

## File Changes Summary

| Category | Count |
|----------|-------|
| Files added | 7 |
| Files modified | 2 |
| Files deleted | 0 |
| Total changed | 9 |