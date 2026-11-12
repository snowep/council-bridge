import { z } from 'zod/v4';
import { DatabaseInstance } from './database.js';

export const SeatStatusSchema = z.enum(['permanent', 'vacant', 'replaceable']);
export type SeatStatus = z.infer<typeof SeatStatusSchema>;

export const CouncilSeatSchema = z.object({
  seat_id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  status: SeatStatusSchema.default('vacant'),
  is_founder: z.boolean().default(false),
  description: z.string().default(''),
});
export type CouncilSeat = z.infer<typeof CouncilSeatSchema> & {
  created_at: string;
  updated_at: string;
};

export const PersonaSchema = z.object({
  persona_id: z.string().min(1).max(255),
  seat_id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  description: z.string().default(''),
  traits: z.string().default(''),
});
export type Persona = z.infer<typeof PersonaSchema> & {
  created_at: string;
  updated_at: string;
};

export const RuntimePersonaSchema = z.object({
  runtime: z.string().min(1).max(255),
  persona_id: z.string().min(1).max(255),
});
export type RuntimePersona = z.infer<typeof RuntimePersonaSchema>;

export const ConstitutionSchema = z.object({
  version: z.string().min(1).max(50),
  content: z.string().min(1),
  status: z.enum(['draft', 'active', 'superseded', 'rejected']).default('draft'),
  approved_by_founder: z.boolean().default(false),
});
export type Constitution = z.infer<typeof ConstitutionSchema> & {
  created_at: string;
};

export const FounderApprovalSchema = z.object({
  id: z.string().uuid(),
  constitution_version: z.string().min(1).max(50),
  decision: z.enum(['accepted', 'rejected', 'revisions_requested']),
  notes: z.string().default(''),
});
export type FounderApproval = z.infer<typeof FounderApprovalSchema> & {
  created_at: string;
};

// Phase 3: Council Formation, Meetings, Evaluation

export const CandidateSchema = z.object({
  candidate_id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  description: z.string().default(''),
  traits: z.string().default(''),
  proposed_seat_id: z.string().min(1).max(255),
  status: z.enum(['pending', 'approved', 'rejected', 'withdrawn']).default('pending'),
  proposed_by_founder_seat_id: z.string().min(1).max(255),
});
export type Candidate = z.infer<typeof CandidateSchema> & {
  created_at: string;
  updated_at: string;
};

export const FounderDeliberationSchema = z.object({
  id: z.string().uuid(),
  candidate_id: z.string().min(1).max(255),
  founder_seat_id: z.string().min(1).max(255),
  content: z.string().min(1),
});
export type FounderDeliberation = z.infer<typeof FounderDeliberationSchema> & {
  created_at: string;
};

export const FounderVoteSchema = z.object({
  id: z.string().uuid(),
  candidate_id: z.string().min(1).max(255),
  founder_seat_id: z.string().min(1).max(255),
  vote: z.enum(['yes', 'no', 'abstain']),
  notes: z.string().default(''),
});
export type FounderVote = z.infer<typeof FounderVoteSchema> & {
  created_at: string;
};

export const MeetingSchema = z.object({
  meeting_id: z.string().min(1).max(255),
  number: z.int().positive(),
  status: z.enum(['preparing', 'deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation', 'closed', 'archived', 'cancelled']).default('preparing'),
  constitution_version: z.string().min(1).max(50),
  started_at: z.string().nullable().optional(),
  closed_at: z.string().nullable().optional(),
});
export type Meeting = z.infer<typeof MeetingSchema> & {
  created_at: string;
  updated_at: string;
};

export const MeetingPhaseSchema = z.object({
  id: z.string().uuid(),
  meeting_id: z.string().min(1).max(255),
  phase: z.enum(['preparation', 'founder_deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation', 'closure']),
  status: z.enum(['pending', 'active', 'completed', 'skipped']).default('pending'),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
});
export type MeetingPhase = z.infer<typeof MeetingPhaseSchema> & {
  created_at: string;
};

export const PrimaryIdeaSchema = z.object({
  id: z.string().uuid(),
  meeting_id: z.string().min(1).max(255),
  seat_id: z.string().min(1).max(255),
  persona_id: z.string().min(1).max(255),
  content: z.string().min(1),
});
export type PrimaryIdea = z.infer<typeof PrimaryIdeaSchema> & {
  created_at: string;
};

export const BrainstormRecordSchema = z.object({
  id: z.string().uuid(),
  meeting_id: z.string().min(1).max(255),
  seat_id: z.string().min(1).max(255),
  persona_id: z.string().min(1).max(255),
  content: z.string().min(1),
});
export type BrainstormRecord = z.infer<typeof BrainstormRecordSchema> & {
  created_at: string;
};

export const ChallengeSchema = z.object({
  id: z.string().uuid(),
  meeting_id: z.string().min(1).max(255),
  challenger_seat_id: z.string().min(1).max(255),
  challenger_persona_id: z.string().min(1).max(255),
  target_seat_id: z.string().min(1).max(255),
  target_persona_id: z.string().min(1).max(255),
  content: z.string().min(1),
});
export type Challenge = z.infer<typeof ChallengeSchema> & {
  created_at: string;
};

export const DefenseSchema = z.object({
  id: z.string().uuid(),
  meeting_id: z.string().min(1).max(255),
  challenge_id: z.string().uuid(),
  defender_seat_id: z.string().min(1).max(255),
  defender_persona_id: z.string().min(1).max(255),
  content: z.string().min(1),
});
export type Defense = z.infer<typeof DefenseSchema> & {
  created_at: string;
};

export const SynthesisSchema = z.object({
  id: z.string().uuid(),
  meeting_id: z.string().min(1).max(255),
  seat_id: z.string().min(1).max(255),
  persona_id: z.string().min(1).max(255),
  content: z.string().min(1),
});
export type Synthesis = z.infer<typeof SynthesisSchema> & {
  created_at: string;
};

export const ReassessmentSchema = z.object({
  id: z.string().uuid(),
  meeting_id: z.string().min(1).max(255),
  seat_id: z.string().min(1).max(255),
  persona_id: z.string().min(1).max(255),
  target_seat_id: z.string().min(1).max(255),
  content: z.string().min(1),
});
export type Reassessment = z.infer<typeof ReassessmentSchema> & {
  created_at: string;
};

