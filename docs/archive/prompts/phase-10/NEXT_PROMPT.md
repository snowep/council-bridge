# Council Bridge — M3 Final Audit Remediation

## 1. Authorization and objective

The Founder authorizes implementation of the corrections identified in the M3 Final Audit for commit:

`1d066ec4bca7b086923d9e4161269e745dce1dc5`

Repository: `snowep/council-bridge`

Branch: `refactor/repository-structure`

Your task is to resolve all nine audit findings in priority order, verify the resulting implementation, and produce a complete remediation report.

This is an M3 remediation task only.

**M4 is explicitly out of scope and must not begin.**

Do not interpret this authorization as approval to seed the organization, reconcile organizational identities, modify production databases, or implement future M4 features.

M2 remains pending formal Founder acceptance. Do not change its status.

M3 remains unaccepted until a separate Founder decision.

---

## 2. Mandatory preparation

Before modifying anything:

1. Inspect the current Git branch and working tree.
2. Record the current HEAD commit.
3. Preserve all existing uncommitted user changes.
4. Read:
   - `docs/reports/M3_WAVE0_UI_BASELINE_REPORT.md`
   - `docs/reports/M3_WAVE0_RECONCILIATION_REPORT.md`
   - `docs/reports/M3_IMPLEMENTATION_ROADMAP.md`
   - `docs/reports/M3_ACCEPTANCE_CRITERIA.md`
   - `docs/reports/M3_WAVE1_DASHBOARD_ACTIONS_REPORT.md`
   - `docs/reports/M3_WAVE3_NAVIGATION_ROUTING_REPORT.md`
   - `docs/reports/M3_WAVE4_SETTINGS_PROFILE_REPORT.md`
   - `docs/reports/M3_WAVE5_THEME_RESPONSIVE_REPORT.md`
   - `docs/reports/M3_WAVE6_QUALITY_ACCEPTANCE_REPORT.md`
5. Inspect the exact source files associated with all nine findings.
6. Verify that the audit findings still apply to the current HEAD. If subsequent commits already resolved any finding, verify the fix and document the evidence rather than reimplementing it.
7. Identify existing frontend, backend, API, database, testing, and design conventions before changing code.

Create an initial remediation checklist and map every finding to its affected files and tests.

Do not assume the original audit commit is still the current branch HEAD.

---

# 3. Remediation priority

Resolve findings in this exact order.

## P1 — Finding 1: Dashboard action wiring

**Affected file:**
`frontend/src/features/dashboard/pages/DashboardPage.tsx`

### Problem

The Create Division and Invite Staff Quick Actions have empty callbacks:

`onClick: () => {}`

Their dialogs and API handlers exist, but users cannot open the dialogs through the advertised Dashboard actions.

### Required implementation

1. Connect Create Division to its dialog-opening state.
2. Connect Invite Staff to its dialog-opening state.
3. Verify New Task opens a functional creation workflow.
4. Inspect the existing Tasks page behavior for `/tasks?create`.
5. Ensure the query parameter actually opens the task creation interface, or implement an equivalent functional workflow.
6. Ensure all three actions are keyboard accessible.
7. Prevent duplicate submissions.
8. Preserve loading, validation, success, and error states.
9. Ensure successful operations refresh the relevant Dashboard data.
10. Ensure dialogs close correctly and reset form state only after successful submission or explicit cancellation.

### Tests

- Each Dashboard action opens the correct workflow.
- Each workflow can be cancelled.
- Each workflow validates required fields.
- Each successful operation persists.
- Failed API requests display errors.
- Repeated clicks do not create duplicate records.
- New Task navigation opens the creation workflow.
- Dashboard data refreshes after successful operations.

Do not declare this finding resolved merely because the dialogs exist.

---

## P1 — Finding 2: Activity page and routing

**Affected areas:**
- `frontend/src/app/App.tsx`
- Frontend Activity feature
- `frontend/src/app/layouts/Layout.tsx`
- Existing Activity API integration

### Problem

