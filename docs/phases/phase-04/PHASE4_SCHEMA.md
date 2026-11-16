# Phase 4 Schema — Memory and Knowledge Subsystem

## Schema Version

**New Version: `4.0.0`** (bumped from `3.0.0`)

## New Tables

### `memory_entries` — Universal memory store

```sql
CREATE TABLE IF NOT EXISTS memory_entries (
  memory_id      TEXT PRIMARY KEY,
  owner_type     TEXT NOT NULL                     -- 'seat' | 'division' | 'staff' | 'founder'
    CHECK (owner_type IN ('seat', 'division', 'staff', 'founder')),
  owner_id       TEXT NOT NULL,                    -- seat_id | division_id | staff_id | 'founder'
  category       TEXT NOT NULL
    CHECK (category IN (
      'individual_persona',  -- Private to seat
      'council_shared',      -- Read/write all occupied seats
      'meeting_history',     -- Tied to specific meeting
      'decision_resolution', -- Council-wide decisions
      'idea_proposal',       -- Ideas from meetings
      'research_evidence',   -- Evidence gathered
      'lesson_learned',      -- Council-wide lessons
      'unresolved_question', -- Open questions
      'division_shared',     -- Read/write division members
      'division_private',    -- Private to division head
      'staff_private',       -- Private to staff agent
      'business_context',    -- Org-wide reference knowledge
      'task_history',        -- Task/deliverable records
      'cross_division'       -- Shared across divisions
    )),
  memory_type    TEXT NOT NULL,                    -- Discriminator for structured content
  title          TEXT NOT NULL,
  content        TEXT NOT NULL,                    -- JSON payload (structured by memory_type)
  tags           TEXT NOT NULL DEFAULT '[]',       -- JSON array of strings
  confidence     REAL NOT NULL DEFAULT 1.0
    CHECK (confidence >= 0 AND confidence <= 1),
  version        INTEGER NOT NULL DEFAULT 1,       -- Current version number
  supersedes_id  TEXT,                             -- Previous version (self-referential)
  meeting_id     TEXT,                             -- Optional link to originating meeting
  division_id    TEXT,                             -- Optional division scope
  task_id        TEXT,                             -- Optional task scope
  archived_at    TEXT,                             -- NULL = active, timestamp = archived
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supersedes_id) REFERENCES memory_entries(memory_id) ON DELETE SET NULL,
  FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE SET NULL,
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_entries_owner ON memory_entries(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_memory_entries_category ON memory_entries(category);
CREATE INDEX IF NOT EXISTS idx_memory_entries_meeting ON memory_entries(meeting_id);
CREATE INDEX IF NOT EXISTS idx_memory_entries_division ON memory_entries(division_id);
CREATE INDEX IF NOT EXISTS idx_memory_entries_task ON memory_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_memory_entries_supersedes ON memory_entries(supersedes_id);
CREATE INDEX IF NOT EXISTS idx_memory_entries_type ON memory_entries(memory_type);
CREATE INDEX IF NOT EXISTS idx_memory_entries_archived ON memory_entries(archived_at);
```

### `memory_versions` — Immutable version history

```sql
CREATE TABLE IF NOT EXISTS memory_versions (
  version_id           TEXT PRIMARY KEY,
  memory_id            TEXT NOT NULL,
  version_num          INTEGER NOT NULL,
  title                TEXT NOT NULL,
  content              TEXT NOT NULL,
  tags                 TEXT NOT NULL DEFAULT '[]',
  confidence           REAL NOT NULL DEFAULT 1.0
    CHECK (confidence >= 0 AND confidence <= 1),
  changed_by_owner_type TEXT NOT NULL                     -- 'seat' | 'division' | 'staff' | 'founder'
    CHECK (changed_by_owner_type IN ('seat', 'division', 'staff', 'founder')),
  changed_by_owner_id   TEXT NOT NULL,                    -- seat_id | division_id | staff_id | 'founder'
  changed_by_runtime    TEXT NOT NULL
    CHECK (changed_by_runtime IN ('claude', 'hermes')),
  change_summary       TEXT NOT NULL DEFAULT '',          -- Human-readable change note
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
  UNIQUE(memory_id, version_num)
);

CREATE INDEX IF NOT EXISTS idx_memory_versions_memory ON memory_versions(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_versions_author ON memory_versions(changed_by_owner_type, changed_by_owner_id);
```

