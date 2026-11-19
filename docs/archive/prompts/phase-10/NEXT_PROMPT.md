# Claude Code — Council Bridge M3 Remaining Remediation & Final Verification

**Repository:** `C:\Projects\council-bridge`  
**GitHub:** `https://github.com/snowep/council-bridge`  
**Branch:** `refactor/repository-structure`  
**Expected starting commit:** `ad96464f0f13303d1695777f99d5e7e7f1f3d81f`  
**Scope:** Remaining M3 findings only  
**Objective:** Correct the outstanding database-seeding security defects, complete reliable test verification, resolve accessibility violations, verify all responsive page/viewport combinations, and produce an accurate final M3 audit report.

---

# 1. Execution mandate

Execute the remaining remediation and verification. Do not return another plan instead of implementing the work.

The previous audit of `ad96464` identified unresolved issues in:

- M3-004 — Database-seeding security.
- M3-007 — Test reliability and incomplete full-suite verification.
- M3-009 — Responsive and accessibility verification.
- M3-008 — Documentation and commit/evidence reconciliation.

Perform a regression check of M3-001 through M3-006 as well.

The audit findings are evidence to investigate, not permission to blindly modify code. Verify each issue against the current HEAD first.

## Initial inspection — mandatory

Before making changes:

1. Run `git status --short --branch`.
2. Record the current HEAD SHA.
3. Confirm `ad96464f0f13303d1695777f99d5e7e7f1f3d81f` is an ancestor of HEAD.
4. Inspect staged, unstaged, and untracked changes.
5. Preserve every existing user modification.
6. Inspect the complete relevant source, reports, scripts, tests, package scripts, and CI workflows.
7. Reconcile the previous audit observations against current source.
8. Record the baseline state and any existing failures.

If the expected commit is not an ancestor of HEAD, stop and report the discrepancy. Do not reset or rewrite history.

Do not delete, clean, stash, overwrite, or revert user work.

---

# 2. M3-004 — Fix database-seeding security

## 2.1 Centralized guard

Inspect:

`src/security/database-seeding-guard.ts`

The previous audit identified five specific weaknesses:

1. In-memory databases are permitted in development/test.
2. Path authorization uses substring matching.
3. The default development allowlist includes `data/council.db` without proving isolation.
4. Conflicting environment variables and overrides are not adequately validated.
5. Symlink validation is incomplete.

Fix all five.

## 2.2 In-memory database rejection

Reject `:memory:` and all implicit or unsupported in-memory database targets for seeding.

Do not allow a development or test environment to bypass this rule.

If an existing test legitimately requires an in-memory database for a non-seeding operation, preserve that behavior outside the seeding guard. Do not weaken unrelated database functionality.

Add tests proving the seeding guard rejects:

- `:memory:`
- Equivalent URI-based in-memory targets.
- Empty or implicit targets.
- Unsupported temporary database targets.

## 2.3 Canonical path and directory-boundary validation

Remove substring-based path authorization.

Do not authorize paths with logic equivalent to:

`canonicalPath.includes(allowedPath)`

Instead:

- Resolve the target to a canonical absolute path.
- Resolve the approved directory independently.
- Compare actual path components.
- Require the target to be a descendant of the approved directory, or an explicitly approved exact file.
- Prevent prefix collisions such as `/safe/dev` versus `/safe/dev-backup`.
- Handle Windows drive letters, path separators, case behavior, relative paths, and traversal.
- Reject paths that cannot be canonicalized safely.
- Verify the final target and relevant parent directories.

A path being named `dev`, `test`, or containing those words is not proof that it is safe.

## 2.4 Remove unsafe default allowlists

Inspect the current default allowlist, including:

`data/council.db`

Do not assume that a default development database path is isolated.

Remove ambiguous operational defaults from the seeding authorization policy.

Require an explicit approved development/test target with a verified canonical location.

