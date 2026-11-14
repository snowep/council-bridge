// Quality Thresholds Routes
// Implements: GET /api/quality-thresholds

import { Router, Request, Response } from 'express';
import { setQualityThreshold, getQualityThresholdConfig } from '../../council/task-delegation.js';
import { getDatabase } from '../../database.js';
import { authMiddleware, getAuthContext, requireAuth, requireFounder } from '../middleware/authentication.js';
import { asyncHandler, ValidationError } from '../middleware/error-handler.js';
import { QualityThresholdSchema } from '../schemas/index.js';

const router = Router();
import { databaseInstance as db } from '../../database.js';

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/quality-thresholds - Get quality thresholds (Founder only for config)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const { division_id, task_type } = req.query;

  // Only Founder can view quality threshold configuration
  if (ctx.owner_type !== 'founder') {
    // For non-founder, return the effective threshold for their context
    // This would require a task to be specified, so we return 403
    return res.status(403).json({
      error: 'Only Founder can view quality threshold configuration',
      code: 'FORBIDDEN'
    });
  }

  const config = getQualityThresholdConfig(db, ctx, division_id as string, task_type as string);

  res.json({ thresholds: config });
}));

// POST /api/quality-thresholds - Set quality threshold (Founder only)
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireFounder(req);
  const input = QualityThresholdSchema.parse(req.body);

  setQualityThreshold(db, ctx, input);

  res.status(201).json({ success: true });
}));

export default router;