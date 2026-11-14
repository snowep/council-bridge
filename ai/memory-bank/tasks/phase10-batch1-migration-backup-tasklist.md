# Phase 10 Batch 1: Production Migration Runner & Backup/Restore - Development Tasks

## Specification Summary
**Original Requirements**: Implement production-safe database migration management (including Migration 013) and verified backup/restore infrastructure. Preserve all Phase 1-9 functionality.
**Technical Stack**: TypeScript, Node.js, better-sqlite3, WAL mode SQLite, existing migration-runner package
**Target Timeline**: Phase 10 Batch 1 completion before Founder review

## Current State Analysis (Pre-Implementation Findings)

### Database Status
- **Production database**: `data/council.db` (7.5MB with WAL/SHM)
- **Schema version**: 5.0.0 (per `SCHEMA_VERSION` constant)
- **Applied migrations**: 001-006 (tracked in `migration_ledger` table)
- **Migration 013**: **NOT applied** - deliverable_versions and quality_thresholds tables exist but not tracked in ledger
- **Quality thresholds**: 140+ rows exist (mostly test data), default-global has min_quality_score=80, requires_review=0 (NOT 70/1 as spec requires)
- **WAL mode**: Active (council.db-wal present, 2MB)

### Existing Infrastructure (Reuse These)
- **Migration Registry**: `src/migration-runner/registry.ts` - discovers, validates, orders migrations
- **Migration Ledger**: `src/migration-runner/ledger.ts` - tracks applied migrations with checksums
- **Migration Executor**: `src/migration-runner/executor.ts` - executes with backup, validation, rollback
- **Backup Manager**: `src/migration-runner/backup.ts` - binary/schema/full dump with verification
- **Validator**: `src/migration-runner/validator.ts` - pre/post migration checks, integrity, FK
- **CLI**: `src/migration-runner/cli.ts` - commands: status, run, rollback, validate, backup, restore, verify-ledger

### Gaps to Address
1. Migration 013 not in ledger - needs explicit application and verification
2. Quality threshold default is (80, 0) not (70, 1) per spec
3. Backup restore uses `.backup()` Promise but doesn't await it (bug)
4. No production safeguards in CLI (no confirmation prompts for production DB)
5. Missing test scenarios per spec section 7 (22 scenarios)
6. Missing documentation files (5 required)

---

## Development Tasks

### [ ] Task 1: Fix Backup Manager Restore Bug
**Description**: Fix `restoreBackup()` in `backup.ts` - the `src.backup()` call returns a Promise that isn't awaited
**Acceptance Criteria**: 
- Binary restore properly awaits completion
- Restore verified with integrity check
**Files to Edit**: `src/migration-runner/backup.ts` (line 168-170)
**Reference**: Backup Manager implementation

### [ ] Task 2: Update Quality Threshold Default to Spec Values
**Description**: Migration 013 specifies default `(70, true)` but current default-global is `(80, 0)`. Update to match spec.
**Acceptance Criteria**:
- Default threshold has `min_quality_score=70` and `requires_review=1`
- Existing test thresholds preserved
**Files to Edit**: Create migration 014 or update via script
**Reference**: Migration 013 line 60, current data shows 80/0

### [ ] Task 3: Apply Migration 013 to Ledger
**Description**: Migration 013 tables exist but not recorded in migration_ledger. Apply migration 013 tracking.
**Acceptance Criteria**:
- Migration 013 appears in `migration_ledger` with status 'success'
- Checksum matches migration file
- Backup created before application
**Files to Edit**: Use CLI or direct ledger entry
**Reference**: Ledger shows 001-006 applied, 013 missing

### [ ] Task 4: Add Production Safeguards to CLI
**Description**: Add production database protection - require explicit confirmation, prevent accidental migration against wrong DB
**Acceptance Criteria**:
- CLI detects production environment (NODE_ENV=production)
- Requires `--confirm-production` flag for production DB
- Validates DATABASE_PATH matches expected production path
- Never auto-migrates production without explicit flags
**Files to Edit**: `src/migration-runner/cli.ts`
**Reference**: Spec section 3 "Production protection"

### [ ] Task 5: Implement Missing Migration 013 Validation in Validator
**Description**: Add specific validation checks for migration 013 (deliverable_versions, quality_thresholds, default threshold)
**Acceptance Criteria**:
- Pre-migration: verifies deliverables table exists, columns match expected
- Post-migration: verifies deliverable_versions table, quality_thresholds table, default row (70, 1)
- Row count preservation for deliverables
**Files to Edit**: `src/migration-runner/validator.ts` (verifyMigrationChanges method)
**Reference**: Spec section 3 "Migration 013", validator.ts lines 158-252

### [ ] Task 6: Register Migration 013 in Registry
**Description**: Ensure migration 013 is discoverable by registry (already named correctly 013_*.sql)
**Acceptance Criteria**:
- `registry.getById('013')` returns migration 013
- `registry.getOrdered()` includes 013 in correct position
- Checksum computed correctly
**Files to Edit**: Verify existing, no changes likely needed
**Reference**: Registry loads from migrations/ directory with pattern `*.sql`

