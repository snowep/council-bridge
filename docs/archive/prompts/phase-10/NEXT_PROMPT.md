# COUNCIL BRIDGE — COMPLETE M3 FINAL REMEDIATION
## M3-004 + M3-007 + M3-008 + M3-009
### Implementation, Security Hardening, Testing, Documentation and Final Acceptance Preparation

**Repository:** `C:\Projects\council-bridge`  
**GitHub:** `snowep/council-bridge`  
**Branch:** `refactor/repository-structure`  
**Starting reference commit:** `1dc512de3f6c7a02a23e69b49e353f012d572098`  
**Scope:** M3 remediation only.  
**Goal:** Complete all remaining M3 requirements so the Founder can perform the final M3 acceptance and authorize M4.

---

# 0. YOUR MISSION

You are implementing the remaining M3 corrections in Council Bridge.

Do not produce another theoretical roadmap.

Inspect the actual repository, identify the current code, edit the necessary files, implement the fixes, run the tests, fix failures, and produce accurate verification reports.

The four work areas are:

1. M3-004: Database seeding security and Founder authorization.
2. M3-007: Test reliability and regression verification.
3. M3-008: Final documentation and evidence reconciliation.
4. M3-009: Responsive design and accessibility verification.

**The objective is a working, verified M3 implementation—not merely documentation claiming completion.**

Do not begin M4.

---

# 1. MANDATORY INITIAL INSPECTION

Before modifying anything:

1. Open the repository.
2. Run `git status --short`.
3. Run `git branch --show-current`.
4. Run `git log -5 --oneline --decorate`.
5. Record the actual HEAD commit.
6. Compare the current HEAD with `1dc512de3f6c7a02a23e69b49e353f012d572098`.
7. Inspect all uncommitted modifications.
8. Identify files modified by the Founder or other developers.
9. Preserve all existing user changes.
10. Never reset, discard, overwrite or clean unrelated changes.

If the current branch or commit differs from the reference commit, do not switch branches or reset history. Work from the actual current HEAD and explain the difference in the final report.

Create an initial inventory of:

- Founder authentication implementation.
- Nonce storage implementation.
- Database seeding guard.
- Every bootstrap entry point.
- Existing security tests.
- Backend test configuration.
- Frontend test configuration.
- Playwright configuration.
- Existing accessibility tests.
- Existing M3 reports.

Do not assume paths in previous audit reports are correct. Find the actual files.

---

# 2. M3-004 — DATABASE SEEDING SECURITY

## 2.1 Fix the two-stage Founder authorization architecture

Relevant files to inspect:

- `src/auth/founder.ts`
- `src/security/database-seeding-guard.ts`
- `scripts/bootstrap-signed.ts`
- `scripts/run-bootstrap.ts`
- `scripts/bootstrap-database.ts`
- Every other script that invokes Founder authorization or seeds the database.

First locate these functions:

- `verifyFounderOperation()`
- `verifyFounderOperationBeforeBootstrap()`
- `checkAndConsumeNonce()`
- File-based nonce storage functions.
- SQLite nonce persistence functions.
- `loadFounderKeyPair()`
- `setDatabaseInstance()`

Do not create duplicate authorization implementations.

Maintain a single authoritative Founder signature verification implementation.

### Required authorization sequence

Production bootstrap must follow this exact sequence:

1. Read the requested database path.
2. Validate the database path.
3. Load the Founder public verification key.
4. Validate required signature environment variables.
5. Validate the operation identifier.
6. Validate the signed payload.
7. Validate the timestamp.
8. Verify the cryptographic signature.
9. Atomically reserve and persist the nonce in the pre-bootstrap nonce store.
10. Only after all preceding steps succeed, create/open the target database.
11. Initialize the SQLite database instance.
12. Persist or reconcile nonce state into SQLite if required by the existing architecture.
13. Execute the authorized bootstrap operation.
14. Record the operation result.

Never open the target database before successful authorization.

Never generate a Founder signature inside a bootstrap script.

Never load the Founder's private key just to verify a signature.

Use the public verification key for verification.

Preserve the existing signature format and canonical payload contract unless an interoperability defect is demonstrated.

## 2.2 Harden the file-based nonce store

Find the existing file-based nonce store in `src/auth/founder.ts`.

Modify that implementation rather than introducing a second competing store.

The nonce store must satisfy all requirements below.

### A. Missing nonce file

