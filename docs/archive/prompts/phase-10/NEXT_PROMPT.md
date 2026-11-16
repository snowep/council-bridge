# Council Bridge — Post-Refactor Remediation & Final Verification

Repository: `C:\Projects\council-bridge`

Branch: `refactor/repository-structure`

Current refactor commit: `6d6234d`

## Objective

Complete the post-refactor audit, investigate all seven Ponytail findings, verify every previously unchecked item, implement justified fixes, and produce a final acceptance recommendation.

This is a verification and remediation task.

Do not begin another architectural refactor.

## Stage 1 — Establish baseline

1. Confirm branch and commit.
2. Confirm working tree is clean.
3. Read the five repository restructure reports under `docs/audits/codebase/`.
4. Read the current README and `.gitignore`.
5. Run the full backend and frontend test suites before changing anything.
6. Record exact baseline failures, warnings, and test counts.

Do not label a failure pre-existing without evidence from the baseline or previous committed reports.

## Stage 2 — MCP authentication findings

Investigate these findings individually:

### Finding 1: Authentication error code mismatch

Affected:
- `tests/mcp-auth.test.ts:82`
- `tests/mcp-auth.test.ts:105`

Expected: `AUTH_INVALID_TOKEN`

Actual: `INVALID_SESSION`

Determine the intended public error contract by inspecting:
- Authentication implementation.
- MCP response schemas.
- API error conventions.
- Existing security documentation.
- Other authentication tests.

Do not blindly change test expectations.

If `INVALID_SESSION` is the correct established contract, update the tests and relevant documentation.

If `AUTH_INVALID_TOKEN` is the intended contract, correct the implementation without breaking existing clients.

### Finding 2: Unauthenticated MCP tool call returns HTTP 406

Affected:
- `tests/mcp-tools.test.ts:408`
- `src/mcp/tools.ts:210`

Expected: HTTP 401, `AUTH_REQUIRED`.

Actual: HTTP 406, `Not Acceptable`.

Trace the complete request lifecycle:
- HTTP transport.
- MCP Streamable HTTP negotiation.
- Authentication middleware.
- Tool invocation.
- Error serialization.

Determine whether 406 originates from MCP protocol content negotiation or application authentication.

Do not force HTTP 401 if that would violate the MCP transport contract.

The result must provide consistent, documented authentication semantics while preserving protocol compatibility.

### Finding 3: Production fail-closed tests

Affected:
- `tests/mcp-auth.test.ts:386`
- `tests/mcp-auth.test.ts:402`

Expected: HTTP 401.

Actual: HTTP 200.

Investigate whether:
- Tests are configuring production mode correctly.
- Authentication middleware is actually mounted.
- The tested request reaches the protected endpoint.
- Local single-user mode is accidentally enabled.
- Environment configuration leaks between tests.
- Authentication is bypassed by a compatibility path.

This is a security-sensitive finding.

Do not weaken the assertions to make the tests pass.

Verify:
1. Production mode without valid authentication fails closed.
2. Invalid session tokens are rejected.
3. Expired sessions are rejected.
4. Founder-only operations reject non-Founder identities.
5. Local single-user mode only accepts loopback connections.
6. Production mode cannot silently fall back to local single-user authentication.

If implementation is insecure, fix it and add regression tests.

## Stage 3 — React findings

### Finding 4: Missing exhaustive dependencies

Inspect all three affected React effects.

- Identify the actual dependencies.
- Use `useCallback` only where it clarifies stable function identity.
- Avoid stale closures.
- Preserve existing behavior.

### Findings 5 and 6: Synchronous state updates inside effects

Inspect the 13 affected files.

For each instance:
- Determine whether the state is derived from props or existing state.
- Prefer render-time derivation when appropriate.
- Preserve legitimate asynchronous loading and event-driven state updates.
- Avoid unnecessary useEffect or useMemo additions.

Do not refactor all 13 files mechanically.

### Finding 7: Fast Refresh warning

Inspect `frontend/src/app/App.tsx`.

Move non-component exports to an appropriate helper/constants module if necessary.

