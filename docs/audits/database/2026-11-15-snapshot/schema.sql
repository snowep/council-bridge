=== Schema ===
CREATE TABLE agents (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      runtime TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
CREATE TABLE approval_requests (
  approval_request_id   TEXT PRIMARY KEY,
  execution_id          TEXT NOT NULL UNIQUE,          -- Links to execution_requests
  requested_by_type     TEXT NOT NULL
    CHECK (requested_by_type IN ('staff', 'division', 'founder')),
  requested_by_id       TEXT NOT NULL,
  action_description    TEXT NOT NULL,
  action_payload        TEXT NOT NULL DEFAULT '{}',
  justification         TEXT NOT NULL,                 -- Why this needs Founder approval
  priority              TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  deadline              TEXT,                          -- ISO datetime for approval deadline
  status                TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  approved_by_type      TEXT,                          -- Always 'founder' when approved
  approved_by_id        TEXT,                          -- Founder's staff_id
  approved_at           TEXT,                          -- Approval timestamp
  rejection_reason      TEXT,                          -- Why rejected
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (execution_id) REFERENCES execution_requests(execution_id) ON DELETE CASCADE
);
CREATE TABLE brainstorm_records (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      seat_id TEXT NOT NULL,
      persona_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
      FOREIGN KEY (seat_id) REFERENCES council_seats(seat_id) ON DELETE CASCADE,
      FOREIGN KEY (persona_id) REFERENCES personas(persona_id) ON DELETE CASCADE
    );
CREATE TABLE candidates (
      candidate_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      traits TEXT NOT NULL DEFAULT '',
      proposed_seat_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
      proposed_by_founder_seat_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (proposed_seat_id) REFERENCES council_seats(seat_id) ON DELETE CASCADE,
      FOREIGN KEY (proposed_by_founder_seat_id) REFERENCES council_seats(seat_id) ON DELETE CASCADE
    );
CREATE TABLE challenges (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      challenger_seat_id TEXT NOT NULL,
      challenger_persona_id TEXT NOT NULL,
      target_seat_id TEXT NOT NULL,
      target_persona_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
      FOREIGN KEY (challenger_seat_id) REFERENCES council_seats(seat_id) ON DELETE CASCADE,
      FOREIGN KEY (challenger_persona_id) REFERENCES personas(persona_id) ON DELETE CASCADE,
      FOREIGN KEY (target_seat_id) REFERENCES council_seats(seat_id) ON DELETE CASCADE,
      FOREIGN KEY (target_persona_id) REFERENCES personas(persona_id) ON DELETE CASCADE
    );
CREATE TABLE constitutions (
      version TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'superseded', 'rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      approved_by_founder INTEGER NOT NULL DEFAULT 0
    );
CREATE TABLE council_seats (
      seat_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'vacant'
        CHECK (status IN ('permanent', 'vacant', 'replaceable')),
      is_founder INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
CREATE TABLE "cross_division_shares" (
  share_id        TEXT PRIMARY KEY,
  memory_id       TEXT NOT NULL,
  division_id     TEXT NOT NULL,
  granted_by_type TEXT NOT NULL
    CHECK (granted_by_type IN ('founder')),
  granted_by_id   TEXT NOT NULL,
  granted_at      TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at      TEXT, request_type TEXT
  CHECK (request_type IN ('task_delegate', 'deliverable_share', 'memory_access', 'resource_request')), status TEXT
  CHECK (status IN ('pending', 'approved', 'rejected'))
  DEFAULT 'pending', justification TEXT, priority TEXT
  CHECK (priority IN ('low', 'medium', 'high', 'critical'))
  DEFAULT 'medium', deadline TEXT, approved_by_type TEXT, approved_by_id TEXT, approved_at TEXT,
  FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
  UNIQUE(memory_id, division_id)
);
CREATE TABLE defenses (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      challenge_id TEXT NOT NULL,
      defender_seat_id TEXT NOT NULL,
      defender_persona_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
      FOREIGN KEY (defender_seat_id) REFERENCES council_seats(seat_id) ON DELETE CASCADE,
      FOREIGN KEY (defender_persona_id) REFERENCES personas(persona_id) ON DELETE CASCADE
    );
CREATE TABLE deliverable_versions (
      version_id        TEXT PRIMARY KEY,
      deliverable_id    TEXT NOT NULL,
      version_num       INTEGER NOT NULL,
      content           TEXT NOT NULL,
      quality_score     INTEGER,
      status            TEXT NOT NULL,
      submitted_by_type TEXT NOT NULL,
      submitted_by_id   TEXT NOT NULL,
      revision_notes    TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (deliverable_id) REFERENCES deliverables(deliverable_id) ON DELETE CASCADE,
      UNIQUE(deliverable_id, version_num)
    );
CREATE TABLE deliverables (
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
      created_at        TEXT NOT NULL DEFAULT (datetime('now')), file_references TEXT DEFAULT '[]', task_relationships TEXT DEFAULT '[]', audit_log TEXT DEFAULT '[]', updated_at TEXT NOT NULL DEFAULT (datetime('now')), execution_id TEXT, version INTEGER NOT NULL DEFAULT 1, quality_score INTEGER CHECK (quality_score BETWEEN 0 AND 100), reviewer_type TEXT CHECK (reviewer_type IN ('founder', 'council', 'division_head')), reviewer_id TEXT, approved_at TEXT, approved_by_type TEXT CHECK (approved_by_type IN ('founder', 'council', 'division_head')), approved_by_id TEXT, founder_signature TEXT, founder_signed_at TEXT, revision_notes TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
    );
CREATE TABLE division_members (
      division_id    TEXT NOT NULL,
      staff_id       TEXT NOT NULL,
      role           TEXT NOT NULL DEFAULT 'member',       -- 'head' | 'member' | 'specialist'
      joined_at      TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (division_id, staff_id),
      FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
      FOREIGN KEY (staff_id) REFERENCES staff_agents(staff_id) ON DELETE CASCADE
    );
CREATE TABLE divisions (
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
CREATE TABLE evaluation_criteria (
      criterion_id TEXT PRIMARY KEY,
      constitution_version TEXT NOT NULL,
      name TEXT NOT NULL,
      weight REAL NOT NULL CHECK (weight > 0 AND weight <= 1),
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (constitution_version) REFERENCES constitutions(version) ON DELETE CASCADE,
      UNIQUE(constitution_version, name)
    );
CREATE TABLE evaluations (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      evaluator_seat_id TEXT NOT NULL,
      evaluator_persona_id TEXT NOT NULL,
      subject_seat_id TEXT NOT NULL,
      subject_persona_id TEXT NOT NULL,
      cultural_impact_score INTEGER NOT NULL CHECK (cultural_impact_score BETWEEN 1 AND 10),
      creative_output_score INTEGER NOT NULL CHECK (creative_output_score BETWEEN 1 AND 10),
      collaborative_spirit_score INTEGER NOT NULL CHECK (collaborative_spirit_score BETWEEN 1 AND 10),
      strategic_vision_score INTEGER NOT NULL CHECK (strategic_vision_score BETWEEN 1 AND 10),
      authenticity_score INTEGER NOT NULL CHECK (authenticity_score BETWEEN 1 AND 10),
      weighted_score REAL NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
      FOREIGN KEY (evaluator_seat_id) REFERENCES council_seats(seat_id) ON DELETE CASCADE,
      FOREIGN KEY (evaluator_persona_id) REFERENCES personas(persona_id) ON DELETE CASCADE,
      FOREIGN KEY (subject_seat_id) REFERENCES council_seats(seat_id) ON DELETE CASCADE,
      FOREIGN KEY (subject_persona_id) REFERENCES personas(persona_id) ON DELETE CASCADE,
      UNIQUE(meeting_id, evaluator_seat_id, subject_seat_id)
    );
CREATE TABLE execution_history (
  history_id            TEXT PRIMARY KEY,
  execution_id          TEXT NOT NULL,                 -- Reference to execution_requests
  task_id               TEXT NOT NULL,
  requested_by_type     TEXT NOT NULL,
  requested_by_id       TEXT NOT NULL,
  autonomy_level        INTEGER NOT NULL,
  action_description    TEXT NOT NULL,
  action_payload        TEXT NOT NULL,
  status_before         TEXT NOT NULL,
  status_after          TEXT NOT NULL,
  approval_reference    TEXT,                          -- approval_request_id if applicable
  permission_grants     TEXT NOT NULL DEFAULT '[]',
  result_payload        TEXT,
  error_message         TEXT,
  executed_by_type      TEXT,                          -- Who actually executed (may differ from requester)
  executed_by_id        TEXT,
  started_at            TEXT,
  completed_at          TEXT,
  recorded_at           TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (execution_id) REFERENCES execution_requests(execution_id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);
CREATE TABLE execution_requests (
  execution_id          TEXT PRIMARY KEY,
  task_id               TEXT NOT NULL,                 -- Reference to tasks table
  requested_by_type     TEXT NOT NULL                  -- 'staff' | 'division' | 'founder'
    CHECK (requested_by_type IN ('staff', 'division', 'founder')),
  requested_by_id       TEXT NOT NULL,                 -- staff_id or division_id or 'founder'
  autonomy_level        INTEGER NOT NULL               -- 1, 2, or 3
    CHECK (autonomy_level IN (1, 2, 3)),
  action_description    TEXT NOT NULL,                 -- Human-readable description of proposed action
  action_payload        TEXT NOT NULL DEFAULT '{}',    -- JSON payload with action parameters
  status                TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'permission_check', 'approval_required', 'approved', 'rejected', 'queued', 'running', 'completed', 'failed', 'cancelled')),
  approval_request_id   TEXT,                          -- Reference to approval_requests if Level 3
  approval_id           TEXT,                          -- Reference to approvals table when approved
  permission_grants     TEXT NOT NULL DEFAULT '[]',    -- JSON array of cross_division_shares granted for this execution
  error_message         TEXT,                          -- Failure reason if failed
  result_payload        TEXT,                          -- JSON result of execution
  started_at            TEXT,                          -- When execution started
  completed_at          TEXT,                          -- When execution finished
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);
CREATE TABLE founder_approvals (
      id TEXT PRIMARY KEY,
      constitution_version TEXT NOT NULL,
      decision TEXT NOT NULL
        CHECK (decision IN ('accepted', 'rejected', 'revisions_requested')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (constitution_version) REFERENCES constitutions(version) ON DELETE CASCADE
    );
CREATE TABLE founder_deliberations (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL,
      founder_seat_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id) ON DELETE CASCADE,
      FOREIGN KEY (founder_seat_id) REFERENCES council_seats(seat_id) ON DELETE CASCADE
    );
CREATE TABLE founder_nonces (
      key_id      TEXT NOT NULL,
      operation   TEXT NOT NULL,
      nonce       TEXT NOT NULL,
      consumed_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at  TEXT NOT NULL,
      PRIMARY KEY (key_id, operation, nonce)
    );
CREATE TABLE founder_votes (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL,
      founder_seat_id TEXT NOT NULL,
      vote TEXT NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id) ON DELETE CASCADE,
      FOREIGN KEY (founder_seat_id) REFERENCES council_seats(seat_id) ON DELETE CASCADE,
      UNIQUE(candidate_id, founder_seat_id)
    );
CREATE TABLE meeting_phases (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      phase TEXT NOT NULL
        CHECK (phase IN ('preparation', 'founder_deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation', 'closure')),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'completed', 'skipped')),
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
      UNIQUE(meeting_id, phase)
    );
