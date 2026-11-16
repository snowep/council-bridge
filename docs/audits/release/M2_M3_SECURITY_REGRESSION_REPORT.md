# M2/M3 Security Regression Report

**Repository:** `snowep/council-bridge`
**Branch:** `refactor/repository-structure`
**Date:** 2026-11-16
**Commit:** Working tree (uncommitted changes)

---

## Summary

**NO SECURITY REGRESSIONS DETECTED** - All M1 security invariants preserved.

---

## Security Invariants Verified

| Invariant | M1 Status | M2/M3 Status | Verified By |
|-----------|-----------|--------------|-------------|
| Production auth fail-closed | ✅ | ✅ | SEC-04 tests |
| No hardcoded identity fallback | ✅ | ✅ | SEC-04 tests |
| No Founder private keys in browser | ✅ | ✅ | Code review |
| No secrets committed to Git | ✅ | ✅ | .gitignore |
| Local single-user mode loopback-only | ✅ | ✅ | SEC-04 tests |
| No spoofed forwarded IP trust | ✅ | ✅ | Auth middleware |
| No weakened permission checks | ✅ | ✅ | All auth tests |
| Founder final approval (HITL) | ✅ | ✅ | Phase 9 HITL tests |
| Division Head cannot bypass Founder | ✅ | ✅ | Cross-division tests |
| Session nonce replay protection | ✅ | ✅ | SEC-06 tests |
| Migration runner authoritative | ✅ | ✅ | Migration tests |
| Migration checksums intact | ✅ | ✅ | Migration tests |

---

## Test Results: Security Regression

### SEC-02: Founder Key Directory and File Permissions (9/9 PASS)
- Directory permissions 0o700
- File permissions 0o600
- Archive directory 0o700 on rotation
- No private key logging
- Missing directory handling

### SEC-04: Founder Key Startup Validation (9/9 PASS)
- Development mode without keys ✅
- Production mode without keys → FAIL ✅
- Production mode with valid keys ✅
- Local single-user mode in production → FAIL ✅
- Corrupted key file detection ✅
- Incomplete key structure detection ✅
- Specific error messages ✅
- No private key in validation errors ✅
- Keys loaded from file (not cached) ✅

### SEC-06: Founder Signature Ownership & Replay Protection (8/8 PASS)
- Owner type verification (founder/staff) ✅
- Runtime field captured correctly ✅
- Invalid runtime rejected ✅
- Invalid owner_type rejected ✅
- Concurrent nonce replay: exactly one succeeds ✅
- Different nonce allowed after consumption ✅
- NONCE_REPLAY error code returned ✅

### Phase 8 Auth Tests (26/26 PASS)
- Key generation/loading/signing/verification ✅
- Tampered signature rejection ✅
- Expired timestamp rejection ✅
- Wrong key_id rejection ✅
- Permission checks (staff/founder/division) ✅
- Session ownership validation ✅

---

## Code Review: New/Modified Security-Sensitive Code

### Activity Endpoint (`src/api/routes/activity.routes.ts`)
- ✅ Uses `authMiddleware` - requires authentication
- ✅ Uses `requireAuth()` - extracts validated context
- ✅ Founder sees all activity, others filtered by ownership
- ✅ No sensitive data exposed in metadata

### Chat API (`src/api/routes/messages.routes.ts`)
- ✅ Auth middleware on all routes
- ✅ `requireAuth()` for context extraction
- ✅ Conversation participation check before access
- ✅ Founder bypass for admin access
- ✅ `markAsRead` only for participant

### Message Service (`src/communication/messages.ts`)
- ✅ Agent existence validation on all methods
- ✅ Reply authorization: only recipient can reply
- ✅ Bidirectional query uses parameterized SQL
- ✅ No SQL injection vectors

### Dashboard Stats (`frontend/src/features/dashboard/pages/DashboardPage.tsx`)
- ✅ Section key mapping prevents injection
- ✅ Error boundaries per section
- ✅ No direct user input in API paths

---

## No New Attack Vectors Introduced

| Potential Vector | Analysis | Result |
|------------------|----------|--------|
| Activity endpoint data leak | Founder-only all access, ownership filtering | ✅ Safe |
| Chat conversation enumeration | Requires auth, participant check | ✅ Safe |
| Agent selection API | Uses existing `/api/staff`, `/api/divisions` | ✅ Safe |
| Polling intervals | No auth bypass, standard REST | ✅ Safe |
| Deliverable reviewer assignment | Existing endpoint, verified in Phase 9 | ✅ Safe |

---

## Test Isolation (SEC-06: Nonce Table)

- **Issue**: SEC-06 tests use shared in-memory DB with nonce table
- **Fix Applied**: `beforeEach` clears nonces via `cleanupFounderNonces.run()`
- **Verification**: All 3 security suites pass together (26/26)
- **Status**: ✅ RESOLVED

---

## Conclusion

**M2/M3 changes introduce ZERO security regressions.**

All M1 security invariants remain intact. New code follows existing security patterns:
- Authentication required on all new endpoints
- Authorization checks at service layer
- Input validation via Zod schemas
- No secrets in frontend code
- No changes to auth middleware or session handling

---

## Recommendation

Proceed with confidence. No security review blockers for M2/M3 acceptance.