# M3 Acceptance Criteria

**Repository:** `snowep/council-bridge`  
**Milestone:** M3 — Dashboard & UI/UX Functional Completion  
**Date:** 2026-11-18

---

## Overview

This document defines measurable acceptance criteria for the M3 milestone. All criteria must be met for the milestone to be considered complete and ready for Founder acceptance.

---

## 1. Functional Criteria

### 1.1 Dashboard (Wave 1)

**Requirement:** Dashboard displays real-time operational metrics and allows task creation.

| ID | Criteria | Measurement | Pass Threshold |
|----|----------|-------------|----------------|
| F-001 | Task count shows actual number from database | `GET /api/tasks` returns count | Count matches DB |
| F-002 | Division metrics display from backend | Division data from API | 6 divisions shown |
| F-003 | Staff agent metrics display | Agent count from API | >50 agents shown |
| F-004 | Recent activity list populated | Activities from API | Last 10 shown |
| F-005 | Create task via modal works | `POST /api/tasks` accepted | 201 response |
| F-006 | Refresh button updates all metrics | All metrics update | No stale data |

### 1.2 Activity Page (Wave 2)

**Requirement:** Activity page shows council-wide events and decisions.

| ID | Criteria | Measurement | Pass Threshold |
|----|----------|-------------|----------------|
| F-101 | Activity page accessible | Route returns 200 | HTTP 200 |
| F-102 | Activity feed displays entries | Items rendered | ≥5 items |
| F-103 | Category filter works | Click filter | Items filtered |
| F-104 | Search finds activities | Input query | Results returned |
| F-105 | Timestamps properly formatted | Display format | Human readable |

### 1.3 Navigation & Routing (Wave 3)

**Requirement:** Complete navigation system with proper route handling.

| ID | Criteria | Measurement | Pass Threshold |
|----|----------|-------------|----------------|
| F-201 | All implemented pages navigable | Click each nav item | HTTP 200 |
| F-202 | Unknown routes show 404 | Visit `/invalid` | 404 page shown |
| F-203 | Active route highlighted | Visit `/dashboard` | CSS active class |
| F-204 | Browser back button works | Navigate back | Correct page loaded |
| F-205 | Auth redirect works | Access as unauth | Redirect to login |

### 1.4 Settings & Profile (Wave 4)

**Requirement:** User can configure settings and view profile.

| ID | Criteria | Measurement | Pass Threshold |
|----|----------|-------------|----------------|
| F-301 | Settings page accessible | Route returns 200 | HTTP 200 |
| F-302 | Profile page accessible | Route returns 200 | HTTP 200 |
| F-303 | Theme toggle persists | Reload page | Theme setting saved |
| F-304 | Changes save successfully | API POST accepted | 200 response |
| F-305 | Validation errors shown | Invalid input | Error message displayed |

### 1.5 Tasks Flow (Wave 1)

**Requirement:** Complete task lifecycle management.

| ID | Criteria | Measurement | Pass Threshold |
|----|----------|-------------|----------------|
| F-401 | Task creation succeeds | Create task | Task appears in list |
| F-402 | Task assignment works | Assign to division | Assignment saved |
| F-403 | Status update works | Change to completed | Status updated |
| F-404 | Task history visible | View task detail | History displayed |
| F-405 | Delete/Cancel works | Cancel task | Status = cancelled |

### 1.6 Deliverables Flow (Wave 1)

**Requirement:** Complete deliverable submission and review cycle.

| ID | Criteria | Measurement | Pass Threshold |
|----|----------|-------------|----------------|
| F-501 | Create deliverable works | Submit new | 201 response |
| F-502 | Submit for review works | Click submit | Status = submitted |
| F-503 | Review submission works | Approve/Reject | Decision recorded |
| F-504 | Quality score recorded | Score entered | Score saved |
| F-505 | Revision requested | Request revision | New draft created |

### 1.7 Executions Flow (Wave 1)

