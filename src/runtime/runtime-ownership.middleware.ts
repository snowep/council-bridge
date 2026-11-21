// Runtime Ownership Middleware for MCP Tool Execution
// Phase 10: Enforce single active runtime at the MCP execution boundary

import { RuntimeLifecycleManager, getRuntimeLifecycleManager } from './lifecycle.js';
import { DatabaseInstance } from '../database.js';
import { AuthContext } from '../auth/index.js';
import { parseUnixMs } from './lifecycle.js';

export interface RuntimeOwnershipContext {
  runtimeId: 'claude' | 'hermes';
  sessionId: string;
}

export interface RuntimeOwnershipResult {
  allowed: boolean;
  activeRuntime?: 'claude' | 'hermes';
  activeSessionId?: string;
  reason?: string;
  errorCode?: string;
}

/**
 * Creates a runtime ownership guard for MCP execution
 * @param db - Database instance
 * @returns Function that checks runtime ownership
 */
export function createRuntimeOwnershipGuard(db: DatabaseInstance) {
  // Use singleton lifecycle manager to share state with test and runtime activation
  const lifecycle = getRuntimeLifecycleManager(db);

  return function checkRuntimeOwnership(authContext: AuthContext): RuntimeOwnershipResult {
    // 1. Verify session identity from auth context
    const { runtime: requestRuntime, session_id: requestSessionId } = authContext;

    if (!requestSessionId) {
      return {
        allowed: false,
        reason: 'Missing session identity in authentication context',
        errorCode: 'SESSION_ID_REQUIRED'
      };
    }

    // 2. Get the authoritative active session from SQLite
    const state = lifecycle.getState();

    // 3. Verify there is an active session
    if (!state.sessionId || !state.activeRuntime) {
      return {
        allowed: false,
        reason: 'No active runtime session',
        errorCode: 'NO_ACTIVE_SESSION'
      };
    }

    // 4. Verify the session is connected
    if (state.connectionStatus !== 'connected') {
      return {
        allowed: false,
        reason: `Session is not connected (status: ${state.connectionStatus})`,
        errorCode: 'SESSION_NOT_CONNECTED'
      };
    }

    // 5. Verify lease has not expired (fail-closed: reject on invalid/missing/expired lease)
    const leaseExpires = state.leaseExpiresAt;
    const leaseExpiresMs = parseUnixMs(leaseExpires);

    if (leaseExpiresMs === null) {
      return {
        allowed: false,
        reason: 'Runtime session has an invalid or missing lease timestamp',
        errorCode: 'INVALID_SESSION_LEASE'
      };
    }

    if (leaseExpiresMs <= Date.now()) {
      return {
        allowed: false,
        reason: 'Session lease has expired',
        errorCode: 'SESSION_EXPIRED'
      };
    }

    // 6. Verify the active session belongs to the requesting session ID
    if (state.sessionId !== requestSessionId) {
      return {
        allowed: false,
        reason: `This runtime does not own the active Council Bridge session. Active runtime: ${state.activeRuntime}`,
        activeRuntime: state.activeRuntime,
        errorCode: 'RUNTIME_NOT_ACTIVE'
      };
    }

    // 7. Verify the runtime matches (claude/hermes)
    if (state.activeRuntime !== requestRuntime) {
      return {
        allowed: false,
        reason: `Runtime mismatch: authorized as ${requestRuntime}, but active session belongs to ${state.activeRuntime}`,
        errorCode: 'RUNTIME_MISMATCH'
      };
    }

    // Ownership verified
    return {
      allowed: true,
      activeRuntime: state.activeRuntime,
      activeSessionId: state.sessionId
    };
  };
}

/**
 * MCP-compatible error response for ownership violations
 */
export function mcpOwnershipErrorResponse(result: RuntimeOwnershipResult): {
  error: string;
  message: string;
  activeRuntime?: 'claude' | 'hermes';
} {
  return {
    error: result.errorCode || 'RUNTIME_NOT_ACTIVE',
    message: result.reason || 'This runtime does not own the active Council Bridge session.',
    ...(result.activeRuntime && { activeRuntime: result.activeRuntime })
  };
}

/**
 * Express middleware for REST endpoints
 */
export function runtimeOwnershipMiddleware(db: DatabaseInstance) {
  const checkOwnership = createRuntimeOwnershipGuard(db);

  return function(req: any, res: any, next: any) {
    const authContext = req.authContext || req.auth;

    if (!authContext) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }

    const result = checkOwnership(authContext);

    if (!result.allowed) {
      return res.status(403).json({
        error: result.errorCode || 'RUNTIME_NOT_ACTIVE',
        message: result.reason,
        activeRuntime: result.activeRuntime
      });
    }

    // Attach ownership info to request
    req.runtimeOwnership = result;
    next();
  };
}