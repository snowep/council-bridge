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

// Phase 4: Memory and Knowledge Subsystem

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

// Input schemas for MCP tools
export const CreateMemoryInputSchema = z.object({
  category: MemoryCategorySchema,
  memory_type: z.string().min(1).max(255),
  title: z.string().min(1).max(500),
  content: z.record(z.string(), z.any()),
  tags: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(1.0),
  meeting_id: z.string().optional(),
  division_id: z.string().optional(),
  task_id: z.string().optional(),
});
export type CreateMemoryInput = z.infer<typeof CreateMemoryInputSchema>;

export const UpdateMemoryInputSchema = z.object({
  memory_id: z.string().min(1).max(255),
  title: z.string().min(1).max(500).optional(),
  content: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  change_summary: z.string().min(1).max(1000),
});
export type UpdateMemoryInput = z.infer<typeof UpdateMemoryInputSchema>;

export const SearchMemoryInputSchema = z.object({
  query: z.string().optional(),
  category: MemoryCategorySchema.optional(),
  memory_type: z.string().optional(),
  meeting_id: z.string().optional(),
  division_id: z.string().optional(),
  task_id: z.string().optional(),
  tags: z.array(z.string()).optional(),
  min_confidence: z.number().min(0).max(1).optional(),
  limit: z.int().positive().max(1000).default(50),
  offset: z.int().nonnegative().default(0),
  include_archived: z.boolean().default(false),
});
export type SearchMemoryInput = z.infer<typeof SearchMemoryInputSchema>;

export const LinkMemoryInputSchema = z.object({
  source_memory_id: z.string().min(1).max(255),
  target_memory_id: z.string().min(1).max(255),
  link_type: MemoryLinkTypeSchema,
  strength: z.number().gt(0).lte(1).default(1.0),
  notes: z.string().default(''),
});
export type LinkMemoryInput = z.infer<typeof LinkMemoryInputSchema>;

export const GetRelatedInputSchema = z.object({
  memory_id: z.string().min(1).max(255),
  link_type: MemoryLinkTypeSchema.optional(),
  direction: z.enum(['out', 'in', 'both']).default('out'),
  depth: z.int().positive().max(5).default(1),
  max_depth: z.int().positive().max(5).default(3),
});
export type GetRelatedInput = z.infer<typeof GetRelatedInputSchema>;

export const GrantCrossDivisionAccessInputSchema = z.object({
  memory_id: z.string().min(1).max(255),
  division_id: z.string().min(1).max(255),
});
export type GrantCrossDivisionAccessInput = z.infer<typeof GrantCrossDivisionAccessInputSchema>;

export const RevokeCrossDivisionAccessInputSchema = z.object({
  memory_id: z.string().min(1).max(255),
  division_id: z.string().min(1).max(255),
});
export type RevokeCrossDivisionAccessInput = z.infer<typeof RevokeCrossDivisionAccessInputSchema>;

// Phase 6: Permission Enforcement Schemas

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

// Input schemas for MCP tools
export const CreateDivisionInputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  budget_limit: z.number().optional(),
  strategic_objectives: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
});
export type CreateDivisionInput = z.infer<typeof CreateDivisionInputSchema>;

export const AssignDivisionHeadInputSchema = z.object({
  staff_id: z.string().min(1).max(255),
  division_id: z.string().min(1).max(255),
});
export type AssignDivisionHeadInput = z.infer<typeof AssignDivisionHeadInputSchema>;

export const UpdateDivisionInputSchema = z.object({
  division_id: z.string().min(1).max(255),
  head_staff_id: z.string().optional(),
  budget_limit: z.number().optional(),
  strategic_objectives: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
});
export type UpdateDivisionInput = z.infer<typeof UpdateDivisionInputSchema>;

export const ListSpecialistsInputSchema = z.object({
  division_id: z.string().min(1).max(255),
});
export type ListSpecialistsInput = z.infer<typeof ListSpecialistsInputSchema>;

export const RegisterStaffAgentInputSchema = z.object({
  staff_id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  role: z.string().min(1).max(255),
  division_id: z.string().min(1).max(255),
  runtime_instances: z.array(z.enum(['claude', 'hermes'])).min(1),
  permissions: z.array(z.string()).default([]),
});
export type RegisterStaffAgentInput = z.infer<typeof RegisterStaffAgentInputSchema>;

export const UpdateStaffStatusInputSchema = z.object({
  staff_id: z.string().min(1).max(255),
  status: z.enum(['active', 'inactive', 'terminated']),
});
export type UpdateStaffStatusInput = z.infer<typeof UpdateStaffStatusInputSchema>;

export const UpdateStaffPermissionsInputSchema = z.object({
  staff_id: z.string().min(1).max(255),
  permissions: z.array(z.string()),
});
export type UpdateStaffPermissionsInput = z.infer<typeof UpdateStaffPermissionsInputSchema>;

export const SuspendStaffAgentInputSchema = z.object({
  staff_id: z.string().min(1).max(255),
});
export type SuspendStaffAgentInput = z.infer<typeof SuspendStaffAgentInputSchema>;

export const RetireStaffAgentInputSchema = z.object({
  staff_id: z.string().min(1).max(255),
});
export type RetireStaffAgentInput = z.infer<typeof RetireStaffAgentInputSchema>;

