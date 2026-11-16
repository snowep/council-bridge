# Phase 9 Batch 1: Appointment Ceremony Architecture

## Overview

This document describes the architecture for the Founder Appointment Ceremony System (Phase 9 Batch 1), which implements the formal lifecycle for Division Head appointments and staff activation.

## Appointment Lifecycle

```
PROPOSED → NOMINATION → FOUNDER REVIEW → FOUNDER APPROVAL → APPOINTED → ACTIVATED
```

Only the **Founder** can authorize transitions to `FOUNDER APPROVAL` and `ACTIVATED` states. No Division Head or specialist may activate themselves.

## Six Division Head Positions

| Division | Head Position |
|----------|---------------|
| Developer | Division Head, Developer Division |
| Marketing | Division Head, Marketing Division |
| Finance | Division Head, Finance Division |
| Creative | Division Head, Creative Division |
| Research & Intelligence | Division Head, Research & Intelligence Division |
| Business Operations | Division Head, Business Operations Division |

## Core Functions

### 1. `approveDivisionHead(db, ctx, input)`
**Purpose**: Founder approves a staff agent as Division Head for a specific division.

**Input** (`ApproveDivisionHeadInput`):
- `division_id`: string (required)
- `staff_id`: string (required)

**Validation**:
- Context must be `owner_type: 'founder'`
- Division must exist
- Staff agent must exist
- Staff must be member of the division (`staff.division_id === division_id`)
- Staff must not already be Division Head of this division

**Side Effects**:
- Updates `divisions.head_staff_id` to `staff_id`
- Creates audit memory entry (`council_shared` / `appointment_record`)

### 2. `approveSpecialist(db, ctx, input)`
**Purpose**: Founder approves a specialist staff agent, activating them in their division.

**Input** (`ApproveSpecialistInput`):
- `staff_id`: string (required)
- `division_id`: string (required)

**Validation**:
- Context must be `owner_type: 'founder'`
- Staff agent must exist
- Division must exist
- Staff must be registered to the division (`staff.division_id === division_id`)
- Staff must not already be `active`

**Side Effects**:
- Updates `staff_agents.status` to `'active'`
- Creates `division_members` record with `role: 'specialist'` (if not exists)
- Creates audit memory entry (`council_shared` / `appointment_record`)

### 3. `activateStaffAgent(db, ctx, input)`
**Purpose**: Founder assigns runtime personas (Claude/Hermes) to an approved staff agent.

**Input** (`ActivateStaffAgentInput`):
- `staff_id`: string (required)
- `runtimes`: `('claude' | 'hermes')[]` (required, min 1)

**Validation**:
- Context must be `owner_type: 'founder'`
- Staff agent must exist
- Staff must have `status: 'active'` (approved first)

**Side Effects**:
- Inserts into `runtime_personas` table (FK temporarily disabled for staff_id as persona_id)
- Updates `staff_agents.runtime_instances` JSON array
- Creates audit memory entry (`council_shared` / `activation_record`)

## Database Schema (Existing - Phase 4)

No new migrations required. Uses existing tables:

```sql
-- Divisions (head_staff_id added in Phase 4)
divisions (
  division_id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  head_staff_id TEXT,  -- FK to staff_agents (app-layer validated)
  ...
)

-- Staff Agents
staff_agents (
  staff_id TEXT PRIMARY KEY,
  division_id TEXT NOT NULL REFERENCES divisions(division_id),
  runtime_instances TEXT NOT NULL DEFAULT '[]',  -- JSON: ['claude', 'hermes']
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','terminated')),
  ...
)

-- Division Members
division_members (
  division_id TEXT NOT NULL REFERENCES divisions(division_id),
  staff_id TEXT NOT NULL REFERENCES staff_agents(staff_id),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('head','member','specialist')),
  PRIMARY KEY (division_id, staff_id)
)

-- Runtime Personas (for persona-runtime linkage)
runtime_personas (
  runtime TEXT NOT NULL,
  persona_id TEXT NOT NULL REFERENCES personas(persona_id),
  PRIMARY KEY (runtime, persona_id)
)

-- Memory Entries (audit trail)
memory_entries (
  memory_id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('seat','division','staff','founder')),
  owner_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (...)),
  memory_type TEXT NOT NULL,  -- 'appointment_record' | 'activation_record'
  title TEXT NOT NULL,
  content TEXT NOT NULL,  -- JSON
  ...
)
```

## Security Model

- **Founder-only authorization**: All three functions check `ctx.owner_type === 'founder'`
- **No hardcoded identities**: Uses context-based authorization
- **FK validation**: Division/staff membership verified at application layer
- **Duplicate prevention**: Checks for existing appointments before creating
- **Audit trail**: Every appointment/activation logged to `memory_entries`

## Integration Points

- **Phase 8 Authentication**: Uses `ctx.owner_type` from founder signature verification
- **Memory System**: Audit entries use `createMemory()` with `council_shared` category
- **Staff Registration**: Reuses `registerStaffAgent()` from Phase 6
- **Division Management**: Reuses `createDivision()`, `getDivisionById()` from Phase 6

## MCP Tool Exposure

Each function exposed as MCP tool with Zod v4 validation:
- `approve_division_head`
- `approve_specialist`
- `activate_staff_agent`

## Dashboard Integration (Future)

Dashboard endpoints will display:
- Pending Division Head nominations
- Approved specialists awaiting activation
- Active staff with runtime assignments
- Appointment/activation audit trail