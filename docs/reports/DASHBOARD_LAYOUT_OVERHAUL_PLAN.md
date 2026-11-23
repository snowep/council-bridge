# Dashboard Layout Overhaul Plan

**Status**: PLAN ONLY — Implementation requires Founder approval

---

## 1. Current Dashboard Audit

### File: `frontend/src/features/dashboard/pages/DashboardPage.tsx`

**Structure**: React functional component using Zustand state management

**Data Sources** (all via REST API):
| Section | Endpoint | Data |
|---------|----------|------|
| KPI Cards | `/api/divisions`, `/api/staff`, `/api/approvals`, `/api/executions` | Counts and lists |
| Recent Activity | `/api/activity` (implied) | Activity feed |
| Quick Actions | Internal handlers | Dialogs |

**Loading Behavior**: Single `loading` boolean; all sections share same state
**Error Behavior**: Single `error` string; one failure blocks all rendering
**Theme**: Uses `Experimental_CssVarsProvider` (deprecated in MUI 9)

---

## 2. Functional Behavior to Preserve

1. **4 KPI Cards**: Active Divisions, Staff Agents, Pending Approvals, Execution Requests
2. **Refresh Button**: Re-fetches all data
3. **Quick Action Dialogs**: Create Division, Invite Staff, Review Approvals, New Task
4. **Responsive Grid**: Mobile-friendly layout
5. **Theme Toggle**: Light/Dark mode toggle

---

## 3. UX Problems (Evidence)

| Problem | Evidence | Impact |
|---------|----------|--------|
| Constitution 404 breaks entire page | See C2 fix above | User sees error instead of data |
| Single loading state for all sections | `loading: boolean` | Poor UX when one section slow |
| Single error state blocks everything | `error: string \| null` | One failure = blank page |
| Uses deprecated MUI provider | TypeScript warning | Future compatibility risk |
| Missing "system" theme option | DESIGN.md specifies 3-way | Inconsistent with spec |
| Colors don't use semantic tokens | MUI colors in components | Inconsistent with design system |
| No error retry per-section | Global error only | Cannot recover individual section |

---

## 4. Dashboard Goals

Primary questions for the Founder:
1. What is happening across the organization?
2. What needs my attention?
3. Which approvals or executions are waiting?
4. What has recently changed?
5. What can I do immediately?

---

## 5. Proposed Information Architecture

### A. Dashboard Header
- **Title**: "Organization Dashboard"
- **Summary**: "Active monitoring and control center"
- **Last Updated**: Timestamp from last refresh
- **Refresh Action**: Button with RefreshOutlined icon
- **Primary Action**: Theme toggle (light/dark/system)

### B. Organization Overview (4 KPI Cards)

| Metric | Source | Definition |
|--------|--------|------------|
| Active Divisions | `/api/divisions` | Count of divisions with head_staff_id |
| Staff Agents | `/api/staff` | Count of active staff |
| Pending Approvals | `/api/approvals` | Count with status='pending' |
| Execution Requests | `/api/executions` | Count with status='requested' or 'approved' |

Each card:
- Loading skeleton when data fetching
- Error state with retry button
- Clickable → navigates to relevant page
- Shows total count (e.g., "3 of 7")

### C. Attention and Work Queue

**Purpose**: Show pending operational work

**Content**:
- Pending Approvals (from `/api/approvals`)
- Execution Requests Awaiting Action (from `/api/executions`)

**Row fields**:
- Item title/description
- Type (approval/execution)
- Status
- Assignee (when available)
- Created timestamp
- Action button → navigate or open dialog

### D. Recent Activity

**Source**: `/api/activity` (confirm endpoint exists)

**Fields**:
- Activity type icon
- Event title
- Timestamp (relative: "2 hours ago")
- Related entity (task, deliverable, etc.)
- Navigation destination (when applicable)

### E. Quick Actions

**Existing actions** (preserve):
- Create Division → opens dialog
- Invite Staff → opens dialog  
- Review Approvals → navigates to /approvals
- New Task → navigates to /tasks?create

**Layout**: Grid of outlined buttons with icons

### F. Organization Snapshot (optional)

**Data**:
- Division count
- Staff count
- Next review date (if any)

**Decision**: Omit if no reliable data source. Add as future enhancement.

---

## 6. Layout Wireframes

### Desktop: 1440px