export const CreateTaskInputSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  assigned_to_type: z.enum(['division', 'staff']),
  assigned_to_id: z.string().min(1).max(255),
  created_by_type: z.enum(['founder', 'council', 'division_head']),
  created_by_id: z.string().min(1).max(255),
  status: z.enum(['pending', 'in_progress', 'review', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  budget_allocated: z.number().optional(),
  due_at: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  deliverable_id: z.string().optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

export const UpdateTaskInputSchema = z.object({
  task_id: z.string().min(1).max(255),
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'review', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  due_at: z.string().optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

export const ListTasksInputSchema = z.object({
  assigned_to_type: z.enum(['division', 'staff']).optional(),
  assigned_to_id: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'review', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});
export type ListTasksInput = z.infer<typeof ListTasksInputSchema>;

export const CompleteTaskInputSchema = z.object({
  task_id: z.string().min(1).max(255),
});
export type CompleteTaskInput = z.infer<typeof CompleteTaskInputSchema>;

export const CreateDeliverableInputSchema = z.object({
  task_id: z.string().min(1).max(255),
  content: z.record(z.string(), z.any()),
  submitted_by_type: z.enum(['staff', 'division']),
  submitted_by_id: z.string().min(1).max(255),
});
export type CreateDeliverableInput = z.infer<typeof CreateDeliverableInputSchema>;

export const UpdateDeliverableInputSchema = z.object({
  deliverable_id: z.string().min(1).max(255),
  status: z.enum(['submitted', 'accepted', 'rejected', 'revision_requested']).optional(),
  reviewed_by_type: z.enum(['founder', 'council', 'division_head']).optional(),
  reviewed_by_id: z.string().optional(),
  reviewed_at: z.string().optional(),
});
export type UpdateDeliverableInput = z.infer<typeof UpdateDeliverableInputSchema>;

export const ListDeliverablesByTaskInputSchema = z.object({
  task_id: z.string().min(1).max(255),
});
export type ListDeliverablesByTaskInput = z.infer<typeof ListDeliverablesByTaskInputSchema>;

export const RequestCrossDivisionAccessInputSchema = z.object({
  from_division: z.string().min(1).max(255),
  to_division: z.string().min(1).max(255),
  memory_id: z.string().optional(),
  justification: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  deadline: z.string().optional(),
  request_type: z.enum(['task_delegate', 'deliverable_share', 'memory_access', 'resource_request']),
});
export type RequestCrossDivisionAccessInput = z.infer<typeof RequestCrossDivisionAccessInputSchema>;

export const ApproveCrossDivisionAccessInputSchema = z.object({
  request_id: z.string().min(1).max(255),
});
export type ApproveCrossDivisionAccessInput = z.infer<typeof ApproveCrossDivisionAccessInputSchema>;

export const ListPendingCrossDivisionRequestsInputSchema = z.object({
  division_id: z.string().min(1).max(255),
});
export type ListPendingCrossDivisionRequestsInput = z.infer<typeof ListPendingCrossDivisionRequestsInputSchema>;

// Phase 7: Autonomy, Permissions and Execution Schemas

export const AutonomyLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type AutonomyLevel = z.infer<typeof AutonomyLevelSchema>;

export const ExecutionStatusSchema = z.enum([
  'proposed', 'permission_check', 'approval_required', 'approved', 'rejected',
  'queued', 'running', 'completed', 'failed', 'cancelled'
]);
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'expired', 'cancelled']);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const TaskAutonomyLevelSchema = z.object({
  task_type: z.string().min(1).max(255),
  autonomy_level: AutonomyLevelSchema,
  description: z.string().default(''),
});
export type TaskAutonomyLevel = z.infer<typeof TaskAutonomyLevelSchema> & {
  created_at: string;
  updated_at: string;
};

export const ExecutionRequestSchema = z.object({
  execution_id: z.string().min(1).max(255),
  task_id: z.string().min(1).max(255),
  requested_by_type: z.enum(['staff', 'division', 'founder']),
  requested_by_id: z.string().min(1).max(255),
  autonomy_level: AutonomyLevelSchema,
  action_description: z.string().min(1).max(2000),
  action_payload: z.record(z.string(), z.any()).default({}),
  status: ExecutionStatusSchema.default('proposed'),
  approval_request_id: z.string().optional(),
  approval_id: z.string().optional(),
  permission_grants: z.array(z.string()).default([]),
  error_message: z.string().optional(),
  result_payload: z.record(z.string(), z.any()).optional(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
});
export type ExecutionRequest = z.infer<typeof ExecutionRequestSchema> & {
  created_at: string;
  updated_at: string;
};

export const ApprovalRequestSchema = z.object({
  approval_request_id: z.string().min(1).max(255),
  execution_id: z.string().min(1).max(255),
  requested_by_type: z.enum(['staff', 'division', 'founder']),
  requested_by_id: z.string().min(1).max(255),
  action_description: z.string().min(1).max(2000),
  action_payload: z.record(z.string(), z.any()).default({}),
  justification: z.string().min(1).max(5000),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  deadline: z.string().optional(),
  status: ApprovalStatusSchema.default('pending'),
  approved_by_type: z.string().optional(),
  approved_by_id: z.string().optional(),
  approved_at: z.string().optional(),
  rejection_reason: z.string().optional(),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema> & {
  created_at: string;
  updated_at: string;
};

export const ExecutionHistorySchema = z.object({
  history_id: z.string().min(1).max(255),
  execution_id: z.string().min(1).max(255),
  task_id: z.string().min(1).max(255),
  requested_by_type: z.enum(['staff', 'division', 'founder']),
  requested_by_id: z.string().min(1).max(255),
  autonomy_level: AutonomyLevelSchema,
  action_description: z.string().min(1).max(2000),
  action_payload: z.record(z.string(), z.any()),
  status_before: z.string(),
  status_after: z.string(),
  approval_reference: z.string().optional(),
  permission_grants: z.array(z.string()).default([]),
  result_payload: z.record(z.string(), z.any()).optional(),
  error_message: z.string().optional(),
  executed_by_type: z.string().optional(),
  executed_by_id: z.string().optional(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
});
export type ExecutionHistory = z.infer<typeof ExecutionHistorySchema> & {
  recorded_at: string;
};

// Input schemas for MCP tools
export const CreateTaskAutonomyLevelInputSchema = z.object({
  task_type: z.string().min(1).max(255),
  autonomy_level: AutonomyLevelSchema,
  description: z.string().optional(),
});
export type CreateTaskAutonomyLevelInput = z.infer<typeof CreateTaskAutonomyLevelInputSchema>;

export const RequestExecutionInputSchema = z.object({
  task_id: z.string().min(1).max(255),
  action_description: z.string().min(1).max(2000),
  action_payload: z.record(z.string(), z.any()).default({}),
  autonomy_level: AutonomyLevelSchema.optional(),
});
export type RequestExecutionInput = z.infer<typeof RequestExecutionInputSchema>;

export const ApproveExecutionInputSchema = z.object({
  approval_request_id: z.string().min(1).max(255),
  approved: z.boolean(),
  rejection_reason: z.string().optional(),
});
export type ApproveExecutionInput = z.infer<typeof ApproveExecutionInputSchema>;

export const GetExecutionRequestInputSchema = z.object({
  execution_id: z.string().min(1).max(255),
});
export type GetExecutionRequestInput = z.infer<typeof GetExecutionRequestInputSchema>;

export const ListExecutionRequestsInputSchema = z.object({
  status: ExecutionStatusSchema.optional(),
  autonomy_level: AutonomyLevelSchema.optional(),
  requested_by_type: z.enum(['staff', 'division', 'founder']).optional(),
  requested_by_id: z.string().optional(),
  task_id: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});
export type ListExecutionRequestsInput = z.infer<typeof ListExecutionRequestsInputSchema>;

export const ListApprovalRequestsInputSchema = z.object({
  status: ApprovalStatusSchema.optional(),
  requested_by_type: z.enum(['staff', 'division', 'founder']).optional(),
  requested_by_id: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});
export type ListApprovalRequestsInput = z.infer<typeof ListApprovalRequestsInputSchema>;

export const GetExecutionHistoryInputSchema = z.object({
  execution_id: z.string().min(1).max(255),
});
export type GetExecutionHistoryInput = z.infer<typeof GetExecutionHistoryInputSchema>;

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

function toMemoryEntry(row: any): MemoryEntry {
  return row;
}

function toMemoryVersion(row: any): MemoryVersion {
  return row;
}

function toMemoryLink(row: any): MemoryLink {
  return row;
}

function toMemoryAccess(row: any): MemoryAccess {
  return row;
}

function toCrossDivisionShare(row: any): CrossDivisionShare {
  return row;
}

function toDivision(row: any): Division {
  return row;
}

function toStaffAgent(row: any): StaffAgent {
  return row;
}

function toDivisionMember(row: any): DivisionMember {
  return row;
}

function toTask(row: any): Task {
  return row;
}

function toDeliverable(row: any): Deliverable {
  return row;
}

function toTaskAutonomyLevel(row: any): TaskAutonomyLevel {
  return row;
}

function toExecutionRequest(row: any): ExecutionRequest {
  return {
    ...row,
    action_payload: row.action_payload ? JSON.parse(row.action_payload) : {},
    result_payload: row.result_payload ? JSON.parse(row.result_payload) : undefined,
    permission_grants: row.permission_grants ? JSON.parse(row.permission_grants) : [],
  };
}

function toApprovalRequest(row: any): ApprovalRequest {
  return {
    ...row,
    action_payload: row.action_payload ? JSON.parse(row.action_payload) : {},
  };
}

function toExecutionHistory(row: any): ExecutionHistory {
  return {
    ...row,
    action_payload: row.action_payload ? JSON.parse(row.action_payload) : {},
    result_payload: row.result_payload ? JSON.parse(row.result_payload) : undefined,
    permission_grants: row.permission_grants ? JSON.parse(row.permission_grants) : [],
  };
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

  // Phase to meeting status mapping (closure handled on completion, not start)
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

      // Update meeting status to match phase
      const expectedStatus = phaseToStatus[phase] as Meeting['status'];
      if (expectedStatus && meeting.status !== expectedStatus) {
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

      // If completing closure phase, update meeting status to closed (via validation)
      if (phase === 'closure') {
        this.updateMeetingStatus(meetingId, 'closed');
      }

      // Return updated phase from cached data (no redundant query)
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

      // Calculate weighted score using Constitution criteria (all 5 scores required by schema)
      const scores = {
        cultural_impact: input.cultural_impact_score,
        creative_output: input.creative_output_score,
        collaborative_spirit: input.collaborative_spirit_score,
        strategic_vision: input.strategic_vision_score,
        authenticity: input.authenticity_score,
      };
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

    // Phase 4: Memory and Knowledge Subsystem

    // --- Privacy Filter Helpers ---

    checkMemoryAccess(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      memory: MemoryEntry
    ): boolean {
      if (ctx.owner_type === 'founder') return true;

      const publicCategories = [
        'council_shared', 'decision_resolution', 'lesson_learned',
        'business_context', 'idea_proposal', 'research_evidence', 'unresolved_question'
      ];

      if (publicCategories.includes(memory.category)) return true;

      if (memory.category === 'individual_persona' &&
          ctx.owner_type === 'seat' && memory.owner_id === ctx.owner_id) return true;

      if (memory.category === 'division_private' &&
          ctx.owner_type === 'division' && memory.owner_id === ctx.owner_id) return true;

      if (memory.category === 'staff_private' &&
          ctx.owner_type === 'staff' && memory.owner_id === ctx.owner_id) return true;

      if (memory.category === 'meeting_history' && ctx.owner_type === 'seat') {
        // Check if seat participated in meeting
        const meeting = this.getMeeting(memory.meeting_id!);
        if (meeting) {
          const participants = this.getPrimaryIdeas(memory.meeting_id!)
            .map(p => p.seat_id);
          return participants.includes(ctx.owner_id);
        }
        return false;
      }

      if (memory.category === 'division_shared' &&
          ctx.owner_type === 'division' && memory.division_id === ctx.owner_id) return true;

      if (memory.category === 'cross_division' && memory.division_id) {
        // Check cross_division_shares - owner can always access
        if (memory.owner_type === ctx.owner_type && memory.owner_id === ctx.owner_id) return true;
        const shares = dbInstance.stmt.getCrossDivisionShares.all(memory.memory_id) as CrossDivisionShare[];
        return shares.some(s => s.division_id === (ctx.owner_type === 'division' ? ctx.owner_id : memory.division_id));
      }

      if (memory.category === 'task_history') {
        // Check task assignment
        return true; // Simplified - would check tasks table
      }

      return false;
    },

    buildPrivacyFilter(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }
    ): { sql: string; values: any[] } {
      const values: any[] = [];
      let sql = '';

      if (ctx.owner_type === 'founder') {
        sql = '1=1';
      } else if (ctx.owner_type === 'seat') {
        sql = `(
          m.category IN ('council_shared', 'decision_resolution', 'lesson_learned', 'business_context', 'idea_proposal', 'research_evidence', 'unresolved_question')
          OR (m.owner_type = 'seat' AND m.owner_id = ? AND m.category = 'individual_persona')
          OR (m.category = 'meeting_history' AND m.meeting_id IN (
            SELECT DISTINCT meeting_id FROM primary_ideas WHERE seat_id = ?
          ))
          OR (m.category = 'task_history' AND m.task_id IN (
            SELECT task_id FROM tasks WHERE (assigned_to_type = 'seat' AND assigned_to_id = ?) OR (created_by_type = 'seat' AND created_by_id = ?)
          ))
        )`;
        values.push(ctx.owner_id, ctx.owner_id, ctx.owner_id, ctx.owner_id);
      } else if (ctx.owner_type === 'division') {
        sql = `(
          m.category IN ('council_shared', 'decision_resolution', 'lesson_learned', 'business_context', 'idea_proposal', 'research_evidence', 'unresolved_question')
          OR (m.owner_type = 'division' AND m.owner_id = ? AND m.category IN ('division_shared', 'division_private'))
          OR (m.category = 'division_shared' AND m.division_id = ?)
          OR (m.category = 'cross_division' AND m.division_id IN (
            SELECT division_id FROM cross_division_shares WHERE memory_id = m.memory_id AND revoked_at IS NULL
          ))
          OR (m.category = 'task_history' AND m.task_id IN (
            SELECT task_id FROM tasks WHERE (assigned_to_type = 'division' AND assigned_to_id = ?) OR (created_by_type = 'division_head' AND created_by_id = ?)
          ))
        )`;
        values.push(ctx.owner_id, ctx.owner_id, ctx.owner_id, ctx.owner_id);
      } else if (ctx.owner_type === 'staff') {
        sql = `(
          m.category IN ('council_shared', 'decision_resolution', 'lesson_learned', 'business_context', 'idea_proposal', 'research_evidence', 'unresolved_question')
          OR (m.owner_type = 'staff' AND m.owner_id = ? AND m.category = 'staff_private')
          OR (m.category = 'division_shared' AND m.division_id IN (
            SELECT division_id FROM division_members WHERE staff_id = ?
          ))
          OR (m.category = 'cross_division' AND m.division_id IN (
            SELECT division_id FROM cross_division_shares WHERE memory_id = m.memory_id AND revoked_at IS NULL
          ))
          OR (m.category = 'task_history' AND m.task_id IN (
            SELECT task_id FROM tasks WHERE assigned_to_type = 'staff' AND assigned_to_id = ?
          ))
        )`;
        values.push(ctx.owner_id, ctx.owner_id, ctx.owner_id);
      }

      return { sql, values };
    },

    // --- Memory CRUD ---

    createMemory(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof CreateMemoryInputSchema>
    ): MemoryEntry {
      // Validate category-specific rules
      this.validateMemoryCreation(ctx, input);

      const tx = dbInstance.stmt.beginTransaction.run();
      try {
        const memoryId = dbInstance.generateId();
        const now = new Date().toISOString();
        const tagsJson = JSON.stringify(input.tags || []);

        dbInstance.stmt.insertMemory.run(
          memoryId,
          ctx.owner_type,
          ctx.owner_id,
          input.category,
          input.memory_type,
          input.title,
          JSON.stringify(input.content),
          tagsJson,
          input.confidence ?? 1.0,
          1,
          null,
          input.meeting_id || null,
          input.division_id || null,
          input.task_id || null,
          null,
          now,
          now
        );

        dbInstance.stmt.insertMemoryVersion.run(
          dbInstance.generateId(), memoryId, 1, input.title,
          JSON.stringify(input.content), tagsJson,
          input.confidence ?? 1.0,
          ctx.owner_type, ctx.owner_id, ctx.runtime, 'Initial creation', now
        );

        dbInstance.stmt.insertMemoryAccess.run(
          dbInstance.generateId(), memoryId, null, ctx.owner_type, ctx.owner_id, ctx.runtime, 'create', now
        );

        dbInstance.stmt.commitTransaction.run();
        return toMemoryEntry(dbInstance.stmt.getMemoryById.get(memoryId));
      } catch (error) {
        dbInstance.stmt.rollbackTransaction.run();
        throw error;
      }
    },

    validateMemoryCreation(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof CreateMemoryInputSchema>
    ): void {
      // Seat-level categories
      if (['individual_persona'].includes(input.category)) {
        if (ctx.owner_type !== 'seat') {
          throw new Error(`Category '${input.category}' requires seat owner_type`);
        }
      }

      // Council-level categories
      if (['council_shared', 'decision_resolution', 'lesson_learned', 'unresolved_question'].includes(input.category)) {
        if (ctx.owner_type !== 'seat' && ctx.owner_type !== 'founder') {
          throw new Error(`Category '${input.category}' requires seat or founder owner_type`);
        }
      }

      // Meeting history - must have meeting_id
      if (input.category === 'meeting_history') {
        if (!input.meeting_id) {
          throw new Error(`Category 'meeting_history' requires meeting_id`);
        }
        const meeting = this.getMeeting(input.meeting_id);
        if (!meeting) {
          throw new Error(`Meeting '${input.meeting_id}' not found`);
        }
      }

      // Division-level categories
      if (['division_shared', 'division_private'].includes(input.category)) {
        if (ctx.owner_type !== 'division' && ctx.owner_type !== 'staff') {
          throw new Error(`Category '${input.category}' requires division or staff owner_type`);
        }
        if (!input.division_id) {
          throw new Error(`Category '${input.category}' requires division_id`);
        }
        if (input.category === 'division_private' && ctx.owner_type !== 'division') {
          throw new Error(`Category 'division_private' requires division owner_type (head only)`);
        }
      }

      // Staff private
      if (input.category === 'staff_private') {
        if (ctx.owner_type !== 'staff') {
          throw new Error(`Category 'staff_private' requires staff owner_type`);
        }
      }

      // Business context
      if (input.category === 'business_context') {
        if (ctx.owner_type !== 'founder' && ctx.owner_type !== 'seat' && ctx.owner_type !== 'division') {
          throw new Error(`Category 'business_context' requires founder, seat, or division owner_type`);
        }
      }

      // Task history
      if (input.category === 'task_history') {
        if (!input.task_id) {
          throw new Error(`Category 'task_history' requires task_id`);
        }
      }

      // Cross-division
      if (input.category === 'cross_division') {
        if (!input.division_id) {
          throw new Error(`Category 'cross_division' requires division_id`);
        }
        // Verify cross_division_shares grant exists (or will be created)
      }
    },

    getMemory(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      memoryId: string,
      options?: { include_versions?: boolean; include_links?: boolean; version?: number }
    ): { memory: MemoryEntry; versions?: MemoryVersion[]; links?: MemoryLink[] } | undefined {
      const memory = dbInstance.stmt.getMemoryById.get(memoryId) as MemoryEntry | undefined;
      if (!memory) return undefined;

      if (!this.checkMemoryAccess(ctx, memory)) {
        return undefined;
      }

      // Log access
      const now = new Date().toISOString();
      dbInstance.stmt.insertMemoryAccess.run(
        dbInstance.generateId(), memoryId, options?.version || null,
        ctx.owner_type, ctx.owner_id, ctx.runtime, 'read', now
      );

      const result: any = { memory: toMemoryEntry(memory) };

      if (options?.include_versions) {
        result.versions = (dbInstance.stmt.getMemoryVersions.all(memoryId, 50) as any[]).map(toMemoryVersion);
      }

      if (options?.include_links) {
        result.links = (dbInstance.stmt.getMemoryLinks.all(memoryId, memoryId) as any[]).map(toMemoryLink);
      }

      return result;
    },

    updateMemory(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof UpdateMemoryInputSchema>
    ): MemoryEntry {
      const memory = dbInstance.stmt.getMemoryById.get(input.memory_id) as MemoryEntry | undefined;
      if (!memory) {
        throw new Error(`Memory '${input.memory_id}' not found`);
      }

      if (!this.checkMemoryAccess(ctx, memory)) {
        throw new Error(`Access denied to memory '${input.memory_id}'`);
      }

      // Immutable categories
      if (memory.category === 'decision_resolution') {
        throw new Error(`Category 'decision_resolution' is immutable; create new version with supersedes link instead`);
      }

      if (memory.category === 'meeting_history') {
        // Check if meeting phase allows updates
        const meeting = this.getMeeting(memory.meeting_id!);
        if (meeting && ['closed', 'archived', 'cancelled'].includes(meeting.status)) {
          throw new Error(`Meeting history frozen after meeting closure`);
        }
      }

      const tx = dbInstance.stmt.beginTransaction.run();
      try {
        const now = new Date().toISOString();
        const newTitle = input.title ?? memory.title;
        const newContent = input.content ? JSON.stringify(input.content) : memory.content;
        const newTags = input.tags ? JSON.stringify(input.tags) : memory.tags;
        const newConfidence = input.confidence ?? memory.confidence;

        // Update memory entry (increments version, sets supersedes_id)
        dbInstance.stmt.updateMemory.run(
          newTitle, newContent, newTags, newConfidence,
          memory.memory_id, // supersedes_id points to current (which becomes previous)
          memory.memory_id
        );

        // Create version record
        const newVersion = memory.version + 1;
        dbInstance.stmt.insertMemoryVersion.run(
          dbInstance.generateId(), memory.memory_id, newVersion,
          newTitle, newContent, newTags, newConfidence,
          ctx.owner_type, ctx.owner_id, ctx.runtime, input.change_summary, now
        );

        // Log access
        dbInstance.stmt.insertMemoryAccess.run(
          dbInstance.generateId(), memory.memory_id, newVersion,
          ctx.owner_type, ctx.owner_id, ctx.runtime, 'update', now
        );

        dbInstance.stmt.commitTransaction.run();
        return toMemoryEntry(dbInstance.stmt.getMemoryById.get(input.memory_id));
      } catch (error) {
        dbInstance.stmt.rollbackTransaction.run();
        throw error;
      }
    },

    archiveMemory(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      memoryId: string
    ): MemoryEntry {
      const memory = dbInstance.stmt.getMemoryById.get(memoryId) as MemoryEntry | undefined;
      if (!memory) {
        throw new Error(`Memory '${memoryId}' not found`);
      }

      if (!this.checkMemoryAccess(ctx, memory)) {
        throw new Error(`Access denied to memory '${memoryId}'`);
      }

      // Check archival rules
      const immutableCategories = ['decision_resolution', 'meeting_history', 'task_history'];
      if (immutableCategories.includes(memory.category)) {
        throw new Error(`Category '${memory.category}' cannot be archived`);
      }

      const now = new Date().toISOString();
      dbInstance.stmt.archiveMemory.run(memoryId);
      dbInstance.stmt.insertMemoryAccess.run(
        dbInstance.generateId(), memoryId, memory.version,
        ctx.owner_type, ctx.owner_id, ctx.runtime, 'update', now
      );

      return toMemoryEntry(dbInstance.stmt.getMemoryById.get(memoryId));
    },

    restoreMemory(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      memoryId: string
    ): MemoryEntry {
      const memory = dbInstance.stmt.getMemoryById.get(memoryId) as MemoryEntry | undefined;
      if (!memory) {
        throw new Error(`Memory '${memoryId}' not found`);
      }

      if (!this.checkMemoryAccess(ctx, memory)) {
        throw new Error(`Access denied to memory '${memoryId}'`);
      }

      const now = new Date().toISOString();
      dbInstance.stmt.restoreMemory.run(memoryId);
      dbInstance.stmt.insertMemoryAccess.run(
        dbInstance.generateId(), memoryId, memory.version,
        ctx.owner_type, ctx.owner_id, ctx.runtime, 'update', now
      );

      return toMemoryEntry(dbInstance.stmt.getMemoryById.get(memoryId));
    },

    // --- Memory Retrieval ---

    getMemoryEntriesByOwner(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      ownerType: MemoryOwnerType,
      ownerId: string,
      limit = 50,
      offset = 0
    ): MemoryEntry[] {
      // Can only query own memory unless founder
      if (ctx.owner_type !== 'founder' && (ownerType !== ctx.owner_type || ownerId !== ctx.owner_id)) {
        return [];
      }
      return (dbInstance.stmt.getMemoryEntriesByOwner.all(ownerType, ownerId, limit, offset) as any[]).map(toMemoryEntry);
    },

    getMemoryEntriesByCategory(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      category: z.infer<typeof MemoryCategorySchema>,
      limit = 50,
      offset = 0
    ): MemoryEntry[] {
      const all = (dbInstance.stmt.getMemoryEntriesByCategory.all(category, limit, offset) as any[]).map(toMemoryEntry);
      return all.filter(m => this.checkMemoryAccess(ctx, m));
    },

    getMemoryEntriesByMeeting(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      meetingId: string
    ): MemoryEntry[] {
      const all = (dbInstance.stmt.getMemoryEntriesByMeeting.all(meetingId) as any[]).map(toMemoryEntry);
      return all.filter(m => this.checkMemoryAccess(ctx, m));
    },

    getMemoryEntriesByDivision(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      divisionId: string,
      limit = 50,
      offset = 0
    ): MemoryEntry[] {
      const all = (dbInstance.stmt.getMemoryEntriesByDivision.all(divisionId, limit, offset) as any[]).map(toMemoryEntry);
      return all.filter(m => this.checkMemoryAccess(ctx, m));
    },

    getMemoryEntriesByTask(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      taskId: string
    ): MemoryEntry[] {
      const all = (dbInstance.stmt.getMemoryEntriesByTask.all(taskId) as any[]).map(toMemoryEntry);
      return all.filter(m => this.checkMemoryAccess(ctx, m));
    },

    searchMemory(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof SearchMemoryInputSchema>
    ): MemoryEntry[] {
      const conditions = ['m.archived_at IS NULL'];
      const values: any[] = [];

      if (!input.include_archived) {
        conditions.push('m.archived_at IS NULL');
      }

      const privacy = this.buildPrivacyFilter(ctx);
      conditions.push(`(${privacy.sql})`);
      values.push(...privacy.values);

      if (input.category) { conditions.push('m.category = ?'); values.push(input.category); }
      if (input.memory_type) { conditions.push('m.memory_type = ?'); values.push(input.memory_type); }
      if (input.meeting_id) { conditions.push('m.meeting_id = ?'); values.push(input.meeting_id); }
      if (input.division_id) { conditions.push('m.division_id = ?'); values.push(input.division_id); }
      if (input.task_id) { conditions.push('m.task_id = ?'); values.push(input.task_id); }
      if (input.min_confidence) { conditions.push('m.confidence >= ?'); values.push(input.min_confidence); }
      if (input.tags?.length) {
        conditions.push(`EXISTS (SELECT 1 FROM json_each(m.tags) WHERE value IN (${input.tags.map(() => '?').join(',')}))`);
        values.push(...input.tags);
      }

      let query = `
        SELECT m.* FROM memory_entries m
        ${input.query ? 'JOIN memory_fts f ON m.memory_id = f.memory_id' : ''}
        WHERE ${conditions.join(' AND ')}
      `;

      if (input.query) {
        values.unshift(input.query);
        query = query.replace('WHERE', 'WHERE memory_fts MATCH ? AND');
      }

      query += ' ORDER BY m.updated_at DESC LIMIT ? OFFSET ?';
      values.push(input.limit ?? 50, input.offset ?? 0);

      // Note: search access logging uses a special pattern since it doesn't target a single memory
      // We skip memory_access insert for search to avoid FK constraint on empty memory_id
      // In production, this would be logged separately or with a NULL memory_id if schema allows

      const rawStmt = dbInstance.db.prepare(query);
      return (rawStmt.all(...values) as any[]).map(toMemoryEntry);
    },

    // --- Memory Versions ---

    getMemoryVersions(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      memoryId: string,
      limit = 50
    ): MemoryVersion[] {
      const memory = dbInstance.stmt.getMemoryById.get(memoryId) as MemoryEntry | undefined;
      if (!memory || !this.checkMemoryAccess(ctx, memory)) {
        return [];
      }

      const now = new Date().toISOString();
      dbInstance.stmt.insertMemoryAccess.run(
        dbInstance.generateId(), memoryId, null,
        ctx.owner_type, ctx.owner_id, ctx.runtime, 'read', now
      );

      return (dbInstance.stmt.getMemoryVersions.all(memoryId, limit) as any[]).map(toMemoryVersion);
    },

    getMemoryVersion(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      memoryId: string,
      versionNum: number
    ): MemoryVersion | undefined {
      const memory = dbInstance.stmt.getMemoryById.get(memoryId) as MemoryEntry | undefined;
      if (!memory || !this.checkMemoryAccess(ctx, memory)) {
        return undefined;
      }

      const version = dbInstance.stmt.getMemoryVersion.get(memoryId, versionNum) as MemoryVersion | undefined;
      if (version) {
        const now = new Date().toISOString();
        dbInstance.stmt.insertMemoryAccess.run(
          dbInstance.generateId(), memoryId, versionNum,
          ctx.owner_type, ctx.owner_id, ctx.runtime, 'read', now
        );
      }
      return version ? toMemoryVersion(version) : undefined;
    },

    // --- Memory Links ---

    linkMemory(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof LinkMemoryInputSchema>
    ): MemoryLink {
      const source = dbInstance.stmt.getMemoryById.get(input.source_memory_id) as MemoryEntry | undefined;
      const target = dbInstance.stmt.getMemoryById.get(input.target_memory_id) as MemoryEntry | undefined;

      if (!source || !target) {
        throw new Error(`Source or target memory not found`);
      }

      if (!this.checkMemoryAccess(ctx, source) || !this.checkMemoryAccess(ctx, target)) {
        throw new Error(`Access denied to source or target memory`);
      }

      // Prevent self-links
      if (input.source_memory_id === input.target_memory_id) {
        throw new Error(`Cannot link memory to itself`);
      }

      // Validate link_type rules
      if (input.link_type === 'supersedes') {
        if (source.category !== target.category) {
          throw new Error(`supersedes link requires same category`);
        }
        if (target.category !== 'decision_resolution' && target.category !== 'idea_proposal') {
          throw new Error(`supersedes link only valid for decision_resolution or idea_proposal categories`);
        }
      }

      const now = new Date().toISOString();
      const linkId = dbInstance.generateId();

      dbInstance.stmt.insertMemoryLink.run(
        linkId,
        input.source_memory_id,
        input.target_memory_id,
        input.link_type,
        input.strength,
        input.notes ?? '',
        ctx.owner_type,
        ctx.owner_id,
        ctx.runtime,
        now
      );

      // Log access for both memories
      dbInstance.stmt.insertMemoryAccess.run(
        dbInstance.generateId(), input.source_memory_id, source.version,
        ctx.owner_type, ctx.owner_id, ctx.runtime, 'link', now
      );
      dbInstance.stmt.insertMemoryAccess.run(
        dbInstance.generateId(), input.target_memory_id, target.version,
        ctx.owner_type, ctx.owner_id, ctx.runtime, 'link', now
      );

      return toMemoryLink(dbInstance.stmt.getMemoryLinks.all(input.source_memory_id, input.target_memory_id)
        .find((l: any) => l.link_id === linkId));
    },

    getMemoryLinks(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      memoryId: string
    ): MemoryLink[] {
      const memory = dbInstance.stmt.getMemoryById.get(memoryId) as MemoryEntry | undefined;
      if (!memory || !this.checkMemoryAccess(ctx, memory)) {
        return [];
      }

      const now = new Date().toISOString();
      dbInstance.stmt.insertMemoryAccess.run(
        dbInstance.generateId(), memoryId, memory.version,
        ctx.owner_type, ctx.owner_id, ctx.runtime, 'read', now
      );

      return (dbInstance.stmt.getMemoryLinks.all(memoryId, memoryId) as any[]).map(toMemoryLink);
    },

    getRelated(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof GetRelatedInputSchema>
    ): Array<{ memory: MemoryEntry; link_type: string; strength: number; depth: number; path: string }> {
      const maxDepth = input.max_depth ?? 3;
      let results: Array<{ memory: MemoryEntry; link_type: string; strength: number; depth: number; path: string }> = [];
      let currentDepth = 0;
      let currentNodes = [{ memory_id: input.memory_id, path: '', link_type: null as string | null }];

      const startMemory = dbInstance.stmt.getMemoryById.get(input.memory_id) as MemoryEntry | undefined;
      if (!startMemory || !this.checkMemoryAccess(ctx, startMemory)) {
        return [];
      }

      while (currentDepth < maxDepth && currentNodes.length > 0) {
        const nextNodes: typeof currentNodes = [];

        for (const node of currentNodes) {
          const links = (input.direction === 'in'
            ? dbInstance.stmt.getLinksByTarget.all(node.memory_id)
            : input.direction === 'out'
            ? dbInstance.stmt.getLinksBySource.all(node.memory_id)
            : dbInstance.stmt.getMemoryLinks.all(node.memory_id, node.memory_id)) as MemoryLink[];

          for (const link of links) {
            if (input.link_type && link.link_type !== input.link_type) continue;

            const targetId = input.direction === 'in' ? link.source_memory_id : link.target_memory_id;
            const target = dbInstance.stmt.getMemoryById.get(targetId) as MemoryEntry | undefined;
            if (!target || target.archived_at) continue;

            if (!this.checkMemoryAccess(ctx, target)) continue;

            if (node.path.includes(targetId)) continue; // cycle detection

            results.push({
              memory: toMemoryEntry(target),
              link_type: link.link_type,
              strength: link.strength,
              depth: currentDepth + 1,
              path: node.path + '->' + targetId
            });

            nextNodes.push({ memory_id: targetId, path: node.path + '->' + targetId, link_type: link.link_type });
          }
        }

        currentNodes = nextNodes;
        currentDepth++;
      }

      // Log access
      const now = new Date().toISOString();
      dbInstance.stmt.insertMemoryAccess.run(
        dbInstance.generateId(), input.memory_id, null,
        ctx.owner_type, ctx.owner_id, ctx.runtime, 'read', now
      );

      return results;
    },

    // --- Cross-Division Shares ---

    grantCrossDivisionAccess(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof GrantCrossDivisionAccessInputSchema>
    ): CrossDivisionShare {
      const memory = dbInstance.stmt.getMemoryById.get(input.memory_id) as MemoryEntry | undefined;
      if (!memory) {
        throw new Error(`Memory '${input.memory_id}' not found`);
      }

      if (!this.checkMemoryAccess(ctx, memory)) {
        throw new Error(`Access denied to memory '${input.memory_id}'`);
      }

      if (memory.category !== 'cross_division') {
        throw new Error(`Cross-division sharing only allowed for 'cross_division' category`);
      }

      // Only division head or founder can grant
      if (ctx.owner_type !== 'division' && ctx.owner_type !== 'founder') {
        throw new Error(`Only division head or founder can grant cross-division access`);
      }

      const existing = dbInstance.stmt.getCrossDivisionShares.all(input.memory_id) as CrossDivisionShare[];
      if (existing.some(s => s.division_id === input.division_id && !s.revoked_at)) {
        throw new Error(`Division '${input.division_id}' already has access to this memory`);
      }

      const now = new Date().toISOString();
      const shareId = dbInstance.generateId();

      dbInstance.stmt.insertCrossDivisionShare.run(
        shareId, input.memory_id, input.division_id,
        ctx.owner_type, ctx.owner_id, now
      );

      const now2 = new Date().toISOString();
      dbInstance.stmt.insertMemoryAccess.run(
        dbInstance.generateId(), input.memory_id, memory.version,
        ctx.owner_type, ctx.owner_id, ctx.runtime, 'link', now2
      );

      return toCrossDivisionShare(dbInstance.stmt.getCrossDivisionShares.all(input.memory_id)
        .find((s: any) => s.share_id === shareId));
    },

    revokeCrossDivisionAccess(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof RevokeCrossDivisionAccessInputSchema>
    ): boolean {
      const memory = dbInstance.stmt.getMemoryById.get(input.memory_id) as MemoryEntry | undefined;
      if (!memory) {
        throw new Error(`Memory '${input.memory_id}' not found`);
      }

      if (!this.checkMemoryAccess(ctx, memory)) {
        throw new Error(`Access denied to memory '${input.memory_id}'`);
      }

      if (ctx.owner_type !== 'division' && ctx.owner_type !== 'founder') {
        throw new Error(`Only division head or founder can revoke cross-division access`);
      }

      const result = dbInstance.stmt.revokeCrossDivisionShare.run(input.memory_id, input.division_id);
      if (result.changes > 0) {
        const now = new Date().toISOString();
        dbInstance.stmt.insertMemoryAccess.run(
          dbInstance.generateId(), input.memory_id, memory.version,
          ctx.owner_type, ctx.owner_id, ctx.runtime, 'link', now
        );
        return true;
      }
      return false;
    },

    getCrossDivisionShares(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      memoryId?: string,
      divisionId?: string
    ): CrossDivisionShare[] {
      if (memoryId) {
        const memory = dbInstance.stmt.getMemoryById.get(memoryId) as MemoryEntry | undefined;
        if (!memory || !this.checkMemoryAccess(ctx, memory)) {
          return [];
        }
        return (dbInstance.stmt.getCrossDivisionShares.all(memoryId) as any[]).map(toCrossDivisionShare);
      }

      if (divisionId) {
        // Check if requester can see this division's shares
        if (ctx.owner_type !== 'founder' &&
            !(ctx.owner_type === 'division' && ctx.owner_id === divisionId)) {
          return [];
        }
        return (dbInstance.stmt.getSharesByDivision.all(divisionId) as any[]).map(toCrossDivisionShare);
      }

      return [];
    },

    // --- Memory Access Log ---

    getMemoryAccessLog(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      memoryId: string,
      limit = 50
    ): MemoryAccess[] {
      const memory = dbInstance.stmt.getMemoryById.get(memoryId) as MemoryEntry | undefined;
      if (!memory || !this.checkMemoryAccess(ctx, memory)) {
        return [];
      }

      return (dbInstance.stmt.getMemoryAccessLog.all(memoryId, limit) as any[]).map(toMemoryAccess);
    },

    // --- Permission Validation Functions ---

    isFounder(ctx: { owner_type: MemoryOwnerType; owner_id: string }): boolean {
      return ctx.owner_type === 'founder';
    },

    isDivisionHead(ctx: { owner_type: MemoryOwnerType; owner_id: string }, divisionId: string): boolean {
      if (ctx.owner_type !== 'division') return false;
      // Division acts as its head - ctx.owner_id is the division_id
      return ctx.owner_id === divisionId;
    },

    isDivisionMember(ctx: { owner_type: MemoryOwnerType; owner_id: string }, divisionId: string): boolean {
      if (ctx.owner_type === 'founder') return true;
      if (ctx.owner_type === 'division') return ctx.owner_id === divisionId;
      if (ctx.owner_type === 'staff') {
        const members = dbInstance.stmt.getDivisionMembers.all(divisionId) as DivisionMember[];
        const member = members.find((m) => m.staff_id === ctx.owner_id);
        return !!member;
      }
      return false;
    },

    isStaffAgent(ctx: { owner_type: MemoryOwnerType; owner_id: string }, staffId: string): boolean {
      if (ctx.owner_type === 'founder') return true;
      return ctx.owner_type === 'staff' && ctx.owner_id === staffId;
    },

    validateStaffRuntime(staffId: string, runtime: 'claude' | 'hermes'): boolean {
      const staff = dbInstance.stmt.getStaffAgentById.get(staffId) as StaffAgent | undefined;
      if (!staff || staff.status !== 'active') return false;
      const instances = JSON.parse(staff.runtime_instances || '[]') as string[];
      return instances.includes(runtime);
    },

    validateDivisionHead(staffId: string, divisionId: string): boolean {
      const division = dbInstance.stmt.getDivisionById.get(divisionId) as Division | undefined;
      return division?.head_staff_id === staffId;
    },

    validateSeatOccupation(seatId: string, runtime: 'claude' | 'hermes'): boolean {
      const seat = dbInstance.stmt.getSeatById.get(seatId) as CouncilSeat | undefined;
      if (!seat || seat.status === 'vacant') return false;
      const personas = dbInstance.stmt.getRuntimePersonas.all(runtime) as { seat_id: string }[];
      return personas.some((p) => p.seat_id === seatId);
    },

    // --- Division Management ---

    createDivision(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof CreateDivisionInputSchema>
    ): Division {
      if (!this.isFounder(ctx)) {
        throw new Error('Only Founder can create divisions');
      }

      const divisionId = dbInstance.generateId();
      const now = new Date().toISOString();

      dbInstance.stmt.insertDivision.run(
        divisionId,
        input.name,
        input.description ?? '',
        null,
        input.budget_limit ?? 0,
        JSON.stringify(input.permissions ?? []),
        JSON.stringify(input.strategic_objectives ?? [])
      );

      // Note: Divisions are not memory_entries, so we don't log to memory_access table
      // (memory_access FK references memory_entries, not divisions)

      return toDivision(dbInstance.stmt.getDivisionById.get(divisionId) as any);
    },

    assignDivisionHead(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof AssignDivisionHeadInputSchema>
    ): Division {
      if (!this.isFounder(ctx)) {
        throw new Error('Only Founder can assign division heads');
      }

      const division = dbInstance.stmt.getDivisionById.get(input.division_id) as Division | undefined;
      if (!division) {
        throw new Error(`Division '${input.division_id}' not found`);
      }

      const staff = dbInstance.stmt.getStaffAgentById.get(input.staff_id) as StaffAgent | undefined;
      if (!staff) {
        throw new Error(`Staff agent '${input.staff_id}' not found`);
      }

      if (staff.division_id !== input.division_id) {
        throw new Error(`Staff agent '${input.staff_id}' is not a member of division '${input.division_id}'`);
      }

      if (staff.status !== 'active') {
        throw new Error(`Staff agent '${input.staff_id}' is not active`);
      }

      const now = new Date().toISOString();
      dbInstance.stmt.updateDivision.run(
        input.division_id,
        division.name,
        division.description,
        input.staff_id,
        division.budget_limit,
        division.permissions,
        division.strategic_objectives,
        now
      );

      // Update division_members role to 'head'
      dbInstance.stmt.insertDivisionMember.run(input.division_id, input.staff_id, 'head');

      // Log access
      dbInstance.stmt.insertMemoryAccess.run(
        dbInstance.generateId(), input.division_id, null,
        ctx.owner_type, ctx.owner_id, ctx.runtime, 'update', now
      );

      return toDivision(dbInstance.stmt.getDivisionById.get(input.division_id) as any);
    },

    updateDivision(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof UpdateDivisionInputSchema>
    ): Division {
      const division = dbInstance.stmt.getDivisionById.get(input.division_id) as Division | undefined;
      if (!division) {
        throw new Error(`Division '${input.division_id}' not found`);
      }

      // Only Founder or Division Head of this division can update
      if (!this.isFounder(ctx) && !this.isDivisionHead(ctx, input.division_id)) {
        throw new Error('Only Founder or Division Head can update division');
      }

      const now = new Date().toISOString();
      dbInstance.stmt.updateDivision.run(
        input.division_id,
        division.name,
        division.description,
        input.head_staff_id ?? division.head_staff_id,
        input.budget_limit ?? division.budget_limit,
        input.permissions ? JSON.stringify(input.permissions) : division.permissions,
        input.strategic_objectives ? JSON.stringify(input.strategic_objectives) : division.strategic_objectives,
        now
      );

      // Log access
      dbInstance.stmt.insertMemoryAccess.run(
        dbInstance.generateId(), input.division_id, null,
        ctx.owner_type, ctx.owner_id, ctx.runtime, 'update', now
      );

      return toDivision(dbInstance.stmt.getDivisionById.get(input.division_id) as any);
    },

    listDivisions(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }
    ): Division[] {
      if (!this.isFounder(ctx)) {
        throw new Error('Only Founder can list all divisions');
      }
      return (dbInstance.stmt.listDivisions.all() as any[]).map(toDivision);
    },

    getDivision(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      divisionId: string
    ): Division | undefined {
      const division = dbInstance.stmt.getDivisionById.get(divisionId) as Division | undefined;
      if (!division) return undefined;

      if (!this.isFounder(ctx) && !this.isDivisionMember(ctx, divisionId)) {
        return undefined;
      }

      return toDivision(division);
    },

    listSpecialists(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof ListSpecialistsInputSchema>
    ): StaffAgent[] {
      if (!this.isFounder(ctx) && !this.isDivisionMember(ctx, input.division_id)) {
        throw new Error('Access denied to division specialists');
      }

      return (dbInstance.stmt.listStaffAgentsByDivision.all(input.division_id) as any[]).map(toStaffAgent);
    },

    // --- Staff Agent Management ---

    registerStaffAgent(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof RegisterStaffAgentInputSchema>
    ): StaffAgent {
      if (!this.isFounder(ctx)) {
        throw new Error('Only Founder can register staff agents');
      }

      const division = dbInstance.stmt.getDivisionById.get(input.division_id) as Division | undefined;
      if (!division) {
        throw new Error(`Division '${input.division_id}' not found`);
      }

      // Check division doesn't already have too many specialists
      const count = dbInstance.stmt.listStaffAgentsByDivision.all(input.division_id).length;
      if (count >= 7) {
        throw new Error(`Division '${input.division_id}' max specialists reached`);
      }

      // Check not already registered
      const existing = dbInstance.stmt.getStaffAgentById.get(input.staff_id) as StaffAgent | undefined;
      if (existing) {
        throw new Error(`Staff agent '${input.staff_id}' already exists`);
      }

      const now = new Date().toISOString();
      // Insert with 'inactive' status (default per Migration 001)
      dbInstance.stmt.insertStaffAgent.run(
        input.staff_id,
        input.name,
        input.role,
        input.division_id,
        JSON.stringify(input.runtime_instances),
        JSON.stringify(input.permissions),
        'inactive'
      );

      // Insert into division_members (role: specialist)
      dbInstance.stmt.insertDivisionMember.run(input.division_id, input.staff_id, 'specialist');

      // Note: Staff agents are not memory_entries, so we don't log to memory_access table
      // (memory_access FK references memory_entries, not staff_agents)

      return toStaffAgent(dbInstance.stmt.getStaffAgentById.get(input.staff_id) as any);
    },

    updateStaffStatus(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof UpdateStaffStatusInputSchema>
    ): StaffAgent {
      if (!this.isFounder(ctx)) {
        throw new Error('Only Founder can update staff status');
      }

      const staff = dbInstance.stmt.getStaffAgentById.get(input.staff_id) as StaffAgent | undefined;
      if (!staff) {
        throw new Error(`Staff agent '${input.staff_id}' not found`);
      }

      const now = new Date().toISOString();
      dbInstance.stmt.updateStaffAgent.run(
        staff.name,
        staff.role,
        staff.division_id,
        staff.runtime_instances,
        staff.permissions,
        input.status,
        input.staff_id
      );

      // Note: Staff agents are not memory_entries, so we don't log to memory_access table

      return toStaffAgent(dbInstance.stmt.getStaffAgentById.get(input.staff_id) as any);
    },

    updateStaffPermissions(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof UpdateStaffPermissionsInputSchema>
    ): StaffAgent {
      if (!this.isFounder(ctx)) {
        throw new Error('Only Founder can update staff permissions');
      }

      const staff = dbInstance.stmt.getStaffAgentById.get(input.staff_id) as StaffAgent | undefined;
      if (!staff) {
        throw new Error(`Staff agent '${input.staff_id}' not found`);
      }

      const now = new Date().toISOString();
      dbInstance.stmt.updateStaffAgent.run(
        staff.name,
        staff.role,
        staff.division_id,
        staff.runtime_instances,
        JSON.stringify(input.permissions),
        staff.status,
        now,
        input.staff_id
      );

      // Log access
      dbInstance.stmt.insertMemoryAccess.run(
        dbInstance.generateId(), input.staff_id, null,
        ctx.owner_type, ctx.owner_id, ctx.runtime, 'update', now
      );

      return toStaffAgent(dbInstance.stmt.getStaffAgentById.get(input.staff_id) as any);
    },

    suspendStaffAgent(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof SuspendStaffAgentInputSchema>
    ): StaffAgent {
      return this.updateStaffStatus(ctx, { staff_id: input.staff_id, status: 'inactive' });
    },

    retireStaffAgent(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof RetireStaffAgentInputSchema>
    ): StaffAgent {
      if (!this.isFounder(ctx)) {
        throw new Error('Only Founder can retire staff agents');
      }

      const staff = dbInstance.stmt.getStaffAgentById.get(input.staff_id) as StaffAgent | undefined;
      if (!staff) {
        throw new Error(`Staff agent '${input.staff_id}' not found`);
      }

      // Remove from division_members
      dbInstance.db.prepare('DELETE FROM division_members WHERE staff_id = ?').run(input.staff_id);

      // Update status to terminated
      const result = this.updateStaffStatus(ctx, { staff_id: input.staff_id, status: 'terminated' });

      // Log access
      const now = new Date().toISOString();
      dbInstance.stmt.insertMemoryAccess.run(
        dbInstance.generateId(), input.staff_id, null,
        ctx.owner_type, ctx.owner_id, ctx.runtime, 'update', now
      );

      return result;
    },

    // --- Task Management ---

    createTask(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof CreateTaskInputSchema>
    ): Task {
      // Validate permissions based on creator type
      if (input.created_by_type === 'founder' && !this.isFounder(ctx)) {
        throw new Error('Only Founder can create tasks as founder');
      }
      if (input.created_by_type === 'division_head') {
        if (ctx.owner_type !== 'division') {
          throw new Error('Only Division Head can create tasks as division_head');
        }
        // Division Head can only create tasks for their own division
        if (input.assigned_to_type === 'division' && input.assigned_to_id !== ctx.owner_id) {
          throw new Error('Division Head can only assign tasks to their own division');
        }
        if (input.assigned_to_type === 'staff') {
          const staff = dbInstance.stmt.getStaffAgentById.get(input.assigned_to_id) as StaffAgent | undefined;
          if (!staff || staff.division_id !== ctx.owner_id) {
            throw new Error('Division Head can only assign tasks to their own division members');
          }
        }
      }

      // Validate assigned_to
      if (input.assigned_to_type === 'division') {
        const division = dbInstance.stmt.getDivisionById.get(input.assigned_to_id) as Division | undefined;
        if (!division) throw new Error(`Division '${input.assigned_to_id}' not found`);
      } else if (input.assigned_to_type === 'staff') {
        const staff = dbInstance.stmt.getStaffAgentById.get(input.assigned_to_id) as StaffAgent | undefined;
        if (!staff) throw new Error(`Staff agent '${input.assigned_to_id}' not found`);
      }

      // Validate dependencies exist and are completed
      if (input.dependencies && input.dependencies.length > 0) {
        for (const depId of input.dependencies) {
          const depTask = dbInstance.stmt.getTaskById.get(depId) as Task | undefined;
          if (!depTask) throw new Error(`Dependency task '${depId}' not found`);
          if (depTask.status !== 'completed') {
            throw new Error(`Dependency task '${depId}' must be completed before creating dependent task`);
          }
        }
      }

      const taskId = dbInstance.generateId();
      const now = new Date().toISOString();

      dbInstance.stmt.insertTask.run(
        taskId,
        input.title,
        input.description ?? '',
        input.assigned_to_type,
        input.assigned_to_id,
        input.created_by_type,
        input.created_by_id,
        input.status ?? 'pending',
        input.priority ?? 'medium',
        input.budget_allocated ?? 0,
        input.due_at ?? null,
        null,
        now,
        now,
        JSON.stringify(input.dependencies ?? []),
        input.deliverable_id ?? null
      );

      // Note: Tasks are not memory_entries, so we don't log to memory_access table
      // (memory_access FK references memory_entries, not tasks)

      return toTask(dbInstance.stmt.getTaskById.get(taskId) as any);
    },

    updateTask(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof UpdateTaskInputSchema>
    ): Task {
      const task = dbInstance.stmt.getTaskById.get(input.task_id) as Task | undefined;
      if (!task) {
        throw new Error(`Task '${input.task_id}' not found`);
      }

      // Validate status transitions
      if (input.status) {
        const validTransitions: Record<string, string[]> = {
          pending: ['in_progress', 'cancelled'],
          in_progress: ['review', 'cancelled'],
          review: ['completed', 'pending', 'cancelled'],
          completed: [],
          cancelled: [],
        };

        const allowed = validTransitions[task.status] || [];
        if (!allowed.includes(input.status)) {
          throw new Error(`Invalid status transition: ${task.status} -> ${input.status}`);
        }

        // Check who can transition
        const canTransition = this.canTransitionTask(ctx, task, input.status);
        if (!canTransition) {
          throw new Error(`Unauthorized to transition task to ${input.status}`);
        }

        if (input.status === 'completed') {
          input.due_at = new Date().toISOString();
        }
      }

      const now = new Date().toISOString();
      dbInstance.stmt.updateTask.run(
        input.title ?? task.title,
        input.description ?? task.description,
        task.assigned_to_type,
        task.assigned_to_id,
        task.created_by_type,
        task.created_by_id,
        input.status ?? task.status,
        input.priority ?? task.priority,
        task.budget_allocated,
        input.due_at ?? task.due_at,
        task.completed_at,
        now,
        input.task_id
      );

      // Log access
      dbInstance.stmt.insertMemoryAccess.run(
        dbInstance.generateId(), input.task_id, null,
        ctx.owner_type, ctx.owner_id, ctx.runtime, 'update', now
      );

      return toTask(dbInstance.stmt.getTaskById.get(input.task_id));
    },

    canTransitionTask(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      task: Task,
      newStatus: string
    ): boolean {
      // Founder can do any transition
      if (this.isFounder(ctx)) return true;

      // Division Head of assigned division
      if (task.assigned_to_type === 'division' && this.isDivisionHead(ctx, task.assigned_to_id)) {
        return true;
      }

      // Assigned staff member
      if (task.assigned_to_type === 'staff' && this.isStaffAgent(ctx, task.assigned_to_id)) {
        // Staff can only move pending -> in_progress, in_progress -> review
        const staffAllowed: Record<string, string[]> = {
          pending: ['in_progress'],
          in_progress: ['review'],
        };
        const allowed = staffAllowed[task.status] || [];
        return allowed.includes(newStatus);
      }

      return false;
    },

    listTasks(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof ListTasksInputSchema>
    ): Task[] {
      let tasks = dbInstance.stmt.listTasks.all() as Task[];

      // Filter by permissions
      if (!this.isFounder(ctx)) {
        tasks = tasks.filter(t => {
          // Can see tasks assigned to own division
          if (t.assigned_to_type === 'division' && this.isDivisionMember(ctx, t.assigned_to_id)) return true;
          // Can see tasks assigned to self
          if (t.assigned_to_type === 'staff' && this.isStaffAgent(ctx, t.assigned_to_id)) return true;
          // Can see tasks created by self
          if (t.created_by_type === 'division_head' && ctx.owner_type === 'division' && t.created_by_id === ctx.owner_id) return true;
          return false;
        });
      }

      if (input.assigned_to_type) {
        tasks = tasks.filter(t => t.assigned_to_type === input.assigned_to_type);
      }
      if (input.assigned_to_id) {
        tasks = tasks.filter(t => t.assigned_to_id === input.assigned_to_id);
      }
      if (input.status) {
        tasks = tasks.filter(t => t.status === input.status);
      }
      if (input.priority) {
        tasks = tasks.filter(t => t.priority === input.priority);
      }

      return tasks;
    },

    completeTask(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof CompleteTaskInputSchema>
    ): Task {
      return this.updateTask(ctx, { task_id: input.task_id, status: 'completed' });
    },

    // --- Deliverable Management ---

    createDeliverable(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof CreateDeliverableInputSchema>
    ): Deliverable {
      const task = dbInstance.stmt.getTaskById.get(input.task_id) as Task | undefined;
      if (!task) {
        throw new Error(`Task '${input.task_id}' not found`);
      }

      // Validate submitter
      if (input.submitted_by_type === 'staff') {
        if (!this.isStaffAgent(ctx, input.submitted_by_id)) {
          throw new Error('Only assigned staff can submit deliverables');
        }
        const staff = dbInstance.stmt.getStaffAgentById.get(input.submitted_by_id) as StaffAgent | undefined;
        if (task.assigned_to_type === 'staff' && task.assigned_to_id !== input.submitted_by_id) {
          throw new Error('Staff not assigned to this task');
        }
        if (task.assigned_to_type === 'division') {
          const members = dbInstance.stmt.getDivisionMembers.all(task.assigned_to_id) as DivisionMember[];
          const member = members.find((m) => m.staff_id === input.submitted_by_id);
          if (!member) {
            throw new Error('Staff not a member of assigned division');
          }
        }
      } else if (input.submitted_by_type === 'division') {
        if (!this.isDivisionHead(ctx, input.submitted_by_id)) {
          throw new Error('Only Division Head can submit division deliverables');
        }
        if (task.assigned_to_type !== 'division' || task.assigned_to_id !== input.submitted_by_id) {
          throw new Error('Division not assigned to this task');
        }
      }

      const deliverableId = dbInstance.generateId();
      const now = new Date().toISOString();

      dbInstance.stmt.insertDeliverable.run(
        deliverableId,
        input.task_id,
        input.submitted_by_type,
        input.submitted_by_id,
        JSON.stringify(input.content),
        'submitted',
        null,
        null,
        null,
        now,
        now,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([])
      );

      // Log access
      dbInstance.stmt.insertMemoryAccess.run(
        dbInstance.generateId(), deliverableId, null,
        ctx.owner_type, ctx.owner_id, ctx.runtime, 'create', now
      );

      return toDeliverable(dbInstance.stmt.getDeliverableById.get(deliverableId) as any);
    },

    updateDeliverable(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof UpdateDeliverableInputSchema>
    ): Deliverable {
      const deliverable = dbInstance.stmt.getDeliverableById.get(input.deliverable_id) as Deliverable | undefined;
      if (!deliverable) {
        throw new Error(`Deliverable '${input.deliverable_id}' not found`);
      }

      const task = dbInstance.stmt.getTaskById.get(deliverable.task_id) as Task | undefined;
      if (!task) {
        throw new Error(`Task '${deliverable.task_id}' not found`);
      }

      // Only Division Head of assigned division or Founder can review
      if (input.status && ['accepted', 'rejected', 'revision_requested'].includes(input.status)) {
        if (!this.isFounder(ctx) && !this.isDivisionHead(ctx, task.assigned_to_id)) {
          throw new Error('Only Division Head or Founder can review deliverables');
        }
      }

      const now = new Date().toISOString();
      const before = {
        status: deliverable.status,
        reviewed_by_type: deliverable.reviewed_by_type,
        reviewed_by_id: deliverable.reviewed_by_id,
        reviewed_at: deliverable.reviewed_at,
      };

      // Update the deliverable row
      dbInstance.stmt.updateDeliverable.run(
        input.status ?? deliverable.status,
        input.reviewed_by_type ?? deliverable.reviewed_by_type,
        input.reviewed_by_id ?? deliverable.reviewed_by_id,
        input.reviewed_at ?? deliverable.reviewed_at ?? now,
        input.deliverable_id
      );

      // Build audit log entry
      const auditEntry = {
        by_type: input.reviewed_by_type ?? 'system',
        by_id: input.reviewed_by_id ?? 'system',
        action: input.status ? 'status_change' : 'update',
        timestamp: now,
        before,
        after: {
          status: input.status ?? deliverable.status,
          reviewed_by_type: input.reviewed_by_type ?? deliverable.reviewed_by_type,
          reviewed_by_id: input.reviewed_by_id ?? deliverable.reviewed_by_id,
          reviewed_at: input.reviewed_at ?? deliverable.reviewed_at ?? now,
        },
      };

      // Append to audit_log
      const currentAudit = deliverable.audit_log ? JSON.parse(deliverable.audit_log) : [];
      currentAudit.push(auditEntry);

      dbInstance.db.prepare('UPDATE deliverables SET audit_log = ? WHERE deliverable_id = ?')
        .run(JSON.stringify(currentAudit), input.deliverable_id);

      // Log access
      dbInstance.stmt.insertMemoryAccess.run(
        dbInstance.generateId(), input.deliverable_id, null,
        ctx.owner_type, ctx.owner_id, ctx.runtime, 'update', now
      );

      return toDeliverable(dbInstance.stmt.getDeliverableById.get(input.deliverable_id) as any);
    },

    listDeliverablesByTask(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof ListDeliverablesByTaskInputSchema>
    ): Deliverable[] {
      const task = dbInstance.stmt.getTaskById.get(input.task_id) as Task | undefined;
      if (!task) {
        throw new Error(`Task '${input.task_id}' not found`);
      }

      // Check permission to view task's deliverables
      if (!this.isFounder(ctx)) {
        if (task.assigned_to_type === 'division' && !this.isDivisionMember(ctx, task.assigned_to_id)) {
          throw new Error('Access denied to task deliverables');
        }
        if (task.assigned_to_type === 'staff' && !this.isStaffAgent(ctx, task.assigned_to_id)) {
          throw new Error('Access denied to task deliverables');
        }
      }

      return (dbInstance.stmt.listDeliverablesByTask.all(input.task_id) as any[]).map(toDeliverable);
    },

    // --- Cross-Division Request/Approval Workflow ---

    requestCrossDivisionAccess(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof RequestCrossDivisionAccessInputSchema>
    ): CrossDivisionShare {
      // Only Division Head of from_division can request
      if (!this.isDivisionHead(ctx, input.from_division)) {
        throw new Error('Only Division Head can request cross-division access');
      }

      const toDivision = dbInstance.stmt.getDivisionById.get(input.to_division);
      if (!toDivision) {
        throw new Error(`Target division '${input.to_division}' not found`);
      }

      if (input.memory_id) {
        const memory = dbInstance.stmt.getMemoryById.get(input.memory_id) as MemoryEntry | undefined;
        if (!memory) {
          throw new Error(`Memory '${input.memory_id}' not found`);
        }
        if (!this.checkMemoryAccess(ctx, memory)) {
          throw new Error('Access denied to requested memory');
        }
      }

      const requestId = dbInstance.generateId();
      const now = new Date().toISOString();

      dbInstance.stmt.insertCrossDivisionShare.run(
        requestId,
        input.memory_id ?? dbInstance.generateId(),
        input.to_division,
        'division',  // granted_by_type = 'division' for requests
        input.from_division,
        now,
        null,  // revoked_at
        input.request_type,
        'pending',
        input.justification,
        input.priority,
        input.deadline ?? null,
        null,  // approved_by_type
        null,  // approved_by_id
        null   // approved_at
      );

      // Log access
      dbInstance.stmt.insertMemoryAccess.run(
        dbInstance.generateId(), requestId, null,
        ctx.owner_type, ctx.owner_id, ctx.runtime, 'create', now
      );

      return toCrossDivisionShare(dbInstance.stmt.getCrossDivisionShares.all(requestId)
        .find((s: any) => s.share_id === requestId));
    },

    approveCrossDivisionAccess(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof ApproveCrossDivisionAccessInputSchema>
    ): { success: boolean; request_id: string; status: string } {
      if (!this.isFounder(ctx)) {
        throw new Error('Only Founder can approve cross-division access requests');
      }

      const shares = dbInstance.stmt.getCrossDivisionShares.all(input.request_id) as CrossDivisionShare[];
      if (!shares.length) {
        throw new Error(`Cross-division request '${input.request_id}' not found`);
      }

      const share = shares[0];
      if (share.granted_by_type !== 'division') {
        throw new Error(`Only division requests can be approved; this was granted by ${share.granted_by_type}`);
      }

      if (share.status === 'approved') {
        throw new Error(`Request '${input.request_id}' already approved`);
      }

      const now = new Date().toISOString();

      // Update to approved - use Founder as grantor
      dbInstance.stmt.updateCrossDivisionShare.run(
        'approved', now, 'founder', 'founder', 'founder', 'founder', input.request_id
      );

      // Note: Cross-division share modifications are not memory entries

      return { success: true, request_id: input.request_id, status: 'approved' };
    },

    revokeCrossDivisionAccessRequest(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof ApproveCrossDivisionAccessInputSchema>
    ): { success: boolean; request_id: string; status: string } {
      if (!this.isFounder(ctx)) {
        throw new Error('Only Founder can revoke cross-division access requests');
      }

      const shares = dbInstance.stmt.getCrossDivisionShares.all(input.request_id) as CrossDivisionShare[];
      if (!shares.length) {
        throw new Error(`Cross-division request '${input.request_id}' not found`);
      }

      const now = new Date().toISOString();

      dbInstance.stmt.updateCrossDivisionShare.run(
        'rejected', now, 'founder', 'founder', 'founder', 'founder', input.request_id
      );

      // Note: Cross-division share modifications are not memory entries

      return { success: true, request_id: input.request_id, status: 'rejected' };
    },

    listPendingCrossDivisionRequests(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof ListPendingCrossDivisionRequestsInputSchema>
    ): CrossDivisionShare[] {
      if (!this.isFounder(ctx) && !this.isDivisionMember(ctx, input.division_id)) {
        throw new Error('Access denied to cross-division requests');
      }

      const shares = dbInstance.stmt.getSharesByDivision.all(input.division_id) as CrossDivisionShare[];
      return shares.filter(s => s.status === 'pending' || s.granted_by_type === 'division');
    },

    // --- Phase 7: Autonomy, Permissions and Execution ---

    // Task Autonomy Levels
    createTaskAutonomyLevel(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof CreateTaskAutonomyLevelInputSchema>
    ): TaskAutonomyLevel {
      if (!this.isFounder(ctx)) {
        throw new Error('Only Founder can define task autonomy levels');
      }

      const existing = dbInstance.stmt.getTaskAutonomyLevel.get(input.task_type) as TaskAutonomyLevel | undefined;
      if (existing) {
        throw new Error(`Task autonomy level for '${input.task_type}' already exists`);
      }

      const now = new Date().toISOString();
      dbInstance.stmt.insertTaskAutonomyLevel.run(input.task_type, input.autonomy_level, input.description ?? '');

      // Note: Task autonomy levels are not memory_entries, so we don't log to memory_access table

      return toTaskAutonomyLevel(dbInstance.stmt.getTaskAutonomyLevel.get(input.task_type) as any);
    },

    getTaskAutonomyLevel(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      taskType: string
    ): TaskAutonomyLevel | undefined {
      return toTaskAutonomyLevel(dbInstance.stmt.getTaskAutonomyLevel.get(taskType) as any);
    },

    listTaskAutonomyLevels(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' }
    ): TaskAutonomyLevel[] {
      return (dbInstance.stmt.listTaskAutonomyLevels.all() as any[]).map(toTaskAutonomyLevel);
    },

    // Execution Requests
    requestExecution(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof RequestExecutionInputSchema>
    ): ExecutionRequest {
      // Validate task exists
      const task = dbInstance.stmt.getTaskById.get(input.task_id) as Task | undefined;
      if (!task) {
        throw new Error(`Task '${input.task_id}' not found`);
      }

      // Validate requester permissions
      if (ctx.owner_type === 'staff') {
        if (!this.isStaffAgent(ctx, ctx.owner_id)) {
          throw new Error('Staff agent not found or not active');
        }
        // Staff can only request execution for tasks assigned to them
        if (task.assigned_to_type === 'staff' && task.assigned_to_id !== ctx.owner_id) {
          throw new Error('Staff can only request execution for their own tasks');
        }
        if (task.assigned_to_type === 'division') {
          const members = dbInstance.stmt.getDivisionMembers.all(task.assigned_to_id) as DivisionMember[];
          if (!members.find(m => m.staff_id === ctx.owner_id)) {
            throw new Error('Staff not a member of assigned division');
          }
        }
      } else if (ctx.owner_type === 'division') {
        if (!this.isDivisionHead(ctx, ctx.owner_id)) {
          throw new Error('Only Division Head can request execution for division');
        }
        // Division Head can only request for their own division
        if (task.assigned_to_type === 'division' && task.assigned_to_id !== ctx.owner_id) {
          throw new Error('Division Head can only request execution for their own division tasks');
        }
        if (task.assigned_to_type === 'staff') {
          const staff = dbInstance.stmt.getStaffAgentById.get(task.assigned_to_id) as StaffAgent | undefined;
          if (!staff || staff.division_id !== ctx.owner_id) {
            throw new Error('Division Head can only request execution for their own division members');
          }
        }
      } else if (!this.isFounder(ctx)) {
        throw new Error('Only Founder, Division Head, or assigned Staff can request execution');
      }

      // Determine autonomy level from task type if not specified
      let autonomyLevel: AutonomyLevel = input.autonomy_level ?? 1;
      if (!input.autonomy_level) {
        const autonomyDef = dbInstance.stmt.getTaskAutonomyLevel.get(task.title) as TaskAutonomyLevel | undefined;
        autonomyLevel = (autonomyDef?.autonomy_level as AutonomyLevel) ?? 1;
      }

      const executionId = dbInstance.generateId();
      const now = new Date().toISOString();

      let status: ExecutionStatus = 'proposed';
      let approvalRequestId: string | undefined;

      // Level 1: Autonomous - proceed directly to queued
      // Level 2: Bounded - permission check required
      // Level 3: Founder approval required
      if (autonomyLevel === 1) {
        status = 'queued';
      } else if (autonomyLevel === 2) {
        status = 'permission_check';
      } else if (autonomyLevel === 3) {
        status = 'approval_required';
        // Will create approval request after execution request is inserted
        approvalRequestId = dbInstance.generateId();
      }

      // Insert execution request first (approval_requests FK references execution_requests)
      dbInstance.stmt.insertExecutionRequest.run(
        executionId,
        input.task_id,
        ctx.owner_type,
        ctx.owner_id,
        autonomyLevel,
        input.action_description,
        JSON.stringify(input.action_payload),
        status,
        approvalRequestId ?? null,
        null,
        '[]',
        null,
        null,
        null,
        null
      );

      // Create approval request for Level 3 (after execution request exists)
      if (autonomyLevel === 3 && approvalRequestId) {
        dbInstance.stmt.insertApprovalRequest.run(
          approvalRequestId,
          executionId,
          ctx.owner_type,
          ctx.owner_id,
          input.action_description,
          JSON.stringify(input.action_payload),
          `Autonomy Level 3 action requires Founder approval: ${input.action_description}`,
          'medium',
          null,
          'pending',
          null, null, null, null
        );
      }

      // Record creation history: proposed → actual status
      dbInstance.stmt.insertExecutionHistory.run(
        dbInstance.generateId(),
        executionId,
        input.task_id,
        ctx.owner_type,
        ctx.owner_id,
        autonomyLevel,
        input.action_description,
        JSON.stringify(input.action_payload),
        'proposed',
        status,
        approvalRequestId ?? null,
        '[]',
        null,
        null,
        ctx.owner_type,
        ctx.owner_id,
        now,
        null
      );

      // Note: Execution requests are not memory_entries, so we don't log to memory_access table

      return toExecutionRequest(dbInstance.stmt.getExecutionRequest.get(executionId) as any);
    },

    getExecutionRequest(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof GetExecutionRequestInputSchema>
    ): ExecutionRequest | undefined {
      const execution = dbInstance.stmt.getExecutionRequest.get(input.execution_id) as ExecutionRequest | undefined;
      if (!execution) return undefined;

      // Check access
      if (!this.isFounder(ctx)) {
        if (execution.requested_by_type === 'staff' && execution.requested_by_id !== ctx.owner_id) {
          throw new Error('Access denied to execution request');
        }
        if (execution.requested_by_type === 'division' && !this.isDivisionMember(ctx, execution.requested_by_id)) {
          throw new Error('Access denied to execution request');
        }
      }

      return toExecutionRequest(execution);
    },

    listExecutionRequests(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof ListExecutionRequestsInputSchema>
    ): ExecutionRequest[] {
      let executions = dbInstance.stmt.listExecutionRequests.all() as ExecutionRequest[];

      // Filter by access
      if (!this.isFounder(ctx)) {
        executions = executions.filter(e => {
          if (e.requested_by_type === 'staff') return e.requested_by_id === ctx.owner_id;
          if (e.requested_by_type === 'division') return this.isDivisionMember(ctx, e.requested_by_id);
          return false;
        });
      }

      // Apply filters
      if (input.status) {
        executions = executions.filter(e => e.status === input.status);
      }
      if (input.autonomy_level) {
        executions = executions.filter(e => e.autonomy_level === input.autonomy_level);
      }
      if (input.requested_by_type) {
        executions = executions.filter(e => e.requested_by_type === input.requested_by_type);
      }
      if (input.requested_by_id) {
        executions = executions.filter(e => e.requested_by_id === input.requested_by_id);
      }
      if (input.task_id) {
        executions = executions.filter(e => e.task_id === input.task_id);
      }

      // Pagination
      const offset = input.offset ?? 0;
      const limit = input.limit ?? 50;
      return executions.slice(offset, offset + limit).map(toExecutionRequest);
    },

    // Approval Workflow (Founder only)
    approveExecution(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof ApproveExecutionInputSchema>
    ): { success: boolean; approval_request_id: string; status: string; execution_id?: string } {
      if (!this.isFounder(ctx)) {
        throw new Error('Only Founder can approve execution requests');
      }

      const approval = dbInstance.stmt.getApprovalRequest.get(input.approval_request_id) as ApprovalRequest | undefined;
      if (!approval) {
        throw new Error(`Approval request '${input.approval_request_id}' not found`);
      }

      if (approval.status !== 'pending') {
        throw new Error(`Approval request '${input.approval_request_id}' is not pending (status: ${approval.status})`);
      }

      // Prevent self-approval
      if (approval.requested_by_type === 'founder' && approval.requested_by_id === ctx.owner_id) {
        throw new Error('Self-approval is not allowed');
      }

      const now = new Date().toISOString();
      const newStatus = input.approved ? 'approved' : 'rejected';

      // Update approval request
      dbInstance.stmt.updateApprovalRequest.run(
        approval.execution_id,
        approval.requested_by_type,
        approval.requested_by_id,
        approval.action_description,
        approval.action_payload,
        approval.justification,
        approval.priority,
        approval.deadline,
        newStatus,
        input.approved ? 'founder' : null,
        input.approved ? 'founder' : null,
        input.approved ? now : null,
        input.rejection_reason ?? null,
        input.approval_request_id
      );

      // Update execution request
      const execution = dbInstance.stmt.getExecutionRequest.get(approval.execution_id) as ExecutionRequest | undefined;
      if (execution) {
        const execStatus = input.approved ? 'approved' : 'rejected';
        dbInstance.stmt.updateExecutionRequest.run(
          execution.task_id,
          execution.requested_by_type,
          execution.requested_by_id,
          execution.autonomy_level,
          execution.action_description,
          execution.action_payload,
          execStatus,
          execution.approval_request_id,
          input.approved ? approval.approval_request_id : null,
          execution.permission_grants,
          input.approved ? null : (input.rejection_reason ?? 'Rejected by Founder'),
          execution.result_payload,
          execution.started_at,
          execution.completed_at,
          approval.execution_id
        );
      }

      // Note: Approval requests are not memory_entries, so we don't log to memory_access table

      return { success: true, approval_request_id: input.approval_request_id, status: newStatus, execution_id: approval.execution_id };
    },

    listApprovalRequests(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof ListApprovalRequestsInputSchema>
    ): ApprovalRequest[] {
      if (!this.isFounder(ctx)) {
        throw new Error('Only Founder can list approval requests');
      }

      let approvals = dbInstance.stmt.listApprovalRequests.all() as ApprovalRequest[];

      if (input.status) {
        approvals = approvals.filter(a => a.status === input.status);
      }
      if (input.requested_by_type) {
        approvals = approvals.filter(a => a.requested_by_type === input.requested_by_type);
      }
      if (input.requested_by_id) {
        approvals = approvals.filter(a => a.requested_by_id === input.requested_by_id);
      }

      const offset = input.offset ?? 0;
      const limit = input.limit ?? 50;
      return approvals.slice(offset, offset + limit).map(toApprovalRequest);
    },

    // Execution History
    getExecutionHistory(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      input: z.infer<typeof GetExecutionHistoryInputSchema>
    ): ExecutionHistory[] {
      const execution = dbInstance.stmt.getExecutionRequest.get(input.execution_id) as ExecutionRequest | undefined;
      if (!execution) {
        throw new Error(`Execution request '${input.execution_id}' not found`);
      }

      // Check access
      if (!this.isFounder(ctx)) {
        if (execution.requested_by_type === 'staff' && execution.requested_by_id !== ctx.owner_id) {
          throw new Error('Access denied to execution history');
        }
        if (execution.requested_by_type === 'division' && !this.isDivisionMember(ctx, execution.requested_by_id)) {
          throw new Error('Access denied to execution history');
        }
      }

      return (dbInstance.stmt.listExecutionHistoryByExecution.all(input.execution_id) as any[]).map(toExecutionHistory);
    },

    // Internal: Execute a queued/approved execution request
    executeExecutionRequest(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      executionId: string,
      resultPayload?: Record<string, any>,
      errorMessage?: string
    ): ExecutionRequest {
      const execution = dbInstance.stmt.getExecutionRequest.get(executionId) as ExecutionRequest | undefined;
      if (!execution) {
        throw new Error(`Execution request '${executionId}' not found`);
      }

      // Re-validate permissions before execution (check Level 3 approval first)
      if (execution.autonomy_level === 3 && execution.status !== 'approved') {
        throw new Error('Level 3 execution requires Founder approval');
      }

      // Validate can execute
      const validExecStatuses = ['queued', 'approved'];
      if (!validExecStatuses.includes(execution.status)) {
        throw new Error(`Execution request '${executionId}' is not ready for execution (status: ${execution.status})`);
      }

      const now = new Date().toISOString();
      const statusBefore = execution.status;
      const statusAfter = errorMessage ? 'failed' : 'running';

      // Update to running
      dbInstance.stmt.updateExecutionRequest.run(
        execution.task_id,
        execution.requested_by_type,
        execution.requested_by_id,
        execution.autonomy_level,
        execution.action_description,
        execution.action_payload,
        statusAfter,
        execution.approval_request_id,
        execution.approval_id,
        execution.permission_grants,
        errorMessage ?? null,
        execution.result_payload,
        now,
        null,
        executionId
      );

      // Record history
      dbInstance.stmt.insertExecutionHistory.run(
        dbInstance.generateId(),
        executionId,
        execution.task_id,
        execution.requested_by_type,
        execution.requested_by_id,
        execution.autonomy_level,
        execution.action_description,
        execution.action_payload,
        statusBefore,
        statusAfter,
        execution.approval_request_id ?? null,
        execution.permission_grants,
        null,
        null,
        ctx.owner_type,
        ctx.owner_id,
        now,
        null
      );

      // If completed immediately (simulated), mark completed
      const finalStatus = errorMessage ? 'failed' : 'completed';
      const completedAt = errorMessage ? null : now;

      dbInstance.stmt.updateExecutionRequest.run(
        execution.task_id,
        execution.requested_by_type,
        execution.requested_by_id,
        execution.autonomy_level,
        execution.action_description,
        execution.action_payload,
        finalStatus,
        execution.approval_request_id,
        execution.approval_id,
        execution.permission_grants,
        errorMessage ?? null,
        resultPayload ? JSON.stringify(resultPayload) : null,
        execution.started_at ?? now,
        completedAt,
        executionId
      );

      // Record completion history
      dbInstance.stmt.insertExecutionHistory.run(
        dbInstance.generateId(),
        executionId,
        execution.task_id,
        execution.requested_by_type,
        execution.requested_by_id,
        execution.autonomy_level,
        execution.action_description,
        execution.action_payload,
        statusAfter,
        finalStatus,
        execution.approval_request_id ?? null,
        execution.permission_grants,
        resultPayload ? JSON.stringify(resultPayload) : null,
        errorMessage ?? null,
        ctx.owner_type,
        ctx.owner_id,
        now,
        completedAt
      );

      return toExecutionRequest(dbInstance.stmt.getExecutionRequest.get(executionId) as any);
    },

    cancelExecutionRequest(
      ctx: { owner_type: MemoryOwnerType; owner_id: string; runtime: 'claude' | 'hermes' },
      executionId: string
    ): ExecutionRequest {
      const execution = dbInstance.stmt.getExecutionRequest.get(executionId) as ExecutionRequest | undefined;
      if (!execution) {
        throw new Error(`Execution request '${executionId}' not found`);
      }

      // Check ownership
      if (!this.isFounder(ctx)) {
        if (execution.requested_by_type === 'staff' && execution.requested_by_id !== ctx.owner_id) {
          throw new Error('Only requester or Founder can cancel execution');
        }
        if (execution.requested_by_type === 'division' && !this.isDivisionHead(ctx, execution.requested_by_id)) {
          throw new Error('Only Division Head or Founder can cancel execution');
        }
      }

      // Only cancel if not completed/failed
      const nonCancellable = ['completed', 'failed', 'cancelled'];
      if (nonCancellable.includes(execution.status)) {
        throw new Error(`Cannot cancel execution with status: ${execution.status}`);
      }

      const now = new Date().toISOString();
      const statusBefore = execution.status;

      dbInstance.stmt.updateExecutionRequest.run(
        execution.task_id,
        execution.requested_by_type,
        execution.requested_by_id,
        execution.autonomy_level,
        execution.action_description,
        execution.action_payload,
        'cancelled',
        execution.approval_request_id,
        execution.approval_id,
        execution.permission_grants,
        'Cancelled by user',
        execution.result_payload,
        execution.started_at,
        now,
        executionId
      );

      // Record history
      dbInstance.stmt.insertExecutionHistory.run(
        dbInstance.generateId(),
        executionId,
        execution.task_id,
        execution.requested_by_type,
        execution.requested_by_id,
        execution.autonomy_level,
        execution.action_description,
        execution.action_payload,
        statusBefore,
        'cancelled',
        execution.approval_request_id ?? null,
        execution.permission_grants,
        null,
        'Cancelled by user',
        ctx.owner_type,
        ctx.owner_id,
        now,
        now
      );

      return toExecutionRequest(dbInstance.stmt.getExecutionRequest.get(executionId) as any);
    },
  };
}

export type CouncilService = ReturnType<typeof createCouncilService>;