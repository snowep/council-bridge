// Zod Validation Schemas for REST API
// Consistent with existing types in src/council/types.ts

import { z } from 'zod/v4';

// Pagination
export const PaginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type PaginationInput = z.infer<typeof PaginationSchema>;

// Auth
export const CreateSessionSchema = z.object({
  owner_type: z.enum(['founder', 'staff', 'division', 'seat']),
  owner_id: z.string().min(1).max(255),
  runtime: z.enum(['claude', 'hermes']),
  founder_signature: z.string().optional(),
  founder_timestamp: z.string().optional(),
  founder_nonce: z.string().optional(),
  founder_key_id: z.string().optional(),
});
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

// Messages
export const SendMessageSchema = z.object({
  recipient_id: z.string().min(1).max(255),
  content: z.string().min(1),
  reply_to: z.string().uuid().optional(),
});
export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export const ListConversationsSchema = z.object({
  ...PaginationSchema.shape,
  search: z.string().optional(),
});
export type ListConversationsInput = z.infer<typeof ListConversationsSchema>;

// Meetings
export const ListMeetingsSchema = z.object({
  ...PaginationSchema.shape,
  status: z.enum(['preparing', 'deliberation', 'primary_ideas', 'brainstorming', 'challenges', 'synthesis', 'reassessment', 'evaluation', 'closed', 'archived', 'cancelled']).optional(),
});
export type ListMeetingsInput = z.infer<typeof ListMeetingsSchema>;

// Memory
export const ListMemorySchema = z.object({
  ...PaginationSchema.shape,
  owner_type: z.enum(['seat', 'division', 'staff', 'founder']).optional(),
  owner_id: z.string().optional(),
  category: z.enum([
    'individual_persona', 'council_shared', 'meeting_history', 'decision_resolution',
    'idea_proposal', 'research_evidence', 'lesson_learned', 'unresolved_question',
    'division_shared', 'division_private', 'staff_private', 'business_context',
    'task_history', 'cross_division'
  ]).optional(),
  archived: z.coerce.boolean().optional(),
  search: z.string().optional(),
});
export type ListMemoryInput = z.infer<typeof ListMemorySchema>;

// Divisions
export const CreateDivisionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().default(''),
  head_staff_id: z.string().optional(),
  budget_limit: z.number().default(0),
  permissions: z.array(z.string()).default([]),
  strategic_objectives: z.array(z.string()).default([]),
});
export type CreateDivisionInput = z.infer<typeof CreateDivisionSchema>;

export const UpdateDivisionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  head_staff_id: z.string().optional(),
  budget_limit: z.number().optional(),
  permissions: z.array(z.string()).optional(),
  strategic_objectives: z.array(z.string()).optional(),
});
export type UpdateDivisionInput = z.infer<typeof UpdateDivisionSchema>;

// Staff
export const RegisterStaffSchema = z.object({
  name: z.string().min(1).max(255),
  role: z.string().min(1).max(255),
  division_id: z.string().min(1).max(255),
  runtime_instances: z.array(z.enum(['claude', 'hermes'])).default([]),
  permissions: z.array(z.string()).default([]),
  status: z.enum(['active', 'inactive', 'terminated']).default('inactive'),
});
export type RegisterStaffInput = z.infer<typeof RegisterStaffSchema>;

export const UpdateStaffSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: z.string().min(1).max(255).optional(),
  division_id: z.string().min(1).max(255).optional(),
  runtime_instances: z.array(z.enum(['claude', 'hermes'])).optional(),
  permissions: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive', 'terminated']).optional(),
});
export type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>;

export const ListStaffSchema = z.object({
  ...PaginationSchema.shape,
  division_id: z.string().optional(),
  status: z.string().optional(),
});
export type ListStaffInput = z.infer<typeof ListStaffSchema>;

// Tasks
export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().default(''),
  assigned_to_type: z.enum(['division', 'staff']),
  assigned_to_id: z.string().min(1).max(255),
  created_by_type: z.enum(['founder', 'council', 'division_head']),
  created_by_id: z.string().min(1).max(255),
  status: z.enum(['pending', 'in_progress', 'review', 'completed', 'cancelled']).default('pending'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  budget_allocated: z.number().default(0),
  due_at: z.string().optional(),
  dependencies: z.array(z.string()).default([]),
  deliverable_id: z.string().optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  assigned_to_type: z.enum(['division', 'staff']).optional(),
  assigned_to_id: z.string().min(1).max(255).optional(),
  status: z.enum(['pending', 'in_progress', 'review', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  budget_allocated: z.number().optional(),
  due_at: z.string().optional(),
  completed_at: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  deliverable_id: z.string().optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const AssignTaskSchema = z.object({
  assigned_to_type: z.enum(['division', 'staff']),
  assigned_to_id: z.string().min(1).max(255),
});
export type AssignTaskInput = z.infer<typeof AssignTaskSchema>;

export const UpdateTaskStatusSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'review', 'completed', 'cancelled']),
});
export type UpdateTaskStatusInput = z.infer<typeof UpdateTaskStatusSchema>;