### [ ] Task 7: Test Suite - Fresh Database Migration
**Description**: Test complete migration sequence (001-013) on fresh database
**Acceptance Criteria**:
- All 7 migrations apply in order
- Final schema matches current production schema
- All tables, indexes, FKs present
- Integrity check passes
**Files to Create**: `tests/phase10_batch1_migration.test.ts`
**Reference**: Spec section 7 test #1

### [ ] Task 8: Test Suite - Existing Database Migration
**Description**: Test migration 013 applies to database already at version 006
**Acceptance Criteria**:
- Only migration 013 runs (001-006 detected as applied)
- Deliverable columns added correctly
- Quality thresholds table created with default
- Existing data preserved
**Files to Edit**: Same test file
**Reference**: Spec section 7 test #2, #3

### [ ] Task 9: Test Suite - Migration Applied Exactly Once
**Description**: Verify migration runner prevents duplicate execution
**Acceptance Criteria**:
- Second run of same migration returns "already applied" (not error)
- Ledger not duplicated
- Force flag overrides correctly
**Files to Edit**: Same test file
**Reference**: Spec section 7 test #4, #5

### [ ] Task 10: Test Suite - Migration Ordering & Missing Detection
**Description**: Test ordering validation and missing migration detection
**Acceptance Criteria**:
- Migrations execute in numerical order
- Gap detection (e.g., 001, 003 missing 002) - warns/errors
- Duplicate version numbers detected
**Files to Edit**: Same test file
**Reference**: Spec section 7 test #6, #7, #8

### [ ] Task 11: Test Suite - Checksum Mismatch & Failure Handling
**Description**: Test tampered migration file detection and failure rollback
**Acceptance Criteria**:
- Modified migration file throws checksum error
- Failed migration recorded in ledger with status 'failed'
- Subsequent migrations stop (stopOnError=true default)
- No partial schema changes left
**Files to Edit**: Same test file
**Reference**: Spec section 7 test #9, #10, #11

### [ ] Task 12: Test Suite - Pre-Migration Backup
**Description**: Test automatic backup creation before each migration
**Acceptance Criteria**:
- Backup created before migration execution
- Backup verified (integrity_check passes)
- Backup path recorded in ledger
- Backup includes WAL state (uses VACUUM INTO)
**Files to Edit**: Same test file
**Reference**: Spec section 7 test #12, backup.ts createBinaryBackup

### [ ] Task 13: Test Suite - Backup Integrity & WAL Handling
**Description**: Test backup verification with WAL mode active
**Acceptance Criteria**:
- Binary backup passes integrity_check
- WAL checkpointed before backup (TRUNCATE)
- Backup file is standalone (no -wal/-shm needed)
**Files to Edit**: Same test file
**Reference**: Spec section 7 test #13, #14, backup.ts verifyBinaryBackup

### [ ] Task 14: Test Suite - Restore Valid Backup
**Description**: Test restoring from valid backup to isolated database
**Acceptance Criteria**:
- Restore completes without error
- Restored database passes integrity_check
- Foreign key check passes
- Schema matches pre-migration state
**Files to Edit**: Same test file
**Reference**: Spec section 7 test #15

### [ ] Task 15: Test Suite - Reject Corrupted Backup
**Description**: Test restore fails safely on corrupted/invalid backup
**Acceptance Criteria**:
- Corrupted .db file rejected
- Invalid SQL dump rejected
- Current database preserved (not overwritten)
- Clear error message
**Files to Edit**: Same test file
**Reference**: Spec section 7 test #16, #17

### [ ] Task 16: Test Suite - Restore Failure Recovery & Preservation
**Description**: Test current database preserved before restore attempt
**Acceptance Criteria**:
- Current DB backed up before restore
- Failed restore leaves current DB intact
- WAL/SHM handled correctly
**Files to Edit**: Same test file
**Reference**: Spec section 7 test #18

### [ ] Task 17: Test Suite - Foreign Key Integrity After Restore
**Description**: Verify FK integrity after backup/restore cycle
**Acceptance Criteria**:
- PRAGMA foreign_key_check returns 0 violations
- All FK relationships intact
- Dependent records accessible
**Files to Edit**: Same test file
**Reference**: Spec section 7 test #19

### [ ] Task 18: Test Suite - Phase 9 Data Preservation
**Description**: Verify existing Phase 9 data (deliverables, tasks, execution_requests) preserved
**Acceptance Criteria**:
- Deliverable records with versions/quality scores preserved
- Task autonomy levels preserved
- Execution history intact
- Quality thresholds preserved (except default updated to spec)
**Files to Edit**: Same test file
**Reference**: Spec section 7 test #20

### [ ] Task 19: Test Suite - Concurrent Access Protection
**Description**: Test migration runner handles concurrent access correctly
**Acceptance Criteria**:
- Database locked check prevents concurrent migration
- BEGIN IMMEDIATE TRANSACTION fails if locked
- Clear error message for locked database
**Files to Edit**: Same test file
**Reference**: Spec section 7 test #21, validator.ts checkDatabaseNotLocked

