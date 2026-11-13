// Meeting Operations
// Extracted from council.ts for modularization

import { DatabaseInstance } from '../database.js';
import {
  Meeting,
  Candidate,
  FounderDeliberation,
  FounderVote,
  MeetingPhase,
  PrimaryIdea,
  BrainstormRecord,
  Challenge,
  Defense,
  Synthesis,
  Reassessment,
  Evaluation,
  EvaluationCriteria
} from './types.js';

// --- Meeting Operations ---

export function createMeeting(
  db: DatabaseInstance,
  input: {
    meeting_id: string;
    number: number;
    constitution_version: string;
    status?: 'preparing' | 'deliberation' | 'primary_ideas' | 'brainstorming' | 'challenges' | 'synthesis' | 'reassessment' | 'evaluation' | 'closed' | 'archived' | 'cancelled';
    started_at?: string;
    closed_at?: string;
  }
): Meeting {
  const now = new Date().toISOString();
  db.runPreparedStatement('insertMeeting', [
    input.meeting_id,
    input.number,
    input.constitution_version,
    input.status ?? 'preparing',
    input.started_at ?? null,
    input.closed_at ?? null,
    now,
    now
  ]);

  const result = db.query('SELECT * FROM meetings WHERE meeting_id = ?', [input.meeting_id]);
  return result[0] as Meeting;
}

export function getMeetingById(
  db: DatabaseInstance,
  meetingId: string
): Meeting | null {
  const result = db.query('SELECT * FROM meetings WHERE meeting_id = ?', [meetingId]);
  return result.length > 0 ? result[0] as Meeting : null;
}

export function listMeetings(
  db: DatabaseInstance
): Meeting[] {
  const result = db.query('SELECT * FROM meetings ORDER BY number DESC');
  return result as Meeting[];
}

// --- Meeting Phase Operations ---

export function createMeetingPhase(
  db: DatabaseInstance,
  input: {
    id: string;
    meeting_id: string;
    phase: 'preparation' | 'founder_deliberation' | 'primary_ideas' | 'brainstorming' | 'challenges' | 'synthesis' | 'reassessment' | 'evaluation' | 'closure';
    status?: 'pending' | 'active' | 'completed' | 'skipped';
    started_at?: string;
    completed_at?: string;
  }
): MeetingPhase {
  const now = new Date().toISOString();
  db.runPreparedStatement('insertMeetingPhase', [
    input.id,
    input.meeting_id,
    input.phase,
    input.status ?? 'pending',
    input.started_at ?? null,
    input.completed_at ?? null,
    now
  ]);

  const result = db.query('SELECT * FROM meeting_phases WHERE id = ?', [input.id]);
  return result[0] as MeetingPhase;
}

export function getMeetingPhases(
  db: DatabaseInstance,
  meetingId: string
): MeetingPhase[] {
  const result = db.query('SELECT * FROM meeting_phases WHERE meeting_id = ?', [meetingId]);
  return result as MeetingPhase[];
}

export function updateMeetingPhase(
  db: DatabaseInstance,
  phaseId: string,
  updates: Partial<Pick<MeetingPhase, 'status' | 'started_at' | 'completed_at'>>
): MeetingPhase {
  const existing = db.query('SELECT * FROM meeting_phases WHERE id = ?', [phaseId])[0] as MeetingPhase;
  if (!existing) throw new Error(`Meeting phase '${phaseId}' not found`);

  db.runPreparedStatement('updateMeetingPhase', [
    updates.status ?? existing.status,
    updates.started_at ?? existing.started_at,
    updates.completed_at ?? existing.completed_at,
    phaseId
  ]);

  const result = db.query('SELECT * FROM meeting_phases WHERE id = ?', [phaseId]);
  return result[0] as MeetingPhase;
}

// --- Candidate Operations ---

