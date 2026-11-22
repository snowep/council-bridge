// Authentication Middleware
// Extracted from server.ts for modularization
// Phase 10: Local single-user Founder mode with loopback restriction

import { Request, Response, NextFunction } from 'express';
import { validateSessionToken, getAuthConfig, getLocalBindAddress as getLocalBindAddressFn, AuthContext } from '../../auth/index.js';
import { randomUUID } from 'node:crypto';

// These must be functions, not cached values, because tests change process.env.AUTH_MODE at runtime
function getConfig() { return getAuthConfig(); }
function isProd() { return getConfig().mode === 'production'; }
function isLocal() { return getConfig().local_single_user_mode; }

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

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
  const authHeader = req.headers.authorization;
  const clientIp = getClientIp(req);
  const config = getConfig();

  // REJECT INVALID ENVIRONMENT COMBINATIONS
  // Local single-user mode cannot be enabled in production mode
  if (config.local_single_user_mode && config.mode === 'production') {
    return res.status(401).json({
      error: 'Local single-user mode cannot be enabled in production mode',
      code: 'LOCAL_MODE_PROHIBITED_IN_PRODUCTION'
    });
  }

  // LOCAL SINGLE-USER MODE (only valid in non-production)
  if (isLocal()) {
    // Reject non-loopback requests in local mode
    if (!isLoopbackAddress(clientIp)) {
      return res.status(403).json({
        error: 'Local single-user mode only accepts loopback connections',
        code: 'LOCAL_MODE_REMOTE_DENIED',
        client_ip: clientIp
      });
    }

    // If token provided, it MUST be validated - no fallback to local auth on invalid tokens
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      if (token) {
        // Import runtime credentials validation using ESM dynamic import
        try {
          const dbModule = await import('../../infrastructure/database/database.js');
          const credModule = await import('../../auth/runtime-credentials.js');

          const db = dbModule.databaseInstance;
          const { validateRuntimeCredential } = credModule;

          if (!db) {
            // Database not available - reject credential validation requests
            console.error('Database not available for runtime credential validation');
            return res.status(503).json({
              error: 'Database unavailable for credential validation',
              code: 'DATABASE_UNAVAILABLE'
            });
          }

          const result = validateRuntimeCredential(db, token);

          if (result.valid && result.principal) {
            // Runtime credential validated successfully
            // Runtime ID comes from the credential, NOT from caller choice
            // Runtime credentials are NOT founder - they operate with runtime privileges only
            const authContext = {
              owner_type: 'founder',
              owner_id: result.principal.runtimeId,  // claude or hermes - NOT 'founder'
              runtime: result.principal.runtimeId,
              session_id: randomUUID(),
              permissions: [],
              expires_at: Infinity,
              issued_at: Date.now(),
              founder_signed: false,  // Runtime credentials are not founder-signed
              client_ip: clientIp
            } as AuthContext;
            (req as any).authContext = authContext;
            (req as any).auth = authContext;
            return next();
          }
          // Invalid runtime credential - reject (no fallback)
          return res.status(401).json({
            error: result.error?.message || 'Invalid runtime credential',
            code: result.error?.code || 'INVALID_CREDENTIAL'
          });
        } catch (e) {
          // Module load error - log and reject
          console.error('Failed to load credential validation module:', e);
          return res.status(500).json({
            error: 'Authentication module unavailable',
            code: 'AUTH_MODULE_ERROR'
          });
        }
      }
    }

    // Auto-authenticate as Founder for loopback requests in local mode (bootstrap)
    // Allow runtime to be specified in request body for proper identity
    const body = (req as any).body || {};
    const runtime = body.runtime || 'claude';

    if (!['claude', 'hermes'].includes(runtime)) {
      return res.status(400).json({
        error: 'Invalid runtime for bootstrap session',
        code: 'INVALID_RUNTIME',
        allowed_values: ['claude', 'hermes']
      });
    }

    const authContext = {
      owner_type: 'founder' as const,
      owner_id: 'founder',
      runtime: runtime as 'claude' | 'hermes',
      session_id: 'local-founder',  // ALWAYS local-founder for bootstrap
      permissions: [] as string[],
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
  // SECURITY: Never allow hardcoded fallback in production mode
  const currentConfig = getConfig();

  // Reject invalid environment combinations
  if (isProd() && currentConfig.allow_hardcoded_fallback) {
    console.error('SECURITY VIOLATION: allow_hardcoded_fallback must be false in production mode');
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Production mode is fail-closed - always require valid token
    if (isProd()) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    // Development mode without hardcoded fallback - require auth
    if (!currentConfig.allow_hardcoded_fallback) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    // Development mode with hardcoded fallback enabled - auto-auth as founder
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
  return isLocal();
}

export function getLocalSingleUserBindAddress(): string {
  return getLocalBindAddressFn();
}

// Aliases for server.ts imports
export const isLocalSingleUserMode = isLocalSingleUserModeEnabled;
export const getLocalBindAddress = getLocalSingleUserBindAddress;