When the nonce file does not exist:

- Initialize a valid empty nonce store.
- Create its parent directory if necessary.
- Use restrictive file permissions.
- Ensure the directory and file are not writable by unrelated users where the platform supports permission controls.

### B. Corrupt nonce file

When the file exists but contains invalid JSON or invalid structure:

- Reject authorization.
- Do not treat the store as empty.
- Do not automatically delete the file.
- Do not overwrite the file.
- Produce an explicit security error.
- Require an explicit recovery procedure.

### C. File read errors

If the file cannot be read:

- Reject authorization.
- Do not continue without replay protection.
- Report the underlying filesystem error without exposing secrets.

### D. File write errors

If nonce persistence fails:

- Reject authorization.
- Do not continue to database creation.
- Do not return successful authorization.
- Do not silently ignore the error.

### E. Atomic persistence

Implement safe atomic writes:

1. Write the new state to a temporary file in the same directory.
2. Flush the temporary file where supported.
3. Close the file.
4. Atomically rename it over the target file.
5. Verify the resulting state where practical.

Never expose a partially written nonce file.

### F. Cross-process concurrency

A JavaScript `Set` is insufficient because separate Node.js processes do not share memory.

Implement an atomic cross-process reservation mechanism.

Use one of:

- A reliable filesystem lock with exclusive creation and stale-lock recovery; or
- A transactional durable store that is independent of the target database.

The mechanism must:

- Prevent two concurrent processes from consuming the same nonce.
- Avoid deleting a lock owned by another process.
- Handle process crashes.
- Detect stale locks safely.
- Use bounded waiting and explicit timeout errors.
- Never fall back to an unlocked write.

Prefer a well-maintained existing dependency if one is already installed.

Do not add Redis or another external infrastructure dependency.

### G. Nonce persistence across restarts

The file-based nonce store must survive:

- Application restarts.
- Bootstrap process restarts.
- Database recreation.
- SQLite deletion or restoration.

Do not clear the file-based nonce history during ordinary bootstrap.

Keep nonce expiration behavior consistent with the existing security policy.

If expired nonce cleanup exists, ensure it cannot accidentally remove active reservations or weaken replay protection.

### H. File location

Inspect how the nonce-store path is currently determined.

Use one documented, deterministic location.

Do not place the production nonce store inside a database directory that may be recreated or deleted.

Reject unsafe path configurations.

Do not expose the nonce file path through browser APIs.

## 2.3 Correct SQLite nonce reconciliation

Inspect the current SQLite nonce table and persistence logic.

Preserve existing schema compatibility.

Requirements:

- No duplicate nonce acceptance.
- No race conditions.
- No silent write failures.
- No clearing the durable file store after SQLite synchronization.
- No accepting a nonce simply because SQLite is unavailable.
- No bypassing replay protection during database initialization.

Use transactional insertion and unique constraints where supported.

If SQLite synchronization fails, do not continue to seed.

Ensure that recovery does not accidentally permit replay.

## 2.4 Fix Founder key-loading and global state

Inspect `loadFounderKeyPair()` and all module-level Founder key state.

Production signature verification must not require the Founder private key.

Separate verification-key loading from signing-key loading.

Recommended separation:

- `loadFounderPublicKey()` — verification only.
- `loadFounderPrivateKey()` — signing only, restricted to explicitly authorized signing workflows.
- `verifyFounderSignature()` — pure cryptographic verification.
- `reserveFounderNonce()` — durable replay protection.

Do not rename public functions unnecessarily if other modules depend on them.

Ensure missing public keys fail closed.

Ensure an invalid key ID cannot silently fall back to another identity.

## 2.5 Update bootstrap entry points

### File: `scripts/bootstrap-signed.ts`

Find the existing `verifyFounderOperationBeforeBootstrap()` call.

Confirm that it executes before any target database operation.

Expected logical structure:

```ts
const databasePath = validateDatabasePath();

const authorization = await verifyFounderOperationBeforeBootstrap({
  operation: 'bootstrap',
  signature: process.env.FOUNDER_SIGNATURE,
  timestamp: process.env.FOUNDER_TIMESTAMP,
  nonce: process.env.FOUNDER_NONCE,
});

const db = createDatabase(databasePath);
setDatabaseInstance(db);

await synchronizeFounderNonce(authorization);

await executeBootstrap(db);
```

This is illustrative. Adapt to the real interfaces and existing architecture.

