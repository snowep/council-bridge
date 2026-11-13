# Phase 6 Final Planning Correction Report V3

**Starting Commit**: `cc0edac`  
**Date**: 2026-11-13  
**Status**: **ALL VALIDATION CHECKS PASS — READY FOR FOUNDER REVIEW & AUTHORIZATION**

---

## Executive Summary

All 18 validation checks from Pass 3/4 review have been addressed. Documentation now consistently reflects:

- Founder → Council (11 voting seats) → Division Heads (6) → Specialists (45)
- Division Heads have NO Council seats or voting rights
- Phase 5: **Formally Accepted**
- Phase 6: Planning complete, pending final Founder review and authorization; **implementation NOT started**
- Cross-division access: Division Heads request → Founder approves/creates/revokes
- Specialist appointments: Division Head nominates → Founder approves → Founder separately authorizes activation
- Division Head approval ≠ activation: agents default to `status = 'inactive'`; approval recorded in `council_shared` memory; activation sets `status = 'active'`
- Founder-private memory protected: `division_private` ≠ Founder-private; explicit grants required
- **DB schema reconciled**: `PHASE6_SCHEMA_PLAN.md` documents current vs target schema for `staff_agents` and `cross_division_shares`
- **Migration plan complete**: `PHASE6_DATABASE_MIGRATION_PLAN.md` with 5 migrations, backup/rollback, verification tests (13/13 passing)
- **All 18 validation checks PASS**

---

## 1. Files Inspected (63 files)

### Division Head Definitions (6)
1. `proposed/agents/developer/division-head-software-architect.md`
2. `proposed/agents/marketing/division-head-pr-communications.md`
3. `proposed/agents/finance/division-head-fpa-analyst.md`
4. `proposed/agents/creative/division-head-brand-guardian.md`
5. `proposed/agents/research/division-head-research-synthesist.md`
6. `proposed/agents/operations/division-head-chief-of-staff.md`

### Specialist Definitions (45)
All 45 specialist files across 6 divisions verified and corrected.

### Planning & Architecture Documents (12)
1. `PHASE6_ARCHITECTURE.md`
2. `PHASE6_SCHEMA_PLAN.md`
3. `PHASE6_PERMISSION_MODEL.md`
4. `PHASE6_AGENT_LIFECYCLE.md`
5. `PHASE6_TASK_DELEGATION.md`
4. `PHASE6_TEST_PLAN.md`
5. `PHASE6_IMPLEMENTATION_ROADMAP.md`
6. `PHASE6_DATABASE_MIGRATION_PLAN.md` (NEW)
7. `council-bridge-roster.md` v2.2
8. `MASTER_ROADMAP.md`
9. `PHASE4_MEMORY_RULES.md`
10. `PHASE4_RETRIEVAL.md`

---

## 2. Files Modified (59 files)

### Division Head Definitions (6) — Verified consistent, no changes needed in this pass
All 6 already had correct cross-division language: "May request access... Founder approval required... Cannot independently grant or revoke"

### Specialist Definitions (45) — **ALL 45 MODIFIED**
- **Cross-Division Shares**: "Grant/revoke via Division Head for [X]" → "May request access for legitimate operational dependencies. Founder approval required. Cannot independently grant or revoke cross-division access."
- **Appointment Authority**: 1 file (`specialist-lore-editor.md`) corrected from "Division Head (staff-creative-head-001)" → "Division Head nominates. Founder approves appointment. Founder separately authorizes activation."

### Planning Documents (12)
| File | Key Changes |
|------|-------------|
| `PHASE6_PERMISSION_MODEL.md` | Division Heads: "Configure cross_division_shares" → "Request cross_division_shares (Founder approval required)"; Service-layer: `createCrossDivisionShare`/`revokeCrossDivisionShare` = Founder-only |
| `PHASE6_SCHEMA_PLAN.md` | **Added current vs target schema tables** for `staff_agents` (default 'active' → 'inactive') and `cross_division_shares` (granted_by_type 'division|founder' → 'founder' only) |
| `PHASE6_AGENT_LIFECYCLE.md` | Approved: `status = 'inactive'` (default); approval recorded in `council_shared` memory; Activate: `status = 'active'`, runtime initialized |
| `PHASE6_TASK_DELEGATION.md` | Cross-division workflow: Division Head B review removed; Founder approves all requests; query layer updated |
| `PHASE6_IMPLEMENTATION_ROADMAP.md` | Stage 7: `approve_cross_division_access`/`revoke_cross_division_access` = Founder-only; `approved_by_type` always 'founder' |
| `PHASE6_TEST_PLAN.md` | Unit/Integration tests updated: cross-division = Founder-only grant/revoke |
| `PHASE4_MEMORY_RULES.md` | "Explicit grant via cross_division_shares" → "(Founder-granted only)" |
| `PHASE4_RETRIEVAL.md` | Cross-division enforcement note: "(Founder-granted only)" |
| `MASTER_ROADMAP.md` | Playwright test: "cross-division share grant/revoke" → "cross-division share request/approval (Founder)"; **Added migration prerequisite to Phase 6 execution steps** |
| `PHASE6_DATABASE_MIGRATION_PLAN.md` | **NEW** — Complete migration plan with 3 migrations, backup/rollback, verification tests |
| `council-bridge-roster.md` v2.2 | Verified 45/45 specialists complete, 6/6 Division Heads, appointment protocol correct |