CREATE TABLE meetings (
      meeting_id TEXT PRIMARY KEY,
      number INTEGER NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'preparing'
        CHECK (status IN ('preparing', 'deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation', 'closed', 'archived')),
      constitution_version TEXT NOT NULL,
      started_at TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (constitution_version) REFERENCES constitutions(version) ON DELETE CASCADE
    );
CREATE TABLE memory_access (
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
CREATE TABLE memory_entries (
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
CREATE VIRTUAL TABLE memory_fts USING fts5(
      memory_id UNINDEXED,
      title,
      content,
      tags,
      memory_type,
      category,
      tokenize='porter unicode61'
    );
CREATE TABLE 'memory_fts_config'(k PRIMARY KEY, v) WITHOUT ROWID;
CREATE TABLE 'memory_fts_content'(id INTEGER PRIMARY KEY, c0, c1, c2, c3, c4, c5);
CREATE TABLE 'memory_fts_data'(id INTEGER PRIMARY KEY, block BLOB);
CREATE TABLE 'memory_fts_docsize'(id INTEGER PRIMARY KEY, sz BLOB);
CREATE TABLE 'memory_fts_idx'(segid, term, pgno, PRIMARY KEY(segid, term)) WITHOUT ROWID;
CREATE TABLE memory_links (
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
CREATE TABLE memory_versions (
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
CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      content TEXT NOT NULL,
      reply_to TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sender_id) REFERENCES agents(agent_id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_id) REFERENCES agents(agent_id) ON DELETE CASCADE,
      FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL
    );
CREATE TABLE migration_audit (
  audit_id          TEXT PRIMARY KEY,
  migration_id      TEXT NOT NULL,
  source_table      TEXT NOT NULL,
  source_pk         TEXT NOT NULL,
  action            TEXT NOT NULL,  -- 'preserved' | 'revoked' | 'quarantined'
  reason            TEXT NOT NULL,
  legacy_data       TEXT NOT NULL,  -- JSON of original row
  migrated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE migration_ledger (
  migration_id    TEXT PRIMARY KEY,   -- "001", "002", etc.
  filename        TEXT NOT NULL,      -- "001_staff_agents_default_inactive.sql"
  checksum        TEXT NOT NULL,      -- SHA-256 of SQL file content
  checksum_algo   TEXT NOT NULL DEFAULT 'sha256',
  applied_at      TEXT NOT NULL DEFAULT (datetime('now')),  -- ISO 8601
  applied_by      TEXT NOT NULL DEFAULT 'system',      -- user/system that ran migration
  duration_ms     INTEGER,            -- execution time
  status          TEXT NOT NULL       -- 'success', 'failed', 'rolled_back'
    CHECK (status IN ('pending', 'success', 'failed', 'rolled_back')),
  backup_path     TEXT,               -- path to pre-migration backup
  notes           TEXT DEFAULT '{}'   -- JSON with additional metadata
);
CREATE TABLE personas (
      persona_id TEXT PRIMARY KEY,
      seat_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      traits TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (seat_id) REFERENCES council_seats(seat_id) ON DELETE CASCADE
    );
CREATE TABLE primary_ideas (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      seat_id TEXT NOT NULL,
      persona_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
      FOREIGN KEY (seat_id) REFERENCES council_seats(seat_id) ON DELETE CASCADE,
      FOREIGN KEY (persona_id) REFERENCES personas(persona_id) ON DELETE CASCADE,
      UNIQUE(meeting_id, seat_id)
    );
CREATE TABLE quality_thresholds (
      threshold_id      TEXT PRIMARY KEY,
      division_id       TEXT,
      task_type         TEXT,
      min_quality_score INTEGER NOT NULL DEFAULT 70 CHECK (min_quality_score BETWEEN 0 AND 100),
      requires_review   INTEGER NOT NULL DEFAULT 1 CHECK (requires_review IN (0, 1)),
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
      UNIQUE(division_id, task_type)
    );
CREATE TABLE reassessments (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      seat_id TEXT NOT NULL,
      persona_id TEXT NOT NULL,
      target_seat_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
      FOREIGN KEY (seat_id) REFERENCES council_seats(seat_id) ON DELETE CASCADE,
      FOREIGN KEY (persona_id) REFERENCES personas(persona_id) ON DELETE CASCADE,
      FOREIGN KEY (target_seat_id) REFERENCES council_seats(seat_id) ON DELETE CASCADE
    );
CREATE TABLE runtime_personas (
      runtime TEXT NOT NULL,
      persona_id TEXT NOT NULL,
      PRIMARY KEY (runtime, persona_id),
      FOREIGN KEY (persona_id) REFERENCES personas(persona_id) ON DELETE CASCADE
    );
CREATE TABLE schema_version (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
CREATE TABLE "staff_agents" (
  staff_id          TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  role              TEXT NOT NULL,
  division_id       TEXT NOT NULL,
  runtime_instances TEXT NOT NULL DEFAULT '[]',
  permissions       TEXT NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active', 'inactive', 'terminated')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
);
CREATE TABLE staff_runtime_personas (
    runtime TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    PRIMARY KEY (runtime, staff_id),
    FOREIGN KEY (staff_id) REFERENCES staff_agents(staff_id) ON DELETE CASCADE
  );
CREATE TABLE syntheses (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      seat_id TEXT NOT NULL,
      persona_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
      FOREIGN KEY (seat_id) REFERENCES council_seats(seat_id) ON DELETE CASCADE,
      FOREIGN KEY (persona_id) REFERENCES personas(persona_id) ON DELETE CASCADE
    );
CREATE TABLE task_audit (
      audit_id        TEXT PRIMARY KEY,
      task_id         TEXT NOT NULL,
      mutation_type   TEXT NOT NULL
        CHECK (mutation_type IN ('create', 'update', 'assign', 'status_change', 'dependency_change', 'cancel', 'complete')),
      details         TEXT NOT NULL DEFAULT '{}',  -- JSON
      actor_type      TEXT NOT NULL,
      actor_id        TEXT NOT NULL,
      runtime         TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
    );
CREATE TABLE task_autonomy_levels (
  task_type       TEXT PRIMARY KEY,                    -- e.g., 'research', 'analysis', 'drafting', 'planning', 'code_execution', 'deployment', 'permission_grant', 'staff_appointment', 'budget_allocation'
  autonomy_level  INTEGER NOT NULL                     -- 1 = autonomous internal, 2 = bounded execution, 3 = founder approval required
    CHECK (autonomy_level IN (1, 2, 3)),
  description     TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE tasks (
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
    , dependencies TEXT DEFAULT '[]', deliverable_id TEXT, autonomy_level INTEGER
  CHECK (autonomy_level IN (1, 2, 3)));
