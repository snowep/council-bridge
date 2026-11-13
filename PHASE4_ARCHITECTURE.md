# Phase 4 Architecture — Memory and Knowledge Subsystem

## Overview

This document describes the architecture for the Memory and Knowledge subsystem that enables the 11-seat Council to retain, retrieve, reference, and build upon knowledge across formal meetings without losing individual identities or creating contradictory records.

## Design Principles

1. **Identity Preservation** — Each of 11 Council seats maintains individual memory; Claude/Hermes instances share logical memory via seat_id
2. **Provenance First** — Every memory preserves origin, author, timestamp, version, confidence
3. **Immutability by Default** — Historical decisions never silently overwritten; versioned updates with audit trail
4. **Shared Ownership** — Council-wide knowledge accessible to all occupied seats; no duplicate voting identities
5. **SQLite-Native** — All structures compatible with existing better-sqlite3/WAL architecture

## Memory Categories (14 Total)

| Category | Scope | Ownership | Retention |
|----------|-------|-----------|-----------|
| **Individual Persona Memory** | Per seat | Seat owner | Permanent |
| **Council Shared Memory** | All occupied seats | Collective | Permanent |
| **Meeting History** | Per meeting | All participants | Permanent |
| **Decisions & Resolutions** | Council-wide | Collective | Permanent |
| **Ideas & Proposals** | Per meeting + Council | Author + Collective | Permanent |
| **Research & Evidence** | Per meeting + Council | Author + Collective | Configurable |
| **Lessons Learned** | Council-wide | Collective | Permanent |
| **Unresolved Questions** | Council-wide | Collective | Until resolved |
| **Division Shared Memory** | Division members | Collective (division) | Permanent |
| **Division Private Memory** | Division head | Division head | Permanent |
| **Staff Private Memory** | Staff agent | Staff agent | Permanent |
| **Business Context** | Org-wide | Founder/Council/Div heads | Permanent |
| **Task History** | Per task | Assignee + Creator | Permanent |
| **Cross-Division Memory** | Named divisions | Members of named divisions | Permanent |

## Ownership Model

```
Seat (11 total)
├── 4 Permanent Founder Seats
└── 7 Replaceable Seats
    └── Each has Persona (shared across Claude + Hermes runtimes)
        ├── Individual Memory (private to seat)
        ├── Council Shared Memory (read/write all occupied)
        └── Meeting Contributions (attributed to seat)

Division (6 proposed)
└── Division Head (staff agent)
    └── Staff Agents (multiple)
        ├── Division Shared Memory (read/write all division members)
        ├── Division Private Memory (head only)
        └── Staff Private Memory (per agent)

Founder
└── Business Context (org-wide reference)
    └── Task History (delegation tracking)
```

## Core Tables (New)

### `memory_entries` — Universal memory store
- Single table with polymorphic `owner_type` + `owner_id` (seat | division | staff | founder)
- Supports all 14 categories via `category` field (8 Council + 6 Division/Staff/Org)
- JSON payload for flexible structured content
- **Columns:** `memory_id`, `owner_type`, `owner_id`, `category`, `memory_type`, `title`, `content`, `tags`, `confidence`, `version`, `supersedes_id`, `meeting_id`, `division_id`, `task_id`, `archived_at`, `created_at`, `updated_at`

### `memory_versions` — Immutable version history
- Every update creates new version; old versions never deleted
- Links to previous version for audit trail via `supersedes_id`
- **Columns:** `version_id`, `memory_id`, `version_num`, `title`, `content`, `tags`, `confidence`, `changed_by_owner_type`, `changed_by_owner_id`, `changed_by_runtime`, `change_summary`, `created_at`

### `memory_links` — Relationship graph
- Explicit links between memories (supports, contradicts, extends, references, supersedes, derived_from)
- Enables retrieval by relationship traversal
- Creator tracked by `created_by_owner_type` + `created_by_owner_id`

### `memory_access` — Provenance & access control
- Tracks who created/updated/accessed each memory
- Accessor typed as `seat` | `division` | `staff` | `founder`
- Runtime instance attribution (Claude vs Hermes)
- **Columns:** `access_id`, `memory_id`, `version_accessed`, `accessor_type`, `accessor_id`, `accessor_runtime`, `access_type`, `created_at`

