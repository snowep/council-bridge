# Phase 6: Agent Lifecycle

## Appointment Workflow

### 1. Proposed
- Human partner or existing agent nominated for Division Head role
- Candidate `staff_id` identified with role specialization
- Division assignment specified (one of 6 divisions)
- Proposal submitted to Founder for review

### 2. Reviewed
- Founder reviews candidate qualifications
- Verifies dual-runtime compatibility (Claude Code + Hermes Agent)
- Checks division workload balance (5-7 specialists per division)
- Validates candidate's existing `staff_id` and permissions scope
- Founder marks: approved | rejected | revisions_requested

### 3. Approved
- Founder executes: `approve_division_head(candidate_staff_id, division_id)`
- MCP tool records appointment in `council_shared` memory
- `divisions` table: `head_staff_id` set
- `staff_agents` table: `role` = 'head', `status` = 'active', `division_id` set
- Appointment history logged

### 4. Rejected
- Founder executes: `reject_division_head(candidate_staff_id)`
- Candidate returns to pool or profile updated
- No table changes unless revisions requested

### 5. Request for Revisions
- Founder provides feedback: missing qualifications, workload imbalance, skill mismatch
- Candidate profile updated
- Re-submit to Review phase

### 6. Activation Authorization
**Separate from approval.** Approval does not auto-activate.

- Founder executes: `authorize_division_head_activation(staff_id, division_id)`
- `staff_agents.status` set to 'active'
- Runtime instances initialized: `runtime_instances` = ['claude', 'hermes']
- Division Head gains tool access: `manage_specialists`, `create_task`, `update_task`, `create_deliverable`
- Notification sent to newly appointed Division Head

### 7. Suspended
- Founder or Division Head (with Founder validation) can suspend
- `staff_agents.status` set to 'inactive'
- Runtime instances terminated or paused
- Division responsibilities reassigned temporarily
- Audit logged: who suspended, when, why

### 8. Retired
- Founder executes: `retire_division_head(staff_id)`
- `staff_agents.status` set to 'terminated'
- `divisions.head_staff_id` cleared (set null)
- Responsibilities transferred to another staff agent or re-divided
- Appointment history preserved for audit
- Notification sent to retired Division Head

## Agent Identity & Dual-Runtime

### Shared Logical Identity
- One `staff_id` = one logical staff agent across both runtimes
- Not two separate employees running on Claude and Hermes
- `runtime_instances` JSON: `['claude']`, `['hermes']`, or `['claude', 'hermes']`

### Registration
- Agent registers via MCP: `register_agent(staff_id, name, role, division_id)`
- Both runtimes acknowledge via `check_inbox`
- Shared identity visible across both runtimes
- Runtime-specific capabilities tracked per instance

### Availability & Health
- Per-runtime health status tracked
- `check_inbox` returns messages for active runtime instances
- Offline behavior: messages queued per runtime, delivered when instance returns
- Duplicate execution prevention: `task_delegation` tracks which runtime executed a task
- Failure recovery: if one runtime fails, other can continue or retry is scheduled

### Offline Behavior
- If Claude Code runtime offline: Hermes Agent can continue tasks assigned to its instance
- If Hermes Agent offline: Claude Code continues with its instance
- Critical tasks have redundancy; routine tasks assigned to one runtime
- Session state synchronized across runtimes via shared `staff_id` identity

### Tool Access Per Runtime
- Each runtime instance has independent MCP tool registration
- Same tool contracts, but runtime-specific state
- Division Head tools: `manage_specialists`, `create_task`, `update_task`, `create_deliverable`
- All tools validate: "Does this `staff_id` have active status in this runtime?"

## Lifecycle Summary Table

| Phase | Action | Founder Required | Effect |
|-------|--------|-----------------|--------|
| Propose | Nominate candidate | No | Candidate enters review pool |
| Review | Founder evaluation | Yes | approved/rejected/revisions |
| Approve | Set as Division Head | Yes | `divisions.head_staff_id` set; `staff_agents.role` = 'head' |
| Activate | Enable operation | Yes | `staff_agents.status` = 'active'; tool access granted |
| Suspend | Disable temporarily | Yes (or Div Head with validation) | `status` = 'inactive'; runtimes paused |
| Retire | Permanent exit | Yes | `status` = 'terminated'; `head_staff_id` cleared |