export const EvaluationSchema = z.object({
  id: z.string().uuid(),
  meeting_id: z.string().min(1).max(255),
  evaluator_seat_id: z.string().min(1).max(255),
  evaluator_persona_id: z.string().min(1).max(255),
  subject_seat_id: z.string().min(1).max(255),
  subject_persona_id: z.string().min(1).max(255),
  cultural_impact_score: z.int().min(1).max(10),
  creative_output_score: z.int().min(1).max(10),
  collaborative_spirit_score: z.int().min(1).max(10),
  strategic_vision_score: z.int().min(1).max(10),
  authenticity_score: z.int().min(1).max(10),
  weighted_score: z.number(),
  notes: z.string().default(''),
});
export type Evaluation = z.infer<typeof EvaluationSchema> & {
  created_at: string;
};

// Anonymous evaluation (for external retrieval)
export const AnonymousEvaluationSchema = z.object({
  id: z.string().uuid(),
  meeting_id: z.string().min(1).max(255),
  subject_seat_id: z.string().min(1).max(255),
  subject_persona_id: z.string().min(1).max(255),
  cultural_impact_score: z.int().min(1).max(10),
  creative_output_score: z.int().min(1).max(10),
  collaborative_spirit_score: z.int().min(1).max(10),
  strategic_vision_score: z.int().min(1).max(10),
  authenticity_score: z.int().min(1).max(10),
  weighted_score: z.number(),
  notes: z.string().default(''),
});
export type AnonymousEvaluation = z.infer<typeof AnonymousEvaluationSchema> & {
  created_at: string;
};

export const EvaluationCriteriaSchema = z.object({
  criterion_id: z.string().min(1).max(255),
  constitution_version: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  weight: z.number().gt(0).lte(1),
  description: z.string().default(''),
});
export type EvaluationCriteria = z.infer<typeof EvaluationCriteriaSchema> & {
  created_at: string;
};

function toCouncilSeat(row: any): CouncilSeat {
  return {
    ...row,
    is_founder: Boolean(row.is_founder),
  };
}

function toPersona(row: any): Persona {
  return row;
}

function toConstitution(row: any): Constitution {
  return {
    ...row,
    approved_by_founder: Boolean(row.approved_by_founder),
  };
}

function toFounderApproval(row: any): FounderApproval {
  return row;
}

function toCandidate(row: any): Candidate {
  return row;
}

function toFounderDeliberation(row: any): FounderDeliberation {
  return row;
}

function toFounderVote(row: any): FounderVote {
  return row;
}

function toMeeting(row: any): Meeting {
  return row;
}

function toMeetingPhase(row: any): MeetingPhase {
  return row;
}

function toPrimaryIdea(row: any): PrimaryIdea {
  return row;
}

function toBrainstormRecord(row: any): BrainstormRecord {
  return row;
}

function toChallenge(row: any): Challenge {
  return row;
}

function toDefense(row: any): Defense {
  return row;
}

function toSynthesis(row: any): Synthesis {
  return row;
}

function toReassessment(row: any): Reassessment {
  return row;
}

function toEvaluation(row: any): Evaluation {
  return row;
}

function toAnonymousEvaluation(row: any): AnonymousEvaluation {
  // Exclude evaluator identity
  const { evaluator_seat_id, evaluator_persona_id, ...rest } = row;
  return rest as AnonymousEvaluation;
}

function toEvaluationCriteria(row: any): EvaluationCriteria {
  return row;
}

