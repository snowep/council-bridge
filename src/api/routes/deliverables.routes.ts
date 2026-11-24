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
import { assertTaskAccess } from '../../council/operations.js';
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

// Helper: Verify user has access to a task associated with a deliverable
function verifyDeliverableAccess(ctx: any, deliverable: any): boolean {
  // Founder can access all
  if (ctx.owner_type === 'founder') return true;

  // Get the associated task
  const task = db.query('SELECT * FROM tasks WHERE task_id = ?', [deliverable.task_id])[0] as any;
  if (!task) return false;

  // Check if user is the designated reviewer for this deliverable
  // Reviewers can be: founder, council, or division_head
  if (deliverable.reviewer_type && deliverable.reviewer_id) {
    const isReviewer =
      (deliverable.reviewer_type === 'founder' && ctx.owner_type === 'founder' && ctx.owner_id === 'founder') ||
      (deliverable.reviewer_type === 'council' && ctx.owner_type === 'seat' && deliverable.reviewer_id === ctx.owner_id) ||
      (deliverable.reviewer_type === 'division_head') && ctx.owner_type === 'staff' && deliverable.reviewer_id === ctx.owner_id;
    if (isReviewer) return true;
  }

  // Use canonical task access policy
  try {
    assertTaskAccess(db, ctx, task.task_id);
    return true;
  } catch (error) {
    return false;
  }
}

// GET /api/deliverables - List deliverables with filters
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);

  const {
    limit,
    offset,
    task_id,
    status,
    submitted_by_type,
    submitted_by_id,
  } = ListDeliverablesSchema.parse(req.query);

  if (task_id) {
    try {
      assertTaskAccess(db, ctx, task_id);
    } catch (error) {
      if (
        error instanceof Error &&
        (
          error.message === 'Authorization denied' ||
          error.message.includes('not found')
        )
      ) {
        throw new NotFoundError('Task not found');
      }

      throw error;
    }
  }

  const candidates = task_id
    ? listDeliverablesByTask(db, task_id)
    : db.query(
        'SELECT * FROM deliverables ORDER BY created_at DESC'
      );

  const filtered = candidates.filter((deliverable: any) => {
    if (task_id && deliverable.task_id !== task_id) {
      return false;
    }

    if (!verifyDeliverableAccess(ctx, deliverable)) {
      return false;
    }

    if (status && deliverable.status !== status) {
      return false;
    }

    // Request filters can narrow, never widen, access.
    if (
      submitted_by_type &&
      deliverable.submitted_by_type !== submitted_by_type
    ) {
      return false;
    }

    if (
      submitted_by_id &&
      deliverable.submitted_by_id !== submitted_by_id
    ) {
      return false;
    }

    return true;
  });

  const paginated = filtered.slice(offset, offset + limit);

  res.json({
    deliverables: paginated,
    limit,
    offset,
  });
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
  // Reuse canonical task-access rules and preserve division membership
  if (!verifyDeliverableAccess(ctx, deliverable)) {
    // Return 404 to avoid leaking existence
    throw new NotFoundError('Deliverable not found');
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

  // Verify access before returning version history
  const deliverable = getDeliverableById(db, id);
  if (!deliverable) {
    throw new NotFoundError('Deliverable not found');
  }

  // Verify task access first
  if (!verifyDeliverableAccess(ctx, deliverable)) {
    throw new NotFoundError('Deliverable not found');
  }

  const history = getDeliverableHistory(db, { owner_type: ctx.owner_type, owner_id: ctx.owner_id, runtime: ctx.runtime }, id);

  res.json({ versions: history });
}));

// POST /api/deliverables - Create deliverable draft
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const input = CreateDeliverableSchema.parse(req.body);

  const result = createDeliverableDraft(db, { owner_type: ctx.owner_type, owner_id: ctx.owner_id, runtime: ctx.runtime }, input);

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

  const result = submitDeliverable(db, { owner_type: ctx.owner_type, owner_id: ctx.owner_id, runtime: ctx.runtime }, { deliverable_id: id, quality_score: input.quality_score });

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
    const result = approveDeliverable(db, { owner_type: ctx.owner_type, owner_id: ctx.owner_id, runtime: ctx.runtime }, {
      deliverable_id: id,
      quality_score: input.quality_score,
      founder_signature: input.founder_signature,
    });
    res.json({ deliverable: result });
  } else if (input.status === 'rejected') {
    rejectDeliverable(db, { owner_type: ctx.owner_type, owner_id: ctx.owner_id, runtime: ctx.runtime }, {
      deliverable_id: id,
      rejection_reason: input.revision_notes || 'No reason provided',
    });
    res.json({ success: true, status: 'rejected' });
  } else if (input.status === 'revision_requested') {
    const result = requestRevision(db, { owner_type: ctx.owner_type, owner_id: ctx.owner_id, runtime: ctx.runtime }, {
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

  const result = requestRevision(db, { owner_type: ctx.owner_type, owner_id: ctx.owner_id, runtime: ctx.runtime }, {
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

  const result = assignReviewer(db, { owner_type: ctx.owner_type, owner_id: ctx.owner_id, runtime: ctx.runtime }, {
    deliverable_id: id,
    reviewer_type: input.reviewer_type,
    reviewer_id: input.reviewer_id,
  });

  res.json({ deliverable: result });
}));

export default router;