# COUNCIL BRIDGE — P1 SECURITY REMEDIATION AND MVP CLOSURE

## 1. Project Information

- Repository: `snowep/council-bridge`
- Local path: `C:\Projects\council-bridge`
- Expected branch: `refactor/repository-structure`
- Last audited commit: `42146ab94aa12f7c816acacb9265c195c9d8a98e`
- Objective: resolve outstanding security, runtime-integrity, authorization, frontend-resilience, and documentation findings as quickly as possible.

## 2. Critical Audit Correction

The previous execution report claimed seven P1 defects were fixed.

A remote source audit of commit `42146ab94aa12f7c816acacb9265c195c9d8a98e` found that several of those claims are not supported by the committed source.

The following defects remain confirmed:

| ID | Priority | Finding |
|---|---|---|
| R1 | P1 | MCP session continuity |
| R2 | P1 | Runtime lifecycle authorization |
| R3 | P1 | Execution permit renewal and fencing |
| R4 | P1 | Task access and assignment authorization |
| R5 | P1 | Staff and division membership authorization |
| R6 | P1 | Deliverable list authorization |
| R7 | P1 | Deliverable detail authorization consistency |
| R8 | P2 | Council page partial loading |
| R9 | P2 | API contract matrix accuracy |
| R10 | P2 | Remediation reports and handoff consistency |

Do not repeat the previous completion claims without inspecting the current local source.

The latest report is not an authoritative representation of committed implementation.

## 3. Fast Development Objective

Complete all confirmed findings in one focused remediation cycle.

Prioritize:
1. Security and runtime correctness.
2. Reuse of existing canonical policies.
3. Small, direct implementation changes.
4. Parallel work where file ownership is independent.
5. Focused verification instead of unnecessary full-suite execution.

Do not produce lengthy planning documents before implementation. Inspect, fix, integrate, and report.

## 4. Repository Protection

Before editing:

- Inspect `git status --short`.
- Record the actual branch and full HEAD SHA.
- Confirm whether HEAD matches or descends from the audited commit.
- Preserve all local changes.
- Inspect the current `NEXT_PROMPT.md` before replacing its contents.

Never:
- Reset, clean, stash, revert, or discard local changes.
- Overwrite unrelated user work.
- Modify production database records.
- Run production migrations.
- Rewrite migration history or checksums.
- Commit, push, merge, deploy, or rewrite Git history.
- Weaken production authentication or authorization.
- Expose credentials, Founder keys, or private runtime tokens.
- Start M4 or future autonomy phases.
- Perform unrelated architectural refactoring.

The Founder has already pushed the audited commit. Do not push or commit further changes.

## 5. Workstream A — MCP Runtime Session Continuity

**Priority: P1**

File:
`src/api/middleware/authentication.ts`

Related:
- `src/runtime/lifecycle.ts`
- `src/auth/runtime-credentials.ts`
- MCP HTTP transport registration and middleware pipeline.

### Confirmed source condition

The current middleware still calls `lifecycle.connect()` without a stable session ID:

```ts
const connResult = lifecycle.connect({
  runtime: runtimePrincipal.runtimeId,
  clientIp
});
```

### Required implementation

1. Inspect the existing credential-to-session relationship.
2. Resolve the existing valid session for the authenticated runtime.
3. Reuse that session for ordinary MCP requests.
4. Create sessions only through the appropriate connection/bootstrap flow.
5. Prevent concurrent requests from creating competing sessions.
6. Preserve execution records during ordinary MCP requests.
7. Ensure revoked credentials cannot reuse old sessions.
8. Ensure stale-session recovery cannot invalidate a newly renewed session.
9. Derive runtime identity only from validated credentials.
10. Preserve the single-active-runtime invariant.

Do not trust arbitrary session IDs from request bodies.

### Completion criteria

- Repeated MCP requests reuse the same valid session.
- Ordinary requests do not replace runtime sessions.
- Execution history is not deleted by ordinary requests.
- Concurrent requests cannot create competing sessions.
- Switching runtimes invalidates previous runtime authority.
- Recovery works without duplicate or orphan sessions.

## 6. Workstream B — Runtime Lifecycle Authorization

**Priority: P1**

File:
`src/api/routes/runtime.routes.ts`

### Required implementation

1. Enforce Founder authority for global runtime selection and switching.
2. Bind disconnect operations to the authenticated runtime session.
3. Bind heartbeat operations to the authenticated runtime session.
4. Validate session ownership for every lifecycle operation.
5. Reject foreign, stale, expired, disconnected, or mismatched sessions.
6. Do not let request-body identifiers override authenticated identity.
7. Fail closed when ownership cannot be established.
8. Preserve local single-user Founder restrictions.
9. Preserve production authentication requirements.
10. Reuse existing authentication and authorization helpers.

### Completion criteria

- Non-Founder callers cannot control global runtime selection.
- A runtime cannot disconnect another runtime.
- A runtime cannot heartbeat another runtime's session.
- Missing or forged identifiers cannot bypass checks.
- Founder can recover stale sessions safely.

## 7. Workstream C — Execution Permit Renewal and Fencing

