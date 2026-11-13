// Legacy compatibility layer - provides createCouncilService facade
// This wraps modular operations to match the original council.ts API

import { DatabaseInstance } from '../database.js';
import {
  SeatStatus,
  CouncilSeat,
  Persona,
  Constitution,
  FounderApproval,
  Candidate,
  FounderDeliberation,
  FounderVote,
  Meeting,
  MeetingPhase,
  PrimaryIdea,
  BrainstormRecord,
  Challenge,
  Defense,
  Synthesis,
  Reassessment,
  Evaluation,
  AnonymousEvaluation,
  EvaluationCriteria,
  MemoryOwnerType,
  MemoryEntry,
  MemoryVersion,
  MemoryLink,
  MemoryAccess,
  CrossDivisionShare,
  Division,
  StaffAgent,
  DivisionMember,
  Task,
  Deliverable,
  TaskAutonomyLevel,
  ExecutionRequest,
  ApprovalRequest,
  ExecutionHistory,
  AutonomyLevel,
  ExecutionStatus,
  ApprovalStatus,
  MemoryCategory,
  MemoryLinkType
} from './types.js';
import {
  CreateMemoryInput,
  UpdateMemoryInput,
  SearchMemoryInput,
  LinkMemoryInput,
  GetRelatedInput,
  GrantCrossDivisionAccessInput,
  RevokeCrossDivisionAccessInput,
  CreateDivisionInput,
  AssignDivisionHeadInput,
  UpdateDivisionInput,
  ListSpecialistsInput,
  RegisterStaffAgentInput,
  UpdateStaffStatusInput,
  UpdateStaffPermissionsInput,
  SuspendStaffAgentInput,
  RetireStaffAgentInput,
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksInput,
  CompleteTaskInput,
  CreateDeliverableInput,
  UpdateDeliverableInput,
  ListDeliverablesByTaskInput,
  RequestCrossDivisionAccessInput,
  ApproveCrossDivisionAccessInput,
  ListPendingCrossDivisionRequestsInput,
  CreateTaskAutonomyLevelInput,
  RequestExecutionInput,
  ApproveExecutionInput,
  GetExecutionRequestInput,
  ListExecutionRequestsInput,
  ListApprovalRequestsInput,
  GetExecutionHistoryInput,
  CreateEvaluationCriteriaInput
} from './inputs.js';
import * as ops from './operations.js';
import * as div from './divisions.js';
import * as mem from './memory.js';
import * as mtg from './meetings.js';

function isTaskAccessError(error: unknown): boolean {
  return error instanceof Error &&
    (error.message === 'Authorization denied' ||
     error.message === 'Staff can only request execution for their own tasks');
}

export interface CouncilService {
  // Council Seats
  createSeat(input: { seat_id: string; name: string; status: SeatStatus; is_founder: boolean; description: string }): CouncilSeat;
  getSeat(seatId: string): CouncilSeat | undefined;
  listSeats(): CouncilSeat[];
  updateSeatStatus(seatId: string, status: SeatStatus): CouncilSeat;

  // Personas
  createPersona(input: { persona_id: string; seat_id: string; name: string; description: string; traits: string }): Persona;
  getPersona(personaId: string): Persona | undefined;
  listPersonasBySeat(seatId: string): Persona[];
  listAllPersonas(): Persona[];
  getPersonaBySeat(seatId: string): Persona | undefined;

  // Runtime Personas
  assignPersonaToRuntime(runtime: string, personaId: string): { runtime: string; persona_id: string };
  removePersonaFromRuntime(runtime: string, personaId: string): void;
  getRuntimePersonas(runtime: string): Persona[];

  // Shared identity retrieval
  getAllSeatsWithPersonas(): (CouncilSeat & { persona: Persona | null })[];
  getRuntimePersonasWithSeats(runtime: string): (Persona & { seat: CouncilSeat })[];

  // Constitution
  createConstitution(input: { version: string; content: string; status: string; approved_by_founder: boolean }): Constitution;
  getConstitution(version: string): Constitution | undefined;
  getActiveConstitution(): Constitution | undefined;
  listConstitutions(): Constitution[];
  updateConstitutionStatus(version: string, status: string): Constitution;

  // Founder Approvals
  recordFounderApproval(input: { id: string; constitution_version: string; decision: string; notes: string }): FounderApproval;
  listFounderApprovals(version: string): FounderApproval[];
  getLatestFounderDecision(version: string): FounderApproval | undefined;

  // Validation
  validateRuntimeIdentity(runtime: string): { valid: boolean; issues: string[] };

  // Candidates
  createCandidate(input: { candidate_id: string; name: string; description: string; traits: string; proposed_seat_id: string; status: string; proposed_by_founder_seat_id: string }): Candidate;
  getCandidate(candidateId: string): Candidate | undefined;
  listCandidates(): Candidate[];
  updateCandidateStatus(candidateId: string, status: string): Candidate;

  // Founder Deliberation
  recordFounderDeliberation(input: { id: string; candidate_id: string; founder_seat_id: string; content: string }): FounderDeliberation;
  getFounderDeliberations(candidateId: string): FounderDeliberation[];

  // Founder Votes
  recordFounderVote(input: { id: string; candidate_id: string; founder_seat_id: string; vote: string; notes: string }): FounderVote;
  getFounderVotes(candidateId: string): FounderVote[];
  getCandidateVoteSummary(candidateId: string): { yes: number; no: number; abstain: number; approved: boolean };

  // Candidate Approval
  approveCandidate(candidateId: string): Candidate;
  rejectCandidate(candidateId: string): Candidate;
  seatApprovedCandidate(candidateId: string): { candidate: Candidate; persona: Persona; seat: CouncilSeat };

  // Meetings
  createMeeting(input: { meeting_id: string; number?: number; status: string; constitution_version: string; started_at?: string; closed_at?: string }): Meeting;
  getMeeting(meetingId: string): Meeting | undefined;
  listMeetings(): Meeting[];
  updateMeetingStatus(meetingId: string, status: string): Meeting;
  getMeetingPhases(meetingId: string): MeetingPhase[];
  startMeetingPhase(meetingId: string, phase: string): MeetingPhase;
  completeMeetingPhase(meetingId: string, phase: string): MeetingPhase;

  // Primary Ideas
  submitPrimaryIdea(input: { id: string; meeting_id: string; seat_id: string; persona_id: string; content: string }): PrimaryIdea;
  getPrimaryIdeas(meetingId: string): PrimaryIdea[];

  // Brainstorming
  recordBrainstorm(input: { id: string; meeting_id: string; seat_id: string; persona_id: string; content: string }): BrainstormRecord;
  getBrainstormRecords(meetingId: string): BrainstormRecord[];

  // Challenges
  recordChallenge(input: { id: string; meeting_id: string; challenger_seat_id: string; challenger_persona_id: string; target_seat_id: string; target_persona_id: string; content: string }): Challenge;
  getChallenges(meetingId: string): Challenge[];

  // Defenses
  recordDefense(input: { id: string; meeting_id: string; challenge_id: string; defender_seat_id: string; defender_persona_id: string; content: string }): Defense;
  getDefenses(meetingId: string): Defense[];

  // Synthesis
  recordSynthesis(input: { id: string; meeting_id: string; seat_id: string; persona_id: string; content: string }): Synthesis;
  getSyntheses(meetingId: string): Synthesis[];

  // Reassessment
  recordReassessment(input: { id: string; meeting_id: string; seat_id: string; persona_id: string; target_seat_id: string; content: string }): Reassessment;
  getReassessments(meetingId: string): Reassessment[];

  // Evaluation Criteria
  getEvaluationCriteriaForConstitution(constitutionVersion: string): EvaluationCriteria[];
  criterionNameToScoreKey(criterionName: string): string;
  validateScoreKeys(scores: Record<string, number>, criteria: EvaluationCriteria[]): { valid: boolean; errors: string[] };
  calculateWeightedScore(scores: Record<string, number>, criteria: EvaluationCriteria[]): number;

  // Evaluation
  submitEvaluation(input: { id: string; meeting_id: string; evaluator_seat_id: string; evaluator_persona_id: string; subject_seat_id: string; subject_persona_id: string; cultural_impact_score: number; creative_output_score: number; collaborative_spirit_score: number; strategic_vision_score: number; authenticity_score: number; weighted_score: number; notes: string }): Evaluation;
  getEvaluations(meetingId: string): AnonymousEvaluation[];
  getEvaluationsBySubject(subjectSeatId: string): AnonymousEvaluation[];
  getEvaluationsInternal(meetingId: string): Evaluation[];
  getEvaluationsBySubjectInternal(subjectSeatId: string): Evaluation[];
  getAggregateEvaluationScores(subjectSeatId: string, meetingId?: string): {
    subjectSeatId: string;
    meetingCount: number;
    averageWeightedScore: number;
    averageCulturalImpact: number;
    averageCreativeOutput: number;
    averageCollaborativeSpirit: number;
    averageStrategicVision: number;
    averageAuthenticity: number;
    evaluatorCount: number;
  };
  getReplaceableMemberMeetingCount(seatId: string): number;

  // Evaluation Criteria CRUD
  createEvaluationCriteria(input: { criterion_id: string; constitution_version: string; name: string; weight: number; description: string }): EvaluationCriteria;
  getEvaluationCriteria(constitutionVersion: string): EvaluationCriteria[];

