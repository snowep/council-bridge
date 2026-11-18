# Council Bridge — M3 Wave 0: UI Baseline & Repository Audit

## Project Information

**Repository:** `snowep/council-bridge`  
**Local path:** `C:\Projects\council-bridge`  
**Default branch:** `master`  
**Frontend:** React 19 + Vite + MUI 9 + TypeScript  
**Backend:** Existing Express API and SQLite architecture  
**Milestone:** M3 — Dashboard & UI/UX Functional Completion  
**Wave:** 0 — UI Baseline & Repository Audit

## 1. Objective

Conduct a complete, READ-ONLY baseline audit of the existing Council Bridge frontend and its supporting backend APIs.

The purpose is to establish exactly what currently exists, what works, what is incomplete, what is inconsistent, and what must be implemented during M3 Waves 1–6.

This is an audit and planning task.

Do not implement M3 features during Wave 0.

Do not redesign or rewrite the frontend.

Do not modify existing application behavior.

## 2. Governance and Execution Rules

M2 has not yet been formally accepted by the Founder.

Therefore:

- Wave 0 is authorized as a read-only audit.
- Do not declare M2 accepted.
- Do not declare M3 implementation authorized.
- M3 implementation remains subject to the Founder's milestone approval.
- Do not make commits or pushes.

Preserve all existing user changes.

Never modify production databases or execute production migrations.

Do not weaken authentication, authorization, security policies, or rate limits.

## 3. Repository and Frontend Inventory

Inspect the complete tracked repository structure, with particular attention to:

- Frontend application structure.
- React entry points.
- Vite configuration.
- Routing.
- Layouts and navigation.
- Dashboard.
- Activity page.
- Settings.
- Profile.
- Theme configuration.
- MUI component usage.
- Shared UI utilities.
- API clients.
- Authentication integration.
- State management.
- Frontend tests.
- E2E tests.
- Backend API routes consumed by the frontend.

Identify:

1. Existing pages and routes.
2. Existing reusable components.
3. Existing design tokens and theme definitions.
4. Existing API integrations.
5. Missing or incomplete functionality.
6. Duplicate implementations.
7. Dead code and unused components.
8. Inconsistent patterns.
9. Dependencies that should not be introduced or duplicated.

Do not recommend restructuring merely for aesthetic reasons.

## 4. Page-by-Page Functional Audit

Audit every existing frontend page.

For each page, document:

- Purpose.
- Route.
- Main components.
- API dependencies.
- Authentication requirements.
- Available user actions.
- Functional status.
- Loading behavior.
- Empty-state behavior.
- Error handling.
- Responsive behavior.
- Accessibility concerns.
- Existing tests.
- Missing functionality.

Use these classifications:

- COMPLETE
- PARTIALLY COMPLETE
- BROKEN
- NOT IMPLEMENTED
- NOT APPLICABLE

At minimum, examine:

### Dashboard

- Operational metrics.
- Council status.
- Agent status.
- Division information.
- Recent activity.
- Dashboard actions.
- Loading and error states.
- Whether displayed metrics reflect actual backend data.

### Activity

- Activity API.
- Event retrieval.
- Filtering.
- Pagination.
- Sorting.
- Authentication.
- Empty and error states.

### Navigation and Routing

- Main navigation.
- Route registration.
- Active navigation state.
- Browser history.
- Unknown routes.
- 404 handling.
- Protected routes.

### Settings

- Existing settings.
- Persistence.
- Validation.
- Save behavior.
- Error handling.
- Permission boundaries.

### Profile

- Profile data retrieval.
- Editable fields.
- Persistence.
- Validation.
- Authentication.
- Error handling.

Do not assume a page is functional merely because it renders.

## 5. Backend API and Data Contract Audit

Map every frontend page and action to its backend endpoint.

For each API dependency, document:

- HTTP method.
- Endpoint.
- Request schema.
- Response schema.
- Authentication middleware.
- Authorization requirements.
- Error responses.
- Pagination behavior.
- Current implementation status.
- Frontend integration status.

Identify:

- Missing endpoints.
- Inconsistent response formats.
- Incorrect frontend assumptions.
- Unauthenticated access.
- Missing validation.
- Unnecessary duplicate requests.
- Potential N+1 queries.
- Missing pagination.
- Data that is mocked or hardcoded instead of retrieved from the backend.

Do not create new endpoints during Wave 0.

## 6. Organization and Identity Data Integrity Baseline

Record the current database-backed organization and identity counts without changing data.

The intended logical organization is:

| Entity | Expected logical count |
|---|---:|
| Council seats | 11 |
| Divisions | 6 |
| Division Heads | 6 |
| Specialists | 45 |
| Total division staff | 51 |
| Staff runtime instances | 102 |

The six divisions are:

1. Developer
2. Marketing
3. Finance
4. Creative
5. Research & Intelligence
6. Business Operations

Important distinctions:

- Council seats are separate from division staff.
- Founder is not an additional Council voting seat.
- Division Heads and specialists are not Council voting members.
- Each logical staff identity maps to Claude and Hermes runtime instances.
- Runtime instances must not be counted as separate logical staff identities.

Query the current database using safe, read-only operations.

Report actual counts alongside expected counts.

Do not bootstrap, reconcile, repair, delete, insert, or update production records.

Historical audit counts must not be presented as current database counts.

If the current database cannot safely be accessed, clearly mark the counts as UNVERIFIED.

This is a baseline only. Full organization reconciliation belongs to the appropriate later integration milestone.

## 7. Design System and UI/UX Audit

Inspect the current MUI 9 implementation.

Preserve:

- Vanilla MUI components.
- Google's Material Design system.
- Existing working architecture.
- Existing functional behavior.