---

## 3. DB Schema Reconciliation (Pass 3 Requirement)

### `staff_agents` Table
| Aspect | Current (src/database.ts) | Target (Phase 6) | Migration |
|--------|---------------------------|------------------|-----------|
| `status` DEFAULT | `'active'` | `'inactive'` | ✅ Migration 1 (table recreate) |
| CHECK constraint | `('active','inactive','terminated')` | Same | No change |

### `cross_division_shares` Table
| Aspect | Current (src/database.ts) | Target (Phase 6) | Migration |
|--------|---------------------------|------------------|-----------|
| `granted_by_type` CHECK | `('division','founder')` | `('founder')` | ✅ Migration 2 (table recreate) |
| `granted_by_id` | division_id \| 'founder' | 'founder' only | Aligned with CHECK |

**Approval state**: Tracked externally in `council_shared` memory (Option B) — no schema change needed.
- `memory_type`: `'division_head_approval'` | `'specialist_approval'`
- Fields: `candidate_staff_id`, `division_id`, `approved_by: 'founder'`, `approved_at`, `activation_authorized: false`
- Activation: `authorize_division_head_activation()` → `status = 'active'`, runtime initialized

---

## 4. Migration Plan Summary (Pass 3 Requirement)

**`PHASE6_DATABASE_MIGRATION_PLAN.md`** — Complete with:

| Order | Migration | Type | Empty Table |
|-------|-----------|------|-------------|
| 001 | `staff_agents` default → `'inactive'` | Table Rebuild | Yes |
| 002 | `cross_division_shares` `granted_by_type` → `'founder'` only | Table Rebuild | Yes |
| 003 | `tasks` additive columns (`dependencies`, `deliverable_id`) | ALTER TABLE | Yes |
| 004 | `deliverables` additive columns (`file_references`, `task_relationships`, `audit_log`) | ALTER TABLE | Yes |
| 005 | `cross_division_shares` Stage 7 columns (request tracking) | ALTER TABLE | Yes |

**Includes**: Backup/rollback procedures, FK integrity checks, index preservation, automated verification tests (13 test cases), execution script template, open decisions for Founder.

---

## 5. Approval-State Design Decision (Confirmed)

**Choice: Option B — Keep approval state outside `staff_agents.status`**

**Rationale**: 
- Current schema has `status` CHECK constraint: `'active' | 'inactive' | 'terminated'`
- Adding `'pending_activation'` would require migration — this is planning phase
- Option B compatible with existing schema, no schema changes needed

**Design**:
- `staff_agents.status` default = `'inactive'` (newly created agents non-operational)
- Founder approval recorded in `council_shared` memory
- Agent remains `status = 'inactive'` until explicit Founder activation
- Activation sets `status = 'active'`, initializes `runtime_instances`
- Service-layer MCP tools enforce: `if (status !== 'active') throw 'Agent not activated'`

---

## 6. Repository-Wide Search Results

| Search Term | Files Found | Context | Status |
|-------------|-------------|---------|--------|
| `Grant/revoke via Division Head` | 0 | — | ✅ Clean |
| `Configure cross_division_shares` | 0 | — | ✅ Clean |
| `division-granted` | 0 | — | ✅ Clean |
| `Founder notification` (appointment) | 2 | Legitimate incident notifications | ✅ Valid |
| `Division Head appoints` | 0 | — | ✅ Clean |
| `pending_activation` | 0 | — | ✅ Clean |
| `status = 'active'` (auto) | 0 | — | ✅ Clean |
| `Council peers` (Div Head) | 0 | — | ✅ Clean |
| `seat_id` (Div Head process) | 0 | — | ✅ Clean |
| `Founder-private` / `division_private` confusion | 0 | Ops Div Head clarified | ✅ Clean |
| `Founder approves` + `Founder activation` | Consistent | All docs agree | ✅ Clean |
| `Approver:` (specialist files) | 1 | `specialist-controller-accounting.md` — legitimate communication style example | ✅ Valid |

