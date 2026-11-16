# Frontend Codebase Audit Report

**Project**: Council Bridge Frontend  
**Path**: `C:/Projects/council-bridge/frontend`  
**Audit Date**: 2026-11-16  
**Branch**: refactor/repository-structure

---

## 1. Project Structure

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── .oxlintrc.json
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx                    # Entry point
│   ├── app/
│   │   ├── App.tsx                 # Root app with routing & auth
│   │   ├── constants.ts            # App constants (LOCAL_SINGLE_USER_MODE)
│   │   ├── auth-context.tsx        # Auth provider
│   │   ├── auth-context-type.ts    # Auth context types
│   │   ├── use-app-auth.ts         # Auth hook
│   │   └── layouts/
│   │       └── Layout.tsx          # Main layout with sidebar & appbar
│   ├── shared/
│   │   ├── api/
│   │   │   └── client.ts           # Axios API client with interceptors
│   │   ├── hooks/
│   │   │   └── useApi.ts           # useApi, usePolling hooks
│   │   ├── theme/
│   │   │   └── index.ts            # Light/dark MUI themes
│   │   ├── types/
│   │   │   └── api.ts              # All API response types
│   │   └── styles/
│   │       └── pages.css           # Global page styles
│   └── features/
│       ├── auth/
│       │   └── pages/
│       │       └── LoginPage.tsx
│       ├── dashboard/
│       │   └── pages/
│       │       └── DashboardPage.tsx
│       ├── tasks/
│       │   └── pages/
│       │       └── TasksPage.tsx
│       ├── chat/
│       │   └── pages/
│       │       └── ChatPage.tsx
│       ├── approvals/
│       │   └── pages/
│       │       └── ApprovalsPage.tsx
│       ├── deliverables/
│       │   └── pages/
│       │       └── DeliverablesPage.tsx
│       ├── executions/
│       │   └── pages/
│       │       └── ExecutionsPage.tsx
│       ├── memory/
│       │   └── pages/
│       │       └── MemoryPage.tsx
│       ├── meetings/
│       │   └── pages/
│       │       └── MeetingsPage.tsx
│       ├── council/
│       │   └── pages/
│       │       └── CouncilPage.tsx
│       └── organization/
│           └── pages/
│               └── OrganizationPage.tsx
```

---

## 2. Page Audit Summary

| Page | UI Status | API Endpoints | Integration | Loading/Error/Empty States | Auth Handling | TypeScript/Build |
|------|-----------|---------------|-------------|----------------------------|---------------|------------------|
| **DashboardPage** | Complete | `/api/divisions`, `/api/staff`, `/api/approvals`, `/api/activity` | Working (with fallbacks) | ✅ Loading skeletons, ✅ Error alerts with retry, ✅ Empty states | Uses `useAppAuth`, respects `LOCAL_SINGLE_USER_MODE` | ✅ Clean |
| **TasksPage** | Complete | `/api/tasks`, `/api/divisions/organization/divisions`, `/api/staff`, `/api/tasks/:id`, `/api/tasks/:id/assign`, `/api/tasks/:id/status` | Working | ✅ Loading spinner, ✅ Error state, ✅ Empty table state | Uses `useAppAuth` via Layout | ✅ Clean |
| **ChatPage** | Complete | `/api/messages/conversations`, `/api/messages/:id`, `/api/messages` (POST) | Working | ✅ Loading spinner, ✅ Error alerts with retry, ✅ Empty conversation state | Uses `useAppAuth` for sender identification | ✅ Clean |
| **ApprovalsPage** | Complete | `/api/approvals`, `/api/executions/approve` (POST) | Working | ✅ Loading spinner, ✅ Error state, ✅ Empty card state | **Founder-only actions** (checks `authContext.owner_type === 'founder'`) | ✅ Clean |
| **DeliverablesPage** | Complete | `/api/deliverables`, `/api/deliverables/:id`, `/api/deliverables/:id/versions`, `/api/deliverables` (POST), `/api/deliverables/:id/submit`, `/api/deliverables/:id/review`, `/api/deliverables/:id/revision`, `/api/deliverables/:id/assign-reviewer`, `/api/quality-thresholds`, `/api/tasks` | Working | ✅ Loading spinner, ✅ Detail loading, ✅ Error alerts, ✅ Empty states per tab | Uses `useAppAuth` via Layout | ✅ Clean |
| **ExecutionsPage** | Complete | `/api/executions`, `/api/executions/:id`, `/api/executions/:id/history`, `/api/executions` (POST), `/api/executions/:id/execute`, `/api/executions/:id/cancel`, `/api/executions/approve`, `/api/executions/autonomy-levels`, `/api/approvals`, `/api/tasks` | Working | ✅ Loading spinner, ✅ Detail loading, ✅ Error alerts, ✅ Empty states per tab | Uses `useAppAuth` via Layout | ✅ Clean |
| **MemoryPage** | Complete | `/api/memory` (with query params) | Working | ✅ Loading spinner, ✅ Error alert with retry, ✅ Empty state with filter message | Uses `useAppAuth` via Layout | ✅ Clean |
| **MeetingsPage** | Partial | `/api/meetings`, `/api/meetings/:id`, `/api/meetings/:id/phases` | Working (partial) | ✅ Loading spinner, ✅ Error alert with retry, ✅ Empty states | Uses `useAppAuth` via Layout | ⚠️ **Tabs 2-3 (Decisions, Action Items) show placeholder only** |
| **CouncilPage** | Complete | `/api/council/seats`, `/api/council/personas`, `/api/council/runtime-assignments`, `/api/council/constitution`, `/api/approvals` | Working | ✅ Loading spinner, ✅ Error alert with retry, ✅ Empty states per tab | Uses `useAppAuth` via Layout | ⚠️ **Tabs 4-5 (Decisions, Voting) show "Coming Soon" placeholders** |
| **OrganizationPage** | Complete | `/api/divisions`, `/api/staff`, `/api/staff/divisions/members` | Working | ✅ Loading spinner, ✅ Error state with retry, ✅ Empty states per tab | Uses `useAppAuth` via Layout | ✅ Clean |
| **LoginPage** | Complete | `/api/auth/session` (via `apiClient.createSession`) | Working | ✅ Loading spinner on button, ✅ Error alert, Form validation | Full auth flow via `useAppAuth.login()` | ✅ Clean |

---

## 3. API Client (`@shared/api/client.ts`)

### Features
- **Axios instance** with 30s timeout, `withCredentials: true`
- **Request interceptor**: Adds `Authorization: Bearer <token>` header
- **Response interceptor**: Handles 401 → clears session, redirects to `/login`
- **Token persistence**: localStorage (`session_token`)
- **Auth endpoints**: `createSession`, `deleteSession`, `getAuthStatus`, `getFounderPublicKey`
- **Health check**: `/health`
- **Generic methods**: `get`, `post`, `put`, `patch`, `delete`
- **Base URL**: From `VITE_API_BASE_URL` (empty string = relative/proxied)

### Issues
- **No request/response logging** (debugging harder)
- **No retry logic** for transient failures
- **401 handler does hard redirect** (`window.location.href`) - could break SPA navigation
- **No abort controller support** for cancellation

---

## 4. Shared Hooks (`@shared/hooks/useApi.ts`)

### `useApi<T>`
- Standard async hook with `data`, `loading`, `error`, `execute`, `refetch`
- Supports `immediate`, `onSuccess`, `onError` options
- **No de-duplication** - multiple calls with same params execute in parallel

### `usePolling<T>`
- Wrapper around `useApi` with `setInterval`
- Configurable interval (default 5000ms) and `enabled` flag
- **No cleanup on unmount race condition** - `execute` could run after unmount
- **No focus-aware polling** (continues in background tabs)

---

## 5. Types (`@shared/types/api.ts`)

**Comprehensive type definitions** covering:
- Auth: `AuthContext`, `SessionTokenResponse`, `AuthStatusResponse`, `FounderPublicKeyResponse`
- Council: `CouncilSeat`, `Persona`, `RuntimePersonaAssignment`, `Constitution`, `FounderApproval`
- Division: `Division`, `StaffAgent`, `DivisionMember`
- Memory: `MemoryCategory`, `MemoryType`, `MemoryEntry`, `MemorySearchParams`
- Messages: `Message`, `Conversation`
- Meetings: `Meeting`, `MeetingPhase`
- Tasks: `Task`, `TaskStatus`, `TaskAssignedToType`
- Deliverables: `Deliverable`, `DeliverableStatus`, `ReviewerType`, `DeliverableVersion`
- Executions: `AutonomyLevel`, `ExecutionStatus`, `ApprovalStatus`, `TaskAutonomyLevel`, `ExecutionRequest`, `ApprovalRequest`, `ExecutionHistory`
- Quality: `QualityThreshold`
- Pagination: `PaginatedResponse<T>`
- Errors: `ApiError`
- Founder: `FounderSignatureRequest`

**Quality**: Well-organized, matches backend types, good union types for statuses.

---

## 6. Theme Configuration (`@shared/theme/index.ts`)

### Light Theme
- Primary: `#1976d2` (Material Blue)
- Secondary: `#9c27b0` (Material Purple)
- Background: `#fafafa` / `#ffffff`
- Text: `#1a1a2e` / `#4a4a6a`