export function createCandidate(
  db: DatabaseInstance,
  input: {
    candidate_id: string;
    name: string;
    description?: string;
    traits?: string;
    proposed_seat_id: string;
    status?: 'pending' | 'approved' | 'rejected' | 'withdrawn';
    proposed_by_founder_seat_id: string;
  }
): Candidate {
  const now = new Date().toISOString();
  db.runPreparedStatement('insertCandidate', [
    input.candidate_id,
    input.name,
    input.description ?? '',
    input.traits ?? '',
    input.proposed_seat_id,
    input.status ?? 'pending',
    input.proposed_by_founder_seat_id,
    now,
    now
  ]);

  const result = db.query('SELECT * FROM candidates WHERE candidate_id = ?', [input.candidate_id]);
  return result[0] as Candidate;
}

export function getCandidateById(
  db: DatabaseInstance,
  candidateId: string
): Candidate | null {
  const result = db.query('SELECT * FROM candidates WHERE candidate_id = ?', [candidateId]);
  return result.length > 0 ? result[0] as Candidate : null;
}

export function listCandidates(
  db: DatabaseInstance
): Candidate[] {
  const result = db.query('SELECT * FROM candidates ORDER BY created_at DESC');
  return result as Candidate[];
}

// --- Founder Deliberation Operations ---

export function createFounderDeliberation(
  db: DatabaseInstance,
  input: {
    id: string;
    candidate_id: string;
    founder_seat_id: string;
    content: string;
  }
): FounderDeliberation {
  const now = new Date().toISOString();
  db.runPreparedStatement('insertFounderDeliberation', [
    input.id,
    input.candidate_id,
    input.founder_seat_id,
    input.content,
    now
  ]);

  const result = db.query('SELECT * FROM founder_deliberations WHERE id = ?', [input.id]);
  return result[0] as FounderDeliberation;
}

export function getFounderDeliberationsByCandidate(
  db: DatabaseInstance,
  candidateId: string
): FounderDeliberation[] {
  const result = db.query('SELECT * FROM founder_deliberations WHERE candidate_id = ?', [candidateId]);
  return result as FounderDeliberation[];
}

// --- Founder Vote Operations ---

export function createFounderVote(
  db: DatabaseInstance,
  input: {
    id: string;
    candidate_id: string;
    founder_seat_id: string;
    vote: 'yes' | 'no' | 'abstain';
    notes?: string;
  }
): FounderVote {
  const now = new Date().toISOString();
  db.runPreparedStatement('insertFounderVote', [
    input.id,
    input.candidate_id,
    input.founder_seat_id,
    input.vote,
    input.notes ?? '',
    now
  ]);

  const result = db.query('SELECT * FROM founder_votes WHERE id = ?', [input.id]);
  return result[0] as FounderVote;
}

export function getFounderVotesByCandidate(
  db: DatabaseInstance,
  candidateId: string
): FounderVote[] {
  const result = db.query('SELECT * FROM founder_votes WHERE candidate_id = ?', [candidateId]);
  return result as FounderVote[];
}

// --- Primary Idea Operations ---

export function createPrimaryIdea(
  db: DatabaseInstance,
  input: {
    id: string;
    meeting_id: string;
    seat_id: string;
    persona_id: string;
    content: string;
  }
): PrimaryIdea {
  const now = new Date().toISOString();
  db.runPreparedStatement('insertPrimaryIdea', [
    input.id,
    input.meeting_id,
    input.seat_id,
    input.persona_id,
    input.content,
    now
  ]);

  const result = db.query('SELECT * FROM primary_ideas WHERE id = ?', [input.id]);
  return result[0] as PrimaryIdea;
}

export function getPrimaryIdeasByMeeting(
  db: DatabaseInstance,
  meetingId: string
): PrimaryIdea[] {
  const result = db.query('SELECT * FROM primary_ideas WHERE meeting_id = ?', [meetingId]);
  return result as PrimaryIdea[];
}

