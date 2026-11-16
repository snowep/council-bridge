# Phase 9 Batch 2: Population Architecture

## Overview

This document describes the architecture and implementation of the Phase 9 Batch 2 population script that populates the Council Bridge database with 6 organizational divisions, 6 Division Heads, and 45 specialist staff agents.

## Population Strategy

### Existing Infrastructure Leveraged

The population script uses **existing council functions** from Phase 9 Batch 1 and Phase 6-8:

| Function | Source | Purpose |
|----------|--------|---------|
| `createDivision` | Phase 6 | Create division records |
| `registerStaffAgent` | Phase 6 | Register staff agents (inactive by default) |
| `approveDivisionHead` | Phase 9 Batch 1 | Founder-approved Division Head appointment |
| `approveSpecialist` | Phase 9 Batch 1 | Founder-approved specialist appointment + division membership |
| `activateStaffAgent` | Phase 9 Batch 1 | Activate with claude + hermes runtimes |
| `updateStaffAgent` | Phase 6/9 | Set status to active |
| `addDivisionMember` | Phase 6 | Division membership records |

### Founder Context

All appointment and activation operations use the Founder context:
```typescript
const ctx = { owner_type: 'founder', owner_id: 'founder' };
```

This enforces the Phase 8 authorization model where only the Founder can approve Division Heads and specialists.

### Idempotency Design

The script is designed to be **idempotent** - safe to run multiple times:
- Checks for existing records before creating
- Skips with clear logging when records exist
- Uses UNIQUE constraint handling for race conditions
- No duplicate records created on re-run

## Data Model

### Divisions (6)

| Division ID | Name | Description |
|-------------|------|-------------|
| `developer` | Developer Division | Engineering, platform, infrastructure, and developer experience |
| `marketing` | Marketing Division | Growth, brand, content, product marketing, events, and analytics |
| `finance` | Finance Division | FP&A, investor relations, treasury, corporate finance, tax, and accounting |
| `creative` | Creative Division | Brand storytelling, copy, design systems, motion, UX research, and worldbuilding |
| `research-intelligence` | Research & Intelligence Division | Competitive intelligence, market research, data analysis, OSINT, and synthesis |
| `business-operations` | Business Operations Division | Facilities, legal, procurement, process, programs, creative ops, and people operations |

### Division Heads (6)

| Staff ID | Name | Division |
|----------|------|----------|
| `staff-dev-head-001` | Division Head, Developer Division | developer |
| `staff-marketing-head-001` | Division Head, Marketing Division | marketing |
| `staff-finance-head-001` | Division Head, Finance Division | finance |
| `staff-creative-head-001` | Division Head, Creative Division | creative |
| `staff-research-head-001` | Division Head, Research & Intelligence Division | research-intelligence |
| `staff-ops-head-001` | Division Head, Business Operations Division | business-operations |

### Specialists (45)

**Developer Division (9):**
- Platform Engineering Lead
- DevOps/Infrastructure Lead
- Senior Staff Engineer
- Multi-Agent Systems Lead
- Developer Experience Lead
- Engineering Manager
- Security Architect
- Data/ML Engineering Lead
- Technical Writer

**Marketing Division (7):**
- Growth/Acquisition Lead
- Social/Community Lead
- Content/Brand Storyteller
- Brand Strategist (Deputy)
- Product Marketing Lead
- Events/Field Marketing Lead
- Marketing Analytics/Attribution

**Finance Division (7):**
- Investor Relations
- Senior FP&A Manager
- Treasury/Cash Management
- Corporate Finance/Valuation
- Tax Director
- Investment Analyst
- Controller/Accounting Lead

**Creative Division (10):**
- Brand Storyteller/Lore Writer
- Copywriter/Verbal Identity
- Creative Operations
- Fashion Copywriter
- Lore Editor/Narrative Editor
- Motion/Video Lead
- Worldbuilding Researcher
- Design Systems Lead
- UX Research Lead
- Creative Content Lead

**Research & Intelligence Division (5):**
- Competitive Intelligence Lead
- Market Research Lead
- Data/Quantitative Analyst
- OSINT/Open Source Intelligence
- Synthesis/Methodology Deputy

