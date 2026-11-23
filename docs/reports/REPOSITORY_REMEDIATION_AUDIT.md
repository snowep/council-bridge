# Repository Remediation Audit Inventory

## Baseline Audit

### Git Status
- **Current Branch:** `refactor/repository-structure`
- **HEAD SHA:** `6639877` (descendant of `a041024`)
- **Modified Files:** 
  - `src/api/routes/deliverables.routes.ts`
  - `src/api/routes/memory.routes.ts`
  - `src/api/routes/tasks.routes.ts`
- **Untracked Files:**
  - `docs/reports/REPOSITORY_REMEDIATION_EXECUTION_PLAN.md`

### Baseline Test Results
- **776 passing tests**
- **1 known failure:** `tests/integration/phase10_batch1_migration_backup.test.ts:265` - migration backup test

---

## Findings

### Finding ID: A1 - Memory Detail Authorization (P0 - Security)
**Status:** Fixed
**File:** `src/api/routes/memory.routes.ts:40-61`
**Issue:** Memory detail endpoint retrieves by ID without authorization check
**Fix:** Added `checkMemoryAccess` authorization check (already applied in current code)
**Verification:** Authorization check present, returns 404 for unauthorized access

### Finding ID: A2 - Memory List Authorization (P0 - Security)
**Status:** Verified
**File:** `src/api/routes/memory.routes.ts:22-37`
**Issue:** Memory list endpoint - verify authorization filtering
**Observation:** `listMemoryEntries` receives `ctx` as parameter - need to verify filtering
**Status:** Requires verification - list endpoint filters by `owner_type`, `owner_id` from query params

### Finding ID: B1 - Runtime Session Stability (P1 - Runtime Integrity)
**Status:** Unverified
**Files:** 
- `src/api/middleware/authentication.ts:341-349`
- `src/runtime/lifecycle.ts:128-129`
- `src/runtime/runtime_types.ts`

**Issue:** When `mcpRuntimeAuthMiddleware` calls `lifecycle.connect()` without `sessionId`, a new UUID is generated for each request, breaking session continuity.

**Observation:** The code shows:
```typescript
// authentication.ts line ~346
const connResult = lifecycle.connect({
  runtime: runtimePrincipal.runtimeId,
  clientIp
});
```

No `sessionId` passed, so `lifecycle.connect()` generates random UUID each time.

**Verification needed:** Check if this causes session discontinuity in actual MCP requests.

### Finding ID: B2 - Execution Permit Renewal (P1 - Concurrency)
**Status:** Unverified
**File:** `src/runtime/runtime-execution-guard.ts`

**Issue:** Heartbeat renewal (5 min) doesn't renew execution permit (30 sec)

### Finding ID: B3 - Runtime Routes Authorization (P1 - Authorization)
**Status:** Pending
**File:** `src/api/routes/runtime.routes.ts`

**Issue:** Verify connect, disconnect, switch, heartbeat endpoints have proper authorization

### Finding ID: E1 - Tasks Routes Authorization (P1 - Data Isolation)
**Status:** In Progress / Partially Fixed
**File:** `src/api/routes/tasks.routes.ts`

**Issue:** Task detail endpoint needs authorization check for IDOR prevention
**Status:** Authorization check added - verifies user is assignee or creator

### Finding ID: E2 - Deliverables Routes Authorization (P1 - Data Isolation)
**Status:** In Progress
**File:** `src/api/routes/deliverables.routes.ts`

**Issue:** Deliverable detail endpoint needs authorization check for IDOR prevention
**Status:** Authorization check present - verifies task assignee/creator/creator relationship

### Finding ID: C1 - MUI Deprecated Provider (P2 - Frontend)
**Status:** Verified
**File:** `frontend/src/shared/theme/use-theme-store.tsx`

**Status:** Already uses MUI 9 `ThemeProvider` - no deprecated `Experimental_CssVarsProvider` found in current code

### Finding ID: C2 - Council Constitution 404 (P2 - Frontend)
**Status:** Pending Investigation
**Files:**
- `frontend/src/features/council/pages/CouncilPage.tsx`
- `src/api/routes/council.routes.ts`
- `src/council/divisions.ts`

**Issue:** 404 on constitution breaks entire page - needs independent section loading

### Finding ID: C3 - Browser Performance Warning (P2 - Frontend)
**Status:** Pending Investigation
**Message:** `'message' parser took 336ms`

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

## Files Changed (User's Work)
1. `src/api/routes/memory.routes.ts` - Added `checkMemoryAccess` authorization
2. `src/api/routes/deliverables.routes.ts` - Added authorization check, removed unused imports
3. `src/api/routes/tasks.routes.ts` - Added authorization check, removed unused imports, fixed TypeScript error