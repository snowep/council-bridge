# Frontend Source Audit Report

**Repository:** `C:\Projects\council-bridge`  
**Audit Baseline:** Commit `700c366` (Phase 10 verification)  
**Audit Date:** 2026-11-15  
**Scope:** All 11 frontend pages + shared infrastructure

---

## Executive Summary

| Page | Status | Critical Issues | Working Controls | Placeholder/Broken Controls |
|------|--------|-----------------|------------------|----------------------------|
| Login | ⚠️ Dev-only | No production Founder signature flow | Dev preset login | Production auth completely missing |
| Dashboard | ❌ Broken | Hardcoded metrics (6, 45, 0) | None | All metrics fabricated |
| Chat | ⚠️ Partial | Search inert, draft clears on send, errors only console | Send/receive messages | Search, error UI, draft preservation |
| Council | ✅ Mostly functional | Decisions/Voting tabs = placeholders | Seats, Personas, Runtime, Constitution | Decisions, Voting |
| Meetings | ✅ Mostly functional | Decisions/Action Items = placeholders | List, phases, detail dialog | Decisions, Action Items tabs |
| Memory | ❌ Placeholder | Complete placeholder | None | Entire page |
| Organization | ✅ Functional | None found | Divisions, Staff, Members | None |
| Tasks | ✅ Functional | History/Progress need backend | Full CRUD, assign, status | Progress, History tabs (backend missing) |
| Executions | ✅ Functional | Reject = alert() | Create, execute, approve, cancel, detail | Reject button |
| Deliverables | ✅ Mostly functional | Assign Reviewer = no-op | Full workflow UI | Assign Reviewer button |
| Approvals | ⚠️ Partial | Approve/Reject = alert() | List display | Approve/Reject actions |

**Total:** 4 functional, 4 mostly functional, 2 partial, 1 placeholder

---

## Detailed Page Audit

### 1. LoginPage.tsx (`frontend/src/pages/LoginPage.tsx`)

**Components Rendered:**
- Card with form (owner_type Select, owner_id Select, runtime Select)
- Sign In Button
- Preset development accounts notice

**API Endpoints Called:**
- `POST /api/auth/session` via `apiClient.createSession()`

**Data Displayed:**
- Static preset options for founder, seats, staff, divisions
- No dynamic data fetching

**Controls:**
- Owner Type Select → FUNCTIONAL (dev only)
- Owner ID Select → FUNCTIONAL (dev only)
- Runtime Select → FUNCTIONAL
- Sign In Button → FUNCTIONAL (dev only)

**Form Validation:** HTML5 required on selects

**Loading Behavior:** Button shows "Signing in..." with CircularProgress

**Error Behavior:** Alert component displays `err?.response?.data?.error`

**Empty State:** N/A

**Role-based Behavior:** None (all roles available in dev preset)

**Responsive:** Fixed width card, centers on screen

**Keyboard Accessibility:** Native form controls

**Critical Finding (F-UI-01):** Production authentication requires `founder_signature`, `founder_timestamp`, `founder_nonce`, `founder_key_id` but UI supplies none. Backend `/api/auth/session` rejects requests without these in production mode. No production login flow exists.

---

### 2. DashboardPage.tsx (`frontend/src/pages/DashboardPage.tsx`)

**Components Rendered:**
- Typography (h4 "Founder Dashboard")
- Paper (Recent Activity placeholder)
- 3 Cards with hardcoded metrics

**API Endpoints Called:** **NONE**

**Data Displayed:**
- Active Divisions: **6** (hardcoded)
- Staff Agents: **45** (hardcoded)
- Pending Approvals: **0** (hardcoded)
- Recent Activity: "Activity feed will show recent operations here."

**Controls:** None interactive

**Loading/Error/Empty States:** None

**Critical Finding (F-UI-02):** All metrics hardcoded. No API calls to `/api/divisions`, `/api/staff`, `/api/approvals`. No loading, error, empty, retry states. No last-refreshed timestamp.

---

### 3. ChatPage.tsx (`frontend/src/pages/ChatPage.tsx`)

**Components Rendered:**
- Paper (conversation list, fixed 380px)
- List/ListItemButton (conversations)
- Box (message pane)
- Paper (message bubbles)
- TextField + Button (message input)
- Avatar, Chip (participant indicators)

