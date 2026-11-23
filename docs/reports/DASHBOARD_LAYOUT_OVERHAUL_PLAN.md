# Dashboard Layout Overhaul Plan

## 1. Current Dashboard Audit

### File Structure
```
frontend/src/features/dashboard/
├── pages/DashboardPage.tsx
├── components/
│   ├── ActivityList.tsx
│   ├── AttentionQueue.tsx
│   ├── QuickActions.tsx
│   └── StatCard.tsx
```

### Current Features
| Component | Status | Description |
|-----------|--------|-------------|
| KPI Cards | ✅ Working | 4 stat cards (Active Divisions, Staff Agents, Pending Approvals, Execution Requests) |
| Recent Activity | ✅ Working | Activity feed from `/api/activity` with type icons |
| Quick Actions | ✅ Working | Create Division, Invite Staff, Review Approvals, New Task |
| Create Dialogs | ✅ Working | Division creation, staff invitation, task creation dialogs |
| Theme Switching | ✅ Implemented | Light/dark mode toggle |
| Refresh | ✅ Working | Manual refresh button |

### Data Sources
| Section | API Endpoint | Response Type |
|---------|--------------|---------------|
| Divisions | GET /api/divisions | `{ divisions: Division[] }` |
| Staff | GET /api/staff | `{ staff: StaffAgent[] }` |
| Approvals | GET /api/approvals | `{ data: ApprovalRequest[] }` |
| Executions | GET /api/executions | `{ executions: ExecutionRequest[] }` |
| Activity | GET /api/activity | `{ activity: ActivityItem[] }` |
| Council | GET /api/council/constitution | Single constitution or null |

---

## 2. Existing Functional Behavior to Preserve

1. **4 KPI cards** with loading/error states
2. **Recent Activity** list with 10 items, pagination via scroll
3. **Quick Actions** panel with 4 primary actions
4. **Create Division dialog** with form validation
5. **Invite Staff dialog** with division selection
6. **New Task dialog** with dynamic assignee dropdown
7. **Theme persistence** across reloads
8. **Unauthorized constitution** handling (currently breaks page)

---

## 3. UX Problems and Supporting Evidence

### Problem 3.1: Constitution 404 Breaks Entire Page
- **Location:** CouncilPage.tsx
- **Evidence:** When GET /api/council/constitution returns 404, entire page fails
- **Impact:** Users cannot access other council data (seats, personas, meetings)

### Problem 3.2: Activity Type Mismatch
- **Location:** DashboardPage.tsx line 52
- **Evidence:** `ActivityItem.type` includes `'message'` but `ACTIVITY_TYPE_CONFIG` missing it
- **Impact:** Message activities may not render correctly

### Problem 3.3: No Loading State for Initial Load
- **Location:** DashboardPage.tsx lines 395-401
- **Evidence:** Shows spinner only when no data exists at all
- **Impact:** Section-level loading not distinguished from page-level

### Problem 3.4: Execution Empty Action Incomplete
- **Location:** Line 387
- **Evidence:** Empty action has empty onClick handler
- **Impact:** Clickable button with no behavior

---

## 4. Dashboard Goals and Primary User Questions

### Goals
1. **Operational Overview** - Quick snapshot of organization health
2. **Pending Work Identification** - Surface items needing attention
3. **Recent Activity Tracking** - Show what changed recently
4. **Action Availability** - Enable immediate operations

### Primary User Questions
1. "What's happening across my organization?" → KPI cards answer this
2. "What needs my attention?" → Attention/Approval section answers this
3. "Which approvals or executions are waiting?" → Filtered lists answer this
4. "What has recently changed?" → Activity timeline answers this
5. "What can I do immediately?" → Quick Actions answer this

---

## 5. Proposed Information Architecture

### A. Dashboard Header
- **Page title:** Organization Dashboard
- **Subtitle:** Real-time overview of your organization
- **Last updated:** Time of last refresh
- **Refresh button:** Manual refresh with loading state

### B. Organization Overview (4 Balanced Metrics)
1. **Active Divisions** - Count of divisions with active heads
2. **Staff Agents** - Count of active staff + total
3. **Pending Approvals** - Count of pending + total
4. **Execution Requests** - Count of pending + total