Do not blindly paste code with incompatible function signatures.

### File: `scripts/run-bootstrap.ts`

Apply the same authorization order.

Specifically remove any code that:

- Opens the database before authorization.
- Generates a signature internally.
- Initializes a Founder private key for verification.
- Continues when signature variables are missing.
- Ignores nonce persistence errors.

### File: `scripts/bootstrap-database.ts`

Determine whether this script performs seeding or only ordinary database initialization.

Keep ordinary database initialization separate from production seeding authorization.

Do not accidentally require a Founder seeding signature for normal server startup.

Production server startup must still support its explicitly authorized persistent database path.

Production seeding must require the additional Founder authorization.

## 2.6 Path security

File: `src/security/database-seeding-guard.ts`

Inspect:

- `resolveCanonicalPath()`
- `validateDatabaseTarget()`
- `validateSeedDatabasePath()`
- Production allowlist matching.
- Symlink resolution.
- Environment variable conflict checks.

Required behavior:

- Exact allowlist match or descendant match only.
- Never allow an authorized parent directory to authorize its parent.
- Case-insensitive comparison on Windows.
- Canonicalize existing path components.
- Resolve symlinked ancestors.
- Correctly handle nonexistent nested target directories.
- Reject traversal.
- Reject ambiguous paths.
- Reject missing production paths.
- Reject `:memory:` in production seeding.
- Keep development and test allowlists explicit.
- Do not introduce permissive default development paths.
- Detect conflicting database path environment variables.

The canonicalization algorithm must resolve the nearest existing ancestor using real filesystem resolution and safely append the remaining nonexistent path segments.

Do not rely on string normalization alone to claim symlink protection.

Add tests for:

- Existing symlink.
- Symlinked parent.
- Nonexistent nested directory beneath a symlink.
- Parent-directory authorization attempt.
- Exact allowed path.
- Allowed descendant.
- Sibling directory rejection.
- Windows drive-letter casing.
- Windows separator variations.
- Relative traversal.
- Conflicting environment variables.

## 2.7 Required M3-004 tests

Add tests to the existing security test locations. Do not invent a duplicate test framework.

Test the following:

| Test | Expected |
|---|---|
| Valid external signature | Accepted |
| Missing signature | Rejected |
| Invalid signature | Rejected |
| Invalid operation | Rejected |
| Invalid payload | Rejected |
| Expired timestamp | Rejected |
| Malformed timestamp | Rejected |
| Missing public key | Rejected |
| Invalid key ID | Rejected |
| Reused nonce | Rejected |
| Corrupt nonce file | Rejected |
| Unreadable nonce file | Rejected |
| Unwritable nonce file | Rejected |
| Concurrent identical requests | Exactly one succeeds |
| Restart and replay | Rejected |
| Database recreation and replay | Rejected |
| Invalid signature creates database | No |
| Missing signature creates database | No |
| Nonce write failure creates database | No |
| Valid signature creates database | Yes, only after authorization |

Use isolated temporary directories for tests.

Never use the real production database in security tests.

Do not weaken assertions to make tests pass.

---

# 3. M3-007 — TEST RELIABILITY AND COMPLETE REGRESSION

## 3.1 Fix Founder key global-state isolation

Investigate the reported failing test:

`should get founder key id`

Find its actual location using repository search.

Trace all tests that modify:

- Founder public key.
- Founder private key.
- Founder key ID.
- Founder configuration.
- Nonce storage path.
- Database instance.

Do not simply classify the failure as pre-existing.

Implement reliable isolation.

Preferred approach:

1. Remove mutable global state where practical.
2. Use dependency injection for key configuration and nonce storage.
3. Otherwise expose an explicit test-only reset function.
4. Restore original state in `afterEach`.
5. Ensure tests cannot run concurrently when they share mutable module state.
6. Keep production behavior unchanged.

Do not skip the failing test.

Do not change its assertion to make it pass.

Do not globally disable test concurrency unless the affected suite genuinely requires isolation.

## 3.2 Fix Playwright runtime monitoring

File:

`frontend/tests/e2e/phase10-verification.spec.ts`

Inspect every test and shared hook.

Register listeners before the first navigation.

Collect:

- Uncaught page exceptions.
- Console errors.
- Failed network requests.
- Unexpected HTTP 4xx responses.
- Unexpected HTTP 5xx responses.

Do not ignore all errors.

