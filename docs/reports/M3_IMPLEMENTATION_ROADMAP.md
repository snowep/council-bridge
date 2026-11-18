# M3 Implementation Roadmap: Waves 1-6

**Repository:** `snowep/council-bridge`  
**Milestone:** M3 — Dashboard & UI/UX Functional Completion  
**Date:** 2026-11-18

---

## Overview

This roadmap details the implementation plan for M3 Waves 1-6, building upon the Wave 0 baseline audit. Each wave is designed to be implementable independently while maintaining clear dependencies.

---

## Wave 1: Dashboard Actions

### Objective

Complete the Dashboard page with full CRUD functionality for tasks, including proper API integration and user workflows.

### Current Status

Dashboard page renders but with placeholder data for some metrics. Tasks can be created via modal but API integration needs verification.

### Exact Files Affected

- `frontend/src/features/dashboard/pages/DashboardPage.tsx`
- `src/api/routes/tasks.routes.ts`
- `src/api/routes/divisions.routes.ts`
- `frontend/src/shared/api/api.ts`

### Dependencies

- Database must have divisions populated
- Staff agents records needed
- Tasks API must be fully implemented

### Implementation Tasks

1. **Verify Tasks API**
   - [ ] Confirm `GET /api/tasks` returns task list
   - [ ] Confirm `POST /api/tasks` creates tasks
   - [ ] Confirm `PUT /api/tasks/{id}/assign` works
   - [ ] Confirm `PUT /api/tasks/{id}/status` works

2. **Dashboard Task Card Actions**
   - [ ] Add "Assign" button functionality
   - [ ] Add "Complete" button functionality
   - [ ] Add "View Details" deep link

3. **Dashboard Metrics Integration**
   - [ ] Replace hardcoded metrics with API calls
   - [ ] Add loading states for each metric
   - [ ] Add error states per metric section

4. **Task Create Modal Integration**
   - [ ] Verify form submission sends to API
   - [ ] Add validation feedback
   - [ ] Reset form on cancel

### Security Considerations

- Role-based visibility for sensitive metrics
- Input validation on task creation
- CSRF protection already in place via session tokens

### Test Requirements

- Unit tests for API client methods
- Integration tests for task creation flow
- E2E test: Create task from Dashboard

### Acceptance Criteria

- [ ] Dashboard shows real task counts from database
- [ ] Task creation succeeds via modal
- [ ] Task assignment updates backend
- [ ] All dashboard cards refresh correctly
- [ ] Error states display user-friendly messages

### Estimated Complexity

**MEDIUM** - Requires full API integration but UI is already built

### Blocking Issues

- P0-001: Database needs divisions populated
- P0-002: Verify Tasks API endpoints exist

---

## Wave 2: Activity Page

### Objective

Implement the Activity page for viewing council-wide activity, including events, decisions, and memory entries.

### Current Status

- No Activity page component exists
- No Activity route registered
- Memory and events APIs need investigation

### Exact Files Affected

- `frontend/src/features/activity/pages/ActivityPage.tsx` (NEW)
- `frontend/src/app/App.tsx`
- `frontend/src/shared/api/api.ts`
- `src/api/routes/activities.routes.ts` (need to verify exists)

### Dependencies

- Memory entries API endpoint
- Division members populated
- Memory categories defined

### Implementation Tasks

1. **Create ActivityPage Component**
   - [ ] Create `frontend/src/features/activity/pages/ActivityPage.tsx`
   - [ ] Create activity index file for routing
   - [ ] Design activity feed UI with timeline

2. **Register Route**
   - [ ] Add route to `App.tsx` navigation
   - [ ] Add navigation link in Layout

3. **API Integration**
   - [ ] Fetch memory entries with activity categories
   - [ ] Filter by type: decisions, events, lessons learned
   - [ ] Sort by timestamp

4. **UI Components**
   - [ ] Activity feed/timeline display
   - [ ] Category filter tabs
   - [ ] Search functionality
   - [ ] Individual activity cards with metadata

### Security Considerations

- Memory access control (who can see what)
- Pagination to prevent data overload
- Rate limiting on queries

### Test Requirements

- Unit tests for ActivityPage
- API response format tests
- E2E: View activity feed

### Acceptance Criteria

- [ ] Activity page accessible via navigation
- [ ] Shows council-wide activity events
- [ ] Categories are filterable
- [ ] Items display with proper metadata
- [ ] Empty state when no activity

### Estimated Complexity

**MEDIUM** - New page but follows established patterns

### Blocking Issues

None - Can be started immediately after database is seeded

---

## Wave 3: Navigation & Routing

### Objective

Complete the navigation system with proper route handling, active state management, and 404 handling.

### Current Status

Navigation exists but some routes are not implemented. 404 handling not configured.

### Exact Files Affected

