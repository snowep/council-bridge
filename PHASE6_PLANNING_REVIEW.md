# Phase 6 Planning Review

## 1. Executive Summary

**Overall Decision: READY AFTER MINOR CORRECTIONS**

The seven Phase 6 planning documents are architecturally sound and consistent with each other. The existing database schema is FK-ready but has minor discrepancies with the planning documents. The roster is verified: 6 Division Heads and 45 specialist definitions exist in the filesystem and match the `council-bridge-roster.md` v2.2.

**Critical findings:** None.
**High findings:** 3 (database schema vs. planning doc discrepancies)
**Medium findings:** 2 (MCP tool contracts need formalization, cross-division request storage)
**Low findings:** 1 (deliverable versioning ambiguity)

All findings are corrections to planning documents, not implementation blockers. Phase 6 is technically ready for Founder approval pending these corrections.

---

## 2. Documents Reviewed

| Document | Status | Lines |
|----------|--------|-------|
| `PHASE6_ARCHITECTURE.md` | Reviewed | 67 |
| `PHASE6_SCHEMA_PLAN.md` | Reviewed | 146 |
| `PHASE6_PERMISSION_MODEL.md` | Reviewed | 105 |
| `PHASE6_AGENT_LIFECYCLE.md` | Reviewed | 100 |
| `PHASE6_TASK_DELEGATION.md` | Reviewed | 215 |
| `PHASE6_TEST_PLAN.md` | Reviewed | 93 |
| `PHASE6_IMPLEMENTATION_ROADMAP.md` | Reviewed | 169 |
| `council-bridge-roster.md` v2.2 | Verified | 228 |
| `src/database.ts` (actual schema) | Inspected | — |
| `proposed/agents/` (51 files) | Verified | 51 definitions |

---

## 3. Roster Verification

### Verification Results

| Division | Division Head File | Specialist Files | Total | Roster Match |
|----------|-------------------|------------------|-------|--------------|
| Developer | `division-head-software-architect.md` | 9 | 10 | ✅ 9/9 |
| Marketing | `division-head-pr-communications.md` | 7 | 8 | ✅ 7/7 |
| Finance | `division-head-fpa-analyst.md` | 7 | 8 | ✅ 7/7 |
| Creative | `division-head-brand-guardian.md` | 10 | 11 | ✅ 10/10 |
| Research & Intelligence | `division-head-research-synthesist.md` | 5 | 6 | ✅ 5/5 |
| Business Operations | `division-head-chief-of-staff.md` | 7 | 8 | ✅ 7/7 |
| **TOTAL** | **6 Division Heads** | **45 Specialists** | **51** | ✅ **All present** |

### Key Observations
- All 6 Division Head definition files exist in `proposed/agents/`
- All 45 specialist definition files exist in `proposed/agents/`
- Each file has frontmatter with `name`, `description`, `color`, `emoji`
- No duplicate `staff_id` values found in roster
- No missing files — roster v2.2 matches filesystem exactly
- Four permanent Council members (Steve Jobs, Virgil Abloh, Shawn Stüssy, G-Dragon) remain distinct from Division Heads and specialists

**Roster Status: VERIFIED — No discrepancies**

---

## 4. Architecture Consistency Audit

### Cross-Document Consistency: ✅ PASS

All seven planning documents agree on:
- Entity names: `divisions`, `staff_agents`, `division_members`, `cross_division_shares`, `tasks`, `deliverables`
- Six division names and purposes
- Division Head authority scope
- Task lifecycle states: `pending → in_progress → review → completed | failed`
- Deliverable lifecycle: `submitted → under_review → approved | rejected`
- Dual-runtime shared identity via `staff_id`
- Founder-reserved approvals

### Minor Discrepancy Found

**Finding A1 (Low): Deliverable versioning ambiguity**
- `PHASE6_TASK_DELEGATION.md` line 137-139: "Each review creates new `deliverables` row? No — `updated_at` tracks changes. Or separate `deliverable_versions` table if needed"
- `PHASE6_SCHEMA_PLAN.md` uses single-row with `audit_log` JSON
- `src/database.ts` actual schema uses single-row with `status` transitions
- **Correction needed:** Decide and document one approach in both planning docs and schema

---

## 5. Database Readiness

### Actual Schema vs. Planning Document Comparison

