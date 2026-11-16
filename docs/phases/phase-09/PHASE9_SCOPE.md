# PHASE 9: Organization & Execution Engine - Scope Definition

**Status**: Draft for Founder Review

## Executive Summary

Phase 9 delivers the **Organization & Execution Engine**, completing the core Council Bridge architecture by implementing the appointment ceremony, division population, staff activation, and the task delegation/execution workflow that was defined but not yet operational.

**The problem Phase 9 solves**: Phases 1-8 established the foundations (communication, governance, memory, security), but the system remains incomplete:
- Divisions exist as empty tables with FK relationships defined
- Staff agents have role definitions but no active instances
- Task delegation and execution workflows are blocked by missing prerequisites
- The founder still lacks a clear operational process for activating the organization

## Measurable Objectives

| Objective | Success Criteria |
|-----------|-------------------|
| Division Population | 6 divisions + 45 staff agents registered in database |
| Division Head Onboarding | Each Division Head has initialized `division_shared` and `division_private` memories |
| Cross-Division Shares | Known dependencies configured with founder approval |
| Specialist Activation | All 45 specialists activated with runtime instances |
| Task Delegation Engine | Full MCP tool set operational (`create_task`, `update_task`, `delegate_task`, `submit_deliverable`, `review_deliverable`) |
| HITL Gates | Configurable per division, functional for Level 3 autonomous tasks |
| End-to-End Test | Task creation → delegation → execution → deliverable review cycle passes |

## Essential Scope

### 9.1 Founder Appointment Ceremony System
- **Files**: `src/council/divisions.ts` (enhanced), `src/council/memory.ts` (audit logging)
- **MCP Tools**: `approve_division_head`, `approve_specialist`, `activate_staff_agent`
- **Memory**: Log all appointments in `council_shared` memory with audit trail

### 9.2 Division & Staff Activation
- **Database**: Populate `divisions`, `staff_agents`, `division_members` tables
- **Memory**: Initialize division-specific memories for each Division Head
- **Validation**: Ensure all 45 specialist identities are ready for dual-runtime

### 9.3 Task Delegation Engine
- **Database**: Fully activate `tasks` and `deliverables` tables
- **MCP Tools**: Full suite of task management tools
- **Rules Engine**: Status transitions, dependency validation, ownership checks

### 9.4 Execution Workflow
- **Autonomy**: Task autonomy levels fully integrated
- **Approvals**: Founder signature workflow operational
- **History**: Complete execution lifecycle tracking

## Optional Enhancements (Post-MVP)

1. **Task Templates**: Pre-defined task structures for common workflows
2. **Delegation Patterns**: Sequential, parallel fan-out, hierarchical templates
3. **Task Scheduling**: Time-based task triggers
4. **Execution Metrics**: Performance telemetry per task type
5. **Role Automation**: Automatic role assignment based on specialization

## Dependencies on Phases 1-8

| Dependency | Status | Required By |
|------------|--------|-------------|
| Phase 1-2: Council Seats | ✅ Complete | Appointment ceremony validation |
| Phase 3: Meeting System | ✅ Complete | Task evaluation cycle |
| Phase 4: Memory Subsystem | ✅ Complete | All division/staff memories |
| Phase 5: Dashboard & Chat | ✅ Accepted | UI integration for task management |
| Phase 6: Tables Ready | ✅ Defined | FK relationships exist |
| Phase 7: Autonomy Model | ✅ Complete | Execution workflow foundation |
| Phase 8: Security | ✅ Complete | Fail-closed operation |

## Database Changes

**No new migrations required** - Tables are pre-created and FK-ready. Phase 9 focuses on:
- Populating existing tables
- Adding optional tracking columns if needed for metrics

## MCP Changes

**New Tools**:
- `approve_division_head` - Founder approves Division Head appointment
- `approve_specialist` - Founder approves specialist activation
- `activate_staff_agent` - Activate a staff agent in a specific runtime

**Enhanced Tools**:
- `list_tasks` - Add filter by delegation status
- `submit_deliverable` - Add version tracking
- `review_deliverable` - Add quality metrics support

## Security & Permissions

- Founder-only operations remain founder-signed
- Division Head authority over their division's staff
- Staff agent authority over their own tasks
- Cross-division access requires explicit approval
- All operations logged to memory audit trail

## Rollback Plan

1. **Appointment Rollaback**: Archive activation memories, mark staff inactive
2. **Division Rollaback**: Drop populated tables, restore empty state
3. **Task Engine Rollaback**: Delete execution requests, reset status
4. **Data Preservation**: Archive memories before structural changes

## Implementation Batches

See PHASE9_IMPLEMENTATION_ROADMAP.md for detailed batch breakdown.

## Outstanding Founder Decisions

| Decision | Status | Impact |
|----------|--------|--------|
| Division Head selections | ✅ Reviewed (v2.2) | Required for appointment |
| Specialist role approvals | ✅ Reviewed (45 complete) | Required for activation |
| HITL gate thresholds | Pending | Affects task autonomy |
| Cross-division governance | Pending | Affects sharing policy |
| Task template library | Optional | Affects flexibility |

---

**Next**: Founder review → approve scope → Phase 9 implementation (if authorized)