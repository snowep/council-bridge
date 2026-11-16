# Phase 4 Test Plan — Memory and Knowledge Subsystem

## Test Strategy

- **Unit Tests** — Each service method in isolation with mocked database
- **Integration Tests** — Full SQLite database, real transactions, concurrent access
- **MCP Tool Tests** — End-to-end via MCP protocol
- **Privacy/Access Control Tests** — Verify seat/division/staff isolation and cross-scope visibility
- **Performance Tests** — FTS5 search, graph traversal, version history at scale
- **Adversarial Tests** — Security boundary testing, data integrity verification

## Test Categories

### 1. Schema & Migration Tests

| Test | Description |
|------|-------------|
| `schema_version_bumped` | `SCHEMA_VERSION === '4.0.0'` |
| `tables_created` | All 4 memory tables + FTS5 + triggers + 6 future tables (empty) exist after `createDatabase()` |
| `indexes_created` | All indexes present (including new owner/division/task/archived/author/version indexes) |
| `triggers_work` | FTS5 triggers fire on INSERT/UPDATE/DELETE/ARCHIVE/RESTORE |
| `migration_idempotent` | Running `createDatabase()` twice doesn't error |
| `future_tables_exist` | `divisions`, `staff_agents`, `division_members`, `cross_division_shares`, `tasks`, `deliverables` created empty |
| `future_tables_fk_ready` | Foreign keys reference future tables (no circular FK deadlock) |
| `archived_at_column_exists` | `memory_entries.archived_at` column present and nullable |
| `memory_versions_polymorphic_author` | `memory_versions` has `changed_by_owner_type` + `changed_by_owner_id` (no FK to council_seats) |
| `memory_access_version_tracking` | `memory_access.version_accessed` column present |

### 2. Memory CRUD Tests

| Test | Description |
|------|-------------|
| `create_individual_memory` | Seat creates `individual_persona` memory; only that seat can read |
| `create_council_shared` | Any occupied seat creates; all occupied seats can read |
| `create_meeting_history` | Linked to `meeting_id`; only participants can read |
| `create_decision_resolution` | Auto-created on meeting close; immutable, all seats read |
| `create_idea_proposal` | Author can update status; council can reject |
| `create_research_evidence` | TTL enforced; auto-archive after 5 meetings |
| `create_lesson_learned` | Council consensus to archive |
| `create_unresolved_question` | Auto-close when linked to resolution |
| `create_division_shared` | Division member creates; all division members read |
| `create_division_private` | Division head creates; only division head reads |
| `create_staff_private` | Staff agent creates; only that staff reads |
| `create_business_context` | Founder/Council/Div head creates; org-wide read |
| `create_task_history` | Auto-created on task events; scoped to assignee/creator |
| `create_cross_division` | Division member creates; sharing via `cross_division_shares` |

### 3. Versioning Tests

| Test | Description |
|------|-------------|
| `update_creates_version` | UPDATE increments `version`, creates `memory_versions` row |
| `version_chain_intact` | `supersedes_id` links form complete chain to v1 |
| `version_history_query` | `get_memory_versions` returns all versions in order |
| `confidence_preserved` | Version history retains original confidence |
| `change_summary_recorded` | Required `change_summary` stored in version |
| `version_tracks_owner_type` | `changed_by_owner_type` + `changed_by_owner_id` recorded correctly for all owner types |
| `version_supersedes_link_valid` | `supersedes_id` points to valid previous version row |
| `decision_immutability_enforced` | UPDATE on `decision_resolution` rejected; correction creates new version + supersedes link |

### 4. Linking & Graph Tests