Do not introduce:
- A second component library.
- Unnecessary custom component abstractions.
- Decorative AI-generated design patterns.
- Unnecessary gradients or glassmorphism.
- Arbitrary CSS overrides.
- Duplicate theme systems.

Evaluate:

### Visual consistency
- Typography.
- Spacing.
- Component sizing.
- Borders and elevation.
- Color tokens.
- Icon usage.
- Surface hierarchy.

### Theme
- Light theme.
- Dark theme.
- Text contrast.
- Component contrast.
- Theme persistence.
- Theme switching.

### Responsive behavior
Inspect at these viewport widths:

- 375px.
- 768px.
- 1024px.
- 1440px.
- 1920px.

Identify overflow, broken layouts, navigation problems, and unusable controls.

### Accessibility
Evaluate:

- Keyboard navigation.
- Focus visibility.
- Semantic structure.
- Form labels.
- Accessible names.
- Color contrast.
- Interactive target usability.
- Screen-reader compatibility where practical.

Do not implement visual changes in this wave.

## 8. Frontend Quality and Technical Audit

Inspect:

- React component lifecycle and state handling.
- Unnecessary renders.
- Effects and dependency correctness.
- API request lifecycle.
- Error boundaries.
- Memory leaks.
- Loading-state consistency.
- Form validation.
- TypeScript quality.
- Console errors.
- Dependency health.
- Test coverage.

Identify concrete problems with file paths and relevant code references.

Avoid speculative refactoring.

## 9. Required Quality Audits

### Ponytail — Backend

Audit relevant backend code and frontend-facing API behavior for:

- Maintainability.
- Architecture.
- Security.
- Error handling.
- Data integrity.
- Performance.
- API contract consistency.

### Impeccable — Frontend

Perform a UI/UX quality audit for:

- Visual hierarchy.
- Layout consistency.
- Interaction quality.
- Typography.
- Spacing.
- Responsiveness.
- Accessibility.
- Usability.
- Consistency with Material Design.

Do not apply suggested changes automatically.

Record findings and prioritize them.

## 10. M3 Wave Planning

Based on actual findings, produce a concrete implementation plan for:

### Wave 1 — Dashboard Actions
Identify missing functionality, API dependencies, interaction requirements, and tests.

### Wave 2 — Activity Page
Identify required API work, pagination, filtering, and frontend integration.

### Wave 3 — Navigation & Routing
Identify route and navigation defects and required regression tests.

### Wave 4 — Settings & Profile
Identify incomplete settings/profile functionality and persistence requirements.

### Wave 5 — Theme & Responsive UI
Identify theme inconsistencies, responsive defects, and accessibility improvements.

### Wave 6 — Frontend Quality & Acceptance
Identify E2E, accessibility, regression, Ponytail, and Impeccable acceptance requirements.

For each wave, include:

- Objective.
- Exact files likely to be affected.
- Dependencies.
- Implementation tasks.
- Security considerations.
- Test requirements.
- Acceptance criteria.
- Estimated complexity.
- Blocking issues.

Do not begin implementation.

## 11. Required Deliverables

Create the following documentation:

### A. `docs/reports/M3_WAVE0_UI_BASELINE_REPORT.md`

Include:

1. Executive Summary.
2. Repository and Frontend Architecture.
3. Page and Route Inventory.
4. Page-by-Page Functional Audit.
5. Backend API Mapping.
6. Organization and Identity Baseline.
7. Design System Audit.
8. Responsive Audit.
9. Accessibility Audit.
10. Frontend Technical Findings.
11. Ponytail Backend Audit.
12. Impeccable Frontend Audit.
13. Prioritized Findings.
14. Risks and Dependencies.
15. M3 Implementation Readiness.

### B. `docs/reports/M3_IMPLEMENTATION_ROADMAP.md`

Include detailed Wave 1–6 plans.

Make dependencies explicit.

Identify critical-path work.

Separate must-fix requirements from optional improvements.

### C. `docs/reports/M3_ACCEPTANCE_CRITERIA.md`

Define measurable acceptance criteria for the entire M3 milestone.

Include functional, technical, security, UI/UX, accessibility, responsive, and regression requirements.

## 12. Priority Classification

Classify findings:

- P0 — Critical security, data integrity, or application-breaking issue.
- P1 — Core functionality or major usability defect.
- P2 — Important consistency, reliability, or maintainability issue.
- P3 — Optional improvement.

For each finding, provide:

- ID.
- Priority.
- Description.
- Evidence.
- File path.
- User impact.
- Proposed correction.
- Relevant M3 wave.

Do not inflate priorities.

## 13. Definition of Done

Wave 0 is complete only when:

- All existing frontend pages have been inventoried.
- All routes have been inspected.
- Frontend API dependencies are mapped.
- Current organization counts are recorded or explicitly marked unverified.
- MUI and design-system consistency has been audited.
- Responsive and accessibility findings are documented.
- Ponytail and Impeccable audits are completed.
- M3 Waves 1–6 have concrete implementation plans.
- M3 acceptance criteria are measurable.
- No application implementation has been performed.
- All findings have supporting evidence.

## 14. Final Response

Present:

1. Wave 0 completion status.
2. Repository structure findings.
3. Frontend page audit summary.
4. API integration findings.
5. Organization and identity counts.
6. Critical and high-priority issues.
7. Ponytail and Impeccable findings.
8. M3 Wave 1–6 roadmap.
9. Test commands and actual results.
10. Documentation created.
11. Remaining blockers.
12. Recommendation for Founder Review.

Do not claim M3 implementation is complete.

Do not claim M2 acceptance.

End by presenting the Wave 0 findings and proposed M3 implementation sequence for the Founder's approval.