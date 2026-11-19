Council Bridge — M3 Final Remediation & Comprehensive Acceptance Verification

1. Mission

Complete every remaining M3 correction and produce a fully evidenced final acceptance package.

This is a continuation of the M3 remediation work. Previous attempts were incomplete. Do not repeat their mistakes or declare findings resolved based on documentation, source inspection alone, or partial test results.

Repository: "snowep/council-bridge"
Local path: "C:\Projects\council-bridge"
Starting commit: "1950eab563741346bfc0117d88ca0b280719d026"
Branch: Inspect the actual current branch. Expected working branch: "refactor/repository-structure".

Authorized scope:

- Finish M3-004: executable database-seeding security.
- Finish M3-007: test reliability and trustworthy test evidence.
- Finish M3-009: responsive and accessibility verification.
- Reverify all previously resolved M3 findings M3-001 through M3-008.
- Correct inaccurate M3 reports and acceptance documentation.
- Produce the final M3 audit and acceptance package.

M4 is explicitly out of scope. Do not start M4.

The objective is not to make reports say everything passes. The objective is to make the implementation secure, functional, testable, accessible, and demonstrably correct.

---

2. Mandatory Initial Inspection

Before changing anything:

1. Inspect the actual repository HEAD, branch, working tree, and untracked files.
2. Confirm whether "1950eab563741346bfc0117d88ca0b280719d026" is the current HEAD or an ancestor.
3. Identify all changes made after that commit.
4. Preserve every existing user modification. Never overwrite or discard unrelated work.
5. Inspect the complete M3 documentation and all previous M3 remediation reports.
6. Inspect the current implementation of every M3 finding.
7. Inspect all database seeding scripts, database initialization paths, environment configuration, test configuration, CI workflows, and browser test infrastructure.
8. Inspect package scripts and lockfiles before installing or changing dependencies.
9. Identify the actual test commands and their exit-code behavior.
10. Establish a baseline before making changes.

Create a baseline record containing:

- HEAD SHA and branch.
- Working-tree status.
- Existing modified/untracked files.
- Backend test result and exit code.
- Frontend test result and exit code.
- TypeScript result.
- Lint result.
- Build result.
- E2E result.
- Existing failures and warnings.
- Existing browser and accessibility tooling.

Do not assume the previous reports are accurate. Verify their claims against current source and actual execution.

---

3. M3-004 — Executable Database-Seeding Security

Objective

Make accidental production or operational database seeding technically impossible through normal application seeding commands, including ambiguous environment configuration and path manipulation.

Documentation alone does not satisfy this requirement.

3.1 Inventory

Locate and inspect:

- Every seeding script.
- Every organization bootstrap script.
- Every database initialization helper.
- Every database path resolver.
- Every CLI command capable of inserting, replacing, updating, or deleting seed data.
- Every script that invokes another seeding script.
- All environment variables controlling database paths and runtime modes.
- All relevant npm scripts and developer instructions.

Create a complete inventory of these entry points.

Do not assume "scripts/seed-organization-full.ts" exists. Locate the actual implementation and verify its path.

3.2 Implement a centralized fail-closed guard

Create or reuse one centralized, testable database seeding safety guard.

Every seeding entry point must invoke it before:

- Opening a database connection.
- Creating database directories.
- Creating tables.
- Running migrations.
- Inserting or modifying records.
- Executing cleanup or reset operations.

Required behavior:

Reject by default:

- "NODE_ENV=production".
- Missing or unknown environment designation.
- Missing database path.
- Empty database path.
- Ambiguous database path.
- A path resolving to the operational production database.
- A path resolving to any known operational data directory.
- A symlink or canonical path resolving to an operational database.
- Conflicting environment variables.
- Environment-variable overrides attempting to bypass safety.
- In-memory or temporary database targets unless the command explicitly supports them as isolated tests.
- Any path that cannot be conclusively classified as a permitted development/test target.

Permit only explicitly identified targets:

- An isolated development database with an explicit development designation.
- An isolated test database with an explicit test designation.

The guard must verify the effective resolved database path, not merely inspect the raw environment variable.

Use canonical/real paths where possible. Account for symlinks, path traversal, relative paths, case differences on relevant filesystems, and Windows path behavior.

Do not rely on substring checks such as checking whether a path contains "test", "dev", or "production".

Do not allow a second environment variable to override a previously validated path.

Do not expose a bypass flag that can silently disable the guard.

3.3 Protect destructive operations

