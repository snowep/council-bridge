# Phase 8 Authentication Plan

## Current Authentication State

### What Exists

**Runtime Identity:**
```typescript
// src/council.ts - validateRuntimeIdentity
export function validateRuntimeIdentity(
  runtime: 'claude' | 'hermes',
  staffId: string
): boolean {
  const staff = dbInstance.stmt.getStaffAgentById.get(staffId) as StaffAgent | undefined;
  return staff !== undefined && 
         staff.runtime_instances?.includes(runtime) && 
         staff.status === 'active';
}
```

**Founder Identity:**
```typescript
// src/council.ts - isFounder
isFounder(ctx) {
  return ctx.owner_type === 'founder';
}
```

**Staff Identity:** Staff ID must exist in database and be active

### Authentication Gaps

| Gap | Location | Risk |
|-----|----------|------|
| No session tokens | MCP entry points | Session hijacking |
| Hardcoded founder | isFounder() | Identity spoofing |
| Self-declared runtime | MCP headers | Runtime impersonation |
| No session timeout | All handlers | Long-lived compromised sessions |
| No auth for read ops | Search, list functions | Unauthorized data access |

## Proposed Authentication Model

### Local-First Design

**Principle:** All authentication is local, no external services required.

**Components:**
1. **Session tokens** - Time-bound, cryptographically signed
2. **Founder key pair** - RSA keys for request signing
3. **Runtime nonce verification** - Challenge-response
4. **Session store** - In-memory, no persistent storage

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  MCP Client     │     │  Auth Module    │     │  Session Store│
│  (Claude/Hermes)│────▶│  (Node.js)      │◀───▶│  (In-memory)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │  Council Service│
                        │  (Trusted)      │
                        └─────────────────┘
```

### Session Token Design

**Format:** `session|<timestamp>|<random>|<signature>`

**Properties:**
- 32-byte random component
- 10-byte timestamp (Unix seconds)
- 64-byte HMAC-SHA256 signature
- Total: ~118 chars base64 encoded

**Generation:**
```typescript
import crypto from 'crypto';