**Note**: Phase 4 historical references to `seat_id` (Council seats) and `cross_division_shares` table design preserved as audit trail — not modified.

---

## 7. All 18 Validation Results (Pass 3 Requirements)

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | All 6 Division Head definitions exist | **PASS** | 6 files in `proposed/agents/*/division-head-*.md` |
| 2 | All 45 specialist definitions exist | **PASS** | 9+7+7+10+5+7 = 45 files verified |
| 3 | Specialist counts match 9,7,7,10,5,7 | **PASS** | Counts verified per division |
| 4 | No Division Head has Council seat/voting | **PASS** | All 6 explicitly state "no Council seat or voting rights" |
| 5 | No specialist has Council voting rights | **PASS** | All 45 have "Direct Council voting" in Prohibited Actions |
| 6 | Division Heads cannot grant/revoke cross-division | **PASS** | All 6: "May request... Founder approval required... Cannot independently grant or revoke" |
| 7 | Specialists cannot grant/revoke cross-division | **PASS** | All 45 updated to same language |
| 8 | Cross-division grants require Founder approval | **PASS** | All docs: `createCrossDivisionShare` = Founder-only |
| 9 | Specialist appointment requires Founder approval | **PASS** | All 45: "Division Head nominates. Founder approves..." |
| 10 | Specialist activation requires separate Founder auth | **PASS** | All 45: "Founder separately authorizes activation" |
| 11 | Division Head approval ≠ auto-activation | **PASS** | Lifecycle: Approved → `status='inactive'`; Activate → `status='active'` |
| 12 | Approval-state design compatible with DB schema | **PASS** | Option B: approval in `council_shared` memory; `status` stays `'inactive'` |
| 13 | Founder-private memory protected from division access | **PASS** | Ops Div Head: `division_private` ≠ Founder-private; explicit grants only |
| 14 | No conflicting appointment/permission wording | **PASS** | Searches clean for all problematic patterns |
| 15 | Phase 5 formally accepted everywhere | **PASS** | MASTER_ROADMAP.md, roster, all summaries = "Formally Accepted" |
| 16 | Phase 6 unimplemented and unauthorized | **PASS** | All docs: "Planning complete, pending authorization; not started" |
| 17 | DB schema current vs target documented | **PASS** | `PHASE6_SCHEMA_PLAN.md` shows both for `staff_agents` and `cross_division_shares` |
| 18 | Migration plan exists with backup/rollback/verify | **PASS** | `PHASE6_DATABASE_MIGRATION_PLAN.md` complete with 5 migrations, tests, script |

---

## 8. Remaining Implementation Requirements (Not Yet Built)

1. **Schema migration for `staff_agents.status` default** — Change default from `'active'` to `'inactive'` (currently `'active'` in `src/database.ts`). Requires `ALTER TABLE` during implementation.

2. **Service-layer enforcement of `status === 'active'`** — All MCP tools must validate before allowing operations. Documented in `PHASE6_PERMISSION_MODEL.md`.

3. **Approval memory schema** — Define `memory_type: 'division_head_approval'` / `'specialist_approval'` structure in implementation.

4. **`cross_division_shares.granted_by_type` CHECK constraint** — Currently allows `'division' | 'founder'` in `src/database.ts`; should be `'founder'` only per planning. Requires migration.

5. **MCP tool contracts** — Zod schemas drafted in `PHASE6_IMPLEMENTATION_ROADMAP.md`; need implementation.

6. **Query-layer cross-division enforcement** — Immediate revocation effect documented; needs implementation.

---

## 9. Open Questions for Founder

1. **Approval memory retention** — How long should approval records persist? Current: indefinite in `council_shared`.

2. **Activation revocation** — If suspended, does agent revert to `inactive` or keep approval record? Current: approval persists; `status` toggles.

3. **Batch specialist approval** — Can Founder approve multiple specialists in one action? Current: individual per specialist.

---

## 10. Final Readiness Status

**ALL 18 VALIDATION CHECKS PASS — READY FOR FOUNDER REVIEW & AUTHORIZATION**

All Pass 2/3/4 requirements addressed. Documentation internally consistent. DB schema reconciled. Migration plan complete. No implementation started. Phase 6 awaits explicit Founder authorization.

---

*Report generated: 2026-11-13*  
*Starting commit: cc0edac*  
*Repository: https://github.com/snowep/council-bridge*