- Remove unsafe "INSERT OR REPLACE" usage where it can overwrite existing operational data.
- Prefer explicit inserts and conflict handling with clearly defined behavior.
- Make development/test seeding idempotent where appropriate.
- Require explicit authorization and verified backups for any future operation against persistent operational data.
- Do not execute destructive reset or cleanup commands against operational databases.
- Keep production database initialization and migration behavior unchanged unless a specific M3 defect requires a narrowly scoped correction.

3.4 Security test coverage

Add automated tests proving the guard rejects:

1. Production NODE_ENV.
2. Production database path.
3. Missing database path.
4. Empty database path.
5. Unknown environment designation.
6. Conflicting environment variables.
7. Relative paths resolving to operational data.
8. Symlink paths resolving to operational data.
9. Canonical path aliases.
10. Windows-style path edge cases where applicable.
11. Attempted environment override.
12. A seeding command invoking the guard incorrectly or omitting required configuration.

Add positive tests proving:

13. Explicit isolated development database is permitted.
14. Explicit isolated test database is permitted.
15. Repeated seeding does not corrupt or duplicate protected records.
16. A rejected operation fails before the database is opened or modified.

Use temporary isolated databases for these tests.

Never use the real operational database as a test fixture.

Test the actual seeding command entry points, not only the guard helper in isolation.

3.5 Acceptance criteria

M3-004 is resolved only when:

- Every seeding entry point is inventoried.
- Every entry point invokes the guard before database access.
- All security tests pass.
- Production/operational target rejection is demonstrated.
- Valid isolated development/test seeding works.
- No production database was opened or modified during verification.
- Documentation matches actual implementation.

---

4. M3-007 — Test Reliability and Reproducible Evidence

Objective

Ensure test commands accurately report success or failure, tests are isolated, and no failures are hidden or misrepresented.

4.1 Investigate the timing-safe comparison failure

Investigate:

"hermes-webhook-signature.test.ts"

The previous execution history contains:

- A reported clean run of 560/560 after cleaning ".secrets/archive".
- Another run reporting a timing-safe comparison failure.
- Claims that this failure is pre-existing and unrelated to M3.

Do not simply label it unrelated.

Determine:

- Exact failing assertion.
- Whether the failure is deterministic.
- Whether it depends on ".secrets/archive" contents.
- Whether test setup or environment state affects it.
- Whether test ordering or shared state affects it.
- Whether it is caused by implementation, fixture, encoding, malformed input, or timing-safe comparison preconditions.
- Whether cleaning the archive changes the actual test inputs or merely masks a defect.

Run the test:

1. Independently.
2. With the full suite.
3. Repeatedly.
4. In a clean isolated environment.
5. With and without the relevant archive contents, using copies or temporary fixtures only.

Do not delete user data to produce a clean test run.

If the implementation is wrong, fix the root cause without weakening cryptographic validation.

If the test fixture is wrong, correct the fixture and explain why.

If the failure is genuinely unrelated and cannot be fixed within scope, document the evidence and leave it visibly outstanding. Do not claim 560/560 on a run that did not achieve it.

4.2 Test-runner integrity

Inspect every relevant test runner and CI workflow.

Verify:

- A failed assertion produces a nonzero exit code.
- A failed child process propagates its exit code.
- Shell pipelines do not mask failures.
- CI steps do not use "continue-on-error" to conceal test failures.
- No test suite is silently skipped.
- No broad catch block swallows assertion failures.
- No unawaited asynchronous tests are reported as passed.
- No test timeout is converted into success.
- No test command exits before pending tests complete.
- No test is excluded merely to improve the total.
- Test databases are isolated and reliably cleaned up.
- Test order does not affect results.
- Parallel execution does not introduce shared-state corruption.

Do not increase timeouts as a substitute for investigating hangs or leaked resources.

4.3 Test isolation

Verify:

- Each integration/E2E test uses an isolated database or explicitly controlled fixture.
- Test cleanup cannot touch production data.
- ".secrets/archive" is not mutated or deleted by normal tests.
- Environment variables are restored after tests.
- Database connections are closed.
- Server processes terminate cleanly.
- Test fixtures do not depend on stale local state.

4.4 Required test execution

Run the complete available test matrix:

Backend

- Full unit suite.
- Full integration suite.
- Full security suite.
- Migration tests.
- Hermes webhook tests.
- Messaging E2E tests.
- Database seeding security tests.

Frontend

- Available unit/component tests.
- Full Playwright E2E suite.
- Responsive viewport suite.
- Accessibility suite.

Quality gates

