# Single Active Runtime - File Manifest

## Changed Files

| Path | Action | Purpose | Related Requirement | Test Coverage |
|------|--------|---------|---------------------|---------------|
| `src/runtime/runtime-ownership.middleware.ts` | CREATE | Ownership guard for MCP tool execution boundary | 3.1, 3.2, 3.3, 3.4 | New unit tests needed |
| `src/runtime/heartbeat-manager.ts` | NOT CREATED | Documented as limitation - requires runtime client integration | 4.1, 4.2 | Document limitation |
| `src/server.ts` | MODIFY | Add runtime ownership check before MCP tools register | 3.3, 3.5 | Integration tests |
| `src/runtime/lifecycle.ts` | MODIFY | Timestamp consistency, checkOwnership fixes, atomic recovery | 6.1, 6.4 | 25 unit tests |
| `src/infrastructure/database/database.ts` | MODIFY | Add SQL conditions to heartbeat statement | 6.1, 6.4 | Unit tests verify |
| `tests/unit/runtime-lifecycle.test.ts` | MODIFY | Rewrite with test isolation, add 10 new tests | 11.1, 11.2 | 25 tests pass |
| `tests/integration/runtime-concurrency.test.ts` | NOT CREATED | Cross-process tests not yet implemented | 11.3 | Pending |
| `docs/reports/SINGLE_ACTIVE_RUNTIME_BASELINE_AUDIT.md` | CREATE | Source-based analysis of current state | 12.1 | N/A |
| `docs/reports/SINGLE_ACTIVE_RUNTIME_TEST_EVIDENCE.md` | UPDATE | Test results documentation | 12.4 | See test output |
| `docs/reports/SINGLE_ACTIVE_RUNTIME_FINAL_AUDIT.md` | UPDATE | Final audit with all fixes | 12.5 | N/A |

## New Files Created

1. `src/runtime/runtime-ownership.middleware.ts` - 87 lines
   - `RuntimeOwnershipContext` interface
   - `RuntimeOwnershipResult` interface
   - `createRuntimeOwnershipGuard()` function
   - `mcpOwnershipErrorResponse()` function
   - `runtimeOwnershipMiddleware()` Express middleware

2. `docs/reports/SINGLE_ACTIVE_RUNTIME_BASELINE_AUDIT.md` - Baseline analysis

## Modified Files (Detailed Changes)

### src/runtime/lifecycle.ts
- Removed `addMillisecondsToISO()` function (was returning ISO format)
- Renamed `parseISO()` to `parseUnixMs()` for clarity
- Fixed `checkOwnership()` to verify active runtime ownership
- Fixed `switch()` to use Unix milliseconds instead of ISO format
- Made `heartbeat()` atomic with SQL conditions
- Fixed `recoverStaleSessions()` for race safety

### src/infrastructure/database/database.ts
- Added to `updateRuntimeSessionHeartbeat` WHERE clause:
  - `connection_status = 'connected'`
  - `lease_expires_at` check

### src/server.ts
- Added import for `createRuntimeOwnershipGuard` and `mcpOwnershipErrorResponse`
- Added ownership check in `/mcp` endpoint before `registerMcpTools()`
- Returns 403 MCP error for ownership violations

### tests/unit/runtime-lifecycle.test.ts
- Added `beforeEach` with `resetRuntimeLifecycleManager()`
- Added 10 new test cases for timestamp, heartbeat, expiry
- Total: 25 tests

## Files NOT Modified (per scope)

- `src/mcp/tools.ts` - No changes to tool registration
- `src/auth/` - Authentication unchanged
- `frontend/` - Frontend not in scope for this phase
- `src/council/` - Council operations unchanged
- `src/api/routes/*.ts` - REST routes unchanged

## Migration Status

- Migration 017 verified present in schema
- `idx_single_active_runtime` constraint confirmed
- No production database modifications applied