**Priority: P1**

File:
`src/runtime/runtime-execution-guard.ts`

### Confirmed source condition

The audited source still uses:

```ts
const EXECUTION_PERMIT_DURATION_MS = 30 * 1000;
const HEARTBEAT_RENEWAL_INTERVAL_MS = 300 * 1000;
```

The heartbeat renewal does not establish independent execution-permit renewal.

### Required implementation

1. Implement independent execution permit renewal.
2. Renew before the permit expires.
3. Renew atomically.
4. Verify execution ID, session ID, runtime identity, and ownership generation.
5. Validate that the runtime remains active.
6. Use the existing fencing/generation mechanism where available.
7. Prevent stale executions from performing protected operations.
8. Prevent old executions from renewing or releasing newer permits.
9. Release permits safely on success, failure, cancellation, and shutdown.
10. Recover expired permits safely.
11. Ensure failed renewal stops or aborts protected work as early as the execution boundary permits.

Do not merely increase the permit duration.

Do not claim that a shorter renewal interval alone solves the problem.

### Completion criteria

- Long-running executions maintain valid permits.
- Concurrent operations cannot acquire conflicting permits.
- Stale executions cannot perform protected writes.
- Old executions cannot release new permits.
- Runtime switching invalidates old execution authority.

## 8. Workstream D — Task Authorization

**Priority: P1**

File:
`src/api/routes/tasks.routes.ts`

### Required implementation

1. Inspect existing canonical helpers, especially `assertTaskAccess`, `getDelegationTaskById`, and related task authorization policies.
2. Use the canonical policy for task detail access.
3. Preserve legitimate Founder, Division Head, assignee, and division-member access.
4. Preserve explicit cross-division restrictions.
5. Ensure task creator identity is derived from authenticated identity.
6. Reject caller-supplied creator identity fields.
7. Restrict reassignment to Founder or the authorized owning Division Head.
8. Verify both current task ownership and destination assignee permissions.
9. Ensure direct staff assignments cannot bypass authorization.
10. Apply consistent policy to detail and list retrieval.

Do not create another independent task-access policy when an established helper already exists.

## 9. Workstream E — Staff Authorization

**Priority: P1**

File:
`src/api/routes/staff.routes.ts`

### Confirmed source defect

The audited code still contains:

```ts
const isDivisionHead =
  ctx.owner_type === 'division' && id.startsWith('staff-');
```

This is not valid membership authorization.

The division-members endpoint also calls `requireAuth(req)` without using the returned context to scope the query.

### Required implementation

1. Remove prefix-based authorization.
2. Fetch the actual staff record and verify its division membership.
3. Allow staff to retrieve their own permitted record.
4. Allow Division Heads to retrieve members of their own division.
5. Allow Founder organization-wide access.
6. Restrict `GET /divisions/members`.
7. Prevent staff from requesting arbitrary division membership.
8. Prevent Division Heads from accessing unrelated divisions.
9. Return non-disclosing errors for unauthorized record access.
10. Preserve existing registration and staff-list behavior.

## 10. Workstream F — Deliverable Authorization

**Priority: P1**

File:
`src/api/routes/deliverables.routes.ts`

### List endpoint

The current list path retrieves deliverables by `task_id` without first establishing task access.

Required:

1. Resolve the associated task.
2. Check access using the canonical task-access policy.
3. Only then retrieve and return its deliverables.
4. Apply the same rule to any relevant filters.
5. Prevent arbitrary task IDs from exposing deliverable records.

### Detail endpoint

The current endpoint uses manual comparisons for assignee, submitter, and creator.

Required:

1. Reuse canonical task-access rules.
2. Preserve legitimate division membership access.
3. Preserve Founder access.
4. Preserve submitter and reviewer rules where authorized.
5. Avoid leaking whether an inaccessible deliverable exists.

### Version endpoint

1. Verify access before returning version history.
2. Ensure history cannot bypass the parent deliverable's access policy.
3. Reuse existing service-layer checks where possible.

### Completion criteria

- List, detail, and version access use consistent authorization.
- Unrelated task IDs cannot expose deliverables.
- Authorized division members retain legitimate access.
- Unauthorized callers receive non-disclosing responses.

## 11. Workstream G — Council Page Resilience

**Priority: P2**

File:
`frontend/src/features/council/pages/CouncilPage.tsx`

### Confirmed source condition

The page still uses aggregate conditions:

```ts
if (isAnyLoading) {
  return <CircularProgress />;
}

if (hasAnyError) {
  return <Alert severity="error">...</Alert>;
}
```

### Required implementation

1. Preserve existing independent fetch functions.
2. Preserve constitution 404 as an absent constitution.
3. Render successful sections while another section is loading.
4. Render successful sections when another request fails.
5. Add section-specific loading indicators.
6. Add section-specific error messages and retry actions.
7. Keep successful data visible.
8. Do not convert non-404 errors into empty data.
9. Preserve Council membership, personas, runtime assignments, approvals, and voting functionality.

Avoid broad frontend rewrites.

## 12. Workstream H — API Contract Matrix