- TypeScript.
- ESLint/Oxlint as configured.
- Prettier or configured formatting check.
- Production build.
- CI-equivalent commands.

Use the actual scripts from the current package files. Do not invent commands.

4.5 Required evidence

For every command record:

- Exact command.
- Working directory.
- Environment designation.
- Start/end time or duration.
- Total tests.
- Passed.
- Failed.
- Skipped.
- Pending.
- Exit code.
- Relevant failure output.

Distinguish:

- Clean-environment result.
- Normal local-environment result.
- CI-equivalent result.
- Historical result.

Do not combine results from different runs into one misleading total.

4.6 Acceptance criteria

M3-007 is resolved only when:

- The timing-safe test failure is explained and resolved, or a reproducible, explicitly documented external blocker remains.
- Test runner exit codes are trustworthy.
- No hidden/skipped failures remain.
- Full suites have been executed.
- E2E tests complete.
- TypeScript, lint, formatting, and build checks pass.
- Test results can be reproduced from documented commands.

---

5. M3-009 — Responsive UI and Accessibility

Objective

Verify actual application behavior at all required viewport widths and achieve documented WCAG 2.2 AA accessibility compliance for the M3 interface.

CSS inspection alone is not verification.

5.1 Correct the existing Playwright suite

Inspect:

"frontend/tests/e2e/viewport-a11y-verification.spec.ts"

The previous audit identified that:

- The page list was declared but not used.
- Viewport tests navigated only to the application root.
- Keyboard checks asserted only that an active element existed.
- The Settings theme toggle lacked a reliable accessible name.
- axe-core was not executed.

Correct all of these issues.

Do not simply change expected assertions to make tests pass.

5.2 Required pages

Test each of these routes individually:

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

Also test:

- Main navigation.
- Drawer/sidebar.
- User menu.
- Theme toggle.
- Create Division dialog.
- Invite Staff dialog.
- New Task flow.
- Forms and validation states.
- Tables, lists, empty states, and loading states.
- Error and success notifications.

Use authenticated, deterministic fixtures or the project's supported local authentication mode. Do not weaken authentication to make tests pass.

5.3 Required viewport widths

Test every required page at:

Width| Target
375px| Small mobile
768px| Tablet
1024px| Small desktop
1440px| Standard desktop
1920px| Large desktop

At minimum, every page must be checked at every width.

Verify:

- No unintended horizontal page overflow.
- No clipped content.
- No overlapping controls.
- No inaccessible navigation.
- No broken dialog sizing.
- No unreadable tables or data grids.
- No text truncation that hides essential information.
- Correct responsive navigation.
- Correct spacing and layout.
- Functional controls at all breakpoints.
- No content hidden behind fixed headers or drawers.
- Appropriate behavior at browser zoom/text scaling where supported.

Capture screenshots or traces for failures and representative passing states.

5.4 Accessibility tooling

Use the existing Playwright infrastructure.

Inspect whether "@axe-core/playwright" or an equivalent is already installed. If not, add the smallest compatible dependency and update the appropriate lockfile.

Run axe-core scans on representative pages and interactive states, including:

- Dashboard.
- Activity.
- Organization.
- Tasks.
- Profile.
- Settings.
- Navigation drawer open.
- User menu open.
- Dialog open.
- Form validation errors.
- Theme toggle in both light and dark modes.

Record the WCAG ruleset and exact results.

Fix all critical and serious violations.

Investigate moderate violations. Fix them where feasible; otherwise document the exact exception, impact, and reason. Do not label the result fully compliant if material violations remain.

5.5 WCAG 2.2 AA verification

Check, at minimum:

Perceivable

- Text and non-text contrast.
- Text resizing.
- Reflow at narrow widths.
- Meaningful accessible names.
- Labels and descriptions.
- Icons with appropriate accessible names or decorative treatment.
- No color-only status communication.

Operable

- Keyboard-only navigation.
- Visible focus indicators.
- Logical focus order.
- No keyboard traps.
- Dialog focus entry, containment, and restoration.
- Drawer and menu keyboard behavior.
- Escape behavior where appropriate.
- Adequate target sizes.
- Focus not obscured by sticky elements.

Understandable

- Form labels and instructions.
- Clear validation messages.
- Error identification.
- Consistent navigation.
- Accurate button and toggle names.
- Correctly communicated saved/draft states.

Robust

- Correct semantic HTML.
- Valid ARIA usage.
- Accessible roles and states.
- Screen-reader-compatible status announcements.
- Correct heading hierarchy and landmarks.

