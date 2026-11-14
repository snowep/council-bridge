// Executions Routes
// Consolidates execution endpoints and adds missing endpoints
// Implements: GET /api/executions, GET /api/executions/:id, GET /api/executions/:id/history,
//             POST /api/executions/request, POST /api/executions/approve, POST /api/executions/:id/execute,
//             POST /api/executions/:id/cancel, GET /api/executions/autonomy-levels

import { Router, Request, Response } from 'express';
import {
  listExecutionRequests,
  getExecutionRequest,
  getExecutionHistory,
  requestExecution,
  approveExecution,
  executeExecutionRequest,
  cancelExecutionRequest,
  listTaskAutonomyLevels,
  getTaskAutonomyLevel,
  createTaskAutonomyLevel,
} from '../../council/operations.js';
import { getDatabase } from '../../database.js';
import { authMiddleware, getAuthContext, requireAuth, requireFounder } from '../middleware/authentication.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { ListExecutionsSchema, RequestExecutionSchema, ApproveExecutionSchema, ExecuteExecutionSchema, CancelExecutionSchema } from '../schemas/index.js';

const router = Router();
import { databaseInstance as db } from '../../database.js';

function getParamId(params: any, key: string): string {
  const val = params[key];
  return Array.isArray(val) ? val[0] : val;
}

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/executions - List executions (frontend uses this path, not /api/execution)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const { limit, offset, status, autonomy_level, requested_by_type, requested_by_id, task_id } = ListExecutionsSchema.parse(req.query);

  // Authorization: Founder sees all, others see their own
  const effectiveRequestedByType = ctx.owner_type === 'founder' ? (requested_by_type as any) : ctx.owner_type;
  const effectiveRequestedById = ctx.owner_type === 'founder' ? (requested_by_id as string | undefined) : ctx.owner_id;

  const executions = listExecutionRequests(db, ctx, {
    status: status as any,
    autonomy_level: autonomy_level as any,
    requested_by_type: effectiveRequestedByType,
    requested_by_id: effectiveRequestedById,
    task_id: task_id as string | undefined,
    limit,
    offset,
  });

  res.json({ executions, limit, offset });
}));

// GET /api/executions/autonomy-levels - List task autonomy levels
router.get('/autonomy-levels', asyncHandler(async (req: Request, res: Response) => {
  requireAuth(req);

  const levels = listTaskAutonomyLevels(db);

  res.json({ autonomyLevels: levels });
}));

// GET /api/executions/autonomy-levels/:taskId - Get autonomy level for specific task
router.get('/autonomy-levels/:taskId', asyncHandler(async (req: Request, res: Response) => {
  requireAuth(req);
  const taskId = getParamId(req.params, 'taskId');

  if (!taskId) {
    throw new NotFoundError('Task ID required');
  }

  const level = getTaskAutonomyLevel(db, taskId);

  if (!level) {
    throw new NotFoundError('Autonomy level not found for task');
  }

  res.json({ autonomyLevel: level });
}));

// POST /api/executions/autonomy-levels - Create task autonomy level (Founder only)
router.post('/autonomy-levels', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireFounder(req);
  const { task_id, autonomy_level } = req.body;

  if (!task_id || !autonomy_level) {
    throw new ValidationError('task_id and autonomy_level required', { task_id, autonomy_level });
  }

  if (![1, 2, 3].includes(autonomy_level)) {
    throw new ValidationError('autonomy_level must be 1, 2, or 3', { autonomy_level });
  }

  const level = createTaskAutonomyLevel(db, ctx, { task_type: task_id, autonomy_level, description: '' });

  res.status(201).json({ autonomyLevel: level });
}));

// GET /api/executions/:id - Get execution details
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const id = getParamId(req.params, 'id');

  if (!id) {
    throw new NotFoundError('Execution ID required');
  }

  const execution = getExecutionRequest(db, ctx, { execution_id: id });

  if (!execution) {
    throw new NotFoundError('Execution not found');
  }

  res.json({ execution });
}));

// GET /api/executions/:id/history - Get execution history
router.get('/:id/history', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const id = getParamId(req.params, 'id');

  if (!id) {
    throw new NotFoundError('Execution ID required');
  }

  const history = getExecutionHistory(db, ctx, { execution_id: id });

  if (!history) {
    throw new NotFoundError('Execution not found');
  }

  res.json({ history });
}));

// POST /api/executions/request - Request execution
router.post('/request', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const input = RequestExecutionSchema.parse(req.body);

  const execution = requestExecution(db, ctx, input);

  res.status(201).json({ execution });
}));

// POST /api/executions/approve - Approve execution (Founder only with signature)
router.post('/approve', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireFounder(req);
  const input = ApproveExecutionSchema.parse(req.body);

  const result = approveExecution(db, ctx, input);

  res.json({ result });
}));

// POST /api/executions/:id/execute - Execute execution (Founder only with signature)
router.post('/:id/execute', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireFounder(req);
  const id = getParamId(req.params, 'id');
  const input = ExecuteExecutionSchema.parse(req.body);

  if (!id) {
    throw new NotFoundError('Execution ID required');
  }

  const result = executeExecutionRequest(db, ctx, id, input.result_payload ?? {});

  res.json({ result });
}));

// POST /api/executions/:id/cancel - Cancel execution
router.post('/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const id = getParamId(req.params, 'id');
  const input = CancelExecutionSchema.parse(req.body);

  if (!id) {
    throw new NotFoundError('Execution ID required');
  }

  // Check permission: requester or Founder can cancel
  const execution = getExecutionRequest(db, ctx, { execution_id: id });
  if (!execution) {
    throw new NotFoundError('Execution not found');
  }

  const isRequester = execution.requested_by_id === ctx.owner_id && execution.requested_by_type === ctx.owner_type;
  if (ctx.owner_type !== 'founder' && !isRequester) {
    throw new ValidationError('Insufficient permissions to cancel this execution', { execution_id: id });
  }

  const result = cancelExecutionRequest(db, ctx, id, input.error_message ?? 'Cancelled by user');

  res.json({ result });
}));

export default router;