# Council Bridge — M3 Final Remediation: Founder Nonce Security, Cross-Process Reliability, UI Regression, and Acceptance Evidence

## 1. Role and objective

Act as the senior backend security engineer, test engineer, and frontend quality engineer responsible for completing the outstanding M3 remediation in Council Bridge.

Repository: `https://github.com/snowep/council-bridge`  
Local repository: `C:\Projects\council-bridge`  
Authorized working branch: `refactor/repository-structure`

The latest audited development commit was `9daa2c30b2762a3aa29223b1aeb73ca94e12a668` (`9daa2c3`). The previously audited `master` commit was `8fce7ceab84d792fc76146696065165055fd15df`.

These are reference points, not assumptions about the current checkout. Inspect the actual repository and remote state before proceeding.

### Primary objective

Resolve the outstanding M3 findings, with particular emphasis on:

1. Replace the unsafe SQLite lease-based Founder nonce locking implementation with atomic, persistent SQLite nonce consumption.
2. Make all cross-process tests exercise the actual production implementation.
3. Verify both Founder bootstrap entrypoints enforce authorization before opening or creating the target database.
4. Repair inaccurate or stale M3 verification reports.
5. Revert unrelated Dashboard styling changes that violate the approved design constraints.
6. Remove keyboard shortcuts that hijack browser-native commands.
7. Complete the outstanding backend, frontend, integration, accessibility, responsive, and regression verification.
8. Produce an evidence-based M3 final acceptance report.

This is an implementation and verification task, not another planning-only audit. Do the work within the authorized scope.

**M3 remains unaccepted. Do not declare M3 accepted. Only the Founder can formally accept it.**

---

## 2. Mandatory boundaries

### Branch and Git safety

- Work exclusively on `refactor/repository-structure`.
- Do not modify `master`.
- Do not merge, fast-forward, rebase, cherry-pick into, or otherwise change `master`.
- Do not delete, rename, or recreate branches.
- Do not create another working branch.
- Do not commit or push.
- Do not create a pull request.
- Do not deploy.
- Do not force-push or rewrite Git history.
- Do not run destructive Git commands.
- Preserve all existing uncommitted changes.
- Inspect `git status`, current branch, HEAD, and branch divergence before editing.
- Do not discard, overwrite, or silently incorporate unrelated user changes.
- If the current checkout is not the authorized branch, stop before modifying files and report the discrepancy.

### Database and security safety

- Do not modify the production `council.db`.
- Do not run production migrations.
- Do not seed, reset, clean, or delete production data.
- Do not delete production nonce records.
- Do not reset the Founder nonce database.
- Do not remove replay-protection history.
- Do not weaken authentication, authorization, signature verification, or production path restrictions.
- Do not introduce hardcoded Founder identities or fallback authentication.
- Do not expose Founder private keys to the frontend, repository, logs, or test reports.
- Use isolated temporary databases for tests.
- Do not silently fall back to an in-memory database or an empty nonce store when persistent storage fails.

### M3 design constraints

- Preserve React 19, Vite, TypeScript, and MUI 9.
- Use official MUI components and Google's Material Design system.
- Avoid unnecessary custom CSS and custom components.
- Preserve the approved design system, existing palette, colors, theme definitions, design tokens, typography, and Impeccable-approved styling.
- Do not introduce gradients, decorative AI-style cards, unnecessary visual effects, or new design patterns.
- M3-009 may improve responsive layout, spacing, component arrangement, semantic markup, keyboard interaction, and accessibility behavior.
- M3-009 must not change approved colors, palette, theme definitions, design tokens, or typography.
- Preserve the four previously documented serious contrast exceptions as separately documented exceptions if they cannot be resolved within these constraints. Do not alter approved colors to make an accessibility test pass.

### Scope restrictions

- Do not start M4.
- Do not bootstrap or reconcile the production organization database.
- Do not change Council membership, divisions, staff identities, or organizational counts.
- Do not implement new product features unrelated to M3 remediation.
- Do not perform broad refactoring unrelated to the identified findings.
- Do not interpret this prompt as M3 acceptance authorization.

---

# 3. Phase A — Repository and implementation reconnaissance

Before editing:

1. Inspect `git status --short`.
2. Verify the current branch is `refactor/repository-structure`.
3. Record the current HEAD SHA.
4. Fetch and inspect remote branch references without changing branches.
5. Confirm the current relationship between `master` and `refactor/repository-structure`.
6. Inspect the complete diffs introduced by `9daa2c3` and subsequent commits, if any.
7. Inspect the current implementations of:
   - `src/auth/founder.ts`
   - `scripts/run-bootstrap.ts`
   - `scripts/bootstrap-signed.ts`
   - `src/auth/database-seeding-guard.ts` or its actual current location
   - Existing Founder signature verification modules
   - Existing nonce persistence modules
   - Existing migration and database initialization utilities
   - All Founder security and cross-process tests
   - Dashboard implementation and related styles
   - Existing M3 reports and test configuration
8. Inspect the actual database driver and project module conventions before choosing imports or file extensions.
9. Inspect the existing Founder authorization API and every call site before changing interfaces.
10. Establish the current test baseline before modifying implementation.

Do not assume the file paths or code samples in this prompt exactly match the current repository. Adapt to the real implementation while preserving the required security properties.

Produce an initial internal change plan. Do not stop after documenting findings; proceed with implementation unless a genuine blocker prevents it.

---

# 4. Phase B — Replace Founder nonce locking with transactional SQLite consumption

## 4.1 Remove the lease-based locking architecture

The current implementation introduced a SQLite lock database with a lease mechanism.

The previous implementation included concepts such as:

- `LOCK_DB_PATH`
- `LOCK_STALE_MS`
- `owner_pid`
- `owner_token`
- `acquired_at`
- `acquireNonceLock()`
- `releaseNonceLock()`
- `isLockStale()`
- Lease expiration and takeover
- A separate nonce file read/check/write operation after lock acquisition

The previous implementation is unsafe because its SQLite transaction is committed before the actual nonce operation completes. It therefore does not hold an exclusive write transaction throughout nonce consumption.

A process paused for longer than the lease interval can be treated as stale even though its protected operation has not completed.

**Remove this lease architecture rather than extending it with more PID tracking, heartbeats, stale-lock recovery, or ownership markers.**

There must be no custom 30-second lease or stale-lock takeover in the replacement.

## 4.2 Required architecture

Use one persistent SQLite database dedicated to Founder replay protection.

The nonce database must remain independent of the main application database.

Suggested organization, adapted to existing project conventions:

```text
src/
├── auth/
│   ├── founder.ts
│   └── founder-nonce-store.ts
│
├── database/
│   └── founder-nonce-database.ts
│
└── security/
    └── database-seeding-guard.ts

tests/
└── security/
    ├── founder-nonce-store.test.ts
    ├── founder-nonce-cross-process.test.ts
    └── founder-bootstrap-security.test.ts
```

Do not create duplicate modules if equivalent existing modules can be safely adapted.

### Database responsibilities

The persistent nonce database module must:

- Resolve a stable, explicitly configured filesystem path.
- Create the required parent directory securely.
- Use restrictive filesystem permissions where supported.
- Reject invalid database paths.
- Avoid silently switching to an in-memory database.
- Use the existing supported SQLite driver, preferably the existing `better-sqlite3` dependency if that is what the repository uses.
- Configure appropriate durability and concurrency settings.
- Initialize the schema safely and idempotently.
- Propagate initialization and filesystem errors.
- Close connections cleanly during tests and controlled shutdown.
- Never delete the database, WAL, or SHM files during normal operation.

Suggested configuration, subject to existing project conventions:

```ts
const NONCE_DATABASE_PATH = path.resolve(
  process.env.FOUNDER_NONCE_DATABASE_PATH ??
    path.join(
      process.cwd(),
      '.secrets',
      'nonces',
      'founder-nonces.db'
    )
);
```

Do not assume `process.cwd()` is always an appropriate production location. Verify deployment and execution conventions. The path must be stable across process restarts and independent of the target application database.

If the configured path is missing, ambiguous, inaccessible, invalid, or unsafe, fail closed.

### Required table

Implement a persistent nonce table with a database-enforced uniqueness constraint.

Reference schema:

```sql
CREATE TABLE IF NOT EXISTS consumed_nonces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    nonce TEXT NOT NULL,
    consumed_at INTEGER NOT NULL,
    UNIQUE(key_id, operation, nonce)
);

CREATE INDEX IF NOT EXISTS idx_consumed_nonces_timestamp
ON consumed_nonces(consumed_at);
```

Before adopting the exact uniqueness tuple, inspect the existing security model and confirm the current replay-protection scope.

Preserve or strengthen the existing scope. Do not silently weaken it.