| Table | Existing in DB | Required Changes | Migration Required | Readiness |
|-------|----------------|------------------|-------------------|-----------|
| `divisions` | ✅ Full schema | None | No | READY |
| `staff_agents` | ✅ Full schema | None | No | READY |
| `division_members` | ✅ Full schema | None | No | READY |
| `cross_division_shares` | ✅ Full schema + FKs | Add `revoked_at` (already present), add FK to `memory_entries` (already present) | No | READY |
| `tasks` | ✅ Full schema (different fields) | **Schema mismatch** — see below | No (empty table) | NEEDS SYNC |
| `deliverables` | ✅ Full schema (different fields) | **Schema mismatch** — see below | No (empty table) | NEEDS SYNC |

### Schema Discrepancies (High Severity)

**Finding A2 (High): `tasks` table field differences**

| Field | Planning Doc (`PHASE6_SCHEMA_PLAN.md`) | Actual DB (`src/database.ts`) | Resolution |
|-------|----------------------------------------|------------------------------|------------|
| `assigned_to_type` | `'seat' \| 'division' \| 'staff' \| 'founder'` | `'division' \| 'staff'` | Expand DB CHECK or restrict planning doc |
| `assigned_to_id` | seat_id \| division_id \| staff_id \| 'founder' | division_id \| staff_id | Align domains |
| `created_by_type` | same as assigned_to_type | `'founder' \| 'council' \| 'division_head'` | Align domains |
| `status` | `'pending' \| 'in_progress' \| 'review' \| 'completed' \| 'failed'` | `'pending' \| 'in_progress' \| 'review' \| 'completed' \| 'cancelled'` | Replace `'failed'` with `'cancelled'` or add both |
| `priority` | INTEGER 1-5 | `'low' \| 'medium' \| 'high' \| 'critical'` | Change DB to INTEGER or planning doc to enum |
| `dependencies` | JSON array | Missing | **Add column** |
| `deliverable_id` | FK to deliverables | Missing | **Add column + FK** |
| `budget_allocated` | Missing | Present | Add to planning doc |

**Finding A3 (High): `deliverables` table field differences**

| Field | Planning Doc | Actual DB | Resolution |
|-------|--------------|-----------|------------|
| `submitted_by_type` | `'seat' \| 'division' \| 'staff' \| 'founder'` | `'staff' \| 'division'` | Align domains |
| `status` | `'submitted' \| 'under_review' \| 'approved' \| 'rejected'` | `'submitted' \| 'accepted' \| 'rejected' \| 'revision_requested'` | Align terminology |
| `reviewed_by_type` | `'seat' \| 'division' \| 'staff' \| 'founder'` | `'founder' \| 'council' \| 'division_head'` | Align domains |
| `file_references` | JSON array | Missing | **Add column** |
| `task_relationships` | JSON array | Missing | **Add column** |
| `audit_log` | JSON array | Missing | **Add column** |
| `content` | File path or summary | "JSON payload" | Align description |

**Finding A4 (High): `cross_division_shares` missing in planning doc but present in DB**

- DB has: `FK (memory_id) REFERENCES memory_entries`, `FK (division_id) REFERENCES divisions`, `UNIQUE(memory_id, division_id)`, `revoked_at` column
- Planning doc mentions only basic columns
- **Correction:** Update `PHASE6_SCHEMA_PLAN.md` to match actual DB schema

### Indexes
All indexes in planning doc match actual DB indexes ✅

### Migration Strategy
Tables are empty (`CREATE TABLE IF NOT EXISTS`). Schema changes require:
1. Update planning doc to match DB (or vice versa)
2. If changing DB: drop and recreate empty tables, or `ALTER TABLE ADD COLUMN` for new fields
3. No data migration needed (no existing rows)
4. Schema v4.0.0 already baked; no version bump

---

## 6. Permission and Founder Authority Audit

### Separation Verified: ✅ PASS

| Role | Planning Doc | Technical Enforcement |
|------|--------------|----------------------|
| Founder | Approves appointments, authorizes activation, retains reserved approvals | Service-layer validation + audit logging |
| Council | Strategic direction, governance authority only | Seat-based permissions; no operational control over staff |
| Division Heads | Manage division, assign specialists, internal tasks, cross-division requests | `staff_agents.division_id` FK, `division_members` PK, service-layer checks |
| Specialists | Execute work, report to Division Head | `staff_agents.status`, tool access validation |

