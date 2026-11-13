# Phase 4 Memory Rules — Ownership, Lifecycle, and Provenance

## Ownership Rules

### Seat-Level Ownership
- **Individual Persona Memory** (`category: 'individual_persona'`)
  - Owned exclusively by the seat
  - Readable only by that seat's occupied runtimes (Claude + Hermes)
  - Writable only by that seat
  - Never visible to other seats

- **Meeting Contributions** (primary_ideas, brainstorm_records, challenges, defenses, syntheses, reassessments, evaluations)
  - Authored by specific seat during meeting
  - Immutable after meeting phase completes
  - Readable by all seats in that meeting
  - Attribution preserved in `memory_entries.owner_id` (seat_id) and `memory_access`

### Council-Level Ownership
- **Council Shared Memory** (`category: 'council_shared'`)
  - Owned collectively by all occupied seats
  - Readable by any occupied seat (both runtimes)
  - Writable by any occupied seat
  - Version conflicts resolved by `memory_versions` chain (last write wins, history preserved)

- **Decisions & Resolutions** (`category: 'decision_resolution'`)
  - Created during evaluation/closure phases
  - **Immutable after creation** — corrections create new version with `link_type: 'supersedes'`
  - Readable by all seats permanently
  - Author = Council collective (owner_type = 'seat', owner_id = 'council')

- **Lessons Learned** (`category: 'lesson_learned'`)
  - Synthesized from meetings
  - Writable by any occupied seat
  - Readable by all occupied seats
  - Tagged with `applicability` for retrieval

### Division-Level Ownership (Phase 6/7 Ready)
- **Division Shared Memory** (`category: 'division_shared'`)
  - Owned collectively by division members (head + staff)
  - Readable by all division members (both runtimes)
  - Writable by any division member
  - Not visible to other divisions or Council seats (unless explicit `cross_division_shares` grant)

- **Division Private Memory** (`category: 'division_private'`)
  - Owned exclusively by division head
  - Readable only by division head (both runtimes)
  - Writable only by division head
  - For sensitive operational data, budgets, personnel matters

### Staff-Level Ownership (Phase 6/7 Ready)
- **Staff Private Memory** (`category: 'staff_private'`)
  - Owned exclusively by the staff agent
  - Readable only by that staff agent's runtimes (Claude + Hermes)
  - Writable only by that staff agent
  - Never visible to other staff, division head, or Council

### Organizational-Level Ownership
- **Business Context** (`category: 'business_context'`)
  - Org-wide reference knowledge (policies, standards, references)
  - Readable by: Founder, all Council seats, all division heads, all staff
  - Writable by: Founder, Council (consensus), Division heads (within scope)
  - Version-controlled, immutable after approval

- **Task History** (`category: 'task_history'`)
  - Linked to specific `task_id`
  - Readable by: task assignee, creator, Founder, relevant division head
  - Writable during task lifecycle; immutable after completion
  - Includes deliverables, reviews, decisions

- **Cross-Division Memory** (`category: 'cross_division'`)
  - Explicitly shared across multiple divisions via `cross_division_shares` table
  - Readable by: members of granted divisions + Council + Founder
  - Writable by: members of granted divisions
  - Sharing granted/revoked via `cross_division_shares` (not tags)

### Shared but Scoped
- **Meeting History** (`category: 'meeting_history'`)
  - Linked to specific `meeting_id`
  - Readable by seats that participated in that meeting
  - Writable only during active meeting phases
  - Immutable after meeting closes

- **Ideas & Proposals** (`category: 'idea_proposal'`)
  - Authored by specific seat
  - Readable by all occupied seats
  - Status transitions: proposed → under_review → accepted/rejected
  - Only author or council collective can change status

- **Research & Evidence** (`category: 'research_evidence'`)
  - Authored by specific seat
  - Readable by all occupied seats
  - Configurable TTL (default: 5 meetings)
  - Expired entries archived, not deleted

- **Unresolved Questions** (`category: 'unresolved_question'`)
  - Authored by any occupied seat
  - Readable by all occupied seats
  - Resolved when linked to a decision/lesson via `memory_links` (link_type: 'supersedes' or 'derived_from')

## Lifecycle Rules