The uniqueness constraint must be enforced by SQLite, not by an in-memory JavaScript `Set` or a preliminary SELECT query.

## 4.3 Atomic nonce-consumption operation

Implement a production function with responsibilities equivalent to:

```ts
export interface ConsumeNonceInput {
  keyId: string;
  operation: string;
  nonce: string;
  consumedAt?: number;
}

export interface ConsumeNonceResult {
  consumed: boolean;
  reason?: 'INVALID_INPUT' | 'REPLAYED';
}

export function checkAndConsumeNonce(
  input: ConsumeNonceInput
): ConsumeNonceResult;
```

The implementation must:

1. Validate the input.
2. Obtain the persistent nonce database.
3. Begin an SQLite write transaction using `BEGIN IMMEDIATE` or the driver's equivalent immediate transaction API.
4. Attempt the nonce insertion under the database-enforced uniqueness constraint.
5. Return success only when exactly one new nonce record has been committed.
6. Roll back unsuccessful operations.
7. Commit only after the nonce has been successfully inserted.
8. Propagate database and filesystem errors.
9. Never treat an uncertain outcome as successful authorization.

Reference SQL:

```sql
INSERT INTO consumed_nonces (
    key_id,
    operation,
    nonce,
    consumed_at
)
VALUES (?, ?, ?, ?)
ON CONFLICT(key_id, operation, nonce)
DO NOTHING;
```

Check the driver's affected-row count.

A duplicate must return a replay rejection.

Invalid input must never consume a nonce.

### Transaction requirements

The transaction must cover the entire nonce consumption operation.

Do not implement this sequence:

```text
Acquire lock
Commit lock transaction
Check nonce
Write nonce
Release lock
```

Implement this sequence:

```text
BEGIN IMMEDIATE
Validate and insert nonce
COMMIT
```

On any exception:

```text
ROLLBACK
Propagate error
```

For `better-sqlite3`, a synchronous transaction wrapper using its immediate transaction mode is acceptable:

```ts
const transaction = db.transaction(() => {
  // Execute nonce insertion and inspect affected rows.
});

const result = transaction.immediate();
```

Adapt the exact API to the installed driver and TypeScript version.

Do not use `await` or asynchronous operations inside a synchronous SQLite transaction.

A transaction must not be released before the nonce insertion has completed.

## 4.4 Database lifecycle and failure handling

Review all connection lifecycle behavior.

Requirements:

- No concurrent deletion of an active nonce database.
- No production-callable destructive reset function.
- Do not export a general-purpose `resetNonceLockStore()` or equivalent from a production security module.
- Test setup must use isolated temporary directories and databases.
- Test cleanup must close all connections and wait for child processes to exit before deleting temporary files.
- Do not swallow errors during database initialization, transaction commit, rollback, or persistence.
- Do not treat corruption, permissions errors, or SQLite failures as proof that a lock is stale.
- Never respond with successful nonce consumption when commit success is uncertain.
- Never create an empty replacement database as an automatic recovery from corruption.
- If a database corruption or I/O failure occurs, fail closed and provide an actionable diagnostic that does not expose secrets.

Retain only lifecycle functions genuinely needed by production code.

---

# 5. Phase C — Legacy nonce-history migration

The existing implementation used file-based nonce persistence, including `used-nonces.jsonl` or an equivalent file.

Do not simply replace the file store with a new empty SQLite database.

That would reset replay protection for previously consumed nonces.

## Required migration

1. Inspect the exact existing nonce file format and actual production location.
2. Identify every existing nonce record and its key/operation scope.
3. Implement a one-time, idempotent migration into the new SQLite nonce database.
4. Preserve all valid historical nonce records.
5. Use a migration marker or equivalent transactional mechanism to prevent repeated imports.
6. Ensure concurrent startup cannot partially or inconsistently migrate the history.
7. Do not delete, truncate, or rewrite the original nonce file.
8. Preserve the original file as a recovery source.
9. Record imported, duplicate, and invalid record counts without logging sensitive nonce values.
10. If malformed or ambiguous historical records exist, fail closed or stop for manual reconciliation. Do not silently discard them.
11. Make the migration safe to rerun after an interrupted attempt.

The migration must be committed transactionally.

A partial import must never be marked complete.

After migration, the production nonce-consumption implementation must use the SQLite store as the authoritative source.

There must be no silent fallback from SQLite to JSONL.

Add tests covering:

- First-time successful migration.
- Repeated migration without duplication.
- Duplicate historical records.
- Invalid records.
- Interrupted migration.
- Database already containing some of the historical records.
- Replay rejection for a nonce that was consumed before the migration.
- Original JSONL file remains unchanged.

Do not run this migration against production data during remediation. Test only against isolated fixtures or copied test data.

---

# 6. Phase D — Founder authorization and bootstrap ordering

Inspect the current implementations of:

- `src/auth/founder.ts`
- `scripts/run-bootstrap.ts`
- `scripts/bootstrap-signed.ts`
- Any underlying Founder signature and operation-verification utilities.

Both bootstrap entrypoints must use the same security-critical authorization flow.

## Required order

```text
1. Parse and validate the signed Founder operation request.
2. Validate all required fields and operation types.
3. Validate the target database path without opening or creating it.
4. Load the trusted Founder public key.
5. Verify the externally generated Founder signature.
6. Validate the signature's associated key ID, operation, timestamp,
   expiry, nonce, and other existing authorization constraints.
7. Atomically consume the nonce using the persistent SQLite nonce store.
8. Only after authorization succeeds, open or create the target database.
9. Execute the approved bootstrap operation.
10. Close the target database safely.
```

### Non-negotiable requirements

- The target database must not be opened or created before signature verification and successful nonce consumption.
- Use the trusted public key for verification.
- Do not load or require the Founder private key in a verification-only path.
- Do not generate a Founder signature inside a bootstrap script.
- Do not reintroduce self-signing.
- Do not bypass operation, time, key ID, or nonce validation.
- Preserve all existing production path restrictions.
- Preserve the external signature generation workflow.
- Invalid, missing, expired, malformed, or replayed signatures must be rejected.
- Database initialization errors must fail closed.
- Do not expose private key material in logs or error messages.

Retain existing public function names and signatures where possible. Inspect all call sites before changing the API.

If an existing function is asynchronous, preserve compatibility or update every call site and test deliberately. Do not introduce an API-breaking change without necessity.

### Important operation-failure behavior

Nonce consumption occurs before target database creation.

Therefore, if authorization succeeds but a later bootstrap operation fails, the nonce remains consumed.

Document this behavior. A new signed operation with a fresh nonce is required for a retry.

Do not attempt to restore a consumed nonce automatically after a partial bootstrap failure.

---

# 7. Phase E — Real production cross-process testing

The existing cross-process tests contain duplicated lock implementations and inline scripts that do not exercise the new production SQLite nonce-consumption implementation.

Replace those tests.

## Required test architecture

The child-process worker must import and call the actual production function:

```ts
import {
  checkAndConsumeNonce,
} from '../../src/auth/founder-nonce-store.js';
```

Adapt paths and module extensions to the actual project configuration.

Do not copy, reimplement, simulate, or duplicate the nonce-lock algorithm in a test worker.

Do not use an inline `node -e` implementation of the locking mechanism.

The test worker should call the production API and return its actual result.

Use isolated temporary nonce databases configured through an explicit test environment variable.

Ensure environment configuration is established before importing modules that initialize database connections.

## Deterministic concurrency

Use a parent-controlled IPC barrier or equivalent deterministic synchronization.

The parent test process should:

1. Spawn multiple child processes.
2. Wait until each process confirms it is ready.
3. Release all processes at the same time.
4. Collect their real production-function results.
5. Verify the expected database state.
6. Close workers and database connections before temporary-directory cleanup.

Do not rely solely on `Promise.all()` timing to prove simultaneous execution.

## Required tests

### A. Concurrent identical nonce

Two or more independent OS processes attempt to consume the same nonce.

Expected result:

- Exactly one process succeeds.
- Every other process receives a replay rejection.
- The database contains exactly one record for that nonce.

### B. Concurrent distinct nonces

Independent processes consume different nonces concurrently.

Expected result:

- Both operations succeed.
- Both records exist.
- Neither operation incorrectly blocks or rejects the other.

### C. Same-process concurrency

Verify multiple calls in the same Node.js process also behave correctly.

### D. Crash before commit

Demonstrate that a process terminated while holding an uncommitted nonce transaction does not leave a partially committed nonce record.

Use an isolated test database.

A suitable approach is to have a controlled test worker open a real transaction through the production database module, insert a test nonce without committing, signal the parent, and wait. The parent terminates that child process. Another child then calls the actual production `checkAndConsumeNonce()` function.