```
┌─────────────────────────────────────────────────────────────────────┐
│  Header: Organization Dashboard                 [Refresh] [Theme]  │
├─────────────────────────────────────────────────────────────────────┤
│  KPI Cards (4 columns)                                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ Divisions   │ │ Staff       │ │ Approvals   │ │ Executions  │  │
│  │ 3           │ │ 12          │ │ 2 pending   │ │ 1 waiting   │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│  Attention Queue (2 columns)                                       │
│  ┌─────────────────────────────────┐ ┌───────────────────────────┐│
│  │ Pending Approvals               │ │ Execution Requests        ││
│  │ 1. Submit Q3 Plan (Task #123)   │ │ 1. Market Analysis        ││
│  │ 2. Budget Review (Task #456)  │ │    - Status: Approved     ││
│  └─────────────────────────────────┘ └───────────────────────────┘│
├─────────────────────────────────────────────────────────────────────┤
│  Recent Activity                                                   │
│  Activity Feed (List)                                                │
│  • Task created: Q3 Marketing Plan (2 hours ago)                     │
│  • Division activated: Analytics (4 hours ago)                       │
│  • Approval granted: Budget review (6 hours ago)                     │
├─────────────────────────────────────────────────────────────────────┤
│  Quick Actions                                                     │
│  [Create Division] [Invite Staff] [New Task] [Review Approvals]    │
└─────────────────────────────────────────────────────────────────────┘
```

### Laptop: 1024px

```
┌─────────────────────────────────────────────────┐
│  Header: Organization Dashboard                 │
├─────────────────────────────────────────────────┤
│  KPI Cards (2x2 grid)                           │
│  ┌─────────────┐ ┌─────────────┐              │
│  │ Divisions   │ │ Staff       │              │
│  └─────────────┘ ┌─────────────┐              │
│  │ Approvals   │ │ Executions  │              │
│  └─────────────┘                                   │
├─────────────────────────────────────────────────┤
│  Attention Queue (single column)                │
│  ┌─────────────────────────────────┐             │
│  │ Pending Approvals               │             │
│  └─────────────────────────────────┘             │
├─────────────────────────────────────────────────┤
│  Recent Activity                                │
│  ┌─────────────────────────────────┐             │
│  │ Activity: Task created...       │             │
│  └─────────────────────────────────┘             │
├─────────────────────────────────────────────────┤
│  Quick Actions (stacked)                        │
│  [Create Division] [Invite Staff]               │
│  [New Task] [Review Approvals]                  │
└─────────────────────────────────────────────────┘
```

### Tablet: 768px

```
┌───────────────────────────────────────────┐
│  KPI Cards (2 columns)                    │
│  ┌─────────────┐ ┌─────────────┐         │
│  │ Divisions   │ │ Staff       │         │
│  └─────────────┘ ┌─────────────┐         │
│  │ Approvals   │ │ Executions  │         │
│  └─────────────┘                      │
├───────────────────────────────────────────┤
│  Section content stacked vertically       │
└───────────────────────────────────────────┘
```

### Mobile: 375px

```
┌─────────────────────────────────────┐
│  KPI Cards (1 column)               │
│  ┌───────────────────────────────┐  │
│  │ Active Divisions: 3           │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ Staff Agents: 12              │  │
│  └───────────────────────────────┘  │
│  ... (all 4 cards)                │
├─────────────────────────────────────┤
│  Attention Queue (collapsible)      │
│  Pending Approvals                  │
│  [item 1]                           │
├─────────────────────────────────────┤
│  Quick Actions (single row)         │
│  [C] [I] [N] [R]                    │
│  Icons only, tooltip on hover       │
└─────────────────────────────────────┘
```

---

## 7. Component Inventory

| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| StatCard | shared/ui/molecules | Used | KPI display |
| ActivityList | dashboard-specific | Proposed | Activity feed |
| QuickActions | dashboard-specific | Proposed | Action buttons |
| LoadingSkeleton | shared/ui/atoms | Used | Loading states |
| ErrorBoundary | shared/ui/organisms | Used | Error display |

---

## 8. Proposed Atomic Design Mapping

| Type | Component | Purpose |
|------|-----------|---------|
| **Atoms** | MUI Button, Chip, Typography | Base UI |
| **Atoms** | StatCard (molecule wrapper) | Metric display |
| **Molecules** | KPIRow | Group of 4 stat cards |
| **Molecules** | ActivityRow | Single activity item |
| **Molecules** | ActionButton | Quick action grid item |
| **Organisms** | AttentionQueue | Pending work area |
| **Organisms** | ActivityPanel | Recent activity list |
| **Organisms** | QuickActionPanel | Action buttons grid |
| **Templates** | DashboardTemplate | Main layout grid |
| **Pages** | DashboardPage | Data orchestration |

---

## 9. API/Data-Source Mapping

