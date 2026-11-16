# Phase 6 Founder Decision Register

**Repository**: `snowep/council-bridge`  
**Base Commit**: `d1c1712f8a3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d`  
**Date**: 2026-11-13  
**Status**: **ALL DECISIONS PENDING — NO AUTHORIZATION GRANTED**

---

## Decision Summary

| Decision | Description | Status |
|----------|-------------|--------|
| **D1** | Production Database Migration Execution | **PENDING** |
| **D2** | Phase 6 Implementation Authorization | **PENDING** |
| **D3** | Division Head Appointments (6) | **PENDING** |
| **D4** | Specialist Appointments (45) | **PENDING** |
| **D5** | Agent Activation | **PENDING** |

**No decision is pre-selected. Silence, task completion, or readiness recommendations do not constitute authorization.**

---

## D1: Production Database Migration Execution

### What Is Being Authorized
Execution of 5 approved SQL migrations against production `data/council.db`:
1. `001_staff_agents_default_inactive.sql` — Table rebuild, status DEFAULT 'active' → 'inactive'
2. `002_cross_division_shares_founder_only.sql` — Table rebuild, restrict granted_by_type to 'founder', revoke legacy division grants
3. `003_tasks_add_columns.sql` — ADD dependencies, deliverable_id (app-layer reference)
4. `004_deliverables_add_columns.sql` — ADD file_references, task_relationships, audit_log
5. `005_cross_division_shares_stage7.sql` — ADD request tracking columns (type, status, justification, priority, deadline, approval fields)

### Why Authorization Is Required
- Modifies production database schema and data
- Irreversible without backup restoration
- Affects all subsequent Phase 6 functionality

### Risks
| Risk | Mitigation |
|------|------------|
| Data loss during table rebuilds | Pre-migration backup (binary + schema + CSV), tested rollback procedure |
| FK integrity violation | PRAGMA foreign_keys OFF during rebuild, verification queries post-migration |
| Migration failure mid-sequence | Sequential execution with per-migration verification, full rollback capability |
| Unverified schema changes | 16 verification tests passing against actual SQL files |

### Dependencies
- Decision D1 must be approved before D2 (implementation requires migrated schema)
- Pre-migration backup completed and verified
- Migration runner specification available (`PHASE6_MIGRATION_RUNNER_SPEC.md`)
- Production runbook available (`PHASE6_PRODUCTION_MIGRATION_RUNBOOK.md`)

### Consequences of Approval
- Database schema upgraded to Phase 6 target
- `staff_agents.status` default becomes `'inactive'`
- `cross_division_shares` restricted to Founder-only grants
- New columns available for tasks, deliverables, cross-division tracking
- Migration audit records created for legacy grant revocation

### Consequences of Rejection/Deferral
- Phase 6 implementation cannot proceed (schema mismatch)
- Agent activation blocked (status default remains 'active')
- Cross-division permissions remain unrestricted

### Exact Scope of Approval
**Only**: Execute the 5 SQL files in order (001→002→003→004→005) against `data/council.db` with pre/post verification per `PHASE6_PRODUCTION_MIGRATION_RUNBOOK.md`

**Not Included**: Phase 6 implementation, agent appointments, agent activation

---

## D2: Phase 6 Implementation Authorization

### What Is Being Authorized
Implementation of all Phase 6 service layer functionality:
- Division Management (create, update, list divisions; assign Division Heads/specialists)
- Staff Agent Management (register, update status/permissions, suspend, retire)
- Task Delegation (create, assign, update, complete, dependencies)
- Deliverable Management (create, update, review, audit log)
- Cross-Division Collaboration (request, approve, revoke, list)
- Dashboard Integration (division overview, staff roster, task board, deliverable tracking)

### Why Authorization Is Required
- Introduces new organizational authority structures
- Enables agent operations that affect system state
- Requires enforcement of new permission model

### Risks
| Risk | Mitigation |
|------|------------|
| Permission enforcement bugs | Comprehensive test matrix (`PHASE6_ACCEPTANCE_TEST_MATRIX.md`), security tests |
| Unauthorized cross-division access | Founder-only grant/revoke, app-layer validation, query-layer enforcement |
| Agent identity confusion | Single `staff_id` across runtimes, `runtime_instances` tracking |
| Task/deliverable data integrity | Foreign keys, CHECK constraints, audit logs |

### Dependencies
- **Requires D1 approved** (migrated schema required)
- All 5 SQL migrations executed and verified
- Implementation blueprint available (`PHASE6_IMPLEMENTATION_BLUEPRINT.md`)
- Permission specification available (`PHASE6_PERMISSION_IMPLEMENTATION_SPEC.md`)

### Consequences of Approval
- All Phase 6 MCP tools implemented and available
- Division Heads can manage divisions and delegate tasks
- Specialists can receive tasks and submit deliverables
- Cross-division requests flow through Founder approval
- Dashboard shows division/agent/task/deliverable status

### Consequences of Rejection/Deferral
- Phase 6 functionality unavailable
- Division Heads and specialists cannot operate
- Tasks and deliverables cannot be managed

### Exact Scope of Approval
**Only**: Implement service layer code and MCP tools per `PHASE6_IMPLEMENTATION_BLUEPRINT.md` and related specs

**Not Included**: Database migration execution (D1), agent appointments (D3/D4), agent activation (D5)

---

## D3: Division Head Appointments (6)