| Test | Description |
|------|-------------|
| `link_supports` | `link_type: 'supports'` creates relationship |
| `link_contradicts` | `link_type: 'contradicts'` flagged in retrieval |
| `link_extends` | `link_type: 'extends'` for idea evolution |
| `link_supersedes` | Formal replacement; target archived |
| `link_derived_from` | Research → lesson traceability |
| `get_related_direct` | Single-hop traversal returns linked memories |
| `get_related_transitive` | Recursive traversal depth=3 works |
| `link_strength_ranking` | Results ordered by `strength` DESC |
| `no_self_links` | `source !== target` enforced |
| `no_duplicate_links` | UNIQUE constraint prevents duplicate `(source, target, type)` |
| `link_tracks_creator_type` | `created_by_owner_type` + `created_by_owner_id` recorded |
| `graph_traversal_privacy_enforced` | Privacy filter applied at each hop of traversal |
| `graph_traversal_cycle_detection` | Cycles in links don't cause infinite recursion |
| `graph_traversal_max_depth` | Depth limit respected |

### 5. FTS5 Search Tests

| Test | Description |
|------|-------------|
| `search_basic` | Keyword match returns relevant memories |
| `search_with_category_filter` | `category` filter narrows results |
| `search_with_type_filter` | `memory_type` filter works |
| `search_with_owner_filter` | `owner_type` + `owner_id` filter works |
| `search_with_division_filter` | `division_id` filter works |
| `search_with_task_filter` | `task_id` filter works |
| `search_respects_privacy` | Other owners' private memories never returned |
| `search_ranking` | `bm25` + confidence + type boost ordering verified against exact formula |
| `search_pagination` | `limit`/`offset` work correctly |
| `search_empty_query` | Returns recent memories (no MATCH) |
| `search_tags` | JSON array tag filtering works |
| `search_min_confidence` | Filters low-confidence entries |
| `search_include_archived` | `include_archived=true` returns archived memories |
| `fts5_direct_access_blocked` | No MCP tool exposes `memory_fts` directly |
| `fts5_sync_on_archive` | Archiving removes from FTS5; restoring re-adds |

### 6. Access Control / Privacy Tests

| Test | Description |
|------|-------------|
| `individual_private` | Seat A cannot read Seat B's `individual_persona` |
| `council_shared_visible` | All occupied seats read `council_shared` |
| `vacant_seat_no_access` | Vacant seats get empty results |
| `meeting_history_participants_only` | Non-participants excluded |
| `runtime_attribution` | `memory_access.accessor_runtime` = 'claude' or 'hermes' |
| `both_runtimes_same_seat` | Claude + Hermes share `seat_id` memory |
| `both_runtimes_same_staff` | Claude + Hermes share `staff_id` memory |
| `audit_log_complete` | Every operation logged in `memory_access` |
| `read_access_batched` | Single `memory_access` row per query, not per result |
| `version_accessed_logged` | `memory_access.version_accessed` populated for versioned reads |
| `division_private_head_only` | Division staff cannot read `division_private` |
| `staff_private_owner_only` | Division head cannot read staff's `staff_private` |
| `cross_division_explicit_only` | Only granted divisions read `cross_division` |
| `cross_division_revocation_works` | Revoked shares immediately remove access |
| `business_context_org_wide` | All roles read `business_context` |
| `task_history_scoped` | Only assignee/creator/div-head read `task_history` |
| `founder_sees_all` | Founder context bypasses all privacy filters |
| `identity_cannot_be_spoofed` | Request params for `owner_type`/`owner_id` ignored; context used |
| `graph_traversal_cannot_bypass_privacy` | Recursive CTE results filtered by privacy at each hop |

### 7. Lifecycle & Archival Tests

| Test | Description |
|------|-------------|
| `soft_delete_archives` | `archive_memory` sets `archived_at`, not hard delete |
| `archived_excluded_default` | Default queries exclude `archived_at IS NOT NULL` |
| `archived_searchable_fts` | FTS5 excludes archived; `include_archived=true` includes |
| `individual_archive_owner_only` | Only owning seat archives `individual_persona` |
| `council_shared_archive_consensus` | 6/11 seats required to archive |
| `decision_never_archived` | `decision_resolution` immutable; correction = new version |
| `meeting_history_never_archived` | Permanent record |
| `research_auto_archive` | After 5 meetings, `archived_at` set |
| `lesson_archive_consensus` | 6/11 seats required |
| `question_auto_resolve` | Link to resolution closes question |
| `division_shared_archive_head_or_consensus` | Division head or majority archives |
| `division_private_archive_head_only` | Division head only |
| `staff_private_archive_owner_only` | Staff agent only |
| `business_context_archive_founder_only` | Founder only |
| `task_history_never_archived` | Permanent record |
| `cross_division_archive_all_consensus` | All granted divisions consensus required |
| `restore_memory_works` | `restoreMemory` clears `archived_at` and re-adds to FTS5 |

