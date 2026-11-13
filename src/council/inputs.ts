// Input Schemas for MCP Tools
// Extracted from council.ts for modularization

import { z } from 'zod/v4';
import {
  MemoryCategorySchema,
  MemoryLinkTypeSchema,
  MemoryOwnerTypeSchema
} from './core-types.js';
import type { EvaluationCriteria } from './core-types.js';

export type CreateEvaluationCriteriaInput = Omit<EvaluationCriteria, 'created_at'>;

// Phase 4: Memory Input Schemas
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

// Phase 6: Division & Staff Input Schemas
export const CreateDivisionInputSchema = z.object({
  division_id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  head_staff_id: z.string().optional(),
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
  name: z.string().optional(),
  description: z.string().optional(),
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
  status: z.enum(['active', 'inactive', 'terminated']).optional(),
});
export type RegisterStaffAgentInput = z.infer<typeof RegisterStaffAgentInputSchema>;

export const UpdateStaffStatusInputSchema = z.object({
  staff_id: z.string().min(1).max(255),
  status: z.enum(['active', 'inactive', 'terminated']),
});
export type UpdateStaffStatusInput = z.infer<typeof UpdateStaffStatusInputSchema>;

export const UpdateStaffAgentInputSchema = z.object({
  staff_id: z.string().min(1).max(255),
  name: z.string().optional(),
  role: z.string().optional(),
  division_id: z.string().optional(),
  runtime_instances: z.array(z.enum(['claude', 'hermes'])).optional(),
  permissions: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive', 'terminated']).optional(),
});
export type UpdateStaffAgentInput = z.infer<typeof UpdateStaffAgentInputSchema>;

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

export const AddDivisionMemberInputSchema = z.object({
  division_id: z.string().min(1).max(255),
  staff_id: z.string().min(1).max(255),
  role: z.enum(['head', 'member', 'specialist']).default('specialist'),
});
export type AddDivisionMemberInput = z.infer<typeof AddDivisionMemberInputSchema>;

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
  assigned_to_type: z.enum(['division', 'staff']).optional(),
  assigned_to_id: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'review', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  budget_allocated: z.number().optional(),
  due_at: z.string().optional(),
  completed_at: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  deliverable_id: z.string().optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

export const ListTasksInputSchema = z.object({
  assigned_to_type: z.enum(['division', 'staff']).optional(),
  assigned_to_id: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'review', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  limit: z.int().positive().max(100).default(50),
  offset: z.int().nonnegative().default(0),
});
export type ListTasksInput = z.infer<typeof ListTasksInputSchema>;

export const CompleteTaskInputSchema = z.object({
  task_id: z.string().min(1).max(255),
});
export type CompleteTaskInput = z.infer<typeof CompleteTaskInputSchema>;

export const CreateDeliverableInputSchema = z.object({
  deliverable_id: z.string().min(1).max(255),
  task_id: z.string().min(1).max(255),
  submitted_by_type: z.enum(['staff', 'division']),
  submitted_by_id: z.string().min(1).max(255),
  content: z.string(),
  status: z.enum(['submitted', 'accepted', 'rejected', 'revision_requested']).optional(),
  reviewed_by_type: z.enum(['founder', 'council', 'division_head']).optional(),
  reviewed_by_id: z.string().optional(),
  file_references: z.array(z.string()).optional(),
  task_relationships: z.array(z.string()).optional(),
  audit_log: z.array(z.string()).optional(),
});
export type CreateDeliverableInput = z.infer<typeof CreateDeliverableInputSchema>;

export const UpdateDeliverableInputSchema = z.object({
  deliverable_id: z.string().min(1).max(255),
  content: z.string().optional(),
  status: z.enum(['submitted', 'accepted', 'rejected', 'revision_requested']).optional(),
  reviewed_by_type: z.enum(['founder', 'council', 'division_head']).optional(),
  reviewed_by_id: z.string().optional(),
  file_references: z.array(z.string()).optional(),
  task_relationships: z.array(z.string()).optional(),
  audit_log: z.array(z.string()).optional(),
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

// Phase 7: Re-export from types.ts
export {
  CreateTaskAutonomyLevelInputSchema,
  RequestExecutionInputSchema,
  ApproveExecutionInputSchema,
  GetExecutionRequestInputSchema,
  ListExecutionRequestsInputSchema,
  ListApprovalRequestsInputSchema,
  GetExecutionHistoryInputSchema,
  type CreateTaskAutonomyLevelInput,
  type RequestExecutionInput,
  type ApproveExecutionInput,
  type GetExecutionRequestInput,
  type ListExecutionRequestsInput,
  type ListApprovalRequestsInput,
  type GetExecutionHistoryInput
} from './types.js';