Do not use `.catch(() => {})` around assertions.

Do not suppress errors simply because they are inconvenient.

Expected errors must be explicitly listed by exact route, HTTP status and reason.

Use exact pathname comparisons rather than broad `startsWith()` checks.

Avoid treating every third-party or intentionally aborted request as an application failure, but document every exception.

## 3.3 Route coverage

Test the actual application routes.

The current target set is:

1. Dashboard.
2. Chat.
3. Council.
4. Meetings.
5. Memory.
6. Organization.
7. Tasks.
8. Executions.
9. Deliverables.
10. Approvals.
11. Activity.
12. Profile.
13. Settings.

Verify these against the actual router before writing tests.

For every route:

- Navigate directly.
- Confirm the exact pathname.
- Confirm the expected page heading or unique page landmark.
- Confirm the page is not blank.
- Confirm loading indicators settle.
- Confirm no unexpected browser exceptions.
- Confirm no unexpected server errors.
- Confirm no broken primary navigation.

Do not use generic assertions that only prove some heading exists.

Do not accept a 404 as a successful route test.

## 3.4 Required regression suites

Run the existing project scripts for:

- Backend unit tests.
- Backend integration tests.
- Security tests.
- Database migration tests.
- Frontend unit tests.
- Frontend integration tests.
- MCP integration tests.
- Playwright browser E2E.
- Responsive tests.
- Accessibility tests.
- TypeScript.
- ESLint.
- Prettier.
- Production build.

Inspect `package.json` and workspace scripts before choosing commands.

Do not invent commands.

Do not claim a suite passed when it did not execute.

Do not report a successful test run if the process timed out or returned a nonzero exit code.

Record:

- Exact command.
- Start and end status.
- Exit code.
- Passed count.
- Failed count.
- Skipped count.
- Duration.
- Relevant error output.

If SQLite locking occurs under parallel execution, isolate test databases and correct the shared-resource problem. Use serial execution for the affected database suite only when necessary and document why.

---

# 4. M3-008 — FINAL DOCUMENTATION RECONCILIATION

## 4.1 Inspect all existing M3 documentation

Find and inspect:

- M3 roadmap.
- M3 acceptance criteria.
- Wave 0 report.
- Wave 1–6 reports.
- M3 remediation reports.
- Database seeding security report.
- Test reliability report.
- Accessibility report.
- Previous final acceptance reports.
- `NEXT_PROMPT.md` and archived prompts.

Do not delete historical reports.

Do not rewrite history.

## 4.2 Create one authoritative final report

Create:

`docs/reports/M3_FINAL_ACCEPTANCE_AUDIT.md`

Required sections:

1. Executive summary.
2. Actual repository HEAD.
3. Actual branch.
4. Working tree status.
5. Scope and exclusions.
6. M3-001 through M3-009 findings matrix.
7. M3-004 security architecture.
8. Database seeding entry-point inventory.
9. Founder authorization sequence.
10. Nonce replay protection design.
11. M3-007 test inventory.
12. Exact test commands and results.
13. Frontend E2E route coverage.
14. M3-009 viewport coverage.
15. Accessibility results.
16. Known exceptions and limitations.
17. Regression results.
18. Security regression results.
19. Unresolved issues.
20. Final recommendation to Founder.

For every test result, include actual evidence.

Never copy old test counts into the new report.

Never claim independent verification for tests that were only reported by someone else.

## 4.3 Reconcile the old reports

Correct:

- Stale commit hashes.
- Incorrect test counts.
- Contradictory completion statements.
- Incorrect route counts.
- Claims of WCAG compliance unsupported by actual evidence.
- Claims that invitations were delivered when only pending records were created.
- Reports that describe uncommitted changes as committed.

Mark superseded reports as historical where appropriate.

Keep one authoritative final M3 report.

---

# 5. M3-009 — RESPONSIVE AND ACCESSIBILITY VERIFICATION

## 5.1 Mandatory visual-design boundary

This is a strict restriction.

Do not modify:

- Existing colors.
- Color palette.
- Theme definitions.
- Design tokens.
- Typography.
- Approved font configuration.
- Impeccable-approved visual styling.

You may modify:

- Layout.
- Component arrangement.
- Spacing.
- Responsive breakpoints.
- Navigation behavior.
- Overflow handling.
- Component sizing.
- Keyboard interaction.
- Focus behavior.
- Semantic HTML.
- Accessible labels.
- Form behavior.