### Creation
| Category | Who Creates | When | Required Fields |
|----------|-------------|------|-----------------|
| `individual_persona` | Seat owner | Any time | `memory_type: 'persona_reflection'` |
| `council_shared` | Any occupied seat | Any time | `memory_type`, `tags` |
| `meeting_history` | Participating seat | During meeting phase | `meeting_id`, `memory_type` |
| `decision_resolution` | Council (automatic) | Meeting closure | `memory_type: 'decision_record'`, `meeting_id` |
| `idea_proposal` | Any occupied seat | Any time | `memory_type: 'idea_proposal'` |
| `research_evidence` | Any occupied seat | Any time | `memory_type: 'research_finding'` |
| `lesson_learned` | Any occupied seat | Post-meeting | `memory_type: 'lesson_learned'` |
| `unresolved_question` | Any occupied seat | Any time | `memory_type: 'open_question'` |
| `division_shared` | Division member | Any time | `division_id`, `memory_type` |
| `division_private` | Division head | Any time | `division_id`, `memory_type` |
| `staff_private` | Staff agent | Any time | `memory_type` |
| `business_context` | Founder/Council/Div head | Any time | `memory_type`, `tags` |
| `task_history` | Task system (auto) | Task events | `task_id`, `memory_type` |
| `cross_division` | Division member | Any time | `memory_type` (sharing via `cross_division_shares`) |

### Updates
- **Versioned updates only** — Every update increments `version`, creates `memory_versions` row, preserves previous version via `supersedes_id`
- **Who can update:**
  - `individual_persona` — Only owning seat
  - `council_shared` — Any occupied seat (creates new version)
  - `meeting_history` — Only during active phase; frozen after phase completes
  - `decision_resolution` — **Never** (immutable); corrections = new version + supersedes link
  - `idea_proposal` — Author or council collective (status changes)
  - `research_evidence` — Author only; expired = archived
  - `lesson_learned` — Any occupied seat (versioned)
  - `unresolved_question` — Any occupied seat; resolved = linked + status change
  - `division_shared` — Any division member
  - `division_private` — Only division head
  - `staff_private` — Only owning staff agent
  - `business_context` — Founder, Council consensus, or owning division head
  - `task_history` — Task system only (auto on events)
  - `cross_division` — Any member of granted divisions

### Deletion / Archival
- **No hard deletes** — Only status transitions or archival
- `individual_persona` — Seat owner can "archive" (soft delete via status in JSON)
- `council_shared` — Council consensus (6/11 seats) required to archive
- `meeting_history` — Never (permanent record)
- `decision_resolution` — Never (permanent record; corrections via supersedes)
- `idea_proposal` — Author can withdraw; council can reject
- `research_evidence` — Auto-archive after TTL; manual archive by author
- `lesson_learned` — Council consensus (6/11) to archive
- `unresolved_question` — Auto-close when linked to resolution
- `division_shared` — Division head can archive; division consensus (majority) for others
- `division_private` — Division head only
- `staff_private` — Staff agent only
- `business_context` — Founder only (with Council notification)
- `task_history` — Never (permanent record)
- `cross_division` — All granted divisions consensus required

### Archival
- Archived entries remain queryable but excluded from default searches
- `memory_entries` gets `archived_at` timestamp (nullable)
- FTS5 index removes archived content on archive; restores on unarchive
- `archived_at` = NULL means active; non-NULL means archived

## Provenance Rules

### Required on Every Write
| Field | Source | Purpose |
|-------|--------|---------|
| `owner_type` | Context (MCP session) | 'seat' \| 'division' \| 'staff' \| 'founder' |
| `owner_id` | Context (MCP session) | seat_id \| division_id \| staff_id \| 'founder' |
| `created_at` | `datetime('now')` | Timestamp |
| `changed_by_owner_type` | Context | Version author type |
| `changed_by_owner_id` | Context | Version author id |
| `changed_by_runtime` | Context | Version runtime (Claude/Hermes) |
| `change_summary` | Caller | Human-readable reason |

### `memory_access` Logging
- **Every operation** creates `memory_access` row:
  - `create` — On INSERT to `memory_entries`
  - `read` — On SELECT (batched per query, not per row)
  - `update` — On UPDATE to `memory_entries`
  - `link` — On INSERT to `memory_links`
  - `search` — On FTS5 query (logged per query)
- **Version tracking** — `version_accessed` column records specific version read (NULL = current)

### Identity Preservation
- **Claude/Hermes share owner_id** — Both runtimes write as same logical identity
- **Runtime distinguished** in `memory_access.accessor_runtime` and `memory_versions.changed_by_runtime`
- **Retrieval filters by owner_type + owner_id** — Never exposes other identities' private memory
- **Anonymous reads allowed** for `council_shared`, `decision_resolution`, `lesson_learned`, `business_context` (owner not required)