### 8. MCP Tool Integration Tests

| Test | Description |
|------|-------------|
| `create_memory_tool` | MCP tool creates entry + version + access log |
| `get_memory_tool` | Returns memory with optional versions/links |
| `update_memory_tool` | Versioned update with `change_summary` |
| `search_memory_tool` | FTS5 + filters + privacy |
| `link_memory_tool` | Creates link + access log |
| `get_related_tool` | Graph traversal with depth + privacy |
| `get_versions_tool` | Version history |
| `cross_division_shares_tools` | Grant/list/revoke cross-division shares |
| `tool_input_validation` | Zod schemas reject invalid input |
| `tool_error_handling` | Proper error codes/messages |
| `tool_owner_context_injected` | `owner_type` + `owner_id` from session, not params |
| `tool_identity_spoofing_rejected` | Passing `owner_type`/`owner_id` in params has no effect |

### 9. Concurrency & Transaction Tests

| Test | Description |
|------|-------------|
| `concurrent_writes_same_owner` | Serialized by MCP session (no conflict) |
| `concurrent_writes_council_shared` | Last-writer-wins, version chain intact |
| `transaction_atomicity` | Memory + version + access all commit or rollback |
| `link_transaction` | Source + target + link + access atomic |
| `wal_mode_works` | Multiple readers during write |
| `division_concurrent_writes` | Division members concurrent writes versioned |
| `concurrent_archive_and_read` | WAL mode behavior during archival (no phantom reads) |

### 10. Performance Tests (Thresholds)

| Test | Threshold |
|------|-----------|
| `search_10k_entries` | < 100ms p95 |
| `search_50k_entries` | < 200ms p95 |
| `version_history_100_versions` | < 50ms |
| `graph_traversal_depth3_1000_nodes` | < 100ms |
| `concurrent_readers_10` | No locking issues |
| `bulk_insert_1000_memories` | < 2s |

### 11. Constitutional Integration Tests

| Test | Description |
|------|-------------|
| `decision_records_constitution_version` | `decision_resolution` content includes `constitution_version` |
| `amendment_creates_memory` | Constitution amendment → `decision_resolution` (new version) + `lesson_learned` |
| `evaluation_criteria_influence_confidence` | Active constitution weights affect research scoring |
| `lesson_tagged_governance_area` | Lessons have `applicability` from constitution articles |

### 12. Future Table Integration Tests (Phase 6/7 Ready)

| Test | Description |
|------|-------------|
| `divisions_table_empty` | `divisions` table exists, zero rows after init |
| `staff_agents_table_empty` | `staff_agents` table exists, zero rows after init |
| `division_members_table_empty` | `division_members` table exists, zero rows after init |
| `cross_division_shares_table_empty` | `cross_division_shares` table exists, zero rows after init |
| `tasks_table_empty` | `tasks` table exists, zero rows after init |
| `deliverables_table_empty` | `deliverables` table exists, zero rows after init |
| `memory_entries_fk_division` | `memory_entries.division_id` FK to `divisions` works (when populated) |
| `memory_entries_fk_task` | `memory_entries.task_id` FK to `tasks` works (when populated) |
| `division_creation_ready` | INSERT into `divisions` works with all columns (no circular FK) |
| `staff_creation_ready` | INSERT into `staff_agents` works with all columns |
| `task_creation_ready` | INSERT into `tasks` works with all columns |
| `cross_division_grant_ready` | INSERT into `cross_division_shares` works |

### 13. Adversarial / Data Integrity Tests

