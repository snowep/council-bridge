# SDD ledger — plan: docs/archive/prompts/phase-10/NEXT_PROMPT.md

Baseline: HEAD=5e2c19d (master tip), branch=refactor/repository-structure, zero refactor commits. Prior session left extensive uncommitted staged work (Stages 1-5 partial). Resume, do not restart.

## Task Status

### Stage 4: Backend Source Organization
- [x] agents.ts → src/communication/agents.ts
- [x] messages.ts → src/communication/messages.ts
- [x] database.ts → src/infrastructure/database/database.ts (facade at src/database.ts)
- [ ] Consolidate auth middleware: src/auth/middleware.ts vs src/api/middleware/authentication.ts
- [ ] Remove ui.ts (legacy, unused by React frontend)
- [ ] Remove globals.d.ts (only referenced by ui.ts)
- [ ] Move init-council.ts → scripts/seed/initialize-council.ts (after confirming safe)

### Stage 5: Frontend Feature Organization
- [x] Layout.tsx → frontend/src/app/layouts/Layout.tsx
- [x] Pages → frontend/src/features/*/pages/
- [x] services/api.ts → frontend/src/shared/api/client.ts
- [x] hooks/useApi.ts → frontend/src/shared/hooks/useApi.ts
- [x] theme/index.ts → frontend/src/shared/theme/index.ts
- [x] types/api.ts → frontend/src/shared/types/api.ts
- [ ] Remove unused Vite starter: App.tsx, App.css, assets/hero.png, assets/react.svg, assets/vite.svg, public/icons.svg
- [ ] Merge/remove frontend/src/index.css and frontend/src/styles/pages.css
- [ ] Rewrite frontend/README.md
- [ ] Move E2E tests: frontend/e2e/ → frontend/tests/e2e/
- [ ] Remove debug E2E specs, keep: pages.spec.ts, phase10-verification.spec.ts, simple-test.spec.ts
- [ ] Move curated screenshots: frontend/e2e-screenshots/ → docs/phases/phase-10/evidence/screenshots/
- [ ] Move FRONTEND_API_INTEGRATION_REPORT.md, FRONTEND_FIX_IMPLEMENTATION_REPORT.md → docs/phases/phase-10/frontend/

### Stage 6: Test Organization
- [ ] Move backend tests to tests/unit/, tests/integration/, tests/security/, tests/migrations/, tests/helpers/
- [ ] Update test runner globs, npm test command, fixture paths, setup/teardown

### Stage 7: Scripts and Maintenance
- [ ] Move diagnostic scripts → scripts/diagnostics/
- [ ] Consolidate duplicate DB verification scripts
- [ ] Archive Phase 9 scripts → scripts/archive/
- [ ] Remove: scripts/cleanup.ts, apply-migration-013.cjs, insert-constitution.ts, obsolete debug scripts

### Stage 8: Database and Generated Artifact Cleanup
- [ ] Remove database-audit-bundle binaries (council-bridge-audit.db, .shm, .wal)
- [ ] Move 6 audit docs + schema.sql → docs/audits/database/2026-11-15-snapshot/
- [ ] Remove all test-* directories (test-backup-*, test-corrupt-*, test-data/, test-integrity-*, test-recovery-*, test-restore-*, test-wal-*)
- [ ] Remove .playwright-mcp, npm, output.txt
- [ ] Update .gitignore with all required patterns

### Stage 9: README and Documentation
- [ ] Rewrite root README.md
- [ ] Correct migration manifest (001-006, 013, 014)

### Stage 10: Verification
- [ ] Backend: typecheck, full test suite, import checks, migration discovery, DB integrity
- [ ] Frontend: TypeScript build, production build, lint, Playwright E2E
- [ ] Repository: verify moved files, no lost sources, no stale imports, package scripts work, gitignore excludes artifacts, migrations unchanged, production DB untouched

### Required Reports
- [ ] docs/audits/codebase/REPOSITORY_RESTRUCTURE_IMPLEMENTATION_REPORT.md
- [ ] docs/audits/codebase/REPOSITORY_FILE_MAPPING_FINAL.md
- [ ] docs/audits/codebase/REPOSITORY_REMOVAL_REGISTER.md
- [ ] docs/audits/codebase/REPOSITORY_REGRESSION_REPORT.md
- [ ] docs/audits/codebase/REPOSITORY_SECURITY_ARTIFACT_REPORT.md