### Runtime Identity Resolution (Trusted Process)
1. MCP session authenticates via transport (Claude Code or Hermes Agent)
2. Session middleware resolves transport → `owner_type` + `owner_id` + `runtime`
3. Identity injected into tool context; **never accepted from request parameters**
4. Both runtimes share logical identity: same `owner_id` (seat_id or staff_id) for both `claude` and `hermes` runtimes
5. `runtime` field distinguishes physical instance for audit purposes only

## Access Control Matrix

| Requester | individual_persona | council_shared | meeting_history | decision_resolution | idea_proposal | research_evidence | lesson_learned | unresolved_question | division_shared | division_private | staff_private | business_context | task_history | cross_division |
|-----------|-------------------|----------------|-----------------|---------------------|---------------|-------------------|----------------|---------------------|-----------------|------------------|---------------|------------------|--------------|----------------|
| Council Seat (owner) | ✅ | ✅ | ✅ (participated) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ (if creator/assignee) | ✅ (if granted) |
| Council Seat (other) | ❌ | ✅ | ✅ (participated) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ (if creator/assignee) | ✅ (if granted) |
| Division Head | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (own div) | ✅ (own div) | ❌ | ✅ | ✅ (own div tasks) | ✅ (if granted) |
| Division Staff | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (own div) | ❌ | ✅ (own) | ✅ | ✅ (own tasks) | ✅ (if granted) |
| Founder | ✅ (all) | ✅ | ✅ (all) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (all) | ✅ (all) | ✅ (all) | ✅ | ✅ (all) | ✅ (all) |
| Vacant Seat | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Notes:**
- `meeting_history` only accessible to Council seats that participated (not division/staff)
- `cross_division` access requires explicit grant via `cross_division_shares` table
- `task_history` scoped to assignee, creator, Founder, relevant division head

## Consistency Guarantees

### ACID via SQLite WAL
- All writes in `BEGIN IMMEDIATE` transactions
- `memory_entries` + `memory_versions` + `memory_access` atomic
- `memory_links` created in same transaction as related entries
- `cross_division_shares` updates atomic with memory creation

### Conflict Resolution
- **Last-writer-wins for shared categories** — Version chain preserves history
- **Owner-level conflicts impossible** — Single writer per owner at a time (MCP session serializes)
- **Meeting history frozen** — No writes after phase completion
- **Division/Staff memory isolated** — No cross-owner conflicts by design
- **Decision immutability** — `decision_resolution` cannot be UPDATE'd; only new version + supersedes link

### Audit Trail
- Complete history via:
  - `memory_versions` — Every content change with author + runtime
  - `memory_access` — Every read/write/link/search with version_accessed
  - `memory_links` — Relationship evolution
  - `cross_division_shares` — Sharing grants/revocations
- Query: "Who knew what when?" → Join `memory_access` + `memory_entries` + `memory_versions`

## Default Retention Policies

| Category | Retention | Archive Trigger |
|----------|-----------|-----------------|
| `individual_persona` | Permanent | Seat vacancy (transfers to council archive) |
| `council_shared` | Permanent | Council consensus (6/11) |
| `meeting_history` | Permanent | Never |
| `decision_resolution` | Permanent | Never (immutable) |
| `idea_proposal` | Permanent | Status = rejected/withdrawn |
| `research_evidence` | 5 meetings | Auto-archive after TTL |
| `lesson_learned` | Permanent | Council consensus (6/11) |
| `unresolved_question` | Until resolved | Link to resolution created |
| `division_shared` | Permanent | Division head or consensus |
| `division_private` | Permanent | Division head only |
| `staff_private` | Permanent | Staff agent or termination |
| `business_context` | Permanent | Founder only |
| `task_history` | Permanent | Never |
| `cross_division` | Permanent | All granted divisions consensus |

## Constitutional Integration

- Evaluation criteria from active constitution influence `research_evidence` confidence scoring
- Decisions (`decision_resolution`) record constitution version
- Lessons learned tagged with applicable governance area
- Amendments create `decision_resolution` entries automatically (new version + supersedes link)

## Cross-Division Memory Isolation

- **No silent overwrites** — Division memory never overwrites Council memory or another division's records
- **Explicit sharing only** — `cross_division` category requires explicit grant via `cross_division_shares` (Founder-granted only)
- **Founder override** — Founder can read all memory; can write `business_context` and `task_history`
- **Council oversight** — Council can read all division/staff memory via `business_context` aggregation
- **Revocation auditable** — `cross_division_shares.revoked_at` tracks when access removed