**Requirement:** Execution request and approval workflow.

| ID | Criteria | Measurement | Pass Threshold |
|----|----------|-------------|----------------|
| F-601 | Create execution request | Submit request | 201 response |
| F-602 | Approval request created | Founder approves | Request approved |
| F-603 | Execute request works | Click execute | Status = running |
| F-604 | Cancel execution works | Click cancel | Status = cancelled |
| F-605 | History tracking works | View execution | History entries shown |

---

## 2. Technical Criteria

### 2.1 Build & Deployment

| ID | Criteria | Measurement | Pass Threshold |
|----|----------|-------------|----------------|
| T-001 | Production build succeeds | `npm run build` | Exit 0 |
| T-002 | Bundle size within limits | Bundle analysis | < 2,000 KB |
| T-003 | No TypeScript errors | `npm run typecheck` | Exit 0 |
| T-004 | No ESLint errors | `npm run lint` | Exit 0 |

### 2.2 Database

| ID | Criteria | Measurement | Pass Threshold |
|----|----------|-------------|----------------|
| T-101 | All 6 divisions present | `SELECT COUNT(*) FROM divisions` | Count = 6 |
| T-102 | All council seats present | `SELECT COUNT(*) FROM council_seats` | Count = 11 |
| T-103 | Staff agents populated | `SELECT COUNT(*) FROM staff_agents` | Count ≥ 51 |
| T-104 | Schema version correct | `schema_version` table | Version = 16.0.0 |

### 2.3 API

| ID | Criteria | Measurement | Pass Threshold |
|----|----------|-------------|----------------|
| T-201 | All endpoints respond | HTTP requests | 200/4xx codes only |
| T-202 | CORS headers set | Response headers | Allowed origins correct |
| T-203 | Error format consistent | Error responses | Standard JSON format |

---

## 3. UI/UX Criteria

### 3.1 Responsiveness

| ID | Criteria | Measurement | Pass Threshold |
|----|----------|-------------|----------------|
| UX-001 | No horizontal scroll | Viewport 375px | Overflow hidden |
| UX-002 | Navigation collapses mobile | Viewport 375px | Menu hamburger |
| UX-003 | Table scrollable on mobile | Data tables | Horizontal scroll |
| UX-004 | Touch targets ≥ 44px | Element sizes | Min dimension met |

### 3.2 Visual Design

| ID | Criteria | Measurement | Pass Threshold |
|----|----------|-------------|----------------|
| UX-101 | Material Design 9 compliance | Design audit | Follows guidelines |
| UX-102 | Dark theme functional | Theme toggle | Both modes work |
| UX-103 | Typography hierarchy clear | Visual inspection | Proper heading levels |
| UX-104 | Color contrast pass | WCAG AA check | ≥ 4.5:1 ratio |

### 3.3 Loading & Error States

| ID | Criteria | Measurement | Pass Threshold |
|----|----------|-------------|----------------|
| UX-201 | Loading indicators show | Async operations | Spinner displayed |
| UX-202 | Error messages clear | API failures | User-friendly text |
| UX-203 | Empty states helpful | No data | Guidance provided |
| UX-204 | Retry option available | Recoverable errors | Retry button |

---

## 4. Accessibility Criteria

| ID | Criteria | Measurement | Pass Threshold |
|----|----------|-------------|----------------|
| A-001 | WCAG AA level | axe-core scan | No A errors |
| A-002 | Color contrast ratio | Contrast checker | ≥ 4.5:1 text |
| A-003 | ARIA labels present | DOM inspection | All icon buttons |
| A-004 | Keyboard navigation | Tab order test | Full navigation |
| A-005 | Form labels associated | HTML inspection | `<label>` or aria-label |
| A-006 | Focus visible | Focus test | Visible outline |
| A-007 | Skip link available | Page header | Present and functional |

---

## 5. Security Criteria

