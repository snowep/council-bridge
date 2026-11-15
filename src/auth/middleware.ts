// Auth Middleware - Phase 8 Hardened
// Phase 10: Local single-user Founder mode with loopback restriction

import { Request, Response, NextFunction } from 'express';
import { validateSessionToken } from './session.js';
import { getAuthConfig, AuthContext, isLocalSingleUserMode, isProductionMode, isDevelopmentMode, getLocalBindAddress } from './index.js';

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

// Auth middleware - Production: require valid session; Development: optional with fallback
// Local single-user mode: auto-authenticate Founder for loopback connections only
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const clientIp = getClientIp(req);
  const config = getAuthConfig();
  const PRODUCTION_MODE = isProductionMode();
  const LOCAL_MODE = isLocalSingleUserMode();

  // Check if request is from loopback
  const isLocal = isLoopbackAddress(clientIp);

  // LOCAL SINGLE-USER MODE
  if (LOCAL_MODE) {
    // Reject non-loopback requests in local mode
    if (!isLocal) {
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
        };
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
    };
    (req as any).authContext = authContext;
    (req as any).auth = authContext;
    return next();
  }

  // NORMAL MODE (development or production)
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