| Test | Description |
|------|-------------|
| `fts5_direct_sql_injection` | Direct `memory_fts` query returns all content (deployment constraint documented) |
| `json_tag_injection` | Malformed JSON in tags array handled gracefully |
| `version_chain_tampering` | Manual DB edit breaking `supersedes_id` chain detected |
| `decision_overwrite_attempt` | Direct SQL UPDATE on `decision_resolution` fails or creates version |
| `cross_division_share_bypass` | Tags alone don't grant cross-division access |
| `memory_link_cycle_creation` | Self-referential links prevented |
| `founder_context_spoofing` | Non-founder cannot elevate to founder via param manipulation |
| `version_access_audit` | `memory_access` correctly records `version_accessed` for historical reads |

## Test Data Fixtures

### Standard Council Setup
```typescript
const testSetup = {
  seats: [
    { seat_id: 'seat-01', name: 'Steve Jobs', status: 'permanent', is_founder: true },
    { seat_id: 'seat-02', name: 'Virgil Abloh', status: 'permanent', is_founder: true },
    { seat_id: 'seat-03', name: 'Shawn Stüssy', status: 'permanent', is_founder: true },
    { seat_id: 'seat-04', name: 'G-Dragon', status: 'permanent', is_founder: true },
    { seat_id: 'seat-05', name: 'Member A', status: 'replaceable', is_founder: false },
    { seat_id: 'seat-06', name: 'Member B', status: 'replaceable', is_founder: false },
    // ... seats 07-11 vacant
  ],
  meetings: [
    { meeting_id: 'mtg-1', number: 1, status: 'closed', constitution_version: '1.0.0' },
    { meeting_id: 'mtg-2', number: 2, status: 'closed', constitution_version: '1.0.0' },
    // ... up to 5 for TTL testing
  ],
  constitutions: [
    { version: '1.0.0', status: 'active', approved_by_founder: true }
  ]
};
```

### Division/Staff Setup (Phase 6/7 Fixtures)
```typescript
const divisionTestSetup = {
  divisions: [
    { division_id: 'div-dev', name: 'Developer', head_staff_id: 'staff-01', budget_limit: 100000 },
    { division_id: 'div-marketing', name: 'Marketing', head_staff_id: 'staff-02', budget_limit: 75000 },
    { division_id: 'div-creative', name: 'Creative', head_staff_id: 'staff-03', budget_limit: 50000 },
    { division_id: 'div-finance', name: 'Finance', head_staff_id: 'staff-06', budget_limit: 80000 },
    { division_id: 'div-research', name: 'Research & Intelligence', head_staff_id: 'staff-07', budget_limit: 60000 },
    { division_id: 'div-ops', name: 'Business Operations', head_staff_id: 'staff-08', budget_limit: 70000 },
  ],
  staff: [
    { staff_id: 'staff-01', name: 'Alex Chen', role: 'Division Head', division_id: 'div-dev', runtime_instances: ['claude', 'hermes'] },
    { staff_id: 'staff-02', name: 'Maria Santos', role: 'Division Head', division_id: 'div-marketing', runtime_instances: ['claude', 'hermes'] },
    { staff_id: 'staff-03', name: 'Jordan Kim', role: 'Division Head', division_id: 'div-creative', runtime_instances: ['claude', 'hermes'] },
    { staff_id: 'staff-04', name: 'Sam Wilson', role: 'Senior Developer', division_id: 'div-dev', runtime_instances: ['claude'] },
    { staff_id: 'staff-05', name: 'Taylor Brown', role: 'Designer', division_id: 'div-creative', runtime_instances: ['hermes'] },
    { staff_id: 'staff-06', name: 'Casey Lee', role: 'Division Head', division_id: 'div-finance', runtime_instances: ['claude', 'hermes'] },
    { staff_id: 'staff-07', name: 'Riley Park', role: 'Division Head', division_id: 'div-research', runtime_instances: ['claude', 'hermes'] },
    { staff_id: 'staff-08', name: 'Morgan Davis', role: 'Division Head', division_id: 'div-ops', runtime_instances: ['claude', 'hermes'] },
    { staff_id: 'staff-09', name: 'Avery Johnson', role: 'Analyst', division_id: 'div-research', runtime_instances: ['claude'] },
  ],
  tasks: [
    { task_id: 'task-01', title: 'Build API v2', assigned_to_type: 'staff', assigned_to_id: 'staff-04', created_by_type: 'division_head', created_by_id: 'staff-01' },
    { task_id: 'task-02', title: 'Q3 Campaign', assigned_to_type: 'division', assigned_to_id: 'div-marketing', created_by_type: 'founder', created_by_id: 'founder' },
  ]
};
```