export function createCouncilService(dbInstance: DatabaseInstance) {
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

  // Meeting phases in order
  const meetingPhases = [
    'preparation', 'founder_deliberation', 'primary_ideas', 'brainstorming',
    'challenges', 'synthesis', 'reassessment', 'evaluation', 'closure'
  ];

  // Phase to meeting status mapping
  const phaseToStatus: Record<string, string> = {
    preparation: 'preparing',
    founder_deliberation: 'deliberation',
    primary_ideas: 'primary_ideas',
    brainstorming: 'brainstorming',
    challenges: 'challenges',
    synthesis: 'synthesis',
    reassessment: 'reassessment',
    evaluation: 'evaluation',
    closure: 'closed',
  };

  return {
    // Council Seats
    createSeat(input: z.infer<typeof CouncilSeatSchema>): CouncilSeat {
      const existing = dbInstance.stmt.getSeatById.get(input.seat_id);
      if (existing) {
        throw new Error(`Seat with ID '${input.seat_id}' already exists`);
      }
      dbInstance.stmt.insertSeat.run(
        input.seat_id,
        input.name,
        input.status,
        input.is_founder ? 1 : 0,
        input.description
      );
      return toCouncilSeat(dbInstance.stmt.getSeatById.get(input.seat_id));
    },

    getSeat(seatId: string): CouncilSeat | undefined {
      const row = dbInstance.stmt.getSeatById.get(seatId);
      return row ? toCouncilSeat(row) : undefined;
    },

    listSeats(): CouncilSeat[] {
      return (dbInstance.stmt.listSeats.all() as any[]).map(toCouncilSeat);
    },

    updateSeatStatus(seatId: string, status: SeatStatus): CouncilSeat {
      const seat = this.getSeat(seatId);
      if (!seat) {
        throw new Error(`Seat '${seatId}' not found`);
      }
      if (seat.is_founder && status !== 'permanent') {
        throw new Error('Founder seats cannot change status from permanent');
      }
      dbInstance.stmt.updateSeatStatus.run(status, seatId);
      return this.getSeat(seatId) as CouncilSeat;
    },

    // Personas
    createPersona(input: z.infer<typeof PersonaSchema>): Persona {
      const seat = this.getSeat(input.seat_id);
      if (!seat) {
        throw new Error(`Seat '${input.seat_id}' not found`);
      }
      const existing = dbInstance.stmt.getPersonaById.get(input.persona_id);
      if (existing) {
        throw new Error(`Persona with ID '${input.persona_id}' already exists`);
      }
      dbInstance.stmt.insertPersona.run(
        input.persona_id,
        input.seat_id,
        input.name,
        input.description,
        input.traits
      );
      return toPersona(dbInstance.stmt.getPersonaById.get(input.persona_id));
    },

    getPersona(personaId: string): Persona | undefined {
      const row = dbInstance.stmt.getPersonaById.get(personaId);
      return row ? toPersona(row) : undefined;
    },

    listPersonasBySeat(seatId: string): Persona[] {
      return (dbInstance.stmt.listPersonasBySeat.all(seatId) as any[]).map(toPersona);
    },

    listAllPersonas(): Persona[] {
      return (dbInstance.stmt.listAllPersonas.all() as any[]).map(toPersona);
    },

    getPersonaBySeat(seatId: string): Persona | undefined {
      const personas = this.listPersonasBySeat(seatId);
      return personas[0];
    },

    // Runtime Personas
    assignPersonaToRuntime(runtime: string, personaId: string): RuntimePersona {
      const persona = this.getPersona(personaId);
      if (!persona) {
        throw new Error(`Persona '${personaId}' not found`);
      }
      dbInstance.stmt.insertRuntimePersona.run(runtime, personaId);
      return { runtime, persona_id: personaId };
    },

    removePersonaFromRuntime(runtime: string, personaId: string): void {
      dbInstance.stmt.deleteRuntimePersona.run(runtime, personaId);
    },

    getRuntimePersonas(runtime: string): Persona[] {
      const runtimePersonas = dbInstance.stmt.getRuntimePersonas.all(runtime) as RuntimePersona[];
      const personas: Persona[] = [];
      for (const rp of runtimePersonas) {
        const p = this.getPersona(rp.persona_id);
        if (p) personas.push(p);
      }
      return personas;
    },

    // Shared identity retrieval - both runtimes get same 11 seats
    getAllSeatsWithPersonas(): (CouncilSeat & { persona: Persona | null })[] {
      const seats = this.listSeats();
      return seats.map(seat => {
        const persona = this.getPersonaBySeat(seat.seat_id);
        return { ...seat, persona: persona ?? null };
      });
    },

    getRuntimePersonasWithSeats(runtime: string): (Persona & { seat: CouncilSeat })[] {
      const runtimePersonas = this.getRuntimePersonas(runtime);
      return runtimePersonas.map(persona => {
        const seat = this.getSeat(persona.seat_id) as CouncilSeat;
        return { ...persona, seat };
      });
    },

    // Constitution
    createConstitution(input: z.infer<typeof ConstitutionSchema>): Constitution {
      const existing = dbInstance.stmt.getConstitution.get(input.version);
      if (existing) {
        throw new Error(`Constitution version '${input.version}' already exists`);
      }
      dbInstance.stmt.insertConstitution.run(
        input.version,
        input.content,
        input.status,
        input.approved_by_founder ? 1 : 0
      );
      return toConstitution(dbInstance.stmt.getConstitution.get(input.version));
    },

    getConstitution(version: string): Constitution | undefined {
      const row = dbInstance.stmt.getConstitution.get(version);
      return row ? toConstitution(row) : undefined;
    },

    getActiveConstitution(): Constitution | undefined {
      const row = dbInstance.stmt.getActiveConstitution.get();
      return row ? toConstitution(row) : undefined;
    },

    listConstitutions(): Constitution[] {
      return (dbInstance.stmt.listConstitutions.all() as any[]).map(toConstitution);
    },

    updateConstitutionStatus(version: string, status: Constitution['status']): Constitution {
      const constitution = this.getConstitution(version);
      if (!constitution) {
        throw new Error(`Constitution version '${version}' not found`);
      }
      dbInstance.stmt.updateConstitutionStatus.run(status, version);
      return this.getConstitution(version) as Constitution;
    },

    // Founder Approvals
    recordFounderApproval(input: z.infer<typeof FounderApprovalSchema>): FounderApproval {
      const constitution = this.getConstitution(input.constitution_version);
      if (!constitution) {
        throw new Error(`Constitution version '${input.constitution_version}' not found`);
      }
      dbInstance.stmt.insertFounderApproval.run(
        input.id,
        input.constitution_version,
        input.decision,
        input.notes
      );
      return toFounderApproval(dbInstance.stmt.listFounderApprovals.all(input.constitution_version)[0]);
    },

    listFounderApprovals(version: string): FounderApproval[] {
      return (dbInstance.stmt.listFounderApprovals.all(version) as any[]).map(toFounderApproval);
    },

    getLatestFounderDecision(version: string): FounderApproval | undefined {
      const approvals = this.listFounderApprovals(version);
      return approvals[0];
    },

    // Validation: both runtimes refer to same 11 seats
    validateRuntimeIdentity(runtime: string): { valid: boolean; issues: string[] } {
      const issues: string[] = [];
      const allSeats = this.listSeats();

      if (allSeats.length !== 11) {
        issues.push(`Expected 11 seats, found ${allSeats.length}`);
      }

      const permanentSeats = allSeats.filter(s => s.status === 'permanent');
      if (permanentSeats.length !== 4) {
        issues.push(`Expected 4 permanent seats, found ${permanentSeats.length}`);
      }

      const runtimePersonas = this.getRuntimePersonas(runtime);

      // Check that all permanent seats have personas in this runtime
      for (const seat of permanentSeats) {
        const persona = this.getPersonaBySeat(seat.seat_id);
        if (persona) {
          const hasInRuntime = runtimePersonas.some(p => p.persona_id === persona.persona_id);
          if (!hasInRuntime) {
            issues.push(`Runtime '${runtime}' missing persona for permanent seat '${seat.seat_id}'`);
          }
        }
      }

      // Check that all seats with personas have them in this runtime
      const allPersonas = this.listAllPersonas();
      for (const persona of allPersonas) {
        const hasInRuntime = runtimePersonas.some(p => p.persona_id === persona.persona_id);
        if (!hasInRuntime) {
          issues.push(`Runtime '${runtime}' missing persona '${persona.persona_id}' (seat: ${persona.seat_id})`);
        }
      }

      return { valid: issues.length === 0, issues };
    },

    // Phase 3: Council Formation - Candidates
    createCandidate(input: z.infer<typeof CandidateSchema>): Candidate {
      const seat = this.getSeat(input.proposed_seat_id);
      if (!seat) {
        throw new Error(`Proposed seat '${input.proposed_seat_id}' not found`);
      }
      if (seat.status !== 'vacant') {
        throw new Error(`Seat '${input.proposed_seat_id}' is not vacant (status: ${seat.status})`);
      }
      const proposer = this.getSeat(input.proposed_by_founder_seat_id);
      if (!proposer || !proposer.is_founder) {
        throw new Error(`Proposer must be a founder seat, got '${input.proposed_by_founder_seat_id}'`);
      }
      const existing = dbInstance.stmt.getCandidateById.get(input.candidate_id);
      if (existing) {
        throw new Error(`Candidate with ID '${input.candidate_id}' already exists`);
      }
      dbInstance.stmt.insertCandidate.run(
        input.candidate_id,
        input.name,
        input.description,
        input.traits,
        input.proposed_seat_id,
        input.status,
        input.proposed_by_founder_seat_id
      );
      return toCandidate(dbInstance.stmt.getCandidateById.get(input.candidate_id));
    },

    getCandidate(candidateId: string): Candidate | undefined {
      const row = dbInstance.stmt.getCandidateById.get(candidateId);
      return row ? toCandidate(row) : undefined;
    },

    listCandidates(): Candidate[] {
      return (dbInstance.stmt.listCandidates.all() as any[]).map(toCandidate);
    },

    updateCandidateStatus(candidateId: string, status: Candidate['status']): Candidate {
      const candidate = this.getCandidate(candidateId);
      if (!candidate) {
        throw new Error(`Candidate '${candidateId}' not found`);
      }
      dbInstance.stmt.updateCandidateStatus.run(status, candidateId);
      return this.getCandidate(candidateId) as Candidate;
    },

    // Founder Deliberation
    recordFounderDeliberation(input: z.infer<typeof FounderDeliberationSchema>): FounderDeliberation {
      const candidate = this.getCandidate(input.candidate_id);
      if (!candidate) {
        throw new Error(`Candidate '${input.candidate_id}' not found`);
      }
      const founder = this.getSeat(input.founder_seat_id);
      if (!founder || !founder.is_founder) {
        throw new Error(`Founder seat '${input.founder_seat_id}' not found or not a founder`);
      }
      dbInstance.stmt.insertFounderDeliberation.run(
        input.id,
        input.candidate_id,
        input.founder_seat_id,
        input.content
      );
      return toFounderDeliberation(dbInstance.stmt.getFounderDeliberationsByCandidate.all(input.candidate_id).pop() as any);
    },

    getFounderDeliberations(candidateId: string): FounderDeliberation[] {
      return (dbInstance.stmt.getFounderDeliberationsByCandidate.all(candidateId) as any[]).map(toFounderDeliberation);
    },

    // Founder Votes
    recordFounderVote(input: z.infer<typeof FounderVoteSchema>): FounderVote {
      const candidate = this.getCandidate(input.candidate_id);
      if (!candidate) {
        throw new Error(`Candidate '${input.candidate_id}' not found`);
      }
      const founder = this.getSeat(input.founder_seat_id);
      if (!founder || !founder.is_founder) {
        throw new Error(`Founder seat '${input.founder_seat_id}' not found or not a founder`);
      }
      dbInstance.stmt.insertFounderVote.run(
        input.id,
        input.candidate_id,
        input.founder_seat_id,
        input.vote,
        input.notes
      );
      const votes = dbInstance.stmt.getFounderVotesByCandidate.all(input.candidate_id) as any[];
      return toFounderVote(votes[votes.length - 1]);
    },

    getFounderVotes(candidateId: string): FounderVote[] {
      return (dbInstance.stmt.getFounderVotesByCandidate.all(candidateId) as any[]).map(toFounderVote);
    },

    getCandidateVoteSummary(candidateId: string): { yes: number; no: number; abstain: number; approved: boolean } {
      const votes = this.getFounderVotes(candidateId);
      const counts = { yes: 0, no: 0, abstain: 0 };
      for (const vote of votes) {
        counts[vote.vote]++;
      }
      return { ...counts, approved: counts.yes >= 3 };
    },

    // Candidate Approval - requires 3 of 4 founder votes
    approveCandidate(candidateId: string): Candidate {
      const summary = this.getCandidateVoteSummary(candidateId);
      if (!summary.approved) {
        throw new Error(`Candidate requires at least 3 of 4 founder votes (currently ${summary.yes} yes)`);
      }
      return this.updateCandidateStatus(candidateId, 'approved');
    },

    rejectCandidate(candidateId: string): Candidate {
      return this.updateCandidateStatus(candidateId, 'rejected');
    },

    // When approved, create persona and assign to vacant seat - TRANSACTIONAL
    seatApprovedCandidate(candidateId: string): { candidate: Candidate; persona: Persona; seat: CouncilSeat } {
      // Use transaction to ensure atomicity
      dbInstance.stmt.beginTransaction.run();
      try {
        const candidate = this.getCandidate(candidateId);
        if (!candidate) {
          throw new Error(`Candidate '${candidateId}' not found`);
        }
        if (candidate.status !== 'approved') {
          throw new Error(`Candidate '${candidateId}' is not approved (status: ${candidate.status})`);
        }
        const seat = this.getSeat(candidate.proposed_seat_id);
        if (!seat) {
          throw new Error(`Seat '${candidate.proposed_seat_id}' not found`);
        }
        if (seat.status !== 'vacant') {
          throw new Error(`Seat '${candidate.proposed_seat_id}' is no longer vacant`);
        }

        // Create persona for the approved candidate
        const personaId = `persona-${candidate.name.toLowerCase().replace(/\s+/g, '-')}`;
        const existingPersona = dbInstance.stmt.getPersonaById.get(personaId);
        if (existingPersona) {
          throw new Error(`Persona with ID '${personaId}' already exists`);
        }
        const persona = this.createPersona({
          persona_id: personaId,
          seat_id: seat.seat_id,
          name: candidate.name,
          description: candidate.description,
          traits: candidate.traits,
        });

        // Update seat status to replaceable
        const updatedSeat = this.updateSeatStatus(seat.seat_id, 'replaceable');

        // Assign persona to both runtimes
        for (const runtime of ['claude', 'hermes']) {
          this.assignPersonaToRuntime(runtime, persona.persona_id);
        }

        dbInstance.stmt.commitTransaction.run();
        return { candidate, persona, seat: updatedSeat };
      } catch (error) {
        dbInstance.stmt.rollbackTransaction.run();
        throw error;
      }
    },

    // Phase 3: Meetings
    createMeeting(input: z.infer<typeof MeetingSchema>): Meeting {
      const existing = dbInstance.stmt.getMeetingById.get(input.meeting_id);
      if (existing) {
        throw new Error(`Meeting with ID '${input.meeting_id}' already exists`);
      }
      const constitution = this.getConstitution(input.constitution_version);
      if (!constitution) {
        throw new Error(`Constitution version '${input.constitution_version}' not found`);
      }
      // Auto-assign meeting number if not provided
      const meetings = this.listMeetings();
      const nextNumber = input.number || (meetings.length > 0 ? Math.max(...meetings.map(m => m.number)) + 1 : 1);

      dbInstance.stmt.insertMeeting.run(
        input.meeting_id,
        nextNumber,
        input.status,
        input.constitution_version,
        input.started_at ?? null,
        input.closed_at ?? null
      );
      const meeting = toMeeting(dbInstance.stmt.getMeetingById.get(input.meeting_id));

      // Initialize meeting phases
      for (const phase of meetingPhases) {
        dbInstance.stmt.insertMeetingPhase.run(
          dbInstance.generateId(),
          meeting.meeting_id,
          phase,
          'pending',
          null,
          null
        );
      }

      return meeting;
    },

    getMeeting(meetingId: string): Meeting | undefined {
      const row = dbInstance.stmt.getMeetingById.get(meetingId);
      return row ? toMeeting(row) : undefined;
    },

    listMeetings(): Meeting[] {
      return (dbInstance.stmt.listMeetings.all() as any[]).map(toMeeting);
    },

    // Meeting lifecycle enforcement
    updateMeetingStatus(meetingId: string, status: Meeting['status']): Meeting {
      const meeting = this.getMeeting(meetingId);
      if (!meeting) {
        throw new Error(`Meeting '${meetingId}' not found`);
      }

      // Prevent modifying archived or cancelled meetings
      if (meeting.status === 'archived' || meeting.status === 'cancelled') {
        throw new Error(`Cannot modify ${meeting.status} meeting`);
      }

      // Validate transition
      const validNext = validStatusTransitions[meeting.status] || [];
      if (!validNext.includes(status)) {
        throw new Error(`Invalid meeting status transition: ${meeting.status} -> ${status}`);
      }

      // If closing, verify all required phases are completed (including closure)
      if (status === 'closed' || status === 'archived') {
        const phases = this.getMeetingPhases(meetingId);
        const incompleteRequired = phases.filter(p => p.status !== 'completed' && p.status !== 'skipped');
        if (incompleteRequired.length > 0) {
          const names = incompleteRequired.map(p => p.phase).join(', ');
          throw new Error(`Cannot close meeting: required phases incomplete: ${names}`);
        }
      }

      dbInstance.stmt.updateMeetingStatus.run(status, status, meetingId);
      return this.getMeeting(meetingId) as Meeting;
    },

    getMeetingPhases(meetingId: string): MeetingPhase[] {
      return (dbInstance.stmt.getMeetingPhases.all(meetingId) as any[]).map(toMeetingPhase);
    },

    // Phase ordering enforcement
    startMeetingPhase(meetingId: string, phase: MeetingPhase['phase']): MeetingPhase {
      const meeting = this.getMeeting(meetingId);
      if (!meeting) {
        throw new Error(`Meeting '${meetingId}' not found`);
      }
      if (meeting.status === 'archived' || meeting.status === 'cancelled') {
        throw new Error(`Cannot start phase in ${meeting.status} meeting`);
      }

      const phases = this.getMeetingPhases(meetingId);
      const targetPhase = phases.find(p => p.phase === phase);
      if (!targetPhase) {
        throw new Error(`Phase '${phase}' not found for meeting '${meetingId}'`);
      }
      if (targetPhase.status !== 'pending') {
        throw new Error(`Phase '${phase}' is already ${targetPhase.status}`);
      }

      // Check that all preceding phases are completed
      const phaseIndex = meetingPhases.indexOf(phase);
      for (let i = 0; i < phaseIndex; i++) {
        const prevPhase = phases.find(p => p.phase === meetingPhases[i]);
        if (prevPhase && prevPhase.status !== 'completed' && prevPhase.status !== 'skipped') {
          throw new Error(`Cannot start phase '${phase}': preceding phase '${meetingPhases[i]}' is ${prevPhase.status}`);
        }
      }

      // Update meeting status to match phase (except closure, which sets status on completion)
      const expectedStatus = phaseToStatus[phase] as Meeting['status'];
      if (expectedStatus && meeting.status !== expectedStatus && phase !== 'closure') {
        this.updateMeetingStatus(meetingId, expectedStatus);
      }

      dbInstance.stmt.updateMeetingPhase.run('active', 'active', meetingId, phase);
      const updatedPhases = this.getMeetingPhases(meetingId);
      return updatedPhases.find(p => p.phase === phase) as MeetingPhase;
    },

    completeMeetingPhase(meetingId: string, phase: MeetingPhase['phase']): MeetingPhase {
      const meeting = this.getMeeting(meetingId);
      if (!meeting) {
        throw new Error(`Meeting '${meetingId}' not found`);
      }
      if (meeting.status === 'archived' || meeting.status === 'cancelled') {
        throw new Error(`Cannot complete phase in ${meeting.status} meeting`);
      }

      const phases = this.getMeetingPhases(meetingId);
      const targetPhase = phases.find(p => p.phase === phase);
      if (!targetPhase) {
        throw new Error(`Phase '${phase}' not found for meeting '${meetingId}'`);
      }
      if (targetPhase.status !== 'active') {
        throw new Error(`Cannot complete phase '${phase}': not active (status: ${targetPhase.status})`);
      }

      dbInstance.stmt.updateMeetingPhase.run('completed', 'completed', meetingId, phase);

      // If completing closure phase, update meeting status to closed
      if (phase === 'closure') {
        dbInstance.stmt.updateMeetingStatus.run('closed', 'closed', meetingId);
      }

      const updatedPhases = this.getMeetingPhases(meetingId);
      return updatedPhases.find(p => p.phase === phase) as MeetingPhase;
    },

    // Primary Ideas - one per occupied seat per meeting
    submitPrimaryIdea(input: z.infer<typeof PrimaryIdeaSchema>): PrimaryIdea {
      const meeting = this.getMeeting(input.meeting_id);
      if (!meeting) {
        throw new Error(`Meeting '${input.meeting_id}' not found`);
      }
      if (meeting.status === 'archived' || meeting.status === 'cancelled') {
        throw new Error(`Cannot submit primary idea in ${meeting.status} meeting`);
      }
      const seat = this.getSeat(input.seat_id);
      if (!seat) {
        throw new Error(`Seat '${input.seat_id}' not found`);
      }
      if (seat.status === 'vacant') {
        throw new Error(`Vacant seat '${input.seat_id}' cannot submit primary ideas`);
      }
      const persona = this.getPersona(input.persona_id);
      if (!persona || persona.seat_id !== input.seat_id) {
        throw new Error(`Persona '${input.persona_id}' does not belong to seat '${input.seat_id}'`);
      }
      const existing = dbInstance.stmt.getPrimaryIdeaBySeatAndMeeting.get(input.meeting_id, input.seat_id);
      if (existing) {
        throw new Error(`Seat '${input.seat_id}' already submitted a primary idea for meeting '${input.meeting_id}'`);
      }
      dbInstance.stmt.insertPrimaryIdea.run(
        input.id,
        input.meeting_id,
        input.seat_id,
        input.persona_id,
        input.content
      );
      return toPrimaryIdea(dbInstance.stmt.getPrimaryIdeaBySeatAndMeeting.get(input.meeting_id, input.seat_id));
    },

    getPrimaryIdeas(meetingId: string): PrimaryIdea[] {
      return (dbInstance.stmt.getPrimaryIdeasByMeeting.all(meetingId) as any[]).map(toPrimaryIdea);
    },

    // Brainstorming
    recordBrainstorm(input: z.infer<typeof BrainstormRecordSchema>): BrainstormRecord {
      const meeting = this.getMeeting(input.meeting_id);
      if (!meeting) {
        throw new Error(`Meeting '${input.meeting_id}' not found`);
      }
      if (meeting.status === 'archived' || meeting.status === 'cancelled') {
        throw new Error(`Cannot record brainstorm in ${meeting.status} meeting`);
      }
      const seat = this.getSeat(input.seat_id);
      if (!seat) {
        throw new Error(`Seat '${input.seat_id}' not found`);
      }
      if (seat.status === 'vacant') {
        throw new Error(`Vacant seat '${input.seat_id}' cannot brainstorm`);
      }
      const persona = this.getPersona(input.persona_id);
      if (!persona || persona.seat_id !== input.seat_id) {
        throw new Error(`Persona '${input.persona_id}' does not belong to seat '${input.seat_id}'`);
      }
      dbInstance.stmt.insertBrainstormRecord.run(
        input.id,
        input.meeting_id,
        input.seat_id,
        input.persona_id,
        input.content
      );
      const records = dbInstance.stmt.getBrainstormRecordsByMeeting.all(input.meeting_id) as any[];
      return toBrainstormRecord(records[records.length - 1]);
    },

    getBrainstormRecords(meetingId: string): BrainstormRecord[] {
      return (dbInstance.stmt.getBrainstormRecordsByMeeting.all(meetingId) as any[]).map(toBrainstormRecord);
    },

    // Challenges
    recordChallenge(input: z.infer<typeof ChallengeSchema>): Challenge {
      const meeting = this.getMeeting(input.meeting_id);
      if (!meeting) {
        throw new Error(`Meeting '${input.meeting_id}' not found`);
      }
      if (meeting.status === 'archived' || meeting.status === 'cancelled') {
        throw new Error(`Cannot record challenge in ${meeting.status} meeting`);
      }
      const challengerSeat = this.getSeat(input.challenger_seat_id);
      if (!challengerSeat || challengerSeat.status === 'vacant') {
        throw new Error(`Challenger seat '${input.challenger_seat_id}' not found or vacant`);
      }
      const targetSeat = this.getSeat(input.target_seat_id);
      if (!targetSeat || targetSeat.status === 'vacant') {
        throw new Error(`Target seat '${input.target_seat_id}' not found or vacant`);
      }
      const challengerPersona = this.getPersona(input.challenger_persona_id);
      if (!challengerPersona || challengerPersona.seat_id !== input.challenger_seat_id) {
        throw new Error(`Challenger persona mismatch`);
      }
      const targetPersona = this.getPersona(input.target_persona_id);
      if (!targetPersona || targetPersona.seat_id !== input.target_seat_id) {
        throw new Error(`Target persona mismatch`);
      }
      dbInstance.stmt.insertChallenge.run(
        input.id,
        input.meeting_id,
        input.challenger_seat_id,
        input.challenger_persona_id,
        input.target_seat_id,
        input.target_persona_id,
        input.content
      );
      const challenges = dbInstance.stmt.getChallengesByMeeting.all(input.meeting_id) as any[];
      return toChallenge(challenges[challenges.length - 1]);
    },

    getChallenges(meetingId: string): Challenge[] {
      return (dbInstance.stmt.getChallengesByMeeting.all(meetingId) as any[]).map(toChallenge);
    },

    // Defenses
    recordDefense(input: z.infer<typeof DefenseSchema>): Defense {
      const meeting = this.getMeeting(input.meeting_id);
      if (!meeting) {
        throw new Error(`Meeting '${input.meeting_id}' not found`);
      }
      if (meeting.status === 'archived' || meeting.status === 'cancelled') {
        throw new Error(`Cannot record defense in ${meeting.status} meeting`);
      }
      const challenges = dbInstance.stmt.getChallengesByMeeting.all(input.meeting_id) as Challenge[];
      const challenge = challenges.find(c => c.id === input.challenge_id);
      if (!challenge) {
        throw new Error(`Challenge '${input.challenge_id}' not found in meeting '${input.meeting_id}'`);
      }
      const defenderSeat = this.getSeat(input.defender_seat_id);
      if (!defenderSeat || defenderSeat.status === 'vacant') {
        throw new Error(`Defender seat '${input.defender_seat_id}' not found or vacant`);
      }
      const defenderPersona = this.getPersona(input.defender_persona_id);
      if (!defenderPersona || defenderPersona.seat_id !== input.defender_seat_id) {
        throw new Error(`Defender persona mismatch`);
      }
      // Only the target of the challenge can defend
      if (input.defender_seat_id !== challenge.target_seat_id) {
        throw new Error(`Only the challenge target can defend`);
      }
      dbInstance.stmt.insertDefense.run(
        input.id,
        input.meeting_id,
        input.challenge_id,
        input.defender_seat_id,
        input.defender_persona_id,
        input.content
      );
      const defenses = dbInstance.stmt.getDefensesByMeeting.all(input.meeting_id) as any[];
      return toDefense(defenses[defenses.length - 1]);
    },

    getDefenses(meetingId: string): Defense[] {
      return (dbInstance.stmt.getDefensesByMeeting.all(meetingId) as any[]).map(toDefense);
    },

    // Synthesis
    recordSynthesis(input: z.infer<typeof SynthesisSchema>): Synthesis {
      const meeting = this.getMeeting(input.meeting_id);
      if (!meeting) {
        throw new Error(`Meeting '${input.meeting_id}' not found`);
      }
      if (meeting.status === 'archived' || meeting.status === 'cancelled') {
        throw new Error(`Cannot record synthesis in ${meeting.status} meeting`);
      }
      const seat = this.getSeat(input.seat_id);
      if (!seat || seat.status === 'vacant') {
        throw new Error(`Seat '${input.seat_id}' not found or vacant`);
      }
      const persona = this.getPersona(input.persona_id);
      if (!persona || persona.seat_id !== input.seat_id) {
        throw new Error(`Persona '${input.persona_id}' does not belong to seat '${input.seat_id}'`);
      }
      dbInstance.stmt.insertSynthesis.run(
        input.id,
        input.meeting_id,
        input.seat_id,
        input.persona_id,
        input.content
      );
      const syntheses = dbInstance.stmt.getSynthesesByMeeting.all(input.meeting_id) as any[];
      return toSynthesis(syntheses[syntheses.length - 1]);
    },

    getSyntheses(meetingId: string): Synthesis[] {
      return (dbInstance.stmt.getSynthesesByMeeting.all(meetingId) as any[]).map(toSynthesis);
    },

    // Reassessment
    recordReassessment(input: z.infer<typeof ReassessmentSchema>): Reassessment {
      const meeting = this.getMeeting(input.meeting_id);
      if (!meeting) {
        throw new Error(`Meeting '${input.meeting_id}' not found`);
      }
      if (meeting.status === 'archived' || meeting.status === 'cancelled') {
        throw new Error(`Cannot record reassessment in ${meeting.status} meeting`);
      }
      const seat = this.getSeat(input.seat_id);
      if (!seat || seat.status === 'vacant') {
        throw new Error(`Seat '${input.seat_id}' not found or vacant`);
      }
      const targetSeat = this.getSeat(input.target_seat_id);
      if (!targetSeat || targetSeat.status === 'vacant') {
        throw new Error(`Target seat '${input.target_seat_id}' not found or vacant`);
      }
      const persona = this.getPersona(input.persona_id);
      if (!persona || persona.seat_id !== input.seat_id) {
        throw new Error(`Persona '${input.persona_id}' does not belong to seat '${input.seat_id}'`);
      }
      dbInstance.stmt.insertReassessment.run(
        input.id,
        input.meeting_id,
        input.seat_id,
        input.persona_id,
        input.target_seat_id,
        input.content
      );
      const reassessments = dbInstance.stmt.getReassessmentsByMeeting.all(input.meeting_id) as any[];
      return toReassessment(reassessments[reassessments.length - 1]);
    },

    getReassessments(meetingId: string): Reassessment[] {
      return (dbInstance.stmt.getReassessmentsByMeeting.all(meetingId) as any[]).map(toReassessment);
    },

    // Get evaluation criteria for a constitution version
    getEvaluationCriteriaForConstitution(constitutionVersion: string): EvaluationCriteria[] {
      return (dbInstance.stmt.getEvaluationCriteriaForMeeting.all(constitutionVersion) as any[]).map(toEvaluationCriteria);
    },

    // Convert criterion name to score key (e.g., "Cultural Impact" -> "cultural_impact")
    criterionNameToScoreKey(criterionName: string): string {
      return criterionName.toLowerCase().replace(/\s+/g, '_');
    },

    // Validate score keys match criteria exactly
    validateScoreKeys(scores: Record<string, number>, criteria: EvaluationCriteria[]): { valid: boolean; errors: string[] } {
      const errors: string[] = [];
      const expectedKeys = new Set(criteria.map(c => this.criterionNameToScoreKey(c.name)));
      const providedKeys = new Set(Object.keys(scores));

      // Check for missing criteria scores
      for (const key of expectedKeys) {
        if (!providedKeys.has(key)) {
          errors.push(`Missing score for criterion: ${key}`);
        }
      }

      // Check for unknown score keys
      for (const key of providedKeys) {
        if (!expectedKeys.has(key)) {
          errors.push(`Unknown score key: ${key}`);
        }
      }

      // Check for duplicate criterion names (would map to same key)
      const keyCounts = new Map<string, number>();
      for (const c of criteria) {
        const key = this.criterionNameToScoreKey(c.name);
        keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
      }
      for (const [key, count] of keyCounts) {
        if (count > 1) {
          errors.push(`Duplicate criterion mapping to key: ${key}`);
        }
      }

      // Validate score ranges (1-10)
      for (const [key, value] of Object.entries(scores)) {
        if (typeof value !== 'number' || value < 1 || value > 10 || !Number.isInteger(value)) {
          errors.push(`Invalid score for ${key}: must be integer 1-10, got ${value}`);
        }
      }

      return { valid: errors.length === 0, errors };
    },

    // Calculate weighted score using Constitution criteria (validated)
    calculateWeightedScore(scores: Record<string, number>, criteria: EvaluationCriteria[]): number {
      if (criteria.length === 0) {
        // Fallback to default weights with default criteria names
        const defaultScores = {
          cultural_impact: scores.cultural_impact ?? 0,
          creative_output: scores.creative_output ?? 0,
          collaborative_spirit: scores.collaborative_spirit ?? 0,
          strategic_vision: scores.strategic_vision ?? 0,
          authenticity: scores.authenticity ?? 0,
        };
        return (
          defaultScores.cultural_impact * 0.30 +
          defaultScores.creative_output * 0.25 +
          defaultScores.collaborative_spirit * 0.20 +
          defaultScores.strategic_vision * 0.15 +
          defaultScores.authenticity * 0.10
        );
      }

      const validation = this.validateScoreKeys(scores, criteria);
      if (!validation.valid) {
        throw new Error(`Score validation failed: ${validation.errors.join('; ')}`);
      }

      let totalWeight = 0;
      let weightedSum = 0;
      for (const c of criteria) {
        const key = this.criterionNameToScoreKey(c.name);
        const score = scores[key];
        if (typeof score === 'number') {
          weightedSum += score * c.weight;
          totalWeight += c.weight;
        }
      }
      // Normalize if weights don't sum to 1
      return totalWeight > 0 ? weightedSum / totalWeight : 0;
    },

    // Evaluation - anonymous peer evaluation for replaceable members
    submitEvaluation(input: z.infer<typeof EvaluationSchema>): Evaluation {
      const meeting = this.getMeeting(input.meeting_id);
      if (!meeting) {
        throw new Error(`Meeting '${input.meeting_id}' not found`);
      }
      if (meeting.status === 'archived' || meeting.status === 'cancelled') {
        throw new Error(`Cannot submit evaluation in ${meeting.status} meeting`);
      }
      const evaluatorSeat = this.getSeat(input.evaluator_seat_id);
      if (!evaluatorSeat || evaluatorSeat.status === 'vacant') {
        throw new Error(`Evaluator seat '${input.evaluator_seat_id}' not found or vacant`);
      }
      const subjectSeat = this.getSeat(input.subject_seat_id);
      if (!subjectSeat || subjectSeat.status === 'vacant') {
        throw new Error(`Subject seat '${input.subject_seat_id}' not found or vacant`);
      }
      if (input.evaluator_seat_id === input.subject_seat_id) {
        throw new Error(`Members cannot evaluate themselves`);
      }
      const evaluatorPersona = this.getPersona(input.evaluator_persona_id);
      if (!evaluatorPersona || evaluatorPersona.seat_id !== input.evaluator_seat_id) {
        throw new Error(`Evaluator persona mismatch`);
      }
      const subjectPersona = this.getPersona(input.subject_persona_id);
      if (!subjectPersona || subjectPersona.seat_id !== input.subject_seat_id) {
        throw new Error(`Subject persona mismatch`);
      }
      // Only replaceable members are evaluated
      if (subjectSeat.status !== 'replaceable') {
        throw new Error(`Only replaceable members can be evaluated (subject seat status: ${subjectSeat.status})`);
      }

      // Get criteria from the meeting's constitution
      const criteria = this.getEvaluationCriteriaForConstitution(meeting.constitution_version);

      // Calculate weighted score using Constitution criteria (only pass provided scores)
      const scores: Record<string, number> = {};
      if (input.cultural_impact_score !== undefined) scores.cultural_impact = input.cultural_impact_score;
      if (input.creative_output_score !== undefined) scores.creative_output = input.creative_output_score;
      if (input.collaborative_spirit_score !== undefined) scores.collaborative_spirit = input.collaborative_spirit_score;
      if (input.strategic_vision_score !== undefined) scores.strategic_vision = input.strategic_vision_score;
      if (input.authenticity_score !== undefined) scores.authenticity = input.authenticity_score;
      const weightedScore = this.calculateWeightedScore(scores, criteria);

      // Check for duplicate evaluation
      const existing = dbInstance.stmt.getEvaluationByEvaluatorAndSubject.get(
        input.meeting_id, input.evaluator_seat_id, input.subject_seat_id
      );
      if (existing) {
        throw new Error(`Evaluator '${input.evaluator_seat_id}' has already evaluated subject '${input.subject_seat_id}' for this meeting`);
      }

      dbInstance.stmt.insertEvaluation.run(
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
        weightedScore,
        input.notes
      );
      return toEvaluation(dbInstance.stmt.getEvaluationByEvaluatorAndSubject.get(
        input.meeting_id, input.evaluator_seat_id, input.subject_seat_id
      ));
    },

    // Anonymous evaluation retrieval - no evaluator identity exposed
    getEvaluations(meetingId: string): AnonymousEvaluation[] {
      return (dbInstance.stmt.getEvaluationsByMeeting.all(meetingId) as any[]).map(toAnonymousEvaluation);
    },

    getEvaluationsBySubject(subjectSeatId: string): AnonymousEvaluation[] {
      return (dbInstance.stmt.listEvaluationsBySubject.all(subjectSeatId) as any[]).map(toAnonymousEvaluation);
    },

    // Internal method for operations that need evaluator identity (e.g., duplicate prevention)
    getEvaluationsInternal(meetingId: string): Evaluation[] {
      return (dbInstance.stmt.getEvaluationsByMeeting.all(meetingId) as any[]).map(toEvaluation);
    },

    getEvaluationsBySubjectInternal(subjectSeatId: string): Evaluation[] {
      return (dbInstance.stmt.listEvaluationsBySubject.all(subjectSeatId) as any[]).map(toEvaluation);
    },

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
    } {
      const evaluations = meetingId
        ? this.getEvaluationsInternal(meetingId).filter(e => e.subject_seat_id === subjectSeatId)
        : this.getEvaluationsBySubjectInternal(subjectSeatId);

      if (evaluations.length === 0) {
        return {
          subjectSeatId,
          meetingCount: 0,
          averageWeightedScore: 0,
          averageCulturalImpact: 0,
          averageCreativeOutput: 0,
          averageCollaborativeSpirit: 0,
          averageStrategicVision: 0,
          averageAuthenticity: 0,
          evaluatorCount: 0,
        };
      }

      const sum = evaluations.reduce((acc, e) => ({
        weighted: acc.weighted + e.weighted_score,
        cultural: acc.cultural + e.cultural_impact_score,
        creative: acc.creative + e.creative_output_score,
        collaborative: acc.collaborative + e.collaborative_spirit_score,
        strategic: acc.strategic + e.strategic_vision_score,
        authenticity: acc.authenticity + e.authenticity_score,
      }), { weighted: 0, cultural: 0, creative: 0, collaborative: 0, strategic: 0, authenticity: 0 });

      const count = evaluations.length;
      // Get unique meeting count
      const meetingIds = new Set(evaluations.map(e => e.meeting_id));

      return {
        subjectSeatId,
        meetingCount: meetingIds.size,
        averageWeightedScore: sum.weighted / count,
        averageCulturalImpact: sum.cultural / count,
        averageCreativeOutput: sum.creative / count,
        averageCollaborativeSpirit: sum.collaborative / count,
        averageStrategicVision: sum.strategic / count,
        averageAuthenticity: sum.authenticity / count,
        evaluatorCount: new Set(evaluations.map(e => e.evaluator_seat_id)).size,
      };
    },

    // Check if a replaceable member has completed 5 consecutive formal meetings
    // Only counts formal meetings that are closed or archived (not cancelled, incomplete, or preparing)
    getReplaceableMemberMeetingCount(seatId: string): number {
      const seat = this.getSeat(seatId);
      if (!seat || seat.status !== 'replaceable') {
        return 0;
      }
      const evaluations = this.getEvaluationsBySubjectInternal(seatId);

      // Filter to meetings that are closed or archived (completed formal meetings)
      const formalMeetings = new Set<string>();
      for (const eval_ of evaluations) {
        const meeting = this.getMeeting(eval_.meeting_id);
        if (meeting && (meeting.status === 'closed' || meeting.status === 'archived')) {
          formalMeetings.add(eval_.meeting_id);
        }
      }
      return formalMeetings.size;
    },

    // Evaluation Criteria
    createEvaluationCriteria(input: z.infer<typeof EvaluationCriteriaSchema>): EvaluationCriteria {
      const constitution = this.getConstitution(input.constitution_version);
      if (!constitution) {
        throw new Error(`Constitution version '${input.constitution_version}' not found`);
      }

      // Validate weights total 100% for this constitution
      const existingCriteria = this.getEvaluationCriteria(input.constitution_version);
      const totalWeight = existingCriteria.reduce((sum, c) => sum + c.weight, 0) + input.weight;
      if (totalWeight > 1.0 + 0.001) { // small epsilon for floating point
        throw new Error(`Total criteria weight would exceed 100% (current: ${(totalWeight - input.weight) * 100}%, adding: ${input.weight * 100}%)`);
      }

      dbInstance.stmt.insertEvaluationCriteria.run(
        input.criterion_id,
        input.constitution_version,
        input.name,
        input.weight,
        input.description
      );
      return toEvaluationCriteria(dbInstance.stmt.getEvaluationCriteria.all(input.constitution_version).find((c: any) => c.criterion_id === input.criterion_id));
    },

    getEvaluationCriteria(constitutionVersion: string): EvaluationCriteria[] {
      return (dbInstance.stmt.getEvaluationCriteria.all(constitutionVersion) as any[]).map(toEvaluationCriteria);
    },
  };
}

export type CouncilService = ReturnType<typeof createCouncilService>;