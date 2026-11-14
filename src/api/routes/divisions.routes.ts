// Divisions Routes
// Implements: GET /api/divisions, GET /api/organization/divisions

import { Router, Request, Response } from 'express';
import { listDivisions, getDivisionById } from '../../council/divisions.js';
import { getDatabase } from '../../database.js';
import { authMiddleware, getAuthContext, requireAuth } from '../middleware/authentication.js';
import { asyncHandler, NotFoundError } from '../middleware/error-handler.js';

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

// GET /api/organization/divisions - Alias for divisions
router.get('/organization/divisions', asyncHandler(async (req: Request, res: Response) => {
  requireAuth(req);

  const divisions = listDivisions(db);

  res.json({ divisions });
}));

export default router;