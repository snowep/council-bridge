# Single Active Runtime - File Change Manifest

Created: 2026-11-20
Purpose: Document every file change for Phase 10 implementation

## Files Changed

| File | Existing responsibility | Change type | Exact change | Reason | Tests |
|------|------------------------|-------------|--------------|--------|-------|
| `src/runtime/lifecycle.ts` | NEW | ADD | New file - Runtime lifecycle manager with connect/disconnect/switch | Implements single-active-runtime enforcement | `tests/unit/runtime-lifecycle.test.ts` |
| `src/api/routes/runtime.routes.ts` | NEW | ADD | New file - REST API routes for runtime management | Exposes runtime state via HTTP API | N/A (unit tested via lifecycle) |
| `src/infrastructure/database/database.ts` | Database layer | MODIFY | Added `upsertRuntimeSession`, `getRuntimeSessionByRuntime`, `getRuntimeSessionBySession`, `getActiveRuntimeSession`, `getConnectedRuntimeSession`, `getRuntimeSessionsExpiring`, `updateRuntimeSessionStatus`, `updateRuntimeSessionHeartbeat` prepared statements | Enables runtime session persistence | N/A |
| `src/infrastructure/database/database.ts` | Database layer | MODIFY | Bumped SCHEMA_VERSION from 16.0.0 to 17.0.0 | Tracks schema version for migrations | N/A |
| `src/server.ts` | Main server | MODIFY | Added import and route registration for `/api/runtime` | Mounts runtime routes on Express app | N/A |
| `migrations/017_add_runtime_sessions_table.sql` | NEW | ADD | New migration file creating `runtime_sessions` table with indices | Persists runtime session state | N/A |
| `frontend/src/components/RuntimeControl.tsx` | NEW | ADD | React component for runtime control UI | Provides UI for runtime management | N/A |
| `docs/reports/SINGLE_ACTIVE_RUNTIME_BASELINE_AUDIT.md` | NEW | ADD | Baseline audit report | Documents existing architecture and gaps | N/A |
| `docs/superpowers/specs/2026-11-20-single-active-runtime-design.md` | NEW | ADD | Design document | Documents architecture and approach | N/A |
| `docs/reports/SINGLE_ACTIVE_RUNTIME_FILE_CHANGE_MANIFEST.md` | NEW | ADD | This file | Tracks all changes for audit | N/A |
| `tests/unit/runtime-lifecycle.test.ts` | NEW | ADD | Unit tests for lifecycle manager | Verifies correctness of implementation | Runs via `npm test` |

## Files NOT Modified

The following files remain unchanged to preserve backward compatibility:
- All existing route files (messages, council, memory, etc.)
- All existing middleware files
- All existing memory/agent tables
- All existing authentication mechanisms
- All existing frontend pages

## Summary

**Total files added:** 6 (lifecycle.ts, runtime.routes.ts, migration, component, reports)
**Total files modified:** 2 (database.ts, server.ts)
**Total files deleted:** 0

All changes are minimal and focused only on the runtime lifecycle feature.