### C. Attention and Work Queue
- **Title:** "Pending Work"
- **Content:** List of pending approvals (limited to 5)
- **Each row shows:**
  - Item title (e.g., "Level 3 execution: Task #123")
  - Type badge (Approval/Execution)
  - Status
  - Timestamp
  - Clickable to navigate

### D. Recent Activity
- **Title:** "Recent Activity"
- **Type:** Vertical list with icons
- **Items per type:**
  - Task: `task-{audit_id}` → /tasks?task={task_id}
  - Deliverable: `deliverable-{memory_id}` → /deliverables?deliverable={memory_id}
  - Approval: `approval-{request_id}` → /approvals
  - Execution: `execution-{request_id}` → /executions
  - Message: `message-{id}` → /messages?conversation={id}

### E. Quick Actions
- **Create Division** → Opens dialog
- **Invite Staff** → Opens dialog
- **Review Approvals** → Navigate to /approvals
- **New Task** → Opens task creation dialog

---

## 6. Layout Wireframes

### Desktop: 1440px

```
┌─────────────────────────────────────────────────────────────────────┐
│ Organization Dashboard                 [Refresh ↻]                 │
│ Real-time overview of your organization                             │
│ Last updated 10:32:15 AM                                            │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│ │ Active       │ │ Staff        │ │ Pending      │ │ Executions   ││
│ │ Divisions    │ │ Agents       │ │ Approvals    │ │ Requests     ││
│ │ 8/10         │ │ 24/30        │ │ 3/15         │ │ 2/8          ││
│ │ ██████████░░ │ │ █████████░░░ │ │ ███░░░░░░░░  │ │ ██░░░░░░░░   ││
│ │            ↗ │ │           ↗ │ │          ↗ │ │          ↗ ││
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘│
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────┬───────────────────────────┐│
│ │ Recent Activity                     │ Quick Actions             ││
│ │                                     │                           ││
│ │ • Task completed: Task #123         │ • Create Division         ││
│ │   Task • 10 min ago                 │ • Invite Staff            ││
│ │ • Approval requested: exec-456      │ • Review Approvals        ││
│ │   Approval • 15 min ago             │ • New Task                ││
│ │ • Staff invited: new hire           │                           ││
│ │   Staff • 22 min ago              │                           ││
│ │ ... (up to 10 items)                │                           ││
│ │                                     │                           ││
│ │ No recent activity? Create a task.  │ Visit Organization for    ││
│ │ [Create Task]                       │ full management           ││
│ └─────────────────────────────────────┴───────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### Laptop: 1024px

```
┌───────────────────────────────────────────────────────────────────┐
│ Organization Dashboard                    [Refresh ↻]              │
├───────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│ │ Active       │ │ Staff        │ │ Pending      │ │ Executions   ││
│ │ Divisions    │ │ Agents       │ │ Approvals    │ │ Requests     ││
│ │ 8/10         │ │ 24/30        │ │ 3/15         │ │ 2/8          ││
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘│
│ ┌─────────────────────────────────────┐ ┌─────────────────────────┐│
│ │ Recent Activity                     │ │ Quick Actions           ││
│ │ ┌─────────────────────────────────┐ │ │ • Create Division       ││
│ │ │ Task #123 completed             │ │ │ • Invite Staff          ││
│ │ │ Task • 10 min ago               │ │ │ • Review Approvals      ││
│ │ ├─────────────────────────────────┤ │ │ • New Task              ││
│ │ │ Approval requested              │ │ └─────────────────────────┘│
│ │ │ Approval • 15 min ago           │ │                           ││
│ │ └─────────────────────────────────┘ │                           ││
│ └─────────────────────────────────────┘                           │
└───────────────────────────────────────────────────────────────────┘
```

### Tablet: 768px

```
┌─────────────────────────────────────────────────┐
│ Organization Dashboard           [Refresh ↻]    │
├─────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐              │
│ │ Active       │ │ Staff        │              │
│ │ Divisions    │ │ Agents       │              │
│ │ 8/10         │ │ 24/30        │              │
│ └──────────────┘ └──────────────┘              │
│ ┌──────────────┐ ┌──────────────┐              │
│ │ Pending      │ │ Executions   │              │
│ │ Approvals    │ │ Requests     │              │
│ │ 3/15         │ │ 2/8          │              │
│ └──────────────┘ └──────────────┘              │
│ ┌─────────────────────────────────────────────┐ │
│ │ Recent Activity                             │ │
│ │ • Task #123 completed                       │ │
│ │ • Approval requested                        │ │
│ │                                             │ │
│ │ [Create Task]     [View All]                │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ Quick Actions                               │ │
│ │ [Create Division]                           │ │
│ │ [Invite Staff]                              │ │
│ │ [Review Approvals]                          │ │
│ │ [New Task]                                  │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Mobile: 375px