### Future Tables (Phase 6/7) — Created Empty in Phase 4
- `divisions` — Division catalog with head, budget, permissions, objectives
- `staff_agents` — Staff catalog with role, division, runtime instances, permissions
- `division_members` — Many-to-many staff ↔ division membership
- `cross_division_shares` — Explicit cross-division memory sharing grants
- `tasks` — Delegated tasks with assignee, creator, status, priority, budget
- `deliverables` — Task outputs with review workflow

## Retrieval Architecture

- **By Owner** — `SELECT * FROM memory_entries WHERE owner_type = ? AND owner_id = ?`
- **By Category** — Council-wide (`council_shared`), Division (`division_shared`), Org-wide (`business_context`)
- **By Meeting** — All memories originating from a meeting
- **By Division** — Memories scoped to a division (via `division_id`)
- **By Task** — Memories linked to a task/deliverable (via `task_id`)
- **By Topic/Keyword** — FTS5 virtual table on content
- **By Provenance** — Filter by author, meeting, confidence, type
- **By Relationship** — Graph traversal via `memory_links` (with privacy enforcement)
- **By Cross-Division Share** — Via `cross_division_shares` table

## MCP Integration

- Single shared SQLite database (WAL mode) — both runtimes read/write same tables
- No external sync needed; ACID transactions handle concurrency
- Prepared statements in `database.ts` extended with memory operations
- Council service (`council.ts`) exposes memory CRUD + retrieval methods
- Context injection: `owner_type` + `owner_id` derived from authenticated session (not request params)

## Implementation Sequence

1. **Schema Migration** — Add 4 memory tables + 6 future tables (empty), bump `SCHEMA_VERSION` to `4.0.0`
2. **Database Layer** — Extend `DatabaseInstance.stmt` with prepared statements
3. **Service Layer** — Add `MemoryService` in `council.ts` with CRUD + retrieval
4. **MCP Tools** — Register `create_memory`, `get_memory`, `search_memory`, `link_memory`
5. **Tests** — Unit + integration tests for each category and retrieval pattern

## Forward Compatibility (Phase 6/7)

Phase 4 creates division/staff tables as empty shells so Phase 6/7 can:
- Add division management without schema migration
- Extend `memory_entries` foreign keys to `divisions`/`staff_agents`
- Implement delegation engine using existing `tasks`/`deliverables` tables
- Preserve all Phase 1–3 functionality and historical records

## Trade-offs

| Decision | Rationale |
|----------|-----------|
| Single `memory_entries` table with JSON | Simpler queries, flexible schema, SQLite JSON1 extension |
| Version table separate | Immutable history without row bloat in main table |
| FTS5 for keyword search | Native SQLite, no external deps, fast enough for ~10K entries |
| No vector embeddings | Phase 4 scope; can add later via extension |
| Runtime attribution in separate table | Keeps main table clean; enables audit without joins |
| Polymorphic FKs validated at app layer | SQLite cannot enforce polymorphic FKs |
| `cross_division_shares` table instead of tags | Queryable, auditable, revocable explicit sharing |

## Risk Mitigation

- **Schema migration** — Use `INSERT OR IGNORE` for schema_version; ALTER TABLE only additive
- **Concurrency** — WAL mode + `BEGIN IMMEDIATE` transactions for writes
- **Storage growth** — Archival policy (configurable TTL per category) + periodic vacuum
- **Identity leakage** — `memory_access` table tracks runtime but retrieval filters by owner_type + owner_id
- **FTS5 sync** — Triggers for INSERT, UPDATE, archive, restore, DELETE
- **Circular FKs** — Future tables avoid circular FK via nullable head_staff_id (no FK)

## Runtime Identity Resolution

**Trusted Identity Process:**
1. MCP session authenticates via transport (Claude Code or Hermes Agent)
2. Session middleware resolves transport → `owner_type` + `owner_id` + `runtime`
3. Identity injected into tool context; **never accepted from request parameters**
4. Both runtimes share logical identity: same `owner_id` (seat_id or staff_id) for both `claude` and `hermes` runtimes
5. `runtime` field distinguishes physical instance for audit purposes only

## Decision Immutability

- `decision_resolution` category entries are **immutable after creation**
- Corrections create a **new `decision_resolution` version** with `link_type: 'supersedes'` pointing to original
- Original preserved; new version records amendment rationale
- Formal amendments tracked via `memory_links` + `constitution_version` in content