Use existing MUI 9 components.

Do not replace the existing design system.

Do not introduce generic AI dashboard styling.

## 5.2 Required routes and viewport matrix

Verify all 13 routes:

- Dashboard.
- Chat.
- Council.
- Meetings.
- Memory.
- Organization.
- Tasks.
- Executions.
- Deliverables.
- Approvals.
- Activity.
- Profile.
- Settings.

At these five viewport widths:

| Viewport | Width |
|---|---:|
| Mobile | 375 |
| Tablet | 768 |
| Small desktop | 1024 |
| Desktop | 1440 |
| Wide desktop | 1920 |

Total required route/viewport combinations: 65.

Do not navigate to the root page and claim all routes were tested.

Each combination must navigate to the actual route.

## 5.3 Responsive assertions

For every route and viewport:

- Verify page content is visible.
- Verify the main page container is visible.
- Verify no horizontal document overflow.
- Verify no clipped primary actions.
- Verify navigation remains usable.
- Verify dialogs fit within the viewport.
- Verify tables and long content remain accessible.
- Verify forms remain usable.
- Verify the page does not become blank.
- Verify there are no uncaught runtime exceptions.

Use real browser measurements.

Do not use arbitrary fixed-width assertions that reject valid responsive layouts.

## 5.4 Keyboard testing

Test:

- Tab navigation.
- Shift+Tab navigation.
- Visible focus.
- Enter activation.
- Space activation.
- Escape dismissal.
- Dialog focus entry.
- Dialog focus containment.
- Focus restoration after dialog close.
- Menu keyboard operation.
- Form field access.
- Switch operation.
- Disabled control behavior.

Do not merely assert that `document.activeElement` exists.

Assert that focus moves to the expected element and that keyboard interactions produce the expected behavior.

## 5.5 axe-core accessibility tests

Use the existing Playwright setup.

If axe-core is already installed, reuse it.

Otherwise install only the minimum necessary compatible development dependency.

Run accessibility scans on all 13 routes.

Also scan important interactive states:

- Dashboard dialogs.
- Navigation menus.
- Settings controls.
- Profile page.
- Forms.
- Other modal interactions.

Record:

- Violation ID.
- Impact.
- Affected selector.
- Description.
- Number of occurrences.
- Resolution or exception.

Fix critical and serious violations where possible without changing approved visual styling.

The four previously documented serious color-contrast exceptions must remain documented if resolving them requires changing approved colors.

Do not silently suppress them.

Do not claim complete WCAG 2.2 AA compliance while serious violations remain.

## 5.6 Fix functional accessibility problems

Explicitly inspect:

- Settings switches and accessible names.
- Profile read-only fields.
- Buttons without accessible names.
- Icon-only controls.
- Dialog labels.
- Form labels.
- Input descriptions.
- Error announcements.
- Focus visibility.
- Navigation landmarks.
- Heading hierarchy.

Use MUI-supported accessibility props.

Do not create custom CSS unless necessary for functional accessibility or layout behavior.

---

# 6. PRESERVE EXISTING FUNCTIONALITY

Run regression tests for the already completed M3 work:

- Dashboard Create Division action.
- Dashboard Invite Staff action.
- New Task action.
- Activity page.
- Activity API integration.
- Profile read-only behavior.
- Settings persistence.
- Settings Cancel behavior.
- Authorization errors returning 403.
- Database seeding safety instructions.

Do not regress previously implemented M3 functionality.

Do not claim a staff invitation was delivered unless an actual delivery mechanism exists.

Do not introduce unrelated feature work.

---

# 7. STRICT M4 BOUNDARY

M4 is NOT authorized during this task.

Do not implement:

- Organization bootstrap.
- Six-division population.
- Six Division Heads.
- Forty-five specialists.
- Fifty-one logical division staff identities.
- One hundred and two runtime instances.
- Council seat changes.
- Persona changes.
- New agent provisioning.
- Cross-division integration.
- M4 orchestration.
- M4 reliability architecture.
- New production integrations.

Do not modify production database records.

Do not execute production migrations.

Do not seed the production database.

Do not modify Council membership.

Do not modify Founder identity or governance rules.

M3 is strictly a completion and verification task.

---

# 8. GIT AND PRODUCTION SAFETY

You are authorized to edit files locally for M3 remediation.

You are NOT authorized to:

- Commit.
- Push.
- Merge.
- Deploy.
- Force-push.
- Rewrite Git history.
- Delete branches.
- Delete user files.
- Reset the working tree.
- Modify production database records.
- Run production migrations.
- Run production seeding.
- Delete `.secrets/archive`.
- Remove historical evidence.

Preserve all uncommitted user changes.

Do not run destructive cleanup commands.

Do not expose secrets in logs or reports.

---

# 9. IMPLEMENTATION ORDER

Execute in this order.

### Stage 1 — M3-004

1. Fix public-key verification.
2. Fix durable file nonce storage.
3. Fix cross-process nonce locking.
4. Fix fail-closed error handling.
5. Fix nonce synchronization.
6. Fix bootstrap ordering.
7. Fix path canonicalization.
8. Add security tests.
9. Run all security tests.

Do not proceed to claim M3-004 complete until all security tests pass.

### Stage 2 — M3-007

1. Fix Founder global-state test isolation.
2. Fix Playwright monitoring.
3. Fix route assertions.
4. Fix HTTP response classification.
5. Run backend tests.
6. Run frontend tests.
7. Run MCP E2E.
8. Run browser E2E.
9. Run TypeScript, lint, formatting and production build.

### Stage 3 — M3-009

1. Implement actual 13-route × 5-viewport tests.
2. Fix responsive layout failures.
3. Implement meaningful keyboard tests.
4. Run axe-core.
5. Fix functional accessibility violations.
6. Document approved contrast exceptions.
7. Produce the final verification report.

### Stage 4 — M3-008

1. Reconcile all findings.
2. Reconcile test counts.
3. Reconcile current Git state.
4. Update historical reports.
5. Create `M3_FINAL_ACCEPTANCE_AUDIT.md`.
6. Verify every report matches the actual code and test results.

### Stage 5 — Final quality gate

Run all required tests again after the final code changes.

Do not rely on results from before the last modification.

Check the Git working tree.

Confirm no M4 implementation occurred.

---

# 10. REQUIRED DELIVERABLES

Produce these reports:

1. `docs/reports/M3_DATABASE_SEEDING_SECURITY_REPORT.md`
2. `docs/reports/M3_TEST_RELIABILITY_REPORT.md`
3. `docs/reports/M3_ACCESSIBILITY_RESPONSIVE_REPORT.md`
4. `docs/reports/M3_FINAL_ACCEPTANCE_AUDIT.md`

Also maintain the relevant test files and actual implementation.

The reports must reflect actual evidence, not intended behavior.

---

# 11. FINAL ACCEPTANCE CONDITIONS

M3 may be recommended for Founder acceptance only when:

- M3-001 is verified.
- M3-002 is verified.
- M3-003 is verified.
- M3-004 security implementation and tests pass.
- M3-005 is verified.
- M3-006 is verified.
- M3-007 regression and test reliability are verified.
- M3-008 documentation is reconciled.
- M3-009 responsive and accessibility verification is complete.
- No critical security defect remains.
- No unexplained failing required test remains.
- TypeScript passes.
- Production build passes.
- Git state is accurately documented.
- No M4 implementation occurred.

A known pre-existing failure is not automatically acceptable. Investigate it, isolate it, establish its cause and prove it does not invalidate the required test coverage.

Do not declare a milestone accepted on the Founder's behalf.

---

# 12. FINAL RESPONSE FORMAT

When finished, provide:

## A. Implementation summary
List every file changed and what changed.

## B. Security results
Explain the exact Founder verification and nonce lifecycle.

## C. Test results
Provide a table:

| Suite | Passed | Failed | Skipped | Exit code |
|---|---:|---:|---:|---:|

## D. Responsive results
Report the actual number of route/viewport combinations executed and passed.

## E. Accessibility results
Report axe-core violations by impact and list approved exceptions.

## F. Documentation
List the four completed reports.

## G. Git state
Report actual branch, HEAD, changed files and uncommitted changes.

## H. Remaining issues
List only genuine unresolved issues.

## I. Final disposition

Choose exactly one:

- READY FOR FINAL FOUNDER ACCEPTANCE
- PARTIALLY COMPLETE — SPECIFIC CORRECTIONS REMAIN
- BLOCKED — SECURITY OR RELIABILITY DEFECTS REMAIN

Do not claim M3 acceptance.

Do not begin M4.

**Execute the implementation now. Do not stop after producing an audit or another plan.**