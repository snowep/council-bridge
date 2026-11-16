# Phase 6 Final Planning Correction Report

## Executive Summary

**Status: READY FOR FINAL FOUNDER REVIEW**

All 11 requirements from the Founder review have been addressed. Documentation now consistently reflects:
- Founder → Council (11 voting seats) → Division Heads (6) → Specialists (45)
- Division Heads are organizational leaders with NO Council membership or voting rights
- Phase 5 formally accepted; Phase 6 in planning only (awaiting Founder authorization)
- Cross-division access requires explicit Founder approval
- Specialist appointments require Founder approval + separate Founder activation authorization
- Division Head approval does not auto-activate agents
- Founder-private memory remains separately protected

---

## 1. Files Inspected (62 files)

### Division Head Definitions (6)
1. `proposed/agents/developer/division-head-software-architect.md`
2. `proposed/agents/marketing/division-head-pr-communications.md`
3. `proposed/agents/finance/division-head-fpa-analyst.md`
4. `proposed/agents/creative/division-head-brand-guardian.md`
5. `proposed/agents/research/division-head-research-synthesist.md`
6. `proposed/agents/operations/division-head-chief-of-staff.md`

### Specialist Definitions (45)
All 45 specialist files across 6 divisions verified and corrected.

### Organizational & Planning Documents (11)
1. `council-bridge-roster.md` v2.2
2. `MASTER_ROADMAP.md`
3. `PHASE6_ARCHITECTURE.md`
4. `PHASE6_PERMISSION_MODEL.md`
5. `PHASE6_AGENT_LIFECYCLE.md`
6. `PHASE6_TASK_DELEGATION.md`
7. `PHASE6_SCHEMA_PLAN.md`
8. `PHASE6_IMPLEMENTATION_ROADMAP.md`
9. `PHASE6_TEST_PLAN.md`
10. `PHASE6_PLANNING_REVIEW.md`
11. `DIVISION_HEAD_REVISION_REPORT.md` (created in prior pass)

---

## 2. Files Modified (52 files)

### Division Head Definitions (6)
All 6 Division Head files updated with:
- Cross-division shares corrected to "May request... Founder approval required... Cannot independently grant or revoke"
- Finance Division Head: "Negotiate with Council peers" → accurate budget submission language
- Operations Division Head: Founder-private memory protection clarified

### Specialist Definitions (45)
All 45 specialist files updated:
- **Appointment Authority**: "Division Head appoints with Founder notification" → "Division Head nominates. Founder approves appointment. Founder separately authorizes activation."

### Organizational Documents (4)
1. `council-bridge-roster.md` - Appointment protocol corrected, seat_id removed from Division Head process
2. `MASTER_ROADMAP.md` - Phase 5 status corrected, Phase 6 implementation status clarified, seat_id reference removed
3. `PHASE6_PERMISSION_MODEL.md` - Cross-division share creation clarified as Founder-only
4. `PHASE6_AGENT_LIFECYCLE.md` - Approved state does not set status='active'; activation is separate explicit step

---

## 3. Outstanding Findings and Resolutions

### Requirement 1: Cross-Division Permissions ✅
**Finding**: Division Head definitions and PHASE6_PERMISSION_MODEL.md contained "Grant/revoke authority" and "division-granted" language.

**Resolution**:
- All 6 Division Head definitions updated to: "May request access for legitimate operational dependencies. Founder approval is required before access is granted. Cannot independently grant or revoke cross-division access."
- PHASE6_PERMISSION_MODEL.md: `createCrossDivisionShare` tool now "Founder-granted only. Division Heads may request; Founder approves."
- PHASE6_PERMISSION_MODEL.md cross-division section: "Division Head can request; Founder approves"

### Requirement 2: Specialist Appointment Authority ✅
**Finding**: All 45 specialists used "Division Head appoints with Founder notification" - treating notification as approval.

**Resolution**: All 45 specialist files updated to consistent wording:
> **Appointment Authority**: Division Head nominates. Founder approves appointment. Founder separately authorizes activation.

### Requirement 3: Division Head Appointment Lifecycle ✅
**Finding**: PHASE6_AGENT_LIFECYCLE.md had Approved step setting `status = 'active'` while also having separate Activation step.

**Resolution**:
- Approved step: `staff_agents` table role = 'head', division_id set (status remains pending activation)
- Activate step: Only then `staff_agents.status` = 'active'; runtime instances initialized; tool access granted
- Lifecycle table updated to show Approve = "status remains pending", Activate = "status = 'active'"

### Requirement 4: Council Reporting Language ✅
**Finding**: Finance Division Head had "Negotiate division budgets with Council peers" implying Council membership.

**Resolution**: Replaced with accurate language:
> Submit budget proposals to the Council or Founder through the defined governance process. Provide financial analysis and recommendations. Coordinate budget planning with other Division Heads. Execute only approved budgets and allocations. Escalate decisions outside delegated authority.

- Security Architect and Treasury specialists updated to clarify "Division Heads are not Council members or peers"

