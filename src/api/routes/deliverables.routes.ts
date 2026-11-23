// Deliverables Routes
// Implements: GET /api/deliverables, GET /api/deliverables/:id, GET /api/deliverables/:id/versions,
//             POST /api/deliverables, PUT /api/deliverables/:id/submit, PUT /api/deliverables/:id/review,
//             PUT /api/deliverables/:id/revision

import { Router, Request, Response } from 'express';
import {
  createDeliverableDraft,
  submitDeliverable,
  requestRevision,
  approveDeliverable,
  rejectDeliverable,
  getDeliverableHistory,
  assignReviewer,
} from '../../council/task-delegation.js';
import { listDeliverablesByTask, getDeliverableById } from '../../council/divisions.js';
import { authMiddleware, requireAuth } from '../middleware/authentication.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/error-handler.js';
import {
  CreateDeliverableSchema,
  SubmitDeliverableSchema,
  ReviewDeliverableSchema,
  RequestRevisionSchema,
  AssignReviewerSchema,
  ListDeliverablesSchema,
} from '../schemas/index.js';

const router = Router();
import { databaseInstance as db } from '../../database.js';

// Apply auth middleware to all routes
router.use(authMiddleware);

function getParamId(params: any, key: string): string {
  const val = params[key];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/deliverables - List deliverables with filters
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const { limit, offset, task_id, status, submitted_by_type, submitted_by_id } = ListDeliverablesSchema.parse(req.query);

  // Authorization filtering
  let effectiveSubmittedByType = submitted_by_type as any;
  let effectiveSubmittedById = submitted_by_id as string | undefined;

  if (ctx.owner_type === 'staff') {
    effectiveSubmittedByType = 'staff';
    effectiveSubmittedById = ctx.owner_id;
  } else if (ctx.owner_type === 'division') {
    effectiveSubmittedByType = 'division';
    effectiveSubmittedById = ctx.owner_id;
  }

  const deliverables = listDeliverablesByTask(db, task_id ?? '');

  // Filter by status and submitted_by if provided
  let filtered = deliverables;
  if (status) filtered = filtered.filter(d => d.status === status);
  if (effectiveSubmittedByType && effectiveSubmittedById) {
    filtered = filtered.filter(d => d.submitted_by_type === effectiveSubmittedByType && d.submitted_by_id === effectiveSubmittedById);
  }

  // Apply pagination
  const paginated = filtered.slice(offset, offset + limit);
  res.json({ deliverables: paginated, limit, offset });
}));

// GET /api/deliverables/:id - Get deliverable details
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const id = getParamId(req.params, 'id');

  if (!id) {
    throw new NotFoundError('Deliverable ID required');
  }

  const deliverable = getDeliverableById(db, id);

  if (!deliverable) {
    throw new NotFoundError('Deliverable not found');
  }

  // Authorization check: verify user can access this deliverable
  // Get the associated task and check access
  const task = db.query('SELECT * FROM tasks WHERE task_id = ?', [deliverable.task_id])[0] as any;
  if (!task) {
    // Return 404 to avoid leaking existence
    throw new NotFoundError('Deliverable not found');
  }

  // Founder can access all
  if (ctx.owner_type !== 'founder') {
    // Check if user is related to the task
    const isTaskAssignee = task.assigned_to_type === ctx.owner_type && task.assigned_to_id === ctx.owner_id;
    const isDeliverableSubmitter = deliverable.submitted_by_type === ctx.owner_type && deliverable.submitted_by_id === ctx.owner_id;
    const isTaskCreator = task.created_by_type === ctx.owner_type && task.created_by_id === ctx.owner_id;

    if (!isTaskAssignee && !isDeliverableSubmitter && !isTaskCreator) {
      // Return 404 to avoid leaking existence
      throw new NotFoundError('Deliverable not found');
    }
  }

  res.json({ deliverable });
}));

// GET /api/deliverables/:id/versions - Get deliverable version history
router.get('/:id/versions', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const id = getParamId(req.params, 'id');

  if (!id) {
    throw new NotFoundError('Deliverable ID required');
  }

  const history = getDeliverableHistory(db, ctx, id);

  res.json({ versions: history });
}));

// POST /api/deliverables - Create deliverable draft
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const input = CreateDeliverableSchema.parse(req.body);

  const result = createDeliverableDraft(db, ctx, input);

  res.status(201).json({ deliverable: result });
}));

// PUT /api/deliverables/:id/submit - Submit deliverable for review
router.put('/:id/submit', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const id = getParamId(req.params, 'id');
  const input = SubmitDeliverableSchema.parse(req.body);

  if (!id) {
    throw new NotFoundError('Deliverable ID required');
  }

  const result = submitDeliverable(db, ctx, { deliverable_id: id, quality_score: input.quality_score });

  res.json({ deliverable: result });
}));

// PUT /api/deliverables/:id/review - Review deliverable (accept/reject/revision)
router.put('/:id/review', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const id = getParamId(req.params, 'id');
  const input = ReviewDeliverableSchema.parse(req.body);

  if (!id) {
    throw new NotFoundError('Deliverable ID required');
  }

  if (input.status === 'accepted') {
    const result = approveDeliverable(db, ctx, {
      deliverable_id: id,
      quality_score: input.quality_score,
      // Note: founder_signature would come from request body for Level 3
    });
    res.json({ deliverable: result });
  } else if (input.status === 'rejected') {
    rejectDeliverable(db, ctx, {
      deliverable_id: id,
      rejection_reason: input.revision_notes || 'No reason provided',
    });
    res.json({ success: true, status: 'rejected' });
  } else if (input.status === 'revision_requested') {
    const result = requestRevision(db, ctx, {
      deliverable_id: id,
      revision_notes: input.revision_notes || 'Revision requested',
    });
    res.json({ deliverable: result });
  } else {
    throw new ValidationError('Invalid review status', { status: input.status });
  }
}));

// PUT /api/deliverables/:id/revision - Request revision (alias for review with revision_requested)
router.put('/:id/revision', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const id = getParamId(req.params, 'id');
  const input = RequestRevisionSchema.parse(req.body);

  if (!id) {
    throw new NotFoundError('Deliverable ID required');
  }

  const result = requestRevision(db, ctx, {
    deliverable_id: id,
    revision_notes: input.revision_notes,
  });

  res.json({ deliverable: result });
}));

// PUT /api/deliverables/:id/assign-reviewer - Assign reviewer to deliverable
router.put('/:id/assign-reviewer', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const id = getParamId(req.params, 'id');
  const input = AssignReviewerSchema.parse(req.body);

  if (!id) {
    throw new NotFoundError('Deliverable ID required');
  }

  const result = assignReviewer(db, ctx, {
    deliverable_id: id,
    reviewer_type: input.reviewer_type,
    reviewer_id: input.reviewer_id,
  });

  res.json({ deliverable: result });
}));

export default router;