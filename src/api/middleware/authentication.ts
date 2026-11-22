// Authentication Middleware
// Extracted from server.ts for modularization
// Phase 10: Local single-user Founder mode with loopback restriction
// Phase 1: Problem D - MCP runtime authentication requires validateRuntimeCredential

import { Request, Response, NextFunction } from 'express';
import { validateSessionToken, getAuthConfig, getLocalBindAddress as getLocalBindAddressFn, AuthContext } from '../../auth/index.js';
import { validateRuntimeCredential } from '../../auth/runtime-credentials.js';
import { databaseInstance } from '../../database.js';
import { parseUnixMs } from '../../runtime/lifecycle.js';

// Runtime principal type for MCP authentication - Phase 1 Problem D
export interface RuntimePrincipal {
  type: 'runtime';
  runtimeId: 'claude' | 'hermes';
  credentialId: string;
}

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
    // Local mode validates session tokens for HTTP API requests (like normal mode)
    // Runtime credential validation happens at MCP endpoint level, not here
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      if (token) {
        // Validate as session token (same as normal mode)
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
        // Invalid session token - reject (no fallback to founder)
        return res.status(401).json({
          error: 'Invalid session token',
          code: 'INVALID_SESSION'
        });
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

/**
 * MCP Runtime Authentication Middleware - Phase 1 Problem D
 *
 * Authenticates MCP requests using runtime credentials only.
 * This does NOT fall back to Founder authentication.
 * Runtime identity is derived from the credential, NOT from request body.
 *
 * After validation, establishes a runtime session and creates AuthContext
 * for ownership/execution guards.
 */
export async function mcpRuntimeAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  const authHeader = req.headers.authorization;

  // 1. Require Authorization header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
      message: 'MCP runtime credential required'
    });
  }

  // 2. Validate the Bearer token value
  const token = authHeader.substring(7);
  if (!token || token.trim() === '') {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'TOKEN_EMPTY',
      message: 'Bearer token is empty'
    });
  }

  // 3. Validate runtime credential against database
  const db = databaseInstance;
  if (!db) {
    return res.status(503).json({
      error: 'Authentication service unavailable',
      code: 'DB_UNAVAILABLE',
      message: 'Database not available for credential validation'
    });
  }

  // 4. Call validateRuntimeCredential with just the token value (strip Bearer prefix)
  // SECURITY: Runtime identity comes from the credential, NOT from the caller
  // Pass as "Bearer <token>" since validateRuntimeCredential expects that format
  const result = validateRuntimeCredential(db, `Bearer ${token}`);

  if (!result.valid || !result.principal) {
    return res.status(401).json({
      error: result.error?.message || 'Invalid runtime credential',
      code: result.error?.code || 'INVALID_CREDENTIAL',
      message: 'MCP authentication failed'
    });
  }

  // 5. Create runtime principal - NOT a founder principal
  // Runtime credentials never receive Founder permissions
  const runtimePrincipal: RuntimePrincipal = {
    type: 'runtime',
    runtimeId: result.principal.runtimeId,
    credentialId: result.principal.credentialId
  };

  // 6. Attach runtime principal to request for tools to access
  (req as any).runtimePrincipal = runtimePrincipal;
  (req as any).runtimeCredentialValid = true;

  // 7. Establish runtime session using lifecycle manager
  // This creates a session_id that ownership/execution guards can validate
  const { getRuntimeLifecycleManager } = await import('../../runtime/lifecycle.js');
  const lifecycle = getRuntimeLifecycleManager(db);
  const clientIp = req.socket?.remoteAddress || 'unknown';
  const connResult = lifecycle.connect({
    runtime: runtimePrincipal.runtimeId,
    clientIp
  });

  if (!connResult.success || !connResult.state) {
    return res.status(500).json({
      error: 'Failed to establish runtime session',
      code: 'SESSION_CREATE_FAILED',
      message: connResult.error || 'Unknown error establishing runtime session'
    });
  }

  // 8. Create AuthContext from the established session
  // This AuthContext will be used by ownership/execution guards
  const authContext: AuthContext = {
    owner_type: 'runtime',
    owner_id: `runtime-${runtimePrincipal.runtimeId}`,
    runtime: runtimePrincipal.runtimeId,
    session_id: connResult.state.sessionId!,
    permissions: [],
    expires_at: connResult.state.leaseExpiresAt ? parseUnixMs(connResult.state.leaseExpiresAt) || Infinity : Infinity,
    issued_at: Date.now(),
    founder_signed: false,
    client_ip: clientIp
  };

  (req as any).authContext = authContext;
  (req as any).auth = authContext;

  return next();
}