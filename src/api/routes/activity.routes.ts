// Activity Routes
// Implements: GET /api/activity - Returns aggregated activity from memory, tasks, messages

import { Router, Request, Response } from 'express';
import { authMiddleware, requireAuth } from '../middleware/authentication.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { ListActivitySchema } from '../schemas/index.js';
import { listActivity } from '../../council/memory.js';
import { databaseInstance as db } from '../../database.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/activity - List activity items
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const { limit = 50, offset = 0 } = ListActivitySchema.parse(req.query);

  const activity = listActivity(db, ctx, { limit, offset });

  res.json({ activity, limit, offset });
}));

export default router;