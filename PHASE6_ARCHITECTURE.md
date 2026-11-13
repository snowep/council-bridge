# Phase 6: Division Management, Staff Agents and Delegation

## Architecture Overview

### Hierarchy
```
Founder
  └─ Council (11 voting seats: 4 permanent + 7 replaceable)
        └─ Division Heads (6)
              └─ Specialist Staff Agents (45, 5-8 per division)
                    └─ Delegated Tasks and Deliverables
```

### Core Entities

#### Divisions (6)
- **Developer**: Software development, codebase maintenance, technical infrastructure
- **Marketing**: Brand, campaigns, public facing, audience growth
- **Finance**: Budgeting, accounting, financial planning, reporting
- **Creative**: Design, content, media, artistic direction
- **Research & Intelligence**: Analysis, investigations, reporting, insights
- **Business Operations**: Ops, HR, facilities, administration

Each division has one Division Head. Division Heads do not receive Council voting rights.

#### Staff Agents (45)
- Logical identity shared across Claude Code and Hermes Agent runtimes
- Each agent has: `staff_id`, `name`, `role`, `division_id`, `runtime_instances`, `permissions`, `status`
- 5-7 specialists per division
- `status`: active | inactive | terminated
- Dual-runtime: same `staff_id` works on both Claude and Hermes

#### Division Members (links)
- `division_id` + `staff_id` + `role` (head | member | specialist)
- Enforces one Division Head per division
- Specialist reporting to Division Head

#### Tasks
- Creation, assignment, status lifecycle
- Delegation between divisions
- Dependencies, priorities, deadlines
- Progress reporting, review and approval

#### Deliverables
- Ownership, version history
- Review and approval status
- File references, task relationships
- Audit history

#### Cross-Division Shares
- Explicit memory/access grants between divisions
- Granted by: Founder only (Division Heads may request)
- Used for known dependencies between divisions

### Ownership Model (extends Phase 4)
- Polymorphic `owner_type` (seat | division | staff | founder) + `owner_id`
- `memory_versions` with `supersedes_id` chain, runtime attribution (claude|hermes)
- Access control matrix enforced at query layer
- `cross_division_shares` for explicit sharing grants

### Key Principles
1. Division Heads manage within approved boundaries only
2. No Council constitutional changes by Division Heads
3. Founder-reserved approvals for appointments, constitutional changes
4. Dual-runtime shared identity via `staff_id`
5. All organizational entities have clear ownership
6. Privacy boundaries preserved from Phase 4