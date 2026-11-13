# Council Bridge — MASTER ROADMAP
**Version**: 1.0
**Date**: 2026-11-13
**Status**: ACTIVE — Single Source of Truth for All Phases

---
## Executive Summary
This roadmap consolidates the 8-phase Council Bridge architecture with the 6-stage Agency Agents research process into a unified execution plan. Phases 1–4 are **COMPLETE**. Phase 5 (Dashboard and Chat) is ✅ **Formally Accepted** — implementation complete; Founder accepted. Phases 6–8 are **PLANNED** — Phase 6 planning complete pending Founder authorization; implementation not started.

| Phase | Name | Status | Key Deliverable |
|-------|------|--------|-----------------|
| 1 | MCP Agent Communication | ✅ Complete | `src/agents.ts`, `server.ts` — register, send, inbox, reply |
| 2 | Council Governance | ✅ Complete | 11 seats, personas, constitutions, founder approvals |
| 3 | Council Formation & Meetings | ✅ Complete | Candidates, deliberation, votes, meetings, evaluations |
| 4 | Memory & Knowledge Subsystem | ✅ Complete | 14 categories, versioning, FTS5, cross-division shares, 106 tests passing |
| 5 | Dashboard and Chat | ✅ **Formally Accepted** | Implementation complete; Founder accepted |
| 6 | Division Management, Staff Agents and Delegation | ⏳ Planned | Founder appointment ceremony triggers |
| 7 | Autonomy, Permissions and Execution | ⏳ Planned | After Phase 6 |
| 8 | Security and Reliability | ⏳ Planned | After Phase 7 |

---
## Phase 1–4: COMPLETE (Foundation)
### Phase 1: MCP Server for Agent Communication
- **Files**: `src/agents.ts`, `src/server.ts`, `README.md`
- **Capabilities**: Agent registration (Zod-validated), message send/inbox/reply, dual-runtime support (Claude + Hermes)
- **Tests**: 106 tests passing, `tsc --noEmit` clean

### Phase 2: Council Governance
- **Tables**: `council_seats`, `personas`, `runtime_personas`, `constitutions`, `founder_approvals`, `schema_version`
- **Features**: 11 seats (4 permanent founder, 7 replaceable), persona per seat shared across runtimes, constitution versioning with founder approval workflow

### Phase 3: Council Formation, Meetings, Evaluation
- **Tables**: `candidates`, `founder_deliberations`, `founder_votes`, `meetings`, `meeting_phases`, `primary_ideas`, `brainstorm_records`, `challenges`, `defenses`, `syntheses`, `reassessments`, `evaluations`, `evaluation_criteria`
- **Process**: 9-phase meeting flow (preparation → founder_deliberation → primary_ideas → brainstorming → challenges → synthesis → reassessment → evaluation → closure)
- **Evaluation**: 5 criteria (cultural_impact, creative_output, collaborative_spirit, strategic_vision, authenticity) with weighted scoring

### Phase 4: Memory & Knowledge Subsystem
- **Tables**: `memory_entries`, `memory_versions`, `memory_links`, `memory_access`, `memory_fts` (FTS5) + 6 future tables created empty
- **14 Memory Categories**:
  - Council (8): `individual_persona`, `council_shared`, `meeting_history`, `decision_resolution`, `idea_proposal`, `research_evidence`, `lesson_learned`, `unresolved_question`
  - Division/Staff/Org (6): `division_shared`, `division_private`, `staff_private`, `business_context`, `task_history`, `cross_division`
- **Ownership Model**: Polymorphic `owner_type` (seat|division|staff|founder) + `owner_id`
- **Versioning**: Immutable `memory_versions` with `supersedes_id` chain, runtime attribution (claude|hermes)
- **Search**: FTS5 with porter/unicode61 tokenization, triggers for sync
- **Access Control**: Privacy matrix enforced at query layer + `cross_division_shares` for explicit grants
- **Future Tables Ready**: `divisions`, `staff_agents`, `division_members`, `cross_division_shares`, `tasks`, `deliverables` — empty, FK-ready
- **Verification**: 130 Phase 4-specific tests passing (100% coverage of PHASE4_TEST_PLAN.md)

---
## Phase 5: Dashboard and Chat (✅ **FORMALLY ACCEPTED**)
**Implementation Complete** — All acceptance criteria met, Founder review passed.