The Dashboard links to `/activity`, but the route and Activity page are missing.

The backend endpoint already exists:

`GET /api/activity`

### Required implementation

1. Inspect the existing Activity API contract and `ListActivitySchema`.
2. Inspect the implementation of `listActivity`.
3. Build an Activity page using the existing project architecture and MUI 9.
4. Register `/activity` in React Router.
5. Add the appropriate navigation entry.
6. Connect the page to the existing authenticated API.
7. Implement loading, empty, error, and populated states.
8. Support the existing pagination contract.
9. Preserve chronological ordering and stable pagination behavior.
10. Ensure API errors are handled correctly.
11. Ensure the page works after a direct browser refresh at `/activity`.
12. Ensure the Dashboard's View All link reaches the page.

### Security

- Preserve existing authentication middleware.
- Do not expose activity belonging to unauthorized identities.
- Do not bypass the API and query the database directly from the frontend.
- Do not invent cross-division access permissions.

### Tests

- Activity route renders.
- Direct navigation and browser refresh work.
- Authenticated API request succeeds.
- Unauthenticated access follows existing authentication behavior.
- Pagination works.
- Empty and error states render.
- Dashboard View All navigation works.
- Existing activity authorization tests remain passing.

Do not create a second Activity API if the existing endpoint is sufficient.

---

## P1 — Finding 3: Profile persistence and misleading save behavior

**Affected file:**
`frontend/src/features/profile/pages/ProfilePage.tsx`

### Problem

The current Profile implementation displays generated placeholder information and reports successful saves without persisting profile changes.

### Required implementation

First inspect the existing identity model, authentication context, database schema, and profile-related APIs.

Choose one of these valid outcomes:

**Option A — Genuine profile persistence**

If the existing architecture supports editable profile information:

1. Implement the appropriate authenticated API integration.
2. Load profile values from an authoritative source.
3. Validate changes.
4. Persist changes through the backend.
5. Handle loading, saving, success, and error states.
6. Reload the profile and confirm persistence.
7. Ensure the caller can only update permitted fields belonging to their identity.

**Option B — Explicit read-only profile**

If the architecture does not support profile persistence:

1. Remove misleading edit/save controls.
2. Present actual available identity information as read-only.
3. Remove generated placeholder email addresses.
4. Remove fake successful-save notifications.
5. Clearly indicate unavailable profile information without fabricating values.
6. Use readable, selectable values rather than unnecessarily disabling all fields.

Do not introduce a large profile subsystem solely to make the UI appear editable.

### Tests

- Displayed identity information comes from an authoritative source.
- No fabricated profile values are presented as actual identity data.
- Save notifications occur only after genuine persistence.
- Unauthorized profile updates are rejected.
- Read-only fields remain accessible and selectable.
- Profile behavior remains correct after reload.

Document which option was implemented and why.

---

## P1 — Finding 4: Database seeding skill security

**Affected file:**
`skills/database-seeding.md`

### Problem

The current skill contains destructive cleanup and reseeding instructions, including deletion of operational records and use of `INSERT OR REPLACE`, without sufficient production protections.

### Required implementation

Rewrite the skill to establish strict environment boundaries.

Requirements:

1. General seeding instructions must target isolated development or test databases only.
2. Explicitly prohibit production database seeding and cleanup through this skill.
3. Remove automatic deletion of operational records.
4. Do not use `INSERT OR REPLACE` where it can overwrite or delete existing operational data.
5. Prefer explicit, idempotent, narrowly scoped inserts with conflict handling.
6. Verify the referenced seeding scripts exist.
7. Inspect the actual scripts and ensure they enforce the documented environment restrictions.
8. Require explicit database-path verification before any operation.
9. Require backup and integrity verification for any separately authorized data mutation.
10. Require explicit Founder authorization before any production database mutation.
11. Do not expose production credentials or secrets.
12. Do not provide a command that can accidentally target the production database.

### Important restriction

Do not execute any seeding script during this remediation task.