### Dark Theme
- Primary: `#90caf9` (Light Blue)
- Secondary: `#ce93d8` (Light Purple)
- Background: `#121212` / `#1e1e1e`
- Text: `#ffffff` / `#b0b0b0`

### Shared Component Overrides
- `MuiButton`: No text-transform, font-weight 500
- `MuiCard`/`MuiPaper`: Subtle shadows + borders
- `MuiTableCell.head`: Bold, subtle background
- `MuiTextField`/`MuiSelect`: Outlined, small by default
- Border radius: 8px
- Spacing: 8px base
- Font: Inter → Roboto → Helvetica → Arial

### Persistence
- Stored in `localStorage.theme_mode`
- Respects `prefers-color-scheme` on first visit
- Toggle in Layout triggers `window.location.reload()` (full reload - could use theme context instead)

---

## 7. Build Configuration

### `vite.config.ts`
- **Plugin**: `@vitejs/plugin-react`
- **Aliases**: `@`, `@shared`, `@app`, `@features`
- **Dev Server**: Port 5173, proxies `/api`, `/mcp`, `/health` → `http://localhost:3334`
- **Build**: 
  - Output: `dist/`
  - Sourcemaps: true
  - Manual chunks: `vendor` (react), `mui` (@mui), `charts` (@mui/x)