**API Endpoints Called:**
- `GET /api/messages/conversations`
- `GET /api/messages/:conversationId`
- `POST /api/messages`

**Data Displayed:**
- Conversation list with participant name, last message preview, unread count
- Message history with sender alignment, timestamps
- Participant avatars with color coding

**Controls:**
- Conversation list items → FUNCTIONAL
- Search TextField → **BROKEN** (inert, no handler)
- Message TextField → FUNCTIONAL (but draft clears before send)
- Send Button → FUNCTIONAL
- Enter key send → FUNCTIONAL

**Form Validation:** Required on message field

**Loading Behavior:** CircularProgress while fetching conversations

**Error Behavior:** `console.error` only, sets empty array → **BROKEN** (looks like empty state)

**Empty States:** "No conversations yet", "No messages yet"

**Critical Findings (F-UI-07):**
- Search field has no onChange/handler
- `setNewMessage('')` called BEFORE `apiClient.post()` → draft lost on failure
- Failed sends only log to console, no user-visible feedback
- Fetch errors indistinguishable from empty results
- No duplicate send prevention

---

### 4. CouncilPage.tsx (`frontend/src/pages/CouncilPage.tsx`)

**Components Rendered:**
- Tabs (6 tabs)
- Tables (Seats, Personas, Runtime Assignments)
- Card (Constitution detail)
- Chip status indicators

**API Endpoints Called:**
- `GET /api/council/seats` → expects `{ data: CouncilSeat[] }`
- `GET /api/council/personas` → expects `{ data: Persona[] }`
- `GET /api/council/runtime-assignments` → expects `{ data: RuntimePersonaAssignment[] }`
- `GET /api/council/constitution` → expects `Constitution`
- `GET /api/approvals` → expects `{ data: FounderApproval[] }`

**Data Displayed:** All council data correctly mapped

**Controls:**
- Refresh button → FUNCTIONAL
- Tab navigation → FUNCTIONAL
- Table rows (hover, click) → FUNCTIONAL

**Loading/Error/Empty States:** All present with retry

**Critical Findings (F-UI-12):**
- Tab 4 "Decisions" → "Coming Soon" placeholder
- Tab 5 "Voting" → "Coming Soon" placeholder
- No backend endpoints exist for these

---

### 5. MeetingsPage.tsx (`frontend/src/pages/MeetingsPage.tsx`)

**Components Rendered:**
- Tabs (4 tabs)
- Table (meetings list)
- Card (selected meeting detail)
- Dialog (full meeting detail with phases)
- Chip status indicators

**API Endpoints Called:**
- `GET /api/meetings` → expects `{ meetings: Meeting[], limit, offset }`
- `GET /api/meetings/:meetingId` → expects `{ meeting: Meeting }`
- `GET /api/meetings/:meetingId/phases` → expects `{ phases: MeetingPhase[] }`

**Data Displayed:** Meetings, phases correctly mapped

**Controls:**
- Refresh → FUNCTIONAL
- View details button → FUNCTIONAL (opens dialog)
- Tab navigation → FUNCTIONAL

**Loading/Error/Empty States:** All present with retry

**Critical Findings (F-UI-12):**
- Tab 2 "Decisions" → placeholder text
- Tab 3 "Action Items" → placeholder text
- Dialog hardcodes "Decisions (0)" with no data
- No backend endpoints for decisions/action items

---

### 6. MemoryPage.tsx (`frontend/src/pages/MemoryPage.tsx`)

**Components Rendered:**
- Typography h4 "Memory"
- Paper with placeholder text

**API Endpoints Called:** **NONE**

**Data Displayed:** "Memory browsing and search will be implemented here."

**Controls:** None

**Critical Finding (F-UI-03):** Complete placeholder. Backend has `/api/memory` endpoints (search, list, create) but page implements nothing.

---

### 7. OrganizationPage.tsx (`frontend/src/pages/OrganizationPage.tsx`)

**Components Rendered:**
- Tabs (3 tabs)
- Cards for divisions, staff, members
- Chip indicators

**API Endpoints Called:**
- `GET /api/divisions` → expects `{ divisions: Division[] }`
- `GET /api/staff` → expects `{ staff: StaffAgent[] }`
- `GET /api/staff/divisions/members` → expects `{ members: DivisionMember[] }`

**Data Displayed:** All three tabs functional with real data

