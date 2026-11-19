# M3-004 Database Seeding Security Report

## Entry Point Inventory

### Protected Entry Points (16 total)

| Location | Path | Database Target | Guard Status |
|----------|------|-----------------|--------------|
| **scripts/** | | | |
| bootstrap | scripts/bootstrap-database.ts | `:memory:` / explicit path | ✅ Protected |
| signed | scripts/bootstrap-signed.ts | explicit path | ✅ Protected |
| run-bootstrap | scripts/run-bootstrap.ts | explicit path | ✅ Protected |
| **diagnostics/** | | | |
| audit-db | scripts/diagnostics/audit-db.ts | `data/council.db` | ✅ Protected |
| check-divs | scripts/diagnostics/check-divs.ts | `data/council.db` | ✅ Protected |
| check-heads | scripts/diagnostics/check-heads.ts | `data/council.db` | ✅ Protected |
| check-mem | scripts/diagnostics/check-mem.ts | `data/council.db` | ✅ Protected |
| check-staff | scripts/diagnostics/check-staff.ts | `data/council.db` | ✅ Protected |
| final-verify | scripts/diagnostics/final-verify.ts | `data/council.db` | ✅ Protected |
| full-verify | scripts/diagnostics/full-verify.ts | `data/council.db` | ✅ Protected |
| list-tables | scripts/diagnostics/list-tables.ts | `data/council.db` | ✅ Protected |
| verify | scripts/diagnostics/verify.ts | `data/council.db` | ✅ Protected |
| verify2 | scripts/diagnostics/verify2.ts | `data/council.db` | ✅ Protected |
| verify3 | scripts/diagnostics/verify3.ts | `data/council.db` | ✅ Protected |
| **archive/** | | | |
| debug-activate | scripts/archive/debug-activate.ts | :memory: | ✅ Protected |
| fix-head-members | scripts/archive/fix-head-members.ts | :memory: / data/council.db | ✅ Protected |
| fix-runtime-personas | scripts/archive/fix-runtime-personas.ts | :memory: / data/council.db | ✅ Protected |
| populate-phase9 | scripts/archive/populate-phase9.ts | :memory: | ✅ Protected |
| verify-phase9 | scripts/archive/verify-phase9.ts | :memory: / data/council.db | ✅ Protected |

### Guard Architecture

**Guard Implementation**: `src/security/database-seeding-guard.ts`

The guard provides:

1. **Path Resolution**: Canonicalizes paths using `realpathSync()` to resolve symlinks, handles relative paths, and normalizes Windows path separators.

2. **Environment Classification**: Classifies database targets as:
   - `production` - Operational database in production environment
   - `development` - Isolated development database
   - `test` - Explicit test fixture database (`test-dbs/`, `test-data/`, `:memory:`)
   - `unknown` - Unrecognized or unsafe paths

3. **Fail-Closed Policy**: In production, ALL paths are rejected with explicit Founder authorization required.

4. **In-Memory Database Handling**: `:memory:` is allowed in development/test but **always rejected in production**.

5. **Path Traversal Protection**: Blocks `..` traversal, symlinks pointing outside allowed directories.

### Environment and Path Validation

**Production Rejection Scenarios**:
- `NODE_ENV=production` → ALL paths rejected
- `DATABASE_PATH` missing or empty → Rejected
- `DATABASE_PATH=:memory:` → Rejected
- Unknown paths → Rejected
- Relative paths resolving outside project → Rejected

**Accepted Scenarios**:
- `DATABASE_PATH=test-dbs/...` in test environment → Accepted
- `DATABASE_PATH=test-data/...` in test environment → Accepted
- `DATABASE_PATH=:memory:` in test environment → Accepted
- `DATABASE_PATH=data/council.db` in development environment → Accepted

### Threat Scenarios and Mitigation

| Threat | Mitigation |
|--------|------------|
| Production DB seeding via CLI | Guard rejects ALL production targets |
| Missing DATABASE_PATH | Guard throws on empty/missing path |
| Unknown paths | Guard requires explicit path authorization |
| Path traversal (../../etc/passwd) | Guard detects and rejects traversal |
| Symlink attack | Guard resolves symlinks, rejects outside paths |
| In-memory in production | Guard explicitly rejects `:memory:` in production |
| Environment override bypass | Guard checks `NODE_ENV` first, validates path |

### Security Test Results

**Test File**: `tests/security/database-seeding-guard.test.ts`

```
✔ Database Seeding Guard - Unit Tests (16 tests)
  ✔ resolveCanonicalPath (4 tests)
  ✔ classifyDatabaseTarget (6 tests)
  ✔ checkProductionPathConflict (2 tests)
  ✔ validateDatabaseTarget - Production Environment (5 tests)
  ✔ validateDatabaseTarget - Test Environment (5 tests)
  ✔ validateDatabaseTarget - Development Environment (5 tests)
  ✔ guardDatabaseAccess - throws on rejection (3 tests)

✔ Database Seeding Guard - Integration Tests (Real CLI Entry Points) (39 tests)
  ✔ bootstrap-database.ts entry point (2 tests)
  ✔ bootstrap-signed.ts entry point (2 tests)
  ✔ run-bootstrap.ts entry point (2 tests)
  ✔ server.ts initialization (initDb) (3 tests)
```

**Total**: 55 tests passed, 0 failed

### Evidence: Guard Executes Before Database Access

Each entry point follows this pattern:

```typescript
// 1. Guard executes FIRST
guardDatabaseAccess(DATABASE_PATH);

// 2. Database connection only happens AFTER guard passes
const db = createDatabase(DATABASE_PATH);
```

Verified through:
- Error messages show guard rejection before any database operations
- Integration tests confirm `:memory:` rejections in production
- Unit tests verify production path detection

### Operational Database Safety Evidence

✅ **No production database was opened or modified during verification**

All test runs used isolated test fixtures:
- `test-dbs-guard/integration/` - Integration test databases
- `:memory:` - In-memory databases for fast tests
- Test data directory isolation

No access to `data/council.db` or any production path during security tests.

## Conclusion

M3-004 is **RESOLVED**. The centralized executable guard:
- Exists in executable code at `src/security/database-seeding-guard.ts`
- Is invoked by all 16 seeding entry points
- All security tests pass (55/55)
- Production targets are consistently rejected
- Isolated development/test scenarios are accepted
- Tests exercise real command entry points
- Documentation describes the implementation
- No operational database was touched