# RUNTIME AUTHENTICATION BASELINE AUDIT

**Date:** 2026-11-22  
**Branch:** refactor/repository-structure  
**HEAD:** 8b0372257e8dc282e9e30a5b56cc40f180e50002

## 1. EXISTING WORKING TREE

**Modified files:**
- `docs/archive/prompts/phase-10/NEXT_PROMPT.md` - Phase 10 implementation plan
- `src/infrastructure/database/database.ts` - Schema updates (runtime_sessions, runtime_control, execution_records)
- `src/runtime/lifecycle.ts` - Runtime lifecycle manager
- `src/runtime/runtime-execution-guard.ts` - Execution guard for MCP tool execution
- `src/server.ts` - Server with runtime routes

**Untracked files:**
- `docs/reports/RUNTIME_AUTHENTICATION_BASELINE_AUDIT.md` - This document
- `migrations/019_create_runtime_credentials.sql` - Migration for runtime_credentials table
- `migrations/020_create_runtime_control_table.sql` - Migration for runtime_control table
- `src/auth/runtime-credentials.ts` - Runtime credential generation and validation
- `src/runtime/runtime-types.ts` - TypeScript types for runtime
- `tests/unit/runtime-authentication.test.ts` - Unit tests

## 2. CURRENT ARCHITECTURE

### Authentication Model
- **Founder authentication:** Uses cryptographic signatures (ed25519) for privileged operations
- **Session-based auth:** Token-based sessions for staff/division/seat members
- **Local mode:** Loopback-only auto-authentication for development

### Runtime Lifecycle
- **Runtime sessions table:** Stores runtime connection state
- **Single-active-runtime invariant:** Enforced via partial unique index on `connection_status = 'connected'`
- **Generation column:** For execution fencing
- **runtime_control table:** Authoritative runtime pointer with generation tracking

### Database Schema (Current Version: 20.1.0)
Tables added:
- `runtime_sessions` - Runtime connection state with generation column
- `runtime_control` - Authoritative runtime/session pointer
- `execution_records` - Execution permit tracking with generation

## 3. IMPLEMENTATION GAPS

### Loop 1: Independent Runtime Authentication
**✅ IMPLEMENTED:**
- `src/auth/runtime-credentials.ts` provides:
  - `generateRuntimeCredential()` - 256-bit credential generation
  - `hashCredential()` - SHA-256 hashing
  - `validateRuntimeCredential()` - Full validation with Bearer scheme
  - `provisionRuntimeCredential()` - Credential provisioning
  - `insertRuntimeCredential()` - Database persistence
  - `revokeRuntimeCredential()` - Credential revocation
  - `hasActiveCredential()` - Active credential check

**⚠️ ISSUE:** Runtime credentials are NOT integrated into the authentication middleware.

The `authMiddleware` in `src/api/middleware/authentication.ts` still:
1. Falls through invalid Bearer tokens to local Founder mode
2. Uses hardcoded `'claude'` runtime for bootstrap sessions
3. Does NOT validate runtime credentials against `runtime_credentials` table

**Required fix:** Modify authentication middleware to:
1. Reject invalid Bearer tokens (401)
2. Validate runtime credentials
3. Extract runtime identity from the credential (not from request)

### Loop 2: Authoritative Runtime Lifecycle
**✅ PARTIALLY IMPLEMENTED:**

`src/runtime/lifecycle.ts` provides:
- `connect()` - Connect a runtime session
- `disconnect()` - Disconnect a session
- `switch()` - Switch between runtimes
- `heartbeat()` - Renew session lease
- `recoverStaleSessions()` - Stale session recovery

**⚠️ ISSUE:** The lifecycle manager doesn't use `runtime_control` table for authoritative state.

The `connect()` method checks for existing active sessions but doesn't update the `runtime_control` table atomically.

### Loop 3: Generation-Based Execution Fencing
**✅ IMPLEMENTED IN PART:**

`src/runtime/runtime-execution-guard.ts`:
- Acquires execution permits via atomic transactions
- Checks session validity, lease, and connection status
- Integrates with `RuntimeLifecycleManager`

