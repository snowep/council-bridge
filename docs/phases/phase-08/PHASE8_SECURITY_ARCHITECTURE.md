# Phase 8 Security Architecture

## Current Security Posture

### Authentication Model (Current)

**Runtime identity verification is implemented but minimal:**

| Component | Implementation | Status |
|-----------|---------------|--------|
| Runtime detection | `validateRuntimeIdentity()` checks `runtime` field ('claude'|'hermes') | ✅ Exists |
| Staff identity | `validateStaffAgent()` checks staff_id active status | ✅ Exists |
| Founder identity | Hardcoded: `owner_id === 'founder'` | ⚠️ Risk: static identity |
| Division head | Checked against `divisions.head_staff_id` | ✅ Exists |
| Dual-runtime support | Both claude/hermes share same staff contexts | ✅ Implemented |

**Risk:** Identity validation relies on MCP session claiming. No cryptographic verification of runtime authenticity.

### Authorization Model (Current)

**Role-based access control with fine-grained checks:**

| Role | Privileges | Implementation |
|------|------------|----------------|
| Founder | Full system access | `isFounder(ctx)` |
| Division Head | Division-scoped access | `isDivisionHead(ctx, divisionId)` |
| Staff | Task/own-execution scoped | Per-operation checks |
| Seat | Meeting-scoped | `isSeat(ctx)` |

**Authorization checks are decentralized** - each operation performs its own validation rather than using a middleware approach.

### MCP Endpoint Exposure

Current implementation uses `mcp` library without explicit security configuration. Endpoints are registered as tools with Zod validation.

**Risk:** No rate limiting, input sanitization beyond Zod schemas, session timeout, or connection limiting.

### Database Security

| Aspect | Implementation | Status |
|--------|---------------|--------|
| SQLite | WAL mode, foreign keys | ✅ Enabled |
| Prepared statements | All queries parameterized | ✅ Done |
| FK constraints | Enforced | ✅ Done |
| Secrets storage | Not applicable (local-first) | N/A |
| Connection | Single file database | ⚠️ File-based concurrency |

## Proposed Security Architecture

### Phase 8.1: Runtime Authentication

**Objective:** Cryptographically verify MCP session authenticity.

**Approach:**
1. **Session tokens** - Generate time-bound JWT-like tokens at session start
2. **Challenge-response** - Each runtime proves possession of token on each request
3. **Token storage** - Store hashed tokens in memory (never in DB)
4. **Rotation** - Tokens expire after configurable timeout (default: 30 min)

**Implementation:**
```typescript
// New auth module: src/auth/
- generateSessionToken(runtime: 'claude'|'hermes'): string
- validateSession(token: string, runtime?: 'claude'|'hermes'): AuthContext | null
- invalidateSession(token: string): boolean
- refreshSession(oldToken: string): string | null
```

**Impact:** Requires MCP wrapper to validate tokens before calling council.ts

### Phase 8.2: Identity Strengthening

**Current issue:** Founder identity is hardcoded string 'founder'.

**Proposed:**
1. **Founder key pair** - Generate RSA key pair at first run
2. **MCP header signing** - Founder signs request with private key
3. **Public key verification** - Verify signature with stored public key

**Implementation:**
```typescript
// New functionality
- generateFounderKeyPair(): {private, public}
- signFounderRequest(data: any): signature
- verifyFounderSignature(request: {data, signature}): boolean
```

**Files affected:** src/server.ts (MCP handlers)
**DB impact:** Add founder_keys table (optional, for key rotation)

### Phase 8.3: Authorization Centralization

**Current:** Authorization scattered across 20+ locations.

**Proposed:**
1. **Permission registry** - Central map of role → permissions
2. **Middleware pattern** - Decorator for authorization checks
3. **Audit logging** - All auth decisions logged

**Implementation:**
```typescript
// src/auth/permissions.ts
const PERMISSIONS = {
  FOUNDER: ['create_task_autonomy_level', 'approve_execution', ...],
  DIVISION_HEAD: ['request_execution_self_division', ...],
  STAFF: ['request_execution_own_tasks', ...]
};

function requirePermission(permission: string): MethodDecorator {
  return (target, prop, descriptor) => {
    // Wrap method with permission check
  };
}
```

