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

    // Transaction support
    beginTransaction: PreparedStatement;
    commitTransaction: PreparedStatement;
    rollbackTransaction: PreparedStatement;
  };
  generateId: () => string;
  close: () => void;
}

// Phase 3 schema version. Bumped when createDatabase() adds tables.
export const SCHEMA_VERSION = '3.0.0';

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
  };

  // Stamp the schema version so migrations can detect the current schema.
  db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);

  function generateId(): string {
    return randomUUID();
  }

  function close(): void {
    db.close();
  }

  return { db, stmt, generateId, close };
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'council.db');

export const { db, stmt, generateId, close: closeDatabase } = createDatabase(DB_PATH);

export { createDatabase };