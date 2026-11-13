import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

type PreparedStatement = Database.Statement;

export interface DatabaseInstance {
  db: Database.Database;
  stmt: {
    // Phase 1
    insertAgent: PreparedStatement;
    getAgentById: PreparedStatement;
    getAgentByDisplayName: PreparedStatement;
    listAgents: PreparedStatement;
    updateAgent: PreparedStatement;
    deleteAgent: PreparedStatement;
    insertMessage: PreparedStatement;
    getMessageById: PreparedStatement;
    getMessagesByRecipient: PreparedStatement;
    getMessagesBySender: PreparedStatement;
    listMessages: PreparedStatement;
    countMessagesByRecipient: PreparedStatement;

    // Phase 2: Council
    getSchemaVersion: PreparedStatement;
    insertSchemaVersion: PreparedStatement;
    listSchemaVersions: PreparedStatement;

    insertSeat: PreparedStatement;
    getSeatById: PreparedStatement;
    listSeats: PreparedStatement;
    updateSeatStatus: PreparedStatement;

    insertPersona: PreparedStatement;
    getPersonaById: PreparedStatement;
    listPersonasBySeat: PreparedStatement;
    listAllPersonas: PreparedStatement;

    insertRuntimePersona: PreparedStatement;
    getRuntimePersonas: PreparedStatement;
    deleteRuntimePersona: PreparedStatement;

    insertConstitution: PreparedStatement;
    getConstitution: PreparedStatement;
    getActiveConstitution: PreparedStatement;
    listConstitutions: PreparedStatement;
    updateConstitutionStatus: PreparedStatement;

    insertFounderApproval: PreparedStatement;
    listFounderApprovals: PreparedStatement;

    // Phase 3: Council Formation, Meetings, Evaluation
    // Candidates
    insertCandidate: PreparedStatement;
    getCandidateById: PreparedStatement;
    listCandidates: PreparedStatement;
    updateCandidateStatus: PreparedStatement;

    // Founder Deliberation
    insertFounderDeliberation: PreparedStatement;
    getFounderDeliberationsByCandidate: PreparedStatement;
    listFounderDeliberations: PreparedStatement;

    // Founder Votes
    insertFounderVote: PreparedStatement;
    getFounderVotesByCandidate: PreparedStatement;

    // Meetings
    insertMeeting: PreparedStatement;
    getMeetingById: PreparedStatement;
    listMeetings: PreparedStatement;
    updateMeetingStatus: PreparedStatement;

    // Meeting Phases
    insertMeetingPhase: PreparedStatement;
    getMeetingPhases: PreparedStatement;
    updateMeetingPhase: PreparedStatement;

    // Primary Ideas
    insertPrimaryIdea: PreparedStatement;
    getPrimaryIdeasByMeeting: PreparedStatement;
    getPrimaryIdeaBySeatAndMeeting: PreparedStatement;

    // Brainstorming
    insertBrainstormRecord: PreparedStatement;
    getBrainstormRecordsByMeeting: PreparedStatement;

    // Challenges & Defenses
    insertChallenge: PreparedStatement;
    getChallengesByMeeting: PreparedStatement;
    insertDefense: PreparedStatement;
    getDefensesByMeeting: PreparedStatement;

    // Synthesis & Reassessment
    insertSynthesis: PreparedStatement;
    getSynthesesByMeeting: PreparedStatement;
    insertReassessment: PreparedStatement;
    getReassessmentsByMeeting: PreparedStatement;

    // Evaluations
    insertEvaluation: PreparedStatement;
    getEvaluationsByMeeting: PreparedStatement;
    getEvaluationByEvaluatorAndSubject: PreparedStatement;
    listEvaluationsBySubject: PreparedStatement;

    // Evaluation Criteria (from Constitution)
    insertEvaluationCriteria: PreparedStatement;
    getEvaluationCriteria: PreparedStatement;
    getEvaluationCriteriaForMeeting: PreparedStatement;

    // Phase 4: Memory and Knowledge Subsystem
    // Memory Entries
    insertMemory: PreparedStatement;
    getMemoryById: PreparedStatement;
    updateMemory: PreparedStatement;
    archiveMemory: PreparedStatement;
    restoreMemory: PreparedStatement;
    listMemoryEntries: PreparedStatement;
    getMemoryEntriesByOwner: PreparedStatement;
    getMemoryEntriesByCategory: PreparedStatement;
    getMemoryEntriesByMeeting: PreparedStatement;
    getMemoryEntriesByDivision: PreparedStatement;
    getMemoryEntriesByTask: PreparedStatement;
    searchMemoryEntries: PreparedStatement;

    // Memory Versions
    insertMemoryVersion: PreparedStatement;
    getMemoryVersions: PreparedStatement;
    getMemoryVersion: PreparedStatement;

    // Memory Links
    insertMemoryLink: PreparedStatement;
    getMemoryLinks: PreparedStatement;
    getLinksBySource: PreparedStatement;
    getLinksByTarget: PreparedStatement;
    getLinksByType: PreparedStatement;

    // Memory Access
    insertMemoryAccess: PreparedStatement;
    getMemoryAccessLog: PreparedStatement;

    // Cross-Division Shares
    insertCrossDivisionShare: PreparedStatement;
    getCrossDivisionShares: PreparedStatement;
    getSharesByDivision: PreparedStatement;
    revokeCrossDivisionShare: PreparedStatement;
    updateCrossDivisionShare: PreparedStatement;

    // Phase 6: Division & Staff Management
    insertDivision: PreparedStatement;
    getDivisionById: PreparedStatement;
    listDivisions: PreparedStatement;
    updateDivision: PreparedStatement;

    insertStaffAgent: PreparedStatement;
    getStaffAgentById: PreparedStatement;
    listStaffAgents: PreparedStatement;
    listStaffAgentsByDivision: PreparedStatement;
    updateStaffAgent: PreparedStatement;

    insertDivisionMember: PreparedStatement;
    getDivisionMembers: PreparedStatement;
    getStaffDivisions: PreparedStatement;

    // Phase 6: Task & Deliverable Management
    insertTask: PreparedStatement;
    getTaskById: PreparedStatement;
    listTasks: PreparedStatement;
    updateTask: PreparedStatement;

    insertDeliverable: PreparedStatement;
    getDeliverableById: PreparedStatement;
    listDeliverablesByTask: PreparedStatement;
    updateDeliverable: PreparedStatement;

    // Phase 7: Autonomy, Permissions and Execution
    insertTaskAutonomyLevel: PreparedStatement;
    getTaskAutonomyLevel: PreparedStatement;
    listTaskAutonomyLevels: PreparedStatement;
    insertExecutionRequest: PreparedStatement;
    getExecutionRequest: PreparedStatement;
    listExecutionRequests: PreparedStatement;
    updateExecutionRequest: PreparedStatement;
    insertApprovalRequest: PreparedStatement;
    getApprovalRequest: PreparedStatement;
    listApprovalRequests: PreparedStatement;
    updateApprovalRequest: PreparedStatement;
    insertExecutionHistory: PreparedStatement;
    getExecutionHistory: PreparedStatement;
    listExecutionHistoryByExecution: PreparedStatement;

    // Transaction support
    beginTransaction: PreparedStatement;
    commitTransaction: PreparedStatement;
    rollbackTransaction: PreparedStatement;
  };
  query: (sql: string, params?: any[]) => any[];
  runPreparedStatement: (name: string, params?: any[]) => any;
  generateId: () => string;
  close: () => void;
}

