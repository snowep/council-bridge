// MCP Tool Registration - Phase 9 Pre-Batch 3 Gate 2 Task 3
// Authoritative tool registration with Zod v4 schemas, authenticated actor context, service-layer authorization

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { DatabaseInstance } from '../database.js';
import { OperationContext } from '../council/operations.js';
import {
  createTaskAutonomyLevel,
  listTaskAutonomyLevels,
  getTaskAutonomyLevel,
  updateTaskAutonomyLevel,
  requestExecution,
  approveExecution,
  getExecutionRequest,
  getExecutionHistory,
  listExecutionRequests,
  listApprovalRequests,
  executeExecutionRequest,
  cancelExecutionRequest,
  requireAuthenticated
} from '../council/operations.js';
import { createAgentService } from '../agents.js';
import { createMessageService } from '../messages.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// Phase 1 Communication Tool Schemas (Zod v4)
const RegisterAgentSchema = z.object({
  agent_id: z.string().min(1).max(255).describe('Unique agent identifier'),
  display_name: z.string().min(1).max(255).describe('Display name for the agent'),
  runtime: z.string().min(1).max(255).describe('Runtime identifier (claude/hermes)'),
});

const SendMessageSchema = z.object({
  sender_id: z.string().min(1).max(255).describe('ID of the sending agent'),
  recipient_id: z.string().min(1).max(255).describe('ID of the recipient agent'),
  content: z.string().min(1).describe('Message content'),
  reply_to: z.string().uuid().optional().describe('Optional UUID of message being replied to'),
});

const GetMessagesSchema = z.object({
  agent_id: z.string().min(1).max(255).describe('ID of the agent to get messages for'),
  limit: z.number().int().positive().max(100).default(50).optional().describe('Maximum number of messages to return'),
});

const CheckInboxSchema = z.object({
  agent_id: z.string().min(1).max(255).describe('ID of the agent to check inbox for'),
});

const ReplyMessageSchema = z.object({
  agent_id: z.string().min(1).max(255).describe('ID of the replying agent'),
  message_id: z.string().uuid().describe('UUID of message being replied to'),
  content: z.string().min(1).describe('Reply content'),
});

const ListMessagesSchema = z.object({
  agent_id: z.string().min(1).max(255).describe('ID of the agent to list messages for'),
  limit: z.number().int().positive().max(100).default(50).optional().describe('Maximum messages to return'),
});

const ListAgentsSchema = z.object({}).describe('No arguments required');

// Phase 7/9 Execution and Autonomy Tool Schemas
const RequestExecutionSchema = z.object({
  task_id: z.string().min(1).max(255).describe('ID of the task to execute'),
  action_description: z.string().min(1).max(2000).describe('Description of the action to execute'),
  action_payload: z.record(z.string(), z.any()).default({}).describe('Payload for the action'),
  autonomy_level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().describe('Autonomy level (1=queued, 2=permission_check, 3=approval_required)'),
});

const ApproveExecutionSchema = z.object({
  approval_request_id: z.string().min(1).max(255).describe('ID of the approval request'),
  approved: z.boolean().describe('Whether to approve or reject'),
  rejection_reason: z.string().optional().describe('Reason for rejection if not approved'),
});

const GetExecutionRequestSchema = z.object({
  execution_id: z.string().min(1).max(255).describe('ID of the execution request'),
});

const ListExecutionRequestsSchema = z.object({
  status: z.enum(['proposed', 'permission_check', 'approval_required', 'approved', 'rejected', 'queued', 'running', 'completed', 'failed', 'cancelled']).optional().describe('Filter by execution status'),
  autonomy_level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().describe('Filter by autonomy level'),
  requested_by_type: z.enum(['staff', 'division', 'founder']).optional().describe('Filter by requester type'),
  requested_by_id: z.string().optional().describe('Filter by requester ID'),
  task_id: z.string().optional().describe('Filter by task ID'),
  limit: z.number().int().positive().max(100).default(50).describe('Maximum results'),
  offset: z.number().int().nonnegative().default(0).describe('Offset for pagination'),
});

const ListApprovalRequestsSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'expired', 'cancelled']).optional().describe('Filter by approval status'),
  requested_by_type: z.enum(['staff', 'division', 'founder']).optional().describe('Filter by requester type'),
  requested_by_id: z.string().optional().describe('Filter by requester ID'),
  limit: z.number().int().positive().max(100).default(50).describe('Maximum results'),
  offset: z.number().int().nonnegative().default(0).describe('Offset for pagination'),
});

const GetExecutionHistorySchema = z.object({
  execution_id: z.string().min(1).max(255).describe('ID of the execution request'),
});

