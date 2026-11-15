// Council Routes
// Implements: GET /api/council/seats, GET /api/council/personas, GET /api/council/meetings

import { Router, Request, Response } from 'express';
import { getDatabase } from '../../database.js';
import { listMemoryEntries } from '../../council/memory.js';
import { listMeetings } from '../../council/meetings.js';
import { getActiveConstitution, getStaffRuntimePersonas } from '../../council/divisions.js';
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
    SELECT cs.*, cs.name as seat_name, cs.description as seat_description,
           NULL as occupant_name, NULL as occupant_runtime
    FROM council_seats cs
    WHERE cs.status != 'vacant'
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

  res.json({ data: personas });
}));

// GET /api/council/meetings - Alias for meetings list
router.get('/meetings', asyncHandler(async (req: Request, res: Response) => {
  requireAuth(req);
  const { limit, offset, status } = ListMeetingsSchema.parse(req.query);

  const meetings = listMeetings(db);

  res.json({ meetings, limit, offset });
}));

// GET /api/council/constitution - Get active constitution
router.get('/constitution', asyncHandler(async (req: Request, res: Response) => {
  requireAuth(req);

  const constitution = getActiveConstitution(db);

  if (!constitution) {
    return res.status(404).json({ error: 'No active constitution found', code: 'NOT_FOUND' });
  }

  res.json({ data: constitution });
}));

// GET /api/council/runtime-assignments - Get runtime persona assignments
router.get('/runtime-assignments', asyncHandler(async (req: Request, res: Response) => {
  requireAuth(req);

  const [claudeAssignments, hermesAssignments] = await Promise.all([
    getStaffRuntimePersonas(db, 'claude'),
    getStaffRuntimePersonas(db, 'hermes'),
  ]);

  const assignments = [
    ...claudeAssignments.map(a => ({ runtime: 'claude', persona_id: a.staff_id })),
    ...hermesAssignments.map(a => ({ runtime: 'hermes', persona_id: a.staff_id })),
  ];

  res.json({ data: assignments });
}));

export default router;