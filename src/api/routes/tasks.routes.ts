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

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/tasks - List tasks with filters
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const { limit, offset, assigned_to_type, assigned_to_id, status } = ListTasksSchema.parse(req.query);

  // Authorization filtering using canonical assertTaskAccess policy
  let effectiveAssignedToType = assigned_to_type as any;
  let effectiveAssignedToId = assigned_to_id as string | undefined;

  if (ctx.owner_type === 'staff') {
    effectiveAssignedToType = 'staff';
    effectiveAssignedToId = ctx.owner_id;
  } else if (ctx.owner_type === 'division') {
    effectiveAssignedToType = 'division';
    effectiveAssignedToId = ctx.owner_id;
  }

  const allTasks = listTasks(db, {
    assigned_to_type: effectiveAssignedToType,
    assigned_to_id: effectiveAssignedToId,
    status: status as any,
  });

  // Filter by canonical task access policy
  const filteredTasks = allTasks.filter((task) => {
    try {
      assertTaskAccess(db, ctx, task.task_id);
      return true;
    } catch (error) {
      if (error instanceof Error && error.message === 'Authorization denied') {
        // Allow founder to see all tasks
        return ctx.owner_type === 'founder';
      }
      throw error;
    }
  });

  const paginated = filteredTasks.slice(offset, offset + limit);
  res.json({ tasks: paginated, limit, offset });
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

  // Authorization: Only Founder or the Division Head that owns the assigned division can reassign
  if (ctx.owner_type !== 'founder') {
    // Division head can only reassign tasks in their division
    if (task.assigned_to_type === 'division' && task.assigned_to_id !== ctx.owner_id) {
      throw new ValidationError('Insufficient permissions to assign this task', { owner_type: ctx.owner_type, task_id: id });
    }
    // Staff cannot reassign tasks
    if (ctx.owner_type === 'staff') {
      throw new ValidationError('Staff agents cannot reassign tasks', { owner_type: ctx.owner_type, task_id: id });
    }
  }

  const input = AssignTaskSchema.parse(req.body);

  // Verify current task ownership (destination assignee permissions)
  // If assigning to staff: verify staff exists, is active, and is member of task's division
  if (input.assigned_to_type === 'staff') {
    const staff = db.query('SELECT * FROM staff_agents WHERE staff_id = ?', [input.assigned_to_id]);
    if (staff.length === 0) {
      throw new ValidationError('Destination staff agent not found', { assigned_to_id: input.assigned_to_id });
    }
    if ((staff[0] as any).status !== 'active') {
      throw new ValidationError('Cannot assign to inactive staff agent', { assigned_to_id: input.assigned_to_id });
    }
    // If source task is division-assigned, verify staff is member of that division
    if (task.assigned_to_type === 'division') {
      const membership = db.query(
        'SELECT 1 FROM division_members WHERE staff_id = ? AND division_id = ?',
        [input.assigned_to_id, task.assigned_to_id]
      );
      if (membership.length === 0) {
        throw new ValidationError('Destination staff is not a member of the source division', { assigned_to_id: input.assigned_to_id });
      }
    }
  }

  // If assigning to division: verify division exists
  if (input.assigned_to_type === 'division') {
    const division = db.query('SELECT * FROM divisions WHERE division_id = ?', [input.assigned_to_id]);
    if (division.length === 0) {
      throw new ValidationError('Destination division not found', { assigned_to_id: input.assigned_to_id });
    }
  }

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