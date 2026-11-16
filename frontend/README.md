# Council Bridge Frontend

React 19 + TypeScript + Vite + MUI application for the Council Bridge multi-agent governance system.

## Stack

- React 19, React Router 7
- TypeScript 7
- Material UI 9 (`@mui/material`, `@mui/x-data-grid`, `@mui/x-date-pickers`)
- Vite 8
- Oxlint
- Playwright (E2E)

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

The dev server runs on port 5173 and proxies `/api`, `/mcp`, and `/health` to the backend at `http://localhost:3334`.

Start the backend first (from the repository root):

```bash
npm run dev
```

## Build

```bash
npm run build    # TypeScript compile + production Vite build to dist/
npm run preview  # Serve the production build
```

## Lint

```bash
npm run lint     # Oxlint
```

## E2E Tests

```bash
npx playwright test          # Run all E2E specs in tests/e2e/
npx playwright test --headed # Run with a visible browser
```

E2E specs live in `tests/e2e/`. Playwright output (`test-results/`, `playwright-report/`) is git-ignored.

## Local single-user Founder mode

Start the backend with `LOCAL_SINGLE_USER_MODE=true`. The frontend detects this mode and skips the login flow, auto-authenticating as the Founder over loopback only.

## Structure

```
src/
  app/            Application shell: App.tsx router, layouts/
  features/       Feature modules, one directory per domain, each with pages/
    auth/ dashboard/ chat/ council/ meetings/ memory/
    organization/ tasks/ executions/ deliverables/ approvals/
  shared/         Cross-feature code
    api/          HTTP client (client.ts)
    components/   Shared components
    hooks/        Shared hooks (useApi.ts)
    theme/        MUI theme (index.ts)
    types/        API types (api.ts)
    styles/       Shared CSS
  components/     Legacy shared components (migrating to shared/)
  utils/          Utilities
tests/
  e2e/            Playwright specs
```