export function generateSessionToken(): string {
  const timestamp = Math.floor(Date.now() / 1000).toString(16);
  const random = crypto.randomBytes(32).toString('base64url');
  const data = `session|${timestamp}|${random}`;
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('base64url');
  return `${data}|${signature}`;
}
```

**Validation:**
```typescript
export function validateSessionToken(token: string): AuthContext | null {
  const parts = token.split('|');
  if (parts.length !== 4) return null;
  
  const [_, timestampStr, random, signature] = parts;
  
  // Check expiration (30 minutes)
  const timestamp = parseInt(timestampStr, 16);
  if (Date.now() / 1000 - timestamp > SESSION_TIMEOUT) return null;
  
  // Verify signature
  const data = `session|${timestampStr}|${random}`;
  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('base64url');
    
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  
  return { token, timestamp, random };
}
```

### Founder Authentication

**Problem:** Any session can claim `owner_type: 'founder'`

**Solution:** Cryptographic request signing

**Workflow:**
1. Founder generates RSA key pair on first run
2. Private key stored securely (file with restricted permissions)
3. Each Founder request includes signature
4. Server verifies with stored public key

**Implementation:**
```typescript
// Generate key pair
export function generateFounderKeyPair(): {private: string, public: string} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  return {
    private: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    public: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

// Sign a request
export function signFounderRequest(data: any, privateKeyPem: string): string {
  const signer = crypto.createSign('SHA256');
  signer.update(JSON.stringify(data));
  signer.end();
  return signer.sign(privateKeyPem, 'base64');
}

// Verify signature
export function verifyFounderRequest(data: any, signature: string, publicKeyPem: string): boolean {
  const verifier = crypto.createVerify('SHA256');
  verifier.update(JSON.stringify(data));
  verifier.end();
  return verifier.verify(publicKeyPem, signature, 'base64');
}
```

**MCP Integration:**
```typescript
// In MCP tool handlers (server.ts)
export async function callTool(name: string, arguments: any, sessionToken?: string, founderSignature?: string): Promise<any> {
  // 1. Validate session token
  const authContext = validateSessionToken(sessionToken);
  if (!authContext) throw new Error('Invalid or expired session');
  
  // 2. Check founder operation
  if (name === 'approve_execution' || name === 'approve_cross_division_access') {
    if (!founderSignature || !verifyFounderRequest(arguments, founderSignature, FOUNDER_PUBLIC_KEY)) {
      throw new Error('Founder signature required');
    }
    arguments['founder_signed'] = true;
  }
  
  // 3. Call service with auth context
  return councilService.callTool(name, arguments, authContext);
}
```

### Runtime Verification

**Problem:** MCP claims runtime type but can be spoofed.

**Solution:** Nonce-based challenge-response.

**Flow:**
1. Client connects, server generates nonce
2. Client signs nonce with claimed runtime's perceived authenticity
3. Server verifies (or accepts as best-effort for local)

**Implementation:**
```typescript
// Runtime verification (simplified for local-first)
export function verifyRuntime(runtime: 'claude' | 'hermes', session: {token: string, random: string}): 'verified' | 'claude' | 'hermes' {
  // In local development, trust the runtime claim
  // In production, would verify agent signature
  return runtime;
}
```

## Session Lifecycle

### 1. Session Start

```
Client: CONNECT
Server: SEND_NONCE(nonce-123)
Client: PROVE_OWNERY(staff-id, signature)
Server: GENERATE_TOKEN(token)
Server: SEND_SESSION(token)
```

### 2. Authenticated Request

```
Client: REQUEST_TOOL(tool-name, args, token)
Server: VALIDATE_TOKEN(token)
Server: AUTHORIZE_ACCESS(tool-name, user-role)
Server: EXECUTE_TOOL(args, auth-context)
Server: LOG_AUDIT(...)
Server: RESPONSE(result)
```

### 3. Session End

```
Client: DISCONNECT
Server: INVALIDATE_SESSION(token)
Server: FREE_RESOURCES()
```

### 4. Timeout

```
After 30min idle: Session expires
New request: TOKEN_INVALID
Client: Reconnect required
```

## Implementation Plan

### Phase 1: Session Token Infrastructure

**Files to modify:**
- `src/auth/session.ts` (new module)
- `src/server.ts` (MCP middleware)
- `src/council.ts` (auth context passing)

**Steps:**
1. Create `src/auth/` directory
2. Implement session token generation/validation
3. Add session store (in-memory Map)
4. Create MCP middleware
5. Update all tool registrations to pass auth context

**Estimated effort:** 4-6 hours

### Phase 2: Founder Authentication

**Files to modify:**
- `src/auth/founder.ts` (new module)
- `src/server.ts` (signature verification)

**Steps:**
1. Implement key pair generation
2. Create signature verification functions
3. Add founder key persistence
4. Add signature requirement to sensitive tools
5. Create key management tools

**Estimated effort:** 3-4 hours

### Phase 3: Runtime Verification

**Files to modify:**
- `src/auth/runtime.ts` (new module)
- `src/server.ts` (runtime checking)

**Steps:**
1. Define runtime verification protocol
2. Implement challenge-response (optional for local)
3. Update runtime-dependent logic
4. Add runtime-specific audit fields

**Estimated effort:** 2-3 hours

## Backward Compatibility

### Existing Sessions

**Problem:** Current implementation has no authentication.

**Solution:** 
- Allow "legacy" sessions for transition period
- Gradually enforce new auth requirements
- Provide migration path for connected tools

**Implementation:**
```typescript
export function validateSessionToken(token: string, legacyMode: boolean = false): AuthContext | null {
  // Validate new format
  const result = validateNewFormat(token);
  if (result) return result;
  
  // Legacy fallback for transition
  if (legacyMode) {
    return { token, legacy: true, runtime: 'claude' };
  }
  
  return null;
}
```

### MCP Tool Signatures

**Problem:** Adding signatures to all MCP calls is a breaking change.

**Solution:**
- Make signature optional for transition
- Log warnings for unsigned founder operations
- Eventually enforce signature requirement

## Configuration

### Session Settings

```typescript
const SESSION_CONFIG = {
  timeout: 30 * 60 * 1000,    // 30 minutes
  maxSessions: 100,           // Max concurrent sessions
  idleTimeout: 5 * 60 * 1000, // 5 minutes idle
  cleanupInterval: 60 * 1000  // 1 minute
};
```

### Secret Management

```bash
# Generate session secret
openssl rand -hex 32 > .secrets/session-secret

# Generate founder keys (first run only)
node -e "require('./src/auth/founder').initializeKeys()"

# Set permissions
chmod 600 .secrets/*
```

## Security Considerations

### Session Secret

- Must be unique per installation
- Must be changed on key rotation
- Should be generated at installation
- Stored in `.secrets/session-secret`

### Founder Keys

- Private key must be protected (600 permissions)
- Public key can be shared
- Rotation requires manual intervention
- Backup recommended

### In-Memory Session Store

**Pros:**
- No persistence attack surface
- Simple implementation
- Automatic cleanup

**Cons:**
- Sessions lost on restart
- No multi-instance support
- Memory growth potential

## Testing Strategy

### Unit Tests

```typescript
// test/auth/session.test.ts
- test token generation
- test token validation
- test token expiration
- test invalid token rejection

// test/auth/founder.test.ts
- test key pair generation
- test request signing
- test signature verification
- test invalid signature rejection
```

### Integration Tests

```
- Test full session lifecycle
- Test founder operation flow
- Test concurrent sessions
- Test timeout behavior
```

### Security Tests

```
- Attempt token forgery
- Attempt founder spoofing
- Test race conditions
- Test memory exhaustion
```

## Rollback Plan

If authentication causes disruption:

1. **Immediate:** Enable legacy mode for all sessions
2. **Short-term:** Disable Founder signature requirements
3. **Long-term:** Fix issues and re-enable

**Rollback triggers:**
- >5% session rejection rate
- Founders unable to perform critical operations
- Performance degradation >2x

## Dependencies

- Node.js 18+ (built-in crypto module)
- No external npm packages required
- Compatible with existing TypeScript setup