5.6 Manual keyboard verification

Perform real keyboard checks for:

- Opening and closing navigation.
- Navigating between pages.
- Opening and closing dialogs.
- Moving through dialog controls.
- Submitting and cancelling forms.
- Operating the theme toggle.
- Accessing tables and lists.
- Reaching notifications and status updates.
- Returning focus to the triggering control after closing overlays.

Do not substitute "document.activeElement" existence for actual keyboard verification.

5.7 Settings and Profile

Settings

- Provide an accessible name for the theme switch.
- Ensure correct switch role and checked state.
- Verify keyboard operation.
- Verify light/dark theme behavior.
- Verify saved versus draft preferences.
- Verify Cancel restores saved state.
- Do not imply email or push delivery exists if it is not implemented.

Profile

- Preserve the read-only design.
- Read-only information must remain selectable and copyable.
- Do not use disabled form controls for informational content when that harms accessibility.
- Do not reintroduce simulated save behavior.

5.8 Acceptance criteria

M3-009 is resolved only when:

- All 13 pages are tested at all five viewport widths.
- No unresolved critical layout defects remain.
- Playwright tests assert real behavior.
- axe-core scans have been executed.
- Critical/serious accessibility violations are fixed.
- Manual keyboard verification is documented.
- Settings and Profile accessibility requirements pass.
- Any remaining exceptions are explicitly recorded.
- No unsupported WCAG 2.2 AA compliance claim is made.

---

6. Regression Audit — M3-001 Through M3-008

Previously resolved findings must be rechecked. Do not assume they remain fixed.

M3-001 — Dashboard actions

- Create Division opens and submits the correct workflow.
- Invite Staff opens and submits the correct workflow.
- New Task opens the actual task creation flow.
- Pending staff registration must not be described as an invitation being delivered.
- Verify success/error states and API integration.

M3-002 — Activity

- Activity route exists.
- Activity page loads.
- API integration works.
- Empty/loading/error states work.
- Navigation links resolve correctly.

M3-003 — Profile

- No simulated persistence.
- Read-only behavior is explicit.
- Values remain selectable and accessible.
- No misleading save action.

M3-004 — Database seeding

- Complete the security work described in Section 3.

M3-005 — Authorization

- Unauthorized division/staff operations return HTTP 403.
- Authentication failures retain correct HTTP statuses.
- No regression to generic HTTP 500 for authorization errors.
- Production fail-closed behavior remains intact.

M3-006 — Settings

- Preferences persist according to implemented capabilities.
- Cancel restores saved values.
- Draft and saved state are distinct.
- No misleading controls.
- Keyboard and screen-reader behavior works.

M3-007 — Test reliability

- Complete Section 4.

M3-008 — Documentation accuracy

- Review Wave 1 and all M3 wave reports.
- Correct claims that staff invitations are delivered when only pending registration occurs.
- Correct any overstated quality, E2E, accessibility, or responsive claims.
- Reports must match the implementation and actual test evidence.

---

7. Preserve Architecture and Product Constraints

Do not change the established architecture unnecessarily.

Preserve:

- React 19.
- Vite.
- TypeScript.
- MUI 9 vanilla components.
- Google's Material Design system.
- Minimal custom CSS, only when genuinely necessary.
- Express backend.
- SQLite.
- Existing authentication and authorization model.
- Existing migration architecture.
- Existing test architecture unless a specific defect requires a correction.

Do not:

- Introduce generic AI-generated dashboard patterns.
- Replace MUI with another component system.
- Add Redis.
- Add unnecessary abstractions.
- Weaken production authentication.
- Reintroduce hardcoded identity fallbacks.
- Expose Founder private keys.
- Modify Council governance or voting rules.
- Change unrelated product behavior.

---

8. Absolute M4 Boundary

M4 is not authorized.

Do not:

- Create or seed the six divisions.
- Create the six Division Heads.
- Create the 45 specialists.
- Create the 51 logical staff identities.
- Create or map the 102 runtime instances.
- Bootstrap organizational identities.
- Modify Council seats or personas.
- Begin M4 integration.
- Perform organization-wide production data reconciliation.
- Add M4 migrations.
- Change production database records.
- Run production seed scripts.
- Begin M4 planning or implementation under another name.

M3 remediation only.

---

9. Production and Data Safety

The following actions are prohibited:

- Modifying the production database.
- Seeding production data.
- Running production migrations.
- Deleting production records.
- Deleting user files or secrets.
- Cleaning ".secrets/archive" destructively.
- Rewriting Git history.
- Force-pushing.
- Deleting branches.
- Committing or pushing changes.
- Merging or deploying.