export function getPrimaryIdeaBySeatAndMeeting(
  db: DatabaseInstance,
  seatId: string,
  meetingId: string
): PrimaryIdea | null {
  const result = db.query(
    'SELECT * FROM primary_ideas WHERE seat_id = ? AND meeting_id = ?',
    [seatId, meetingId]
  );
  return result.length > 0 ? result[0] as PrimaryIdea : null;
}

// --- Brainstorming Operations ---

export function createBrainstormRecord(
  db: DatabaseInstance,
  input: {
    id: string;
    meeting_id: string;
    seat_id: string;
    persona_id: string;
    content: string;
  }
): BrainstormRecord {
  const now = new Date().toISOString();
  db.runPreparedStatement('insertBrainstormRecord', [
    input.id,
    input.meeting_id,
    input.seat_id,
    input.persona_id,
    input.content,
    now
  ]);

  const result = db.query('SELECT * FROM brainstorm_records WHERE id = ?', [input.id]);
  return result[0] as BrainstormRecord;
}

export function getBrainstormRecordsByMeeting(
  db: DatabaseInstance,
  meetingId: string
): BrainstormRecord[] {
  const result = db.query('SELECT * FROM brainstorm_records WHERE meeting_id = ?', [meetingId]);
  return result as BrainstormRecord[];
}

// --- Challenge Operations ---

export function createChallenge(
  db: DatabaseInstance,
  input: {
    id: string;
    meeting_id: string;
    challenger_seat_id: string;
    challenger_persona_id: string;
    target_seat_id: string;
    target_persona_id: string;
    content: string;
  }
): Challenge {
  const now = new Date().toISOString();
  db.runPreparedStatement('insertChallenge', [
    input.id,
    input.meeting_id,
    input.challenger_seat_id,
    input.challenger_persona_id,
    input.target_seat_id,
    input.target_persona_id,
    input.content,
    now
  ]);

  const result = db.query('SELECT * FROM challenges WHERE id = ?', [input.id]);
  return result[0] as Challenge;
}

export function getChallengesByMeeting(
  db: DatabaseInstance,
  meetingId: string
): Challenge[] {
  const result = db.query('SELECT * FROM challenges WHERE meeting_id = ?', [meetingId]);
  return result as Challenge[];
}

// --- Defense Operations ---

export function createDefense(
  db: DatabaseInstance,
  input: {
    id: string;
    meeting_id: string;
    challenge_id: string;
    defender_seat_id: string;
    defender_persona_id: string;
    content: string;
  }
): Defense {
  const now = new Date().toISOString();
  db.runPreparedStatement('insertDefense', [
    input.id,
    input.meeting_id,
    input.challenge_id,
    input.defender_seat_id,
    input.defender_persona_id,
    input.content,
    now
  ]);

  const result = db.query('SELECT * FROM defenses WHERE id = ?', [input.id]);
  return result[0] as Defense;
}

export function getDefensesByMeeting(
  db: DatabaseInstance,
  meetingId: string
): Defense[] {
  const result = db.query('SELECT * FROM defenses WHERE meeting_id = ?', [meetingId]);
  return result as Defense[];
}

// --- Synthesis Operations ---

export function createSynthesis(
  db: DatabaseInstance,
  input: {
    id: string;
    meeting_id: string;
    seat_id: string;
    persona_id: string;
    content: string;
  }
): Synthesis {
  const now = new Date().toISOString();
  db.runPreparedStatement('insertSynthesis', [
    input.id,
    input.meeting_id,
    input.seat_id,
    input.persona_id,
    input.content,
    now
  ]);

  const result = db.query('SELECT * FROM syntheses WHERE id = ?', [input.id]);
  return result[0] as Synthesis;
}

export function getSynthesesByMeeting(
  db: DatabaseInstance,
  meetingId: string
): Synthesis[] {
  const result = db.query('SELECT * FROM syntheses WHERE meeting_id = ?', [meetingId]);
  return result as Synthesis[];
}

// --- Reassessment Operations ---