  // Memory & Knowledge
  checkMemoryAccess(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, memory: MemoryEntry): boolean;
  buildPrivacyFilter(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }): { sql: string; values: any[] };
  createMemory(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: CreateMemoryInput): MemoryEntry;
  validateMemoryCreation(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: CreateMemoryInput): void;
  getMemoryById(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, memoryId: string): MemoryEntry | undefined;
  updateMemory(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: UpdateMemoryInput): MemoryEntry;
  getMemoryEntriesByCategory(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, category: MemoryCategory): MemoryEntry[];
  searchMemory(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: SearchMemoryInput): MemoryEntry[];
  createMemoryLink(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: LinkMemoryInput): MemoryLink;
  getRelated(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: GetRelatedInput): MemoryEntry[];
  logMemoryAccess(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, memoryId: string, accessType: string, version?: number): MemoryAccess;
  grantCrossDivisionAccess(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: GrantCrossDivisionAccessInput): CrossDivisionShare;
  revokeCrossDivisionAccess(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: RevokeCrossDivisionAccessInput): void;

  // Division Operations
  createDivision(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: CreateDivisionInput): Division;
  getDivisionById(divisionId: string): Division | undefined;
  listDivisions(): Division[];
  updateDivision(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: UpdateDivisionInput): Division;
  assignDivisionHead(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: AssignDivisionHeadInput): Division;
  listSpecialists(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: ListSpecialistsInput): StaffAgent[];

  // Staff Operations
  registerStaffAgent(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: RegisterStaffAgentInput): StaffAgent;
  getStaffAgentById(staffId: string): StaffAgent | undefined;
  listStaffAgents(): StaffAgent[];
  listStaffAgentsByDivision(divisionId: string): StaffAgent[];
  updateStaffStatus(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: UpdateStaffStatusInput): StaffAgent;
  updateStaffPermissions(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: UpdateStaffPermissionsInput): StaffAgent;
  suspendStaffAgent(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: SuspendStaffAgentInput): StaffAgent;
  retireStaffAgent(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: RetireStaffAgentInput): StaffAgent;

  // Division Members
  addDivisionMember(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: { division_id: string; staff_id: string; role: 'head' | 'member' | 'specialist' }): DivisionMember;
  getDivisionMembers(divisionId: string): DivisionMember[];
  getStaffDivisions(staffId: string): DivisionMember[];

  // Task Operations
  createTask(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: CreateTaskInput): Task;
  getTaskById(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, taskId: string): Task | undefined;
  listTasks(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: ListTasksInput): Task[];
  updateTask(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: UpdateTaskInput): Task;
  completeTask(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: CompleteTaskInput): Task;

  // Deliverable Operations
  createDeliverable(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: CreateDeliverableInput): Deliverable;
  getDeliverableById(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, deliverableId: string): Deliverable | undefined;
  listDeliverablesByTask(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: ListDeliverablesByTaskInput): Deliverable[];
  updateDeliverable(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: UpdateDeliverableInput): Deliverable;

  // Cross-Division Access
  requestCrossDivisionAccess(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: RequestCrossDivisionAccessInput): CrossDivisionShare;
  approveCrossDivisionAccess(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: ApproveCrossDivisionAccessInput): CrossDivisionShare;
  listPendingCrossDivisionRequests(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: ListPendingCrossDivisionRequestsInput): CrossDivisionShare[];

  // Phase 7: Autonomy & Execution
  createTaskAutonomyLevel(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: CreateTaskAutonomyLevelInput): TaskAutonomyLevel;
  getTaskAutonomyLevel(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, taskType: string): TaskAutonomyLevel | undefined;
  listTaskAutonomyLevels(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }): TaskAutonomyLevel[];
  updateTaskAutonomyLevel(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, taskType: string, autonomyLevel: AutonomyLevel, description?: string): TaskAutonomyLevel;

  requestExecution(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: RequestExecutionInput): ExecutionRequest;
  getExecutionRequest(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: GetExecutionRequestInput): ExecutionRequest;
  listExecutionRequests(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: ListExecutionRequestsInput): ExecutionRequest[];
  approveExecution(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: ApproveExecutionInput): { success: boolean; approval_request_id: string; status: string; execution_id?: string };
  executeExecutionRequest(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, executionId: string, resultPayload?: Record<string, any>): ExecutionRequest;
  cancelExecutionRequest(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, executionId: string): ExecutionRequest;
  getExecutionHistory(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: GetExecutionHistoryInput): ExecutionHistory[];
  listApprovalRequests(ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }, input: ListApprovalRequestsInput): ApprovalRequest[];
}

