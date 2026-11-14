// Tasks Routes
// Implements: GET /api/tasks, GET /api/tasks/:id, POST /api/tasks, PUT /api/tasks/:id/assign, PUT /api/tasks/:id/status

import { Router, Request, Response } from 'express';
import { listTasks, getTaskById, createTask, updateTask } from '../../council/divisions.js';
import { getDatabase } from '../../database.js';
import { authMiddleware, getAuthContext, requireAuth, requireDivisionHead } from '../middleware/authentication.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { ListTasksSchema, CreateTaskSchema, UpdateTaskSchema, AssignTaskSchema, UpdateTaskStatusSchema } from '../schemas/index.js';

const router = Router();
import { databaseInstance as db } from '../../database.js';

function getParamId(params: any, key: string): string {
  const val = params[key];
  return Array.isArray(val) ? val[0] : val;
}

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/tasks - List tasks with filters
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const { limit, offset, assigned_to_type, assigned_to_id, status, created_by_type, created_by_id } = ListTasksSchema.parse(req.query);

  // Authorization filtering
  let effectiveAssignedToType = assigned_to_type as any;
  let effectiveAssignedToId = assigned_to_id as string | undefined;

  if (ctx.owner_type === 'staff') {
    effectiveAssignedToType = 'staff';
    effectiveAssignedToId = ctx.owner_id;
  } else if (ctx.owner_type === 'division') {
    effectiveAssignedToType = 'division';
    effectiveAssignedToId = ctx.owner_id;
  }

  const tasks = listTasks(db, {
    assigned_to_type: effectiveAssignedToType,
    assigned_to_id: effectiveAssignedToId,
    status: status as any,
  });

  res.json({ tasks, limit, offset });
}));

// GET /api/tasks/:id - Get task details
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  requireAuth(req);
  const id = getParamId(req.params, 'id');

  if (!id) {
    throw new NotFoundError('Task ID required');
  }

  const task = getTaskById(db, id);

  if (!task) {
    throw new NotFoundError('Task not found');
  }

  res.json({ task });
}));

// POST /api/tasks - Create task (Founder, Council, Division Head only)
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);

  // Only Founder, Council, Division Head can create tasks
  if (!['founder', 'division'].includes(ctx.owner_type)) {
    throw new ValidationError('Insufficient permissions to create tasks', { owner_type: ctx.owner_type });
  }

  const input = CreateTaskSchema.parse(req.body);

  // Validate created_by matches authenticated user for non-Founder
  if (ctx.owner_type === 'division' && input.created_by_type !== 'division_head') {
    throw new ValidationError('Division can only create tasks as division_head', { created_by_type: input.created_by_type });
  }

  const task = createTask(db, {
    ...input,
    created_by_id: ctx.owner_type === 'founder' ? 'founder' : ctx.owner_id,
  });

  res.status(201).json({ task });
}));

// PUT /api/tasks/:id/assign - Assign/reassign task (Division Head or Founder)
router.put('/:id/assign', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const id = getParamId(req.params, 'id');

  if (!id) {
    throw new NotFoundError('Task ID required');
  }

  // Verify task exists
  const task = getTaskById(db, id);
  if (!task) {
    throw new NotFoundError('Task not found');
  }

  // Only Founder or Division Head of the assigned division can reassign
  if (ctx.owner_type !== 'founder') {
    if (ctx.owner_type !== 'division' || task.assigned_to_id !== ctx.owner_id) {
      throw new ValidationError('Insufficient permissions to assign this task', { owner_type: ctx.owner_type, task_id: id });
    }
  }

  const input = AssignTaskSchema.parse(req.body);

  const updatedTask = updateTask(db, id, {
    assigned_to_type: input.assigned_to_type,
    assigned_to_id: input.assigned_to_id,
  });

  res.json({ task: updatedTask });
}));

// PUT /api/tasks/:id/status - Update task status (Assignee or Founder)
router.put('/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const id = getParamId(req.params, 'id');

  if (!id) {
    throw new NotFoundError('Task ID required');
  }

  const task = getTaskById(db, id);
  if (!task) {
    throw new NotFoundError('Task not found');
  }

  // Check permission: assignee can update status, Founder can always
  const isAssignee = task.assigned_to_id === ctx.owner_id && task.assigned_to_type === ctx.owner_type;
  if (ctx.owner_type !== 'founder' && !isAssignee) {
    throw new ValidationError('Insufficient permissions to update task status', { task_id: id, owner_type: ctx.owner_type });
  }

  const input = UpdateTaskStatusSchema.parse(req.body);

  const updatedTask = updateTask(db, id, {
    status: input.status,
  });

  res.json({ task: updatedTask });
}));

export default router;