export function createReassessment(
  db: DatabaseInstance,
  input: {
    id: string;
    meeting_id: string;
    seat_id: string;
    persona_id: string;
    target_seat_id: string;
    content: string;
  }
): Reassessment {
  const now = new Date().toISOString();
  db.runPreparedStatement('insertReassessment', [
    input.id,
    input.meeting_id,
    input.seat_id,
    input.persona_id,
    input.target_seat_id,
    input.content,
    now
  ]);

  const result = db.query('SELECT * FROM reassessments WHERE id = ?', [input.id]);
  return result[0] as Reassessment;
}

export function getReassessmentsByMeeting(
  db: DatabaseInstance,
  meetingId: string
): Reassessment[] {
  const result = db.query('SELECT * FROM reassessments WHERE meeting_id = ?', [meetingId]);
  return result as Reassessment[];
}

// --- Evaluation Operations ---

export function createEvaluation(
  db: DatabaseInstance,
  input: {
    id: string;
    meeting_id: string;
    evaluator_seat_id: string;
    evaluator_persona_id: string;
    subject_seat_id: string;
    subject_persona_id: string;
    cultural_impact_score: number;
    creative_output_score: number;
    collaborative_spirit_score: number;
    strategic_vision_score: number;
    authenticity_score: number;
    weighted_score: number;
    notes?: string;
  }
): Evaluation {
  const now = new Date().toISOString();
  db.runPreparedStatement('insertEvaluation', [
    input.id,
    input.meeting_id,
    input.evaluator_seat_id,
    input.evaluator_persona_id,
    input.subject_seat_id,
    input.subject_persona_id,
    input.cultural_impact_score,
    input.creative_output_score,
    input.collaborative_spirit_score,
    input.strategic_vision_score,
    input.authenticity_score,
    input.weighted_score,
    input.notes ?? '',
    now
  ]);

  const result = db.query('SELECT * FROM evaluations WHERE id = ?', [input.id]);
  return result[0] as Evaluation;
}

export function getEvaluationsByMeeting(
  db: DatabaseInstance,
  meetingId: string
): Evaluation[] {
  const result = db.query('SELECT * FROM evaluations WHERE meeting_id = ?', [meetingId]);
  return result as Evaluation[];
}

export function getEvaluationByEvaluatorAndSubject(
  db: DatabaseInstance,
  meetingId: string,
  evaluatorSeatId: string,
  subjectSeatId: string
): Evaluation | null {
  const result = db.query(
    'SELECT * FROM evaluations WHERE meeting_id = ? AND evaluator_seat_id = ? AND subject_seat_id = ?',
    [meetingId, evaluatorSeatId, subjectSeatId]
  );
  return result.length > 0 ? result[0] as Evaluation : null;
}

export function listEvaluationsBySubject(
  db: DatabaseInstance,
  subjectSeatId: string
): Evaluation[] {
  const result = db.query('SELECT * FROM evaluations WHERE subject_seat_id = ?', [subjectSeatId]);
  return result as Evaluation[];
}

// --- Evaluation Criteria Operations ---

export function createEvaluationCriteria(
  db: DatabaseInstance,
  input: {
    criterion_id: string;
    constitution_version: string;
    name: string;
    weight: number;
    description?: string;
  }
): EvaluationCriteria {
  const now = new Date().toISOString();
  db.runPreparedStatement('insertEvaluationCriteria', [
    input.criterion_id,
    input.constitution_version,
    input.name,
    input.weight,
    input.description ?? '',
    now
  ]);

  const result = db.query('SELECT * FROM evaluation_criteria WHERE criterion_id = ?', [input.criterion_id]);
  return result[0] as EvaluationCriteria;
}

export function getEvaluationCriteria(
  db: DatabaseInstance,
  constitutionVersion: string
): EvaluationCriteria[] {
  const result = db.query('SELECT * FROM evaluation_criteria WHERE constitution_version = ?', [constitutionVersion]);
  return result as EvaluationCriteria[];
}