Expected result:

- SQLite rolls back the abandoned transaction.
- The second process can consume the nonce successfully.
- No partial record remains.

Do not create a second implementation of the locking algorithm to test this behavior.

### E. Restart persistence

1. Consume a nonce.
2. Close the database.
3. Start a new process.
4. Attempt to consume the same nonce.

Expected result: replay rejection.

### F. Main application database recreation

1. Consume a nonce.
2. Recreate an isolated test copy of the main application database.
3. Leave the Founder nonce database untouched.
4. Attempt to consume the original nonce again.

Expected result: replay rejection.

### G. Corrupt nonce database

Expected result:

- Authorization fails closed.
- No empty replacement database is silently created.
- No successful nonce result is returned.

### H. Unavailable nonce database

Expected result:

- Authorization fails closed.
- Filesystem and SQLite errors propagate.
- No JSONL or in-memory fallback is used.

### I. Invalid bootstrap signature

Expected result:

- The target database is not created.
- The target database is not opened.
- The nonce is not consumed unless the existing authorization policy explicitly requires otherwise.

### J. Missing signature

Expected result:

- Rejection before target database creation.
- No self-generated signature.
- No private-key fallback.

### K. Legacy migration and replay

Verify that previously consumed JSONL nonces remain rejected after migration and application restart.

### L. Lock removal

Verify there are no remaining production dependencies on:

- PID-specific takeover files.
- Owner markers.
- Stale-lock timeouts.
- Lease-based acquisition.
- Old duplicated worker locking logic.

## Test quality rules

- Test production source, not copied algorithms.
- Do not use mocks for the central cross-process persistence guarantees.
- Do not weaken existing assertions to make the suite pass.
- Do not skip failing security tests.
- Do not increase test timeouts as a substitute for fixing hangs.
- Use bounded timeouts to detect deadlocks and child-process failures.
- Verify process exit codes.
- Verify database contents independently of worker output.
- Ensure tests clean up their own isolated resources.

---

# 8. Phase F — Correct the unrelated Dashboard changes in commit 9daa2c3

The latest audited commit included Dashboard changes unrelated to M3-004.

Inspect the exact commit diff and remove only the changes that violate the existing approved design or browser interaction behavior.

Target file:

`frontend/src/features/dashboard/pages/DashboardPage.tsx`

## 8.1 Revert unauthorized visual additions

Remove the newly introduced:

- Decorative conic-gradient backgrounds.
- Unapproved card background decoration.
- Unapproved visual emphasis and ornamental treatments.
- Governance badge treatments or presentation changes that were not part of the accepted design baseline.

Restore the approved visual appearance from the appropriate pre-change implementation.

Do not blindly restore the entire file if it contains legitimate later functionality.

Preserve valid dashboard functionality and all unrelated user changes.

Do not change the approved palette, theme tokens, colors, or typography.

## 8.2 Remove browser shortcut hijacking

Remove logic that intercepts:

- `Ctrl/Cmd + R` to refresh dashboard data.
- `Ctrl/Cmd + N` to open Create Division.

These are browser-native shortcuts and must not be overridden.

Preserve ordinary application-level shortcuts only when they do not conflict with browser, operating-system, or assistive-technology behavior.

Preserve Escape-to-close behavior if implemented correctly and accessible.

Do not replace removed browser shortcuts with another set of conflicting shortcuts.

Add or update tests verifying that browser-native shortcuts are not intercepted by the application.

---

# 9. Phase G — Complete M3 verification findings

The remaining M3 findings must be verified against the final implementation.

## M3-001 — Dashboard actions

Previously identified issue: Dashboard action controls had empty callbacks or did not reach their intended behavior.

Verify:

- Create Division opens the correct dialog.
- The action submits through the actual backend API.
- Successful creation updates the UI.
- Failed creation displays an actionable error.
- Invite Staff performs the actual supported staff-registration operation.
- The UI does not claim that an email invitation was sent unless an actual invitation-delivery mechanism exists.
- New Task opens the intended task-creation interface.
- Loading, disabled, success, and failure states behave correctly.

Use accurate wording. A pending staff record is not equivalent to an invitation email being delivered.

## M3-002 — Activity page

Verify:

- `/activity` exists.
- The activity page is implemented.
- Dashboard activity links work.
- The activity API returns valid data.
- Loading, empty, and error states are handled.
- Authentication and authorization remain enforced.
- Navigation works on desktop and mobile.

