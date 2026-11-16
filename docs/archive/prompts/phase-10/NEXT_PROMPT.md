# Council Bridge — Repository Structure Refactor

## Project

Repository: `C:\Projects\council-bridge`

Remote: `https://github.com/snowep/council-bridge`

Current branch: `master`

Audited commit: `5e2c19df47354004cb1b565e24026889363fd014`

## Founder authorization boundary

Phase 10 has been formally accepted.

This task is the repository structure refactor only.

The Founder has requested the audit and implementation plan. Before implementation begins, verify that the Founder has explicitly authorized execution of this prompt.

Do not:
- Modify the production database.
- Run database migrations.
- Change production records.
- Rewrite Git history.
- Force-push.
- Change Phase 8 authentication or security behavior.
- Change Council governance or permission policies.
- Introduce new application features.
- Rewrite domain logic merely to make the structure look cleaner.

The task is to reorganize the repository while preserving application behavior.

---

# STAGE 0 — PREFLIGHT

1. Confirm repository path and current branch.
2. Run:
   - `git status --short`
   - `git branch --show-current`
   - `git log -1 --oneline`
3. Confirm the current commit matches the expected audited revision or identify newer commits.
4. Inspect all local changes.
5. If the working tree contains uncommitted changes, STOP and report them. Do not discard or overwrite them.
6. Create a dedicated branch:

`refactor/repository-structure`

Do not commit or push yet.

If the branch already exists, inspect it before proceeding. Never overwrite existing work.

Create a complete pre-refactor file inventory and retain it for comparison.

---

# STAGE 1 — CREATE THE TARGET DIRECTORY STRUCTURE

Create the following directories:

```text
docs/
  architecture/
  operations/
  organization/
    agent-definitions/
      developer/
      marketing/
      finance/
      creative/
      research/
      operations/
    personas/
    history/
  research/
    agency-agents/
    personas/
  audits/
    codebase/
    database/
    frontend/
    security/
    architecture/
  phases/
    phase-04/
    phase-05/
    phase-06/
    phase-07/
    phase-08/
    phase-09/
    phase-10/
  archive/
    implementation-plans/
      phase-09/
      phase-10/
    prompts/
      phase-10/
    roadmaps/
    sdd/
      phase-09/
    superseded/

frontend/src/
  app/
    layouts/
  features/
    auth/
      pages/
    dashboard/
      pages/
    chat/
      pages/
    council/
      pages/
    meetings/
      pages/
    memory/
      pages/
    organization/
      pages/
    tasks/
      pages/
    executions/
      pages/
    deliverables/
      pages/
    approvals/
      pages/
  shared/
    api/
    components/
    hooks/
    theme/
    types/
    styles/

frontend/tests/
  e2e/

scripts/
  diagnostics/
  maintenance/
  seed/
  archive/

src/
  api/
    middleware/
    routes/
    schemas/
  auth/
  communication/
  council/
  infrastructure/
    database/
  mcp/
  migration-runner/

tests/
  unit/
  integration/
  security/
  migrations/
  helpers/
```

Do not introduce additional architectural layers without a demonstrated need.

---

# STAGE 2 — MOVE DOCUMENTATION

Use `git mv` wherever possible to preserve file history.

## Phase documents

Move:
- `PHASE4_*.md` → `docs/phases/phase-04/`
- `PHASE5_*.md` → `docs/phases/phase-05/`
- `PHASE6_*.md` → `docs/phases/phase-06/`
- `PHASE7_*.md` → `docs/phases/phase-07/`
- `PHASE8_*.md` → `docs/phases/phase-08/`
- `PHASE9_*.md` → `docs/phases/phase-09/`
- `PHASE10_*.md` → `docs/phases/phase-10/`

Preserve original filenames.

Move BATCH3A and BATCH3 final verification reports to:

`docs/phases/phase-08/modularization/`

Move:
- `CODEBASE_SIMPLIFICATION_AUDIT.md`
- `CODEBASE_SIMPLIFICATION_REPORT.md`

to `docs/audits/codebase/`.

Move `COUNCIL_MODULARIZATION_INTEGRATION_REPORT.md` to `docs/audits/architecture/phase-08/`.