function createCouncilService(dbInstance: DatabaseInstance): CouncilService {
  const db = dbInstance;

  // Helper to map rows to types
  const toCouncilSeat = (row: any): CouncilSeat => ({ ...row, is_founder: Boolean(row.is_founder) });
  const toPersona = (row: any): Persona => row;
  const toConstitution = (row: any): Constitution => ({ ...row, approved_by_founder: Boolean(row.approved_by_founder) });
  const toFounderApproval = (row: any): FounderApproval => row;
  const toCandidate = (row: any): Candidate => row;
  const toFounderDeliberation = (row: any): FounderDeliberation => row;
  const toFounderVote = (row: any): FounderVote => row;
  const toMeeting = (row: any): Meeting => row;
  const toMeetingPhase = (row: any): MeetingPhase => row;
  const toPrimaryIdea = (row: any): PrimaryIdea => row;
  const toBrainstormRecord = (row: any): BrainstormRecord => row;
  const toChallenge = (row: any): Challenge => row;
  const toDefense = (row: any): Defense => row;
  const toSynthesis = (row: any): Synthesis => row;
  const toReassessment = (row: any): Reassessment => row;
  const toEvaluation = (row: any): Evaluation => row;
  const toAnonymousEvaluation = (row: any): AnonymousEvaluation => {
    const { evaluator_seat_id, evaluator_persona_id, ...rest } = row;
    return rest as AnonymousEvaluation;
  };
  const toEvaluationCriteria = (row: any): EvaluationCriteria => row;
  const toMemoryEntry = (row: any): MemoryEntry => row;
  const toMemoryVersion = (row: any): MemoryVersion => row;
  const toMemoryLink = (row: any): MemoryLink => row;
  const toMemoryAccess = (row: any): MemoryAccess => row;
  const toCrossDivisionShare = (row: any): CrossDivisionShare => row;
  const toDivision = (row: any): Division => row;
  const toStaffAgent = (row: any): StaffAgent => row;
  const toDivisionMember = (row: any): DivisionMember => row;
  const toTask = (row: any): Task => row;
  const toDeliverable = (row: any): Deliverable => row;
  const toTaskAutonomyLevel = (row: any): TaskAutonomyLevel => row;
  const toExecutionRequest = (row: any): ExecutionRequest => ({
    ...row,
    action_payload: row.action_payload ? JSON.parse(row.action_payload) : {},
    result_payload: row.result_payload ? JSON.parse(row.result_payload) : undefined,
    permission_grants: row.permission_grants ? JSON.parse(row.permission_grants) : [],
  });
  const toApprovalRequest = (row: any): ApprovalRequest => ({
    ...row,
    action_payload: row.action_payload ? JSON.parse(row.action_payload) : {},
  });
  const toExecutionHistory = (row: any): ExecutionHistory => ({
    ...row,
    action_payload: row.action_payload ? JSON.parse(row.action_payload) : {},
    result_payload: row.result_payload ? JSON.parse(row.result_payload) : undefined,
    permission_grants: row.permission_grants ? JSON.parse(row.permission_grants) : [],
  });

  // Valid meeting status transitions
  const validStatusTransitions: Record<string, string[]> = {
    preparing: ['deliberation', 'cancelled'],
    deliberation: ['primary_ideas', 'cancelled'],
    primary_ideas: ['brainstorming', 'cancelled'],
    brainstorming: ['challenges', 'cancelled'],
    challenges: ['synthesis', 'cancelled'],
    synthesis: ['reassessment', 'cancelled'],
    reassessment: ['evaluation', 'cancelled'],
    evaluation: ['closed', 'cancelled'],
    closed: ['archived', 'cancelled'],
    archived: [],
    cancelled: [],
  };

  const meetingPhases = [
    'preparation', 'founder_deliberation', 'primary_ideas', 'brainstorming',
    'challenges', 'synthesis', 'reassessment', 'evaluation', 'closure'
  ];

  const phaseToStatus: Record<string, string> = {
    preparation: 'preparing',
    founder_deliberation: 'deliberation',
    primary_ideas: 'primary_ideas',
    brainstorming: 'brainstorming',
    challenges: 'challenges',
    synthesis: 'synthesis',
    reassessment: 'reassessment',
    evaluation: 'evaluation',
  };

  return {
    // Council Seats
    createSeat(input) {
      const existing = db.query('SELECT * FROM council_seats WHERE seat_id = ?', [input.seat_id])[0];
      if (existing) throw new Error(`Seat with ID '${input.seat_id}' already exists`);
      db.runPreparedStatement('insertSeat', [
        input.seat_id, input.name, input.status,
        input.is_founder ? 1 : 0, input.description
      ]);
      return toCouncilSeat(db.query('SELECT * FROM council_seats WHERE seat_id = ?', [input.seat_id])[0]);
    },

    getSeat(seatId) {
      const row = db.query('SELECT * FROM council_seats WHERE seat_id = ?', [seatId])[0];
      return row ? toCouncilSeat(row) : undefined;
    },

    listSeats() {
      return (db.query('SELECT * FROM council_seats ORDER BY seat_id', []) as any[]).map(toCouncilSeat);
    },

    updateSeatStatus(seatId, status) {
      const seat = this.getSeat(seatId);
      if (!seat) throw new Error(`Seat '${seatId}' not found`);
      if (seat.is_founder && status !== 'permanent') {
        throw new Error('Founder seats cannot change status from permanent');
      }
      db.runPreparedStatement('updateSeatStatus', [status, seatId]);
      return this.getSeat(seatId) as CouncilSeat;
    },

    // Personas
    createPersona(input) {
      const seat = this.getSeat(input.seat_id);
      if (!seat) throw new Error(`Seat '${input.seat_id}' not found`);
      const existing = db.query('SELECT * FROM personas WHERE persona_id = ?', [input.persona_id])[0];
      if (existing) throw new Error(`Persona with ID '${input.persona_id}' already exists`);
      db.runPreparedStatement('insertPersona', [
        input.persona_id, input.seat_id, input.name, input.description, input.traits
      ]);
      return toPersona(db.query('SELECT * FROM personas WHERE persona_id = ?', [input.persona_id])[0]);
    },

    getPersona(personaId) {
      const row = db.query('SELECT * FROM personas WHERE persona_id = ?', [personaId])[0];
      return row ? toPersona(row) : undefined;
    },

    listPersonasBySeat(seatId) {
      return (db.query('SELECT * FROM personas WHERE seat_id = ?', [seatId]) as any[]).map(toPersona);
    },

    listAllPersonas() {
      return (db.query('SELECT * FROM personas', []) as any[]).map(toPersona);
    },

    getPersonaBySeat(seatId) {
      const personas = this.listPersonasBySeat(seatId);
      return personas[0];
    },

    // Runtime Personas
    assignPersonaToRuntime(runtime, personaId) {
      const persona = this.getPersona(personaId);
      if (!persona) throw new Error(`Persona '${personaId}' not found`);
      db.runPreparedStatement('insertRuntimePersona', [runtime, personaId]);
      return { runtime, persona_id: personaId };
    },

    removePersonaFromRuntime(runtime, personaId) {
      db.runPreparedStatement('deleteRuntimePersona', [runtime, personaId]);
    },

    getRuntimePersonas(runtime) {
      const runtimePersonas = db.query('SELECT * FROM runtime_personas WHERE runtime = ?', [runtime]) as { runtime: string; persona_id: string }[];
      const personas: Persona[] = [];
      for (const rp of runtimePersonas) {
        const p = this.getPersona(rp.persona_id);
        if (p) personas.push(p);
      }
      return personas;
    },

    // Shared identity retrieval
    getAllSeatsWithPersonas() {
      const seats = this.listSeats();
      return seats.map(seat => {
        const persona = this.getPersonaBySeat(seat.seat_id);
        return { ...seat, persona: persona ?? null };
      });
    },

    getRuntimePersonasWithSeats(runtime) {
      const runtimePersonas = this.getRuntimePersonas(runtime);
      return runtimePersonas.map(persona => {
        const seat = this.getSeat(persona.seat_id) as CouncilSeat;
        return { ...persona, seat };
      });
    },

    // Constitution
    createConstitution(input) {
      const existing = db.query('SELECT * FROM constitutions WHERE version = ?', [input.version])[0];
      if (existing) throw new Error(`Constitution version '${input.version}' already exists`);
      db.runPreparedStatement('insertConstitution', [
        input.version, input.content, input.status, input.approved_by_founder ? 1 : 0
      ]);
      return toConstitution(db.query('SELECT * FROM constitutions WHERE version = ?', [input.version])[0]);
    },

    getConstitution(version) {
      const row = db.query('SELECT * FROM constitutions WHERE version = ?', [version])[0];
      return row ? toConstitution(row) : undefined;
    },

    getActiveConstitution() {
      const row = db.query('SELECT * FROM constitutions WHERE status = ?', ['active'])[0];
      return row ? toConstitution(row) : undefined;
    },

    listConstitutions() {
      return (db.query('SELECT * FROM constitutions', []) as any[]).map(toConstitution);
    },

    updateConstitutionStatus(version, status) {
      const constitution = this.getConstitution(version);
      if (!constitution) throw new Error(`Constitution version '${version}' not found`);
      db.runPreparedStatement('updateConstitutionStatus', [status, version]);
      return this.getConstitution(version) as Constitution;
    },

    // Founder Approvals
    recordFounderApproval(input) {
      const constitution = this.getConstitution(input.constitution_version);
      if (!constitution) throw new Error(`Constitution version '${input.constitution_version}' not found`);
      db.runPreparedStatement('insertFounderApproval', [
        input.id, input.constitution_version, input.decision, input.notes
      ]);
      const approvals = db.query('SELECT * FROM founder_approvals WHERE constitution_version = ?', [input.constitution_version]) as any[];
      return toFounderApproval(approvals[0]);
    },

    listFounderApprovals(version) {
      return (db.query('SELECT * FROM founder_approvals WHERE constitution_version = ?', [version]) as any[]).map(toFounderApproval);
    },

    getLatestFounderDecision(version) {
      const approvals = this.listFounderApprovals(version);
      return approvals[0];
    },

    // Validation
    validateRuntimeIdentity(runtime) {
      const issues: string[] = [];
      const allSeats = this.listSeats();
      if (allSeats.length !== 11) issues.push(`Expected 11 seats, found ${allSeats.length}`);
      const permanentSeats = allSeats.filter(s => s.status === 'permanent');
      if (permanentSeats.length !== 4) issues.push(`Expected 4 permanent seats, found ${permanentSeats.length}`);
      const runtimePersonas = this.getRuntimePersonas(runtime);
      for (const seat of permanentSeats) {
        const persona = this.getPersonaBySeat(seat.seat_id);
        if (persona && !runtimePersonas.some(p => p.persona_id === persona.persona_id)) {
          issues.push(`Runtime '${runtime}' missing persona for permanent seat '${seat.seat_id}'`);
        }
      }
      const allPersonas = this.listAllPersonas();
      for (const persona of allPersonas) {
        if (!runtimePersonas.some(p => p.persona_id === persona.persona_id)) {
          issues.push(`Runtime '${runtime}' missing persona '${persona.persona_id}' (seat: ${persona.seat_id})`);
        }
      }
      return { valid: issues.length === 0, issues };
    },

    // Candidates
    createCandidate(input) {
      const seat = this.getSeat(input.proposed_seat_id);
      if (!seat) throw new Error(`Proposed seat '${input.proposed_seat_id}' not found`);
      if (seat.status !== 'vacant') throw new Error(`Seat '${input.proposed_seat_id}' is not vacant (status: ${seat.status})`);
      const proposer = this.getSeat(input.proposed_by_founder_seat_id);
      if (!proposer || !proposer.is_founder) throw new Error(`Proposer must be a founder seat, got '${input.proposed_by_founder_seat_id}'`);
      const existing = db.query('SELECT * FROM candidates WHERE candidate_id = ?', [input.candidate_id])[0];
      if (existing) throw new Error(`Candidate with ID '${input.candidate_id}' already exists`);
      db.runPreparedStatement('insertCandidate', [
        input.candidate_id, input.name, input.description, input.traits,
        input.proposed_seat_id, input.status, input.proposed_by_founder_seat_id
      ]);
      return toCandidate(db.query('SELECT * FROM candidates WHERE candidate_id = ?', [input.candidate_id])[0]);
    },

    getCandidate(candidateId) {
      const row = db.query('SELECT * FROM candidates WHERE candidate_id = ?', [candidateId])[0];
      return row ? toCandidate(row) : undefined;
    },

    listCandidates() {
      return (db.query('SELECT * FROM candidates', []) as any[]).map(toCandidate);
    },

    updateCandidateStatus(candidateId, status) {
      const candidate = this.getCandidate(candidateId);
      if (!candidate) throw new Error(`Candidate '${candidateId}' not found`);
      db.runPreparedStatement('updateCandidateStatus', [status, candidateId]);
      return this.getCandidate(candidateId) as Candidate;
    },

    // Founder Deliberation
    recordFounderDeliberation(input) {
      const candidate = this.getCandidate(input.candidate_id);
      if (!candidate) throw new Error(`Candidate '${input.candidate_id}' not found`);
      const founder = this.getSeat(input.founder_seat_id);
      if (!founder || !founder.is_founder) throw new Error(`Founder seat '${input.founder_seat_id}' not found or not a founder`);
      db.runPreparedStatement('insertFounderDeliberation', [
        input.id, input.candidate_id, input.founder_seat_id, input.content
      ]);
      const deliberations = db.query('SELECT * FROM founder_deliberations WHERE candidate_id = ?', [input.candidate_id]) as any[];
      return toFounderDeliberation(deliberations[deliberations.length - 1]);
    },

    getFounderDeliberations(candidateId) {
      return (db.query('SELECT * FROM founder_deliberations WHERE candidate_id = ?', [candidateId]) as any[]).map(toFounderDeliberation);
    },

    // Founder Votes
    recordFounderVote(input) {
      const candidate = this.getCandidate(input.candidate_id);
      if (!candidate) throw new Error(`Candidate '${input.candidate_id}' not found`);
      const founder = this.getSeat(input.founder_seat_id);
      if (!founder || !founder.is_founder) throw new Error(`Founder seat '${input.founder_seat_id}' not found or not a founder`);
      db.runPreparedStatement('insertFounderVote', [
        input.id, input.candidate_id, input.founder_seat_id, input.vote, input.notes
      ]);
      const votes = db.query('SELECT * FROM founder_votes WHERE candidate_id = ?', [input.candidate_id]) as any[];
      return toFounderVote(votes[votes.length - 1]);
    },

    getFounderVotes(candidateId) {
      return (db.query('SELECT * FROM founder_votes WHERE candidate_id = ?', [candidateId]) as any[]).map(toFounderVote);
    },

    getCandidateVoteSummary(candidateId) {
      const votes = this.getFounderVotes(candidateId);
      const counts = { yes: 0, no: 0, abstain: 0 };
      for (const vote of votes) counts[vote.vote]++;
      return { ...counts, approved: counts.yes >= 3 };
    },

    // Candidate Approval
    approveCandidate(candidateId) {
      const summary = this.getCandidateVoteSummary(candidateId);
      if (!summary.approved) throw new Error(`Candidate requires at least 3 of 4 founder votes (currently ${summary.yes} yes)`);
      return this.updateCandidateStatus(candidateId, 'approved');
    },

    rejectCandidate(candidateId) {
      return this.updateCandidateStatus(candidateId, 'rejected');
    },

    seatApprovedCandidate(candidateId) {
      db.runPreparedStatement('beginTransaction', []);
      try {
        const candidate = this.getCandidate(candidateId);
        if (!candidate) throw new Error(`Candidate '${candidateId}' not found`);
        if (candidate.status !== 'approved') throw new Error(`Candidate '${candidateId}' is not approved (status: ${candidate.status})`);
        const seat = this.getSeat(candidate.proposed_seat_id);
        if (!seat) throw new Error(`Seat '${candidate.proposed_seat_id}' not found`);
        if (seat.status !== 'vacant') throw new Error(`Seat '${candidate.proposed_seat_id}' is no longer vacant`);
        const personaId = `persona-${candidate.name.toLowerCase().replace(/\s+/g, '-')}`;
        const existingPersona = db.query('SELECT * FROM personas WHERE persona_id = ?', [personaId])[0];
        if (existingPersona) throw new Error(`Persona with ID '${personaId}' already exists`);
        const persona = this.createPersona({
          persona_id: personaId,
          seat_id: seat.seat_id,
          name: candidate.name,
          description: candidate.description,
          traits: candidate.traits,
        });
        const updatedSeat = this.updateSeatStatus(seat.seat_id, 'replaceable');
        for (const runtime of ['claude', 'hermes']) this.assignPersonaToRuntime(runtime, persona.persona_id);
        db.runPreparedStatement('commitTransaction', []);
        return { candidate, persona, seat: updatedSeat };
      } catch (error) {
        db.runPreparedStatement('rollbackTransaction', []);
        throw error;
      }
    },

    // Meetings
    createMeeting(input) {
      const existing = db.query('SELECT * FROM meetings WHERE meeting_id = ?', [input.meeting_id])[0];
      if (existing) throw new Error(`Meeting with ID '${input.meeting_id}' already exists`);
      const constitution = this.getConstitution(input.constitution_version);
      if (!constitution) throw new Error(`Constitution version '${input.constitution_version}' not found`);
      const meetings = this.listMeetings();
      const nextNumber = input.number || (meetings.length > 0 ? Math.max(...meetings.map(m => m.number)) + 1 : 1);
      db.runPreparedStatement('insertMeeting', [
        input.meeting_id, nextNumber, input.status, input.constitution_version,
        input.started_at ?? null, input.closed_at ?? null
      ]);
      const meeting = toMeeting(db.query('SELECT * FROM meetings WHERE meeting_id = ?', [input.meeting_id])[0]);
      for (const phase of meetingPhases) {
        db.runPreparedStatement('insertMeetingPhase', [
          crypto.randomUUID(), meeting.meeting_id, phase, 'pending', null, null
        ]);
      }
      return meeting;
    },

    getMeeting(meetingId) {
      const row = db.query('SELECT * FROM meetings WHERE meeting_id = ?', [meetingId])[0];
      return row ? toMeeting(row) : undefined;
    },

    listMeetings() {
      return (db.query('SELECT * FROM meetings', []) as any[]).map(toMeeting);
    },

    updateMeetingStatus(meetingId, status) {
      const meeting = this.getMeeting(meetingId);
      if (!meeting) throw new Error(`Meeting '${meetingId}' not found`);
      if (meeting.status === 'archived' || meeting.status === 'cancelled') throw new Error(`Cannot modify ${meeting.status} meeting`);
      const validNext = validStatusTransitions[meeting.status] || [];
      if (!validNext.includes(status)) throw new Error(`Invalid meeting status transition: ${meeting.status} -> ${status}`);
      if (status === 'closed' || status === 'archived') {
        const phases = this.getMeetingPhases(meetingId);
        const incompleteRequired = phases.filter(p => p.status !== 'completed' && p.status !== 'skipped');
        if (incompleteRequired.length > 0) {
          throw new Error(`Cannot close meeting: required phases incomplete: ${incompleteRequired.map(p => p.phase).join(', ')}`);
        }
      }
      db.runPreparedStatement('updateMeetingStatus', [status, status, meetingId]);
      return this.getMeeting(meetingId) as Meeting;
    },

    getMeetingPhases(meetingId) {
      return (db.query('SELECT * FROM meeting_phases WHERE meeting_id = ?', [meetingId]) as any[]).map(toMeetingPhase);
    },

    startMeetingPhase(meetingId, phase) {
      const meeting = this.getMeeting(meetingId);
      if (!meeting) throw new Error(`Meeting '${meetingId}' not found`);
      if (meeting.status === 'archived' || meeting.status === 'cancelled') throw new Error(`Cannot start phase in ${meeting.status} meeting`);
      const phases = this.getMeetingPhases(meetingId);
      const targetPhase = phases.find(p => p.phase === phase);
      if (!targetPhase) throw new Error(`Phase '${phase}' not found for meeting '${meetingId}'`);
      if (targetPhase.status !== 'pending') throw new Error(`Phase '${phase}' is already ${targetPhase.status}`);
      const phaseIndex = meetingPhases.indexOf(phase);
      for (let i = 0; i < phaseIndex; i++) {
        const prevPhase = phases.find(p => p.phase === meetingPhases[i]);
        if (prevPhase && prevPhase.status !== 'completed' && prevPhase.status !== 'skipped') {
          throw new Error(`Cannot start phase '${phase}': preceding phase '${meetingPhases[i]}' is ${prevPhase.status}`);
        }
      }
      const expectedStatus = phaseToStatus[phase];
      if (expectedStatus && meeting.status !== expectedStatus) this.updateMeetingStatus(meetingId, expectedStatus);
      db.runPreparedStatement('updateMeetingPhase', ['active', 'active', meetingId, phase]);
      const updatedPhases = this.getMeetingPhases(meetingId);
      return updatedPhases.find(p => p.phase === phase) as MeetingPhase;
    },

    completeMeetingPhase(meetingId, phase) {
      const meeting = this.getMeeting(meetingId);
      if (!meeting) throw new Error(`Meeting '${meetingId}' not found`);
      if (meeting.status === 'archived' || meeting.status === 'cancelled') throw new Error(`Cannot complete phase in ${meeting.status} meeting`);
      const phases = this.getMeetingPhases(meetingId);
      const targetPhase = phases.find(p => p.phase === phase);
      if (!targetPhase) throw new Error(`Phase '${phase}' not found for meeting '${meetingId}'`);
      if (targetPhase.status !== 'active') throw new Error(`Cannot complete phase '${phase}': not active (status: ${targetPhase.status})`);
      db.runPreparedStatement('updateMeetingPhase', ['completed', 'completed', meetingId, phase]);
      if (phase === 'closure') this.updateMeetingStatus(meetingId, 'closed');
      const updatedPhases = this.getMeetingPhases(meetingId);
      return updatedPhases.find(p => p.phase === phase) as MeetingPhase;
    },

    // Primary Ideas
    submitPrimaryIdea(input) {
      const meeting = this.getMeeting(input.meeting_id);
      if (!meeting) throw new Error(`Meeting '${input.meeting_id}' not found`);
      if (meeting.status === 'archived' || meeting.status === 'cancelled') throw new Error(`Cannot submit primary idea in ${meeting.status} meeting`);
      const seat = this.getSeat(input.seat_id);
      if (!seat) throw new Error(`Seat '${input.seat_id}' not found`);
      if (seat.status === 'vacant') throw new Error(`Vacant seat '${input.seat_id}' cannot submit primary ideas`);
      const persona = this.getPersona(input.persona_id);
      if (!persona || persona.seat_id !== input.seat_id) throw new Error(`Persona '${input.persona_id}' does not belong to seat '${input.seat_id}'`);
      const existing = db.query('SELECT * FROM primary_ideas WHERE meeting_id = ? AND seat_id = ?', [input.meeting_id, input.seat_id])[0];
      if (existing) throw new Error(`Seat '${input.seat_id}' already submitted a primary idea for meeting '${input.meeting_id}'`);
      db.runPreparedStatement('insertPrimaryIdea', [input.id, input.meeting_id, input.seat_id, input.persona_id, input.content]);
      return toPrimaryIdea(db.query('SELECT * FROM primary_ideas WHERE meeting_id = ? AND seat_id = ?', [input.meeting_id, input.seat_id])[0]);
    },

    getPrimaryIdeas(meetingId) {
      return (db.query('SELECT * FROM primary_ideas WHERE meeting_id = ?', [meetingId]) as any[]).map(toPrimaryIdea);
    },

    // Brainstorming
    recordBrainstorm(input) {
      const meeting = this.getMeeting(input.meeting_id);
      if (!meeting) throw new Error(`Meeting '${input.meeting_id}' not found`);
      if (meeting.status === 'archived' || meeting.status === 'cancelled') throw new Error(`Cannot record brainstorm in ${meeting.status} meeting`);
      const seat = this.getSeat(input.seat_id);
      if (!seat) throw new Error(`Seat '${input.seat_id}' not found`);
      if (seat.status === 'vacant') throw new Error(`Vacant seat '${input.seat_id}' cannot brainstorm`);
      const persona = this.getPersona(input.persona_id);
      if (!persona || persona.seat_id !== input.seat_id) throw new Error(`Persona '${input.persona_id}' does not belong to seat '${input.seat_id}'`);
      db.runPreparedStatement('insertBrainstormRecord', [input.id, input.meeting_id, input.seat_id, input.persona_id, input.content]);
      const records = db.query('SELECT * FROM brainstorm_records WHERE meeting_id = ?', [input.meeting_id]) as any[];
      return toBrainstormRecord(records[records.length - 1]);
    },

    getBrainstormRecords(meetingId) {
      return (db.query('SELECT * FROM brainstorm_records WHERE meeting_id = ?', [meetingId]) as any[]).map(toBrainstormRecord);
    },

    // Challenges
    recordChallenge(input) {
      const meeting = this.getMeeting(input.meeting_id);
      if (!meeting) throw new Error(`Meeting '${input.meeting_id}' not found`);
      if (meeting.status === 'archived' || meeting.status === 'cancelled') throw new Error(`Cannot record challenge in ${meeting.status} meeting`);
      const challengerSeat = this.getSeat(input.challenger_seat_id);
      if (!challengerSeat || challengerSeat.status === 'vacant') throw new Error(`Challenger seat '${input.challenger_seat_id}' not found or vacant`);
      const targetSeat = this.getSeat(input.target_seat_id);
      if (!targetSeat || targetSeat.status === 'vacant') throw new Error(`Target seat '${input.target_seat_id}' not found or vacant`);
      const challengerPersona = this.getPersona(input.challenger_persona_id);
      if (!challengerPersona || challengerPersona.seat_id !== input.challenger_seat_id) throw new Error(`Challenger persona mismatch`);
      const targetPersona = this.getPersona(input.target_persona_id);
      if (!targetPersona || targetPersona.seat_id !== input.target_seat_id) throw new Error(`Target persona mismatch`);
      db.runPreparedStatement('insertChallenge', [
        input.id, input.meeting_id, input.challenger_seat_id, input.challenger_persona_id,
        input.target_seat_id, input.target_persona_id, input.content
      ]);
      const challenges = db.query('SELECT * FROM challenges WHERE meeting_id = ?', [input.meeting_id]) as any[];
      return toChallenge(challenges[challenges.length - 1]);
    },

    getChallenges(meetingId) {
      return (db.query('SELECT * FROM challenges WHERE meeting_id = ?', [meetingId]) as any[]).map(toChallenge);
    },

    // Defenses
    recordDefense(input) {
      const meeting = this.getMeeting(input.meeting_id);
      if (!meeting) throw new Error(`Meeting '${input.meeting_id}' not found`);
      if (meeting.status === 'archived' || meeting.status === 'cancelled') throw new Error(`Cannot record defense in ${meeting.status} meeting`);
      const challenges = db.query('SELECT * FROM challenges WHERE meeting_id = ?', [input.meeting_id]) as Challenge[];
      const challenge = challenges.find(c => c.id === input.challenge_id);
      if (!challenge) throw new Error(`Challenge '${input.challenge_id}' not found in meeting '${input.meeting_id}'`);
      const defenderSeat = this.getSeat(input.defender_seat_id);
      if (!defenderSeat || defenderSeat.status === 'vacant') throw new Error(`Defender seat '${input.defender_seat_id}' not found or vacant`);
      const defenderPersona = this.getPersona(input.defender_persona_id);
      if (!defenderPersona || defenderPersona.seat_id !== input.defender_seat_id) throw new Error(`Defender persona mismatch`);
      if (input.defender_seat_id !== challenge.target_seat_id) throw new Error(`Only the challenge target can defend`);
      db.runPreparedStatement('insertDefense', [
        input.id, input.meeting_id, input.challenge_id, input.defender_seat_id,
        input.defender_persona_id, input.content
      ]);
      const defenses = db.query('SELECT * FROM defenses WHERE meeting_id = ?', [input.meeting_id]) as any[];
      return toDefense(defenses[defenses.length - 1]);
    },

    getDefenses(meetingId) {
      return (db.query('SELECT * FROM defenses WHERE meeting_id = ?', [meetingId]) as any[]).map(toDefense);
    },

    // Synthesis
    recordSynthesis(input) {
      const meeting = this.getMeeting(input.meeting_id);
      if (!meeting) throw new Error(`Meeting '${input.meeting_id}' not found`);
      if (meeting.status === 'archived' || meeting.status === 'cancelled') throw new Error(`Cannot record synthesis in ${meeting.status} meeting`);
      const seat = this.getSeat(input.seat_id);
      if (!seat || seat.status === 'vacant') throw new Error(`Seat '${input.seat_id}' not found or vacant`);
      const persona = this.getPersona(input.persona_id);
      if (!persona || persona.seat_id !== input.seat_id) throw new Error(`Persona '${input.persona_id}' does not belong to seat '${input.seat_id}'`);
      db.runPreparedStatement('insertSynthesis', [input.id, input.meeting_id, input.seat_id, input.persona_id, input.content]);
      const syntheses = db.query('SELECT * FROM syntheses WHERE meeting_id = ?', [input.meeting_id]) as any[];
      return toSynthesis(syntheses[syntheses.length - 1]);
    },

    getSyntheses(meetingId) {
      return (db.query('SELECT * FROM syntheses WHERE meeting_id = ?', [meetingId]) as any[]).map(toSynthesis);
    },

    // Reassessment
    recordReassessment(input) {
      const meeting = this.getMeeting(input.meeting_id);
      if (!meeting) throw new Error(`Meeting '${input.meeting_id}' not found`);
      if (meeting.status === 'archived' || meeting.status === 'cancelled') throw new Error(`Cannot record reassessment in ${meeting.status} meeting`);
      const seat = this.getSeat(input.seat_id);
      if (!seat || seat.status === 'vacant') throw new Error(`Seat '${input.seat_id}' not found or vacant`);
      const targetSeat = this.getSeat(input.target_seat_id);
      if (!targetSeat || targetSeat.status === 'vacant') throw new Error(`Target seat '${input.target_seat_id}' not found or vacant`);
      const persona = this.getPersona(input.persona_id);
      if (!persona || persona.seat_id !== input.seat_id) throw new Error(`Persona '${input.persona_id}' does not belong to seat '${input.seat_id}'`);
      db.runPreparedStatement('insertReassessment', [
        input.id, input.meeting_id, input.seat_id, input.persona_id,
        input.target_seat_id, input.content
      ]);
      const reassessments = db.query('SELECT * FROM reassessments WHERE meeting_id = ?', [input.meeting_id]) as any[];
      return toReassessment(reassessments[reassessments.length - 1]);
    },

    getReassessments(meetingId) {
      return (db.query('SELECT * FROM reassessments WHERE meeting_id = ?', [meetingId]) as any[]).map(toReassessment);
    },

    // Evaluation Criteria
    getEvaluationCriteriaForConstitution(constitutionVersion) {
      return (db.query('SELECT * FROM evaluation_criteria WHERE constitution_version = ?', [constitutionVersion]) as any[]).map(toEvaluationCriteria);
    },

    criterionNameToScoreKey(criterionName) {
      return criterionName.toLowerCase().replace(/\s+/g, '_');
    },

    validateScoreKeys(scores, criteria) {
      const errors: string[] = [];
      const expectedKeys = new Set(criteria.map(c => this.criterionNameToScoreKey(c.name)));
      const providedKeys = new Set(Object.keys(scores));
      for (const key of expectedKeys) if (!providedKeys.has(key)) errors.push(`Missing score for criterion: ${key}`);
      for (const key of providedKeys) if (!expectedKeys.has(key)) errors.push(`Unknown score key: ${key}`);
      const keyCounts = new Map<string, number>();
      for (const c of criteria) {
        const key = this.criterionNameToScoreKey(c.name);
        keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
      }
      for (const [key, count] of keyCounts) if (count > 1) errors.push(`Duplicate criterion mapping to key: ${key}`);
      for (const [key, value] of Object.entries(scores)) {
        if (typeof value !== 'number' || value < 1 || value > 10 || !Number.isInteger(value)) {
          errors.push(`Invalid score for ${key}: must be integer 1-10, got ${value}`);
        }
      }
      return { valid: errors.length === 0, errors };
    },

    calculateWeightedScore(scores, criteria) {
      if (criteria.length === 0) {
        const defaultScores = {
          cultural_impact: scores.cultural_impact ?? 0,
          creative_output: scores.creative_output ?? 0,
          collaborative_spirit: scores.collaborative_spirit ?? 0,
          strategic_vision: scores.strategic_vision ?? 0,
          authenticity: scores.authenticity ?? 0,
        };
        return defaultScores.cultural_impact * 0.30 + defaultScores.creative_output * 0.25 +
          defaultScores.collaborative_spirit * 0.20 + defaultScores.strategic_vision * 0.15 + defaultScores.authenticity * 0.10;
      }
      const validation = this.validateScoreKeys(scores, criteria);
      if (!validation.valid) throw new Error(`Score validation failed: ${validation.errors.join('; ')}`);
      let totalWeight = 0, weightedSum = 0;
      for (const c of criteria) {
        const key = this.criterionNameToScoreKey(c.name);
        const score = scores[key];
        if (typeof score === 'number') { weightedSum += score * c.weight; totalWeight += c.weight; }
      }
      return totalWeight > 0 ? weightedSum / totalWeight : 0;
    },

    // Evaluation
    submitEvaluation(input) {
      const meeting = this.getMeeting(input.meeting_id);
      if (!meeting) throw new Error(`Meeting '${input.meeting_id}' not found`);
      if (meeting.status === 'archived' || meeting.status === 'cancelled') throw new Error(`Cannot submit evaluation in ${meeting.status} meeting`);
      const evaluatorSeat = this.getSeat(input.evaluator_seat_id);
      if (!evaluatorSeat || evaluatorSeat.status === 'vacant') throw new Error(`Evaluator seat '${input.evaluator_seat_id}' not found or vacant`);
      const subjectSeat = this.getSeat(input.subject_seat_id);
      if (!subjectSeat || subjectSeat.status === 'vacant') throw new Error(`Subject seat '${input.subject_seat_id}' not found or vacant`);
      if (input.evaluator_seat_id === input.subject_seat_id) throw new Error(`Members cannot evaluate themselves`);
      const evaluatorPersona = this.getPersona(input.evaluator_persona_id);
      if (!evaluatorPersona || evaluatorPersona.seat_id !== input.evaluator_seat_id) throw new Error(`Evaluator persona mismatch`);
      const subjectPersona = this.getPersona(input.subject_persona_id);
      if (!subjectPersona || subjectPersona.seat_id !== input.subject_seat_id) throw new Error(`Subject persona mismatch`);
      if (subjectSeat.status !== 'replaceable') throw new Error(`Only replaceable members can be evaluated (subject seat status: ${subjectSeat.status})`);
      const criteria = this.getEvaluationCriteriaForConstitution(meeting.constitution_version);
      const scores = {
        cultural_impact: input.cultural_impact_score,
        creative_output: input.creative_output_score,
        collaborative_spirit: input.collaborative_spirit_score,
        strategic_vision: input.strategic_vision_score,
        authenticity: input.authenticity_score,
      };
      const weightedScore = this.calculateWeightedScore(scores, criteria);
      const existing = db.query('SELECT * FROM evaluations WHERE meeting_id = ? AND evaluator_seat_id = ? AND subject_seat_id = ?', [input.meeting_id, input.evaluator_seat_id, input.subject_seat_id])[0];
      if (existing) throw new Error(`Evaluator '${input.evaluator_seat_id}' has already evaluated subject '${input.subject_seat_id}' for this meeting`);
      db.runPreparedStatement('insertEvaluation', [
        input.id, input.meeting_id, input.evaluator_seat_id, input.evaluator_persona_id,
        input.subject_seat_id, input.subject_persona_id, input.cultural_impact_score,
        input.creative_output_score, input.collaborative_spirit_score, input.strategic_vision_score,
        input.authenticity_score, weightedScore, input.notes
      ]);
      return toEvaluation(db.query('SELECT * FROM evaluations WHERE meeting_id = ? AND evaluator_seat_id = ? AND subject_seat_id = ?', [input.meeting_id, input.evaluator_seat_id, input.subject_seat_id])[0]);
    },

    getEvaluations(meetingId) {
      return (db.query('SELECT * FROM evaluations WHERE meeting_id = ?', [meetingId]) as any[]).map(toAnonymousEvaluation);
    },

    getEvaluationsBySubject(subjectSeatId) {
      return (db.query('SELECT * FROM evaluations WHERE subject_seat_id = ?', [subjectSeatId]) as any[]).map(toAnonymousEvaluation);
    },

    getEvaluationsInternal(meetingId) {
      return (db.query('SELECT * FROM evaluations WHERE meeting_id = ?', [meetingId]) as any[]).map(toEvaluation);
    },

    getEvaluationsBySubjectInternal(subjectSeatId) {
      return (db.query('SELECT * FROM evaluations WHERE subject_seat_id = ?', [subjectSeatId]) as any[]).map(toEvaluation);
    },

    getAggregateEvaluationScores(subjectSeatId, meetingId) {
      const evaluations = meetingId
        ? this.getEvaluationsInternal(meetingId).filter(e => e.subject_seat_id === subjectSeatId)
        : this.getEvaluationsBySubjectInternal(subjectSeatId);
      if (evaluations.length === 0) return { subjectSeatId, meetingCount: 0, averageWeightedScore: 0, averageCulturalImpact: 0, averageCreativeOutput: 0, averageCollaborativeSpirit: 0, averageStrategicVision: 0, averageAuthenticity: 0, evaluatorCount: 0 };
      const sum = evaluations.reduce((acc, e) => ({
        weighted: acc.weighted + e.weighted_score, cultural: acc.cultural + e.cultural_impact_score,
        creative: acc.creative + e.creative_output_score, collaborative: acc.collaborative + e.collaborative_spirit_score,
        strategic: acc.strategic + e.strategic_vision_score, authenticity: acc.authenticity + e.authenticity_score,
      }), { weighted: 0, cultural: 0, creative: 0, collaborative: 0, strategic: 0, authenticity: 0 });
      const count = evaluations.length;
      const meetingIds = new Set(evaluations.map(e => e.meeting_id));
      return { subjectSeatId, meetingCount: meetingIds.size, averageWeightedScore: sum.weighted / count, averageCulturalImpact: sum.cultural / count, averageCreativeOutput: sum.creative / count, averageCollaborativeSpirit: sum.collaborative / count, averageStrategicVision: sum.strategic / count, averageAuthenticity: sum.authenticity / count, evaluatorCount: new Set(evaluations.map(e => e.evaluator_seat_id)).size };
    },

    getReplaceableMemberMeetingCount(seatId) {
      const seat = this.getSeat(seatId);
      if (!seat || seat.status !== 'replaceable') return 0;
      const meetingIds = new Set(
        this.getEvaluationsBySubjectInternal(seatId)
          .filter((evaluation) => {
            const meeting = this.getMeeting(evaluation.meeting_id);
            return meeting?.status === 'closed' || meeting?.status === 'archived';
          })
          .map((evaluation) => evaluation.meeting_id)
      );
      return meetingIds.size;
    },

    // Evaluation Criteria CRUD
    createEvaluationCriteria(input) {
      const constitution = this.getConstitution(input.constitution_version);
      if (!constitution) throw new Error(`Constitution version '${input.constitution_version}' not found`);
      const existingCriteria = this.getEvaluationCriteria(input.constitution_version);
      const totalWeight = existingCriteria.reduce((sum, c) => sum + c.weight, 0) + input.weight;
      if (totalWeight > 1.0 + 0.001) throw new Error(`Total criteria weight would exceed 100%`);
      db.runPreparedStatement('insertEvaluationCriteria', [input.criterion_id, input.constitution_version, input.name, input.weight, input.description]);
      const criteria = db.query('SELECT * FROM evaluation_criteria WHERE constitution_version = ?', [input.constitution_version]) as any[];
      return toEvaluationCriteria(criteria.find((c: any) => c.criterion_id === input.criterion_id));
    },

    getEvaluationCriteria(constitutionVersion) {
      return (db.query('SELECT * FROM evaluation_criteria WHERE constitution_version = ?', [constitutionVersion]) as any[]).map(toEvaluationCriteria);
    },

    // Memory & Knowledge
    checkMemoryAccess(ctx, memory) {
      return ops.checkMemoryAccess(ctx, memory, db);
    },

    buildPrivacyFilter(ctx) {
      if (!ctx || !ctx.owner_type || !ctx.owner_id || !ctx.runtime) throw new Error('Authentication required');
      return ops.buildPrivacyFilter(ctx);
    },

    createMemory(ctx, input) {
      this.validateMemoryCreation(ctx, input);
      const memoryId = db.generateId();
      db.runPreparedStatement('beginTransaction', []);
      try {
        const memory = mem.createMemory(db, {
          memory_id: memoryId,
          owner_type: ctx.owner_type,
          owner_id: ctx.owner_id,
          category: input.category,
          memory_type: input.memory_type,
          title: input.title,
          content: JSON.stringify(input.content),
          tags: input.tags,
          confidence: input.confidence,
          meeting_id: input.meeting_id,
          division_id: input.division_id,
          task_id: input.task_id,
        });
        mem.createMemoryVersion(db, {
          version_id: db.generateId(),
          memory_id: memoryId,
          version_num: 1,
          title: input.title,
          content: JSON.stringify(input.content),
          tags: input.tags ?? [],
          confidence: input.confidence ?? 1.0,
          changed_by_owner_type: ctx.owner_type,
          changed_by_owner_id: ctx.owner_id,
          changed_by_runtime: ctx.runtime,
          change_summary: 'Created',
        });
        mem.logMemoryAccess(db, {
          access_id: db.generateId(),
          memory_id: memoryId,
          version_accessed: 1,
          accessor_type: ctx.owner_type,
          accessor_id: ctx.owner_id,
          accessor_runtime: ctx.runtime,
          access_type: 'create',
        });
        db.runPreparedStatement('commitTransaction', []);
        return memory;
      } catch (error) {
        db.runPreparedStatement('rollbackTransaction', []);
        throw error;
      }
    },

    validateMemoryCreation(ctx, input) {
      if (!ctx || !ctx.owner_type || !ctx.owner_id || !ctx.runtime) throw new Error('Authentication required');
      if (input.category === 'individual_persona' && ctx.owner_type !== 'seat') {
        throw new Error(`Category '${input.category}' requires seat owner_type`);
      }
      if (['council_shared', 'decision_resolution', 'lesson_learned', 'unresolved_question'].includes(input.category) &&
          ctx.owner_type !== 'seat' && ctx.owner_type !== 'founder') {
        throw new Error(`Category '${input.category}' requires seat or founder owner_type`);
      }
      if (input.category === 'meeting_history' && !input.meeting_id) {
        throw new Error(`Category 'meeting_history' requires meeting_id`);
      }
      if (['division_shared', 'division_private'].includes(input.category) &&
          (ctx.owner_type !== 'division' || input.division_id !== ctx.owner_id)) {
        throw new Error(`Category '${input.category}' requires ownership of the division`);
      }
      if (input.category === 'staff_private' &&
          (ctx.owner_type !== 'staff' || input.division_id !== undefined)) {
        throw new Error(`Category '${input.category}' requires staff owner_type`);
      }
      if (input.category === 'task_history') {
        if (!input.task_id) throw new Error(`Category 'task_history' requires task_id`);
        ops.assertTaskAccess(db, ctx, input.task_id);
      }
    },

    getMemoryById(ctx, memoryId) {
      if (!ctx || !ctx.owner_type || !ctx.owner_id || !ctx.runtime) throw new Error('Authentication required');
      const memory = mem.getMemoryById(db, memoryId);
      if (!memory || !ops.checkMemoryAccess(ctx, memory, db)) return undefined;
      this.logMemoryAccess(ctx, memoryId, 'read', memory.version);
      return memory;
    },

    updateMemory(ctx, input) {
      const existing = mem.getMemoryById(db, input.memory_id);
      if (!existing || !ops.checkMemoryAccess(ctx, existing, db)) throw new Error('Memory not found');
      const updatedValues = {
        title: input.title ?? existing.title,
        content: input.content === undefined ? existing.content : JSON.stringify(input.content),
        tags: input.tags ?? JSON.parse(existing.tags),
        confidence: input.confidence ?? existing.confidence,
      };
      db.runPreparedStatement('beginTransaction', []);
      try {
        const updated = mem.updateMemory(db, input.memory_id, updatedValues);
        mem.createMemoryVersion(db, {
          version_id: db.generateId(),
          memory_id: input.memory_id,
          version_num: existing.version + 1,
          title: updatedValues.title,
          content: updatedValues.content,
          tags: updatedValues.tags,
          confidence: updatedValues.confidence,
          changed_by_owner_type: ctx.owner_type,
          changed_by_owner_id: ctx.owner_id,
          changed_by_runtime: ctx.runtime,
          change_summary: input.change_summary,
        });
        this.logMemoryAccess(ctx, input.memory_id, 'update', existing.version + 1);
        db.runPreparedStatement('commitTransaction', []);
        return updated;
      } catch (error) {
        db.runPreparedStatement('rollbackTransaction', []);
        throw error;
      }
    },

    getMemoryEntriesByCategory(ctx, category) {
      if (!ctx || !ctx.owner_type || !ctx.owner_id || !ctx.runtime) throw new Error('Authentication required');
      return mem.listMemoryEntries(db, { category, archived: false })
        .filter(memory => ops.checkMemoryAccess(ctx, memory, db));
    },

    searchMemory(ctx, input) {
      if (!ctx || !ctx.owner_type || !ctx.owner_id || !ctx.runtime) throw new Error('Authentication required');
      const rows = mem.listMemoryEntries(db, {
        category: input.category,
        archived: input.include_archived ? undefined : false,
        limit: Math.min(input.limit ?? 50, 1000),
        offset: input.offset ?? 0,
      });
      const query = input.query?.toLocaleLowerCase();
      return rows.filter(memory => {
        if (!ops.checkMemoryAccess(ctx, memory, db)) return false;
        if (input.memory_type && memory.memory_type !== input.memory_type) return false;
        if (input.meeting_id && memory.meeting_id !== input.meeting_id) return false;
        if (input.division_id && memory.division_id !== input.division_id) return false;
        if (input.task_id && memory.task_id !== input.task_id) return false;
        if (input.min_confidence !== undefined && memory.confidence < input.min_confidence) return false;
        if (input.tags?.length && !input.tags.some(tag => JSON.parse(memory.tags).includes(tag))) return false;
        return !query || `${memory.title} ${memory.content}`.toLocaleLowerCase().includes(query);
      });
    },

    createMemoryLink(ctx, input) {
      const source = mem.getMemoryById(db, input.source_memory_id);
      const target = mem.getMemoryById(db, input.target_memory_id);
      if (!source || !target || !ops.checkMemoryAccess(ctx, source, db) || !ops.checkMemoryAccess(ctx, target, db)) {
        throw new Error('Memory not found');
      }
      return mem.createMemoryLink(db, {
        link_id: db.generateId(),
        ...input,
        created_by_owner_type: ctx.owner_type,
        created_by_owner_id: ctx.owner_id,
        created_by_runtime: ctx.runtime,
      });
    },

    getRelated(ctx, input) {
      const start = mem.getMemoryById(db, input.memory_id);
      if (!start || !ops.checkMemoryAccess(ctx, start, db)) return [];
      const maxDepth = input.max_depth ?? 3;
      const seen = new Set([input.memory_id]);
      let frontier = [input.memory_id];
      const related: MemoryEntry[] = [];
      for (let depth = 0; depth < maxDepth && frontier.length; depth += 1) {
        const placeholders = frontier.map(() => '?').join(',');
        const frontierIds = new Set(frontier);
        const direction = input.direction ?? 'out';
        const clauses = direction === 'out'
          ? `source_memory_id IN (${placeholders})`
          : direction === 'in'
            ? `target_memory_id IN (${placeholders})`
            : `(source_memory_id IN (${placeholders}) OR target_memory_id IN (${placeholders}))`;
        const values = direction === 'both' ? [...frontier, ...frontier] : frontier;
        const links = db.query(`SELECT source_memory_id, target_memory_id, link_type FROM memory_links WHERE ${clauses}`, values) as Array<{ source_memory_id: string; target_memory_id: string; link_type: MemoryLinkType }>;
        const next: string[] = [];
        for (const link of links) {
          if (input.link_type && link.link_type !== input.link_type) continue;
          const neighborIds = direction === 'out'
            ? frontierIds.has(link.source_memory_id) ? [link.target_memory_id] : []
            : direction === 'in'
              ? frontierIds.has(link.target_memory_id) ? [link.source_memory_id] : []
              : [
                  ...(frontierIds.has(link.source_memory_id) ? [link.target_memory_id] : []),
                  ...(frontierIds.has(link.target_memory_id) ? [link.source_memory_id] : []),
                ];
          for (const neighborId of neighborIds) {
            if (seen.has(neighborId)) continue;
            seen.add(neighborId);
            const memory = mem.getMemoryById(db, neighborId);
            if (memory && ops.checkMemoryAccess(ctx, memory, db)) {
              related.push(memory);
              next.push(neighborId);
            }
          }
        }
        frontier = next;
      }
      return related;
    },

    logMemoryAccess(ctx, memoryId, accessType, version) {
      const allowedTypes = ['create', 'read', 'update', 'link', 'search'];
      if (!allowedTypes.includes(accessType)) throw new Error('Invalid memory access type');
      const memory = mem.getMemoryById(db, memoryId);
      if (!memory || !ops.checkMemoryAccess(ctx, memory, db)) throw new Error('Memory not found');
      const access = {
        access_id: db.generateId(),
        memory_id: memoryId,
        version_accessed: version ?? null,
        accessor_type: ctx.owner_type,
        accessor_id: ctx.owner_id,
        accessor_runtime: ctx.runtime,
        access_type: accessType as 'create' | 'read' | 'update' | 'link' | 'search',
      };
      mem.logMemoryAccess(db, access);
      return access as MemoryAccess;
    },

    grantCrossDivisionAccess(ctx, input) {
      const memory = mem.getMemoryById(db, input.memory_id);
      if (!memory || !ops.checkMemoryAccess(ctx, memory, db)) throw new Error('Memory not found');
      if (ctx.owner_type !== 'founder' &&
          (ctx.owner_type !== 'division' || memory.division_id !== ctx.owner_id)) {
        throw new Error('Only the owning Division Head can grant cross-division access');
      }
      if (!div.getDivisionById(db, input.division_id)) throw new Error(`Division '${input.division_id}' not found`);
      return mem.createCrossDivisionShare(db, {
        share_id: db.generateId(),
        memory_id: input.memory_id,
        division_id: input.division_id,
        granted_by_type: ctx.owner_type === 'founder' ? 'founder' : 'division',
        granted_by_id: ctx.owner_id,
        status: ctx.owner_type === 'founder' ? 'approved' : 'pending',
      });
    },

    revokeCrossDivisionAccess(ctx, input) {
      const memory = mem.getMemoryById(db, input.memory_id);
      if (!memory || !ops.checkMemoryAccess(ctx, memory, db)) throw new Error('Memory not found');
      if (ctx.owner_type !== 'founder' &&
          (ctx.owner_type !== 'division' || memory.division_id !== ctx.owner_id)) {
        throw new Error('Only the owning Division Head can revoke cross-division access');
      }
      const share = mem.getCrossDivisionShares(db, input.memory_id)
        .find(item => item.division_id === input.division_id && item.revoked_at == null);
      if (!share) throw new Error('Cross-division access not found');
      mem.updateCrossDivisionShare(db, share.share_id, { revoked_at: new Date().toISOString() });
    },

    // Division Operations
    createDivision(ctx, input) {
      if (!ops.isFounder(ctx)) throw new Error('Only Founder can create divisions');
      return div.createDivision(db, input);
    },

    getDivisionById(divisionId) {
      return div.getDivisionById(db, divisionId) ?? undefined;
    },

    listDivisions() {
      return div.listDivisions(db);
    },

    updateDivision(ctx, input) {
      if (!ops.isFounder(ctx) && !ops.isDivisionHead(ctx, input.division_id)) {
        throw new Error('Access denied to division');
      }
      return div.updateDivision(db, input.division_id, input);
    },

    assignDivisionHead(ctx, input) {
      if (!ops.isFounder(ctx)) throw new Error('Only Founder can assign division heads');
      const staff = div.getStaffAgentById(db, input.staff_id);
      if (!staff) throw new Error(`Staff agent '${input.staff_id}' not found`);
      if (staff.division_id !== input.division_id) {
        throw new Error(`Staff agent '${input.staff_id}' is not a member of division '${input.division_id}'`);
      }
      if (staff.status !== 'active') throw new Error('Division head must be an active staff agent');
      return div.updateDivision(db, input.division_id, { division_id: input.division_id, head_staff_id: input.staff_id });
    },

    listSpecialists(ctx, input) {
      if (!ops.isFounder(ctx) && !ops.isDivisionMember(ctx, input.division_id, db)) {
        throw new Error('Access denied to division specialists');
      }
      return div.listStaffAgents(db, { division_id: input.division_id });
    },

    // Staff Operations
    registerStaffAgent(ctx, input) {
      if (!ops.isFounder(ctx)) throw new Error('Only Founder can register staff agents');
      if (!div.getDivisionById(db, input.division_id)) throw new Error(`Division '${input.division_id}' not found`);
      if (div.getStaffAgentById(db, input.staff_id)) throw new Error(`Staff agent '${input.staff_id}' already exists`);
      if (div.listStaffAgents(db, { division_id: input.division_id }).length >= 7) {
        throw new Error(`Division '${input.division_id}' max specialists reached`);
      }
      return div.registerStaffAgent(db, input);
    },

    getStaffAgentById(staffId) {
      return div.getStaffAgentById(db, staffId) ?? undefined;
    },

    listStaffAgents() {
      return div.listStaffAgents(db);
    },

    listStaffAgentsByDivision(divisionId) {
      return div.listStaffAgents(db, { division_id: divisionId });
    },

    updateStaffStatus(ctx, input) {
      if (!ops.isFounder(ctx)) throw new Error('Only Founder can update staff status');
      return div.updateStaffStatus(db, input);
    },

    updateStaffPermissions(ctx, input) {
      if (!ops.isFounder(ctx)) throw new Error('Only Founder can update staff permissions');
      return div.updateStaffAgent(db, input.staff_id, { staff_id: input.staff_id, permissions: input.permissions });
    },

    suspendStaffAgent(ctx, input) {
      if (!ops.isFounder(ctx)) throw new Error('Only Founder can suspend staff agents');
      return div.suspendStaffAgent(db, input);
    },

    retireStaffAgent(ctx, input) {
      if (!ops.isFounder(ctx)) throw new Error('Only Founder can retire staff agents');
      db.runPreparedStatement('DELETE FROM division_members WHERE staff_id = ?', [input.staff_id]);
      return div.retireStaffAgent(db, input);
    },

    // Division Members
    addDivisionMember(ctx, input) {
      if (!ops.isFounder(ctx) && !ops.isDivisionHead(ctx, input.division_id)) {
        throw new Error('Only Founder or owning Division Head can add division members');
      }
      const staff = div.getStaffAgentById(db, input.staff_id);
      if (!staff || staff.division_id !== input.division_id) {
        throw new Error('Staff agent must belong to the specified division');
      }
      return div.addDivisionMember(db, input);
    },

    getDivisionMembers(divisionId) {
      return div.getDivisionMembers(db, divisionId);
    },

    getStaffDivisions(staffId) {
      return div.getStaffDivisions(db, staffId);
    },

    // Task Operations
    createTask(ctx, input) {
      if (!ctx || !ctx.owner_type || !ctx.owner_id || !ctx.runtime) throw new Error('Authentication required');
      const creatorMatchesIdentity =
        (ctx.owner_type === 'founder' && input.created_by_type === 'founder' && input.created_by_id === ctx.owner_id) ||
        (ctx.owner_type === 'seat' && input.created_by_type === 'council' && input.created_by_id === ctx.owner_id) ||
        (ctx.owner_type === 'division' && input.created_by_type === 'division_head' && input.created_by_id === ctx.owner_id);
      if (!creatorMatchesIdentity) throw new Error('Task creator must match authenticated identity');
      if (ctx.owner_type === 'division' && input.assigned_to_type === 'division' && input.assigned_to_id !== ctx.owner_id) {
        throw new Error('Division Head can only assign tasks to their own division');
      }
      if (input.assigned_to_type === 'division' && !div.getDivisionById(db, input.assigned_to_id)) {
        throw new Error(`Division '${input.assigned_to_id}' not found`);
      }
      if (input.assigned_to_type === 'staff') {
        const staff = div.getStaffAgentById(db, input.assigned_to_id);
        if (!staff) throw new Error(`Staff agent '${input.assigned_to_id}' not found`);
        if (ctx.owner_type === 'division' && staff.division_id !== ctx.owner_id) {
          throw new Error('Division Head can only assign tasks to their own division members');
        }
      }
      for (const dependencyId of input.dependencies ?? []) {
        const dependency = div.getTaskById(db, dependencyId);
        if (!dependency) throw new Error(`Dependency task '${dependencyId}' not found`);
        if (dependency.status !== 'completed') {
          throw new Error(`Dependency task '${dependencyId}' must be completed before creating dependent task`);
        }
      }
      return div.createTask(db, input);
    },

    getTaskById(ctx, taskId) {
      if (!div.getTaskById(db, taskId)) return undefined;
      try {
        return ops.assertTaskAccess(db, ctx, taskId);
      } catch (error) {
        if (isTaskAccessError(error)) return undefined;
        throw error;
      }
    },

    listTasks(ctx, input) {
      if (!ctx || !ctx.owner_type || !ctx.owner_id || !ctx.runtime) throw new Error('Authentication required');
      return div.listTasks(db, input).filter((task) => {
        try {
          ops.assertTaskAccess(db, ctx, task.task_id);
          return true;
        } catch (error) {
          if (!isTaskAccessError(error)) throw error;
          return ctx.owner_type === 'division' &&
            task.created_by_type === 'division_head' &&
            task.created_by_id === ctx.owner_id;
        }
      });
    },

    updateTask(ctx, input) {
      const task = div.getTaskById(db, input.task_id);
      if (!task) throw new Error(`Task '${input.task_id}' not found`);
      const taskDivision = task.assigned_to_type === 'staff'
        ? div.getStaffAgentById(db, task.assigned_to_id)?.division_id
        : task.assigned_to_id;
      const isDivisionManager = ctx.owner_type === 'division' &&
        (taskDivision === ctx.owner_id ||
         (task.created_by_type === 'division_head' && task.created_by_id === ctx.owner_id));
      const isAssignedStaff = ctx.owner_type === 'staff' &&
        ((task.assigned_to_type === 'staff' && task.assigned_to_id === ctx.owner_id) ||
         (task.assigned_to_type === 'division' && ops.isDivisionMember(ctx, task.assigned_to_id, db)));
      const canManageTask = ctx.owner_type === 'founder' ||
        isDivisionManager ||
        isAssignedStaff;
      if (!canManageTask) throw new Error('Authorization denied');
      if (input.status) {
        const allowedTransitions: Record<string, string[]> = {
          pending: ['in_progress', 'cancelled'],
          in_progress: ['review', 'cancelled'],
          review: ['completed', 'pending', 'cancelled'],
          completed: [],
          cancelled: [],
        };
        if (!allowedTransitions[task.status]?.includes(input.status)) {
          throw new Error(`Invalid status transition: ${task.status} -> ${input.status}`);
        }
        const assignedDivisionHead =
          ctx.owner_type === 'division' && task.assigned_to_type === 'division' && task.assigned_to_id === ctx.owner_id;
        const assignedStaff = ctx.owner_type === 'staff' && task.assigned_to_type === 'staff' && task.assigned_to_id === ctx.owner_id;
        const staffTransition =
          (task.status === 'pending' && input.status === 'in_progress') ||
          (task.status === 'in_progress' && input.status === 'review');
        if (ctx.owner_type !== 'founder' && !assignedDivisionHead && !(assignedStaff && staffTransition)) {
          throw new Error(`Unauthorized to transition task to ${input.status}`);
        }
      }
      const changes: UpdateTaskInput = {
        task_id: input.task_id,
        title: input.title,
        description: input.description,
        priority: input.priority,
        due_at: input.status === 'completed' ? new Date().toISOString() : input.due_at,
        status: input.status,
      };
      return div.updateTask(db, input.task_id, changes);
    },

    completeTask(ctx, input) {
      return this.updateTask(ctx, { task_id: input.task_id, status: 'completed' });
    },

    // Deliverable Operations
    createDeliverable(ctx, input) {
      ops.assertTaskAccess(db, ctx, input.task_id);
      if (input.submitted_by_type !== ctx.owner_type || input.submitted_by_id !== ctx.owner_id) {
        throw new Error('Deliverable submitter must match authenticated identity');
      }
      return div.createDeliverable(db, input);
    },

    getDeliverableById(ctx, deliverableId) {
      const deliverable = div.getDeliverableById(db, deliverableId);
      if (!deliverable) return undefined;
      try {
        ops.assertTaskAccess(db, ctx, deliverable.task_id);
        return deliverable;
      } catch (error) {
        if (isTaskAccessError(error)) return undefined;
        throw error;
      }
    },

    listDeliverablesByTask(ctx, input) {
      ops.assertTaskAccess(db, ctx, input.task_id);
      return div.listDeliverablesByTask(db, input.task_id);
    },

    updateDeliverable(ctx, input) {
      const existing = div.getDeliverableById(db, input.deliverable_id);
      if (!existing) throw new Error(`Deliverable '${input.deliverable_id}' not found`);
      ops.assertTaskAccess(db, ctx, existing.task_id);
      if (ctx.owner_type !== 'founder' && input.status && input.status !== existing.status) {
        throw new Error('Only Founder can change deliverable status');
      }
      return div.updateDeliverable(db, input.deliverable_id, input);
    },

    // Cross-Division Access
    requestCrossDivisionAccess(ctx, input) {
      if (!ops.isDivisionHead(ctx, input.from_division)) {
        throw new Error('Only Division Head can request cross-division access');
      }
      if (!div.getDivisionById(db, input.to_division)) {
        throw new Error(`Target division '${input.to_division}' not found`);
      }
      if (!input.memory_id) throw new Error('A valid memory_id is required for cross-division access');
      const memory = mem.getMemoryById(db, input.memory_id);
      if (!memory) throw new Error(`Memory '${input.memory_id}' not found`);
      if (!ops.checkMemoryAccess(ctx, memory, db)) throw new Error('Access denied to requested memory');
      const now = new Date().toISOString();
      const requestId = db.generateId();
      db.runPreparedStatement('beginTransaction', []);
      try {
        const request = mem.createCrossDivisionShare(db, {
          share_id: requestId,
          memory_id: input.memory_id,
          division_id: input.to_division,
          granted_by_type: 'founder',
          granted_by_id: ctx.owner_id,
          request_type: input.request_type,
          status: 'pending',
          justification: input.justification,
          priority: input.priority,
          deadline: input.deadline,
        });
        db.runPreparedStatement('insertMemoryAccess', [
          db.generateId(), input.memory_id, null, ctx.owner_type, ctx.owner_id, ctx.runtime, 'create', now,
        ]);
        db.runPreparedStatement('commitTransaction', []);
        return request;
      } catch (error) {
        db.runPreparedStatement('rollbackTransaction', []);
        throw error;
      }
    },

    approveCrossDivisionAccess(ctx, input) {
      if (!ops.isFounder(ctx)) throw new Error('Only Founder can approve cross-division access requests');
      const share = db.query('SELECT * FROM cross_division_shares WHERE share_id = ?', [input.request_id])[0] as CrossDivisionShare | undefined;
      if (!share) throw new Error(`Cross-division request '${input.request_id}' not found`);
      if (share.status === 'approved') throw new Error(`Request '${input.request_id}' already approved`);
      if (share.status !== 'pending') throw new Error(`Request '${input.request_id}' is not pending`);
      const now = new Date().toISOString();
      db.runPreparedStatement('beginTransaction', []);
      try {
        db.runPreparedStatement('updateCrossDivisionShare', [
          'approved', now, 'founder', ctx.owner_id, 'founder', 'founder', input.request_id,
        ]);
        db.runPreparedStatement('commitTransaction', []);
      } catch (error) {
        db.runPreparedStatement('rollbackTransaction', []);
        throw error;
      }
      const updated = db.query('SELECT * FROM cross_division_shares WHERE share_id = ?', [input.request_id])[0] as CrossDivisionShare | undefined;
      if (!updated) throw new Error(`Cross-division request '${input.request_id}' not found after approval`);
      return updated;
    },

    listPendingCrossDivisionRequests(ctx, input) {
      if (!ops.isFounder(ctx) && !ops.isDivisionMember(ctx, input.division_id, db)) {
        throw new Error('Access denied to cross-division requests');
      }
      return (db.query('SELECT * FROM cross_division_shares WHERE division_id = ? ORDER BY granted_at DESC', [input.division_id]) as CrossDivisionShare[])
        .filter((share) => share.status === 'pending' || share.granted_by_type === 'division');
    },

    // Phase 7: Autonomy & Execution
    createTaskAutonomyLevel(ctx, input) {
      return ops.createTaskAutonomyLevel(db, ctx, input);
    },

    getTaskAutonomyLevel(_ctx, taskType) {
      return ops.getTaskAutonomyLevel(db, taskType);
    },

    listTaskAutonomyLevels(_ctx) {
      return ops.listTaskAutonomyLevels(db);
    },

    updateTaskAutonomyLevel(ctx, taskType, autonomyLevel, description) {
      return ops.updateTaskAutonomyLevel(db, ctx, taskType, autonomyLevel, description);
    },

    requestExecution(ctx, input) {
      return ops.requestExecution(db, ctx, input);
    },

    getExecutionRequest(ctx, input) {
      return ops.getExecutionRequest(db, ctx, input);
    },

    listExecutionRequests(ctx, input) {
      return ops.listExecutionRequests(db, ctx, input);
    },

    approveExecution(ctx, input) {
      return ops.approveExecution(db, ctx, input);
    },

    executeExecutionRequest(ctx, executionId, resultPayload) {
      return ops.executeExecutionRequest(db, ctx, executionId, resultPayload);
    },

    cancelExecutionRequest(ctx, executionId) {
      return ops.cancelExecutionRequest(db, ctx, executionId);
    },

    getExecutionHistory(ctx, input) {
      return ops.getExecutionHistory(db, ctx, input);
    },

    listApprovalRequests(ctx, input) {
      return ops.listApprovalRequests(db, ctx, input);
    },
  };
}

// Re-export the original createCouncilService as default
export { createCouncilService };

// Also export types
export type {
  SeatStatus, CouncilSeat, Persona, Constitution, FounderApproval,
  Candidate, FounderDeliberation, FounderVote, Meeting, MeetingPhase,
  PrimaryIdea, BrainstormRecord, Challenge, Defense, Synthesis, Reassessment,
  Evaluation, AnonymousEvaluation, EvaluationCriteria,
  MemoryOwnerType, MemoryEntry, MemoryVersion, MemoryLink, MemoryAccess, CrossDivisionShare,
  Division, StaffAgent, DivisionMember, Task, Deliverable,
  TaskAutonomyLevel, ExecutionRequest, ApprovalRequest, ExecutionHistory,
  AutonomyLevel, ExecutionStatus, ApprovalStatus, MemoryCategory, MemoryLinkType
};