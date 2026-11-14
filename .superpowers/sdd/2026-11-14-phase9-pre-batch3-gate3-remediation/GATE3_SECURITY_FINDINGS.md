# GATE 3 Security Findings Report

**Date:** 2026-11-14
**Repository:** council-bridge
**Branch:** master
**Commit:** 5425ef3 (pre-remediation)

## Summary

Two critical security findings from the independent audit of commit 5425ef3 have been addressed.

---

## Finding 1: Missing Phase 1 MCP Communication Tools

**Severity:** HIGH
**Status:** RESOLVED

### Issue
The MCP tool registration in `src/mcp/tools.ts` only registered 3 of the 6 original Phase 1 communication tools:
- Present: `send_message`, `get_messages`, `list_agents`
- Missing: `register_agent`, `check_inbox`, `reply_message`, `list_messages`

### Root Cause
During Phase 9 Task 3 implementation, the Phase 1 tool set was incomplete. The original Phase 1 interface specification required all six tools but only three were implemented.

### Resolution
Added the four missing tool registrations with proper Zod v4 schemas and authorization checks:
- `register_agent` - Founder-only agent registration
- `check_inbox` - Agent inbox access (own inbox only, unless Founder)
- `reply_message` - Reply to message (intended recipient only)
- `list_messages` - List messages with limits (own messages only, unless Founder)

### Files Modified
- `src/mcp/tools.ts` - Added 4 tool schemas and registrations
- `tests/mcp-tools.test.ts` - Added comprehensive test coverage for all 6 tools

### Verification
All 6 Phase 1 tools now appear in `tools/list`:
1. `register_agent` ✓
2. `list_agents` ✓
3. `send_message` ✓
4. `check_inbox` ✓
5. `reply_message` ✓
6. `list_messages` ✓

Plus 13 Phase 7/9 tools = 19 total tools registered.

**Test Evidence:** `npm test -- tests/mcp-tools.test.ts` - All 27 MCP tool tests pass.

---

## Finding 2: Insecure Production Session Issuance

**Severity:** CRITICAL
**Status:** RESOLVED

### Issue
`POST /api/auth/session` endpoint accepted caller-supplied `owner_type`, `owner_id`, and `runtime` without authentication or authorization in production mode. An unauthenticated caller could request sessions for arbitrary staff, division, or seat identities.

### Root Cause
The session provisioning endpoint only blocked Founder sessions in production but allowed any caller to create sessions for any staff/division/seat identity without verification.

### Resolution
Secured the endpoint with Founder signature verification for ALL session provisioning in production mode:

1. **Production Mode:** Requires valid Founder signature with:
   - Operation binding: `create_session`
   - Payload: `owner_type`, `owner_id`, `runtime`
   - Timestamp, nonce, key_id for replay protection
   
2. **Identity Validation:** Before token issuance, validates requested identity against database:
   - Staff: Must exist, be active, and have runtime registered
   - Division: Must exist
   - Seat: Must exist and be active
   - Founder: Must be `founder` identity

3. **Development Mode:** Allows without signature but still validates identity exists

### Files Modified
- `src/server.ts` - Secured `/api/auth/session` endpoint with Founder signature verification and identity validation
- `src/auth/config.ts` - Added `create_session` to `require_founder_signature_for` array

### Verification
- Production session creation without Founder signature → 403 FORBIDDEN
- Invalid/expired/replayed signatures → 403 FORBIDDEN
- Non-existent/inactive identities → 403 FORBIDDEN
- Valid Founder-signed provisioning → 200 OK with session token
- Dev mode behavior preserved (identity validation only)

**Test Evidence:** Phase 8 auth tests pass (26/26). TypeScript compiles clean.

---

## Test Results Summary

| Test Suite | Status |
|------------|--------|
| MCP Tool Registration - Phase 9 Task 3 | ✅ 27/27 PASS |
| Phase 8: Session Token Authentication | ✅ 9/9 PASS |
| Phase 8: Founder Signature Verification | ✅ 9/9 PASS |
| Phase 8: Auth Context and Permissions | ✅ 6/6 PASS |
| Phase 8: Auth Middleware Integration | ✅ 2/2 PASS |
| Phase 8: Session Security Hardening | ✅ 10/10 PASS |
| Phase 8: Founder Signature Security | ✅ 14/14 PASS |
| Phase 8: Auth Mode Configuration | ✅ 4/4 PASS |
| Phase 8: Auth Middleware Integration - Production | ✅ 3/3 PASS |
| TypeScript Typecheck | ✅ PASS |

---

## Pre-existing Failures (Not Related to Gate 3)

The following test failures existed prior to this remediation and are unrelated to the two findings:

1. **Council Database Schema** - `should have schema_version table with version` - Pre-existing
2. **Phase 9 Batch 1: Appointment Ceremony** - 19 tests failing - Pre-existing (Batch 1 not yet implemented)
3. **Service Authorization** - 3 tests failing due to `UNIQUE constraint failed: divisions.name` - Pre-existing test isolation issue

These are documented separately and do not block Gate 3 closure.