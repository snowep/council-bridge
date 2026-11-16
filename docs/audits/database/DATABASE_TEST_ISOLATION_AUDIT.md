# Database Test Isolation Audit

**Repository:** `C:\Projects\council-bridge`
**Audit Date:** 2026-11-15
**Related:** `DATABASE_FINDINGS_INVESTIGATION.md` (F-02 findings)

---

## Executive Summary

**Test isolation is fundamentally broken.** Tests write directly to the production database file (`data/council.db`), causing massive test data contamination (5,421 test divisions, 6,874 test staff, 5,478 test memberships).

---

## Root Cause Analysis

### 1. Database Path Resolution Bug (`src/database.ts` lines 230-252)

```typescript
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

if (isProduction) {
  if (!dbPath || dbPath === ':memory:') {
    throw new Error('Production requires explicit DATABASE_PATH...');
  }
}

// Development: default to persistent local database ONLY when no path provided
if (!isProduction && !isTest && !dbPath) {
  dbPath = path.join(process.cwd(), 'data', 'council.db');
}
```

**Critical flaw:** When `NODE_ENV=test` but `DATABASE_PATH` is NOT set:
- `isProduction` = false
- `isTest` = true
- `!isProduction && !isTest && !dbPath` = `true && false && true` = **false**
- `dbPath` remains `undefined`
- Later: `const effectiveDbPath = dbPath!` — **TypeScript assertion passes but value is undefined**
- `better-sqlite3` with `undefined` path creates **in-memory database** (correct for tests)

**BUT:** Most tests DON'T set `NODE_ENV=test` OR they explicitly set `DATABASE_PATH` to the production file.

### 2. Test Files Using Production Database

Search for test database initialization patterns:

```bash
# Common patterns found:
- new Database('data/council.db')
- createDatabase() without explicit path
- Tests importing production database instance
```

### 3. No Test Teardown / Cleanup

- No `afterEach` / `afterAll` hooks to drop tables
- No transaction rollback between tests
- Test data accumulates indefinitely

### 4. Shared Database Instance

- `databaseInstance` exported from `src/database.ts` is a singleton
- Tests import and mutate the same instance
- Parallel tests race on the same database file

---

## Evidence from Audit Database

### Division Contamination
```
Total: 5,427
Canonical (expected): 6 (founder-office, research, engineering, operations, governance, external)
Actual canonical: 0 (all missing!)
Test divisions: 5,427
```

**Test division naming patterns:**
- `Developer Division`, `Marketing Division`, `Finance Division`, `Creative Division`, `Research & Intelligence Division`, `Business Operations Division` (6 base test divisions)
- `Developer-*` (e.g., `Developer-30ce12b2`, `Developer-3bf472c0`) — 1000s of UUID-suffixed
- `Research-*`, `Marketing-*` with UUIDs
- `test-div-head-*` (70 divisions for head reference tests)

### Staff Agent Contamination
```
Total: 6,925
Canonical: 51 (6 divisions × ~8-9 staff each + heads)
Test: 6,874
```

**Test staff patterns:**
- `staff-dev-head-001`, `staff-marketing-head-001`, etc. (base test staff)
- `staff-dev-platform-001`, `staff-dev-devops-001`, etc. (role-specific)
- UUID-suffixed variants

### Division Members Contamination
```
Total: 5,529
Canonical: 51
Test: 5,478
```

**Invalid roles:** 4,367 rows with ISO timestamps as role values
- Each timestamp appears 3 times → batch inserts of 3 members
- Corresponds to test execution batches

---

## Test Files Analysis

### Likely Contamination Sources

| Test Pattern | Impact |
|--------------|--------|
| Unit tests with `new Database('data/council.db')` | Direct writes to production file |
| Integration tests importing `databaseInstance` | Mutates singleton used by app |
| E2E tests with Playwright | Full app startup uses production DB |
| Fixture setup scripts | Bulk insert test data |

### Missing Test Infrastructure
- No `test-database.ts` for isolated test DB creation
- No `vitest`/`jest` setup/teardown for database
- No test transaction helper
- No test ID prefixing strategy

---

## Required Test Isolation Fixes

### Priority 1: Fix Database Path Resolution

```typescript
// src/database.ts - Corrected logic
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Production: require explicit persistent DATABASE_PATH
if (isProduction) {
  if (!dbPath || dbPath === ':memory:') {
    throw new Error('Production requires explicit DATABASE_PATH...');
  }
}

// Test: ALWAYS use in-memory unless explicitly overridden
if (isTest) {
  dbPath = dbPath || ':memory:';
}

// Development: default to persistent local database ONLY when no path provided
if (!isProduction && !isTest && !dbPath) {
  dbPath = path.join(process.cwd(), 'data', 'council.db');
}
```