### `memory_links` — Relationship graph

```sql
CREATE TABLE IF NOT EXISTS memory_links (
  link_id                TEXT PRIMARY KEY,
  source_memory_id       TEXT NOT NULL,
  target_memory_id       TEXT NOT NULL,
  link_type              TEXT NOT NULL
    CHECK (link_type IN (
      'supports',       -- Source supports target
      'contradicts',    -- Source contradicts target
      'extends',        -- Source extends/expands target
      'references',     -- Source references target
      'supersedes',     -- Source supersedes target (formal replacement)
      'derived_from'    -- Source derived from target
    )),
  strength               REAL NOT NULL DEFAULT 1.0
    CHECK (strength > 0 AND strength <= 1),
  notes                  TEXT NOT NULL DEFAULT '',
  created_by_owner_type  TEXT NOT NULL
    CHECK (created_by_owner_type IN ('seat', 'division', 'staff', 'founder')),
  created_by_owner_id    TEXT NOT NULL,
  created_by_runtime     TEXT NOT NULL
    CHECK (created_by_runtime IN ('claude', 'hermes')),
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
  FOREIGN KEY (target_memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
  UNIQUE(source_memory_id, target_memory_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_memory_links_source ON memory_links(source_memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_links_target ON memory_links(target_memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_links_type ON memory_links(link_type);
CREATE INDEX IF NOT EXISTS idx_memory_links_creator ON memory_links(created_by_owner_type, created_by_owner_id);
```

### `memory_access` — Provenance & access log

```sql
CREATE TABLE IF NOT EXISTS memory_access (
  access_id        TEXT PRIMARY KEY,
  memory_id        TEXT NOT NULL,
  version_accessed INTEGER,                              -- Specific version accessed (NULL = current)
  accessor_type    TEXT NOT NULL                         -- 'seat' | 'division' | 'staff' | 'founder'
    CHECK (accessor_type IN ('seat', 'division', 'staff', 'founder')),
  accessor_id      TEXT NOT NULL,                        -- seat_id | division_id | staff_id | 'founder'
  accessor_runtime TEXT NOT NULL
    CHECK (accessor_runtime IN ('claude', 'hermes')),
  access_type      TEXT NOT NULL
    CHECK (access_type IN ('create', 'read', 'update', 'link', 'search')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_access_memory ON memory_access(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_access_accessor ON memory_access(accessor_type, accessor_id);
CREATE INDEX IF NOT EXISTS idx_memory_access_type ON memory_access(access_type);
CREATE INDEX IF NOT EXISTS idx_memory_access_version ON memory_access(version_accessed);
```

### FTS5 Virtual Table — Full-text search on memory content