Move:
- `DATABASE_FINDINGS_INVESTIGATION.md`
- `DATABASE_REMEDIATION_PROPOSAL.md`
- `DATABASE_TEST_ISOLATION_AUDIT.md`

to `docs/audits/database/`.

Move:
- `FRONTEND_CONTROL_INVENTORY.md`
- `FRONTEND_SOURCE_AUDIT.md`

to `docs/audits/frontend/phase-10/`.

Move remaining root `FRONTEND_*` completion reports to `docs/phases/phase-10/frontend/`.

Move:
- `COUNCIL_PERSONA_RESEARCH_REPORT.md`
- `steve_jobs_philosophy_evidence.md`

to `docs/research/personas/`.

Move `agency-agents-audit-report.md` to `docs/research/agency-agents/`.

Move `DIVISION_HEAD_REVISION_REPORT.md` to `docs/organization/history/`.

Move `council-bridge-roster.md` to:

`docs/organization/roster-v2.2-draft.md`

Move `MASTER_ROADMAP.md` to:

`docs/archive/roadmaps/MASTER_ROADMAP_2026-11-13.md`

Move `NEXT_PROMPT.md` to:

`docs/archive/prompts/phase-10/NEXT_PROMPT.md`

Do not discard historical Phase 6 correction-report versions.

## Historical planning documents

Move `.superpowers/sdd/2026-11-14-phase9-pre-batch3-gate2-remediation/` to:

`docs/archive/sdd/phase-09/gate-2/`

Move `.superpowers/sdd/2026-11-14-phase9-pre-batch3-gate3-remediation/` to:

`docs/archive/sdd/phase-09/gate-3/`

Move both files from `docs/superpowers/plans/` to:

`docs/archive/implementation-plans/phase-09/`

Move:

`ai/memory-bank/tasks/phase10-batch1-migration-backup-tasklist.md`

to:

`docs/archive/implementation-plans/phase-10/`

Remove the obsolete `.claude/scheduled_tasks.lock` file. Do not remove actual Claude project instructions if any are added later.

---

# STAGE 3 — ORGANIZATIONAL DEFINITIONS

Move the contents of `proposed/agents/` into:

`docs/organization/agent-definitions/`

Preserve all six division directories and all existing Markdown filenames.

Move `proposed/personas/` into:

`docs/organization/personas/`

Expected retained definitions:
- 6 Division Heads
- 45 specialists
- 4 Council personas

Verify all 55 files are accounted for.

Do not rewrite persona content or change staff identities.

---

# STAGE 4 — BACKEND SOURCE ORGANIZATION

Move:
- `src/agents.ts` → `src/communication/agents.ts`
- `src/messages.ts` → `src/communication/messages.ts`

Move the implementation currently in `src/database.ts` to:

`src/infrastructure/database/database.ts`

Preserve a compatibility facade at `src/database.ts` if needed to avoid breaking existing imports during the transition. Update imports deliberately and verify the resulting dependency graph.

Keep:
- `src/server.ts`
- `src/api/`
- `src/auth/`
- `src/council/`
- `src/mcp/`
- `src/migration-runner/`

Keep `src/council.ts` as the existing compatibility facade.

Move `src/init-council.ts` to `scripts/seed/initialize-council.ts` only after confirming it remains relevant and safe.

Inspect `src/ui.ts` and `src/globals.d.ts`. If they are not referenced by any active entry point or required tooling, remove them.

## Authentication middleware

Compare:
- `src/auth/middleware.ts`
- `src/api/middleware/authentication.ts`

They have overlapping responsibilities.

Do not simply delete one.

Determine which implementation is actually used, compare local single-user mode, development fallback, production fail-closed behavior, and session validation.

Consolidate into one canonical implementation only if behavior can be preserved. Keep a compatibility re-export where necessary.

Add regression tests for:
- Production fail-closed authentication.
- Local single-user loopback restriction.
- Invalid and expired tokens.
- Founder authorization.
- Session identity validation.

Do not weaken Phase 8 security.

## Database instance warning

The current code creates a configured database instance in `server.ts`, while API route modules import `databaseInstance` directly.

Document this issue in the refactor report.