### Memory Fixtures by Category
```typescript
const memoryFixtures = {
  individual_persona: {
    owner_type: 'seat', owner_id: 'seat-01',
    category: 'individual_persona',
    memory_type: 'persona_reflection',
    title: 'Reflection on Meeting 1',
    content: { insight: 'Need more synthesis time', context: 'Primary ideas phase rushed', related_meeting_ids: ['mtg-1'] },
    tags: ['reflection', 'process'],
    confidence: 0.9
  },
  council_shared: {
    owner_type: 'seat', owner_id: 'seat-01',
    category: 'council_shared',
    memory_type: 'meeting_summary',
    title: 'Meeting 1 Summary',
    content: { meeting_id: 'mtg-1', phase: 'closure', key_points: ['...'], outcomes: ['...'] },
    tags: ['summary', 'meeting-1'],
    confidence: 1.0
  },
  division_shared: {
    owner_type: 'division', owner_id: 'div-dev',
    category: 'division_shared',
    division_id: 'div-dev',
    memory_type: 'division_policy',
    title: 'Code Review Standards',
    content: { policy: 'All PRs require 2 approvals', rationale: 'Quality gate' },
    tags: ['policy', 'engineering'],
    confidence: 1.0
  },
  division_private: {
    owner_type: 'division', owner_id: 'div-dev',
    category: 'division_private',
    division_id: 'div-dev',
    memory_type: 'budget_planning',
    title: 'Q3 Budget Allocation',
    content: { allocations: { infra: 40000, hiring: 35000, tools: 25000 } },
    tags: ['budget', 'confidential'],
    confidence: 1.0
  },
  staff_private: {
    owner_type: 'staff', owner_id: 'staff-04',
    category: 'staff_private',
    memory_type: 'work_notes',
    title: 'API v2 Design Notes',
    content: { approach: 'GraphQL federation', blockers: ['auth service'] },
    tags: ['design', 'wip'],
    confidence: 0.8
  },
  business_context: {
    owner_type: 'founder', owner_id: 'founder',
    category: 'business_context',
    memory_type: 'company_policy',
    title: 'Remote Work Policy',
    content: { policy: '3 days office, 2 days remote', effective: '2024-01-01' },
    tags: ['policy', 'hr'],
    confidence: 1.0
  },
  task_history: {
    owner_type: 'staff', owner_id: 'staff-04',
    category: 'task_history',
    task_id: 'task-01',
    memory_type: 'task_event',
    title: 'Task Started: Build API v2',
    content: { event: 'started', by: 'staff-04', timestamp: '2024-01-15T10:00:00Z' },
    tags: ['task-01', 'event'],
    confidence: 1.0
  },
  cross_division: {
    owner_type: 'division', owner_id: 'div-dev',
    category: 'cross_division',
    memory_type: 'collaboration_proposal',
    title: 'Joint Launch Campaign',
    content: { proposal: 'Coordinated Dev+Marketing+Creative launch', participants: ['div-dev', 'div-marketing', 'div-creative'] },
    tags: ['cross_division', 'collaboration'],
    confidence: 0.9
  },
  meeting_history: {
    owner_type: 'seat', owner_id: 'seat-01',
    category: 'meeting_history',
    meeting_id: 'mtg-1',
    memory_type: 'meeting_summary',
    title: 'Meeting 1 - Primary Ideas Phase',
    content: { phase: 'primary_ideas', participants: ['seat-01', 'seat-02', 'seat-03', 'seat-04'], key_points: ['...'] },
    tags: ['meeting-1', 'primary_ideas'],
    confidence: 1.0
  },
  decision_resolution: {
    owner_type: 'seat', owner_id: 'council',
    category: 'decision_resolution',
    meeting_id: 'mtg-1',
    memory_type: 'decision_record',
    title: 'Decision: Approve Candidate for Seat 05',
    content: { decision: 'Approved', rationale: 'Strong cultural impact', vote_count: { yes: 3, no: 1, abstain: 0 }, constitution_version: '1.0.0' },
    tags: ['decision', 'seat-05', 'meeting-1'],
    confidence: 1.0
  },
  idea_proposal: {
    owner_type: 'seat', owner_id: 'seat-01',
    category: 'idea_proposal',
    meeting_id: 'mtg-1',
    memory_type: 'idea_proposal',
    title: 'Proposal: New Brand Partnership',
    content: { idea: 'Partner with emerging streetwear brand', category: 'strategy', status: 'proposed', meeting_id: 'mtg-1' },
    tags: ['proposal', 'partnership', 'meeting-1'],
    confidence: 0.8
  },
  research_evidence: {
    owner_type: 'seat', owner_id: 'seat-01',
    category: 'research_evidence',
    memory_type: 'research_finding',
    title: 'Market Research: Gen Z Streetwear Trends',
    content: { finding: 'Oversized silhouettes trending', evidence: ['report-1', 'report-2'], confidence: 0.85, source: 'Industry Report 2024' },
    tags: ['research', 'trends', 'gen-z'],
    confidence: 0.85
  },
  lesson_learned: {
    owner_type: 'seat', owner_id: 'seat-01',
    category: 'lesson_learned',
    memory_type: 'lesson_learned',
    title: 'Lesson: Synthesis Phase Too Short',
    content: { lesson: 'Allocate 50% more time for synthesis', context: 'Meeting 1 synthesis rushed', applicability: 'meeting', severity: 'medium' },
    tags: ['lesson', 'process', 'synthesis'],
    confidence: 0.9
  },
  unresolved_question: {
    owner_type: 'seat', owner_id: 'seat-01',
    category: 'unresolved_question',
    memory_type: 'open_question',
    title: 'Question: International Expansion Timeline',
    content: { question: 'When to expand to APAC?', context: 'G-Dragon suggests Q2', blockers: ['budget', 'legal'], priority: 'high' },
    tags: ['question', 'expansion', 'apac'],
    confidence: 0.7
  },
};
```

