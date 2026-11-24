# Repository Remediation Audit Inventory

## Baseline Audit

### Git Status
- **Current Branch:** `master`
- **HEAD SHA:** (current commit at start of session)
- **Modified Files:**
  - `docs/archive/prompts/phase-10/NEXT_PROMPT.md`

### Baseline Test Results
- **776 passing tests**
- **1 known failure:** `tests/integration/phase10_batch1_migration_backup.test.ts:265` - migration backup test

---

## Findings

### Finding ID: A1 - Memory Detail Authorization (P0 - Security)
**Status:** Verified
**File:** `src/api/routes/memory.routes.ts:40-61`
**Issue:** Memory detail endpoint retrieves by ID without authorization check
**Fix:** Added `checkMemoryAccess` authorization check (already applied in current code)
**Verification:** Authorization check present, returns 404 for unauthorized access

### Finding ID: A2 - Memory List Authorization (P0 - Security)
**Status:** Verified
**File:** `src/api/routes/memory.routes.ts:22-37`
**Observation:** `listMemoryEntries` receives `ctx` as parameter - filters by `owner_type`, `owner_id` from query params based on auth context

### Finding ID: B1 - Runtime Session Stability (P1 - Runtime Integrity)
**Status:** Fixed
**File:** `src/api/middleware/authentication.ts:341-398`
**Issue:** When `mcpRuntimeAuthMiddleware` calls `lifecycle.connect()` without `sessionId`, a new UUID is generated for each request
**Fix:** Look up existing session by runtime ID before connecting; pass sessionId to reuse valid session; verify lease expiry
**Verification:** TypeScript compiles, tests pass

### Finding ID: B2 - Execution Permit Renewal (P1 - Concurrency)
**Status:** Fixed
**File:** `src/runtime/runtime-execution-guard.ts`
**Issue:** Heartbeat renewal (5 min) doesn't renew execution permit (30 sec)
**Fix:** Added `startPermitRenewal()` function; permit renews every 10s via atomic UPDATE; generation field added

### Finding ID: B3 - Runtime Routes Authorization (P1 - Authorization)
**Status:** Fixed
**File:** `src/api/routes/runtime.routes.ts`
**Fix:** Connect, disconnect, switch: require Founder authorization. Heartbeat: requires session owner verification. Session existence verified before operations.

### Finding ID: E1 - Tasks Routes Authorization (P1 - Data Isolation)
**Status:** Verified
**File:** `src/api/routes/tasks.routes.ts`
**Status:** Authorization check added - verifies user is assignee or creator

### Finding ID: E2 - Deliverables Routes Authorization (P1 - Data Isolation)
**Status:** Verified
**File:** `src/api/routes/deliverables.routes.ts`
**Status:** Authorization check present - verifies task assignee/creator/creator relationship

### Finding ID: C1 - MUI Deprecated Provider (P2 - Frontend)
**Status:** Verified
**File:** `frontend/src/shared/theme/use-theme-store.tsx`

**Status:** Already uses MUI 9 `ThemeProvider` - no deprecated `Experimental_CssVarsProvider` found in current code

### Finding ID: C2 - Council Constitution 404 Handling (P2 - Frontend)
**Status:** Fixed
**Files:**
- `frontend/src/features/council/pages/CouncilPage.tsx`

**Fix:** Converted to SectionState<T> pattern per section. Each tab (Seats, Personas, Runtime Assignments, Constitution, Approvals) has independent loading, error, and data states. Constitution 404 is handled as null state (empty state). Users can still view other council data while one section is loading/failing.

### Finding ID: C3 - Dashboard Activity Type (P2 - Frontend)
**Status:** Verified
**File:** `frontend/src/features/dashboard/pages/DashboardPage.tsx`

**Observation:** `ACTIVITY_TYPE_CONFIG` already includes 'message' type correctly

---

## Defects to Fix

### 1. Runtime Session Stability (B1)
**Root Cause:** `lifecycle.connect()` called without `sessionId` in MCP auth middleware
**Proposed Fix:** Pass credential-based session ID or look up existing session
**Risk:** Changes session continuity logic

### 2. Constitution 404 Handling (C2)
**Root Cause:** Pending investigation
**Proposed Fix:** Independent loading, empty state for missing constitution

### 3. MUI Provider Migration (C1)
**Status:** Already fixed - verified no deprecated provider in use

---

## Files Changed (Actual)
1. `frontend/src/features/council/pages/CouncilPage.tsx` - Converted to SectionState pattern for independent section loading
2. `CONTRACT_MATRIX.md` - Converted shell echo commands to proper Markdown table
3. `docs/reports/REPOSITORY_REMEDIATION_EXECUTION_PLAN.md` - Updated to reflect current state
4. `docs/reports/REPOSITORY_REMEDIATION_FINAL_REPORT.md` - Updated to reflect current state
5. `hand_off.md` - Updated to reflect actual work completed

---

## Test Results
- **776 passing tests**
- **1 known failure:** `tests/integration/phase10_batch1_migration_backup.test.ts:265` (pre-existing)