```
┌──────────────────────────────────────────────┐
│ Organization Dashboard          [Refresh ↻]  │
├──────────────────────────────────────────────┤
│ ┌──────────────┐                            │
│ │ Active       │                            │
│ │ Divisions    │                            │
│ │ 8/10         │                            │
│ └──────────────┘                            │
│ ┌──────────────┐                            │
│ │ Staff        │                            │
│ │ Agents 24/30 │                            │
│ └──────────────┘                            │
│ ┌──────────────┐                            │
│ │ Pending      │                            │
│ │ Approvals    │                            │
│ │ 3/15         │                            │
│ └──────────────┘                            │
│ ┌──────────────┐                            │
│ │ Executions   │                            │
│ │ 2/8          │                            │
│ └──────────────┘                            │
│ ┌──────────────────────────────────────────┐ │
│ │ Recent Activity                           │ │
│ │ Task #123 completed (10m ago)            │ │
│ │ Approval requested (15m ago)             │ │
│ │ [View All]                                │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ Quick Actions                              │ │
│ │ [+ Create]                                │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

---

## 7. Component Inventory

| Component | Purpose | Data Source |
|-----------|---------|-------------|
| `StatCard` | KPI display | Divisions: /api/divisions, Staff: /api/staff, Approvals: /api/approvals, Executions: /api/executions |
| `ActivityList` | Recent activity feed | /api/activity |
| `QuickActions` | Action shortcuts | Local handlers + API calls |
| `AttentionQueue` | Pending items | Filter from approvals/executions |
| `CreateDivisionDialog` | Add division form | POST /api/divisions |
| `InviteStaffDialog` | Add staff form | POST /api/staff |
| `NewTaskDialog` | Create task form | POST /api/tasks |

---

## 8. Proposed Atomic Design Mapping

```
Atoms:
- MetricCard (displays value + label)
- ActivityItem (activity row)
- ActionButton (quick action)
- LoadingSpinner
- ErrorBanner
- DataListItem

Molecules:
- KPIGroup (4 StatCards in grid)
- ActivityFeed (list of ActivityItems)
- QuickActionBar (list of ActionButtons)
- SectionHeader (title + optional subtitle)

Organisms:
- DashboardOverview (KPIGroup + AttentionQueue + ActivityFeed + QuickActions)
- DialogContainer (CreateDivisionDialog, InviteStaffDialog, NewTaskDialog)

