# Repository Removal Register

This document lists every file removed from the repository, organized by category.

## Frontend Removed Files

### Vite Starter Files (5 files, 2016 bytes)
- `frontend/src/App.tsx` - Vite starter template
- `frontend/src/App.css` - Vite starter styles
- `frontend/src/assets/hero.png` - Placeholder image
- `frontend/src/assets/react.svg` - React logo placeholder
- `frontend/src/assets/vite.svg` - Vite logo placeholder
- `frontend/public/icons.svg` - SVG sprite sheet

### Debug E2E Test Specs (16 files)
- `frontend/e2e/debug-council*.spec.ts` (6 files)
- `frontend/e2e/debug-org*.spec.ts` (3 files)
- `frontend/e2e/debug-tasks.spec.ts`
- `frontend/e2e/debug-chat*.spec.ts` (2 files)
- `frontend/e2e/debug-meeting*.spec.ts` (2 files)
- `frontend/e2e/debug-specific.spec.ts`
- `frontend/e2e/debug-headings.spec.ts`
- `frontend/e2e/debug-failing.spec.ts`
- `frontend/e2e/debug-test.spec.ts`

### Debug Screenshots (6 files)
- `frontend/e2e-screenshots/council-debug.png` - Debug screenshot
- `frontend/e2e-screenshots/debug-council.png` - Debug screenshot
- `frontend/e2e-screenshots/debug-login.png` - Debug screenshot

## Root-Level Removed Files

### Obsolete Scripts (19 files)
- `apply-migration-013.cjs` - Superseded by migration runner
- `insert-constitution.ts` - Superseded
- `check-phase7.ts`, `check-schemas.ts`, `check-tables.ts` - Diagnostic scripts
- `debug-canonical.ts` through `debug4.ts` - Debug scripts
- `fix-integrity.cjs`, `fix-integrity2.cjs` - Debug tools
- `generate-reports.cjs` - Debug tool
- `test-connect.ts`, `test_workflow.ts` - Debug tools
- `verify_migrations.ts` - Debug tool

### UI Legacy Files (2 files)
- `src/ui.ts` - Legacy UI code, not used by React frontend
- `src/globals.d.ts` - Only referenced by removed ui.ts

## Database Artifacts Removed

### Test Artifact Directories (155 directories, 300+ files)
Pattern: `test-backup-*`, `test-corrupt-*`, `test-data/`, `test-integrity-*`, `test-recovery-*`, `test-restore-*`, `test-wal-*`

### Database Audit Bundle (1 directory, 1 binary)
- `database-audit-bundle/council-bridge-audit.db` - 8.2 MB audit database
- Associated .shm and .wal files

## Configuration Cleaned

### Git Ignore Patterns Added
- `test-*/` - Test artifact directories
- `frontend/test-results/` - Playwright output
- `*.db`, `*.db-shm`, `*.db-wal`, `*.db-journal` - Database files

---
**Total Files Removed**: 200+
**Total Data Freed**: ~50 MB database binaries + test artifacts