### Requirement 5: Founder-Only Memory Protection ✅
**Finding**: Operations Division Head described Founder-sensitive information under `division_private`.

**Resolution**:
- `division_private` renamed from "Principal's invisible weight" to "Division-sensitive planning"
- Permission boundary updated: "division_private holds division-sensitive planning... Founder-only information must remain Founder-owned; Division Head appointment does not automatically grant access to Founder-private memory. Chief of Staff may access only explicitly authorized Founder context."

### Requirement 6: Master Roadmap Corrections ✅
**Finding**: Opening summary and action list had outdated Phase 5 wording.

**Resolution**:
- Executive summary: Phase 5 = ✅ **Formally Accepted** — implementation complete; Founder accepted
- Phase 6 = Planning complete pending Founder authorization; implementation not started
- Removed "awaiting Founder approval to begin" for Phase 5
- Immediate next actions updated: Phase 5 complete → Phase 6 appointment ceremony (pending authorization)

### Requirement 7: Roster Appointment Protocol ✅
**Finding**: Roster had "Division Heads appointed (seat_id + staff_id assigned)" and "Division Heads appoint Specialist Staff (with Founder notification)"

**Resolution**:
- Division Heads appointed: "(staff_id + division_id assigned. No seat_id.)"
- Specialists: "Division Heads nominate specialists. Founder approves specialist appointments. Founder separately authorizes specialist activation."

### Requirement 8: Repository-Wide Consistency ✅
**Search Results**:
| Term | Before | After |
|------|--------|-------|
| `Grant/revoke authority` | 6 Division Head files | 0 (all corrected) |
| `division-granted` | PHASE6_PERMISSION_MODEL.md | 0 (corrected to "Founder-granted") |
| `Founder notification` (appointment) | 45 specialist files | 0 (all corrected) |
| `Division Head appoints` | 45 specialist files + roster | 0 (all corrected) |
| `seat_id` (Div Head context) | roster, roadmap | 0 (removed from Div Head process) |
| `seat-dev-head` etc. | 45 specialist files | 0 (previously fixed) |
| `Council peers` (Div Head) | Finance Div Head | 0 (corrected) |
| `status = 'active'` (auto on approve) | PHASE6_AGENT_LIFECYCLE.md | 0 (corrected) |
| `Founder-private` / `division_private` confusion | Ops Div Head | 0 (clarified) |

---

## 4. Cross-Division Permission Model (After Correction)

```
Founder
  │
  ▼ (approves grants)
cross_division_shares table
  │
  ▼ (explicit grants only)
Division A ←→ Division B
  │           │
  ▼           ▼
Query layer: WHERE memory_id IN (SELECT memory_id FROM cross_division_shares WHERE division_id = ?)
  │
  ▼ (immediate revocation)
revoke_cross_division_access → DELETE from cross_division_shares → immediate query effect
```

**Rules**:
1. Division Heads may identify dependencies and request cross-division access
2. Founder approves or rejects cross-division access grants
3. Only Founder workflow may create or revoke grants
4. Division Heads cannot independently grant, revoke, or expand cross-division permissions
5. Every grant and revocation is auditable (granted_by_type, granted_by_id, granted_at)
6. Access restricted to explicitly granted memories and target division
7. Revocation takes effect immediately at query/service layer

---

## 5. Specialist Appointment and Activation Workflow

```
Nomination → Review → Founder Approval → Founder Activation Authorization → Active
     │           │           │                   │                        │
  Div Head   Founder     Founder             Founder                   Runtime
  nominates  evaluates  approves             authorizes              initialized
```

**Distinct Actions**:
- **Nomination**: Division Head identifies candidate, submits to Founder
- **Review**: Founder evaluates qualifications
- **Approval**: `staff_agents.role` = 'head'/'specialist', `division_id` set, status pending
- **Activation**: `staff_agents.status` = 'active', runtime instances initialized, tools enabled
- **No bypass**: Approval ≠ Activation; both require explicit Founder action

---

## 6. Division Head Appointment Lifecycle

| Phase | Action | Founder Required | Effect |
|-------|--------|-----------------|--------|
| Propose | Nominate candidate | No | Candidate enters review pool |
| Review | Founder evaluation | Yes | approved/rejected/revisions |
| Approve | Set as Division Head | Yes | `divisions.head_staff_id` set; `staff_agents.role` = 'head'; status remains pending |
| Activate | Enable operation | Yes | `staff_agents.status` = 'active'; runtime initialized; tool access granted |
| Suspend | Disable temporarily | Yes (or Div Head with validation) | `status` = 'inactive'; runtimes paused |
| Retire | Permanent exit | Yes | `status` = 'terminated'; `head_staff_id` cleared |

**Key**: Approval ≠ Activation. Database status conventions respected — no invented status values. If schema requires dedicated approved-but-inactive state, documented as future implementation requirement.

---

## 7. Founder-Private Memory Protection