export const ListTasksSchema = z.object({
  ...PaginationSchema.shape,
  assigned_to_type: z.enum(['division', 'staff']).optional(),
  assigned_to_id: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'review', 'completed', 'cancelled']).optional(),
  created_by_type: z.enum(['founder', 'council', 'division_head']).optional(),
  created_by_id: z.string().optional(),
});
export type ListTasksInput = z.infer<typeof ListTasksSchema>;

// Executions
export const RequestExecutionSchema = z.object({
  task_id: z.string().min(1).max(255),
  action_description: z.string().min(1).max(2000),
  action_payload: z.record(z.string(), z.any()).default({}),
  autonomy_level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});
export type RequestExecutionInput = z.infer<typeof RequestExecutionSchema>;

export const ApproveExecutionSchema = z.object({
  approval_request_id: z.string().min(1).max(255),
  approved: z.boolean(),
  rejection_reason: z.string().optional(),
});
export type ApproveExecutionInput = z.infer<typeof ApproveExecutionSchema>;

export const ExecuteExecutionSchema = z.object({
  result_payload: z.record(z.string(), z.any()).default({}),
});
export type ExecuteExecutionInput = z.infer<typeof ExecuteExecutionSchema>;

export const CancelExecutionSchema = z.object({
  error_message: z.string().optional(),
});
export type CancelExecutionInput = z.infer<typeof CancelExecutionSchema>;

export const ListExecutionsSchema = z.object({
  ...PaginationSchema.shape,
  status: z.enum(['proposed', 'permission_check', 'approval_required', 'approved', 'rejected', 'queued', 'running', 'completed', 'failed', 'cancelled']).optional(),
  autonomy_level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  requested_by_type: z.enum(['staff', 'division', 'founder']).optional(),
  requested_by_id: z.string().optional(),
  task_id: z.string().optional(),
});
export type ListExecutionsInput = z.infer<typeof ListExecutionsSchema>;

// Approvals
export const ListApprovalsSchema = z.object({
  ...PaginationSchema.shape,
  status: z.enum(['pending', 'approved', 'rejected', 'expired', 'cancelled']).optional(),
  requested_by_type: z.enum(['staff', 'division', 'founder']).optional(),
  requested_by_id: z.string().optional(),
});
export type ListApprovalsInput = z.infer<typeof ListApprovalsSchema>;

// Deliverables
export const CreateDeliverableSchema = z.object({
  task_id: z.string().min(1).max(255),
  content: z.string().min(1),
  quality_score: z.number().int().min(0).max(100).optional(),
});
export type CreateDeliverableInput = z.infer<typeof CreateDeliverableSchema>;

export const SubmitDeliverableSchema = z.object({
  quality_score: z.number().int().min(0).max(100).optional(),
});
export type SubmitDeliverableInput = z.infer<typeof SubmitDeliverableSchema>;

export const ReviewDeliverableSchema = z.object({
  status: z.enum(['accepted', 'rejected', 'revision_requested']),
  quality_score: z.number().int().min(0).max(100).optional(),
  reviewer_type: z.enum(['founder', 'council', 'division_head']),
  reviewer_id: z.string().min(1).max(255),
  revision_notes: z.string().optional(),
});
export type ReviewDeliverableInput = z.infer<typeof ReviewDeliverableSchema>;

export const RequestRevisionSchema = z.object({
  revision_notes: z.string().min(1),
});
export type RequestRevisionInput = z.infer<typeof RequestRevisionSchema>;

export const AssignReviewerSchema = z.object({
  reviewer_type: z.enum(['founder', 'council', 'division_head']),
  reviewer_id: z.string().min(1).max(255),
});
export type AssignReviewerInput = z.infer<typeof AssignReviewerSchema>;

export const ListDeliverablesSchema = z.object({
  ...PaginationSchema.shape,
  task_id: z.string().optional(),
  status: z.enum(['draft', 'submitted', 'accepted', 'rejected', 'revision_requested']).optional(),
  submitted_by_type: z.enum(['staff', 'division']).optional(),
  submitted_by_id: z.string().optional(),
});
export type ListDeliverablesInput = z.infer<typeof ListDeliverablesSchema>;

// Quality Thresholds
export const QualityThresholdSchema = z.object({
  division_id: z.string().optional(),
  task_type: z.string().optional(),
  min_quality_score: z.number().int().min(0).max(100),
  requires_review: z.boolean(),
});
export type QualityThresholdInput = z.infer<typeof QualityThresholdSchema>;