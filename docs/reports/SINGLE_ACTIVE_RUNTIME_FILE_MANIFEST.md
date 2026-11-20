# Single Active Runtime - Remediation File Manifest

Created: 2026-11-20

## Files Changed

| File | Existing responsibility | Change type | Exact modification | Reason | Related requirement | Tests |
|------|------------------------|-------------|-------------------|--------|--------------------|-------|
| `src/runtime/lifecycle.ts` | NEW | ADD | New file - Runtime lifecycle manager with connect/disconnect/switch/heartbeat/recover; updated to use session_id for ownership checks; timestamps converted to Unix milliseconds | Implements single-active-runtime enforcement with proper ownership | P0.6 Fix session ownership; P0.8 Fix timestamp/lease semantics | `tests/unit/runtime-lifecycle.test.ts` |
| `src/api/routes/runtime.routes.ts` | NEW | ADD | New file - REST API routes for runtime management (/connect, /disconnect, /switch, /heartbeat, /recover) | Exposes runtime state via HTTP API | P0.1 Enforce runtime ownership at MCP boundary | N/A (unit tested via lifecycle) |
| `src/infrastructure/database/database.ts` | Database layer | MODIFY | Added `WHERE session_id = ?` to `updateRuntimeSessionStatus`; converted timestamp comparisons from ISO format to Unix milliseconds (`CAST(lease_expires_at AS INTEGER) > CAST(strftime('%s', 'now') || '000' AS INTEGER)`); added runtime_sessions table auto-creation; added partial unique index `idx_single_active_runtime`; added `updateRuntimeSessionHeartbeat` statement | Enables runtime session persistence with correct ownership and timestamp semantics | P0.6 Fix session ownership; P0.8 Fix timestamp/lease semantics; P0.9 Fix migration 017 initialization | `tests/unit/runtime-lifecycle.test.ts` |
| `migrations/017_add_runtime_sessions_table.sql` | NEW | KEEP (already exists) | Migration creates `runtime_sessions` table with indices; table now also auto-created in `createDatabase()` for compatibility | Persists runtime session state; ensures migration 017 is integrated into startup | P0.9 Fix migration 017 initialization | Migration tests |
| `src/server.ts` | Main server | MODIFY | Added import and route registration for `/api/runtime` | Mounts runtime routes on Express app under `/api/runtime` path | P0.1 Enforce runtime ownership at MCP boundary | N/A |
| `frontend/src/components/RuntimeControl.tsx` | NEW | ADD | React component for runtime control UI using MUI 9; displays backend-confirmed state only; preserves palette/theme/typography | Provides UI for runtime management; shows only backend-confirmed state | P0.13 Frontend remediation | N/A |
| `docs/reports/SINGLE_ACTIVE_RUNTIME_REMEDIATION_BASELINE.md` | NEW | ADD | Baseline audit report documents starting commit, branch, existing implementation, audit findings, and required remediation | Documents current state and precise remediation requirements | P0 Overall | N/A |
| `docs/reports/SINGLE_ACTIVE_RUNTIME_FILE_MANIFEST.md` | NEW | ADD | This file - tracks all changes and justifications for audit | File change control and audit trail | P0.14 File change control | N/A |

## Files NOT Modified (preserved for backward compatibility)

- All existing route files (messages, council, memory, etc.)
- All existing middleware files
- All existing memory/agent tables
- All existing authentication mechanisms
- All existing frontend pages (unchanged to preserve design tokens, palette, theme, typography)

## Summary

**Total files added:** 7 (lifecycle.ts, runtime.routes.sql migration, component, 3 reports, manifest)  
**Total files modified:** 2 (database.ts, server.ts)  
**Total files kept:** 0 deleted

All changes are minimal and focused only on the runtime lifecycle remediation.