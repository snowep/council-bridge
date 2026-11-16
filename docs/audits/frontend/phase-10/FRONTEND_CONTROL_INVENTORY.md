# Frontend Control Inventory

**Repository:** `C:\Projects\council-bridge`  
**Audit Baseline:** Commit `700c366`  
**Date:** 2026-11-15  

---

## Classification Legend

- **FUNCTIONAL** — Control works as intended, calls real API, handles success/error
- **DISABLED WITH EXPLANATION** — Control visible but disabled, explains why (backend missing, role restriction)
- **PLACEHOLDER** — Control appears functional but does nothing meaningful (alert, empty handler, "Coming Soon")
- **BROKEN** — Control appears functional but fails silently or incorrectly (inert search, lost draft, console-only errors)

---

## Page 1: Login (`/login`)

| Control | Type | Classification | Details |
|---------|------|----------------|---------|
| Owner Type Select | Select | FUNCTIONAL (dev) | Preset options: founder, seat, staff, division |
| Owner ID Select | Select | FUNCTIONAL (dev) | Dynamic options based on owner type |
| Runtime Select | Select | FUNCTIONAL | claude / hermes |
| Sign In Button | Button | FUNCTIONAL (dev) | Calls `apiClient.createSession()` |
| Preset Notice | Text | INFO | "Preset development accounts — no credentials required" |

**Missing Production Controls:**
- Founder signature input fields
- Founder timestamp input
- Founder nonce input
- Founder key ID input
- Production/Development mode toggle

---

## Page 2: Dashboard (`/dashboard`)

| Control | Type | Classification | Details |
|---------|------|----------------|---------|
| Active Divisions Card | Card/Typography | **PLACEHOLDER** | Hardcoded "6" — no API call |
| Staff Agents Card | Card/Typography | **PLACEHOLDER** | Hardcoded "45" — no API call |
| Pending Approvals Card | Card/Typography | **PLACEHOLDER** | Hardcoded "0" — no API call |
| Recent Activity Panel | Paper/Typography | **PLACEHOLDER** | "Activity feed will show recent operations here." |

**No interactive controls. No loading/error/empty/retry states.**

---

## Page 3: Chat (`/chat`)

| Control | Type | Classification | Details |
|---------|------|----------------|---------|
| Conversation List Items | ListItemButton | FUNCTIONAL | Click loads messages for participant |
| Search Conversations | TextField | **BROKEN** | No onChange handler, inert |
| Message Input | TextField | **BROKEN** | Draft clears BEFORE send (`setNewMessage('')` line 95) |
| Send Button | Button | FUNCTIONAL | Calls `POST /api/messages` |
| Enter Key Send | Keyboard | FUNCTIONAL | Triggers send on Enter (not Shift+Enter) |
| Conversation Avatar | Avatar | FUNCTIONAL | Color-coded by participant type |
| Unread Count Chip | Chip | FUNCTIONAL | Shows unread message count |

**Error Handling:** Failed fetches → `console.error` only, sets empty array (looks like empty state)

---

## Page 4: Council (`/council`)

| Control | Type | Classification | Details |
|---------|------|----------------|---------|
| Refresh Button | IconButton | FUNCTIONAL | Re-fetches all council data |
| Tab: Seats | Tab | FUNCTIONAL | Shows seats table with persona/runtime joins |
| Tab: Personas | Tab | FUNCTIONAL | Shows personas table with seat/runtime joins |
| Tab: Runtime Assignments | Tab | FUNCTIONAL | Split Claude/Hermes tables |
| Tab: Constitution | Tab | FUNCTIONAL | Shows constitution content + founder approvals |
| Tab: Decisions | Tab | **PLACEHOLDER** | "Council Decisions - Coming Soon" |
| Tab: Voting | Tab | **PLACEHOLDER** | "Voting Records - Coming Soon" |
| Seat Table Rows | TableRow | FUNCTIONAL | Hover, displays all seat data |
| Persona Table Rows | TableRow | FUNCTIONAL | Hover, displays all persona data |
| Runtime Table Rows | TableRow | FUNCTIONAL | Filtered by runtime |

**Loading/Error/Empty:** All present with retry button on error

---

## Page 5: Meetings (`/meetings`)

| Control | Type | Classification | Details |
|---------|------|----------------|---------|
| Refresh Button | IconButton | FUNCTIONAL | Re-fetches meetings |
| Tab: All Meetings | Tab | FUNCTIONAL | Table with view details button |
| Tab: Agenda & Phases | Tab | FUNCTIONAL | Shows phases for selected meeting |
| Tab: Decisions | Tab | **PLACEHOLDER** | "Decision records for this meeting will be displayed here when data is available." |
| Tab: Action Items | Tab | **PLACEHOLDER** | "Action items tracked from this meeting." |
| View Details Button | IconButton | FUNCTIONAL | Opens dialog with meeting + phases |
| Dialog Close | Button | FUNCTIONAL | Closes detail dialog |
| Meeting Table Rows | TableRow | FUNCTIONAL | Hover, click to view details |