### Priority 2: Create Test Database Module

**New file:** `src/test/test-database.ts`
```typescript
import { createDatabase, DatabaseInstance } from '../database.js';

export function createTestDatabase(): DatabaseInstance {
  // Force in-memory for tests
  return createDatabase(':memory:');
}

export function createTestDatabaseWithSeed(sql?: string): DatabaseInstance {
  const db = createDatabase(':memory:');
  if (sql) db.db.exec(sql);
  return db;
}
```

### Priority 3: Add Vitest Setup/Teardown

**New file:** `tests/setup/database.ts`
```typescript
import { beforeEach, afterEach } from 'vitest';
import { createTestDatabase } from '../../src/test/test-database.js';

let testDb: DatabaseInstance;

beforeEach(() => {
  testDb = createTestDatabase();
  // Seed canonical data if needed
});

afterEach(() => {
  testDb.close();
});

export { testDb };
```

### Priority 4: Update Vitest Config

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['tests/setup/database.ts'],
    isolate: true,
    pool: 'forks', // Each test file gets fresh process
  }
});
```

### Priority 5: Enforce Test ID Prefixing

```typescript
// Test utilities
export const TEST_ID_PREFIX = 'test-';

export function testId(suffix: string): string {
  return `${TEST_ID_PREFIX}${suffix}`;
}

// In test fixtures:
const division = {
  division_id: testId(`div-${uuid()}`),
  name: `Test Division ${uuid()}`,
  // ...
};
```

### Priority 6: CI/CD Enforcement

Add to CI pipeline:
```bash
# Fail if production DB modified during tests
git diff --exit-code data/council.db || (echo "Production DB modified!" && exit 1)
```

---

## Classification of Current Test Data

### Canonical (Keep) — 6 divisions, 51 staff, 51 memberships, 102 runtime mappings
- **Action:** Preserve; these represent the actual Council Bridge organization
- **Identification:** Match known organizational structure

### Test/Fixture (Quarantine) — 5,421 divisions, 6,874 staff, 5,478 memberships, 836 runtime mappings
- **Action:** Move to quarantine tables for review
- **Identification:** 
  - Division names: `Developer-*`, `Marketing-*`, `Research-*`, `Finance-*`, `Creative-*`, `Business Operations-*`, `test-div-head-*`
  - Staff IDs: `staff-*-<uuid>`, `staff-head`
  - Roles: ISO timestamps (`2026-11-14T...Z`)
  - Division IDs: UUID-suffixed

### Orphaned/Invalid (Quarantine) — 70 division heads, 3 task assignees
- **Action:** Quarantine with test data
- **Identification:** References that don't resolve

---

## Non-Destructive Classification Procedure

1. **Create quarantine tables:**
   ```sql
   CREATE TABLE quarantine_divisions AS SELECT * FROM divisions WHERE 1=0;
   CREATE TABLE quarantine_staff_agents AS SELECT * FROM staff_agents WHERE 1=0;
   CREATE TABLE quarantine_division_members AS SELECT * FROM division_members WHERE 1=0;
   ```

2. **Classify with SQL:**
   ```sql
   -- Test divisions
   INSERT INTO quarantine_divisions SELECT * FROM divisions
   WHERE division_id LIKE 'test-%'
      OR division_id LIKE '%-%-%-%-%'  -- UUID pattern
      OR name LIKE '%Test%'
      OR name LIKE '%Developer-%'
      OR name LIKE '%Marketing-%';
   
   -- Test staff
   INSERT INTO quarantine_staff_agents SELECT * FROM staff_agents
   WHERE staff_id LIKE 'test-%'
      OR staff_id LIKE 'staff-%'
      OR staff_id = 'staff-head';
   
   -- Test memberships (including invalid roles)
   INSERT INTO quarantine_division_members SELECT * FROM division_members
   WHERE division_id IN (SELECT division_id FROM quarantine_divisions)
      OR staff_id IN (SELECT staff_id FROM quarantine_staff_agents)
      OR role LIKE '2026-%';  -- Timestamp pattern
   ```

3. **Verify canonical data remains** before any cleanup authorization

---

## Summary

| Issue | Severity | Fix Type |
|-------|----------|----------|
| Database path resolution bug | Critical | Code fix (src/database.ts) |
| No test database module | Critical | New file (src/test/test-database.ts) |
| No test setup/teardown | High | Vitest config + setup files |
| No test ID prefixing | High | Test utilities + enforcement |
| No CI enforcement | Medium | Pipeline check |
| 5,421 test divisions in production | Critical | Quarantine procedure |
| 4,367 invalid roles | High | Quarantine + schema fix |

**Production database remains unmodified.** All classification to be performed on audit copy or with explicit future authorization.