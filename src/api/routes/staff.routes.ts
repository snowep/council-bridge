// Staff Routes
// Implements: GET /api/staff, GET /api/staff/:id, POST /api/staff, GET /api/staff/divisions/members

import { Router, Request, Response } from 'express';
import { listStaffAgents, getStaffAgentById, getDivisionMembers, getAllDivisionMembers, registerStaffAgent } from '../../council/divisions.js';
import { authMiddleware, requireAuth } from '../middleware/authentication.js';
import { asyncHandler, NotFoundError, AuthorizationError, ValidationError } from '../middleware/error-handler.js';
import { ListStaffSchema, RegisterStaffSchema } from '../schemas/index.js';

const router = Router();
import { databaseInstance as db } from '../../database.js';

// Apply auth middleware to all routes
router.use(authMiddleware);

function getParamId(params: any, key: string): string {
  const val = params[key];
  return Array.isArray(val) ? val[0] : val;
}

// Helper: Verify user can access a staff record
function canAccessStaffRecord(ctx: any, staffId: string): boolean {
  // Founder can access all records
  if (ctx.owner_type === 'founder') return true;

  // Division Head can access members of their division
  if (ctx.owner_type === 'division') {
    const members = getDivisionMembers(db, ctx.owner_id);
    return members.some(m => m.staff_id === staffId);
  }

  // Staff can only access their own record
  if (ctx.owner_type === 'staff') {
    return ctx.owner_id === staffId;
  }

  return false;
}

// GET /api/staff - List all staff agents
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const { limit, offset, division_id, status } = ListStaffSchema.parse(req.query);

  let effectiveDivisionId = division_id as string | undefined;

  if (ctx.owner_type === 'division') {
    // Division Head can only see their own division's staff
    effectiveDivisionId = ctx.owner_id;
  } else if (ctx.owner_type === 'founder') {
    // Founder can see all staff (division_id filter if provided)
    effectiveDivisionId = undefined;
  } else if (ctx.owner_type === 'staff') {
    // Staff with division membership can see their division's staff
    const divisions = db.query('SELECT division_id FROM division_members WHERE staff_id = ?', [ctx.owner_id]);
    if (divisions.length > 0) {
      effectiveDivisionId = divisions[0].division_id;
    } else {
      effectiveDivisionId = undefined; // Will be filtered to empty result
    }
  }

  const staff = listStaffAgents(db, {
    division_id: effectiveDivisionId,
    status: status as any,
  });

  // For staff, filter to only see records from their own division
  if (ctx.owner_type === 'staff') {
    const myDivisions = db.query('SELECT division_id FROM division_members WHERE staff_id = ?', [ctx.owner_id]);
    const myDivisionIds = myDivisions.map((d: any) => d.division_id);
    const filtered = staff.filter(s => myDivisionIds.includes(s.division_id));
    res.json({ staff: filtered, limit, offset });
    return;
  }

  res.json({ staff, limit, offset });
}));

// GET /api/staff/:id - Get staff agent details
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const id = getParamId(req.params, 'id');

  if (!id) {
    throw new NotFoundError('Staff ID required');
  }

  // Fetch actual staff record first
  const staff = getStaffAgentById(db, id);
  if (!staff) {
    throw new NotFoundError('Staff agent not found');
  }

  // Authorization check: verify user can access this staff agent
  if (ctx.owner_type !== 'founder') {
    if (!canAccessStaffRecord(ctx, id)) {
      throw new NotFoundError('Staff agent not found');
    }
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
  const ctx = requireAuth(req);

  // Only Founder or Division Head can access this endpoint
  if (ctx.owner_type !== 'founder' && ctx.owner_type !== 'division') {
    throw new AuthorizationError('Only Founder or Division Head can view division members');
  }

  const divisionId = req.query.division_id as string | undefined;

  let members: any[];
  if (divisionId) {
    // Verify authorization for requested division
    if (ctx.owner_type === 'division' && divisionId !== ctx.owner_id) {
      throw new AuthorizationError('Cannot access members of other divisions');
    }
    members = getDivisionMembers(db, divisionId);
  } else {
    // Founder can see all, Division Head can only see their own division
    if (ctx.owner_type === 'division') {
      members = getDivisionMembers(db, ctx.owner_id);
    } else {
      members = getAllDivisionMembers(db);
    }
  }

  res.json({ members });
}));

export default router;