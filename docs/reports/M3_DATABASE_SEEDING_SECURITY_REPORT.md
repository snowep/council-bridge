# M3-004 Database Seeding Security Report

## Executive Summary

Successfully implemented M3-004 database seeding security fixes including cross-process safe nonce storage, founder signature verification before database access, and path canonicalization with symlink resolution. All 634 tests pass including 33 M3-004 specific tests.

## Fixes Implemented

### 1. Cross-Process Safe Nonce Store (Atomic File Operations)

**Problem**: Original implementation used an in-memory `Set` for nonce tracking, which is insufficient because separate Node.js processes do not share memory.

**Solution**: Implemented atomic file-based nonce store with:
- **File locking via exclusive creation** (O_EXCL equivalent) using temp file + atomic rename pattern
- **Fail-closed corruption handling**: Any JSON parse error in nonce file rejects new nonces
- **Cross-process safety**: Each process reads from file, never relies on shared memory
- **6-minute nonce expiry** with deterministic cleanup every 5 minutes

**Files Modified**: `src/auth/founder.ts`
- `parseNonceRecords()` - reads and validates all nonce records, throws on corruption
- `writeNonceRecordsSync()` - atomic write via temp file + rename
- `checkAndConsumeNonceFile()` - validates inputs, parses file, checks duplicates, appends atomically

### 2. Separate Public Key Loading for Production Verification

**Problem**: `loadFounderKeyPair()` loads private key which is unnecessary and risky for pre-database verification.

**Solution**: Added `loadFounderPublicKey()` that reads only public key + key_id from key file:
```typescript
export function loadFounderPublicKey(): { public_key: string; key_id: string } | null
```

**Usage**: Bootstrap scripts now use `loadFounderPublicKey()` for signature verification without ever loading the private key into memory.

### 3. Fixed Bootstrap Ordering: Validate → Verify → Create

**Problem**: Original code could access database before signature verification.

**Solution**: Updated `scripts/bootstrap-database.ts` and `scripts/bootstrap-signed.ts` to enforce strict ordering:
1. **Validate database path** (`validateSeedDatabasePath`) - canonicalize, resolve symlinks, check traversal
2. **Verify founder signature** (`verifyFounderRequest` with public key only) - BEFORE any database access
3. **Consume nonce for replay protection** (`checkAndConsumeNonceFile`) - BEFORE database creation
4. **Create database** (`createDatabase`) - only after successful authorization
5. **Initialize council** - seed data after verification

### 4. Path Security: Canonicalization & Symlink Resolution

**Problem**: Path traversal attacks possible via `../../etc/passwd` style paths; symlinks could bypass restrictions.

**Solution**: Enhanced `src/security/database-seeding-guard.ts`:
- `resolveCanonicalPath()` - uses `realpathSync` for symlink resolution
- `normalizePathForComparison()` - Windows case-insensitive comparison with drive letter normalization
- `validateSeedDatabasePath()` - enforces environment-specific path allowlists

