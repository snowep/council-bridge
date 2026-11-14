// Council Routes
// Implements: GET /api/council/seats, GET /api/council/personas, GET /api/council/meetings

import { Router, Request, Response } from 'express';
import { getDatabase } from '../../database.js';
import { listMemoryEntries } from '../../council/memory.js';
import { listMeetings } from '../../council/meetings.js';
import { authMiddleware, getAuthContext, requireAuth } from '../middleware/authentication.js';
import { asyncHandler, NotFoundError } from '../middleware/error-handler.js';
import { ListMeetingsSchema } from '../schemas/index.js';

const router = Router();
import { databaseInstance as db } from '../../database.js';

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/council/seats - List council seats
router.get('/seats', asyncHandler(async (req: Request, res: Response) => {
  requireAuth(req);

  const stmt = db.db.prepare(`
    SELECT cs.*, s.name as seat_name, s.description as seat_description,
           u.name as occupant_name, u.runtime as occupant_runtime
    FROM council_seats cs
    LEFT JOIN seats s ON cs.seat_id = s.id
    LEFT JOIN users u ON cs.occupant_id = u.id
    WHERE cs.is_active = 1
    ORDER BY cs.seat_id
  `);

  const seats = stmt.all();

  res.json({ seats });
}));

// GET /api/council/personas - List personas (memory entries with individual_persona category)
router.get('/personas', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);

  // Founder can see all, others see only their own
  const ownerType = ctx.owner_type === 'founder' ? undefined : ctx.owner_type;
  const ownerId = ctx.owner_type === 'founder' ? undefined : ctx.owner_id;

  const personas = listMemoryEntries(db, ctx, {
    owner_type: ownerType,
    owner_id: ownerId,
    category: 'individual_persona',
    limit: 100,
    offset: 0,
  });

  res.json({ personas });
}));

// GET /api/council/meetings - Alias for meetings list
router.get('/meetings', asyncHandler(async (req: Request, res: Response) => {
  requireAuth(req);
  const { limit, offset, status } = ListMeetingsSchema.parse(req.query);

  const meetings = listMeetings(db);

  res.json({ meetings, limit, offset });
}));

export default router;