**Controls:**
- Refresh → FUNCTIONAL
- Tab navigation → FUNCTIONAL

**Loading/Error/Empty States:** All present with retry

**Status:** ✅ **FUNCTIONAL** - No critical issues found

---

### 8. TasksPage.tsx (`frontend/src/pages/TasksPage.tsx`)

**Components Rendered:**
- Tabs (6 tabs)
- Table (task list)
- Card (task detail)
- Multiple Dialogs (create, assign, status)
- Forms with Select, TextField
- Snackbar notifications

**API Endpoints Called:**
- `GET /api/tasks` → expects `{ tasks: Task[], limit, offset }`
- `GET /api/tasks/:taskId` → expects `{ task: Task }`
- `POST /api/tasks` (create)
- `PUT /api/tasks/:taskId/assign`
- `PUT /api/tasks/:taskId/status`
- `GET /api/divisions/organization/divisions` (for assign dialog)
- `GET /api/staff` (for assign dialog)

**Data Displayed:** Full task data with status, priority, assignment

**Controls:**
- All CRUD dialogs → FUNCTIONAL
- Table row click → FUNCTIONAL (loads detail)
- Assign/Status action buttons → FUNCTIONAL
- Tab navigation → FUNCTIONAL
- Snackbar notifications → FUNCTIONAL

**Loading/Error/Empty States:** All present

**Minor Findings:**
- Tab 4 "Task Progress" → "requires backend implementation" (status history, delegation history)
- Tab 5 "Task History" → "requires backend implementation" (audit log)
- These are correctly labeled as unavailable, not fake

---

### 9. ExecutionsPage.tsx (`frontend/src/pages/ExecutionsPage.tsx`)

**Components Rendered:**
- Tabs (6 tabs)
- Table (execution requests)
- Card (execution detail with history accordion)
- Tables (autonomy levels, approvals)
- List (history)
- Dialog (create execution)

**API Endpoints Called:**
- `GET /api/executions`
- `GET /api/executions/autonomy-levels`
- `GET /api/approvals`
- `GET /api/tasks` (for create dialog)
- `GET /api/executions/:id`
- `GET /api/executions/:id/history`
- `POST /api/executions` (create)
- `POST /api/executions/:id/execute`
- `POST /api/executions/:id/cancel`
- `POST /api/executions/:id/approve`

**Data Displayed:** Comprehensive execution data

**Controls:**
- All action buttons (Execute, Cancel, Approve) → FUNCTIONAL
- Create dialog → FUNCTIONAL
- Tab navigation → FUNCTIONAL

**Critical Finding (F-UI-05):**
- Reject button in Approvals tab (line 696): `onClick={() => { alert('Reject not implemented'); }}`
- No backend endpoint for execution rejection found

---

### 10. DeliverablesPage.tsx (`frontend/src/pages/DeliverablesPage.tsx`)

**Components Rendered:**
- Tabs (5 tabs)
- Table (deliverable list)
- Card (detail with content, versions, metadata)
- Accordion (version history)
- Forms (reviewer assignment, review, revision)
- Dialogs (create, review, revision)
- Rating component (quality scores)

**API Endpoints Called:**
- `GET /api/deliverables`
- `GET /api/quality-thresholds`
- `GET /api/tasks` (for create dialog)
- `GET /api/deliverables/:id`
- `GET /api/deliverables/:id/versions`
- `POST /api/deliverables` (create)
- `PUT /api/deliverables/:id/submit`
- `PUT /api/deliverables/:id/review`
- `PUT /api/deliverables/:id/revision`

**Data Displayed:** Complete deliverable workflow data

**Controls:**
- Submit, Review, Resubmit buttons → FUNCTIONAL
- Review dialog → FUNCTIONAL
- Revision dialog → FUNCTIONAL
- Create dialog → FUNCTIONAL
- Version history accordion → FUNCTIONAL

**Critical Finding (F-UI-06):**
- "Assign Reviewer" button in Reviewer Assignment tab (line 677): `onClick={() => { /* Assign reviewer API call */ }}` — **empty handler, no-op**

---

### 11. ApprovalsPage.tsx (`frontend/src/pages/ApprovalsPage.tsx`)

**Components Rendered:**
- Card with raw HTML table
- Chip indicators
- Buttons (Approve, Reject)

**API Endpoints Called:**
- `GET /api/approvals`

