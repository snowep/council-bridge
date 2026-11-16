// Re-exports from canonical authentication middleware
export {
  authMiddleware,
  getAuthContext,
  requireAuth,
  requireFounder,
  requireStaff,
  requireDivision,
  requireDivisionHead,
  validateLocalSingleUserConfig,
} from '../api/middleware/authentication.js';
