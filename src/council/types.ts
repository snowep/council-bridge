// Shared Council Types and Zod Schemas
// Extracted from council.ts for modularization

import { z } from 'zod/v4';

// Re-export Phase 1-6 types from core-types
export {
  SeatStatusSchema, type SeatStatus,
  CouncilSeatSchema, type CouncilSeat,
  PersonaSchema, type Persona,
  ConstitutionSchema, type Constitution,
  FounderApprovalSchema, type FounderApproval,
  MemoryOwnerTypeSchema, type MemoryOwnerType,
  MemoryEntrySchema, type MemoryEntry,
  CrossDivisionShareSchema, type CrossDivisionShare,
  DivisionSchema, type Division,
  StaffAgentSchema, type StaffAgent,
  DivisionMemberSchema, type DivisionMember,
  TaskSchema, type Task,
  DeliverableSchema, type Deliverable,
  MeetingSchema, type Meeting,
  CandidateSchema, type Candidate,
  FounderDeliberationSchema, type FounderDeliberation,
  FounderVoteSchema, type FounderVote,
  MeetingPhaseSchema, type MeetingPhase,
  PrimaryIdeaSchema, type PrimaryIdea,
  BrainstormRecordSchema, type BrainstormRecord,
  ChallengeSchema, type Challenge,
  DefenseSchema, type Defense,
  SynthesisSchema, type Synthesis,
  ReassessmentSchema, type Reassessment,
  EvaluationSchema, type Evaluation,
  AnonymousEvaluationSchema, type AnonymousEvaluation,
  EvaluationCriteriaSchema, type EvaluationCriteria,
  MemoryCategorySchema, type MemoryCategory,
  MemoryLinkTypeSchema, type MemoryLinkType,
  MemoryLinkSchema, type MemoryLink,
  MemoryVersionSchema, type MemoryVersion,
  MemoryAccessSchema, type MemoryAccess,
} from './core-types.js';

// Phase 7: Autonomy and Execution Types
export const AutonomyLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type AutonomyLevel = z.infer<typeof AutonomyLevelSchema>;

export const ExecutionStatusSchema = z.enum([
  'proposed', 'permission_check', 'approval_required', 'approved', 'rejected',
  'queued', 'running', 'completed', 'failed', 'cancelled'
]);
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'expired', 'cancelled']);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

// Phase 7 Execution Types
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

// Input Schemas for MCP Tools
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

// Utility Type Guards
export function isExecutionStatus(status: string): status is ExecutionStatus {
  return ['proposed', 'permission_check', 'approval_required', 'approved', 'rejected', 'queued', 'running', 'completed', 'failed', 'cancelled'].includes(status);
}

export function isAutonomyLevel(level: number): level is AutonomyLevel {
  return [1, 2, 3].includes(level);
}