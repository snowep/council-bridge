// Tasks Routes
// Implements: GET /api/tasks, GET /api/tasks/:id, POST /api/tasks, PUT /api/tasks/:id/assign, PUT /api/tasks/:id/status

import { Router, Request, Response } from 'express';
import { listTasks, getTaskById, createTask, updateTask } from '../../council/divisions.js';
import { assertTaskAccess } from '../../council/operations.js';
import { authMiddleware, requireAuth } from '../middleware/authentication.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { ListTasksSchema, CreateTaskSchema, AssignTaskSchema, UpdateTaskStatusSchema } from '../schemas/index.js';

const router = Router();
import { databaseInstance as db } from '../../database.js';

function getParamId(params: any, key: string): string {
  const val = params[key];
  return Array.isArray(val) ? val[0] : val;
}

function assertDivisionDestination(
  ctx: ReturnType<typeof requireAuth>,
  assignedType: 'division' | 'staff',
  assignedId: string
): void {
  // Founder: validate destination exists and is active, but can assign across divisions
  if (ctx.owner_type === 'founder') {
    if (assignedType === 'division') {
      const division = db.query(
        `SELECT 1 FROM divisions WHERE division_id = ? LIMIT 1`,
        [assignedId]
      );
      if (division.length === 0) {
        throw new ValidationError(
          'Destination division does not exist',
          { assigned_to_id: assignedId }
        );
      }
    } else {
      const staff = db.query(
        `SELECT 1 FROM staff_agents WHERE staff_id = ? AND status = 'active' LIMIT 1`,
        [assignedId]
      );
      if (staff.length === 0) {
        throw new ValidationError(
          'Destination staff member does not exist or is not active',
          { assigned_to_id: assignedId }
        );
      }
    }
    return;
  }

  // Division Head: can only assign within own division
  if (ctx.owner_type !== 'division') {
    throw new ValidationError(
      'Only Founder or the owning Division Head can assign tasks',
      { owner_type: ctx.owner_type }
    );
  }

  if (assignedType === 'division') {
    if (assignedId !== ctx.owner_id) {
      throw new ValidationError(
        'Division Head cannot assign tasks to another division',
        { assigned_to_id: assignedId }
      );
    }
    return;
  }

  const membership = db.query(
    `SELECT 1
       FROM division_members
       WHERE staff_id = ?
         AND division_id = ?
         AND (SELECT status FROM staff_agents WHERE staff_id = ?) = 'active'
       LIMIT 1`,
    [assignedId, ctx.owner_id, assignedId]
  );

  if (membership.length === 0) {
    throw new ValidationError(
      'Destination staff must be active and belong to the authenticated division',
      { assigned_to_id: assignedId }
    );
  }
}

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/tasks - List tasks with filters
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const { limit, offset, assigned_to_type, assigned_to_id, status } = ListTasksSchema.parse(req.query);

  // 1. Load candidates using only non-authorization filters (status only)
  let candidates = listTasks(db, { status: status as any });

  // 2. Apply authorization via canonical assertTaskAccess() first
  let filteredTasks: any[] = [];
  for (const task of candidates) {
    try {
      assertTaskAccess(db, ctx, task.task_id);
      filteredTasks.push(task);
    } catch (error) {
      if (error instanceof Error && error.message === 'Authorization denied') {
        // Skip tasks the caller cannot access
      } else {
        throw error;
      }
    }
  }

  // 3. Apply caller-supplied filters (assigned_to_type, assigned_to_id) which can only narrow, not widen results
  if (assigned_to_type) {
    filteredTasks = filteredTasks.filter((task) => task.assigned_to_type === assigned_to_type);
  }
  if (assigned_to_id) {
    filteredTasks = filteredTasks.filter((task) => task.assigned_to_id === assigned_to_id);
  }

  // 4. Apply pagination
  const paginated = filteredTasks.slice(offset, offset + limit);

  // Set X-Total-Count header for pagination
  res.set('X-Total-Count', String(filteredTasks.length));

  res.json({ tasks: paginated, total_count: filteredTasks.length, limit, offset });
}));

// GET /api/tasks/:id - Get task details
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const id = getParamId(req.params, 'id');

  if (!id) {
    throw new NotFoundError('Task ID required');
  }

  // Use canonical task access policy from task-delegation.ts
  let task: any;
  try {
    task = assertTaskAccess(db, ctx, id);
  } catch (error) {
    if (error instanceof Error && (error.message === 'Authorization denied' || error.message.includes('not found'))) {
      throw new NotFoundError('Task not found');
    }
    throw error;
  }

  res.json({ task });
}));