// Phase 4 schema version. Bumped when createDatabase() adds tables.
export const SCHEMA_VERSION = '4.0.0';

function createDatabase(dbPath: string): DatabaseInstance {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      runtime TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
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

    CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

    -- Phase 2: Council Bridge governance schema.
    CREATE TABLE IF NOT EXISTS schema_version (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS council_seats (
      seat_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'vacant'
        CHECK (status IN ('permanent', 'vacant', 'replaceable')),
      is_founder INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS personas (
      persona_id TEXT PRIMARY KEY,
      seat_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      traits TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (seat_id) REFERENCES council_seats(seat_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS runtime_personas (
      runtime TEXT NOT NULL,
      persona_id TEXT NOT NULL,
      PRIMARY KEY (runtime, persona_id),
      FOREIGN KEY (persona_id) REFERENCES personas(persona_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS constitutions (
      version TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'superseded', 'rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      approved_by_founder INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS founder_approvals (
      id TEXT PRIMARY KEY,
      constitution_version TEXT NOT NULL,
      decision TEXT NOT NULL
        CHECK (decision IN ('accepted', 'rejected', 'revisions_requested')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (constitution_version) REFERENCES constitutions(version) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_personas_seat ON personas(seat_id);
    CREATE INDEX IF NOT EXISTS idx_runtime_personas_runtime ON runtime_personas(runtime);
    CREATE INDEX IF NOT EXISTS idx_founder_approvals_version ON founder_approvals(constitution_version);

    -- Phase 3: Council Formation, Meetings, Evaluation
    CREATE TABLE IF NOT EXISTS candidates (
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

    CREATE TABLE IF NOT EXISTS founder_deliberations (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL,
      founder_seat_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id) ON DELETE CASCADE,
      FOREIGN KEY (founder_seat_id) REFERENCES council_seats(seat_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
    CREATE INDEX IF NOT EXISTS idx_candidates_proposed_seat ON candidates(proposed_seat_id);
    CREATE INDEX IF NOT EXISTS idx_founder_deliberations_candidate ON founder_deliberations(candidate_id);

    CREATE TABLE IF NOT EXISTS founder_votes (
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

    CREATE INDEX IF NOT EXISTS idx_founder_votes_candidate ON founder_votes(candidate_id);

    CREATE TABLE IF NOT EXISTS meetings (
      meeting_id TEXT PRIMARY KEY,
      number INTEGER NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'preparing'
        CHECK (status IN ('preparing', 'deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation', 'closed', 'archived', 'cancelled')),
      constitution_version TEXT NOT NULL,
      started_at TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (constitution_version) REFERENCES constitutions(version) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meeting_phases (
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

    CREATE INDEX IF NOT EXISTS idx_meetings_number ON meetings(number);
    CREATE INDEX IF NOT EXISTS idx_meeting_phases_meeting ON meeting_phases(meeting_id);

    CREATE TABLE IF NOT EXISTS primary_ideas (
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

    CREATE INDEX IF NOT EXISTS idx_primary_ideas_meeting ON primary_ideas(meeting_id);

    CREATE TABLE IF NOT EXISTS brainstorm_records (
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

    CREATE INDEX IF NOT EXISTS idx_brainstorm_records_meeting ON brainstorm_records(meeting_id);

    CREATE TABLE IF NOT EXISTS challenges (
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

    CREATE INDEX IF NOT EXISTS idx_challenges_meeting ON challenges(meeting_id);

    CREATE TABLE IF NOT EXISTS defenses (
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

    CREATE INDEX IF NOT EXISTS idx_defenses_meeting ON defenses(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_defenses_challenge ON defenses(challenge_id);

    CREATE TABLE IF NOT EXISTS syntheses (
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

    CREATE INDEX IF NOT EXISTS idx_syntheses_meeting ON syntheses(meeting_id);

    CREATE TABLE IF NOT EXISTS reassessments (
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

    CREATE INDEX IF NOT EXISTS idx_reassessments_meeting ON reassessments(meeting_id);

    CREATE TABLE IF NOT EXISTS evaluations (
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

    CREATE INDEX IF NOT EXISTS idx_evaluations_meeting ON evaluations(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_evaluations_subject ON evaluations(subject_seat_id);

    CREATE TABLE IF NOT EXISTS evaluation_criteria (
      criterion_id TEXT PRIMARY KEY,
      constitution_version TEXT NOT NULL,
      name TEXT NOT NULL,
      weight REAL NOT NULL CHECK (weight > 0 AND weight <= 1),
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (constitution_version) REFERENCES constitutions(version) ON DELETE CASCADE,
      UNIQUE(constitution_version, name)
    );

    CREATE INDEX IF NOT EXISTS idx_evaluation_criteria_constitution ON evaluation_criteria(constitution_version);

    -- Phase 4: Memory and Knowledge Subsystem
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

    -- FTS5 Virtual Table for full-text search
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

    CREATE TRIGGER IF NOT EXISTS memory_entries_fts_delete AFTER DELETE ON memory_entries BEGIN
      DELETE FROM memory_fts WHERE memory_id = old.memory_id;
    END;

    -- Phase 6/7 Future Tables — Divisions & Staff (Created empty in Phase 4)
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

    CREATE TABLE IF NOT EXISTS staff_agents (
      staff_id          TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      role              TEXT NOT NULL,                     -- Professional role/title
      division_id       TEXT NOT NULL,                     -- Division membership
      runtime_instances TEXT NOT NULL DEFAULT '[]',        -- JSON: ['claude', 'hermes']
      permissions       TEXT NOT NULL DEFAULT '[]',        -- JSON array of permission strings
      status            TEXT NOT NULL DEFAULT 'inactive'
        CHECK (status IN ('active', 'inactive', 'terminated')),
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_staff_agents_division ON staff_agents(division_id);
    CREATE INDEX IF NOT EXISTS idx_staff_agents_status ON staff_agents(status);

    CREATE TABLE IF NOT EXISTS division_members (
      division_id    TEXT NOT NULL,
      staff_id       TEXT NOT NULL,
      role           TEXT NOT NULL DEFAULT 'member',       -- 'head' | 'member' | 'specialist'
      joined_at      TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (division_id, staff_id),
      FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
      FOREIGN KEY (staff_id) REFERENCES staff_agents(staff_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cross_division_shares (
      share_id        TEXT PRIMARY KEY,
      memory_id       TEXT NOT NULL,
      division_id     TEXT NOT NULL,                       -- Division granted access
      granted_by_type TEXT NOT NULL                        -- 'founder' only (Migration 002)
        CHECK (granted_by_type IN ('founder')),
      granted_by_id   TEXT NOT NULL,                       -- 'founder'
      granted_at      TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at      TEXT,                                -- NULL = active
      -- Migration 005: Cross-division request tracking
      request_type    TEXT                                 -- 'task_delegate' | 'deliverable_share' | 'memory_access' | 'resource_request'
        CHECK (request_type IN ('task_delegate', 'deliverable_share', 'memory_access', 'resource_request')),
      status          TEXT NOT NULL DEFAULT 'approved'     -- 'pending' | 'approved' | 'rejected'
        CHECK (status IN ('pending', 'approved', 'rejected')),
      justification     TEXT,
      priority          TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
      deadline          TEXT,                              -- ISO datetime, nullable
      approved_by_type  TEXT,                              -- always 'founder' when approved
      approved_by_id    TEXT,                              -- founder's staff_id
      approved_at       TEXT,                              -- approval timestamp
      FOREIGN KEY (memory_id) REFERENCES memory_entries(memory_id) ON DELETE CASCADE,
      FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE CASCADE,
      UNIQUE(memory_id, division_id)
    );

    CREATE INDEX IF NOT EXISTS idx_cross_division_shares_memory ON cross_division_shares(memory_id);
    CREATE INDEX IF NOT EXISTS idx_cross_division_shares_division ON cross_division_shares(division_id);

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
      updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
      dependencies      TEXT NOT NULL DEFAULT '[]',        -- JSON array of task_ids
      deliverable_id    TEXT                               -- App-level reference to deliverable (not FK)
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to_type, assigned_to_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by_type, created_by_id);

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

    -- Phase 7: Autonomy, Permissions and Execution
    CREATE TABLE IF NOT EXISTS task_autonomy_levels (
      task_type       TEXT PRIMARY KEY,
      autonomy_level  INTEGER NOT NULL
        CHECK (autonomy_level IN (1, 2, 3)),
      description     TEXT NOT NULL DEFAULT '',
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS execution_requests (
      execution_id          TEXT PRIMARY KEY,
      task_id               TEXT NOT NULL,
      requested_by_type     TEXT NOT NULL
        CHECK (requested_by_type IN ('staff', 'division', 'founder')),
      requested_by_id       TEXT NOT NULL,
      autonomy_level        INTEGER NOT NULL
        CHECK (autonomy_level IN (1, 2, 3)),
      action_description    TEXT NOT NULL,
      action_payload        TEXT NOT NULL DEFAULT '{}',
      status                TEXT NOT NULL DEFAULT 'proposed'
        CHECK (status IN ('proposed', 'permission_check', 'approval_required', 'approved', 'rejected', 'queued', 'running', 'completed', 'failed', 'cancelled')),
      approval_request_id   TEXT,
      approval_id           TEXT,
      permission_grants     TEXT NOT NULL DEFAULT '[]',
      error_message         TEXT,
      result_payload        TEXT,
      started_at            TEXT,
      completed_at          TEXT,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS approval_requests (
      approval_request_id   TEXT PRIMARY KEY,
      execution_id          TEXT NOT NULL UNIQUE,
      requested_by_type     TEXT NOT NULL
        CHECK (requested_by_type IN ('staff', 'division', 'founder')),
      requested_by_id       TEXT NOT NULL,
      action_description    TEXT NOT NULL,
      action_payload        TEXT NOT NULL DEFAULT '{}',
      justification         TEXT NOT NULL,
      priority              TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
      deadline              TEXT,
      status                TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
      approved_by_type      TEXT,
      approved_by_id        TEXT,
      approved_at           TEXT,
      rejection_reason      TEXT,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (execution_id) REFERENCES execution_requests(execution_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS execution_history (
      history_id            TEXT PRIMARY KEY,
      execution_id          TEXT NOT NULL,
      task_id               TEXT NOT NULL,
      requested_by_type     TEXT NOT NULL,
      requested_by_id       TEXT NOT NULL,
      autonomy_level        INTEGER NOT NULL,
      action_description    TEXT NOT NULL,
      action_payload        TEXT NOT NULL,
      status_before         TEXT NOT NULL,
      status_after          TEXT NOT NULL,
      approval_reference    TEXT,
      permission_grants     TEXT NOT NULL DEFAULT '[]',
      result_payload        TEXT,
      error_message         TEXT,
      executed_by_type      TEXT,
      executed_by_id        TEXT,
      started_at            TEXT,
      completed_at          TEXT,
      recorded_at           TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (execution_id) REFERENCES execution_requests(execution_id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_execution_requests_task ON execution_requests(task_id);
    CREATE INDEX IF NOT EXISTS idx_execution_requests_status ON execution_requests(status);
    CREATE INDEX IF NOT EXISTS idx_execution_requests_requested ON execution_requests(requested_by_type, requested_by_id);
    CREATE INDEX IF NOT EXISTS idx_execution_requests_autonomy ON execution_requests(autonomy_level);
    CREATE INDEX IF NOT EXISTS idx_approval_requests_execution ON approval_requests(execution_id);
    CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
    CREATE INDEX IF NOT EXISTS idx_execution_history_execution ON execution_history(execution_id);
    CREATE INDEX IF NOT EXISTS idx_execution_history_task ON execution_history(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_autonomy_levels_level ON task_autonomy_levels(autonomy_level);
  `);

  const stmt = {
    insertAgent: db.prepare(`
      INSERT INTO agents (id, agent_id, display_name, runtime, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `),
    getAgentById: db.prepare('SELECT * FROM agents WHERE agent_id = ?'),
    getAgentByDisplayName: db.prepare('SELECT * FROM agents WHERE display_name = ?'),
    listAgents: db.prepare('SELECT * FROM agents ORDER BY created_at DESC'),
    updateAgent: db.prepare(`
      UPDATE agents SET display_name = ?, runtime = ?, updated_at = datetime('now')
      WHERE agent_id = ?
    `),
    deleteAgent: db.prepare('DELETE FROM agents WHERE agent_id = ?'),

    insertMessage: db.prepare(`
      INSERT INTO messages (id, sender_id, recipient_id, content, reply_to, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `),
    getMessageById: db.prepare('SELECT * FROM messages WHERE id = ?'),
    getMessagesByRecipient: db.prepare(`
      SELECT * FROM messages WHERE recipient_id = ? ORDER BY created_at DESC LIMIT ?
    `),
    getMessagesBySender: db.prepare(`
      SELECT * FROM messages WHERE sender_id = ? ORDER BY created_at DESC LIMIT ?
    `),
    listMessages: db.prepare(`
      SELECT * FROM messages WHERE sender_id = ? OR recipient_id = ? ORDER BY created_at DESC LIMIT ?
    `),
    countMessagesByRecipient: db.prepare('SELECT COUNT(*) as count FROM messages WHERE recipient_id = ?'),

    // Phase 2 council statements
    getSchemaVersion: db.prepare('SELECT version FROM schema_version WHERE version = ?'),
    insertSchemaVersion: db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)'),
    listSchemaVersions: db.prepare('SELECT * FROM schema_version ORDER BY applied_at DESC'),

    insertSeat: db.prepare(`
      INSERT INTO council_seats (seat_id, name, status, is_founder, description)
      VALUES (?, ?, ?, ?, ?)
    `),
    getSeatById: db.prepare('SELECT * FROM council_seats WHERE seat_id = ?'),
    listSeats: db.prepare('SELECT * FROM council_seats ORDER BY seat_id'),
    updateSeatStatus: db.prepare("UPDATE council_seats SET status = ?, updated_at = datetime('now') WHERE seat_id = ?"),

    insertPersona: db.prepare(`
      INSERT INTO personas (persona_id, seat_id, name, description, traits)
      VALUES (?, ?, ?, ?, ?)
    `),
    getPersonaById: db.prepare('SELECT * FROM personas WHERE persona_id = ?'),
    listPersonasBySeat: db.prepare('SELECT * FROM personas WHERE seat_id = ? ORDER BY persona_id'),
    listAllPersonas: db.prepare('SELECT * FROM personas ORDER BY persona_id'),

    insertRuntimePersona: db.prepare('INSERT OR IGNORE INTO runtime_personas (runtime, persona_id) VALUES (?, ?)'),
    getRuntimePersonas: db.prepare('SELECT * FROM runtime_personas WHERE runtime = ? ORDER BY persona_id'),
    deleteRuntimePersona: db.prepare('DELETE FROM runtime_personas WHERE runtime = ? AND persona_id = ?'),

    insertConstitution: db.prepare(`
      INSERT INTO constitutions (version, content, status, approved_by_founder)
      VALUES (?, ?, ?, ?)
    `),
    getConstitution: db.prepare('SELECT * FROM constitutions WHERE version = ?'),
    getActiveConstitution: db.prepare(`
      SELECT * FROM constitutions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1
    `),
    listConstitutions: db.prepare('SELECT * FROM constitutions ORDER BY created_at DESC'),
    updateConstitutionStatus: db.prepare('UPDATE constitutions SET status = ? WHERE version = ?'),

    insertFounderApproval: db.prepare(`
      INSERT INTO founder_approvals (id, constitution_version, decision, notes)
      VALUES (?, ?, ?, ?)
    `),
    listFounderApprovals: db.prepare('SELECT * FROM founder_approvals WHERE constitution_version = ? ORDER BY created_at DESC'),

    // Phase 3: Council Formation, Meetings, Evaluation
    // Candidates
    insertCandidate: db.prepare(`
      INSERT INTO candidates (candidate_id, name, description, traits, proposed_seat_id, status, proposed_by_founder_seat_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    getCandidateById: db.prepare('SELECT * FROM candidates WHERE candidate_id = ?'),
    listCandidates: db.prepare('SELECT * FROM candidates ORDER BY created_at DESC'),
    updateCandidateStatus: db.prepare("UPDATE candidates SET status = ?, updated_at = datetime('now') WHERE candidate_id = ?"),

    // Founder Deliberation
    insertFounderDeliberation: db.prepare(`
      INSERT INTO founder_deliberations (id, candidate_id, founder_seat_id, content)
      VALUES (?, ?, ?, ?)
    `),
    getFounderDeliberationsByCandidate: db.prepare('SELECT * FROM founder_deliberations WHERE candidate_id = ? ORDER BY created_at ASC'),
    listFounderDeliberations: db.prepare('SELECT * FROM founder_deliberations ORDER BY created_at DESC'),

    // Founder Votes
    insertFounderVote: db.prepare(`
      INSERT INTO founder_votes (id, candidate_id, founder_seat_id, vote, notes)
      VALUES (?, ?, ?, ?, ?)
    `),
    getFounderVotesByCandidate: db.prepare('SELECT * FROM founder_votes WHERE candidate_id = ? ORDER BY created_at ASC'),

    // Meetings
    insertMeeting: db.prepare(`
      INSERT INTO meetings (meeting_id, number, status, constitution_version, started_at, closed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    getMeetingById: db.prepare('SELECT * FROM meetings WHERE meeting_id = ?'),
    listMeetings: db.prepare('SELECT * FROM meetings ORDER BY number DESC'),
    updateMeetingStatus: db.prepare("UPDATE meetings SET status = ?, updated_at = datetime('now'), started_at = COALESCE(started_at, datetime('now')), closed_at = CASE WHEN ? IN ('closed', 'archived') THEN datetime('now') ELSE closed_at END WHERE meeting_id = ?"),

    // Meeting Phases
    insertMeetingPhase: db.prepare(`
      INSERT INTO meeting_phases (id, meeting_id, phase, status, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    getMeetingPhases: db.prepare('SELECT * FROM meeting_phases WHERE meeting_id = ? ORDER BY created_at ASC'),
    updateMeetingPhase: db.prepare("UPDATE meeting_phases SET status = ?, started_at = COALESCE(started_at, datetime('now')), completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE completed_at END WHERE meeting_id = ? AND phase = ?"),

    // Primary Ideas
    insertPrimaryIdea: db.prepare(`
      INSERT INTO primary_ideas (id, meeting_id, seat_id, persona_id, content)
      VALUES (?, ?, ?, ?, ?)
    `),
    getPrimaryIdeasByMeeting: db.prepare('SELECT * FROM primary_ideas WHERE meeting_id = ? ORDER BY created_at ASC'),
    getPrimaryIdeaBySeatAndMeeting: db.prepare('SELECT * FROM primary_ideas WHERE meeting_id = ? AND seat_id = ?'),

    // Brainstorming
    insertBrainstormRecord: db.prepare(`
      INSERT INTO brainstorm_records (id, meeting_id, seat_id, persona_id, content)
      VALUES (?, ?, ?, ?, ?)
    `),
    getBrainstormRecordsByMeeting: db.prepare('SELECT * FROM brainstorm_records WHERE meeting_id = ? ORDER BY created_at ASC'),

    // Challenges & Defenses
    insertChallenge: db.prepare(`
      INSERT INTO challenges (id, meeting_id, challenger_seat_id, challenger_persona_id, target_seat_id, target_persona_id, content)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    getChallengesByMeeting: db.prepare('SELECT * FROM challenges WHERE meeting_id = ? ORDER BY created_at ASC'),
    insertDefense: db.prepare(`
      INSERT INTO defenses (id, meeting_id, challenge_id, defender_seat_id, defender_persona_id, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    getDefensesByMeeting: db.prepare('SELECT * FROM defenses WHERE meeting_id = ? ORDER BY created_at ASC'),

    // Synthesis & Reassessment
    insertSynthesis: db.prepare(`
      INSERT INTO syntheses (id, meeting_id, seat_id, persona_id, content)
      VALUES (?, ?, ?, ?, ?)
    `),
    getSynthesesByMeeting: db.prepare('SELECT * FROM syntheses WHERE meeting_id = ? ORDER BY created_at ASC'),
    insertReassessment: db.prepare(`
      INSERT INTO reassessments (id, meeting_id, seat_id, persona_id, target_seat_id, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    getReassessmentsByMeeting: db.prepare('SELECT * FROM reassessments WHERE meeting_id = ? ORDER BY created_at ASC'),

    // Evaluations
    insertEvaluation: db.prepare(`
      INSERT INTO evaluations (id, meeting_id, evaluator_seat_id, evaluator_persona_id, subject_seat_id, subject_persona_id,
        cultural_impact_score, creative_output_score, collaborative_spirit_score, strategic_vision_score, authenticity_score,
        weighted_score, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getEvaluationsByMeeting: db.prepare('SELECT * FROM evaluations WHERE meeting_id = ? ORDER BY created_at ASC'),
    getEvaluationByEvaluatorAndSubject: db.prepare('SELECT * FROM evaluations WHERE meeting_id = ? AND evaluator_seat_id = ? AND subject_seat_id = ?'),
    listEvaluationsBySubject: db.prepare('SELECT * FROM evaluations WHERE subject_seat_id = ? ORDER BY created_at DESC'),

    // Evaluation Criteria
    insertEvaluationCriteria: db.prepare(`
      INSERT INTO evaluation_criteria (criterion_id, constitution_version, name, weight, description)
      VALUES (?, ?, ?, ?, ?)
    `),
    getEvaluationCriteria: db.prepare('SELECT * FROM evaluation_criteria WHERE constitution_version = ? ORDER BY name'),
    getEvaluationCriteriaForMeeting: db.prepare('SELECT * FROM evaluation_criteria WHERE constitution_version = ? ORDER BY name'),

    // Transaction support
    beginTransaction: db.prepare('BEGIN IMMEDIATE TRANSACTION'),
    commitTransaction: db.prepare('COMMIT'),
    rollbackTransaction: db.prepare('ROLLBACK'),

    // Phase 4: Memory and Knowledge Subsystem
    // Memory Entries
    insertMemory: db.prepare(`
      INSERT INTO memory_entries (memory_id, owner_type, owner_id, category, memory_type, title, content, tags, confidence, version, supersedes_id, meeting_id, division_id, task_id, archived_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getMemoryById: db.prepare('SELECT * FROM memory_entries WHERE memory_id = ?'),
    updateMemory: db.prepare(`
      UPDATE memory_entries SET title = ?, content = ?, tags = ?, confidence = ?, version = version + 1, supersedes_id = ?, updated_at = datetime('now')
      WHERE memory_id = ?
    `),
    archiveMemory: db.prepare('UPDATE memory_entries SET archived_at = datetime(\'now\') WHERE memory_id = ?'),
    restoreMemory: db.prepare('UPDATE memory_entries SET archived_at = NULL WHERE memory_id = ?'),
    listMemoryEntries: db.prepare('SELECT * FROM memory_entries WHERE archived_at IS NULL ORDER BY updated_at DESC LIMIT ? OFFSET ?'),
    getMemoryEntriesByOwner: db.prepare('SELECT * FROM memory_entries WHERE owner_type = ? AND owner_id = ? AND archived_at IS NULL ORDER BY updated_at DESC LIMIT ? OFFSET ?'),
    getMemoryEntriesByCategory: db.prepare('SELECT * FROM memory_entries WHERE category = ? AND archived_at IS NULL ORDER BY updated_at DESC LIMIT ? OFFSET ?'),
    getMemoryEntriesByMeeting: db.prepare('SELECT * FROM memory_entries WHERE meeting_id = ? AND archived_at IS NULL ORDER BY created_at ASC'),
    getMemoryEntriesByDivision: db.prepare('SELECT * FROM memory_entries WHERE division_id = ? AND archived_at IS NULL ORDER BY updated_at DESC LIMIT ? OFFSET ?'),
    getMemoryEntriesByTask: db.prepare('SELECT * FROM memory_entries WHERE task_id = ? AND archived_at IS NULL ORDER BY created_at ASC'),
    searchMemoryEntries: db.prepare(`
      SELECT m.* FROM memory_entries m
      JOIN memory_fts f ON m.memory_id = f.memory_id
      WHERE memory_fts MATCH ? AND m.archived_at IS NULL
      ORDER BY rank LIMIT ? OFFSET ?
    `),

    // Memory Versions
    insertMemoryVersion: db.prepare(`
      INSERT INTO memory_versions (version_id, memory_id, version_num, title, content, tags, confidence, changed_by_owner_type, changed_by_owner_id, changed_by_runtime, change_summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getMemoryVersions: db.prepare('SELECT * FROM memory_versions WHERE memory_id = ? ORDER BY version_num DESC LIMIT ?'),
    getMemoryVersion: db.prepare('SELECT * FROM memory_versions WHERE memory_id = ? AND version_num = ?'),

    // Memory Links
    insertMemoryLink: db.prepare(`
      INSERT INTO memory_links (link_id, source_memory_id, target_memory_id, link_type, strength, notes, created_by_owner_type, created_by_owner_id, created_by_runtime, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getMemoryLinks: db.prepare('SELECT * FROM memory_links WHERE source_memory_id = ? OR target_memory_id = ?'),
    getLinksBySource: db.prepare('SELECT * FROM memory_links WHERE source_memory_id = ?'),
    getLinksByTarget: db.prepare('SELECT * FROM memory_links WHERE target_memory_id = ?'),
    getLinksByType: db.prepare('SELECT * FROM memory_links WHERE source_memory_id = ? AND link_type = ?'),

    // Memory Access
    insertMemoryAccess: db.prepare(`
      INSERT INTO memory_access (access_id, memory_id, version_accessed, accessor_type, accessor_id, accessor_runtime, access_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getMemoryAccessLog: db.prepare('SELECT * FROM memory_access WHERE memory_id = ? ORDER BY created_at DESC LIMIT ?'),

    // Cross-Division Shares
    insertCrossDivisionShare: db.prepare(`
      INSERT INTO cross_division_shares (share_id, memory_id, division_id, granted_by_type, granted_by_id, granted_at, revoked_at, request_type, status, justification, priority, deadline, approved_by_type, approved_by_id, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `) as PreparedStatement,
    getCrossDivisionShares: db.prepare('SELECT * FROM cross_division_shares WHERE memory_id = ? AND revoked_at IS NULL') as PreparedStatement,
    getSharesByDivision: db.prepare('SELECT * FROM cross_division_shares WHERE division_id = ? AND revoked_at IS NULL') as PreparedStatement,
    revokeCrossDivisionShare: db.prepare('UPDATE cross_division_shares SET revoked_at = datetime(\'now\') WHERE memory_id = ? AND division_id = ?') as PreparedStatement,
    updateCrossDivisionShare: db.prepare('UPDATE cross_division_shares SET status = ?, approved_at = ?, approved_by_type = ?, approved_by_id = ?, granted_by_type = ?, granted_by_id = ? WHERE share_id = ?') as PreparedStatement,

    // Phase 6: Division & Staff Management
    insertDivision: db.prepare(`
      INSERT INTO divisions (division_id, name, description, head_staff_id, budget_limit, permissions, strategic_objectives)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `) as PreparedStatement,
    getDivisionById: db.prepare('SELECT * FROM divisions WHERE division_id = ?') as PreparedStatement,
    listDivisions: db.prepare('SELECT * FROM divisions ORDER BY created_at DESC') as PreparedStatement,
    updateDivision: db.prepare('UPDATE divisions SET name = ?, description = ?, head_staff_id = ?, budget_limit = ?, permissions = ?, strategic_objectives = ?, updated_at = datetime(\'now\') WHERE division_id = ?') as PreparedStatement,

    insertStaffAgent: db.prepare(`
      INSERT INTO staff_agents (staff_id, name, role, division_id, runtime_instances, permissions, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `) as PreparedStatement,
    getStaffAgentById: db.prepare('SELECT * FROM staff_agents WHERE staff_id = ?') as PreparedStatement,
    listStaffAgents: db.prepare('SELECT * FROM staff_agents ORDER BY created_at DESC') as PreparedStatement,
    listStaffAgentsByDivision: db.prepare('SELECT * FROM staff_agents WHERE division_id = ? ORDER BY created_at DESC') as PreparedStatement,
    updateStaffAgent: db.prepare('UPDATE staff_agents SET name = ?, role = ?, division_id = ?, runtime_instances = ?, permissions = ?, status = ?, updated_at = datetime(\'now\') WHERE staff_id = ?') as PreparedStatement,

    insertDivisionMember: db.prepare(`
      INSERT INTO division_members (division_id, staff_id, role)
      VALUES (?, ?, ?)
    `) as PreparedStatement,
    getDivisionMembers: db.prepare('SELECT * FROM division_members WHERE division_id = ?') as PreparedStatement,
    getStaffDivisions: db.prepare('SELECT * FROM division_members WHERE staff_id = ?') as PreparedStatement,

    insertTask: db.prepare(`
      INSERT INTO tasks (task_id, title, description, assigned_to_type, assigned_to_id, created_by_type, created_by_id, status, priority, budget_allocated, due_at, completed_at, created_at, updated_at, dependencies, deliverable_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `) as PreparedStatement,
    getTaskById: db.prepare('SELECT * FROM tasks WHERE task_id = ?') as PreparedStatement,
    listTasks: db.prepare('SELECT * FROM tasks ORDER BY created_at DESC') as PreparedStatement,
    updateTask: db.prepare('UPDATE tasks SET title = ?, description = ?, assigned_to_type = ?, assigned_to_id = ?, created_by_type = ?, created_by_id = ?, status = ?, priority = ?, budget_allocated = ?, due_at = ?, completed_at = ?, updated_at = datetime(\'now\') WHERE task_id = ?') as PreparedStatement,

    insertDeliverable: db.prepare(`
      INSERT INTO deliverables (deliverable_id, task_id, submitted_by_type, submitted_by_id, content, status, reviewed_by_type, reviewed_by_id, reviewed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `) as PreparedStatement,
    getDeliverableById: db.prepare('SELECT * FROM deliverables WHERE deliverable_id = ?') as PreparedStatement,
    listDeliverablesByTask: db.prepare('SELECT * FROM deliverables WHERE task_id = ? ORDER BY created_at DESC') as PreparedStatement,
    updateDeliverable: db.prepare('UPDATE deliverables SET status = ?, reviewed_by_type = ?, reviewed_by_id = ?, reviewed_at = ? WHERE deliverable_id = ?') as PreparedStatement,

    // Phase 7: Autonomy, Permissions and Execution
    insertTaskAutonomyLevel: db.prepare(`
      INSERT INTO task_autonomy_levels (task_type, autonomy_level, description)
      VALUES (?, ?, ?)
    `) as PreparedStatement,
    getTaskAutonomyLevel: db.prepare('SELECT * FROM task_autonomy_levels WHERE task_type = ?') as PreparedStatement,
    listTaskAutonomyLevels: db.prepare('SELECT * FROM task_autonomy_levels ORDER BY autonomy_level, task_type') as PreparedStatement,

    insertExecutionRequest: db.prepare(`
      INSERT INTO execution_requests (execution_id, task_id, requested_by_type, requested_by_id, autonomy_level, action_description, action_payload, status, approval_request_id, approval_id, permission_grants, error_message, result_payload, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `) as PreparedStatement,
    getExecutionRequest: db.prepare('SELECT * FROM execution_requests WHERE execution_id = ?') as PreparedStatement,
    listExecutionRequests: db.prepare('SELECT * FROM execution_requests ORDER BY created_at DESC') as PreparedStatement,
    updateExecutionRequest: db.prepare(`
      UPDATE execution_requests
      SET task_id = ?, requested_by_type = ?, requested_by_id = ?, autonomy_level = ?, action_description = ?, action_payload = ?, status = ?, approval_request_id = ?, approval_id = ?, permission_grants = ?, error_message = ?, result_payload = ?, started_at = ?, completed_at = ?, updated_at = datetime('now')
      WHERE execution_id = ?
    `) as PreparedStatement,

    insertApprovalRequest: db.prepare(`
      INSERT INTO approval_requests (approval_request_id, execution_id, requested_by_type, requested_by_id, action_description, action_payload, justification, priority, deadline, status, approved_by_type, approved_by_id, approved_at, rejection_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `) as PreparedStatement,
    getApprovalRequest: db.prepare('SELECT * FROM approval_requests WHERE approval_request_id = ?') as PreparedStatement,
    listApprovalRequests: db.prepare('SELECT * FROM approval_requests ORDER BY created_at DESC') as PreparedStatement,
    updateApprovalRequest: db.prepare(`
      UPDATE approval_requests
      SET execution_id = ?, requested_by_type = ?, requested_by_id = ?, action_description = ?, action_payload = ?, justification = ?, priority = ?, deadline = ?, status = ?, approved_by_type = ?, approved_by_id = ?, approved_at = ?, rejection_reason = ?, updated_at = datetime('now')
      WHERE approval_request_id = ?
    `) as PreparedStatement,

    insertExecutionHistory: db.prepare(`
      INSERT INTO execution_history (history_id, execution_id, task_id, requested_by_type, requested_by_id, autonomy_level, action_description, action_payload, status_before, status_after, approval_reference, permission_grants, result_payload, error_message, executed_by_type, executed_by_id, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `) as PreparedStatement,
    getExecutionHistory: db.prepare('SELECT * FROM execution_history WHERE history_id = ?') as PreparedStatement,
    listExecutionHistoryByExecution: db.prepare('SELECT * FROM execution_history WHERE execution_id = ? ORDER BY recorded_at') as PreparedStatement,
  };

  // Stamp the schema version so migrations can detect the current schema.
  db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);

  function generateId(): string {
    return randomUUID();
  }

  function close(): void {
    db.close();
  }

  return {
    db,
    stmt,
    generateId,
    close,
    query: (sql: string, params?: any[]) => db.prepare(sql).all(...(params || [])),
    runPreparedStatement: (name: string, params?: any[]) => {
      const statement = (stmt as any)[name];
      if (!statement) throw new Error(`Prepared statement not found: ${name}`);
      return statement.run(...(params || []));
    }
  };
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'council.db');

export const { db, stmt, generateId, close: closeDatabase } = createDatabase(DB_PATH);

export { createDatabase };