## Test Execution

```bash
# Unit tests (fast, mocked)
npm test -- --testPathPattern="memory.unit"

# Integration tests (real SQLite)
npm test -- --testPathPattern="memory.integration"

# MCP tool tests
npm test -- --testPathPattern="memory.mcp"

# Privacy/access tests
npm test -- --testPathPattern="memory.privacy"

# Future table tests
npm test -- --testPathPattern="memory.future"

# Adversarial tests
npm test -- --testPathPattern="memory.adversarial"

# Performance tests (separate, manual)
npm run test:perf -- memory
```

## CI Integration

- Run unit + integration + MCP + privacy + future + adversarial on every PR
- Performance tests on nightly/main branch
- Coverage target: > 90% for memory service

## Risk Areas to Test Thoroughly

1. **Privacy boundaries** — Seat/division/staff isolation is critical; any leak = governance failure
2. **Version chain integrity** — Broken `supersedes_id` = lost history
3. **FTS5 trigger sync** — Out-of-sync index = silent search failures
4. **Transaction atomicity** — Partial writes = corrupted state
5. **Constitutional linkage** — Decisions must record constitution version
6. **Runtime attribution** — Both runtimes must share seat/staff memory correctly
7. **Future table FK readiness** — Empty tables must accept inserts without schema changes
8. **Cross-division explicit sharing** — No implicit leakage between divisions
9. **Graph traversal privacy** — Each hop must enforce access control
10. **Identity spoofing** — Request params cannot override session context
11. **Decision immutability** — Schema or trigger enforcement required
12. **FTS5 direct access** — Deployment constraint documented and tested