// Core Council Types and Zod Schemas
// Extracted from council.ts for modularization (Phases 1-3)

import { z } from 'zod/v4';

// Phase 1-2: Council Seats and Personas
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

// Phase 4: Memory and Knowledge Subsystem - Core Types

export const MemoryCategorySchema = z.enum([
  'individual_persona',
  'council_shared',
  'meeting_history',
  'decision_resolution',
  'idea_proposal',
  'research_evidence',
  'lesson_learned',
  'unresolved_question',
  'division_shared',
  'division_private',
  'staff_private',
  'business_context',
  'task_history',
  'cross_division',
]);
export type MemoryCategory = z.infer<typeof MemoryCategorySchema>;

export const MemoryOwnerTypeSchema = z.enum(['seat', 'division', 'staff', 'founder']);
export type MemoryOwnerType = z.infer<typeof MemoryOwnerTypeSchema>;

export const MemoryLinkTypeSchema = z.enum([
  'supports',
  'contradicts',
  'extends',
  'references',
  'supersedes',
  'derived_from',
]);
export type MemoryLinkType = z.infer<typeof MemoryLinkTypeSchema>;

export const MemoryAccessTypeSchema = z.enum(['create', 'read', 'update', 'link', 'search']);
export type MemoryAccessType = z.infer<typeof MemoryAccessTypeSchema>;

export const MemoryEntrySchema = z.object({
  memory_id: z.string().min(1).max(255),
  owner_type: MemoryOwnerTypeSchema,
  owner_id: z.string().min(1).max(255),
  category: MemoryCategorySchema,
  memory_type: z.string().min(1).max(255),
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  tags: z.string().default('[]'),
  confidence: z.number().min(0).max(1).default(1.0),
  version: z.int().positive().default(1),
  supersedes_id: z.string().nullable().optional(),
  meeting_id: z.string().nullable().optional(),
  division_id: z.string().nullable().optional(),
  task_id: z.string().nullable().optional(),
  archived_at: z.string().nullable().optional(),
});
export type MemoryEntry = z.infer<typeof MemoryEntrySchema> & {
  created_at: string;
  updated_at: string;
};

export const MemoryVersionSchema = z.object({
  version_id: z.string().min(1).max(255),
  memory_id: z.string().min(1).max(255),
  version_num: z.int().positive(),
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  tags: z.string().default('[]'),
  confidence: z.number().min(0).max(1).default(1.0),
  changed_by_owner_type: MemoryOwnerTypeSchema,
  changed_by_owner_id: z.string().min(1).max(255),
  changed_by_runtime: z.enum(['claude', 'hermes']),
  change_summary: z.string().default(''),
});
export type MemoryVersion = z.infer<typeof MemoryVersionSchema> & {
  created_at: string;
};

export const MemoryLinkSchema = z.object({
  link_id: z.string().min(1).max(255),
  source_memory_id: z.string().min(1).max(255),
  target_memory_id: z.string().min(1).max(255),
  link_type: MemoryLinkTypeSchema,
  strength: z.number().gt(0).lte(1).default(1.0),
  notes: z.string().default(''),
  created_by_owner_type: MemoryOwnerTypeSchema,
  created_by_owner_id: z.string().min(1).max(255),
  created_by_runtime: z.enum(['claude', 'hermes']),
});
export type MemoryLink = z.infer<typeof MemoryLinkSchema> & {
  created_at: string;
};

export const MemoryAccessSchema = z.object({
  access_id: z.string().min(1).max(255),
  memory_id: z.string().min(1).max(255),
  version_accessed: z.int().positive().nullable().optional(),
  accessor_type: MemoryOwnerTypeSchema,
  accessor_id: z.string().min(1).max(255),
  accessor_runtime: z.enum(['claude', 'hermes']),
  access_type: MemoryAccessTypeSchema,
});
export type MemoryAccess = z.infer<typeof MemoryAccessSchema> & {
  created_at: string;
};

export const CrossDivisionShareSchema = z.object({
  share_id: z.string().min(1).max(255),
  memory_id: z.string().min(1).max(255),
  division_id: z.string().min(1).max(255),
  granted_by_type: z.enum(['division', 'founder']),
  granted_by_id: z.string().min(1).max(255),
  granted_at: z.string(),
  revoked_at: z.string().nullable().optional(),
  request_type: z.enum(['task_delegate', 'deliverable_share', 'memory_access', 'resource_request']).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  justification: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  deadline: z.string().optional(),
  approved_by_type: z.string().optional(),
  approved_by_id: z.string().optional(),
  approved_at: z.string().optional(),
});
export type CrossDivisionShare = z.infer<typeof CrossDivisionShareSchema> & {
  created_at: string;
};

// Phase 6: Division & Staff Management

export const DivisionSchema = z.object({
  division_id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  description: z.string().default(''),
  head_staff_id: z.string().nullable().optional(),
  budget_limit: z.number().default(0),
  permissions: z.string().default('[]'),
  strategic_objectives: z.string().default('[]'),
});
export type Division = z.infer<typeof DivisionSchema> & {
  created_at: string;
  updated_at: string;
};

export const StaffAgentSchema = z.object({
  staff_id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  role: z.string().min(1).max(255),
  division_id: z.string().min(1).max(255),
  runtime_instances: z.string().default('[]'),
  permissions: z.string().default('[]'),
  status: z.enum(['active', 'inactive', 'terminated']).default('inactive'),
});
export type StaffAgent = z.infer<typeof StaffAgentSchema> & {
  created_at: string;
  updated_at: string;
};

export const DivisionMemberSchema = z.object({
  division_id: z.string().min(1).max(255),
  staff_id: z.string().min(1).max(255),
  role: z.enum(['head', 'member', 'specialist']).default('specialist'),
  joined_at: z.string(),
});
export type DivisionMember = z.infer<typeof DivisionMemberSchema>;

export const TaskSchema = z.object({
  task_id: z.string().min(1).max(255),
  title: z.string().min(1).max(500),
  description: z.string().default(''),
  assigned_to_type: z.enum(['division', 'staff']),
  assigned_to_id: z.string().min(1).max(255),
  created_by_type: z.enum(['founder', 'council', 'division_head']),
  created_by_id: z.string().min(1).max(255),
  status: z.enum(['pending', 'in_progress', 'review', 'completed', 'cancelled']).default('pending'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  budget_allocated: z.number().default(0),
  due_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  dependencies: z.string().default('[]'),
  deliverable_id: z.string().nullable().optional(),
});
export type Task = z.infer<typeof TaskSchema> & {
  created_at: string;
  updated_at: string;
};

export const DeliverableSchema = z.object({
  deliverable_id: z.string().min(1).max(255),
  task_id: z.string().min(1).max(255),
  submitted_by_type: z.enum(['staff', 'division']),
  submitted_by_id: z.string().min(1).max(255),
  content: z.string(),
  status: z.enum(['submitted', 'accepted', 'rejected', 'revision_requested']).default('submitted'),
  reviewed_by_type: z.enum(['founder', 'council', 'division_head']).nullable().optional(),
  reviewed_by_id: z.string().nullable().optional(),
  reviewed_at: z.string().nullable().optional(),
  file_references: z.string().default('[]'),
  task_relationships: z.string().default('[]'),
  audit_log: z.string().default('[]'),
});
export type Deliverable = z.infer<typeof DeliverableSchema> & {
  created_at: string;
  updated_at: string;
};