Do not silently redesign the database lifecycle as part of the directory moves. Do not change the production database path or database contents.

---

# STAGE 5 — FRONTEND FEATURE ORGANIZATION

Move the operational page components into their corresponding `frontend/src/features/*/pages/` directories.

Move:
- `frontend/src/layouts/Layout.tsx` → `frontend/src/app/layouts/Layout.tsx`
- `frontend/src/services/api.ts` → `frontend/src/shared/api/client.ts`
- `frontend/src/hooks/useApi.ts` → `frontend/src/shared/hooks/useApi.ts`
- `frontend/src/theme/index.ts` → `frontend/src/shared/theme/index.ts`
- `frontend/src/types/api.ts` → `frontend/src/shared/types/api.ts`

Update all imports, router declarations, and aliases.

Keep the current React, TypeScript, MUI, Vite, and React Router stack.

Do not redesign UI or alter component behavior.

## Remove unused Vite starter

Verify references before removing:
- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/assets/hero.png`
- `frontend/src/assets/react.svg`
- `frontend/src/assets/vite.svg`
- `frontend/public/icons.svg`

`frontend/src/main.tsx` currently uses `./app/App`. Preserve this entry point.

Inspect `frontend/src/index.css` and `frontend/src/styles/pages.css`. Merge useful styles into the shared styles directory if they are actually used. Remove unused styles only after reference checks.

Keep `frontend/public/favicon.svg`.

Replace the default Vite content in `frontend/README.md` with Council Bridge frontend setup and development instructions.

## Frontend E2E

Move E2E tests into `frontend/tests/e2e/`.

Retain:
- `pages.spec.ts`
- `phase10-verification.spec.ts`
- `simple-test.spec.ts` if it provides distinct smoke coverage.

Inspect all debug specs. Preserve any unique assertions in canonical tests, then remove obsolete debugging specifications.

Update Playwright configuration and package scripts.

Move curated screenshots to:

`docs/phases/phase-10/evidence/screenshots/`

Remove debug screenshots.

Remove generated `frontend/test-results/.last-run.json` and ignore generated test output.

Move:
- `frontend/FRONTEND_API_INTEGRATION_REPORT.md`
- `frontend/FRONTEND_FIX_IMPLEMENTATION_REPORT.md`

to `docs/phases/phase-10/frontend/`.

---

# STAGE 6 — TEST ORGANIZATION

Move the existing backend tests according to the audited mapping:

- Unit tests → `tests/unit/`
- Integration tests → `tests/integration/`
- Security tests → `tests/security/`
- Migration tests → `tests/migrations/`
- Test helpers → `tests/helpers/`

Preserve test filenames.

Update:
- Relative imports.
- Test runner globs.
- Root npm test command.
- Any fixture paths.
- Test setup and teardown.

Do not weaken assertions, skip tests, or modify expected results merely to make the refactor pass.

All tests must still run.

---

# STAGE 7 — SCRIPTS AND MAINTENANCE

Move read-only diagnostic scripts into `scripts/diagnostics/`.

Consolidate duplicate database verification and report-generation scripts only after comparing their behavior.

Archive completed Phase 9 population/remediation scripts under `scripts/archive/` only if their historical value justifies retaining executable copies. Clearly label them as historical and unsupported.

Remove obsolete or dangerous one-off scripts when their functionality is superseded:
- `scripts/cleanup.ts`
- `apply-migration-013.cjs`
- `insert-constitution.ts`
- obsolete debug scripts

Do not execute any of these scripts.

The migration runner must remain the only supported migration execution mechanism.

Every retained production-database diagnostic must:
- Require an explicit database path.
- Default to read-only access.
- Never silently point to production.
- Print the resolved database path before inspection.

---

# STAGE 8 — DATABASE AND GENERATED ARTIFACT CLEANUP

The repository currently tracks 157 database-related binary artifacts.

Remove the tracked audit database copy and WAL/SHM files from `database-audit-bundle/`.

Preserve the six human-readable audit documents and SQL schema by moving them to:

`docs/audits/database/2026-11-15-snapshot/`

Remove all committed temporary test database artifacts under:
- `test-backup-*`
- `test-corrupt-*`
- `test-data/`
- `test-integrity-*`
- `test-recovery-*`
- `test-restore-*`
- `test-wal-*`

Ensure tests generate temporary databases automatically and clean them up.

Remove the generated `.playwright-mcp` page snapshot.

Remove empty root files `npm` and `output.txt`.

## Git ignore

Consolidate ignore rules in the root `.gitignore`.

Include appropriate patterns for:
- `node_modules/`
- `dist/`
- `coverage/`
- `data/`
- `.secrets/`
- `*.db`
- `*.db-shm`
- `*.db-wal`
- `*.db-journal`
- `test-*/`
- `frontend/test-results/`
- `frontend/playwright-report/`
- generated Playwright screenshots
- `.playwright-mcp/`
- `.claude/scheduled_tasks.lock`
- `.env`
- `.env.local`

Do not ignore source migrations, SQL schemas, or documentation.

Do not delete `data/council.db`, production backups, or any local production database.

Do not rewrite Git history. Report that historical copies of removed public database files may remain in previous commits and require a separate security decision.

---

# STAGE 9 — README AND DOCUMENTATION

Rewrite root `README.md` to describe the current Council Bridge application.

It must cover:
1. Project purpose.
2. Current architecture.
3. Backend setup.
4. Frontend setup.
5. Local single-user Founder mode.
6. Production authentication modes.
7. MCP connection configuration.
8. Database location and configuration.
9. Migration runner usage.
10. Backup and restore.
11. Testing commands.
12. Repository structure.

Correct the migration manifest to describe the actual migration files:
- 001–006
- 013
- 014

Do not invent missing migration files or renumber existing migrations.

Preserve historical documents without presenting them as current instructions.

---

# STAGE 10 — VERIFICATION

Run the complete verification workflow.

Backend:
- TypeScript typecheck.
- Full backend test suite.
- Import/reference checks.
- Migration discovery check.
- Database integrity tests using isolated test databases only.

Frontend:
- TypeScript build.
- Production build.
- Lint.
- Playwright E2E tests.

Repository:
- Verify every moved file exists at its destination.
- Verify no required source file was lost.
- Verify no stale imports remain.
- Verify all package scripts work.
- Verify `.gitignore` excludes generated database and test artifacts.
- Verify migration files remain unchanged.
- Verify production database paths and contents were not accessed or modified.

Compare the pre-refactor and post-refactor file inventories.

Expected result:
- Every retained file has exactly one canonical destination.
- Every removed file has an explicit reason.
- No unapproved application behavior changes.
- No migration execution.
- No production database modifications.
- No Git history rewrite.

Do not hide or reclassify pre-existing test failures. Report baseline and post-refactor results separately.

---

# REQUIRED REPORTS

Create:

1. `docs/audits/codebase/REPOSITORY_RESTRUCTURE_IMPLEMENTATION_REPORT.md`
2. `docs/audits/codebase/REPOSITORY_FILE_MAPPING_FINAL.md`
3. `docs/audits/codebase/REPOSITORY_REMOVAL_REGISTER.md`
4. `docs/audits/codebase/REPOSITORY_REGRESSION_REPORT.md`
5. `docs/audits/codebase/REPOSITORY_SECURITY_ARTIFACT_REPORT.md`

The final file mapping must include:
- Original path.
- New path.
- Action: KEEP, MOVE, MERGE, or REMOVE.
- Reason.
- Verification result.

The removal register must explicitly list every removed file or a complete, reproducible path pattern with the exact number of files affected.

The security report must identify the public database artifacts and explain the difference between removing them from the current tree and purging them from Git history.

---

# STOP CONDITIONS

At the end:

- Do not commit.
- Do not push.
- Do not merge.
- Do not deploy.
- Do not run migrations.
- Do not modify production database contents.
- Do not rewrite Git history.
- Do not start another development phase.

Stop on the refactor branch and report:
1. Final directory structure.
2. File count before and after.
3. Files moved, merged, removed, and retained.
4. Test results.
5. TypeScript and production build results.
6. Any unresolved issues.
7. Whether the working tree is clean.

Wait for Founder review and explicit authorization before committing or pushing.