// POST /api/tasks - Create task (Founder or Division Head only)
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);

  // Only Founder or Division Head can create tasks
  if (!['founder', 'division'].includes(ctx.owner_type)) {
    throw new ValidationError('Insufficient permissions to create tasks', { owner_type: ctx.owner_type });
  }

  const input = CreateTaskSchema.parse(req.body);

  // Validate assignment scope for non-Founder creators
  assertDivisionDestination(
    ctx,
    input.assigned_to_type,
    input.assigned_to_id
  );

  // Task creator identity MUST come from authenticated identity, not caller-supplied
  // Reject any caller-supplied created_by_type/created_by_id (schema requires them but we override)
  const task = createTask(db, {
    ...input,
    created_by_type: ctx.owner_type === 'founder' ? 'founder' : 'division_head',
    created_by_id: ctx.owner_type === 'founder' ? 'founder' : ctx.owner_id,
  }, { owner_type: ctx.owner_type, owner_id: ctx.owner_id, runtime: ctx.runtime });

  res.status(201).json({ task });
}));

// PUT /api/tasks/:id/assign - Assign/reassign task
router.put('/:id/assign', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const id = getParamId(req.params, 'id');

  if (!id) {
    throw new NotFoundError('Task ID required');
  }

  // Verify task exists and user has access
  let task: any;
  try {
    task = assertTaskAccess(db, ctx, id);
  } catch (error) {
    if (error instanceof Error && (error.message === 'Authorization denied' || error.message.includes('not found'))) {
      throw new NotFoundError('Task not found');
    }
    throw error;
  }

  // Validate current task's management scope before validating the destination
  // This prevents a Division Head from changing the destination of a task they didn't originally own
  if (ctx.owner_type !== 'founder') {
    if (ctx.owner_type !== 'division') {
      throw new ValidationError('Only Founder or the owning Division Head can reassign tasks', {});
    }

    let currentTaskBelongsToDivision = false;

    if (task.assigned_to_type === 'division') {
      currentTaskBelongsToDivision = task.assigned_to_id === ctx.owner_id;
    } else if (task.assigned_to_type === 'staff') {
      const membership = db.query(
        'SELECT 1 FROM division_members WHERE staff_id = ? AND division_id = ?',
        [task.assigned_to_id, ctx.owner_id]
      );
      currentTaskBelongsToDivision = membership.length > 0;
    }

    if (!currentTaskBelongsToDivision) {
      throw new ValidationError('Division Head cannot reassign a task outside their division', {});
    }
  }

  const input = AssignTaskSchema.parse(req.body);

  // Validate assignment destination permissions
  assertDivisionDestination(ctx, input.assigned_to_type, input.assigned_to_id);

  const updatedTask = updateTask(db, id, {
    assigned_to_type: input.assigned_to_type,
    assigned_to_id: input.assigned_to_id,
  }, { owner_type: ctx.owner_type, owner_id: ctx.owner_id, runtime: ctx.runtime });

  res.json({ task: updatedTask });
}));

// PUT /api/tasks/:id/status - Update task status
router.put('/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const id = getParamId(req.params, 'id');

  if (!id) {
    throw new NotFoundError('Task ID required');
  }

  // Verify task exists and user has access
  let task: any;
  try {
    task = assertTaskAccess(db, ctx, id);
  } catch (error) {
    if (error instanceof Error && (error.message === 'Authorization denied' || error.message.includes('not found'))) {
      throw new NotFoundError('Task not found');
    }
    throw error;
  }

  // Check permission: assignee or Founder can update status
  const isAssignee = task.assigned_to_id === ctx.owner_id && task.assigned_to_type === ctx.owner_type;
  if (ctx.owner_type !== 'founder' && !isAssignee) {
    throw new ValidationError('Insufficient permissions to update task status', { task_id: id, owner_type: ctx.owner_type });
  }

  const input = UpdateTaskStatusSchema.parse(req.body);

  const updatedTask = updateTask(db, id, {
    status: input.status,
  }, { owner_type: ctx.owner_type, owner_id: ctx.owner_id, runtime: ctx.runtime });

  res.json({ task: updatedTask });
}));

export default router;