- `frontend/src/app/App.tsx`
- `frontend/src/app/layouts/Layout.tsx`
- `frontend/src/app/routes/index.ts` (if exists)

### Dependencies

- Activity page component exists
- Settings/Profile components (optional)

### Implementation Tasks

1. **Route Registration**
   - [ ] Ensure all routes properly registered
   - [ ] Add proper redirect chains
   - [ ] Handle trailing slashes

2. **Active Navigation State**
   - [ ] Highlight current route in sidebar
   - [ ] Update on route change
   - [ ] Smooth transition animations

3. **Browser History**
   - [ ] Implement proper back button behavior
   - [ ] Scroll to top on route change
   - [ ] Handle browser refresh correctly

4. **404 Handling**
   - [ ] Create NotFoundPage component
   - [ ] Add route fallback
   - [ ] Display helpful error message
   - [ ] Add link back to home

5. **Protected Routes**
   - [ ] Verify auth check on all protected routes
   - [ ] Redirect to login on unauthenticated access
   - [ ] Show appropriate error on auth failure

6. **Missing Routes**
   - [ ] Add Settings route placeholder (can be empty)
   - [ ] Add Profile route placeholder

### Security Considerations

- Route protection verified
- No sensitive data in URL parameters
- Proper session validation before route access

### Test Requirements

- Navigation click tests
- Route access tests
- 404 page display tests
- Auth redirect tests

### Acceptance Criteria

- [ ] All implemented pages are navigable
- [ ] Active route is highlighted
- [ ] 404 page shows for unknown routes
- [ ] Unauthenticated users redirected to login
- [ ] Browser back button works correctly

### Estimated Complexity

**LOW** - Infrastructure work, minimal new code

### Blocking Issues

- Activity page should exist first

---

## Wave 4: Settings & Profile

### Objective

Implement user settings and profile management pages for configuration and preferences.

### Current Status

No Settings or Profile pages exist. No corresponding routes.

### Exact Files Affected

- `frontend/src/features/settings/pages/SettingsPage.tsx` (NEW)
- `frontend/src/features/profile/pages/ProfilePage.tsx` (NEW)
- `frontend/src/app/App.tsx`

### Dependencies

- User preferences schema defined
- Authentication system working
- Storage preferences (localStorage, DB)

### Implementation Tasks

1. **Settings Page**
   - [ ] Create SettingsPage component
   - [ ] Theme toggle (light/dark)
   - [ ] Notification preferences
   - [ ] Security settings (password change placeholder)
   - [ ] Save/cancel buttons
   - [ ] Validation and error handling

2. **Profile Page**
   - [ ] Create ProfilePage component
   - [ ] Display user information
   - [ ] Editable fields (name, email if applicable)
   - [ ] Save functionality
   - [ ] Password change modal

3. **Route Registration**
   - [ ] Add to navigation menu
   - [ ] Register in router
   - [ ] Add breadcrumbs

4. **State Management**
   - [ ] Form state handling
   - [ ] API integration for save
   - [ ] Local storage for theme preference

### Security Considerations

- Password change requires re-authentication
- Sensitive settings require confirmation
- Input sanitization on all form fields

### Test Requirements

- Unit tests for form validation
- API integration tests
- E2E: Update settings
- E2E: Update profile

### Acceptance Criteria

- [ ] Settings page accessible
- [ ] Profile page accessible
- [ ] Changes persist and apply
- [ ] Validation prevents invalid input
- [ ] Error states handled gracefully

### Estimated Complexity

**MEDIUM** - Multiple pages, forms, validation

### Blocking Issues

None

---

## Wave 5: Theme & Responsive UI

### Objective

Refactor and improve the UI/UX for better responsiveness, accessibility, and visual consistency.

### Current Status

Baseline MUI 9 implementation is solid. Some responsive issues on mobile. Accessibility could be improved.

### Exact Files Affected

All frontend pages and components

### Dependencies

None

### Implementation Tasks

1. **Responsive Improvements**
   - [ ] Fix table horizontal overflow on mobile
   - [ ] Improve tab handling on small screens
   - [ ] Verify all breakpoint transitions
   - [ ] Test on 375px viewport

2. **Accessibility Enhancements**
   - [ ] Add ARIA labels to all icon buttons
   - [ ] Implement skip-to-content link
   - [ ] Add landmark roles
   - [ ] Ensure proper focus order throughout
   - [ ] Add screen reader announcements for status changes

3. **Visual Consistency**
   - [ ] Standardize empty state illustrations
   - [ ] Ensure consistent loading indicators
   - [ ] Standardize error alert styles
   - [ ] Verify icon sizing consistency

4. **Theme Improvements**
   - [ ] Add theme toggle in settings
   - [ ] Persist theme choice
   - [ ] Add reduced motion support
   - [ ] Add high contrast mode consideration

### Security Considerations

None additional

### Test Requirements