Preserve imports and application behavior.

Run frontend lint and production build afterward.

## Stage 4 — Documentation verification

### README

Rewrite the root `README.md` if it does not accurately describe the current application.

Include:
- Council Bridge purpose.
- Current backend/frontend architecture.
- Requirements and setup.
- Local single-user Founder mode.
- Production authentication.
- MCP connection.
- Database configuration.
- Migration runner.
- Backup and restore.
- Testing commands.
- Current repository structure.

Do not describe completed phases as upcoming work.

### Git ignore

Inspect every `.gitignore` pattern.

Check:
- Whether production database paths are protected.
- Whether backups are protected.
- Whether migrations and SQL source files remain tracked.
- Whether documentation remains trackable.
- Whether test artifacts and build output are excluded.
- Whether broad patterns accidentally exclude legitimate source files.

Do not remove useful ignore rules without evidence.

## Stage 5 — Verify repository restructuring

Compare commit `6d6234d` against its parent.

Verify:

1. All moved files have valid destinations.
2. All removed files are recorded in the removal register.
3. All merged files are documented.
4. No required source files were lost.
5. No stale imports remain.
6. Package scripts use the correct paths.
7. All documentation links resolve.
8. Migration files remain unchanged.
9. The five restructure reports accurately describe the final state.

Correct stale statements in:
- `REPOSITORY_RESTRUCTURE_IMPLEMENTATION_REPORT.md`
- `REPOSITORY_FILE_MAPPING_FINAL.md`
- `REPOSITORY_REMOVAL_REGISTER.md`
- `REPOSITORY_REGRESSION_REPORT.md`
- `REPOSITORY_SECURITY_ARTIFACT_REPORT.md`

### Historical database artifacts

Do not inspect or expose sensitive database records.

Verify tracked paths and Git history metadata only.

Distinguish:
- Files removed from the current repository tree.
- Historical copies that may remain in previous commits.

Do not rewrite Git history.

## Stage 6 — Full regression

Run:

### Backend
- TypeScript typecheck.
- Full backend test suite.
- MCP authentication tests.
- MCP tool tests.
- Production authentication tests.
- Authorization and Founder signature tests.
- Migration tests using isolated test databases.

### Frontend
- TypeScript typecheck.
- ESLint/Oxlint.
- Production build.
- All Playwright E2E tests.
- All 11 application pages.
- Local single-user mode.
- Responsive tests across the existing five viewport sizes.

### Security
- Production fail-closed behavior.
- Local loopback restrictions.
- Founder-only operations.
- Invalid and expired session handling.
- MCP authentication.
- No credential exposure.

Do not run migrations or modify production databases.

## Stage 7 — Final reports

Update or create:

1. `docs/audits/codebase/POST_REFACTOR_FINAL_AUDIT.md`
2. `docs/audits/codebase/POST_REFACTOR_SECURITY_VERIFICATION.md`
3. `docs/audits/codebase/POST_REFACTOR_REGRESSION_REPORT.md`
4. `docs/audits/codebase/POST_REFACTOR_DOCUMENTATION_AUDIT.md`
5. `docs/audits/codebase/POST_REFACTOR_FINAL_ACCEPTANCE_RECOMMENDATION.md`

For each finding, record:
- Original finding.
- Root cause.
- Whether it was valid.
- Fix applied or reason for no change.
- Test evidence.
- Remaining risk.

Report baseline and final test counts separately.

Do not classify failed tests as passing or silently skip them.

## Stop conditions

- Do not merge into master.
- Do not push unless separately authorized.
- Do not deploy.
- Do not modify production databases.
- Do not execute migrations.
- Do not rewrite Git history.
- Do not begin a new phase.

At completion, provide:
- Final commit and branch.
- All seven finding dispositions.
- Backend test results.
- Frontend E2E results.
- TypeScript and build results.
- Security verification results.
- Documentation and inventory verification.
- Remaining known issues.
- Final recommendation: PASS, CONDITIONAL PASS, or FAIL.

Stop and await Founder review.