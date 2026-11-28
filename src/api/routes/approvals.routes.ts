// Approvals Routes
// Fixes 500 error on /api/approvals by allowing non-Founder users to see their own requests
// Implements: GET /api/approvals

import { Router, Request, Response } from 'express';
import { listApprovalRequests } from '../../council/operations.js';
import { getDatabase } from '../../database.js';
import { authMiddleware, getAuthContext, requireAuth } from '../middleware/authentication.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { ListApprovalsSchema } from '../schemas/index.js';

const router = Router();
import { databaseInstance as db } from '../../database.js';

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/approvals - List approval requests (fixed: allows non-Founder to see own)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireAuth(req);
  const { limit, offset, status, requested_by_type, requested_by_id } = ListApprovalsSchema.parse(req.query);

  // Authorization: Founder sees all, others see only their own requests
  const effectiveRequestedByType = ctx.owner_type === 'founder' ? (requested_by_type as any) : ctx.owner_type;
  const effectiveRequestedById = ctx.owner_type === 'founder' ? (requested_by_id as string | undefined) : ctx.owner_id;

  const approvals = listApprovalRequests(db, ctx, {
    limit,
    offset,
    status: status as any,
    requested_by_type: effectiveRequestedByType,
    requested_by_id: effectiveRequestedById,
  });

  // Calculate total count by querying without limit/offset
  // Use effective authorization filters to scope the count correctly for non-Founders
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (status) {
    whereClauses.push('status = ?');
    params.push(status);
  }
  if (effectiveRequestedByType) {
    whereClauses.push('requested_by_type = ?');
    params.push(effectiveRequestedByType);
  }
  if (effectiveRequestedById) {
    whereClauses.push('requested_by_id = ?');
    params.push(effectiveRequestedById);
  }

  const where = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
  const totalCount = db.query(
    `SELECT COUNT(*) as cnt FROM approval_requests ${where}`,
    params
  )[0].cnt;

  // Set X-Total-Count header for pagination
  res.set('X-Total-Count', String(totalCount));

  res.json({
    approvals,
    total_count: totalCount,
    limit,
    offset
  });
}));

export default router;
