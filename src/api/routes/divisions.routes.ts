// Divisions Routes
// Implements: GET /api/divisions, GET /api/divisions/:id, POST /api/divisions

import { Router, Request, Response } from 'express';
import { listDivisions, getDivisionById, createDivision } from '../../council/divisions.js';
import { authMiddleware, requireAuth, getAuthContext } from '../middleware/authentication.js';
import { asyncHandler, NotFoundError, ValidationError, AuthorizationError } from '../middleware/error-handler.js';
import { CreateDivisionSchema } from '../schemas/index.js';

const router = Router();
import { databaseInstance as db } from '../../database.js';

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/divisions - List all divisions
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  requireAuth(req);

  const divisions = listDivisions(db);

  res.json({ divisions });
}));

function getParamId(params: any, key: string): string {
  const val = params[key];
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/divisions/:id - Get division details
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  requireAuth(req);
  const id = getParamId(req.params, 'id');

  if (!id) {
    throw new NotFoundError('Division ID required');
  }

  const division = getDivisionById(db, id);

  if (!division) {
    throw new NotFoundError('Division not found');
  }

  res.json({ division });
}));

// POST /api/divisions - Create division (Founder only)
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);

  // Founder authorization required
  if (ctx.owner_type !== 'founder') {
    throw new AuthorizationError('Only Founder can create divisions');
  }

  const input = CreateDivisionSchema.parse(req.body);

  const division = createDivision(db, {
    division_id: db.generateId(),
    name: input.name,
    description: input.description,
    head_staff_id: input.head_staff_id,
    budget_limit: input.budget_limit,
    permissions: input.permissions,
    strategic_objectives: input.strategic_objectives,
  });

  res.status(201).json({ division });
}));

export default router;