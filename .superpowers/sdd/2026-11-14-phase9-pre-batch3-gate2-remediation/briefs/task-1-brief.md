# Task 1 Brief: Persistent Database Configuration — Production Fail-Closed

## Task Context
Part of Phase 9 Pre-Batch 3 Gate 2 remediation. Resolves blocker #1: production must never silently default to in-memory database.

## Requirements (verbatim from spec)
- Production must never silently default to an in-memory database
- Require an explicit persistent `DATABASE_PATH` in production
- Use a documented persistent local database path in development
- Keep `:memory:` available only to isolated tests
- Validate the configured path before startup
- Ensure directory creation, database initialization, and migrations complete before accepting requests
- Add startup tests proving production fails closed when the database path is missing
- Verify restart persistence using actual database records
- Preserve all existing database data

## Files to Modify/Create
- Modify: `src/database.ts:211-242` (createDatabase function)
- Modify: `src/server.ts:70-73` (initDb function)
- Create: `tests/database-production-config.test.ts`
- Create: `tests/database-persistence.test.ts`

## Interfaces
- Consumes: `createDatabase(dbPath: string): DatabaseInstance`
- Produces: Validated `DatabaseInstance` with guaranteed persistent path (or test-only `:memory:`)

## Global Constraints (binding)
- Production MUST never silently default to `:memory:` database — explicit `DATABASE_PATH` required
- `:memory:` available ONLY to isolated tests
- Validate database path before startup; ensure directory creation, initialization, migrations complete before accepting requests
- Startup tests proving production fails closed when database path missing
- Verify restart persistence using actual database records

## Test Requirements (exact from plan)
1. **Production without DATABASE_PATH test**: Server exits(1) with clear error, not silently using `:memory:`
2. **Restart persistence test**: Data survives server restart with persistent database

## Implementation Approach
- In `createDatabase()`: Check `process.env.NODE_ENV === 'production'` and reject empty/memory paths
- In development: Default to `path.join(process.cwd(), 'data', 'council.db')`
- In `initDb()`: Handle validation errors, exit(1) in production
- Tests use `NODE_ENV=production` and verify exit code

## Report File
Write full report to `.superpowers/sdd/2026-11-14-phase9-pre-batch3-gate2-remediation/task-1-report.md`