## M3-003 — Profile

Verify:

- Profile functionality accurately reflects what is implemented.
- Read-only fields are presented as read-only.
- No fake save operation claims persistence when data is not actually saved.
- Placeholder identity or email information is clearly handled.
- Profile navigation and user-menu behavior work.

## M3-004 — Founder nonce security

Complete the implementation and tests in Phases B–E.

This is the primary security blocker.

## M3-005 — Authorization status

Verify:

- Unauthorized division and staff operations return HTTP 403.
- Authentication failures retain appropriate status codes.
- Validation failures return appropriate 4xx responses.
- Unclassified internal failures return 500.
- Error handling does not expose sensitive internals.
- No authorization rule is weakened.

## M3-006 — Settings

Verify:

- Settings changes behave as real draft state.
- Cancel restores the previous saved state.
- Save persists only the settings the application actually supports.
- Unsupported email or push notification delivery controls do not imply delivery functionality exists.
- Theme settings remain consistent with the approved design system.
- No approved color or typography tokens are modified.

## M3-007 — Test and integration reliability

Complete the entire backend and frontend verification suite.

Do not report test success based only on earlier commits or prior user reports.

Record actual results from the current final HEAD.

## M3-008 — Evidence and reporting

Update the reports after implementation and verification.

Every report must reference the same actual final HEAD.

Do not leave stale commit identifiers, stale test totals, or conflicting completion statements.

## M3-009 — Responsive and accessibility verification

Complete the route, viewport, accessibility, and keyboard verification described below.

Do not claim WCAG 2.2 AA compliance without corresponding evidence.

---

# 10. Phase H — Responsive, accessibility, and keyboard verification

The previous M3-009 evidence was insufficient because parts of the route list were not actually tested, accessibility coverage was incomplete, and keyboard checks were superficial.

Complete the verification using the actual frontend test environment.

## 10.1 Route inventory

Derive the actual complete route inventory from the application router.

The previously audited expected application pages include:

1. Dashboard
2. Chat
3. Council
4. Meetings
5. Memory
6. Organization
7. Tasks
8. Executions
9. Deliverables
10. Approvals
11. Activity
12. Settings
13. Profile

Verify every actual route. Do not assume a route exists simply because it appears in this list.

Document:

- Route.
- Page/component.
- Authentication requirement.
- Expected loading behavior.
- Expected empty behavior.
- Expected error behavior.
- Verification result.

## 10.2 Viewport matrix

Verify every applicable route at these five widths:

| Viewport | Width |
|---|---:|
| Mobile | 375px |
| Tablet | 768px |
| Small desktop | 1024px |
| Desktop | 1440px |
| Large desktop | 1920px |

The expected coverage is the complete route-by-viewport matrix, not merely testing the Dashboard at five widths.

For 13 applicable routes, this means at least 65 route/viewport combinations.

Verify:

- No horizontal overflow.
- No clipped primary navigation.
- No overlapping controls.
- No inaccessible dialogs.
- No hidden critical actions.
- Correct responsive navigation.
- Appropriate content layout.
- Usable forms and tables.
- Readable text without changing approved typography tokens.
- Usable touch targets.
- Correct scroll behavior.

## 10.3 Automated accessibility

Use the installed Playwright and axe-core tools where available.

Run axe-core against every applicable route.

Record:

- Routes tested.
- Number of tests executed.
- Violations by severity.
- Number of critical, serious, moderate, and minor violations.
- Specific unresolved exceptions.
- Evidence of remediation.

Do not suppress, disable, or silently ignore accessibility rules to produce a passing result.

The four previously documented serious contrast exceptions must remain individually documented if the approved styling constraint prevents resolution.

Do not change existing colors, themes, or tokens to eliminate them.

## 10.4 Keyboard verification

Verify actual functionality through keyboard navigation.

At minimum:

- Tab navigation through primary page controls.
- Shift+Tab reverse navigation.
- Visible focus indication.
- Enter and Space activation for appropriate controls.
- Escape closes appropriate dialogs and menus.
- Focus enters dialogs when opened.
- Focus remains managed inside modal dialogs.
- Focus returns appropriately when dialogs close.
- No keyboard traps.
- No browser-native shortcut interception.
- Navigation and form submission work without a mouse.

Do not consider a superficial press of Tab or Escape sufficient evidence.

## 10.5 Screen reader and semantic structure