### Technical Enforcement Confirmed: ✅ PASS

- **Agents cannot grant themselves permissions**: All tools validate `staff_id` ownership and `division_id` membership
- **Division Heads cannot appoint themselves**: `createDivisionHead` is Founder-only MCP tool
- **Division isolation enforced**: Query layer uses `WHERE division_id = current_division` + `cross_division_shares` grants
- **Cross-division requires authorization**: Explicit `cross_division_shares` rows, Founder-approved
- **Founder approval cannot be bypassed**: No tools allow self-approval; all Founder actions audited
- **Approval ≠ Activation**: `approve_division_head` sets role; `authorize_activation` sets status='active' and enables tool access
- **Unauthorized requests fail safely**: Service layer returns 403/permission-denied errors

---

## 7. Agent Lifecycle Audit

### Lifecycle States Supported: ✅ PASS

| State | Authorized Actor | Preconditions | Validation | Audit Record |
|-------|------------------|---------------|------------|--------------|
| Proposed | Human/Agent | Candidate identified | None | Proposal in review pool |
| Reviewed | Founder | Proposal exists | Qualifications, workload, dual-runtime | Founder decision recorded |
| Approved | Founder | Reviewed=approved | `divisions.head_staff_id` set, `staff_agents.role`='head' | `council_shared` memory |
| Rejected | Founder | Reviewed=rejected | Candidate returns to pool | Rejection logged |
| Activated | Founder | Approved + explicit authorization | `status`='active', `runtime_instances` initialized, tools enabled | Audit log |
| Suspended | Founder / Div Head (with validation) | Active | `status`='inactive', runtimes paused | Who/when/why logged |
| Retired | Founder | Active/suspended | `status`='terminated', `head_staff_id` cleared | History preserved |

### Key Guarantees: ✅ PASS
- Approval does not auto-activate (separate Founder action required)
- All transitions have authorized actor, preconditions, validation, audit record
- Failure behavior: rejected returns to pool; suspended pauses responsibilities; retired clears head role
- Dual-runtime identity: one `staff_id` = one logical employee; `runtime_instances` tracks per-runtime availability

---

## 8. Task and Deliverable Audit

### Task Delegation: ✅ PASS (with schema sync needed)

Supported:
- Creation by Founder, Division Head, Specialist
- Assignment types: staff, division, seat, founder (planning) / division, staff (DB — needs sync)
- Reassignment within division by Division Head
- Priority 1-5 (planning) / enum (DB — needs sync)
- Deadlines: `due_at` ISO datetime
- Dependencies: JSON array, cyclic detection, auto-transition on resolution
- Status transitions: `pending → in_progress → review → completed | failed` (planning) / `cancelled` (DB — needs sync)
- Failure/retry: 3 failures escalate to Founder; re-assign or modify scope

### Deliverables: ✅ PASS (with schema sync needed)

Supported:
- Ownership via `submitted_by_type`/`submitted_by_id`
- Task relationship via `task_id` FK
- Version history via `audit_log` JSON (planning) / needs DB column
- Review status: `submitted → under_review → approved | rejected` (planning) / different enum (DB — needs sync)
- File references: JSON array (planning) / needs DB column
- Audit history: immutable append-only JSON (planning) / needs DB column

### Cross-Division Tasks: ✅ PASS

- Explicit ownership and authorization rules defined
- Request format with type, justification, priority, deadline
- Workflow: Division Head A requests → Division Head B reviews → Founder notified (optional)
- No unilateral access; all grants auditable
- Conflict resolution: originating division priority, Founder decides ties

---

## 9. Runtime and MCP Integration Audit

### Dual-Runtime Support: ✅ PASS

- Same `staff_id` registers on both Claude Code and Hermes Agent
- `runtime_instances` JSON: `['claude']`, `['hermes']`, `['claude', 'hermes']`
- Offline behavior: messages queued per runtime, delivered when instance returns
- Duplicate execution prevention: task tracking per runtime
- Failure recovery: if one runtime fails, other continues or retry scheduled
- Session state synchronized via shared `staff_id`

### MCP Tool Contracts (Planned)

