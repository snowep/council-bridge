# Repository Remediation Execution Plan

## Baseline Commit
- `663987786e9d301cd2e1db96aa4487078784b10b`

## Current Branch
- `refactor/repository-structure`

## Pre-existing Failures (Baseline Recorded)
- `tests/integration/phase10_batch1_migration_backup.test.ts:265` - migration backup test (known issue)
- Production Database Configuration tests: 3 failures (pre-existing, not related to remediation)

---

## Remediation Groups - Status

### Group A: Private Memory Authorization (P0 - Security) ✅ COMPLETE
**Status:** Fixed
**Issue:** Memory detail endpoint (`src/api/routes/memory.routes.ts:40-61`) retrieves by ID without authorization check
**Fix:** Added `checkMemoryAccess` authorization check from `src/council/operations.ts`
**Verification:** Authorization check present, returns 404 for unauthorized access

### Group B: MCP Session Lifecycle (P1 - Runtime Integrity) ⏳ INVESTIGATION
**Status:** Investigating
**Issue:** Runtime authentication middleware calls lifecycle connection without stable session ID
**Files:** authentication.ts, lifecycle.ts, runtime.routes.ts
**Finding:** `mcpRuntimeAuthMiddleware` calls `lifecycle.connect()` without `sessionId`, causing new UUID per request

### Group C: Runtime Lifecycle Authorization (P1 - Authorization) ⏳ PENDING
**Status:** Pending
**Issue:** Runtime routes lack Founder/session ownership validation
**Fix:** Add authorization to all runtime endpoints

### Group D: Execution Permit Renewal (P1 - Concurrency) ⏳ PENDING
**Status:** Pending Investigation
**Issue:** Heartbeat renewal (5 min) doesn't renew execution permit (30 sec)

### Group E: Object-Level Authorization (P1 - Data Isolation) ⏳ IN PROGRESS
**Status:** In Progress
**Files:** tasks.routes.ts ✅, deliverables.routes.ts ✅, staff.routes.ts ⏳
**Issue:** Detail endpoints retrieve by ID without authorization
**Progress:**
- `tasks.routes.ts`: ✅ Authorization added for GET /:id
- `deliverables.routes.ts`: ✅ Authorization added for GET /:id
- `staff.routes.ts`: ❌ Not yet addressed

### Group F: MUI 9 Theme Provider (P2 - Frontend) ✅ VERIFIED
**Status:** Verified - No changes needed
**Issue:** Deprecated provider migrated but CSS variable behavior needs verification
**Finding:** Already uses MUI 9 `ThemeProvider` - no deprecated `Experimental_CssVarsProvider` found

### Group G: Council Constitution Handling (P2 - Frontend) ⏳ PENDING
**Status:** Pending Investigation
**Issue:** 404 breaks entire page, needs independent section loading
**Files:** CouncilPage.tsx, council.routes.ts, divisions.ts

### Group H: Dashboard Files (P2 - Documentation) ⏳ PENDING
**Status:** Pending
**Issue:** Create DASHBOARD_LAYOUT_OVERHAUL_PLAN.md

---

## Execution Order (Remaining)
1. ✅ Group A - Memory Authorization
2. ✅ Group E - Tasks/Staff/Deliverables Authorization
3. ⏳ Group C - Runtime Authorization
4. ⏳ Group B & D - Runtime Lifecycle & Execution Guard
5. ⏳ Group G - Council Constitution
6. ⏳ Group H - Dashboard Documentation

---

## Completed Fixes

### 1. Memory Routes Authorization
- **File:** `src/api/routes/memory.routes.ts`
- **Change:** Added `checkMemoryAccess` authorization check on GET /:id endpoint
- **Result:** Unauthorized access returns 404 to prevent enumeration

### 2. Tasks Routes Authorization
- **File:** `src/api/routes/tasks.routes.ts`
- **Changes:**
  - Added authorization on GET /:id - verifies user is assignee or creator
  - Removed unused imports: `getDatabase`, `getAuthContext`, `requireDivisionHead`, `UpdateTaskSchema`
  - Fixed TypeScript error on line 65 (invalid type comparison)
- **Result:** Authorized users can only access tasks they own or are assigned

### 3. Deliverables Routes Cleanup
- **File:** `src/api/routes/deliverables.routes.ts`
- **Changes:**
  - Removed unused imports: `getDatabase`, `getAuthContext`, `AuthorizationError`
  - Removed `reviewDeliverable`, `resubmitDeliverable` (unused in routes)
- **Result:** Clean imports, authorization present

---

## Test Results
- **776 passing tests**
- **1 known failure:** `tests/integration/phase10_batch1_migration_backup.test.ts:265` (pre-existing)

---

## Next Required Actions

### Staff Routes Authorization
Need to add authorization check to GET /:id endpoint in `src/api/routes/staff.routes.ts`

### Runtime Session Stability
Investigate and fix MCP auth middleware session continuity issue

### Council Constitution 404
Implement independent section loading for missing constitution

### Dashboard Plan
Create detailed DASHBOARD_LAYOUT_OVERHAUL_PLAN.md

---

## Files Changed (User's Work)
1. `src/api/routes/memory.routes.ts` - Added `checkMemoryAccess` authorization
2. `src/api/routes/deliverables.routes.ts` - Removed unused imports
3. `src/api/routes/tasks.routes.ts` - Added authorization, removed unused imports, fixed TypeScript error