**Data Displayed:** Approval list with ID, execution, action, requester, priority, status

**Controls:**
- Refresh → FUNCTIONAL
- Approve Button → **BROKEN** (calls `alert('Approve: ' + id)`)
- Reject Button → **BROKEN** (calls `alert('Reject: ' + id)`)

**Loading/Error/Empty States:** Present

**Critical Finding (F-UI-04):** Both action buttons only show alerts. No API calls to approve/reject endpoints.

---

## Shared Infrastructure Audit

### App.tsx (`frontend/src/app/App.tsx`)

**Auth Context:** Provides `login`, `logout`, `refreshAuth`, `navigateAfterLogin`

**Routes:** 11 protected routes + login

**ProtectedRoute:** Redirects to `/login` if no authContext

**Critical Finding (F-UI-01):** `login()` calls `apiClient.createSession(ownerType, ownerId, runtime)` — no Founder signature parameters. Production backend requires them.

### api.ts (`frontend/src/services/api.ts`)

**Base URL:** `http://localhost:3334` (VITE_API_BASE_URL or default)

**Critical Finding (F-UI-08):** Hardcoded localhost default. No Vite proxy configuration. Will fail in production when frontend served from different origin.

### Layout.tsx (`frontend/src/layouts/Layout.tsx`)

**Navigation:** Uses `<ListItemButton component="a" href={item.path}>` — **regular anchor links**

**Critical Finding (F-UI-10):** Internal navigation causes full page reloads. Should use React Router `Link`/`NavLink`.

**Responsive:** Drawer variants for mobile/desktop — FUNCTIONAL

---

## API Contract Verification

| Endpoint | Frontend Expects | Backend Returns | Match |
|----------|------------------|-----------------|-------|
| `/api/council/seats` | `{ data: CouncilSeat[] }` | Array | ⚠️ Frontend expects wrapper |
| `/api/council/personas` | `{ data: Persona[] }` | Array | ⚠️ Frontend expects wrapper |
| `/api/council/runtime-assignments` | `{ data: RuntimePersonaAssignment[] }` | Array | ⚠️ Frontend expects wrapper |
| `/api/council/constitution` | `Constitution` | Constitution | ✅ |
| `/api/approvals` | `{ data: FounderApproval[] }` | Array | ⚠️ Frontend expects wrapper |
| `/api/meetings` | `{ meetings, limit, offset }` | Same | ✅ |
| `/api/meetings/:id` | `{ meeting: Meeting }` | Same | ✅ |
| `/api/meetings/:id/phases` | `{ phases: MeetingPhase[] }` | Same | ✅ |
| `/api/tasks` | `{ tasks, limit, offset }` | Same | ✅ |
| `/api/tasks/:id` | `{ task: Task }` | Same | ✅ |
| `/api/executions` | Array | Array | ✅ |
| `/api/deliverables` | Array | Array | ✅ |
| `/api/divisions` | `{ divisions: Division[] }` | Same | ✅ |
| `/api/staff` | `{ staff: StaffAgent[] }` | Same | ✅ |
| `/api/staff/divisions/members` | `{ members: DivisionMember[] }` | Same | ✅ |
| `/api/messages/conversations` | `Conversation[]` | Array | ✅ |
| `/api/messages/:id` | `Message[]` | Array | ✅ |

**Pattern:** Council endpoints return raw arrays but frontend expects `{ data: [...] }` wrapper. This was fixed in Phase 10 but CouncilPage still uses old pattern.

---

## TypeScript Issues

| File | Issue |
|------|-------|
| ChatPage.tsx | `Conversation` type missing `participant_name` in types/api.ts (has it) |
| ExecutionsPage.tsx | `tasks` state typed as `any[]` |
| DeliverablesPage.tsx | `tasks` state typed as `any[]` |
| TasksPage.tsx | `getOptionId` uses `(option as any)` |
| ApprovalsPage.tsx | Raw HTML table instead of MUI Table |
| Multiple | `any` types in API response handling |

---

## Accessibility Issues

| Page | Issue |
|------|-------|
| ChatPage | Search input no label, message list no ARIA live region |
| Layout | Anchor links not keyboard-navigable as SPA routes |
| ApprovalsPage | Raw `<table>` without proper headers/scope |
| Multiple | IconButtons missing aria-label in some cases |