Do not alter existing user work.

If a test requires cleanup, use a temporary isolated fixture or a copy. Never clean the user's original data.

Do not claim that the production database was untouched unless the execution process and evidence support that statement.

---

10. Documentation Deliverables

Create or update:

Required final report

"docs/reports/M3_FINAL_REMEDIATION_VERIFICATION_REPORT.md"

Include:

1. Executive summary.
2. Starting commit and final HEAD.
3. Branch and working-tree status.
4. All files changed.
5. M3-004 implementation details.
6. M3-004 security test matrix.
7. M3-007 test-runner investigation.
8. Timing-safe test failure root-cause analysis.
9. Exact test commands and results.
10. E2E results.
11. TypeScript/lint/format/build results.
12. M3-009 page-by-page viewport matrix.
13. axe-core results and WCAG ruleset.
14. Manual keyboard verification.
15. Settings/Profile accessibility results.
16. M3-001 through M3-008 regression matrix.
17. Production data safety evidence.
18. Explicit confirmation that M4 was not started.
19. Remaining defects and limitations.
20. Final disposition.

Required supporting reports

Create or update supporting documentation where useful:

- "docs/reports/M3_DATABASE_SEEDING_SECURITY_REPORT.md"
- "docs/reports/M3_TEST_RELIABILITY_REPORT.md"
- "docs/reports/M3_ACCESSIBILITY_RESPONSIVE_REPORT.md"

Avoid duplicating the same information across reports. The final report should summarize and link to the supporting evidence.

Required acceptance matrix

Use only these statuses:

- RESOLVED
- PARTIALLY RESOLVED
- BLOCKED

A finding cannot be marked RESOLVED without implementation evidence and passing verification.

---

11. Final Verification Procedure

After implementation:

1. Review the full diff.
2. Check for accidental unrelated modifications.
3. Check for secrets or sensitive data in changed files.
4. Run all relevant security tests.
5. Run all backend suites.
6. Run all frontend suites.
7. Run all E2E suites.
8. Run the complete responsive viewport matrix.
9. Run axe-core scans.
10. Complete manual keyboard checks.
11. Run TypeScript.
12. Run lint.
13. Run formatting checks.
14. Run production builds.
15. Confirm all test commands return correct exit codes.
16. Verify the production database was not modified.
17. Verify no M4 work was introduced.
18. Reconcile all reports with actual results.
19. Review final Git diff and working-tree status.

Do not stop after the first successful test command.

Do not mark a finding resolved because its code compiles.

Do not claim full WCAG compliance without evidence.

Do not hide test failures behind historical passing runs.

---

12. Final Response Format

Return a concise but complete implementation summary:

A. Execution

- Starting HEAD.
- Final HEAD.
- Branch.
- Working-tree status.

B. Findings

A table covering M3-001 through M3-009 with:

- Final status.
- Exact implementation.
- Verification evidence.

C. Security

- Seeding entry points audited.
- Fail-closed guard behavior.
- Security tests and results.
- Production database safety evidence.

D. Test reliability

- Exact backend/frontend/E2E totals.
- Timing-safe test investigation and conclusion.
- TypeScript/lint/format/build.
- Exit codes.
- Remaining failures.

E. Accessibility

- All pages and viewport widths tested.
- Responsive results.
- axe-core results.
- Manual keyboard results.
- Remaining WCAG exceptions.

F. Deliverables

List every report and significant implementation file.

G. Scope confirmation

Explicitly state:

- No production database changes.
- No production migrations.
- No M4 implementation.
- No commits or pushes.

H. Final disposition

Choose exactly one:

- READY FOR FINAL FOUNDER AUDIT — all M3 findings resolved and evidence complete.
- PARTIALLY COMPLETE — CORRECTIONS REMAIN — some findings remain unresolved.
- BLOCKED — work cannot be completed safely.

Do not formally accept M3. Only the Founder can do that.

Do not begin M4.

---

13. Final Instruction

Execute the work, do not merely write another plan.

Inspect first, implement the actual remaining corrections, run the full verification matrix, and produce the evidence.

Previous remediation attempts were incomplete because documentation and partial tests were treated as proof of completion. This time, every claim must be backed by actual implementation and reproducible verification.

If a requirement cannot be verified, mark it PARTIALLY RESOLVED or BLOCKED. Never manufacture a passing result.

The task is complete only when the repository is genuinely ready for final Founder audit.