| Section | Endpoint | Method | Response Type | Auth Required |
|---------|----------|--------|---------------|---------------|
| Divisions | `/api/divisions` | GET | `{ divisions: Division[] }` | Yes |
| Staff | `/api/staff` | GET | `{ staff: StaffAgent[] }` | Yes |
| Approvals | `/api/approvals` | GET | `{ approvals: ApprovalRequest[] }` | Yes |
| Executions | `/api/executions` | GET | `{ executions: ExecutionRequest[] }` | Yes |
| Activity | `/api/activity` | GET | `{ activities: Activity[] }` | Yes (verify) |
| Quick Actions | Internal | - | - | - |

---

## 10. States Design

### Loading States
- Per-section skeleton loader
- Full-page loader only if no data available

### Error States
- Per-section error chip with retry
- Non-blocking (other sections render)

### Empty States
- Stat cards: "0" with descriptive label
- Lists: Centered text "No items found"

### Success States
- All data rendered, responsive

---

## 11. Interaction Specifications

| Element | Interaction | Result |
|---------|-------------|--------|
| KPI Card | Click | Navigate to related page |
| Refresh Button | Click | Re-fetch all sections |
| Retry Button | Click | Re-fetch section |
| Quick Action | Click | Open dialog or navigate |
| Theme Toggle | Click | Toggle light/dark/system |
| Activity Item | Click (when linkable) | Navigate to entity |

---

## 12. Accessibility Requirements

- WCAG 2.2 AA compliance
- Keyboard navigation via Tab
- Focus indicators on interactive elements
- ARIA labels for tab panels
- Color contrast ≥ 4.5:1
- Status conveyed by text AND color

---

## 13. Responsive Behavior

| Breakpoint | Columns | Notes |
|------------|---------|-------|
| 1440px | 4 KPI | Full desktop layout |
| 1024px | 2 KPI | Laptop, stacked sections |
| 768px | 2 KPI | Tablet, single column |
| 375px | 1 KPI | Mobile, condensed |
| 320px | 1 KPI | Small mobile, no horizontal scroll |

---

## 14. Exact Proposed File Changes

### New Files (pending approval):
- `frontend/src/features/dashboard/components/StatCard.tsx`
- `frontend/src/features/dashboard/components/ActivityList.tsx`
- `frontend/src/features/dashboard/components/QuickActions.tsx`
- `frontend/src/features/dashboard/components/AttentionQueue.tsx`

### Modified Files:
- `frontend/src/features/dashboard/pages/DashboardPage.tsx` — Refactor for independent loading
- `frontend/src/shared/theme/use-theme-store.tsx` — Fix MUI provider (DONE)
- `frontend/src/shared/types/api.ts` — Add missing API types if needed

---

## 15. Components to Remain Untouched

- `App.tsx` — Authentication boundary
- `Layout.tsx` — Shell structure
- Theme configuration in `shared/theme/`
- API client in `shared/api/`

---

## 16. Implementation Sequence

1. Fix MUI provider (DONE)
2. Refactor DashboardPage for independent loading
3. Create StatCard component
4. Create AttentionQueue component
5. Create ActivityList component
6. Create QuickActions component
7. Add section-level error boundaries
8. Add loading skeletons per section
9. Implement theme system toggle
10. Add integration tests

---

## 17. Regression and Acceptance Tests

| Test | Description | Status |
|------|-------------|--------|
| TC01 | Light mode renders correctly | Pending |
| TC02 | Dark mode renders correctly | Pending |
| TC03 | Theme persists after reload | Pending |
| TC04 | Loading states show correctly | Pending |
| TC05 | Error states recover with retry | Pending |
| TC06 | KPI cards navigate correctly | Pending |
| TC07 | Responsive breakpoints work | Pending |
| TC08 | Keyboard navigation passes | Pending |
| TC09 | No horizontal overflow at any breakpoint | Pending |

---

## 18. Risks, Dependencies, Unresolved Questions

| Risk | Mitigation | Owner |
|------|------------|-------|
| Activity endpoint may not exist | Verify API first | Pending |
| Constitution 404 may need special handling | Already handled | DONE |
| Theme system "system" option requires additional logic | Implement after approval | Pending |
| Semantic color tokens not imported in dashboard | Import from shared/tokens | Pending |

---

## 19. Design Principles Preserved

- MUI 9 (already using)
- Inter typography (already using)
- 8px spacing rhythm
- Governance Blue primary, Organization Purple secondary
- 1200px max-width containers
- Information density purposeful
- Status by text AND color

---

## 20. Next Steps

1. Founder review and approval of this plan
2. Confirm activity endpoint existence
3. Verify API response formats
4. Get approval for implementation
5. Execute implementation sequence

---

**THIS PLAN IS DRAFT. DO NOT IMPLEMENT VISUAL REDESIGN UNTIL APPROVED.**