### What Is Being Authorized
Formal appointment of 6 Division Heads to their proposed positions:
1. Developer — Software Architect
2. Marketing — PR & Communications
3. Finance — FP&A Analyst
4. Creative — Brand Guardian
5. Research — Research Synthesist
6. Operations — Chief of Staff

### Why Authorization Is Required
- Establishes organizational leadership
- Grants Division Head authority (task delegation, specialist management, cross-division requests)
- Records approval in `council_shared` memory

### Risks
| Risk | Mitigation |
|------|------------|
| Incorrect appointment | Verify against `proposed/agents/*/division-head-*.md` and roster |
| Authority misalignment | All Division Heads have identical permission scope (no Council voting) |
| Missing accountability | Approval recorded with `approved_by: 'founder'`, `approved_at` timestamp |

### Dependencies
- **Requires D1 approved** (migrated schema for `staff_agents.status` default 'inactive')
- **Requires D2 approved** (implementation for appointment/activation tools)
- All 6 Division Head definitions complete and consistent

### Consequences of Approval
- 6 Division Heads formally appointed (recorded in `council_shared` with `activation_authorized: false`)
- Division Heads can request cross-division access
- Division Heads can manage specialists in their division
- Division Heads remain `status = 'inactive'` until D5

### Consequences of Rejection/Deferral
- No Division Heads appointed
- Division management unavailable
- Specialists cannot be assigned to divisions

### Exact Scope of Approval
**Only**: Record appointment approval for 6 Division Heads in `council_shared` memory with `memory_type: 'division_head_approval'`

**Not Included**: Agent activation (D5), specialist appointments (D4), implementation (D2)

---

## D4: Specialist Appointments (45)

### What Is Being Authorized
Formal appointment of 45 specialists across 6 divisions:
- Developer: 9
- Marketing: 7
- Finance: 7
- Creative: 10
- Research: 5
- Operations: 7

### Why Authorization Is Required
- Enables task delegation to specialists
- Grants specialist permissions (execute tasks, submit deliverables)
- Records approval in `council_shared` memory

### Risks
| Risk | Mitigation |
|------|------------|
| Incorrect appointment | Verify against `proposed/agents/*/specialist-*.md` and roster |
| Over-appointment | Fixed count per division (9,7,7,10,5,7) |
| Missing accountability | Approval recorded with `approved_by: 'founder'`, `approved_at` timestamp |

### Dependencies
- **Requires D1 approved** (migrated schema)
- **Requires D2 approved** (implementation for appointment tools)
- **Requires D3 approved** (Division Heads must exist to manage specialists)
- All 45 specialist definitions complete and consistent

### Consequences of Approval
- 45 specialists formally appointed (recorded in `council_shared` with `activation_authorized: false`)
- Specialists can be assigned tasks
- Specialists can submit deliverables
- Specialists remain `status = 'inactive'` until D5

### Consequences of Rejection/Deferral
- No specialists appointed
- Task delegation unavailable
- Division Heads have no one to delegate to

### Exact Scope of Approval
**Only**: Record appointment approval for 45 specialists in `council_shared` memory with `memory_type: 'specialist_approval'`

**Not Included**: Agent activation (D5), Division Head appointments (D3), implementation (D2)

---

## D5: Agent Activation

### What Is Being Authorized
Activation of appointed agents (Division Heads and specialists):
- Set `staff_agents.status = 'active'`
- Initialize `runtime_instances` for Claude Code and/or Hermes
- Grant operational permissions per role

### Why Authorization Is Required
- Transitions agents from appointed (inactive) to operational
- Enables actual work execution
- Final step before agents can perform tasks

### Risks
| Risk | Mitigation |
|------|------------|
| Premature activation | Separate approval (D3/D4) from activation (D5) |
| Runtime misconfiguration | Verify `runtime_instances` via `check_inbox` |
| Permission gaps | Run acceptance tests per `PHASE6_ACCEPTANCE_TEST_MATRIX.md` |

### Dependencies
- **Requires D1, D2, D3, D4 all approved**
- Appointment approvals recorded
- Implementation complete and tested
- Health checks pass (`check_inbox`, message send/receive, permission verification)

### Consequences of Approval
- Agents become operational
- Division Heads can delegate tasks
- Specialists can execute tasks and submit deliverables
- Cross-division requests can be processed
- Full Phase 6 organization active

### Consequences of Rejection/Deferral
- Agents remain `inactive`
- No work can be performed
- Organization exists on paper only

### Exact Scope of Approval
**Only**: Execute activation for appointed agents (set `status = 'active'`, initialize `runtime_instances`)

**Not Included**: Database migration (D1), implementation (D2), appointments (D3/D4)

---

## Additional Decisions Discovered During Preparation

| Decision | Description | Status |
|----------|-------------|--------|
| **D6** | Cross-Division Share Grant Authority | PENDING — Included in D2/D5 scope |
| **D7** | Migration Audit Retention Policy | PENDING — Requires Founder decision before D1 |
| **D8** | Production Downtime Window | PENDING — Requires Founder coordination for D1 |

---

## Decision Dependency Graph

```
D1 (Migration) → D2 (Implementation) → D3 (Div Head Appointments) → D5 (Activation)
                                          ↘
                                           D4 (Specialist Appointments) → D5
```

**No decision may be assumed from another's approval. Each requires explicit Founder authorization.**

---

*Document generated: 2026-11-13*  
*Base commit: d1c1712*