Where the available test environment supports it, verify:

- Correct page landmarks.
- Heading hierarchy.
- Accessible names.
- Form labels.
- Error-message relationships.
- Dialog names and roles.
- Button semantics.
- Status-message announcements.
- Table semantics.
- Navigation labels.

Document any manual verification that cannot be automated.

---

# 11. Phase I — Complete regression and quality gates

Run the applicable checks using the repository's actual package scripts.

At minimum:

### Backend

- Full backend unit test suite.
- Full backend integration test suite.
- Founder authorization tests.
- Founder signature tests.
- Founder nonce persistence tests.
- Cross-process concurrency tests.
- Bootstrap security tests.
- Database seeding guard tests.
- Authentication and authorization regression tests.
- MCP communication and workflow E2E tests.

### Frontend

- Full frontend unit test suite.
- Dashboard action tests.
- Activity page tests.
- Profile tests.
- Settings tests.
- Navigation and routing tests.
- Full route/viewport Playwright suite.
- axe-core accessibility verification.
- Keyboard interaction verification.

### Static and build checks

- TypeScript type checking.
- ESLint.
- Prettier or the repository's configured formatter check.
- Backend production build, if applicable.
- Frontend production build.

Do not change tests, lint rules, TypeScript settings, accessibility rules, or build configuration merely to hide existing defects.

### Test failure handling

For every failing test:

1. Identify the exact failing assertion.
2. Determine whether the failure is caused by the implementation, test isolation, fixture setup, or environment.
3. Fix the underlying issue where it is within scope.
4. Preserve the original test intent.
5. Rerun the affected test.
6. Rerun the full relevant suite.

If a failure is genuinely unrelated or pre-existing, document the exact test name, error, and evidence. Do not label it pre-existing without comparing it against the baseline.

Do not fabricate test totals or report commands as passing when they were not run.

---

# 12. Phase J — Report reconciliation

Update the existing M3 reports rather than creating conflicting documentation.

Inspect and reconcile at least:

- `docs/reports/M3_FINAL_ACCEPTANCE_AUDIT.md`
- `docs/reports/M3_FINAL_REMEDIATION_VERIFICATION_REPORT.md`
- `docs/reports/` reports covering database seeding security.
- `docs/reports/` reports covering test reliability.
- `docs/reports/` reports covering responsive and accessibility verification.
- The original M3 wave reports where their status or conclusions are now outdated.

Preserve relevant historical audit findings, but clearly distinguish historical findings from current verified status.

All current reports must contain:

1. Actual final HEAD SHA.
2. Current branch.
3. Date of verification.
4. Scope of the remediation.
5. Files changed.
6. Security design summary.
7. Legacy nonce migration result.
8. Bootstrap authorization ordering result.
9. Cross-process test results.
10. Full backend test totals.
11. Full frontend test totals.
12. MCP E2E results.
13. TypeScript result.
14. Lint and formatting results.
15. Build result.
16. Responsive route/viewport coverage.
17. axe-core results.
18. Keyboard verification results.
19. Unresolved findings.
20. Explicit acceptance disposition.

Distinguish:

- Verified by automated tests.
- Verified by source inspection.
- Verified manually.
- Not verified.
- Blocked.
- Known exception.

A test count is valid only when it comes from an actual executed test command and its exit code.

Do not claim GitHub Actions or CI passed when there is no corresponding run.

Do not claim that ChatGPT or another external reviewer independently executed tests when the evidence came from this implementation session.

---

# 13. Required final report

Create or update:

`docs/reports/M3_FINAL_REMEDIATION_VERIFICATION_REPORT.md`

Also update:

`docs/reports/M3_FINAL_ACCEPTANCE_AUDIT.md`

The final report must include the following sections.

## A. Executive disposition

Choose exactly one:

- READY FOR FINAL FOUNDER AUDIT
- PARTIALLY COMPLETE
- BLOCKED

Do not use READY FOR FINAL FOUNDER AUDIT unless every required M3 remediation and verification gate has passed or is explicitly accounted for by an approved exception.

Do not use ACCEPTED or COMPLETE as a substitute for Founder acceptance.

## B. M3 findings matrix

