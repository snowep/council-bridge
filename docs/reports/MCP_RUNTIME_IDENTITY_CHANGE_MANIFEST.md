# MCP Runtime Identity Change Manifest

## Added Files

| File | Reason |
|------|--------|
| `docs/reports/MCP_RUNTIME_IDENTITY_REMEDIATION_REPORT.md` | P2: Required remediation report |
| `docs/reports/MCP_RUNTIME_IDENTITY_CHANGE_MANIFEST.md` | P2: This change manifest |
| `tests/integration/mcp-execution-guard.test.ts` | P1: HTTP-level integration tests for execution guard at MCP boundary |

## Modified Files

| File | Reason |
|------|--------|
| `src/api/middleware/authentication.ts` | P0: Fix runtime identity inference bug - runtime should not be derived from active session |
| `tests/integration/mcp-bootstrap-integration.test.ts` | P1: Fix test database isolation - use crypto-random names and proper cleanup |

## Deleted Files

None

## Detailed Changes

### src/api/middleware/authentication.ts

**Change**: Fixed runtime identity derivation in local single-user mode bootstrap

**Before**:
```ts
// Get the active session to determine what runtime to target
const activeSession = db.stmt.getActiveRuntimeSession.get() as {...} | undefined;

const authContext = {
  owner_type: 'founder',
  owner_id: 'founder',
  runtime: activeSession?.runtime || 'claude',  // BUG: inferred from active session
  session_id: 'local-founder',
  ...
};
```

**After**:
```ts
// In local single-user mode, always bootstrap as local-founder with explicit runtime identity.
// SECURITY: Runtime identity is NEVER inferred from the active session - it's always 'claude'
// for local development/bootstrap. The execution guard handles handoff to establish ownership.
const authContext = {
  owner_type: 'founder',
  owner_id: 'founder',
  runtime: 'claude',  // FIXED: explicitly set, never inferred
  session_id: 'local-founder',
  ...
};
```

**Rationale**: P0 audit finding required that runtime identity NOT be inferred from the active session. The runtime making the request must be identified independently. In local single-user mode, Claude is the default/primary development runtime.

### tests/integration/mcp-bootstrap-integration.test.ts

**Change 1**: Added crypto-random database names

**Before**:
```ts
import * as path from 'path';

const dbPath = path.join(TEST_DB_DIR, `mcp-bootstrap-${Date.now()}.db`);
```

**After**:
```ts
import * as path from 'path';
import { randomUUID } from 'node:crypto';

const dbPath = path.join(TEST_DB_DIR, `mcp-bootstrap-${Date.now()}-${randomUUID().slice(0, 8)}.db`);
```

**Rationale**: P1 audit finding required cryptographically unique database filenames, not just Date.now().

**Change 2**: Fixed cleanup to only delete specific test files

**Before**:
```ts
afterEach(async () => {
  if (db) {
    try { db.db.pragma('wal_checkpoint(TRUNCATE)'); } catch {}
    db.close();
  }
  resetRuntimeLifecycleManager();
  delete process.env.LOCAL_SINGLE_USER_MODE;
  delete process.env.AUTH_MODE;

  if (fs.existsSync(TEST_DB_DIR)) {
    try { fs.rmSync(TEST_DB_DIR, { recursive: true, force: true }); } catch {}
  }
});
```

**After**:
```ts
afterEach(async () => {
  if (db) {
    try { db.db.pragma('wal_checkpoint(TRUNCATE)'); } catch {}
    db.close();
  }
  resetRuntimeLifecycleManager();
  delete process.env.LOCAL_SINGLE_USER_MODE;
  delete process.env.AUTH_MODE;

  // Only delete this test's specific database files, not entire directory
  if (currentTestDbPath && fs.existsSync(currentTestDbPath)) {
    try { fs.unlinkSync(currentTestDbPath); } catch {}
    try { fs.unlinkSync(currentTestDbPath + '-wal'); } catch {}
    try { fs.unlinkSync(currentTestDbPath + '-shm'); } catch {}
  }
});
```

**Rationale**: P1 audit finding required that cleanup only affect its own files, preventing race conditions with concurrent tests.

## Pre-existing Changes (Preserved)

These changes existed before this remediation and are preserved:

| File | Change |
|------|--------|
| `src/auth/session.ts` | Added database session store support |
| `frontend/src/app/auth-context.tsx` | Frontend auth context changes |
| Other frontend files | UI/UX changes |

## Git Status Summary

```
Current branch: refactor/repository-structure
Starting HEAD: 20e7418
Current HEAD: 20e7418

Added files (new):
 tests/integration/mcp-execution-guard.test.ts (P1: new HTTP integration tests)

Modified files (this remediation):
 src/api/middleware/authentication.ts
 tests/integration/mcp-bootstrap-integration.test.ts

Pre-existing modified files (preserved):
 README.md
 docs/archive/prompts/phase-10/NEXT_PROMPT.md
 frontend/src/app/auth-context.tsx
 frontend/src/features/chat/pages/ChatPage.tsx
 frontend/src/features/dashboard/pages/DashboardPage.tsx
 frontend/src/features/tasks/pages/TasksPage.tsx
 frontend/src/shared/api/client.ts
 frontend/src/shared/types/api.ts
 src/auth/session.ts

Untacked files:
 docs/reports/MCP_CLIENT_CONFIG.md
 src/api/middleware/index.ts

Deleted files:
 .claude/scheduled_tasks.lock
```

## Confirmation: No Commits Made

No `git commit` or `git push` operations were performed during this remediation.

## Confirmation: No User Changes Lost

All pre-existing user modifications have been preserved. The audit requirement to not overwrite user changes was followed.