# GATE 3 Session Security Report

**Date:** 2026-11-14
**Repository:** council-bridge
**Branch:** master

## Production Session Provisioning Security

### Threat Model Addressed

**Before Fix:** Unauthenticated callers could POST to `/api/auth/session` with arbitrary `owner_type`, `owner_id`, `runtime` and receive valid session tokens.

**After Fix:** Production mode requires cryptographically verified Founder signature bound to the complete provisioning operation.

### Security Controls Implemented

#### 1. Founder Signature Requirement (Production Only)
```
Required fields in request body:
- founder_signature: RSA-SHA256 signature
- founder_timestamp: Unix timestamp (5-min tolerance)
- founder_nonce: Base64url random (replay protection)
- founder_key_id: Key identifier (rotation support)
```

#### 2. Operation Binding
Signature covers canonicalized payload:
```json
{
  "op": "create_session",
  "payload": { "owner_type": "...", "owner_id": "...", "runtime": "..." },
  "ts": 1234567890,
  "nonce": "abc123",
  "kid": "key-id-123"
}
```

#### 3. Identity Validation Against Database
Before token issuance, validates requested identity:

| Owner Type | Validation |
|------------|------------|
| `founder` | `owner_id === 'founder'` |
| `staff` | Exists, `status === 'active'`, runtime in `runtime_instances` |
| `division` | Exists in divisions table |
| `seat` | Exists, `status === 'active'` |

#### 4. Replay Protection
- Timestamp validation (±5 minutes)
- Nonce tracking (stored in Founder key pair verification)
- Key ID validation (prevents rotation bypass)

#### 5. Fail-Closed Behavior
| Condition | Response |
|-----------|----------|
| Missing signature fields | 403 `FOUNDER_SIGNATURE_REQUIRED` |
| Invalid signature | 403 `FOUNDER_SIGNATURE_INVALID` |
| Expired timestamp | 403 `FOUNDER_SIGNATURE_INVALID` |
| Replayed nonce | 403 `FOUNDER_SIGNATURE_INVALID` |
| Wrong key_id | 403 `FOUNDER_SIGNATURE_INVALID` |
| Inactive staff | 403 `INVALID_IDENTITY` |
| Unregistered runtime | 403 `INVALID_IDENTITY` |
| Non-existent division | 403 `INVALID_IDENTITY` |
| Non-existent seat | 403 `INVALID_IDENTITY` |

### Development Mode Isolation
- No signature required in development
- Identity validation still performed
- Allows local testing without Founder keys

### Integration with Existing Phase 8 Architecture
- Uses existing `verifyFounderOperation()` from `auth/founder.ts`
- Uses existing `generateSessionToken()` from `auth/session.ts`
- Adds `create_session` to `require_founder_signature_for` config
- Preserves all existing Phase 8 auth tests (26/26 passing)

### Test Coverage

| Security Test | Status |
|---------------|--------|
| Unauthenticated production session rejected | ✅ (via endpoint) |
| Missing signature fields rejected | ✅ (403) |
| Invalid signature rejected | ✅ (403) |
| Expired timestamp rejected | ✅ (403) |
| Replayed nonce rejected | ✅ (403) |
| Wrong key_id rejected | ✅ (403) |
| Inactive staff rejected | ✅ (403) |
| Unregistered runtime rejected | ✅ (403) |
| Non-existent division rejected | ✅ (403) |
| Non-existent seat rejected | ✅ (403) |
| Valid Founder provisioning succeeds | ✅ (200) |
| Dev mode behavior preserved | ✅ (identity validation only) |
| Phase 8 auth tests still pass | ✅ (26/26) |

### Configuration
```typescript
// auth/config.ts
require_founder_signature_for: [
  'approve_execution',
  'approve_cross_division_access',
  'create_division',
  'update_division_head',
  'revoke_cross_division_access',
  'create_session'  // ← ADDED
]
```

### Files Modified
- `src/server.ts` - Secured `/api/auth/session` endpoint
- `src/auth/config.ts` - Added `create_session` to required signatures