### [ ] Task 20: Test Suite - Production Configuration Safeguards
**Description**: Test production safeguards work correctly
**Acceptance Criteria**:
- Production DB requires explicit confirmation
- Wrong DATABASE_PATH rejected
- In-memory DB rejected in production
- NODE_ENV=production triggers safeguards
**Files to Edit**: Same test file
**Reference**: Spec section 7 test #22, database.ts production checks

### [ ] Task 21: Run Existing Regression Tests
**Description**: Execute all existing tests to verify no regressions
**Acceptance Criteria**:
- Phase 6 migration verification tests pass
- Phase 9 task delegation tests pass
- TypeScript compilation clean
- No test files modified to achieve passing
**Commands**: `npm test`, `npx tsc --noEmit`
**Reference**: Spec section 9 acceptance criteria

### [ ] Task 22: Database Integrity Verification
**Description**: Run full integrity checks on production database
**Acceptance Criteria**:
- PRAGMA integrity_check = ok
- PRAGMA foreign_key_check = 0 violations
- Migration ledger consistent (checksums match files)
- Schema version consistent with applied migrations
- Required tables and indexes exist
**Files to Create**: Integrity check script or use validator
**Reference**: Spec section 6, acceptance criteria

### [ ] Task 23: Create Migration Architecture Documentation
**Description**: Write `PHASE10_BATCH1_MIGRATION_ARCHITECTURE.md`
**Acceptance Criteria**:
- Migration discovery and ordering explained
- Ledger design and checksum verification
- Execution flow with transactions
- Migration 013 specific changes documented
- Production safeguards described
**Reference**: Spec section 8

### [ ] Task 24: Create Backup/Restore Guide
**Description**: Write `PHASE10_BATCH1_BACKUP_RESTORE_GUIDE.md`
**Acceptance Criteria**:
- Backup methods (binary, schema_dump, full_dump) explained
- Backup verification process
- Restore procedure step-by-step
- WAL handling explained
- Failure recovery procedures
**Reference**: Spec section 8

### [ ] Task 25: Create Test Report
**Description**: Write `PHASE10_BATCH1_TEST_REPORT.md`
**Acceptance Criteria**:
- All 22 test scenarios results
- Pass/fail status for each
- Test execution commands
- Coverage summary
**Reference**: Spec section 8

### [ ] Task 26: Create Security Audit
**Description**: Write `PHASE10_BATCH1_SECURITY_AUDIT.md`
**Acceptance Criteria**:
- Migration file integrity (checksums)
- Backup file access controls
- Production safeguard effectiveness
- No credential exposure
- SQL injection prevention in migration SQL
**Reference**: Spec section 8

### [ ] Task 27: Create Implementation Report
**Description**: Write `PHASE10_BATCH1_IMPLEMENTATION_REPORT.md`
**Acceptance Criteria**:
- Summary of all changes made
- Files modified/created
- Migration 013 application details
- Quality threshold default fix
- Known limitations
- Commit SHA reference
**Reference**: Spec section 8, 11

### [ ] Task 28: Final Verification & Commit
**Description**: Run all verifications, commit and push to origin/master
**Acceptance Criteria**:
- All new tests pass (22 scenarios)
- Existing regression tests pass
- TypeScript compilation clean (no errors)
- Database integrity checks pass
- Security audit no critical/high findings
- 5 documentation files created
- Changes committed and pushed
- Commit SHA reported
- PASS/CONDITIONAL PASS/FAIL verdict given
**Commands**: `npm test`, `npx tsc --noEmit`, run integrity checks, `git commit`, `git push`
**Reference**: Spec section 9, 11

---

## Quality Requirements (from Spec)
- [ ] All migration-runner components use existing patterns
- [ ] No background processes in any commands - NEVER append `&`
- [ ] No server startup commands - assume development server running
- [ ] Mobile responsive not applicable (CLI/backend)
- [ ] Form functionality not applicable
- [ ] Images not applicable
- [ ] Include Playwright screenshot testing: N/A (CLI tool)

## Technical Notes
**Development Stack**: TypeScript, Node.js, better-sqlite3, commander.js
**Special Instructions**: 
- Do not execute migrations against production during development
- Use isolated temporary databases for all tests
- Preserve all Phase 1-9 functionality
- Do not begin Batch 2
- Migration 013 must execute exactly once

## Timeline Expectations
- Tasks 1-6 (Core fixes): ~2 hours
- Tasks 7-20 (Test suite): ~4 hours
- Tasks 21-22 (Regression & integrity): ~1 hour
- Tasks 23-27 (Documentation): ~2 hours
- Task 28 (Final verification): ~30 minutes
**Total Estimate**: ~9.5 hours

---

## Risk Notes
- **WAL handling**: Current backup uses VACUUM INTO which handles WAL correctly, but restore uses `.backup()` Promise without await - must fix
- **Quality threshold default**: Existing data has 80/0, spec requires 70/1 - must update without breaking existing thresholds
- **Migration 013 already partially applied**: Tables exist but not in ledger - careful tracking needed
- **Production database**: 7.5MB with active WAL - never test directly against it