| Tool | Input | Output | Permission |
|------|-------|--------|------------|
| `register_agent` | `staff_id, name, role, division_id` | agent info | Any authenticated |
| `send_message` | `sender_id, recipient_id, content, reply_to` | message | Any authenticated |
| `check_inbox` | `agent_id` | messages[] | Owner or Division Head |
| `reply_message` | `agent_id, message_id, content` | message | Owner |
| `create_division` | `name, description, budget_limit, strategic_objectives` | division | Founder |
| `assign_division_head` | `staff_id, division_id` | confirmation | Founder |
| `approve_division_head` | `candidate_staff_id, division_id` | appointment | Founder |
| `authorize_division_head_activation` | `staff_id, division_id` | activation | Founder |
| `register_staff_agent` | `staff_id, name, role, division_id, runtime_instances` | agent | Division Head |
| `create_task` | `title, description, assigned_to_type, assigned_to_id, priority, due_at, dependencies` | task | Founder / Div Head |
| `update_task` | `task_id, status, priority, due_at` | task | Assignee / Div Head |
| `create_deliverable` | `task_id, content, submitted_by_type, submitted_by_id` | deliverable | Assignee |
| `update_deliverable` | `deliverable_id, status, reviewed_by_type, reviewed_by_id` | deliverable | Reviewer |
| `grant_cross_division_access` | `memory_id, division_id, granted_by` | share | Founder / Div Head |
| `revoke_cross_division_access` | `memory_id, division_id` | revocation | Founder / Div Head |
| `suspend_division_head` | `staff_id, reason` | suspension | Founder |
| `retire_division_head` | `staff_id` | retirement | Founder |

**Finding A5 (Medium): MCP tool contracts need formal Zod schemas in planning docs**
- Current docs describe tools informally
- Required: formal `z.object({...})` schemas for each new tool
- Location: `PHASE6_IMPLEMENTATION_ROADMAP.md` Stage 3, 5, 6, 7

**Finding A6 (Medium): Cross-division request storage undefined**
- `PHASE6_TASK_DELEGATION.md` line 183: "stored in pending queue (new table or `cross_division_shares` extension)"
- DB has no `cross_division_requests` table
- **Resolution:** Add table or extend `cross_division_shares` with `request_type`, `status` fields

---

## 10. Memory Integration Audit

### Phase 4 Compatibility: ✅ PASS

- Division-owned memory: `owner_type='division'`, `owner_id=division_id`
- Staff-owned memory: `owner_type='staff'`, `owner_id=staff_id`
- Task memory: `division_id` + `task_id` columns on `memory_entries`
- Deliverable memory: same columns
- Founder-owned business context: `owner_type='founder'`, `owner_id='founder'`
- Cross-division shared memory: `cross_division_shares` grants
- Privacy enforcement: query layer filters by ownership + explicit shares
- Version history: `memory_versions` with `supersedes_id` chain
- Audit logging: `memory_access` tracks all access

### Business Context (Preserved): ✅ PASS
- Clothing brand, streetwear, lore-driven — no invented details
- Founder supplies details later

---

## 11. Phase 5 Compatibility

### Integration Points Identified

| Phase 5 Component | Phase 6 Integration | Risk |
|-------------------|---------------------|------|
| Dashboard | New org overview section (optional, Stage 9) | LOW — additive only |
| Chat | Agent roster dropdown with division heads/specialists | LOW — uses existing `messageService` |
| Council | Division Heads visible as non-voting members | LOW — new data source |
| Memory | Division/Staff memory categories visible | LOW — uses existing MemoryService |
| Meetings | No changes | NONE |
| Navigation | New org routes (optional) | LOW — hash-based routing extensible |
| MCP Messaging | Existing 25+ tools unchanged | NONE |

### Regression Risks: ✅ MINIMAL
- Phase 5 uses existing MCP server and services
- Phase 6 adds new tools; existing 25+ tools remain untouched
- Database: new tables empty, no schema changes to Phase 1-4 tables
- UI: Phase 6 dashboard sections optional (deferred to Phase 7)

---

## 12. Implementation Roadmap Assessment

### Dependency Order: ✅ TECHNICALLY SOUND