### Phase 8.4: Input Validation Enhancements

**Current:** Zod schemas provide basic validation.

**Proposed additions:**
1. **Size limits** - Max string lengths, array sizes
2. **Content sanitization** - Remove potentially dangerous content
3. **Rate limiting** - Per-session request limits
4. **Input caching** - Prevent repeated expensive validation

### Phase 8.5: Audit Log Integrity

**Current:** audit_logs, memory_access tables with created_at timestamps.

**Enhancements:**
1. **Immutable entries** - No UPDATE/DELETE allowed on audit logs
2. **Cryptographic signing** - Each entry signed with rotating key
3. **Tamper detection** - Hash chain verification
4. **External backup** - Periodic export to immutable storage

## Security Boundaries

### Trusted Components (Inside)
- Council service (council.ts)
- Database layer (database.ts)
- MCP tools (server.ts)

### Untrusted Inputs (Outside)
- MCP client requests
- HTTP request bodies
- Database query parameters (all parameterized)

### Defense in Depth Layers

1. **Network:** Local filesystem only, no external network calls
2. **Session:** Token-based authentication, 30-min timeout
3. **Identity:** Runtime verification, role validation
4. **Authorization:** RBAC with granular permissions
5. **Data:** Parameterized queries, FK constraints
6. **Audit:** Immutable logs with hash chaining

## Critical Security Controls (Verified in Code)

| Control | Location | Status |
|---------|----------|--------|
| Prepared statements | database.ts | ✅ All queries use ? placeholders |
| FK constraints | migrations/*.sql | ✅ All FKs validated |
| Authorization checks | council.ts | ✅ Per-operation validation |
| Input validation | server.ts Zod schemas | ✅ All inputs validated |
| Transaction boundaries | database.ts | ✅ Explicit transactions |
| Memory isolation | memory_access table | ✅ owner_type/owner_id checks |

## High-Risk Areas Requiring Phase 8 Attention

### 1. Founder Identity Verification (P0)
- **Location:** src/council.ts `isFounder()`
- **Issue:** Hardcoded string comparison
- **Risk:** Any session claiming `owner_id: 'founder'` gains full access
- **Mitigation:** Cryptographic signature verification

### 2. MCP Session Trust (P0)
- **Location:** src/server.ts MCP registration
- **Issue:** Client claims runtime identity
- **Risk:** Impersonation of claude/hermes
- **Mitigation:** Challenge-response authentication

### 3. Cross-Division Permission Escalation (P1)
- **Location:** searchMemoryEntries, getMemoryWithShare
- **Issue:** Complex permission logic prone to errors
- **Risk:** Access to memories outside division scope
- **Mitigation:** Centralized permission checks with audit

### 4. Execution Request Manipulation (P1)
- **Location:** requestExecution, approveExecution
- **Issue:** Status transitions not fully protected
- **Risk:** Skip approval by modifying status directly
- **Mitigation:** Add status transition guards

### 5. Audit Log Tampering (P2)
- **Location:** memory_access, execution_history
- **Issue:** No tamper detection
- **Risk:** Modify/delete audit records
- **Mitigation:** Hash chain + read-only tables

## API Security Surface

**Current endpoints exposed (via MCP):**
- All Phase 1-7 tools (50+ tools)
- Total functions in council.ts: ~300
- Database statements: ~100

**Attack surface:**
- Input validation (all through Zod)
- Authorization (per-function)
- Database queries (prepared statements)
- File operations (SQLite file)

## Recommendations for Phase 8

### Must Address (P0/P1):
1. Implement runtime authentication tokens
2. Add founder cryptographic identity
3. Centralized authorization with audit logging
4. Session timeout and invalidation

### Should Address (P2):
5. Enhanced input validation (size, content)
6. Rate limiting per session
7. Audit log immutability
8. Execution request status guards

### Nice to Have (P3):
9. Session activity metrics
10. Failed login tracking
11. Automated security alerts

## Dependencies

Phase 8 changes require:
- **crypto** module (Node.js built-in)
- **mcp** library (current, no changes needed)
- SQLite file (no schema changes for auth layer)
- **jsonwebtoken** optional (or implement minimal JWT)

No external services required. Local-first architecture preserved.