Do not delete, replace, truncate, reset, or otherwise modify production records.

Do not perform M4 organizational bootstrap.

### Tests and verification

- Inspect all referenced scripts.
- Verify environment guards.
- Verify production paths are rejected.
- Verify destructive operations are absent from the normal workflow.
- Verify isolated test seeding remains functional.
- Document any script that cannot safely be verified.

The documentation and implementation must agree. A warning in Markdown is insufficient if the script itself remains unsafe.

---

# 4. P2 — Remaining findings

## P2 — Finding 5: Authorization HTTP status correctness

**Affected files:**
- `src/api/routes/divisions.routes.ts`
- `src/api/routes/staff.routes.ts`
- `src/api/middleware/error-handler.ts`

### Problem

Authorization failures currently use `ValidationError`, which can result in HTTP 500 because the error handler defaults unclassified errors to 500.

### Required implementation

1. Inspect the existing error classes and API error conventions.
2. Use the existing `AuthorizationError` or an equivalent correctly classified error.
3. Ensure authorization failures consistently return HTTP 403.
4. Ensure validation failures return HTTP 400.
5. Ensure missing resources return HTTP 404.
6. Ensure unexpected server failures return HTTP 500.
7. Do not expose stack traces or sensitive information in production responses.
8. Preserve correlation IDs and existing structured error responses.
9. Apply consistent behavior to division and staff routes.

### Tests

- Unauthorized division creation returns 403.
- Unauthorized staff creation returns 403.
- Invalid request bodies return 400.
- Missing records return 404.
- Unexpected exceptions return 500.
- Existing authentication and security regression tests pass.

Do not weaken authorization to make requests succeed.

---

## P2 — Finding 6: Settings persistence and cancellation

**Affected file:**
`frontend/src/features/settings/pages/SettingsPage.tsx`

### Problem

Settings behavior is inconsistent:

- Notification preferences are stored locally.
- Cancel does not restore previous values.
- `hasChanges` is hardcoded around local single-user mode.
- Save and Cancel may be disabled outside local mode.
- Some switches imply notification delivery capabilities that do not exist.

### Required implementation

Inspect the existing settings architecture and determine which preferences are genuinely supported.

For preferences that are intentionally local:

1. Store them using the existing local preference mechanism.
2. Load the saved values on page initialization.
3. Maintain a separate editable draft state.
4. Make Save persist the draft.
5. Make Cancel restore the last saved values.
6. Calculate `hasChanges` from actual state differences.
7. Provide meaningful success and error feedback.
8. Ensure theme settings remain consistent with the existing theme provider.

For preferences that require backend or external service support:

- Implement them only if a supported contract already exists.
- Otherwise label them accurately as unavailable or remove misleading controls.
- Do not claim email or push notifications are operational without actual integration.

### Tests

- Preferences load correctly.
- Changes are detected.
- Save persists supported settings.
- Cancel restores previous saved values.
- Reload preserves saved preferences.
- Theme behavior remains correct.
- Unsupported capabilities are not presented as operational.

---

## P2 — Finding 7: Quality-gate evidence and test reliability

**Affected areas:**
- Frontend and backend test configuration.
- E2E tests.
- Accessibility tests.
- `docs/reports/M3_WAVE6_QUALITY_ACCEPTANCE_REPORT.md`

### Problem

The existing report has incomplete test totals, unexplained failures despite exit code 0, insufficient frontend E2E evidence, and incomplete accessibility verification.

### Required implementation

#### A. Test command reliability

Inspect all relevant package scripts and test-runner configuration.

Ensure:

- Failed tests cause a non-zero exit code.
- Failed suites cannot be silently reported as successful.
- Skipped and pending tests are reported explicitly.
- Test cleanup and process shutdown work correctly.
- No existing test failures are hidden or suppressed.

Do not change expected assertions merely to achieve green results.

Do not increase timeouts or suppress exit codes as a workaround.

#### B. Backend verification

Run the relevant backend test suites and record:

- Exact command.
- Total tests.
- Passed.
- Failed.
- Skipped.
- Cancelled.
- Exit code.
- Execution duration.

Investigate and fix regressions caused by this remediation.

Clearly identify unrelated pre-existing failures.

#### C. Frontend verification

Run:

- TypeScript compilation.
- Frontend unit tests.
- Frontend integration tests.
- Frontend E2E tests.
- Production build.

Record exact totals and exit codes.

#### D. Accessibility

Perform an actual accessibility audit against WCAG 2.2 AA criteria.

At minimum, verify:

- Keyboard-only navigation.
- Visible focus.
- Dialog focus management.
- Accessible labels and names.
- Color contrast.
- Form error identification.
- Screen-reader semantics.
- Responsive zoom and reflow.
- Interactive control accessibility.

Use automated tooling where available, but do not treat a clean axe scan as proof of complete WCAG compliance.

Document both automated and manual verification.

#### E. Responsive verification

Verify at:

- 375 px
- 768 px
- 1024 px
- 1440 px
- 1920 px

Record actual results and defects.

Do not claim a viewport was tested unless it was actually tested.

---

## P2 — Finding 8: Wave 1 report accuracy

**Affected file:**
`docs/reports/M3_WAVE1_DASHBOARD_ACTIONS_REPORT.md`

### Problem

The report claims all three actions are functional even though two action callbacks are empty.

It also describes pending staff registration as an invitation without demonstrating external invitation delivery.

### Required implementation

After completing the actual Wave 1 fixes:

1. Reconcile the report with source code and test evidence.
2. Describe Create Division accurately.
3. Describe Invite Staff accurately.
4. Distinguish staff registration from external invitation delivery.
5. Describe New Task behavior accurately.
6. Record actual API endpoints.
7. Record actual authorization behavior.
8. Record tests and results.
9. List unresolved limitations.
10. Remove unsupported completion claims.

Do not claim an external invitation was sent unless a real invitation mechanism exists and was tested.

---

## P2 — Finding 9: Responsive and accessibility verification

**Affected files:**
- `docs/reports/M3_WAVE5_THEME_RESPONSIVE_REPORT.md`
- `docs/reports/M3_WAVE6_QUALITY_ACCEPTANCE_REPORT.md`
- Relevant frontend components.

### Problem

Responsive and accessibility compliance is described without sufficient execution evidence.

The Profile page also uses disabled fields for read-only values, which can impair normal selection and accessibility.

### Required implementation

1. Verify all five required viewport widths.
2. Fix layout overflow and unusable navigation.
3. Verify responsive dialogs and forms.
4. Verify keyboard access and focus behavior.
5. Verify contrast and readable text.
6. Verify accessible names and form instructions.
7. Replace inappropriate disabled read-only fields with proper read-only presentation.
8. Verify screen-reader semantics.
9. Record actual results and outstanding issues.
10. Update Wave 5 and Wave 6 reports to reflect evidence.

Do not claim WCAG 2.2 AA compliance if any required criteria remain unverified.

---

# 5. Architecture and design constraints

All changes must preserve the established Council Bridge architecture.

## Frontend

- React 19.
- Vite.
- TypeScript.
- MUI 9.
- Google's Material Design system.
- Vanilla MUI components as the default.
- Custom CSS only when genuinely necessary.

Do not introduce:

- A second component library.
- Generic AI-generated dashboard patterns.
- Unnecessary abstractions.
- Duplicate API clients.
- Parallel state-management systems.
- Unnecessary dependencies.

Maintain the existing command-center/control-panel visual direction.

## Backend

- Preserve Express architecture.
- Preserve SQLite architecture.
- Reuse existing services and validation schemas.
- Preserve authenticated API boundaries.
- Preserve existing authorization rules.
- Preserve migration-runner conventions.

## Security

- Production authentication remains fail-closed.
- Never reintroduce hardcoded identity fallbacks.
- Never weaken token or webhook verification.
- Never expose Founder private keys.
- Never trust client-supplied authorization claims.
- Preserve explicit cross-division authorization.
- Do not expose sensitive data in logs.