const ExecuteExecutionRequestSchema = z.object({
  execution_id: z.string().min(1).max(255).describe('ID of the execution request to execute'),
  result_payload: z.record(z.string(), z.any()).default({}).describe('Result payload from execution'),
});

const CancelExecutionRequestSchema = z.object({
  execution_id: z.string().min(1).max(255).describe('ID of the execution request to cancel'),
  error_message: z.string().default('Cancelled by user').describe('Cancellation reason'),
});

const CreateTaskAutonomyLevelSchema = z.object({
  task_type: z.string().min(1).max(255).describe('Task type identifier'),
  autonomy_level: z.union([z.literal(1), z.literal(2), z.literal(3)]).describe('Autonomy level (1, 2, or 3)'),
  description: z.string().optional().describe('Optional description'),
});

const UpdateTaskAutonomyLevelSchema = z.object({
  task_type: z.string().min(1).max(255).describe('Task type identifier'),
  autonomy_level: z.union([z.literal(1), z.literal(2), z.literal(3)]).describe('New autonomy level'),
  description: z.string().optional().describe('Optional description'),
});

const GetTaskAutonomyLevelSchema = z.object({
  task_type: z.string().min(1).max(255).describe('Task type identifier'),
});

// ============================================================
// PHASE 9 BATCH 4: Deliverable Workflow Tool Schemas
// ============================================================

const CreateDeliverableDraftSchema = z.object({
  task_id: z.string().min(1).max(255).describe('Task ID'),
  content: z.string().min(1).describe('Deliverable content'),
  quality_score: z.number().int().min(0).max(100).optional().describe('Quality score (0-100)'),
});

const SubmitDeliverableSchema = z.object({
  task_id: z.string().min(1).max(255).describe('Task ID'),
  content: z.string().min(1).describe('Deliverable content'),
  quality_score: z.number().int().min(0).max(100).optional().describe('Quality score (0-100)'),
});

const AssignDeliverableReviewerSchema = z.object({
  deliverable_id: z.string().min(1).max(255).describe('Deliverable ID'),
  reviewer_type: z.enum(['founder', 'council', 'division_head']).describe('Reviewer role type'),
  reviewer_id: z.string().min(1).max(255).describe('Reviewer ID'),
});

const RequestDeliverableRevisionSchema = z.object({
  deliverable_id: z.string().min(1).max(255).describe('Deliverable ID'),
  revision_notes: z.string().min(1).max(5000).describe('Revision notes'),
});

const ResubmitDeliverableSchema = z.object({
  deliverable_id: z.string().min(1).max(255).describe('Deliverable ID'),
  content: z.string().min(1).describe('Updated deliverable content'),
  quality_score: z.number().int().min(0).max(100).optional().describe('Quality score (0-100)'),
});

const ApproveDeliverableSchema = z.object({
  deliverable_id: z.string().min(1).max(255).describe('Deliverable ID'),
  quality_score: z.number().int().min(0).max(100).optional().describe('Quality score (0-100)'),
  founder_signature: z.string().optional().describe('Founder signature (required for Level 3)'),
});

const RejectDeliverableSchema = z.object({
  deliverable_id: z.string().min(1).max(255).describe('Deliverable ID'),
  rejection_reason: z.string().min(1).max(5000).describe('Rejection reason'),
});

const GetDeliverableHistorySchema = z.object({
  deliverable_id: z.string().min(1).max(255).describe('Deliverable ID'),
});

const SetQualityThresholdSchema = z.object({
  division_id: z.string().optional().describe('Division ID (optional)'),
  task_type: z.string().optional().describe('Task type (optional)'),
  min_quality_score: z.number().int().min(0).max(100).describe('Minimum quality score (0-100)'),
  requires_review: z.boolean().default(true).describe('Whether review is required'),
});

const GetQualityThresholdSchema = z.object({
  division_id: z.string().optional().describe('Division ID (optional)'),
  task_type: z.string().optional().describe('Task type (optional)'),
});

// Helper function to create MCP error responses
function mcpError(message: string, code: string = 'MCP_ERROR'): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message, code }) }],
    isError: true,
  };
}