| Finding | Required result | Evidence | Status |
|---|---|---|---|
| M3-001 | Dashboard actions verified | Tests and source | |
| M3-002 | Activity page/API verified | Tests and source | |
| M3-003 | Profile behavior verified | Tests and source | |
| M3-004 | Transactional nonce security verified | Security and cross-process tests | |
| M3-005 | Authorization responses verified | API tests | |
| M3-006 | Settings behavior verified | Frontend tests | |
| M3-007 | Full test reliability verified | Actual test output | |
| M3-008 | Reports reconciled | Current report HEAD | |
| M3-009 | Responsive/accessibility verified | Playwright and axe evidence | |

## C. Founder nonce security

Document:

- Old implementation removed.
- New database architecture.
- Transaction behavior.
- Unique constraint.
- Error and corruption handling.
- Persistent database path.
- Legacy nonce migration.
- Bootstrap order.
- Private-key handling.
- Cross-process concurrency results.
- Crash/restart results.
- Main database recreation results.

## D. Test evidence

Give exact:

- Commands.
- Exit codes.
- Passed tests.
- Failed tests.
- Skipped tests.
- Duration, where available.

## E. Accessibility evidence

Give:

- Actual route inventory.
- Viewport matrix completion.
- axe-core totals and severity breakdown.
- Keyboard verification results.
- Four documented contrast exceptions.
- Any remaining limitation.

## F. Change inventory

List every modified, created, and deleted file with a concise reason.

Identify any changes that were intentionally not made.

## G. Remaining risks

List every unresolved security, functional, regression, or accessibility finding.

Do not conceal known failures.

## H. Acceptance recommendation

State whether the implementation is ready for final Founder review.

Explicitly state:

**M3 has not been formally accepted. Founder approval is still required.**

---

# 14. Definition of done

This remediation is ready for final Founder audit only when all of the following are true:

- [ ] Work remained on `refactor/repository-structure`.
- [ ] `master` was not modified.
- [ ] The previous lease-based nonce-locking mechanism has been removed.
- [ ] Nonces are stored in a persistent independent SQLite database.
- [ ] Nonce consumption is protected by one complete immediate SQLite transaction.
- [ ] SQLite enforces nonce uniqueness.
- [ ] Legacy nonce history has been safely migrated or is explicitly blocked pending reconciliation.
- [ ] No silent JSONL or in-memory fallback exists.
- [ ] Both bootstrap scripts verify authorization before target database creation/opening.
- [ ] Bootstrap verification uses only the Founder public key.
- [ ] No bootstrap script generates its own Founder signature.
- [ ] Actual production nonce code is tested by independent child processes.
- [ ] Identical nonce concurrency permits exactly one success.
- [ ] Distinct nonce concurrency succeeds.
- [ ] Crash and rollback behavior is verified.
- [ ] Restart persistence is verified.
- [ ] Main application database recreation does not reset replay protection.
- [ ] Corrupt and unavailable nonce databases fail closed.
- [ ] Invalid and missing signatures leave the target database unopened.
- [ ] Dashboard unauthorized styling changes are removed.
- [ ] Browser-native Ctrl/Cmd+R and Ctrl/Cmd+N shortcuts are not intercepted.
- [ ] M3-001 through M3-006 regression checks pass or have explicitly documented blockers.
- [ ] M3-007 full backend/frontend verification is completed.
- [ ] M3-008 reports reference the actual final HEAD.
- [ ] M3-009 route/viewport, axe-core, and keyboard coverage is completed.
- [ ] Approved palette, colors, themes, design tokens, and typography remain unchanged.
- [ ] All executed quality gates and exit codes are accurately reported.
- [ ] No production DB, production migration, M4, commit, push, merge, deployment, or destructive Git operation was performed.

---

# 15. Final execution instructions

Execute the implementation and verification work in the authorized branch.

Do not stop after creating a plan or reporting the problems already known.

Do not ask for approval for ordinary, non-destructive code changes inside this authorized M3 scope.

If an operation would cross one of the explicit safety boundaries, do not perform it. Document the blocker instead.

Preserve all unrelated user changes.

At completion, provide:

1. Executive disposition.
2. Actual final HEAD SHA and branch.
3. Files changed.
4. Summary of the transactional SQLite implementation.
5. Legacy nonce migration status.
6. Founder bootstrap security verification.
7. Cross-process concurrency evidence.
8. Full test results and exit codes.
9. M3-001 through M3-009 status matrix.
10. Remaining blockers or exceptions.
11. Paths to the updated reports.

Do not commit or push.

Do not merge into `master`.

Do not declare M3 accepted.

The final deliverable is an implemented and evidence-backed M3 remediation ready for the Founder's final review.