// Authentication Middleware
// Extracted from server.ts for modularization

import { Request, Response, NextFunction } from 'express';
import { validateSessionToken } from '../../auth/session.js';
import { getAuthConfig, isProductionMode, AuthContext } from '../../auth/index.js';

const config = getAuthConfig();
const PRODUCTION_MODE = isProductionMode();

export function authMiddleware(req: Request, res: Response, next: NextFunction): Response | void {
  const authHeader = req.headers.authorization;

  // In development with hardcoded fallback enabled, allow requests without auth
  if (!PRODUCTION_MODE && config.allow_hardcoded_fallback && !authHeader) {
    // Development fallback - use a default context for testing
    (req as any).authContext = {
      owner_type: 'founder',
      owner_id: 'founder',
      runtime: 'claude',
      session_id: 'dev-fallback',
      permissions: ['*'],
      expires_at: Infinity,
      issued_at: Date.now(),
      founder_signed: false
    } as AuthContext;
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'UNAUTHENTICATED'
    });
  }

  const token = authHeader.substring(7);
  const session = validateSessionToken(token);

  if (!session) {
    return res.status(401).json({
      error: 'Invalid or expired session token',
      code: 'INVALID_SESSION'
    });
  }

  (req as any).authContext = session;
  next();
}

export function getAuthContext(req: Request): AuthContext | null {
  return (req as any).authContext ?? null;
}

export function requireAuth(req: Request): AuthContext {
  const ctx = getAuthContext(req);
  if (!ctx) {
    throw new Error('Authentication required');
  }
  return ctx;
}

export function requireFounder(req: Request): AuthContext {
  const ctx = requireAuth(req);
  if (ctx.owner_type !== 'founder' || ctx.owner_id !== 'founder') {
    throw new Error('Founder authorization required');
  }
  return ctx;
}

export function requireStaff(req: Request): AuthContext {
  const ctx = requireAuth(req);
  if (ctx.owner_type !== 'staff') {
    throw new Error('Staff authorization required');
  }
  return ctx;
}

export function requireDivision(req: Request): AuthContext {
  const ctx = requireAuth(req);
  if (ctx.owner_type !== 'division') {
    throw new Error('Division authorization required');
  }
  return ctx;
}

export function requireDivisionHead(req: Request, divisionId: string): AuthContext {
  const ctx = requireAuth(req);
  if (ctx.owner_type === 'founder') return ctx;
  if (ctx.owner_type === 'division' && ctx.owner_id === divisionId) return ctx;
  if (ctx.owner_type === 'staff') {
    // Will be validated against database in route handlers
    return ctx;
  }
  throw new Error('Division Head authorization required');
}