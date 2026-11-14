// Auth Middleware - Phase 8 Hardened
// Exported for testing and reuse

import { Request, Response, NextFunction } from 'express';
import { validateSessionToken } from './session.js';
import { getAuthConfig, AuthContext } from './index.js';

// Auth middleware - Production: require valid session; Development: optional with fallback
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const clientIp = req.ip || req.socket.remoteAddress;
  const config = getAuthConfig();
  const PRODUCTION_MODE = config.mode === 'production';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = validateSessionToken(token, undefined, clientIp);

    if (session) {
      const authContext = {
        owner_type: session.owner_type,
        owner_id: session.owner_id,
        runtime: session.runtime,
        session_id: session.session_id,
        permissions: session.permissions,
        expires_at: session.expires_at,
        issued_at: session.issued_at,
        founder_signed: session.owner_type === 'founder',
        client_ip: clientIp
      };
      (req as any).authContext = authContext;
      // Also set req.auth for MCP SDK compatibility
      (req as any).auth = authContext;
      return next();
    }

    // Invalid/expired token
    return res.status(401).json({
      error: 'Invalid or expired session token',
      code: 'AUTH_INVALID_TOKEN'
    });
  }

  // No token provided
  if (PRODUCTION_MODE) {
    // Production: fail closed - no fallback to hardcoded identities
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
      message: 'Provide Authorization: Bearer <session_token> header'
    });
  }

  // Development: allow fallback to hardcoded context for backward compatibility
  next();
}

// Get auth context from request
export function getAuthContext(req: Request): AuthContext | null {
  return (req as any).authContext || null;
}