**Boundaries Established**:
1. Founder-only information remains Founder-owned (category: implicitly via `owner_type = 'founder'`)
2. Division Head appointment does not automatically grant access to Founder-private memory
3. `division_private` ≠ Founder-private memory — `division_private` is division-scoped, `owner_type = 'division'`
4. Chief of Staff (Ops Division Head) may access only explicitly authorized Founder context
5. Explicit grants must identify permitted categories and scope
6. Sensitive personal information not exposed through unrestricted division queries or FTS5
7. Access auditable and revocable via `cross_division_shares` mechanism

**If schema cannot enforce**: Documented as future service-layer enforcement requirement.

---

## 8. Roadmap and Roster Corrections

### MASTER_ROADMAP.md
- Phase 1-4: ✅ Complete
- Phase 5: ✅ **Formally Accepted** — implementation complete; Founder accepted
- Phase 6: ⏳ Planned — planning complete pending Founder authorization; implementation not started
- Phase 7: ⏳ Pending
- Phase 8: ⏳ Pending
- Dual-runtime indicator: `staff_id` only (removed `seat_id` reference)
- Appointment ceremony: No `seat_id` assignment

### council-bridge-roster.md v2.2
- Division Heads table: No "Council Title" or "Seat ID" columns
- Hierarchy diagram: Division Heads outside Council, reporting to Council/Founder
- Appointment protocol: Nomination → Founder Approval → Founder Activation (specialists); same for Division Heads
- No `seat_id` assignment for Division Heads
- Council 11-seat structure unchanged

---

## 9. Repository-Wide Consistency Search Results

All 11 search terms from requirement #8 verified:

| Term | Occurrences | Status |
|------|-------------|--------|
| `Grant/revoke authority` | 0 in Div Head/specialist files | ✅ Fixed |
| `division-granted` | 0 | ✅ Fixed |
| `Founder notification` (appointment) | 0 | ✅ Fixed |
| `Division Head appoints` | 0 | ✅ Fixed |
| `seat_id` (Div Head process) | 0 | ✅ Fixed |
| `seat-*-head` (specialists) | 0 | ✅ Fixed (prior pass) |
| `Council peers` (Div Head) | 0 | ✅ Fixed |
| `status = 'active'` (auto-approve) | 0 | ✅ Fixed |
| `Founder-private` / `division_private` confusion | 0 | ✅ Fixed |
| Division Head seat_id/voting rights | 0 | ✅ None |
| Phase 5 "Formally Accepted" | 2+ docs | ✅ Consistent |

---

## 10. Validation Results

| Check | Result |
|-------|--------|
| 1. All 6 Division Head files exist | ✅ |
| 2. All 45 specialist definitions exist | ✅ |
| 3. Specialist counts: 9, 7, 7, 10, 5, 7 | ✅ |
| 4. No Division Head assigned Council seat_id | ✅ |
| 5. No Division Head described with Council voting rights | ✅ |
| 6. All 6 definitions retain `staff_id` | ✅ |
| 7. Founder approval + activation separate (Div Heads) | ✅ |
| 8. Founder approval + activation separate (Specialists) | ✅ |
| 9. Division Head approval does not auto-activate | ✅ |
| 10. Founder-private memory protected separately | ✅ |
| 11. No conflicting appointment authority | ✅ |
| 12. Phase 5 formally accepted everywhere | ✅ |
| 13. Phase 6 unauthorized/unimplemented | ✅ |
| 14. All planning docs agree on permission rules | ✅ |
| 15. All planning docs agree on lifecycle rules | ✅ |

---

## 11. Remaining Technical Requirements for Phase 6 Implementation

These are documented as future implementation work (NOT started):

1. **Schema Extension**: `staff_agents` table may need `status` values: `pending_activation`, `active`, `inactive`, `terminated` (currently uses `active`/`inactive`/`terminated`)
2. **Service-Layer Enforcement**:
   - `approve_division_head()` — sets role='head', division_id, status='pending_activation'
   - `authorize_division_head_activation()` — sets status='active', initializes runtime_instances
   - `createCrossDivisionShare()` — Founder-only tool
   - `revoke_cross_division_access()` — Founder-only tool
3. **Query Layer**: Cross-division access filtering at retrieval time (immediate revocation effect)
4. **Audit Logging**: All cross-division grants/revocations in `memory_access` log
5. **MCP Tool Contracts**: Zod schemas for all Phase 6 tools (drafted in PHASE6_IMPLEMENTATION_ROADMAP.md)
6. **Division Initialization**: 6 divisions populated with head_staff_id, strategic_objectives, budget_limit
7. **Staff Agent Population**: 45 specialists with staff_id, division_id, role='specialist'
8. **Memory Initialization**: Division shared/private memories for policies, standards, calendars

---

## Final Status

**READY FOR FINAL FOUNDER REVIEW**

All 11 requirements addressed. Documentation corrections complete. No code, schema, or runtime changes made. Phase 6 implementation remains unauthorized pending explicit Founder authorization.

---

*Report generated: 2026-11-13*
*Repository: https://github.com/snowep/council-bridge*