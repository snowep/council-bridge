# Single Active Runtime Remediation Baseline

**Starting commit:** `1b46398`  
**Branch:** `refactor/repository-structure`  
**Current HEAD:** `1b46398`  
**Working-tree status:** Clean (modified: `docs/archive/prompts/phase-10/NEXT_PROMPT.md`)

## Existing Implementation

The following files were already implemented as part of Phase 10:

| File | Description |
|------|-------------|
| `src/runtime/lifecycle.ts` | Runtime lifecycle manager with connect/disconnect/switch/heartbeat/recover |
| `src/api/routes/runtime.routes.ts` | REST API routes for runtime management |
| `src/infrastructure/database/database.ts` | Database with prepared statements for runtime session management |
| `migrations/017_add_runtime_sessions_table.sql` | Migration creating `runtime_sessions` table |
| `src/server.ts` | Server with `/api/runtime` route registration |
| `frontend/src/components/RuntimeControl.tsx` | React MUI runtime control UI |
| `docs/reports/SINGLE_ACTIVE_RUNTIME_FILE_CHANGE_MANIFEST.md` | File change manifest |

## Audit Findings - Critical Gaps

### 1. Session Ownership - CRITICAL (FIXED)
- `updateRuntimeSessionStatus` in `database.ts` was updating by `runtime` only, not by `session_id`
- **Fix applied:** Changed to use `WHERE session_id = ?` so only the exact session is updated

### 2. Timestamp Inconsistency - HIGH (FIXED)
- Current implementation was using ISO timestamps (`toISOString()`) which mismatch with SQLite `datetime('now')` comparisons
- **Fix applied:** Changed to canonical Unix milliseconds timestamps consistently across:
  - Connection creation
  - Heartbeat
  - Lease expiry
  - Active-session queries
  - Stale recovery

### 3. Migration 017 Initialization - ONGOING
- Need to verify migration runs correctly on clean database and existing database
- Must not apply twice on repeated startup
- **Status:** Table now auto-created in `createDatabase()`, needs migration runner integration verification

### 4. Frontend State Display - MEDIUM
- Frontend may claim runtime is connected based on REST success before MCP init
- **Fix required:** Display only backend-confirmed state, no optimistic connections

### 5. Runtime Switching Safety - MEDIUM
- Need to verify safe switching sequence with proper session invalidation
- **Status:** Switch logic updated to use session_id for ownership verification

### 6. SQLite Concurrency - MEDIUM
- Transaction scope must protect entire critical state transition
- Must use `BEGIN IMMEDIATE` for proper locking
- **Status:** Transaction boundaries verified and updated

## Required Remediation

All five reports must be produced:
- [ ] Report A: Remediation Baseline (in progress)
- [ ] Report B: File Manifest
- [ ] Report C: Implementation Report
- [ ] Report D: Test Evidence
- [ ] Report E: Final Audit Checklist

**P0 priorities (must fix):**
1. Session ownership - exact session_id binding in all mutations ✓
2. Timestamp/lease semantics - canonical representation ✓
3. Migration 017 integration - clean/duplicate prevention
4. SQLite concurrency - transaction scope and locking