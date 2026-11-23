// Memory Routes
// Implements: GET /api/memory, GET /api/memory/:id

import { Router, Request, Response } from 'express';
import { listMemoryEntries, getMemoryById } from '../../council/memory.js';
import { authMiddleware, requireAuth } from '../middleware/authentication.js';
import { asyncHandler, NotFoundError } from '../middleware/error-handler.js';
import { ListMemorySchema } from '../schemas/index.js';

const router = Router();
import { databaseInstance as db } from '../../database.js';

// Apply auth middleware to all routes
router.use(authMiddleware);

function getParamId(params: any, key: string): string {
  const val = params[key];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/memory - List memory entries with filters
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const { limit, offset, owner_type, owner_id, category, archived, search } = ListMemorySchema.parse(req.query);

  const entries = listMemoryEntries(db, ctx, {
    owner_type: owner_type as any,
    owner_id: owner_id as any,
    category: category as any,
    archived: archived as any,
    search: search as any,
    limit,
    offset,
  });

  res.json({ entries, limit, offset });
}));

// GET /api/memory/:id - Get memory entry details
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const id = getParamId(req.params, 'id');

  if (!id) {
    throw new NotFoundError('Memory ID required');
  }

  const entry = getMemoryById(db, id);

  if (!entry) {
    throw new NotFoundError('Memory entry not found');
  }

  // Authorization check: verify user can access this memory
  const { checkMemoryAccess } = await import('../../council/operations.js');
  if (!checkMemoryAccess(ctx, entry, db)) {
    // Return 404 to avoid leaking existence of private memories
    throw new NotFoundError('Memory entry not found');
  }

  res.json({ entry });
}));

export default router;