**Key Security Features**:
- Rejects `:memory:` in production
- Rejects relative paths in production
- Rejects path traversal attempts (`../`, `..\`)
- Requires explicit path allowlists per environment
- Production paths must be in `PROD_DATABASE_PATH` env var

### 5. Comprehensive Security Tests (33 Tests)

**Test Coverage** (`tests/security/M3-004-*.test.ts`):
| Category | Tests | Description |
|----------|-------|-------------|
| Valid external signature | 2 | Accepts valid signatures, verifies with public key only |
| Missing signature | 2 | Rejects empty/undefined signatures |
| Invalid signature | 2 | Rejects malformed, wrong key signatures |
| Invalid operation | 1 | Rejects operation binding violations |
| Invalid payload | 1 | Rejects tampered payloads |
| Expired timestamp | 1 | Rejects >5min old timestamps |
| Malformed timestamp | 1 | Rejects non-numeric timestamps |
| Missing public key | 1 | Fail-closed when keys unavailable |
| Invalid key ID | 1 | Rejects key rotation mismatches |
| Reused nonce | 1 | Rejects nonce replay via SQLite |
| Corrupt nonce file | 1 | Rejects when file has invalid JSON |
| Unreadable nonce file | 1 | Rejects on permission errors (Unix) |
| Unwritable nonce file | 1 | Rejects on write errors (Unix) |
| Valid signature creates DB | 1 | Only creates DB after authorization |
| Path security | 1 | Rejects path traversal attempts |
| Nonce format validation | 4 | Empty, invalid chars, long, valid base64url |
| Atomic operations | 3 | First consume succeeds, replay fails, concurrent safe |
| Persistence across restarts | 2 | Nonces persist in file, different nonces independent |
| SQLite sync | 2 | Consumes via SQLite, rejects replay in SQLite |
| Error handling | 1 | Handles missing directory gracefully |
| Restart replay protection | 2 | Rejects replay after simulated restart |
| Database recreation replay | 1 | Rejects replay across DB lifecycle |

### 6. Windows Case-Insensitive Path Comparison

**Implementation** in `normalizePathForComparison()`:
```typescript
function normalizePathForComparison(p: string): string {
  if (process.platform === 'win32') {
    return p.toLowerCase().replace(/\\/g, '/');
  }
  return p;
}
```

- Handles drive letters (`C:\` vs `c:\`)
- Normalizes backslashes to forward slashes
- Case-insensitive comparison on Windows

## Security Properties Verified

### Replay Protection
- ✅ 6-minute nonce expiry with 5-minute cleanup interval
- ✅ Cross-process nonce tracking via atomic file operations
- ✅ Fail-closed on file corruption
- ✅ Persistence across process restarts

### Signature Verification
- ✅ RSA-2048 with SHA-256
- ✅ Operation binding (canonicalization includes operation name)
- ✅ Timestamp validation (±5 minutes)
- ✅ Nonce format validation (base64url, ≤128 chars)
- ✅ Key rotation protection (key_id mismatch rejected)

### Path Security
- ✅ Symlink resolution via `realpathSync`
- ✅ Path traversal rejection (`../`, `..\`)
- ✅ Environment-specific allowlists
- ✅ Production requires explicit `PROD_DATABASE_PATH`
- ✅ Windows case-insensitive comparison

### Bootstrap Ordering
- ✅ Path validation before any I/O
- ✅ Signature verification before database creation
- ✅ Nonce consumption before database creation
- ✅ Development mode allows `:memory:` without signature
- ✅ Production mode rejects `:memory:` and requires signature

## Files Modified

| File | Changes |
|------|---------|
| `src/auth/founder.ts` | Added `loadFounderPublicKey()`, atomic nonce store, key caching |
| `scripts/bootstrap-database.ts` | Fixed ordering, uses public key only, pre-verification |
| `scripts/bootstrap-signed.ts` | Updated for public key verification |
| `src/security/database-seeding-guard.ts` | Added `normalizePathForComparison`, enhanced canonicalization |
| `tests/security/M3-004-founder-authorization.test.ts` | 18 tests for signature verification |
| `tests/security/M3-004-nonces.test.ts` | 15 tests for nonce store operations |

## Test Results

```
✔ M3-004: Founder Authorization Tests (18 tests)
✔ M3-004: File-Based Nonce Store Tests (15 tests)
✔ All 634 total tests pass
✔ TypeScript compilation successful
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Nonce file corruption | Fail-closed: rejects all operations on corrupt file |
| Symlink bypass | `realpathSync` resolves all symlinks before validation |
| Windows path confusion | Case-insensitive normalization + drive letter handling |
| Race conditions | Atomic temp file + rename pattern for nonce writes |
| Private key exposure | Public key only loaded for verification |

## Recommendations

1. **Monitor nonce file growth** - Consider implementing archival for long-running systems
2. **Add metrics** - Track signature verification success/failure rates
3. **Review key rotation** - Current 90-day default should be confirmed with security team
4. **Production hardening** - Ensure `PROD_DATABASE_PATH` is set via secure deployment pipeline

## Conclusion

M3-004 database seeding security is now production-hardened with:
- Cross-process safe nonce storage
- Pre-database signature verification
- Symlink-aware path canonicalization
- Comprehensive test coverage (33 security tests)
- All 634 tests passing