// Authentication Middleware
// Extracted from server.ts for modularization
// Phase 10: Local single-user Founder mode with loopback restriction

import { Request, Response, NextFunction } from 'express';
import { validateSessionToken } from '../../auth/session.js';
import { getAuthConfig, isProductionMode, isDevelopmentMode, isLocalSingleUserMode as isLocalSingleUserModeFn, getLocalBindAddress as getLocalBindAddressFn, AuthContext } from '../../auth/index.js';

const config = getAuthConfig();
const PRODUCTION_MODE = isProductionMode();
const DEVELOPMENT_MODE = isDevelopmentMode();
const LOCAL_MODE = isLocalSingleUserModeFn();

function isLoopbackAddress(ip: string | undefined): boolean {
  if (!ip) return false;
  // IPv4 loopback
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
  // IPv4 loopback range
  if (ip.startsWith('127.')) return true;
  // IPv6 loopback
  if (ip === 'localhost') return true;
  return false;
}

function getClientIp(req: Request): string {
  // Check socket remote address directly - don't trust X-Forwarded-For
  const socketIp = req.socket?.remoteAddress;
  return socketIp || 'unknown';
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): Response | void {
  const authHeader = req.headers.authorization;
  const clientIp = getClientIp(req);

  // LOCAL SINGLE-USER MODE
  if (LOCAL_MODE) {
    // Reject non-loopback requests in local mode
    if (!isLoopbackAddress(clientIp)) {
      return res.status(403).json({
        error: 'Local single-user mode only accepts loopback connections',
        code: 'LOCAL_MODE_REMOTE_DENIED',
        client_ip: clientIp
      });
    }

    // If token provided, validate it
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
        } as AuthContext;
        (req as any).authContext = authContext;
        (req as any).auth = authContext;
        return next();
      }

      // Invalid/expired token in local mode - fall through to auto-auth
    }

    // Auto-authenticate as Founder for loopback requests
    const authContext = {
      owner_type: 'founder' as const,
      owner_id: 'founder',
      runtime: 'claude' as const,
      session_id: 'local-founder',
      permissions: [],
      expires_at: Infinity,
      issued_at: Date.now(),
      founder_signed: true,
      client_ip: clientIp
    } as AuthContext;
    (req as any).authContext = authContext;
    (req as any).auth = authContext;
    return next();
  }

  // NORMAL MODE (development or production)
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
    if (PRODUCTION_MODE) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHENTICATED'
      });
    }
    // Development: allow for backward compatibility
    return next();
  }

  const token = authHeader.substring(7);
  const session = validateSessionToken(token, undefined, clientIp);

  if (!session) {
    return res.status(401).json({
      error: 'Invalid or expired session token',
      code: 'INVALID_SESSION'
    });
  }

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
  } as AuthContext;
  (req as any).authContext = authContext;
  (req as any).auth = authContext;
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

// Validate local single-user mode configuration
export function validateLocalSingleUserConfig(): { valid: boolean; errors: string[] } {
  const config = getAuthConfig();
  const errors: string[] = [];

  if (config.local_single_user_mode) {
    const bindAddr = config.local_single_user_bind_address;
    if (bindAddr !== '127.0.0.1' && bindAddr !== '::1' && bindAddr !== 'localhost') {
      errors.push(`Local single-user mode requires loopback bind address (127.0.0.1 or ::1), got: ${bindAddr}`);
    }
    if (config.mode === 'production') {
      errors.push('Local single-user mode cannot be enabled in production mode');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function isLocalSingleUserModeEnabled(): boolean {
  return isLocalSingleUserModeFn();
}

export function getLocalSingleUserBindAddress(): string {
  return getLocalBindAddressFn();
}

// Aliases for server.ts imports
export const isLocalSingleUserMode = isLocalSingleUserModeEnabled;
export const getLocalBindAddress = getLocalSingleUserBindAddress;