### Application Layout & Navigation
- Sidebar with phase navigation (1–8), collapsible
- Dashboard home: status cards for active meetings, recent decisions, task summary
- Chat panel: persistent session, scroll position memory per viewer

### Chat Interface
- Message list with avatars (Claude/Hermes dual-runtime indicators)
- Input field with /commands, markdown support, attachment upload
- Real-time typing indicators, read receipts, per-viewer localStorage session state

### Agent Communication
- MCP tool shortcuts: `/create-memory`, `/search-memory`, `/link-memory`, `/get-related`, `/cross-division-shares`
- Agent roster dropdown with search, status badges (online/idle/away)
- Dual-runtime toggle (Claude Code ↔ Hermes Agent) with shared `staff_id` indicator

### Council Overview
- 11-seat grid with permanent/replaceable indicators
- Persona avatars with dual-runtime status
- Seat vacancy status, founder approval indicators

### Meeting History & Visibility
- Meeting timeline with 9-phase progression visualization
- Phase status badges (preparation → closure)
- Past meetings expandable with primary ideas, evaluations, syntheses, closure notes
- Filter by seat, phase, constitution version

### Message History
- Persistent across sessions (localStorage per viewer)
- Searchable, filterable by sender, recipient, runtime, topic tags
- Export capability for audit trail

### Memory Presentation
- Memory browser with category filtering (14 Phase 4 categories)
- Version chain visualization (supersedes_id tree)
- FTS5 search bar with category/type/owner/division/task filters
- Privacy-aware: only shows memories user has access to per access matrix

### Error Handling
- Graceful degradation when memory operations fail
- User-friendly error messages (no stack traces)
- Retry controls, timeout indicators
- Fallback to cached state on network/DB errors

### Loading & Empty States
- Skeleton loaders for all panel content
- Empty states with action triggers (e.g., "No meetings yet — create first meeting")
- Spinner states with descriptive text

### Responsive Behavior
- Phone: single-column, sidebar collapses to hamburger, touch-friendly tap targets ≥44px
- Tablet: two-column layout, sidebar persistent, enlarged tap targets
- Desktop: full sidebar, multi-pane split view, keyboard shortcuts power user

### Access Control
- Session context injected at MCP layer (cannot be spoofed via request params)
- Role-based panel visibility (founder sees all; division heads see their division; staff see own categories only)
- Founder bypass flag for administrative functions (with audit logging)

### UI Testing
- Jest + React Testing Library for component logic
- Playwright end-to-end: login flow, meeting creation → evaluation → closure cycle, memory search with privacy filters, cross-division share request/approval (Founder), founder administrative functions
- Color contrast (WCAG AA), focus management, screen reader labels on all interactive elements

---
## Phase 6: Division Management, Staff Agents and Delegation (Planned)
### Prerequisites
- Phase 5 complete (Dashboard and Chat formally accepted)
- Phase 4 future tables exist (empty, ready)

### Execution (Do Not Execute Without Founder Approval)
1. **Founder Appointment Ceremony**
   - Review `council-bridge-roster.md` v2.2
   - Approve/modify Division Heads → assign `staff_id`
   - Approve specialist role definitions
   - Log appointments in `council_shared` memory

2. **Database Population**
   ```sql
   -- Divisions (6)
   INSERT INTO divisions (division_id, name, description, head_staff_id, budget_limit, permissions, strategic_objectives)
   -- Staff Agents (45)
   INSERT INTO staff_agents (staff_id, name, role, division_id, runtime_instances, permissions, status)
   -- Division Members (45 links)
   INSERT INTO division_members (division_id, staff_id, role)
   ```

3. **Division Head Onboarding**
   - Initialize `division_shared` memories (policies, standards, calendars)
   - Set up `division_private` for sensitive planning
   - Configure cross-division shares for known dependencies

4. **Specialist Onboarding**
   - Each Division Head nominates their 5–7 specialists
   - Founder approves specialist appointments
   - Founder separately authorizes specialist activation
   - Staff agents receive `staff_id`, `division_id`, `runtime_instances`
   - Initialize `staff_private` memory for each

### Deliverables (When Triggered by Founder)
- Populated `divisions`, `staff_agents`, `division_members` tables
- Division initialization memories in `division_shared`/`division_private`
- Updated `council-bridge-roster.md` with appointment dates

---
## Phase 7: Autonomy & Delegation Engine (Planned)
### Prerequisites
- Phase 6 complete (divisions staffed, tables populated)