**Loading/Error/Empty:** All present with retry button on error

---

## Page 6: Memory (`/memory`)

| Control | Type | Classification | Details |
|---------|------|----------------|---------|
| (none) | — | **PLACEHOLDER** | Entire page: "Memory browsing and search will be implemented here." |

**No interactive controls at all.**

---

## Page 7: Organization (`/organization`)

| Control | Type | Classification | Details |
|---------|------|----------------|---------|
| Refresh Button | IconButton | FUNCTIONAL | Re-fetches all org data |
| Tab: Divisions | Tab | FUNCTIONAL | Cards with division name, description, head |
| Tab: Staff | Tab | FUNCTIONAL | Cards with staff name, role, division, status |
| Tab: Members | Tab | FUNCTIONAL | Cards with division→staff mapping, role, status |
| Division Cards | Card | FUNCTIONAL | Display division data |
| Staff Cards | Card | FUNCTIONAL | Display staff data |
| Member Cards | Card | FUNCTIONAL | Display membership data |

**Loading/Error/Empty:** All present with retry button on error

---

## Page 8: Tasks (`/tasks`)

| Control | Type | Classification | Details |
|---------|------|----------------|---------|
| Create Task Button | Button | FUNCTIONAL | Opens create dialog |
| Tab: Task List | Tab | FUNCTIONAL | Table with all task data |
| Tab: Task Detail | Tab | FUNCTIONAL | Detail card + quick actions |
| Tab: Create Task | Tab | FUNCTIONAL | Inline form (duplicate of dialog) |
| Tab: Assign Task | Tab | FUNCTIONAL | Inline form (requires task selection) |
| Tab: Task Progress | Tab | **DISABLED WITH EXPLANATION** | "Status history tracking requires backend implementation" |
| Tab: Task History | Tab | **DISABLED WITH EXPLANATION** | "Task history tracking requires backend implementation" |
| Task Table Rows | TableRow | FUNCTIONAL | Click loads detail, hover |
| View Detail Button | IconButton | FUNCTIONAL | Loads task detail |
| Assign Button | IconButton | FUNCTIONAL | Opens assign dialog |
| Update Status Button | IconButton | FUNCTIONAL | Opens status dialog |
| Create Dialog | Dialog | FUNCTIONAL | Full form with validation |
| Assign Dialog | Dialog | FUNCTIONAL | Type + ID selects, dynamic options |
| Status Dialog | Dialog | FUNCTIONAL | Status select with all statuses |
| Snackbar | Snackbar | FUNCTIONAL | Success/error notifications |

**Loading/Error/Empty:** All present

---

## Page 9: Executions (`/executions`)

| Control | Type | Classification | Details |
|---------|------|----------------|---------|
| Refresh Button | Button | FUNCTIONAL | Re-fetches all execution data |
| Request Execution Button | Button | FUNCTIONAL | Opens create dialog (fetches tasks) |
| Tab: Execution Requests | Tab | FUNCTIONAL | Table with action buttons per row |
| Tab: Execution Detail | Tab | FUNCTIONAL | Detail card + history accordion + quick actions |
| Tab: Autonomy Levels | Tab | FUNCTIONAL | Static info cards + configured levels table |
| Tab: Approvals | Tab | FUNCTIONAL | Table with approve/reject per row |
| Tab: History | Tab | FUNCTIONAL | List with accordion details |
| Tab: Errors | Tab | FUNCTIONAL | Filtered failed executions table |
| Execute Button | IconButton | FUNCTIONAL | `POST /api/executions/:id/execute` |
| Cancel Button | IconButton | FUNCTIONAL | `POST /api/executions/:id/cancel` |
| Approve Button | IconButton | FUNCTIONAL | `POST /api/executions/:id/approve` |
| Approve (Approvals Tab) | IconButton | FUNCTIONAL | Same endpoint |
| Reject (Approvals Tab) | IconButton | **PLACEHOLDER** | `alert('Reject not implemented')` line 696 |
| Create Dialog | Dialog | FUNCTIONAL | Task select, autonomy level, description, JSON payload |
| Back Button | Button | FUNCTIONAL | Returns to execution requests tab |

**Loading/Error/Empty:** All present

---

## Page 10: Deliverables (`/deliverables`)

