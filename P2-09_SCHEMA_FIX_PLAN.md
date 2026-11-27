# P2-09: Runtime Schema, Migration Files, and Migration Runner Consistency Fix Plan

## Issues Identified

### A. Stale Manifest
- **Problem**: MIGRATION_MANIFEST.md only lists migrations 001-005 and 013-016, omits 006, 017-021
- **Fix**: Update manifest to document all 21 migrations

### B. Two Schema Initialization Paths
- **Problem**: 
  - Migration SQL files define schema
  - database.ts bootstrap defines schema again with `CREATE TABLE IF NOT EXISTS`
  - Some columns only exist in bootstrap (credential_id, generation in runtime_sessions)
  - Some tables only in migrations (runtime_control, execution_records)
- **Fix**: Make migrations and bootstrap consistent; bootstrap should only create tables if migrations haven't run

### C. Migration 020 Can Encounter Existing Column
- **Problem**: `ALTER TABLE runtime_sessions ADD COLUMN generation INTEGER DEFAULT 0` fails if column exists
- **Fix**: Add column existence check before ALTER TABLE

### D. credential_id Lacks Equivalent Migration
- **Problem**: bootstrap adds credential_id via ALTER TABLE but no migration file does this
- **Fix**: Add migration 022 for credential_id column

### E. Two Runtime-Control Designs (RESOLVED)
- **Problem**: runtime_control table existed but was never used; runtime_sessions was already authoritative
- **Fix**: Removed unused runtime_control code (P2-07) - runtime_sessions with partial unique index is the authoritative source

### F. Hard-coded Migration Database Path
- **Problem**: cli.ts uses hardcoded `'data/council.db'` instead of `DATABASE_PATH` env var
- **Fix**: Use configurable path from environment

## Implementation Plan

### 1. Update MIGRATION_MANIFEST.md
- Add all 21 existing migrations (001-021)
- Document execution order and dependencies

### 2. Fix Migration Files for Idempotency
- 017: Add `IF NOT EXISTS` to CREATE TABLE
- 018: Add `IF NOT EXISTS` to CREATE TABLE
- 019: Add `IF NOT EXISTS` to CREATE TABLE
- 020: Check column existence before ALTER TABLE
- 021: Add `IF NOT EXISTS` to CREATE TABLE/VIEW

### 3. Add New Migration 022: credential_id Column
- Add `credential_id TEXT` column to runtime_sessions with existence check

### 4. Make runtime_control Authoritative
- Update lifecycle.ts connect/disconnect/switch/heartbeat to use runtime_control
- Update mcpRuntimeAuthMiddleware to use runtime_control

### 5. Fix Migration Runner Database Path
- Use DATABASE_PATH environment variable with fallback

### 6. Align database.ts with Migrations
- Remove duplicate table creation that migrations handle
- Keep only fallback CREATE TABLE IF NOT EXISTS for tables without migrations
- Ensure bootstrap columns match migration columns