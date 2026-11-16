# Repository File Mapping - Final

## Backend Source Files

| Original Path | New Path | Action | Reason | Verification |
|--------------|----------|--------|--------|--------------|
| src/agents.ts | src/communication/agents.ts | MOVE | API module organization | ✓ |
| src/messages.ts | src/communication/messages.ts | MOVE | API module organization | ✓ |
| src/database.ts | src/infrastructure/database/database.ts | MOVE | Infrastructure layer | ✓ Facade at src/database.ts |
| src/init-council.ts | scripts/seed/initialize-council.ts | MOVE | Script, not source | ✓ |
| src/ui.ts | REMOVED | REMOVE | Unused - React frontend doesn't import | ✓ |
| src/globals.d.ts | REMOVED | REMOVE | Only referenced by removed ui.ts | ✓ |

## Frontend Page Components

| Original Path | New Path | Action | Reason | Verification |
|--------------|----------|--------|--------|--------------|
| frontend/src/layouts/Layout.tsx | frontend/src/app/layouts/Layout.tsx | MOVE | App shell location | ✓ |
| frontend/src/pages/*.tsx | frontend/src/features/*/pages/*.tsx | MOVE | Feature organization | ✓ |
| frontend/src/services/api.ts | frontend/src/shared/api/client.ts | MOVE | Shared API client | ✓ |
| frontend/src/hooks/useApi.ts | frontend/src/shared/hooks/useApi.ts | MOVE | Shared hooks | ✓ |
| frontend/src/theme/index.ts | frontend/src/shared/theme/index.ts | MOVE | Shared theme | ✓ |
| frontend/src/types/api.ts | frontend/src/shared/types/api.ts | MOVE | Shared types | ✓ |

## Documentation Files

| Original | New | Action |
|---------|-----|--------|
| PHASE*.md | docs/phases/phase-XX/*.md | MOVE |
| BATCH3A* | docs/phases/phase-08/modularization/ | MOVE |
| CODEBASE_SIMPLIFICATION* | docs/audits/codebase/ | MOVE |
| DATABASE* | docs/audits/database/ | MOVE |
| FRONTEND_CONTROL_INVENTORY.md | docs/audits/frontend/phase-10/ | MOVE |
| proposed/agents/* | docs/organization/agent-definitions/* | MOVE |
| proposed/personas/* | docs/organization/personas/ | MOVE |
| council-bridge-roster.md | docs/organization/roster-v2.2-draft.md | MOVE |

## Test Files

| Original | New | Action |
|---------|-----|--------|
| tests/*.test.ts | tests/unit/*.test.ts | MOVE |
| frontend/e2e/debug-*.spec.ts | REMOVED | REMOVE (debug specs) |
| frontend/e2e/pages.spec.ts | frontend/tests/e2e/pages.spec.ts | MOVE |

## Removed Files

| File Path | Action | Reason |
|-----------|--------|--------|
| frontend/src/App.tsx, App.css | REMOVE | Vite starter unused |
| frontend/src/assets/*.png, *.svg | REMOVE | Unused assets |
| src/ui.ts | REMOVE | Unused |
| src/globals.d.ts | REMOVE | Only by ui.ts |

---
*Generated from pre/post-refactor inventory comparison*