Do not authorize a database merely because `NODE_ENV` is `development` or `test`.

The guard must positively establish both:

1. The environment is explicitly authorized.
2. The canonical database target belongs to an approved isolated development/test location.

Unknown or ambiguous targets must be rejected.

## 2.5 Environment-variable and override conflicts

Inventory every database-path configuration source:

- `DATABASE_PATH`
- `DB_PATH`
- `SQLITE_PATH`
- Project-specific database variables.
- CLI arguments.
- Script-specific overrides.
- Configuration files.
- Environment-specific defaults.

Use the actual names discovered in the repository.

If multiple configuration sources are supplied and conflict, reject the operation.

Do not silently prefer one variable or CLI argument when another points elsewhere.

Ensure command-line arguments cannot override a rejected operational target.

Ensure the guard evaluates the effective target used by the actual database connection, not merely a separate validation variable.

Add tests for:

- Missing variables.
- Empty variables.
- Conflicting variables.
- Conflicting CLI and environment values.
- Unsupported overrides.
- Explicitly authorized isolated targets.

## 2.6 Symlink and path traversal protection

Use filesystem-aware canonical resolution.

Verify all relevant path components, including:

- Existing parent directories.
- Existing database files.
- Symbolic links.
- Relative path components.
- Traversal sequences.
- Canonical aliases.

Do not rely on checking only the immediate parent directory.

If the target does not exist yet, validate the nearest existing ancestor and ensure that the eventual target remains within the approved directory.

Prevent symlink-based escape from the approved directory.

Where race conditions between validation and file creation are relevant, use appropriate safe filesystem operations and revalidation. Do not claim complete race protection if the implementation does not provide it.

## 2.7 Guard every actual seeding entry point

The previous remediation reported sixteen protected entry points and modified twenty-three scripts.

Re-inventory the current repository and verify every real entry point.

The guard must run before:

- Opening a database connection.
- Creating a database file.
- Creating directories.
- Running migrations.
- Creating tables.
- Inserting or replacing records.
- Updating or deleting records.
- Running cleanup/reset operations.

Test actual command entry points, not only the guard module.

A test that directly invokes the guard function is insufficient to prove that every CLI script enforces it.

For every entry point, document:

| Entry point | Effective DB target | Guard imported | Guard runs before DB access | Tests |
|---|---|---|---|---|

If an entry point cannot safely be classified, reject it rather than guessing.

## 2.8 Security test matrix

Add or update tests for:

| Scenario | Expected result |
|---|---|
| Production environment | Reject |
| Missing path | Reject |
| Empty path | Reject |
| Unknown path | Reject |
| `:memory:` | Reject |
| URI in-memory target | Reject |
| Conflicting environment variables | Reject |
| Conflicting CLI/environment targets | Reject |
| Operational database path | Reject |
| Relative path to operational database | Reject |
| Path traversal | Reject |
| Prefix collision | Reject |
| Symlink to operational database | Reject |
| Symlink escaping approved directory | Reject |
| Canonical path alias | Reject |
| Unapproved development path | Reject |
| Explicit isolated development path | Accept |
| Explicit isolated test path | Accept |
| Repeated safe seed | Deterministic and idempotent |

Also prove:

- Rejected targets are not opened.
- Rejected targets are not modified.
- No database file is created for rejected targets.
- No directory is created for rejected targets.
- Every real seeding entry point invokes the guard before database access.
- Errors are actionable and do not disclose secrets.

Use disposable directories and temporary databases.

Never use the real production database for these tests.

## 2.9 M3-004 acceptance

Mark RESOLVED only when:

- All five audited weaknesses are corrected.
- Every actual seeding entry point is guarded.
- The guard validates the effective database target.
- The complete security test matrix passes.
- Real entry-point tests pass.
- Documentation matches executable behavior.
- No operational database was accessed or modified during verification.

---

# 3. M3-007 — Complete test reliability verification

## 3.1 Distinguish historical totals from current results