```sql
-- Content table for FTS5 (shadows memory_entries content field)
CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
  memory_id UNINDEXED,
  title,
  content,
  tags,
  memory_type,
  category,
  tokenize='porter unicode61'
);

-- Triggers to keep FTS5 in sync
CREATE TRIGGER IF NOT EXISTS memory_entries_fts_insert AFTER INSERT ON memory_entries BEGIN
  INSERT INTO memory_fts (memory_id, title, content, tags, memory_type, category)
  VALUES (new.memory_id, new.title, new.content, new.tags, new.memory_type, new.category);
END;

CREATE TRIGGER IF NOT EXISTS memory_entries_fts_update AFTER UPDATE ON memory_entries BEGIN
  DELETE FROM memory_fts WHERE memory_id = old.memory_id;
  INSERT INTO memory_fts (memory_id, title, content, tags, memory_type, category)
  VALUES (new.memory_id, new.title, new.content, new.tags, new.memory_type, new.category);
END;

CREATE TRIGGER IF NOT EXISTS memory_entries_fts_archive AFTER UPDATE OF archived_at ON memory_entries
WHEN NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL
BEGIN
  DELETE FROM memory_fts WHERE memory_id = NEW.memory_id;
END;

CREATE TRIGGER IF NOT EXISTS memory_entries_fts_restore AFTER UPDATE OF archived_at ON memory_entries
WHEN NEW.archived_at IS NULL AND OLD.archived_at IS NOT NULL
BEGIN
  INSERT INTO memory_fts (memory_id, title, content, tags, memory_type, category)
  VALUES (NEW.memory_id, NEW.title, NEW.content, NEW.tags, NEW.memory_type, NEW.category);
END;

-- Permanent deletion (if ever permitted) - FTS5 row removed by DELETE trigger
CREATE TRIGGER IF NOT EXISTS memory_entries_fts_delete AFTER DELETE ON memory_entries BEGIN
  DELETE FROM memory_fts WHERE memory_id = old.memory_id;
END;
```

## Phase 6/7 Future Tables — Divisions & Staff (Defined Here, Not Implemented in Phase 4)

These tables are documented for forward compatibility. Phase 4 creates them as empty tables with `CREATE TABLE IF NOT EXISTS` so Phase 6/7 can extend without migrations.

### `divisions` — Division catalog

```sql
CREATE TABLE IF NOT EXISTS divisions (
  division_id       TEXT PRIMARY KEY,
  name              TEXT NOT NULL UNIQUE,
  description       TEXT NOT NULL DEFAULT '',
  head_staff_id     TEXT,                              -- Staff agent serving as division head (validated at app layer)
  budget_limit      REAL NOT NULL DEFAULT 0,
  permissions       TEXT NOT NULL DEFAULT '[]',        -- JSON array of permission strings
  strategic_objectives TEXT NOT NULL DEFAULT '[]',     -- JSON array
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
  -- NO FK on head_staff_id to avoid circular dependency with staff_agents
);

CREATE INDEX IF NOT EXISTS idx_divisions_head ON divisions(head_staff_id);
```

### `staff_agents` — Staff agent catalog

```sql
CREATE TABLE IF NOT EXISTS staff_agents (
  staff_id          TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  role              TEXT NOT NULL,                     -- Professional role/title
  division_id       TEXT NOT NULL,                     -- Division membership
  runtime_instances TEXT NOT NULL DEFAULT '[]',        -- JSON: ['claude', 'hermes']
  permissions       TEXT NOT NULL DEFAULT '[]',        -- JSON array of permission strings
  status            TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'terminated')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_staff_agents_division ON staff_agents(division_id);
CREATE INDEX IF NOT EXISTS idx_staff_agents_status ON staff_agents(status);
```

### `division_members` — Staff ↔ Division membership (many-to-many for future)

```sql
CREATE TABLE IF NOT EXISTS division_members (
  division_id    TEXT NOT NULL,
  staff_id       TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'member',       -- 'head' | 'member' | 'specialist'
  joined_at      TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (division_id, staff_id),
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES staff_agents(staff_id) ON DELETE CASCADE
);
```

### `cross_division_shares` — Explicit cross-division memory sharing

```sql
CREATE TABLE IF NOT EXISTS cross_division_shares (
  share_id        TEXT PRIMARY KEY,
  memory_id       TEXT NOT NULL,
  division_id     TEXT NOT NULL,                       -- Division granted access
  granted_by_type TEXT NOT NULL                        -- 'division' | 'founder'
    CHECK (granted_by_type IN ('division', 'founder')),
  granted_by_id   TEXT NOT NULL,                       -- division_id | 'founder'
  granted_at      TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at      TEXT,                                -- NULL = active
  FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
  UNIQUE(memory_id, division_id)
);

CREATE INDEX IF NOT EXISTS idx_cross_division_shares_memory ON cross_division_shares(memory_id);
CREATE INDEX IF NOT EXISTS idx_cross_division_shares_division ON cross_division_shares(division_id);
```