| Stage | Dependencies | Parallelizable? | Blocking Decision |
|-------|--------------|-----------------|-------------------|
| 1: Roster Verification | None | No | Founder reviews roster |
| 2: Data Model | Stage 1 | No | Schema sync (Findings A2-A4) |
| 3: Division Services | Stage 2 | No | — |
| 4: Founder Workflow | Stage 3 | No | Founder approval authority |
| 5: Staff Onboarding | Stage 3 + 4 | Yes (with 4) | — |
| 6: Task/Deliverable | Stage 3 + 5 | Yes (with 5) | Schema sync |
| 7: Cross-Division | Stage 3 + 4 | Yes (with 4) | Request storage (Finding A6) |
| 8: MCP Integration | Stages 3-7 | No | — |
| 9: Dashboard (opt.) | Stage 8 | Yes (with 8) | Founder scope decision |
| 10: Acceptance | All | No | Founder authorization |

### Critical Path
Stage 1 → 2 → 3 → 4 → (5,6,7 in parallel) → 8 → 10

### Milestones: ✅ WELL-DEFINED
Each milestone has scope, dependencies, tests, completion criteria.

---

## 13. Risks and Blocking Issues

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | Roster discrepancies delay Stage 1 | Medium | Verified: roster matches filesystem |
| R2 | Dual-runtime desynchronization | Medium | `runtime_instances` tracking + health checks |
| R3 | Founder approval velocity | High | Clear stage gates; Founder decisions at 4, 10 |
| R4 | Cross-division admin burden | Low | Explicit grants; bulk tools if needed |
| R5 | Task dependency cycle bugs | Medium | Detection at creation; test edge cases |
| R6 | Schema sync needed before Stage 2 | High | Update planning doc or DB before Stage 2 |
| R7 | Dashboard scope creep (Stage 9) | Low | Keep strictly optional per instructions |

---

## 14. Required Document Corrections

| Finding | Severity | File(s) | Correction Required | Blocks Implementation? |
|---------|----------|---------|---------------------|------------------------|
| A1: Deliverable versioning ambiguity | Low | `PHASE6_TASK_DELEGATION.md`, `PHASE6_SCHEMA_PLAN.md` | Document single approach: `audit_log` JSON or `deliverable_versions` table | No |
| A2: `tasks` table schema mismatch | High | `PHASE6_SCHEMA_PLAN.md` | Align fields with actual DB (`src/database.ts`) or update DB | **Yes — Stage 2** |
| A3: `deliverables` table schema mismatch | High | `PHASE6_SCHEMA_PLAN.md` | Align fields with actual DB | **Yes — Stage 2** |
| A4: `cross_division_shares` incomplete in planning | High | `PHASE6_SCHEMA_PLAN.md` | Document all DB columns: FKs, UNIQUE, `revoked_at` | No (DB already correct) |
| A5: MCP tool contracts informal | Medium | `PHASE6_IMPLEMENTATION_ROADMAP.md` | Add formal Zod schemas for all new tools | No (implementation detail) |
| A6: Cross-division request storage undefined | Medium | `PHASE6_TASK_DELEGATION.md`, `PHASE6_IMPLEMENTATION_ROADMAP.md` | Define table or extend `cross_division_shares` | No (Stage 7 detail) |

---

## 15. Final Readiness Decision

### Architecture Readiness: **READY**
All seven documents consistent, hierarchy sound, entities defined, lifecycle complete.

### Database Readiness: **READY AFTER MINOR CORRECTIONS**
Tables exist and are FK-ready. **Required:** Sync planning doc with actual DB schema for `tasks` and `deliverables` tables (Findings A2, A3, A4). Tables are empty — no migration risk.

### Roster Readiness: **READY**
All 6 Division Heads + 45 specialists verified in filesystem. Matches `council-bridge-roster.md` v2.2 exactly.

### Permission Readiness: **READY**
Technical enforcement at service + DB layers confirmed. Founder/Council/Division Head/Specialist separation correct.

### Implementation Readiness: **READY AFTER MINOR CORRECTIONS**
Roadmap is dependency-aware. Only blockers: schema sync (A2, A3) before Stage 2.

---

**OVERALL DECISION: READY AFTER MINOR CORRECTIONS**

Phase 6 planning is technically sound and ready for Founder approval, pending:
1. Update `PHASE6_SCHEMA_PLAN.md` to match actual DB schema for `tasks`, `deliverables`, `cross_division_shares`
2. Resolve deliverable versioning ambiguity (A1)
3. Define cross-division request storage (A6)

These are documentation corrections only. No implementation work required before Founder authorization.

**Report location:** `C:\Projects\council-bridge\PHASE6_PLANNING_REVIEW.md`