- Visual regression tests
- Accessibility audit (axe-core)
- Responsive breakpoint tests
- Manual device testing (optional)

### Acceptance Criteria

- [ ] No horizontal scroll on main content
- [ ] All icon buttons have accessible names
- [ ] Keyboard navigation fully functional
- [ ] Screen reader announces important changes
- [ ] Theme toggle works and persists

### Estimated Complexity

**MEDIUM** - Significant UX polish required

### Blocking Issues

None

---

## Wave 6: Frontend Quality & Acceptance

### Objective

Complete the frontend implementation with comprehensive testing, quality gates, and final acceptance criteria verification.

### Current Status

Tests exist but coverage incomplete. No E2E tests. Quality metrics not established.

### Exact Files Affected

- `tests/` directory structure
- CI/CD configuration (if any)

### Dependencies

- All previous waves completed
- Production API endpoints stable

### Implementation Tasks

1. **E2E Testing**
   - [ ] Set up Cypress or Playwright
   - [ ] Test critical user flows:
     - Dashboard load and refresh
     - Create and complete task
     - Submit and review deliverable
     - Request and approve execution
   - [ ] Test authentication flows
   - [ ] Test error states

2. **Component Unit Tests**
   - [ ] Add tests for key components
   - [ ] Test custom hooks
   - [ ] Test form validations
   - [ ] Achieve 80%+ coverage

3. **Quality Gates**
   - [ ] Add ESLint Prettier configuration
   - [ ] Add TypeScript strict mode
   - [ ] Set up linting in CI
   - [ ] Add bundle size checks

4. **Performance Optimization**
   - [ ] Analyze bundle size
   - [ ] Code splitting for routes
   - [ ] Lazy load heavy components
   - [ ] Optimize images/icons

5. **Accessibility Compliance**
   - [ ] Run axe-core audit
   - [ ] Fix all WCAG violations
   - [ ] Add accessibility tests

6. **Security Audits**
   - [ ] Check for XSS vulnerabilities
   - [ ] Verify input sanitization
   - [ ] Test auth token handling
   - [ ] Review CORS policies

### Security Considerations

- XSS prevention in all user inputs
- Secure cookie settings
- CSP header recommendations
- Rate limit verification

### Test Requirements

- 80%+ test coverage
- All E2E tests pass
- Accessibility score 90%+
- No critical security issues

### Acceptance Criteria

- [ ] All tests pass
- [ ] Coverage >= 80%
- [ ] Accessibility score >= 90%
- [ ] Bundle size < 2MB
- [ ] No console errors in production build
- [ ] Security audit passed

### Estimated Complexity

**HIGH** - Comprehensive quality work

### Blocking Issues

All waves must be complete

---

## Dependency Graph

```
Wave 1: Dashboard Actions
   │
   ├── Verify Tasks API (first)
   └── Implement dashboard functionality

Wave 2: Activity Page (independent, can start immediately)
   │
   └── Wave 3: Navigation & Routing (general routing independent of Activity)

Wave 4: Settings & Profile (independent)

Wave 5: Theme & Responsive UI (depends on core pages: Waves 1-4)

Wave 6: Frontend Quality & Acceptance (depends on all previous waves)
```

---

## M3 Implementation Sequence

1. **Wave 1:** Dashboard Actions
   - Verify Tasks API endpoints exist and work BEFORE implementing new functionality
   - Replace hardcoded metrics with API calls
   - Add proper loading and error states
   - Dependencies: Database must have divisions populated (M4 requirement)

2. **Wave 2:** Activity Page (no dependencies, can start immediately)
   - Create ActivityPage component
   - Register route
   - Integrate with memory API

3. **Wave 3:** Navigation & Routing
   - Verify all existing routes work
   - Add 404 handling
   - Add active state management
   - Note: General routing verification is independent of Activity page
   - Activity route integration occurs after Wave 2

4. **Wave 4:** Settings & Profile (independent)
   - Create SettingsPage
   - Create ProfilePage
   - Add theme toggle

5. **Wave 5:** Theme & Responsive UI (depends on Waves 1-4 being complete)
   - Fix responsive issues
   - Add accessibility enhancements
   - Standardize visual patterns

6. **Wave 6:** Frontend Quality & Acceptance (depends on all previous waves)
   - Add E2E tests
   - Add component unit tests
   - Set up quality gates

---

## Milestone Checkpoints

- **End of Wave 2:** Activity page live and functional
- **End of Wave 3:** All routes working, 404 added
- **End of Wave 4:** Settings and Profile complete
- **End of Wave 5:** Mobile-responsive, accessible UI
- **End of Wave 6:** Full test coverage, quality gates passed

---

## Founder Review Questions

1. Should we proceed with implementation waves 1-6 as planned?
2. Any features should be prioritized differently?
3. Any concerns about the technical approach?