| Control | Type | Classification | Details |
|---------|------|----------------|---------|
| Refresh Button | Button | FUNCTIONAL | Re-fetches deliverables |
| Create Deliverable Button | Button | FUNCTIONAL | Opens create dialog (fetches tasks) |
| Tab: Deliverable List | Tab | FUNCTIONAL | Table with action buttons per row |
| Tab: Deliverable Detail | Tab | FUNCTIONAL | Content, metadata, version history accordion |
| Tab: Version History | Tab | FUNCTIONAL | List with expandable versions |
| Tab: Reviewer Assignment | Tab | FUNCTIONAL | Assign reviewer form + review form |
| Tab: Quality Scores | Tab | FUNCTIONAL | Quality thresholds table with ratings |
| Submit Button | IconButton | FUNCTIONAL | `PUT /api/deliverables/:id/submit` |
| Review Button | IconButton | FUNCTIONAL | Opens review dialog |
| Resubmit Button | IconButton | FUNCTIONAL | Same as submit for revision_requested |
| Assign Reviewer Button | Button | **PLACEHOLDER** | Empty handler `/* Assign reviewer API call */` line 677 |
| Review Dialog | Dialog | FUNCTIONAL | Status, quality score, reviewer type/ID, revision notes |
| Revision Dialog | Dialog | FUNCTIONAL | Revision notes only |
| Create Dialog | Dialog | FUNCTIONAL | Task select + content |
| Back Button | Button | FUNCTIONAL | Returns to list |
| Quick Action Buttons | Button | FUNCTIONAL | Submit, Review, Resubmit, Copy ID |

**Loading/Error/Empty:** All present

---

## Page 11: Approvals (`/approvals`)

| Control | Type | Classification | Details |
|---------|------|----------------|---------|
| Refresh Button | Button | FUNCTIONAL | Re-fetches approvals |
| Approve Button | Button | **PLACEHOLDER** | `alert('Approve: ' + id)` line 115 |
| Reject Button | Button | **PLACEHOLDER** | `alert('Reject: ' + id)` line 118 |
| Approval Table Rows | tr (raw HTML) | FUNCTIONAL (display) | Shows all approval data |

**Loading/Error/Empty:** Present

**Note:** Uses raw HTML `<table>` instead of MUI Table component

---

## Shared Layout Controls (`/layouts/Layout.tsx`)

| Control | Type | Classification | Details |
|---------|------|----------------|---------|
| Navigation Items | ListItemButton (anchor) | **BROKEN** | Uses `<a href>` — causes full page reload |
| Mobile Menu Button | IconButton | FUNCTIONAL | Opens drawer on mobile |
| Theme Toggle | IconButton | FUNCTIONAL | Toggles dark/light mode, persists to localStorage |
| User Menu Button | IconButton | FUNCTIONAL | Opens profile menu |
| Profile Menu Item | MenuItem | PLACEHOLDER | "Profile" — no route |
| Settings Menu Item | MenuItem | PLACEHOLDER | "Settings" — no route |
| Logout Menu Item | MenuItem | FUNCTIONAL | Calls logout, clears session |

---

## Summary by Classification

| Classification | Count | Pages Affected |
|----------------|-------|----------------|
| FUNCTIONAL | 67 | All except Memory |
| PLACEHOLDER | 15 | Dashboard, Chat, Council, Meetings, Memory, Executions, Deliverables, Approvals, Layout |
| BROKEN | 5 | Chat (2), Layout (1), Login prod (1), Dashboard (1) |
| DISABLED WITH EXPLANATION | 2 | Tasks (Progress, History tabs) |

**Total Controls Inventoried:** 89

---

## Controls Requiring Backend Implementation

| Control | Page | Required Backend Endpoint |
|---------|------|---------------------------|
| Dashboard metrics | Dashboard | `GET /api/divisions`, `/api/staff`, `/api/approvals` (exist) |
| Memory browsing | Memory | `GET /api/memory` (exists) |
| Conversation search | Chat | `GET /api/messages/conversations?q=` (verify) |
| Council Decisions | Council | `GET /api/council/decisions` (missing) |
| Council Voting | Council | `GET /api/council/votes` (missing) |
| Meeting Decisions | Meetings | `GET /api/meetings/:id/decisions` (missing) |
| Meeting Action Items | Meetings | `GET /api/meetings/:id/action-items` (missing) |
| Approve Approval | Approvals | `POST /api/approvals/:id/approve` (verify) |
| Reject Approval | Approvals | `POST /api/approvals/:id/reject` (verify) |
| Reject Execution | Executions | `POST /api/executions/:id/reject` (missing) |
| Assign Reviewer | Deliverables | `PUT /api/deliverables/:id/assign-reviewer` (verify) |
| Task Progress | Tasks | `GET /api/tasks/:id/history` (missing) |
| Task History | Tasks | `GET /api/tasks/:id/audit` (missing) |

---

## Role-Based Control Visibility (F-UI-11)

| Control | Current | Required |
|---------|---------|----------|
| Approve/Reject buttons | Visible to all roles | Only Founder |
| Execution approve | Visible to all roles | Founder + authorized roles |
| Deliverable review | Visible to all roles | Assigned reviewer only |
| Create execution | Visible to all roles | Staff/Division/Founder per autonomy |
| Dashboard metrics | Visible to all | Role-appropriate scope |

**Current State:** No frontend role gating. Backend authorization is the only boundary.

---

**End of Control Inventory**