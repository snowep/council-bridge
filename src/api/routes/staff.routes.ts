// Staff Routes
// Implements: GET /api/staff, GET /api/staff/:id, POST /api/staff, GET /api/staff/divisions/members

import { Router, Request, Response } from 'express';
import { listStaffAgents, getStaffAgentById, getDivisionMembers, getAllDivisionMembers, registerStaffAgent } from '../../council/divisions.js';
import { authMiddleware, requireAuth, getAuthContext } from '../middleware/authentication.js';
import { asyncHandler, NotFoundError, ValidationError, AuthorizationError } from '../middleware/error-handler.js';
import { ListStaffSchema, RegisterStaffSchema } from '../schemas/index.js';

const router = Router();
import { databaseInstance as db } from '../../database.js';

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/staff - List all staff agents
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const { limit, offset, division_id, status } = ListStaffSchema.parse(req.query);

  // Authorization: Founder sees all, Division Head sees division staff, Staff sees self
  let effectiveDivisionId = division_id as string | undefined;

  if (ctx.owner_type === 'division') {
    effectiveDivisionId = ctx.owner_id;
  } else if (ctx.owner_type === 'staff') {
    effectiveDivisionId = undefined; // Will filter to self in service
  }

  const staff = listStaffAgents(db, {
    division_id: effectiveDivisionId,
    status: status as any,
  });

  // For staff, filter to only themselves
  if (ctx.owner_type === 'staff') {
    const filtered = staff.filter(s => s.staff_id === ctx.owner_id);
    res.json({ staff: filtered, limit, offset });
    return;
  }

  res.json({ staff, limit, offset });
}));

function getParamId(params: any, key: string): string {
  const val = params[key];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/staff/:id - Get staff agent details
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  requireAuth(req);
  const id = getParamId(req.params, 'id');

  if (!id) {
    throw new NotFoundError('Staff ID required');
  }

  const staff = getStaffAgentById(db, id);

  if (!staff) {
    throw new NotFoundError('Staff agent not found');
  }

  res.json({ staff });
}));

// POST /api/staff - Invite/register staff agent (Founder only)
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);

  // Founder authorization required
  if (ctx.owner_type !== 'founder') {
    throw new AuthorizationError('Only Founder can invite staff agents');
  }

  const input = RegisterStaffSchema.parse(req.body);

  const staff = registerStaffAgent(db, {
    staff_id: db.generateId(),
    name: input.name,
    role: input.role,
    division_id: input.division_id,
    runtime_instances: input.runtime_instances ?? [],
    permissions: input.permissions ?? [],
    status: input.status ?? 'pending',
  });

  res.status(201).json({ staff });
}));

// GET /api/staff/divisions/members - List division members
router.get('/divisions/members', asyncHandler(async (req: Request, res: Response) => {
  requireAuth(req);

  const divisionId = req.query.division_id as string | undefined;
  const members = divisionId
    ? getDivisionMembers(db, divisionId)
    : getAllDivisionMembers(db);

  res.json({ members });
}));

export default router;