**Business Operations Division (7):**
- Facilities/Workspace Lead
- Legal/Compliance Lead
- Procurement/Vendor Lead
- Operations/Process Lead
- Senior Program Manager
- Creative Operations Lead
- People Operations Lead

## Population Workflow

### Step 1: Create Divisions
Creates 6 division records with division_id, name, and description.

### Step 2: Register Division Heads
Registers 6 Division Head staff agents with status `inactive`.

### Step 3: Approve Division Heads
Calls `approveDivisionHead` for each head - Founder approval creates audit memory entry.

### Step 4: Activate Division Heads
Calls `updateStaffAgent` to set status to `active` (approval doesn't auto-activate).

### Step 5: Register Specialists
Registers 45 specialist staff agents with status `inactive`.

### Step 6: Approve Specialists
Calls `approveSpecialist` for each - Founder approval creates division membership + audit entry.

### Step 7: Activate Division Heads with Runtimes
Calls `activateStaffAgent` with `runtimes: ['claude', 'hermes']` - creates 12 runtime_persona records.

### Step 8: Activate Specialists with Runtimes
Calls `activateStaffAgent` with `runtimes: ['claude', 'hermes']` - creates 90 runtime_persona records.

## Runtime Identity Architecture

### Dual-Runtime Model
Each staff agent has **one logical identity** but can run in **two runtime environments**:

```
staff_id: staff-dev-platform-001
  ├── runtime: claude  → persona_id: staff-dev-platform-001
  └── runtime: hermes  → persona_id: staff-dev-platform-001
```

### Key Principles
1. **Single logical identity** - `staff_id` is the canonical identifier
2. **Shared persona_id** - Both runtimes use the same `persona_id` (the staff_id)
3. **Separate runtime_persona records** - Two rows in `runtime_personas` table per staff
4. **No duplicate staff records** - Runtime activation never creates new staff_agents

### Database Schema
```sql
CREATE TABLE runtime_personas (
  runtime TEXT NOT NULL,           -- 'claude' or 'hermes'
  persona_id TEXT NOT NULL,        -- maps to staff_agents.staff_id
  PRIMARY KEY (runtime, persona_id)
);
```

## Audit Trail

### Memory Categories
All appointments and activations create `memory_entries` with `category = 'council_shared'`:

| Type | Trigger |
|------|---------|
| `appointment_record` | `approveDivisionHead`, `approveSpecialist` |
| `activation_record` | `activateStaffAgent` |

### Record Content
- Staff identity and division
- Operation performed
- Founder approval timestamp
- Runtime assignment (for activations)

## Error Handling

| Scenario | Handling |
|----------|----------|
| Division exists | Skip with log |
| Staff agent exists | Skip with log |
| Already approved | Skip with log |
| Already active | Skip with log |
| FK constraint (runtime_personas) | Temporary `PRAGMA foreign_keys = OFF` during insert |
| UNIQUE constraint violation | Catch and skip |

## Integration Points

### Phase 8 Security
- Founder authorization via `ctx.owner_type === 'founder'`
- Session token validation not required for script execution
- Founder signature verification available for future interactive use

### Phase 7 Execution
- Division membership enables task assignment
- Staff status `active` required for execution requests

### Phase 6 Foundation
- Divisions, staff_agents, division_members tables
- Migration history preserved

## Verification

### Expected Final State
| Metric | Count |
|--------|-------|
| Divisions | 6 |
| Division Heads | 6 |
| Specialists | 45 |
| Total Staff Agents | 51 |
| Active Agents | 51 |
| Runtime Personas | 102 |
| Division Members | 51 |
| Audit Memories | 198 (51 appointments + 51 activations × 2 runtimes) |

### Division Breakdown
| Division | Head | Specialists | Total |
|----------|------|-------------|-------|
| Developer | 1 | 9 | 10 |
| Marketing | 1 | 7 | 8 |
| Finance | 1 | 7 | 8 |
| Creative | 1 | 10 | 11 |
| Research & Intelligence | 1 | 5 | 6 |
| Business Operations | 1 | 7 | 8 |

## Running the Population

```bash
npx tsx scripts/populate-phase9.ts
```

The script outputs progress logs and a final summary matching the verification counts above.