**⚠️ ISSUE:** Generation fencing is not fully enforced across the system. The execution guard checks session generation but the lifecycle manager doesn't update it properly during handoff.

### Loop 4: Heartbeat and Lease Lifecycle
**✅ IMPLEMENTED:**
- 10-minute lease duration
- 30-second idle heartbeat
- 5-minute execution heartbeat renewal
- Stale session recovery

### Loop 5: Production MCP Integration
**✅ PARTIALLY IMPLEMENTED:**

`src/server.ts`:
- Imports `createRuntimeExecutionGuard`
- Uses `createRuntimeOwnershipGuard` for MCP endpoint
- Routes registered for `/api/runtime`

**⚠️ ISSUE:** The authentication middleware on `/mcp` endpoint still allows invalid tokens to fall through to bootstrap mode.

## 4. REQUIRED CODE CHANGES

### 4.1 Fix Authentication Middleware
**File:** `src/api/middleware/authentication.ts`

**Current behavior:**
```typescript
// Invalid Bearer token falls through to local mode
if (!session) {
  // Falls through to auto-auth as Founder
}
```

**Required behavior:**
```typescript
// Invalid Bearer token should REJECT
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
}

const token = authHeader.substring(7);
const credentialResult = validateRuntimeCredential(db, token);

if (!credentialResult.valid) {
  return res.status(401).json({ error: 'Invalid token', code: credentialResult.error?.code });
}

// Use credential's runtime, NOT request-controlled
```

### 4.2 Add Runtime Credential Authentication Endpoint
**File:** `src/api/routes/runtime.routes.ts` (need to add credential management routes)

Required endpoints:
- `POST /api/runtime/credentials` - Provision new credential (Founder only)
- `POST /api/runtime/credentials/revoke` - Revoke credential (Founder only)
- `GET /api/runtime/credentials` - List credentials (Founder only)

### 4.3 Update Runtime Control Integration
**File:** `src/runtime/lifecycle.ts`

The lifecycle manager should update `runtime_control` table atomically during connect/switch/disconnect operations.

## 5. MIGRATION REQUIREMENTS

**Current state:** Migrations 019 and 020 exist but are not integrated into the migration runner.

**Action required:**
1. Add migrations to the migration runner
2. Ensure database initialization applies these migrations
3. Test fresh database creation
4. Test upgrade from current schema version

## 6. SECURITY CONCERNS

### 6.1 Invalid Token Fallback (CRITICAL)
The current authentication flow has a dangerous fallback:
1. Invalid Bearer token → Falls through to local Founder authentication
2. Local Founder mode allows `session_id: 'local-founder'`
3. This bypasses runtime credential validation

**Risk:** An attacker could provide an invalid token and get authenticated as Founder with `runtime: 'claude'`.

### 6.2 Runtime Identity Injection
The current flow allows runtime identity to be specified in:
- Request body (`runtime: request.body.runtime`)
- Auth context (`runtime: authContext.runtime`)

**Risk:** Caller could potentially specify arbitrary runtime identity.

### 6.3 Missing Runtime Credential Integration
The `runtime_credentials` table exists but:
- No API endpoint to provision credentials
- Not integrated into authentication middleware
- Tests may not cover credential-based auth end-to-end

## 7. KNOWN RISKS

| Risk | Severity | Mitigation |
|------|----------|------------|
| Invalid Bearer fallback to Founder | Critical | Remove fallback, reject with 401 |
| Hardcoded 'claude' runtime in bootstrap | High | Validate credential, use credential's runtime |
| Race condition on session ownership | Medium | Use transactions with proper isolation |
| Duplicate credential hash | Low | UNIQUE constraint + error handling |

## 8. NEXT STEPS

1. **Fix authentication middleware** to validate runtime credentials
2. **Add credential provisioning API** (Founder-only)
3. **Integrate runtime_control** into lifecycle operations
4. **Update tests** to cover credential-based authentication
5. **Create integration tests** for MCP runtime authentication
6. **Verify TypeScript compilation** passes
7. **Run regression tests** to ensure nothing breaks

---

**Status:** IMPLEMENTATION IN PROGRESS - NEEDS INTEGRATION WORK