| ID | Criteria | Measurement | Pass Threshold |
|----|----------|-------------|----------------|
| S-001 | SQL injection protected | Code review | Parameterized queries |
| S-002 | XSS prevented | Output sanitization | No raw HTML insertion |
| S-003 | Auth required for protected | Unauthorized test | Redirect or 401 |
| S-004 | Session tokens secure | Cookie inspection | HttpOnly, Secure flags |
| S-005 | Rate limiting present | Load test | Limits enforced |
| S-006 | Secrets not in code | Repo scan | No API keys in code |

---

## 6. Test Criteria

| ID | Criteria | Measurement | Pass Threshold |
|----|----------|-------------|----------------|
| TEST-001 | All tests pass | `npm run test` | Exit 0, 100% pass |
| TEST-002 | Coverage ≥ 80% | Coverage report | Lines ≥ 80% |
| TEST-003 | Unit tests exist | Test files count | ≥ 30 tests |
| TEST-004 | Integration tests pass | Integration suite | All pass |
| TEST-005 | E2E tests pass | E2E suite | All pass |

---

## 7. Performance Criteria

| ID | Criteria | Measurement | Pass Threshold |
|----|----------|-------------|----------------|
| P-001 | First load < 3s | Lighthouse | Score ≥ 90 |
| P-002 | Interaction ready < 1s | Lighthouse | Time to interactive |
| P-003 | No memory leaks | Chrome DevTools | Stable memory usage |
| P-004 | API response < 500ms | Response timing | 95th percentile |

---

## 8. Quality Gate Checklist

### Pre-Merge Requirements

- [ ] All automated tests pass (exit code 0)
- [ ] TypeScript compilation passes
- [ ] No ESLint errors
- [ ] Branch name follows convention: `m3/wave-N-description`
- [ ] PR includes Wave reference
- [ ] PR includes issue references

### Pre-Release Requirements

- [ ] Performance budget met (bundle < 2MB)
- [ ] Accessibility score ≥ 90%
- [ ] Security scan passed
- [ ] Manual QA completed
- [ ] Regression tests pass
- [ ] Documentation updated

### Release Requirements

- [ ] All acceptance criteria met
- [ ] Founder review completed
- [ ] Merge approved by reviewer
- [ ] Tag created: `m3.x.x`
- [ ] Release notes updated

---

## 9. Sign-off Checklist

For M3 milestone completion, the Founder must verify:

- [ ] Dashboard shows correct metrics
- [ ] Activity page functional
- [ ] All navigation working
- [ ] Settings and Profile accessible
- [ ] Task create/assign/complete works
- [ ] Deliverable submit/review works
- [ ] Execution request/approval works
- [ ] Mobile responsive
- [ ] Accessible (keyboard, screen reader)
- [ ] No console errors
- [ ] Performance acceptable

---

## 10. Regression Requirements

The following from M2 must remain functional:

- [ ] Authentication system
- [ ] Authorization checks
- [ ] API rate limiting
- [ ] Database migrations
- [ ] Existing routes and pages
- [ ] Error handling patterns
- [ ] Logging and monitoring hooks

---

## Measurement Methods

| Method | Tools |
|--------|-------|
| Automated tests | Jest/Vitest, tsx |
| Coverage | c8, vitest coverage |
| Linter | ESLint, Prettier |
| Type checker | tsc --noEmit |
| Accessibility | axe-core, Lighthouse |
| Performance | Lighthouse, WebPageTest |
| Security | npm audit, code review |
| Visual regression | Percy or similar |

---

## Acceptance Threshold

**M3 is COMPLETE when:**
1. All functional criteria marked "Pass Threshold" achieved
2. All 10 pages in the Quality Gate Checklist verified
3. Founder has provided sign-off
4. No open P0 or P1 issues remain
5. All tests pass in CI pipeline

**M3 is NOT ACCEPTABLE when:**
1. Any P0 criteria fails
2. Tests are failing
3. TypeScript errors present
4. Security issues identified
5. Performance degrades significantly