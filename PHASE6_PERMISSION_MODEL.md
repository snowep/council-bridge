# Phase 6: Permission Model

## Division Head Authority

### Approved Powers
Division Heads may:

1. **Manage their division**
   - View division specialists and their status
   - Assign and reassign specialists within their division
   - Create and manage internal tasks within approved limits
   - Review specialist work and progress
   - Coordinate deliverables for their division
   - Manage routine division workflows (onboarding, status updates, reporting)

2. **Report to Council**
   - Report progress and issues to the Council
   - Request resources from the Founder
   - Request cross-division assistance for known dependencies

3. **Memory access**
   - Read/write `division_shared` memories for their division
   - Read `division_private` memories (sensitive planning)
   - Configure `cross_division_shares` for known dependencies

### Prohibited Actions
Division Heads **cannot**:

1. **Change Council constitutional rules**
   - No modification to seat constitutions
   - No founder approval bypass

2. **Modify Council decisions**
   - No override of existing Council votes or evaluations

3. **Grant themselves additional permissions**
   - All permissions must be assigned by Founder

4. **Bypass Founder-reserved approvals**
   - Division Head appointments require Founder approval
   - Constitutional changes require Founder approval
   - Staff agent activation requires Founder authorization

5. **Appoint themselves**
   - Division Head must be approved and appointed by Founder

6. **Override another division's ownership or permissions**
   - Cross-division access requires explicit `cross_division_shares` grants
   - No unilateral access expansion

### Technical Enforcement

#### 1. Database-Level Constraints
- `staff_agents.division_id` FK enforces division membership
- `division_members` PK (division_id, staff_id) enforces one head/member/specialist per staff per division
- `divisions.head_staff_id` — validated at app layer (no circular FK to staff_agents)
- `cross_division_shares` grants are explicit and auditable

#### 2. Service-Layer Enforcement
- `createDivisionHead(staff_id)` — Founder-only MCP tool
- `assignSpecialist(staff_id, division_id)` — Division Head–only, Founder-validated
- `updateTaskStatus(task_id, status)` — Division Head–only for their division's tasks
- `createCrossDivisionShare(memory_id, division_id, granted_by)` — Founder or division-granted
- All tools validate: "Is this user a Division Head of the target division?"

#### 3. Runtime Identity
- Dual-runtime: same `staff_id` works on both Claude Code and Hermes Agent
- `runtime_instances` JSON tracks which runtime(s) the agent is active on
- Shared logical identity — one `staff_id` = one employee, not two
- Availability/health tracked per runtime instance

#### 4. Founder Bypass with Audit
- Founder can perform any operation via MCP tools
- All Founder actions logged in `memory_versions` with `supersedes_id` chain
- Audit trail: `memory_access` log tracks who accessed what and when
- Founder bypass flag exists but is audited, not silent

## Permission Levels

| Role | Can View | Can Create | Can Modify | Can Approve | Can Delete |
|------|----------|------------|------------|-------------|------------|
| Founder | All | All | All | All | All |
| Division Head | Their division + own division memories | Tasks, deliverables (own division) | Tasks, deliverables (own division) | Own division tasks, deliverables | Own division tasks (soft) |
| Specialist | Own staff_private + assigned division_shared | — | — | — | — |
| Seat (Council) | Relevant council records | Council proposals, evaluations | Council decisions (with quorum) | Council votes | — |

## Cross-Division Access

### Default: Isolation
- Each division can only access its own `division_shared` and `division_private` memories
- Staff can only access `staff_private` and their assigned `division_shared`
- No unrestricted FTS5 bypass

### Explicit Grants: `cross_division_shares`
- Founder can grant: `division_id` → another `division_id`'s memories
- Division Head can request; Founder approves
- Granted stored in `cross_division_shares` table
- Query layer adds `WHERE memory_id IN (SELECT memory_id FROM cross_division_shares WHERE division_id = ?)`
- All grants auditable: `granted_by_type`, `granted_by_id`, `granted_at`

### Revocation
- `revoke_cross_division_access` MCP tool
- Removes row from `cross_division_shares`
- Immediate effect on query-layer access
- Audit logged