// Tool handler wrapper for service-layer operations
function createToolHandler<TArgs extends Record<string, any>, TResult>(
  db: DatabaseInstance,
  getAuthContext: (req: any) => OperationContext | null | undefined,
  serviceFn: (db: DatabaseInstance, ctx: OperationContext, args: TArgs) => TResult
) {
  return async (args: TArgs, extra: RequestHandlerExtra<any, any>): Promise<CallToolResult> => {
    try {
      const req = extra.requestInfo?.headers ? { headers: extra.requestInfo.headers } : extra;
      const ctx = getAuthContext(req);
      if (!ctx) {
        return mcpError('Authentication required', 'AUTH_REQUIRED');
      }
      // Validate authentication
      requireAuthenticated(ctx);

      const result = await serviceFn(db, ctx, args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const code = message.includes('Authorization') || message.includes('denied') ? 'AUTH_DENIED' : 'MCP_ERROR';
      return mcpError(message, code);
    }
  };
}

/**
 * Register all MCP tools with the server
 * @param mcpServer - The MCP server instance
 * @param db - Database instance
 * @param getAuthContext - Function to extract auth context from request
 */
export function registerMcpTools(
  mcpServer: McpServer,
  db: DatabaseInstance,
  getAuthContext: (req: any) => OperationContext | null | undefined
): void {
  // Create service instances
  const agentService = createAgentService(db);
  const messageService = createMessageService(db, agentService);

  // ============================================================
  // PHASE 1: Communication Tools
  // ============================================================

  mcpServer.tool(
    'send_message',
    'Send a message to another agent',
    SendMessageSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      // Verify sender identity matches authenticated context
      if (ctx.owner_type !== 'founder' && args.sender_id !== ctx.owner_id) {
        throw new Error('Sender ID must match authenticated identity');
      }
      return messageService.sendMessage(args);
    })
  );

  mcpServer.tool(
    'get_messages',
    'Get messages for an agent',
    GetMessagesSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      // Verify agent access - agents can only read their own messages unless founder
      if (ctx.owner_type !== 'founder' && args.agent_id !== ctx.owner_id) {
        throw new Error('Can only retrieve messages for authenticated agent');
      }
      return messageService.checkInbox(args.agent_id);
    })
  );

  mcpServer.tool(
    'list_agents',
    'List all registered agents',
    ListAgentsSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx) => {
      // All authenticated users can list agents
      return agentService.listAgents();
    })
  );

  // register_agent - Founder only
  mcpServer.tool(
    'register_agent',
    'Register a new agent',
    RegisterAgentSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      if (ctx.owner_type !== 'founder') {
        throw new Error('Only Founder can register agents');
      }
      return agentService.registerAgent(args);
    })
  );

  // check_inbox - agent can only check own inbox
  mcpServer.tool(
    'check_inbox',
    'Check inbox for an agent',
    CheckInboxSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      if (ctx.owner_type !== 'founder' && args.agent_id !== ctx.owner_id) {
        throw new Error('Can only check inbox for authenticated agent');
      }
      return messageService.checkInbox(args.agent_id);
    })
  );

  // reply_message - only intended recipient can reply
  mcpServer.tool(
    'reply_message',
    'Reply to a message',
    ReplyMessageSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      if (ctx.owner_type !== 'founder' && args.agent_id !== ctx.owner_id) {
        throw new Error('Can only reply as authenticated agent');
      }
      return messageService.replyMessage(args);
    })
  );

  // list_messages - agent can only list own messages
  mcpServer.tool(
    'list_messages',
    'List messages for an agent',
    ListMessagesSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      if (ctx.owner_type !== 'founder' && args.agent_id !== ctx.owner_id) {
        throw new Error('Can only list messages for authenticated agent');
      }
      return messageService.listMessages({
        agent_id: args.agent_id,
        limit: args.limit ?? 50
      });
    })
  );

  // ============================================================
  // PHASE 7/9: Task Autonomy Level Tools
  // ============================================================

  mcpServer.tool(
    'create_task_autonomy_level',
    'Create a task autonomy level definition (Founder only)',
    CreateTaskAutonomyLevelSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      // Founder-only operation enforced by service layer
      return createTaskAutonomyLevel(db, ctx, args);
    })
  );

  mcpServer.tool(
    'update_task_autonomy_level',
    'Update a task autonomy level definition (Founder only)',
    UpdateTaskAutonomyLevelSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      return updateTaskAutonomyLevel(db, ctx, args.task_type, args.autonomy_level, args.description);
    })
  );

  mcpServer.tool(
    'get_task_autonomy_level',
    'Get a task autonomy level definition',
    GetTaskAutonomyLevelSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      const result = getTaskAutonomyLevel(db, args.task_type);
      if (!result) {
        throw new Error(`Task autonomy level for '${args.task_type}' not found`);
      }
      return result;
    })
  );

  mcpServer.tool(
    'list_task_autonomy_levels',
    'List all task autonomy level definitions',
    ListAgentsSchema.shape, // Empty schema
    createToolHandler(db, getAuthContext, async (db, ctx) => {
      return listTaskAutonomyLevels(db);
    })
  );

  // ============================================================
  // PHASE 7/9: Execution Request Tools
  // ============================================================

  mcpServer.tool(
    'request_execution',
    'Request task execution (creates execution request with autonomy level)',
    RequestExecutionSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      // Authorization handled by service layer (getTaskForActor)
      return requestExecution(db, ctx, args);
    })
  );

  mcpServer.tool(
    'get_execution_request',
    'Get execution request by ID',
    GetExecutionRequestSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      return getExecutionRequest(db, ctx, args);
    })
  );

  mcpServer.tool(
    'list_execution_requests',
    'List execution requests with filters',
    ListExecutionRequestsSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      return listExecutionRequests(db, ctx, args);
    })
  );

  mcpServer.tool(
    'execute_execution_request',
    'Execute an approved/queued execution request (requester or Founder)',
    ExecuteExecutionRequestSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      return executeExecutionRequest(db, ctx, args.execution_id, args.result_payload);
    })
  );

  mcpServer.tool(
    'cancel_execution_request',
    'Cancel an execution request (requester or Founder)',
    CancelExecutionRequestSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      return cancelExecutionRequest(db, ctx, args.execution_id, args.error_message);
    })
  );

  // ============================================================
  // PHASE 7/9: Approval Tools (Founder only)
  // ============================================================

  mcpServer.tool(
    'approve_execution',
    'Approve or reject a Level 3 execution request (Founder only)',
    ApproveExecutionSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      // Service layer enforces Founder-only
      return approveExecution(db, ctx, args);
    })
  );

  mcpServer.tool(
    'list_approval_requests',
    'List approval requests (Founder only)',
    ListApprovalRequestsSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      return listApprovalRequests(db, ctx, args);
    })
  );

  // ============================================================
  // PHASE 7/9: Execution History Tools
  // ============================================================

  mcpServer.tool(
    'get_execution_history',
    'Get execution history for an execution request',
    GetExecutionHistorySchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      return getExecutionHistory(db, ctx, args);
    })
  );

  // ============================================================
  // PHASE 9 BATCH 4: Deliverable Workflow Tools
  // ============================================================

  mcpServer.tool(
    'create_deliverable_draft',
    'Create a deliverable draft',
    CreateDeliverableDraftSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      const { createDeliverableDraft } = await import('../council/task-delegation.js');
      return createDeliverableDraft(db, ctx, args);
    })
  );

  mcpServer.tool(
    'submit_deliverable',
    'Submit a deliverable for review',
    SubmitDeliverableSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      const { submitDeliverable } = await import('../council/task-delegation.js');
      return submitDeliverable(db, ctx, args);
    })
  );

  mcpServer.tool(
    'assign_deliverable_reviewer',
    'Assign a reviewer to a deliverable',
    AssignDeliverableReviewerSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      const { assignReviewer } = await import('../council/task-delegation.js');
      return assignReviewer(db, ctx, args);
    })
  );

  mcpServer.tool(
    'request_deliverable_revision',
    'Request revision on a deliverable',
    RequestDeliverableRevisionSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      const { requestRevision } = await import('../council/task-delegation.js');
      return requestRevision(db, ctx, args);
    })
  );

  mcpServer.tool(
    'resubmit_deliverable',
    'Resubmit a deliverable after revision',
    ResubmitDeliverableSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      const { resubmitDeliverable } = await import('../council/task-delegation.js');
      return resubmitDeliverable(db, ctx, args);
    })
  );

  mcpServer.tool(
    'approve_deliverable',
    'Approve a deliverable with HITL enforcement',
    ApproveDeliverableSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      const { approveDeliverable } = await import('../council/task-delegation.js');
      return approveDeliverable(db, ctx, args);
    })
  );

  mcpServer.tool(
    'reject_deliverable',
    'Reject a deliverable',
    RejectDeliverableSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      const { rejectDeliverable } = await import('../council/task-delegation.js');
      return rejectDeliverable(db, ctx, args);
    })
  );

  mcpServer.tool(
    'get_deliverable_history',
    'Get deliverable version history',
    GetDeliverableHistorySchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      const { getDeliverableHistory } = await import('../council/task-delegation.js');
      return getDeliverableHistory(db, ctx, args.deliverable_id);
    })
  );

  mcpServer.tool(
    'set_quality_threshold',
    'Set quality threshold (Founder only)',
    SetQualityThresholdSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      const { setQualityThreshold } = await import('../council/task-delegation.js');
      return setQualityThreshold(db, ctx, args);
    })
  );

  mcpServer.tool(
    'get_quality_threshold',
    'Get quality threshold configuration (Founder only)',
    GetQualityThresholdSchema.shape,
    createToolHandler(db, getAuthContext, async (db, ctx, args) => {
      const { getQualityThresholdConfig } = await import('../council/task-delegation.js');
      return getQualityThresholdConfig(db, ctx, args.division_id, args.task_type);
    })
  );
}