**Priority: P2**

File:
`CONTRACT_MATRIX.md`

### Confirmed issue

The current file contains shell-style `echo` commands instead of a valid Markdown contract table.

### Required implementation

Convert it to a proper Markdown table with:

- Feature.
- HTTP method.
- Frontend request.
- Backend route.
- Request schema.
- Response schema.
- Authentication requirement.
- Authorization policy.
- Verification status.

Inspect actual routes, schemas, and response structures.

Do not label a route `OK` solely because the route exists.

Do not invent response shapes or permissions.

## 13. Workstream I — Reports and Handoff

**Priority: P2**

Update:

- `docs/reports/REPOSITORY_REMEDIATION_AUDIT.md`
- `docs/reports/REPOSITORY_REMEDIATION_EXECUTION_PLAN.md`
- `docs/reports/REPOSITORY_REMEDIATION_FINAL_REPORT.md`
- `docs/reports/DASHBOARD_LAYOUT_OVERHAUL_PLAN.md`
- `hand_off.md`

Required:

1. Reconcile all documents with actual source.
2. Correct stale baseline SHA references.
3. Record the actual starting and final SHA.
4. Distinguish previous historical test results from current verification.
5. Mark each finding FIXED, PENDING, BLOCKED, or UNVERIFIED.
6. Correct outdated statements about staff, runtime, task, and deliverable authorization.
7. Correct stale dashboard and Council page findings.
8. Record exactly which files changed and why.
9. Record commands actually executed and their results.
10. Record tests deliberately skipped.
11. Preserve historical information where appropriate instead of silently rewriting history.

The final report must not claim verification that was not performed.

## 14. Dashboard Scope Restriction

The previous commit contains a small dashboard action correction and a revised dashboard plan.

Preserve those changes.

Do not start a new visual dashboard redesign unless explicit Founder authorization is established in project instructions.

Do not change:
- Palette.
- Typography.
- Theme definitions.
- Design tokens.
- Governance Ledger visual baseline.

Safe functional fixes may proceed.

Do not start M4 or any future autonomy phase.

## 15. Fast Verification Policy

Do not run the entire test suite by default.

Use focused verification:

### Required

- Backend TypeScript check after backend changes.
- Frontend TypeScript/build check after frontend changes.
- Focused authorization tests for changed security paths.
- Focused runtime session and execution-permit verification.
- Focused Council page behavior verification where feasible.

### May be deferred

- Full test suite.
- Full E2E suite.
- Unrelated performance profiling.
- Unrelated migration tests.
- Tests for untouched features.

Do not disable or weaken existing tests.

Do not skip all verification of P1 security and runtime changes.

If a check cannot be run, mark the relevant result UNVERIFIED and explain why.

The previously reported 776/777 result is historical and must not be represented as the current result.

## 16. Parallel Execution

Use independent subagents with exclusive file ownership.

| Agent | Ownership |
|---|---|
| Runtime Engineer | authentication middleware, runtime lifecycle, execution guard |
| Authorization Engineer | tasks, staff, deliverables, canonical policy integration |
| Frontend Engineer | CouncilPage |
| Documentation Engineer | reports, handoff, contract matrix |
| Coordinator | integration, conflict resolution, final verification |

Rules:

- Inspect before editing.
- No two agents edit the same file.
- Shared helper changes must have one owner.
- Coordinator reviews all diffs.
- Prefer existing services and policies.
- Avoid speculative abstractions.
- Do not create architecture documents instead of implementing fixes.

Use relevant installed skills where available:
- Backend/security engineering.
- Ponytail backend audit.
- Impeccable frontend audit.
- Frontend UI engineering.
- Testing and code-quality skills.

Do not install new dependencies for this task.

## 17. Execution Loop

Use `/loop 5m`.

Repeat:

`Inspect → Implement → Integrate → Focused Verify → Review Diff → Fix`

Continue until:

- R1–R7 are resolved.
- R8 is resolved.
- R9–R10 are accurate.
- Applicable TypeScript/build checks pass.
- Focused security and runtime verification passes.
- No known regression from the changes remains.

If the same failure repeats three times without new evidence, stop repeating the same approach. Diagnose the blocker and either change the approach or document the unresolved issue.

Do not stop after the first successful compile.

## 18. Final Deliverables

Update the existing audit, execution plan, final report, dashboard plan if necessary, handoff, and contract matrix.

The final report must contain:

1. Actual starting SHA.
2. Actual final SHA.
3. Actual branch.
4. Findings fixed.
5. Findings pending or blocked.
6. Files changed.
7. Verification commands actually executed.
8. Actual results.
9. Tests intentionally skipped.
10. Remaining risks.
11. Any action requiring Founder approval.

Do not commit or push.

Do not formally accept Phase 9, M2, M3, M4, or M5 on the Founder's behalf.

## Final Directive

Finish the confirmed remediation with minimal delay.

Reuse working code. Correct the actual defects. Preserve the repository. Avoid unnecessary testing, but verify critical security and runtime behavior.

The immediate objective is an accurate, secure, acceptance-ready existing MVP—not additional feature expansion.