Pages:
- DashboardPage (data orchestration, error handling, loading states)
```

---

## 9. API/Data-Source Mapping

### Section: Organization Overview
| Metric | API | Auth Required | Data |
|--------|-----|---------------|------|
| Active Divisions | GET /api/divisions | Founder, Division Head | Filter divisions with head_staff_id |
| Staff Agents | GET /api/staff | Founder, Division Head | Count active by status |
| Pending Approvals | GET /api/approvals | Founder | Filter status='pending' |
| Execution Requests | GET /api/executions | Founder | Filter pending statuses |

### Section: Recent Activity
| Endpoint | Response | Auth |
|----------|----------|------|
| GET /api/activity | { activity: ActivityItem[] } | Founder, Division, Staff |
| Founder: all items | | |
| Division: filtered | | |
| Staff: own items only | | |

### Section: Quick Actions
| Action | Endpoint | Method | Required |
|--------|----------|--------|----------|
| Create Division | /api/divisions | POST | Founder |
| Invite Staff | /api/staff | POST | Founder |
| Review Approvals | /api/approvals | GET | Founder |
| Create Task | /api/tasks | POST | Founder |

---

## 10. Loading, Error, Empty, and Success States

### Success State
- All 4 KPI cards visible with values
- Activity feed shows last 10 items
- Quick actions panel visible

### Loading State (per section)
- StatCard: Shows skeleton with 2 lines (label, value)
- Activity: Shows 3 skeleton rows
- Overall: Header persists

### Error State
- Red Alert banner at top
- Individual card shows error message
- Retry button in error card

### Empty State
- Info icon + "No recent activity" text
- Descriptive message: "Activity appears when tasks, approvals, etc. happen"
- Call-to-action button: "Create your first task"

---

## 11. Interaction Specifications

### Refresh
- Click button → Sets loading state → Fetches all sections → Updates timestamp

### Stat Card Click
- Navigate to relevant page (e.g., clicks Executions → /executions)

### Activity Item Click
- Navigate to detail page (if href exists)

### Quick Action Click
- Founder: Open appropriate dialog
- Non-Founder: May need different handling (disabled, navigate)

### Dialog Actions
- Cancel: Close dialog
- Submit: Show loading state, call API, show success/error snackbar, reset form

---

## 12. Accessibility Requirements

- All interactive elements must have accessible labels
- Keyboard navigation through tabs and arrows
- Focus visible on interactive elements
- ARIA labels for icon buttons
- Color used with text (not only) for status

---

## 13. Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| 1440px | 4-column stat grid, 2-column activity/actions |
| 1024px | 4-column stat grid, 2-column activity/actions |
| 768px | 2x2 stat grid, stacked activity/actions |
| 375px | Single column, stat cards stack vertically |

---

## 14. Exact Proposed File Changes

### New Files (if needed)
- `ActionCard.tsx` - Reusable action button component

### Modified Files
1. `DashboardPage.tsx` - Refactor into smaller components
2. `StatCard.tsx` - May need minor adjustments
3. `ActivityList.tsx` - Potentially extract `ActivityItem`

### Unchanged Files
- All other dashboard components remain as-is
- Theme configuration remains as-is

---

## 15. Components/Files That Must Remain Untouched

- `frontend/src/shared/theme/use-theme-store.tsx` - Already correct MUI 9 ThemeProvider
- `frontend/src/app/App.tsx` - Application shell routing
- Authentication and authorization middleware
- API route handlers

---

## 16. Implementation Sequence

1. **Phase 1:** Refactor DashboardPage into components
   - Extract StatCard to separate file
   - Extract ActivityList to separate file
   - Extract QuickActions to separate file

2. **Phase 2:** Fix Activity type mismatch
   - Add 'message' type to ACTIVITY_TYPE_CONFIG

3. **Phase 3:** Add Constitution 404 resilience
   - Make constitution section independent
   - Add empty state for missing constitution

4. **Phase 4:** Improve empty states
   - Add proper empty action handlers
   - Improve messaging for empty states

---

## 17. Regression and Acceptance Tests

### Required Tests
1. Founder can see all 4 KPI cards populated
2. Division head sees division-scoped metrics
3. Staff sees their own metrics
4. Theme toggles correctly and persists
5. Activity feed shows items with correct types
6. Clicking activity navigates correctly
7. Dialog forms validate and submit
8. Error states render correctly
9. Loading states render correctly
10. Empty states render with CTA

### Test Commands
```
npm test -- tests/unit/dashboard.test.ts
npm run test:e2e -- dashboard
```

---

## 18. Risks, Dependencies, and Unresolved Questions

### Risks
- **Low:** Refactoring may introduce bugs - covered by existing tests
- **Medium:** Constitution 404 handling needs careful implementation
- **Low:** Theme changes may affect other pages using same themes

### Dependencies
- MUI 9 (already installed)
- Existing API contracts (must not change)
- Theme context (must preserve persistence)

### Unresolved Questions
1. Should pending approvals show in attention queue or elsewhere?
2. What is the exact definition of "pending approval" for executions vs tasks?
3. Should there be a "view all" link for activity feed?

---

## 19. Design Principles Preserved

- MUI 9 remains the component framework
- Inter remains the typography
- Governance Blue remains primary accent
- Organization Purple remains secondary accent
- Light and dark palette values remain unchanged
- 8px spacing rhythm remains
- Content max width remains 1200px
- Information density remains purposeful

---

## 20. Next Steps

1. ⏳ **Created this plan** - Ready for Founder review
2. ❌ **Do NOT implement** until Founder approves
3. ✓ **Run tests** after any implementation

---