The previous report lists:

- 373 core tests.
- 39 security tests.
- 15 webhook tests.
- 427 reported test executions.

Do not assume these represent 427 distinct tests. Inspect the configured test globs and determine whether test groups overlap.

The earlier report also states that the complete 560-test suite was not completed.

This task must establish the actual configured suite and its actual result.

## 3.2 Audit package scripts and test discovery

Inspect:

- Root `package.json`.
- Backend package scripts.
- Frontend package scripts.
- Test configuration.
- Test file globs.
- CI workflows.
- Shell scripts.
- TypeScript test runners.
- Playwright configuration.

Determine:

1. Which tests are included in `npm run test`.
2. Which test files are excluded.
3. Whether integration tests are accidentally omitted.
4. Whether security and webhook tests are counted more than once.
5. Whether frontend tests are part of the root test command.
6. Whether test failures propagate to the process exit code.

The configured full suite must be the authoritative test target.

Do not change the test command to obtain a smaller passing number.

## 3.3 Resolve duration limitations correctly

The previous full-suite execution stopped because integration tests required approximately thirty seconds each.

Do not solve this by:

- Removing integration tests.
- Reducing assertions.
- Increasing timeouts without investigating.
- Reporting a partial run as a full run.
- Marking unfinished tests as passed.
- Running only the core suite and claiming full completion.

Inspect whether integration tests are unnecessarily serial, leaking resources, or waiting for unnecessary delays.

Where safe, improve test execution efficiency through:

- Proper test isolation.
- Parallel execution where tests are independent.
- Reliable temporary databases.
- Proper server and connection cleanup.
- Removal of unnecessary fixed waits.
- Efficient fixture setup and teardown.

Do not introduce concurrency into tests that share mutable state unless they are isolated first.

If the complete suite cannot be completed within the available environment, report the exact limitation and retain M3-007 as PARTIALLY RESOLVED.

## 3.4 Webhook environment isolation

Recheck:

`hermes-webhook-signature.test.ts`

Verify:

- Environment variables are isolated.
- Original values are restored even if a test fails.
- Tests do not depend on execution order.
- Tests do not depend on `.secrets/archive`.
- Signature verification behavior remains secure.
- Invalid signatures remain rejected.
- Malformed inputs remain rejected.
- Timing-safe comparison is still used appropriately.

Run the webhook tests independently, repeatedly, and as part of the configured full suite.

Do not weaken cryptographic checks.

Do not delete or modify `.secrets/archive`.

Use isolated temporary fixtures when investigating environment interactions.

## 3.5 Exit-code verification

Verify actual test-runner behavior.

Test that:

- A successful test run exits with code `0`.
- A deliberately failing disposable test exits nonzero.
- Unhandled exceptions exit nonzero.
- Rejected promises exit nonzero.
- Shell pipelines preserve the test process exit code.
- CI cannot silently ignore failures.
- Timeouts cannot become successful results.
- Skipped and pending tests are reported accurately.

Remove any temporary deliberate-failure test after verification.

Do not introduce permanent failing fixtures.

## 3.6 Required test execution

Run:

1. Complete configured backend test suite.
2. Backend unit tests.
3. Backend integration tests.
4. Database and migration tests.
5. Authentication and authorization tests.
6. Database-seeding security tests.
7. Hermes webhook tests.
8. Messaging/MCP E2E tests.
9. Frontend unit/component tests.
10. Frontend Playwright E2E tests.
11. Responsive tests.
12. Accessibility tests.
13. TypeScript.
14. ESLint.
15. Formatting check.
16. Production frontend build.
17. Relevant CI-equivalent checks.

Record exact commands, working directories, durations, counts, skipped tests, failures, and actual exit codes.

Separate overlapping test runs. Never add overlapping counts and call them unique tests.

## 3.7 M3-007 acceptance

Mark RESOLVED only when:

- The configured complete suite has actually completed.
- All required tests pass.
- No tests were silently excluded or weakened.
- Webhook isolation is reproducible.
- Success and failure exit codes are verified.
- TypeScript, lint, formatting, and build pass.
- The report includes reproducible evidence.

If the complete suite remains incomplete, mark PARTIALLY RESOLVED.

---

# 4. M3-009 — Fix accessibility and responsive verification

## 4.1 Resolve four serious color-contrast violations

The previous report documented serious color-contrast violations on:

- Organization.
- Tasks.
- Deliverables.
- Approvals.

Do not accept these as an unavoidable MUI system constraint without demonstrating that they cannot be corrected.

Inspect the actual rendered foreground/background combinations in both light and dark themes.

Determine whether the source is:

- MUI default colors.
- Custom theme tokens.
- Disabled-state styling.
- Secondary text.
- Status labels.
- Table cells.
- Buttons.
- Background surfaces.
- Component-level overrides.

Correct the underlying token or component configuration while preserving the established design system.

Use the existing theme architecture and MUI 9 conventions.

Do not hide violations by excluding rules, suppressing selectors, or reducing test coverage.

If a violation genuinely cannot be corrected without an unacceptable architectural change, document the exact technical reason and retain it as an unresolved issue requiring Founder review.

## 4.2 Correct the accessibility test criteria

Inspect the axe-core configuration.

Ensure the tests:

- Execute against actual rendered pages.
- Include applicable WCAG 2.2 AA tags.
- Fail for unresolved critical and serious violations.
- Record moderate and minor violations.
- Do not silently ignore color contrast.
- Do not report success merely because violations were logged.

Do not claim full WCAG 2.2 AA compliance solely from automated axe-core results.

Clearly distinguish automated checks from manual verification.

## 4.3 Verify all thirteen routes

Test these actual application routes:

1. Dashboard.
2. Activity.
3. Chat.
4. Council.
5. Meetings.
6. Memory.
7. Organization.
8. Tasks.
9. Executions.
10. Deliverables.
11. Approvals.
12. Profile.
13. Settings.

Verify the route definitions in the current application before writing the tests.

Each test must:

- Navigate to the actual route.
- Wait for the page to render.
- Verify expected page-specific content.
- Check for application errors.
- Check horizontal overflow.
- Check clipping and overlapping content.
- Check navigation behavior.
- Check page-specific interactive controls.
- Capture failure screenshots or traces where useful.

A test that navigates to `/` does not count as testing another page.

## 4.4 Test all five viewport widths

Use:

- 375px.
- 768px.
- 1024px.
- 1440px.
- 1920px.

Required coverage:

**13 routes × 5 widths = 65 actual page/viewport combinations.**

The test output must identify each route and width.

Do not use a small number of generic root-page tests to claim 65 combinations.

## 4.5 Interactive states

Test relevant application states:

- Main navigation.
- Responsive drawer.
- User menu.
- Theme toggle.
- Create Division dialog.
- Invite Staff dialog.
- New Task workflow.
- Forms.
- Validation errors.
- Settings.
- Profile.
- Tables.
- Empty states.
- Loading states.
- Error states.

Test actual behavior rather than checking only whether elements exist.

## 4.6 Keyboard verification

Test real keyboard interactions:

- Tab.
- Shift+Tab.
- Enter.
- Space.
- Escape.
- Arrow keys where appropriate.

Verify:

- Logical focus order.
- Visible focus indicators.
- Accessible control activation.
- Dialog focus trapping.
- Dialog focus restoration.
- Menu and drawer operation.
- Form navigation.
- No keyboard traps.
- No inaccessible interactive elements.

Assertions must verify expected targets and resulting application state, not merely that `document.activeElement` exists.

## 4.7 M3-009 acceptance

Mark RESOLVED only when:

- All 65 page/viewport combinations are actually executed.
- Relevant interactive states are tested.
- Serious and critical axe-core violations are resolved.
- The four contrast issues are corrected or explicitly remain blockers.
- Keyboard behavior is verified.
- Test results accurately reflect actual execution.
- No unsupported WCAG compliance claim remains.

---

# 5. M3-008 — Reconcile reports and Git evidence

The previous report contained contradictory statements:

- It identified `110cfeb` as the final HEAD.
- It also described the remediation as uncommitted.
- The actual remediation commit under audit is `ad96464`.

Correct these inconsistencies.

The authoritative report must distinguish:

- Starting commit.
- Current HEAD.
- Branch.
- Working-tree state.
- Files modified.
- User-reported historical test results.
- Tests actually executed during this remediation.
- Tests not executed.
- Partial results.
- Confirmed limitations.

Preserve historical reports and their original conclusions where appropriate.

Do not rewrite history or erase evidence of earlier failures.

Update all M3 reports so their claims agree with the current source and actual test outputs.

Required reports:

1. `docs/reports/M3_DATABASE_SEEDING_SECURITY_REPORT.md`
2. `docs/reports/M3_TEST_RELIABILITY_REPORT.md`
3. `docs/reports/M3_ACCESSIBILITY_RESPONSIVE_REPORT.md`
4. `docs/reports/M3_FINAL_REMEDIATION_VERIFICATION_REPORT.md`

The final report must contain a complete M3-001 through M3-009 findings matrix.

Use only these finding statuses:

- RESOLVED
- PARTIALLY RESOLVED
- BLOCKED

Do not mark a finding resolved because a report says it is resolved.

---

# 6. Regression verification — M3-001 through M3-006

Recheck these findings against current source and relevant tests.

| Finding | Verification requirement |
|---|---|
| M3-001 | Dashboard actions execute real workflows. Pending staff registration must not be described as a delivered invitation. |
| M3-002 | Activity route, page, API integration, loading, empty, and error states work. |
| M3-003 | Profile accurately represents read-only or genuinely persisted editing behavior. No fake save. |
| M3-004 | All seeding entry points enforce the executable guard. |
| M3-005 | Correct authorization status codes and fail-closed authentication remain intact. |
| M3-006 | Settings persist correctly, cancellation restores saved values, and controls describe actual functionality. |

Do not refactor these areas unless the audit identifies a concrete regression or defect.

---

# 7. Architecture and design constraints

Preserve the existing architecture:

- React 19.
- Vite.
- TypeScript.
- MUI 9.
- Google's Material Design system.
- Vanilla MUI components.
- Express.
- SQLite.
- Existing authentication and authorization.
- Existing migration architecture.

UI constraints:

- Prefer official MUI components.
- Avoid unnecessary custom components.
- Custom CSS only when genuinely necessary.
- Preserve established theme tokens.
- No generic AI-generated dashboard patterns.
- No unnecessary infrastructure dependencies.
- Do not add Redis.

Do not introduce broad refactors unrelated to the remaining M3 findings.

---

# 8. Absolute M4 prohibition

**Do not start M4.**

This authorization covers M3 remediation only.

Do not:

- Bootstrap six organizational divisions.
- Create six Division Heads.
- Create 45 specialists.
- Create 51 logical division staff identities.
- Create 102 runtime instances.
- Modify Council membership.
- Modify Council voting structure.
- Modify founding or replaceable Council personas.
- Change organizational identity records.
- Implement M4 integration workflows.
- Create M4 migrations.
- Modify production organizational data.
- Begin M4 planning or implementation.

Use isolated test fixtures and disposable databases only.

Do not interpret the existence of seed scripts as permission to execute organizational bootstrap operations.

---

# 9. Production and Git safety

The following actions are prohibited without separate explicit Founder authorization:

- Accessing or modifying the production database for remediation.
- Running production migrations.
- Running production seeding.
- Deleting production records.
- Running production cleanup or reset operations.
- Modifying `.secrets/archive`.
- Deleting user files or data.
- Rewriting Git history.
- Force-pushing.
- Deleting branches.
- Committing.
- Pushing.
- Merging.
- Deploying.

Preserve the current branch and all user changes.

All test databases must be isolated and disposable.

Verify database paths before executing any test or seed command.

If a command might target an operational database, do not execute it.

---

# 10. Final verification sequence

Before finishing:

1. Review the complete diff.
2. Confirm user modifications remain intact.
3. Confirm no secrets were introduced.
4. Confirm all seeding entry points are guarded.
5. Run actual seeding-entry-point security tests.
6. Verify production and operational paths are rejected.
7. Verify rejected targets are not opened or modified.
8. Run the webhook tests independently and within the full suite.
9. Run the complete configured backend test suite.
10. Run the complete frontend test suite.
11. Run all 65 route/viewport combinations.
12. Run axe-core accessibility tests.
13. Run manual keyboard verification.
14. Verify all four contrast issues.
15. Run TypeScript.
16. Run lint.
17. Run formatting checks.
18. Run production build.
19. Record exact exit codes and durations.
20. Verify production database safety.
21. Verify M4 was not started.
22. Verify no Git commit or push occurred.
23. Reconcile all reports with actual evidence.
24. Record final HEAD and working-tree status.

If a test cannot be completed, record it as incomplete. Do not infer a passing result.

---

# 11. Required final response

Return the final results in this structure.

## Execution Summary
- Starting HEAD.
- Final HEAD.
- Branch.
- Working-tree status.
- Files changed.
- User-change preservation.

## M3 Findings Matrix

| Finding | Status | Implementation | Actual verification |
|---|---|---|---|

Include all M3-001 through M3-009.

## M3-004 — Database-Seeding Security
- Total entry points discovered.
- Total entry points protected.
- Guard implementation.
- Canonical path validation.
- Environment validation.
- Symlink handling.
- Security test totals.
- Real entry-point test results.
- Evidence rejected targets were not opened or modified.

## M3-007 — Test Reliability
- Webhook root cause and correction.
- Core test results.
- Security test results.
- Integration test results.
- Full configured backend suite.
- Frontend suite.
- E2E suite.
- Test overlap and unique totals.
- Exit-code verification.
- TypeScript.
- Lint.
- Formatting.
- Build.
- Skipped, pending, and failed tests.

## M3-009 — Accessibility and Responsive
- Thirteen-route verification.
- Five viewport widths.
- All 65 combinations.
- Interactive-state coverage.
- Axe-core results.
- WCAG tags.
- Four contrast violations and final disposition.
- Keyboard results.
- Manual verification.
- Remaining exceptions.

## M3-008 — Documentation
- Reports updated.
- Commit references reconciled.
- Test evidence reconciled.
- Remaining documentation limitations.

## Regression Results
Evidence for M3-001 through M3-006.

## Production and Scope Safety
Explicit confirmation of:

- Production database untouched.
- No production migrations.
- No production seeding.
- No production cleanup.
- No M4 implementation or planning.
- No organizational bootstrap.
- No Council membership or identity changes.
- No secrets or user data deleted.
- No Git commit or push.
- No history rewriting or branch deletion.

## Final Disposition

Choose exactly one:

- **READY FOR FINAL FOUNDER AUDIT**
- **PARTIALLY COMPLETE — CORRECTIONS REMAIN**
- **BLOCKED**

Do not formally accept M3. Founder acceptance is separate and requires explicit approval.

---

# Final instruction

Execute the remaining M3 remediation now.

Prioritize correctness over obtaining a green test summary.

Do not weaken security checks, remove tests, suppress accessibility rules, fabricate coverage, or report incomplete tests as passing.

If a requirement cannot be completed safely or within the available execution environment, report the exact blocker and retain the affected finding as unresolved.

**M3 only. No M4. No production database operations. No commits or pushes.**