// Meetings Routes
// Implements: GET /api/meetings, GET /api/meetings/:id, GET /api/meetings/:id/phases

import { Router, Request, Response } from 'express';
import { listMeetings, getMeetingById, getMeetingPhases } from '../../council/meetings.js';
import { getDatabase } from '../../database.js';
import { authMiddleware, getAuthContext, requireAuth } from '../middleware/authentication.js';
import { asyncHandler, NotFoundError } from '../middleware/error-handler.js';
import { ListMeetingsSchema } from '../schemas/index.js';

const router = Router();
import { databaseInstance as db } from '../../database.js';

// Apply auth middleware to all routes
router.use(authMiddleware);

function getParamId(params: any, key: string): string {
  const val = params[key];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/meetings - List meetings
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  requireAuth(req);
  const { limit, offset, status } = ListMeetingsSchema.parse(req.query);

  const meetings = listMeetings(db);

  res.json({ meetings, limit, offset });
}));

// GET /api/meetings/:id - Get meeting details
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  requireAuth(req);
  const id = getParamId(req.params, 'id');

  if (!id) {
    throw new NotFoundError('Meeting ID required');
  }

  const meeting = getMeetingById(db, id);

  if (!meeting) {
    throw new NotFoundError('Meeting not found');
  }

  res.json({ meeting });
}));

// GET /api/meetings/:id/phases - Get meeting phases
router.get('/:id/phases', asyncHandler(async (req: Request, res: Response) => {
  requireAuth(req);
  const id = getParamId(req.params, 'id');

  if (!id) {
    throw new NotFoundError('Meeting ID required');
  }

  const phases = getMeetingPhases(db, id);

  if (!phases) {
    throw new NotFoundError('Meeting not found');
  }

  res.json({ phases });
}));

export default router;