---

# 6. Absolute M4 boundary

This task must not start M4.

The following activities are explicitly prohibited:

1. Creating the missing five divisions.
2. Creating missing Division Heads.
3. Creating the missing 45 specialists.
4. Creating or reconciling 102 runtime instances.
5. Running organizational bootstrap scripts.
6. Modifying production organizational records.
7. Performing database cleanup.
8. Applying production migrations.
9. Changing Council membership or vacancies.
10. Changing permanent Council seats.
11. Modifying Council governance or voting rules.
12. Implementing M4 integration or organization reconciliation features.

The current organizational database counts remain unchanged.

If any M4 dependency is discovered, document it as an external dependency. Do not implement it.

---

# 7. Regression and acceptance verification

After all nine findings are addressed, execute a complete regression pass.

Required checks:

- Backend tests.
- Frontend unit tests.
- Frontend integration tests.
- Frontend E2E tests.
- TypeScript.
- ESLint.
- Prettier.
- Production build.
- Authentication and authorization regression.
- Dashboard workflow tests.
- Activity page tests.
- Profile behavior tests.
- Settings behavior tests.
- Responsive verification.
- Accessibility verification.

Do not hide or suppress failures.

Do not change tests to make incorrect behavior appear correct.

Report any pre-existing failures separately with evidence.

---

# 8. Required deliverables

Create:

`docs/reports/M3_FINAL_AUDIT_REMEDIATION_REPORT.md`

The report must include:

1. Executive summary.
2. Original commit SHA.
3. Remediation starting commit SHA.
4. Final HEAD SHA.
5. Working-tree state before and after.
6. All nine findings and their disposition.
7. Files created and modified.
8. Implementation details for each finding.
9. API changes, if any.
10. Security and authorization verification.
11. Database safety verification.
12. Test commands and exact results.
13. Accessibility verification.
14. Responsive verification.
15. Remaining limitations.
16. M3 acceptance criteria status.
17. Explicit confirmation that M4 was not started.
18. Explicit confirmation that no production database was modified.

Update the existing Wave reports where necessary so they reflect actual implementation rather than unsupported claims.

Create a findings matrix:

| Finding | Priority | Status | Evidence |
|---|---|---|---|
| M3-001 Dashboard actions | P1 | | |
| M3-002 Activity page | P1 | | |
| M3-003 Profile persistence | P1 | | |
| M3-004 Database seeding security | P1 | | |
| M3-005 Authorization status | P2 | | |
| M3-006 Settings persistence | P2 | | |
| M3-007 Quality evidence | P2 | | |
| M3-008 Wave 1 report accuracy | P2 | | |
| M3-009 Responsive/accessibility | P2 | | |

Use only these dispositions:

- RESOLVED
- PARTIALLY RESOLVED
- BLOCKED
- NOT APPLICABLE — with evidence

---

# 9. Git and execution restrictions

- Preserve all user changes.
- Do not reset the branch.
- Do not force checkout over modified files.
- Do not delete untracked user files.
- Do not commit.
- Do not push.
- Do not merge.
- Do not deploy.
- Do not force-push.
- Do not rewrite Git history.
- Do not execute production migrations.
- Do not modify production database contents.
- Do not run database seeding.
- Do not begin M4.
- Do not declare M2 accepted.
- Do not declare M3 accepted.

Leave all changes in the working tree for Founder review.

---

# 10. Final status

Conclude with exactly one of these statuses:

**READY FOR FINAL FOUNDER AUDIT**

All nine findings resolved, regression evidence complete, and no release-blocking defects remain.

**PARTIALLY COMPLETE — CORRECTIONS REMAIN**

Some findings remain unresolved. List each finding and the exact remaining work.

**BLOCKED**

Implementation cannot safely proceed. Explain the specific blocker and what authorization or dependency is required.

Do not declare formal M3 acceptance.

The Founder will review the remediation report and authorize the next step separately.