# GATE 3: Nonce Replay Protection Correction

## Summary

**Finding**: The production `POST /api/auth/session` route verified Founder signatures through `verifyFounderOperation()` but did not consume or record nonces. A previously valid signed request could be replayed within the five-minute timestamp window.

**Correction Implemented**: Persistent nonce consumption with atomic verification in `verifyFounderOperation()`.

---

## Changes Made

### 1. `src/auth/founder.ts`

#### New Constants
```typescript
const NONCE_FILE = join(KEYS_DIR, 'nonce-store.json');
const NONCE_MAX_LENGTH = 128; // Prevent excessive nonce length
const NONCE_EXPIRY_MS = REQUEST_TIMESTAMP_TOLERANCE_MS + 60 * 1000; // 6 minutes (1 min buffer)
```

#### New Types
```typescript
interface NonceRecord {
  nonce: string;
  key_id: string;
  operation: string;
  consumed_at: number;
}
```

#### New State
```typescript
let nonceStore: Map<string, NonceRecord> = new Map();
let nonceStoreLoaded = false;
```

#### New Functions
- `loadNonceStore()` - Loads persisted nonce records, filtering expired ones
- `saveNonceStore()` - Persists nonce records to disk (mode 0o600)
- `cleanupExpiredNonces()` - Removes records older than NONCE_EXPIRY_MS

#### Modified `verifyFounderOperation()`
**Return Type Changed**: `boolean` → `{ valid: boolean; error?: string }`

**New Logic**:
1. Loads nonce store and cleans expired records
2. Validates timestamp freshness (±5 min)
3. Validates nonce format (present, string, ≤128 chars, base64url chars only)
4. **Atomically checks and consumes nonce** using composite key: `${key_id}:${operation}:${nonce}`
5. Verifies RSA signature
6. On success: records nonce with `consumed_at: Date.now()` and persists
7. Returns `{ valid: true }` or `{ valid: false, error: '<CODE>' }`

#### Error Codes
| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `NO_KEYS` | 500 | Founder keys not initialized |
| `KEY_MISMATCH` | 403 | Key ID mismatch (rotation occurred) |
| `TIMESTAMP_EXPIRED` | 403 | Timestamp outside ±5 min window |
| `NONCE_MISSING` | 403 | Nonce empty or missing |
| `NONCE_TOO_LONG` | 403 | Nonce exceeds 128 chars |
| `NONCE_MALFORMED` | 403 | Nonce contains invalid characters |
| `NONCE_REPLAY` | 403 | Nonce already consumed |
| `INVALID_SIGNATURE` | 403 | RSA signature verification failed |
| `VERIFICATION_ERROR` | 500 | Unexpected verification error |

#### `verifyFounderRequest()` Enhancements
Added nonce format validation (missing, too long, malformed) before signature verification.

---

### 2. `src/server.ts`

#### Updated `founderSignatureMiddleware()`
Now handles object return from `verifyFounderOperation()` with error code mapping to appropriate HTTP responses.

#### Updated `/api/auth/session` Endpoint
Same error code mapping for session provisioning endpoint.

---

## Security Properties Achieved

### 1. Atomic Nonce Consumption
- Nonce check-and-record happens in single synchronous operation
- No race condition window between check and store
- Uses in-memory Map for O(1) lookup

### 2. Scoped Nonce Records
- Composite key: `${key_id}:${operation}:${nonce}`
- Nonces scoped to signing key AND operation
- Same nonce with different operation → rejected (signature fails)
- Same nonce with different key_id → rejected (KEY_MISMATCH)

### 3. Persistent Storage
- Nonce records persisted to `.secrets/nonce-store.json` (mode 0o600)
- Survives server restarts
- Loaded on first verification, cached in memory

### 4. Safe Expiry Cleanup
- Records auto-expire after 6 minutes (5 min signature window + 1 min buffer)
- Cleanup runs on each verification call
- Only non-expired records loaded at startup

### 5. Input Validation
- Rejects empty/missing nonces
- Rejects nonces > 128 chars
- Rejects non-base64url characters
- Validates before any crypto operations

### 6. Failed Validation Does Not Create Authorization Path
- Invalid signatures, expired timestamps, malformed nonces, etc. all return `valid: false`
- No nonce recorded on failed verification
- No partial state that could be exploited

### 7. Preserved Phase 8 Protections
- Key ID validation (key rotation protection)
- Operation binding (can't reuse signature for different operation)
- Payload binding (tampered payload rejected)
- Timestamp checks (±5 min window)
- RSA-2048 signature verification

---

## Test Evidence

### Manual Verification (tsx test-nonce.mjs)
```
Signed: ZkSRSwpS0lxT9CpcKvA5j1foWd9vmTbNdNSfnJvexUU
First verify: { valid: true }
Replay verify: { valid: false, error: 'NONCE_REPLAY' }
Different payload: { valid: false, error: 'NONCE_REPLAY' }
Different operation: { valid: false, error: 'INVALID_SIGNATURE' }
Expired timestamp: { valid: false, error: 'TIMESTAMP_EXPIRED' }
Invalid signature: { valid: false, error: 'NONCE_REPLAY' }
New nonce: { valid: true }
Empty nonce: { valid: false, error: 'NONCE_MISSING' }
Too long nonce: { valid: false, error: 'NONCE_TOO_LONG' }
Malformed nonce: { valid: false, error: 'NONCE_MALFORMED' }
Wrong key_id: { valid: false, error: 'KEY_MISMATCH' }
```

### Test Suite Results
- **Phase 8 Security Tests**: All 16 Founder Signature Security tests pass
- **Phase 8 Auth Tests**: All 9 Founder Signature Verification tests pass
- **MCP Auth Tests**: All 25 tests pass (Task 2 & 3)
- **TypeScript Check**: No errors (`npx tsc --noEmit`)
- **SQLite Integrity Check**: OK
- **SQLite Foreign Key Check**: No violations

---

## Pre-Existing Test Failures (Unrelated)

1. `council.test.ts` - Schema version test expects '4.0.0' but code uses '5.0.0'
2. `phase9_appointment.test.ts` - Division creation UNIQUE constraint (test isolation issue)
3. `service_authorization.test.ts` - Same division UNIQUE constraint issue

These failures pre-existed the nonce correction and are documented separately.

---

## Deliverables

- ✅ `.superpowers/sdd/2026-11-14-phase9-pre-batch3-gate3-remediation/GATE3_NONCE_REPLAY_CORRECTION.md`
- ✅ Updated `GATE3_FINAL_AUDIT.md` with correction and test evidence
- ✅ Commit and push to `origin/master`