---

## Responsive Issues

| Page | Issue |
|------|-------|
| ChatPage | Fixed 380px conversation panel, no mobile drawer (F-UI-09) |
| Dashboard | Cards stack but metrics hardcoded |
| Council | Tables horizontal scroll on mobile |
| Executions | Tables horizontal scroll on mobile |
| Deliverables | Tables horizontal scroll on mobile |

---

## Security Issues

| Issue | Location |
|-------|----------|
| No production Founder signature flow | LoginPage, App.tsx, api.ts |
| Session token in localStorage | api.ts (standard but noted) |
| No role-based UI gating | ApprovalsPage shows approve/reject to all roles |
| Hardcoded dev identities | LoginPage preset options |

---

## Summary of F-UI Findings Status

| Finding | Status | File | Fix Required |
|---------|--------|------|--------------|
| F-UI-01 Production auth | ❌ Unfixed | LoginPage, App, api, server | Separate dev/prod auth flows |
| F-UI-02 Dashboard metrics | ❌ Unfixed | DashboardPage | Fetch real API data |
| F-UI-03 Memory page | ❌ Unfixed | MemoryPage | Implement memory browsing |
| F-UI-04 Approval alerts | ❌ Unfixed | ApprovalsPage | Connect to real approve/reject APIs |
| F-UI-05 Execution reject | ❌ Unfixed | ExecutionsPage | Implement or remove reject |
| F-UI-06 Reviewer assign | ❌ Unfixed | DeliverablesPage | Connect Assign Reviewer button |
| F-UI-07 Chat errors | ❌ Unfixed | ChatPage | Search, draft preservation, error UI |
| F-UI-08 API base URL | ❌ Unfixed | api.ts | Vite proxy + env config |
| F-UI-09 Chat responsive | ❌ Unfixed | ChatPage | Mobile drawer layout |
| F-UI-10 Internal nav | ❌ Unfixed | Layout.tsx | Use React Router Link |
| F-UI-11 Founder UI | ❌ Unfixed | ApprovalsPage, Layout | Role-aware controls |
| F-UI-12 Council/Meeting placeholders | ⚠️ Documented | CouncilPage, MeetingsPage | Label unavailable or implement |
| F-UI-13 Vite scaffold | ⚠️ Pending | frontend/src/* | Audit and remove unused |
| F-UI-14 Frontend tests | ❌ Unfixed | frontend/ | Add test suite |

---

## Recommended Fix Priority

**Phase 1 (Critical - Security/Functionality):**
1. F-UI-01: Production authentication architecture
2. F-UI-08: API base URL / Vite proxy
3. F-UI-10: Internal navigation (React Router Link)

**Phase 2 (High - Broken Features):**
4. F-UI-02: Dashboard real metrics
5. F-UI-03: Memory page implementation
6. F-UI-04: Approvals real actions
7. F-UI-05: Execution reject (implement or remove)
8. F-UI-06: Deliverable reviewer assignment
9. F-UI-07: Chat error handling/search

**Phase 3 (Medium - Polish):**
10. F-UI-09: Chat responsive layout
11. F-UI-11: Role-aware UI controls
12. F-UI-12: Document placeholder tabs
13. F-UI-13: Clean Vite scaffold

**Phase 4 (Quality):**
14. F-UI-14: Frontend test suite

---

## Backend Capabilities Required

| Frontend Need | Backend Endpoint | Status |
|---------------|------------------|--------|
| Memory browsing | `GET /api/memory` (search, list) | ✅ Exists |
| Dashboard metrics | `GET /api/divisions`, `/api/staff`, `/api/approvals` | ✅ Exist |
| Approval actions | `POST /api/approvals/:id/approve`, `/reject` | ❓ Need verification |
| Execution reject | `POST /api/executions/:id/reject` | ❌ Not found |
| Reviewer assignment | `PUT /api/deliverables/:id/assign-reviewer` | ❓ Need verification |
| Task audit history | `GET /api/tasks/:id/audit` | ❌ Not implemented |
| Meeting decisions | `GET /api/meetings/:id/decisions` | ❌ Not implemented |
| Meeting action items | `GET /api/meetings/:id/action-items` | ❌ Not implemented |

**Note:** Do not invent backend endpoints. Document missing capabilities for separate backend work.

---

**End of Frontend Source Audit**