### `tasks` — Delegated tasks and deliverables

```sql
CREATE TABLE IF NOT EXISTS tasks (
  task_id           TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  assigned_to_type  TEXT NOT NULL                      -- 'division' | 'staff'
    CHECK (assigned_to_type IN ('division', 'staff')),
  assigned_to_id    TEXT NOT NULL,                     -- division_id | staff_id
  created_by_type   TEXT NOT NULL                      -- 'founder' | 'council' | 'division_head'
    CHECK (created_by_type IN ('founder', 'council', 'division_head')),
  created_by_id     TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'review', 'completed', 'cancelled')),
  priority          TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  budget_allocated  REAL NOT NULL DEFAULT 0,
  due_at            TEXT,
  completed_at      TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to_type, assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by_type, created_by_id);
```

### `deliverables` — Task outputs

```sql
CREATE TABLE IF NOT EXISTS deliverables (
  deliverable_id    TEXT PRIMARY KEY,
  task_id           TEXT NOT NULL,
  submitted_by_type TEXT NOT NULL                      -- 'staff' | 'division'
    CHECK (submitted_by_type IN ('staff', 'division')),
  submitted_by_id   TEXT NOT NULL,
  content           TEXT NOT NULL,                     -- JSON payload
  status            TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'accepted', 'rejected', 'revision_requested')),
  reviewed_by_type  TEXT,                              -- 'founder' | 'council' | 'division_head'
  reviewed_by_id    TEXT,
  reviewed_at       TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deliverables_task ON deliverables(task_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_status ON deliverables(status);
```

## Schema Migration Strategy

```sql
-- Applied by createDatabase() on startup
INSERT OR IGNORE INTO schema_version (version) VALUES ('4.0.0');
```

All new tables are `CREATE TABLE IF NOT EXISTS` — additive only, no destructive changes to existing tables.

## JSON Payload Structures by `memory_type`

| `memory_type` | Schema (TypeScript) |
|---|---|
| `persona_reflection` | `{ insight: string; context: string; related_meeting_ids?: string[] }` |
| `meeting_summary` | `{ meeting_id: string; phase: string; key_points: string[]; outcomes: string[] }` |
| `decision_record` | `{ decision: string; rationale: string; vote_count: { yes: number; no: number; abstain: number }; constitution_version: string }` |
| `idea_proposal` | `{ idea: string; category: 'product'|'process'|'culture'|'strategy'; status: 'proposed'|'under_review'|'accepted'|'rejected'; meeting_id: string }` |
| `research_finding` | `{ finding: string; evidence: string[]; confidence: number; source: string; methodology?: string }` |
| `lesson_learned` | `{ lesson: string; context: string; applicability: 'meeting'|'governance'|'evaluation'|'general'; severity: 'low'|'medium'|'high' }` |
| `open_question` | `{ question: string; context: string; blockers: string[]; priority: 'low'|'medium'|'high' }` |
| `division_policy` | `{ policy: string; rationale: string; scope: string[] }` |
| `budget_planning` | `{ allocations: Record<string, number>; period: string }` |
| `work_notes` | `{ approach: string; blockers: string[]; progress: string }` |
| `company_policy` | `{ policy: string; effective: string; scope: string[] }` |
| `task_event` | `{ event: 'created'|'started'|'completed'|'reviewed'|'cancelled'; by: string; timestamp: string; details?: object }` |
| `collaboration_proposal` | `{ proposal: string; participants: string[]; status: 'proposed'|'accepted'|'rejected' }` |