### Core Capabilities
1. **Task Delegation** (`tasks` table)
2. **Deliverable Workflow** (`deliverables` table)
3. **HITL Gates** (Human-in-the-Loop, configurable per task type)
4. **Delegation Patterns** (sequential, parallel fan-out, hierarchical, evaluator-optimizer)

### Memory Integration
- Every task event → `task_history` memory entry
- Every deliverable → `task_history` + `business_context` (if org-wide)
- Delegation logs → `staff_private` (1:1) + `division_shared` (aggregate)
- HITL decisions → `decision_resolution` (if cross-division) or `division_private`

### Deliverables (When Triggered)
- Task delegation MCP tools (`create_task`, `update_task`, `delegate_task`)
- Deliverable workflow MCP tools (`submit_deliverable`, `review_deliverable`)
- HITL gate configuration per division
- Integration tests for full delegation cycle

---
## Phase 8: Security, Permissions & Hardening (Planned)
### Prerequisites
- Phase 7 complete (delegation engine operational)

### Security Domains
1. **Access Control Hardening** — Full audit of `memory_access` log, penetration test cross-division boundary bypass, identity spoofing tests, FTS5 direct access constraints documented + enforced
2. **Data Protection** — Encryption at rest for `division_private`, `staff_private`, `decision_resolution`; PII handling in `business_context`; key rotation policy
3. **Audit & Compliance** — Immutable audit trail for all Council decisions (`decision_resolution` + `memory_versions`); retention policies per config TTL; GDPR/CCPA readiness
4. **Operational Hardening** — WAL mode optimization, checkpoint tuning, backup/restore procedures for `council.db`; migration strategy for schema v5+; performance baselines at 100K+ memory entries
5. **Runtime Security** — Session validation for both Claude Code + Hermes Agent; rate limiting on MCP tools; input sanitization on all memory content (JSON injection prevention)

### Deliverables (When Triggered)
- Security audit report with findings + remediation
- Hardened deployment configuration
- Incident response playbook for memory subsystem
- Compliance checklist (SOC 2 aligned)

---
## Cross-Phase Dependencies
```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 (Dashboard and Chat)
                                                                      │
Phase 5 Stage 5/6 complete ──► Phase 6 (Division Management, Staff Agents and Delegation)
                                                                      │
                                                                      ▼
                                                               Phase 7 (Autonomy & Delegation)
                                                                      │
                                                                      ▼
                                                               Phase 8 (Security and Reliability)
```

**Critical Path**: Phase 5 (Dashboard and Chat) → Phase 6 (Division Management) → Phase 7 → Phase 8

**Parallelizable**:
- Stage 5 Dashboard/Chat UI implementation (independent of division staffing)
- Phase 6 division population (6 divisions independent after schema ready)
- Phase 7 delegation engine development

---
## Resource Allocation
| Phase | Estimated Effort | Primary Artifacts |
|-------|------------------|-------------------|
| 1–4 | **DONE** | 106 tests, 5 architecture docs, schema v4.0.0 |
| 5 | Dashboard and Chat UI | Interface components, chat flow, memory browser, access control |
| 6 | Division population + onboarding | 6 division init memories, 45 staff agents, division_members links |
| 7 | Delegation engine + tools | MCP tools, HITL config, task→deliverable cycle |
| 8 | Security audit + hardening | Report, config, playbooks, compliance checklist |

---
## Success Criteria by Phase
| Phase | Gate Criteria |
|-------|---------------|
| 5 | Dashboard and Chat UI 100% complete, all access control verified, Founder review package ready |
| 6 | 6 divisions + 45 staff in DB, all Division Heads onboarded, cross-division shares configured |
| 7 | End-to-end task→deliverable cycle works, HITL gates functional |
| 8 | Zero critical vulnerabilities, audit trail complete, backup tested |

---
## Immediate Next Actions (Current Session)
1. ✅ MASTER_ROADMAP.md updated (this document)
2. ✅ `council-bridge-roster.md` updated to v2.2 (45/45 specialists complete)
3. ✅ Phase 4 memory verification: 130 tests passing, 100% coverage
4. ✅ Phase 5 implementation complete; Founder formally accepted
5. **NEXT**: Founder Review → Approve roster → Phase 6 appointment ceremony (pending authorization)

---
**END OF MASTER ROADMAP**
*This document is the single source of truth. All phase/roadmap references should point here.*