- **Define**: `VITE_LOCAL_SINGLE_USER_MODE` from env

### `tsconfig.app.json`
- Target: ES2023
- Module: ESNext (bundler mode)
- Strict: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`
- Paths matching Vite aliases
- JSX: react-jsx

### Linting: `.oxlinrc.json`
- Plugins: react, typescript, oxc
- Rules: `react/rules-of-hooks: error`, `react/only-export-components: warn`

---

## 8. Authentication Flow

### `AppAuthProvider` (`src/app/auth-context.tsx`)
```typescript
// Two modes:
1. LOCAL_SINGLE_USER_MODE (dev): Auto-auth as Founder, no API calls
2. Production: Checks apiClient.isAuthenticated() → calls /api/auth/status
```

**State**: `authContext: AuthContext | null`, `isLoading: boolean`

**Methods**: `login(ownerType, ownerId, runtime)`, `logout()`, `refreshAuth()`, `navigateAfterLogin()`

### `useAppAuth` (`src/app/use-app-auth.ts`)
- Simple context consumer with runtime check

### `ProtectedRoute` (`src/app/App.tsx`)
- Shows nothing while `isLoading`
- In `LOCAL_SINGLE_USER_MODE`: Always allows access
- Otherwise: Redirects to `/login` if no auth

### `LoginPage` (`src/features/auth/pages/LoginPage.tsx`)
- Account type selector: founder | seat | staff | division
- Dynamic account ID options per type
- Runtime selector: claude | hermes
- Calls `login()` → `navigateAfterLogin()` → redirects to `/`

### Session Management
- Token stored in localStorage (`session_token`)
- `apiClient.setSessionToken()` / `clearSession()`
- 401 response → auto logout + redirect to `/login`

---

## 9. Cross-Cutting Observations

### Strengths
1. **Consistent patterns** across all pages (loading, error, empty states)
2. **Proper TypeScript** - all API responses typed, no `any` abuse
3. **Good separation** - features, shared, app layers well organized
4. **MUI v5** used correctly with sx props, theme integration
5. **Responsive layouts** - mobile drawers, breakpoints handled
6. **Route structure** - clean nested routes with ProtectedRoute
7. **Dev mode** - `LOCAL_SINGLE_USER_MODE` enables zero-config development

### Issues & Risks

| Severity | Issue | Location |
|----------|-------|----------|
| **Medium** | Hard redirect on 401 (`window.location.href`) breaks SPA, loses state | `client.ts:39` |
| **Medium** | Theme toggle triggers full page reload | `Layout.tsx:97` |
| **Medium** | `usePolling` no unmount protection, no focus awareness | `useApi.ts:60-77` |
| **Medium** | MeetingsPage tabs 2-3 (Decisions, Action Items) are placeholders | `MeetingsPage.tsx:319-356` |
| **Medium** | CouncilPage tabs 4-5 (Decisions, Voting) are "Coming Soon" | `CouncilPage.tsx:524-535` |
| **Low** | No request deduplication in `useApi` | `useApi.ts` |
| **Low** | LoginPage has hardcoded seat/staff/division options (not API-driven) | `LoginPage.tsx:29-58` |
| **Low** | Error handling uses `alert()` in some pages (Executions, Tasks) | `ExecutionsPage.tsx:224`, `TasksPage.tsx:204` |
| **Low** | Dashboard `/api/activity` endpoint has silent try/catch fallback | `DashboardPage.tsx:108-113` |
| **Low** | MemoryPage pagination uses client-side count (not server total) | `MemoryPage.tsx:262` |

### Missing Features (Not Implemented)
- WebSocket/real-time updates (only polling via `usePolling`)
- Optimistic UI updates
- Request cancellation (AbortController)
- Offline support / service worker
- Internationalization
- Automated testing setup (no test files found)

---

## 10. TypeScript / Build Health

```
✅ No TypeScript errors in audited files
✅ Strict mode enabled (noUnusedLocals, noUnusedParameters)
✅ Path aliases configured and used consistently
✅ ESLint/Oxlint configured with React hooks rules
✅ Vite build config with chunk splitting
✅ Sourcemaps enabled for production debugging
```

---

## 11. Recommendations

### High Priority
1. **Fix 401 handler** - Use router navigation instead of `window.location.href`
2. **Replace theme reload** - Use MUI `ThemeProvider` with context instead of reload
3. **Implement MeetingsPage Decisions/Action Items tabs** - Currently placeholders
4. **Implement CouncilPage Decisions/Voting tabs** - Currently placeholders

### Medium Priority
5. **Hardened usePolling** - Add abort controller, focus-aware polling
6. **Replace alert() calls** - Use Snackbar/Alert components consistently
7. **Add request deduplication** to `useApi` for same-key concurrent calls
8. **LoginPage dynamic options** - Fetch seats/staff/divisions from API

### Low Priority
9. **Add request/response logging** in development
10. **Add retry logic** with exponential backoff to API client
11. **Add AbortController support** to API client methods
12. **Server-side pagination** for MemoryPage

---

## 12. Summary

The frontend is **well-structured, type-safe, and feature-complete for core workflows**. All 11 pages are implemented with consistent patterns, proper loading/error/empty states, and working API integration. 

**Two pages have incomplete tabs** (Meetings: Decisions/Action Items; Council: Decisions/Voting) showing placeholder content only.

**Authentication flow** works in both dev (local single-user) and production modes.

**Build system** is modern (Vite + React + TypeScript + Oxlint) with proper chunking and aliases.

**Risk level**: Low-Medium. The hardcoded 401 redirect and theme reload are the main architectural concerns. Placeholder tabs indicate incomplete backend endpoints or deferred frontend work.

---

*Report generated by automated audit on 2026-11-16*