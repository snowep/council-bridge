// Runtime Lifecycle API Routes
// Phase 10: Single Active Runtime Management

import { Router, Request, Response } from 'express';
import { getRuntimeLifecycleManager } from '../../runtime/lifecycle.js';
import { authMiddleware, requireFounder, getAuthContext } from '../middleware/authentication.js';
import { asyncHandler, NotFoundError, AuthorizationError } from '../middleware/error-handler.js';
import { z } from 'zod/v4';
import { databaseInstance as db } from '../../database.js';

const router = Router();

// Validation schemas
const runtimeSchema = z.enum(['claude', 'hermes']);
const sessionIdSchema = z.string().uuid().optional();
const clientIpSchema = z.string().optional();
const userAgentSchema = z.string().optional();

const connectSchema = z.object({
  runtime: runtimeSchema,
  session_id: sessionIdSchema,
  client_ip: clientIpSchema,
  user_agent: userAgentSchema
});

const disconnectSchema = z.object({
  session_id: z.string().min(1)
});

const switchSchema = z.object({
  new_runtime: runtimeSchema,
  session_id: sessionIdSchema,
  client_ip: clientIpSchema,
  user_agent: userAgentSchema
});

const heartbeatSchema = z.object({
  session_id: z.string().min(1)
});

// GET /api/runtime - Get current runtime state (Founder only)
router.get('/', authMiddleware, requireFounder, asyncHandler(async (req: Request, res: Response) => {
  const lifecycle = getRuntimeLifecycleManager(db);
  const state = lifecycle.getState();

  res.json({
    success: true,
    data: {
      activeRuntime: state.activeRuntime,
      connectionStatus: state.connectionStatus,
      sessionId: state.sessionId,
      connectedAt: state.connectedAt,
      lastHeartbeatAt: state.lastHeartbeatAt,
      leaseExpiresAt: state.leaseExpiresAt,
      lastError: state.lastError
    }
  });
}));

// POST /api/runtime/connect - Connect a runtime (Founder only)
router.post('/connect', authMiddleware, requireFounder, asyncHandler(async (req: Request, res: Response) => {
  const lifecycle = getRuntimeLifecycleManager(db);

  // Validate request
  const result = connectSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request body',
      details: result.error.issues
    });
  }

  const { runtime, session_id, client_ip, user_agent } = result.data;

  const connectResult = lifecycle.connect({
    runtime,
    sessionId: session_id,
    clientIp: client_ip,
    userAgent: user_agent
  });

  if (!connectResult.success) {
    const error = connectResult.error || 'Unknown error';

    if (error.includes('Runtime already active')) {
      return res.status(409).json({
        success: false,
        error,
        code: 'RUNTIME_CONFLICT'
      });
    }

    return res.status(400).json({
      success: false,
      error
    });
  }

  res.status(200).json({
    success: true,
    data: connectResult.state
  });
}));

// POST /api/runtime/disconnect - Disconnect current runtime (Founder only)
router.post('/disconnect', authMiddleware, requireFounder, asyncHandler(async (req: Request, res: Response) => {
  const lifecycle = getRuntimeLifecycleManager(db);

  // Validate request
  const result = disconnectSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request body',
      details: result.error.issues
    });
  }

  const { session_id } = result.data;

  const disconnectResult = lifecycle.disconnect({ sessionId: session_id });

  if (!disconnectResult.success) {
    return res.status(400).json({
      success: false,
      error: disconnectResult.error
    });
  }

  res.status(200).json({
    success: true,
    data: disconnectResult.state
  });
}));

// POST /api/runtime/switch - Switch between runtimes (Founder only)
router.post('/switch', authMiddleware, requireFounder, asyncHandler(async (req: Request, res: Response) => {
  const lifecycle = getRuntimeLifecycleManager(db);

  // Validate request
  const result = switchSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request body',
      details: result.error.issues
    });
  }

  const { new_runtime, session_id, client_ip, user_agent } = result.data;

  const switchResult = lifecycle.switch({
    newRuntime: new_runtime,
    sessionId: session_id,
    clientIp: client_ip,
    userAgent: user_agent
  });

  if (!switchResult.success) {
    const error = switchResult.error || 'Unknown error';

    if (error.includes('conflict') || error.includes('ownership')) {
      return res.status(409).json({
        success: false,
        error,
        code: 'RUNTIME_SWITCH_CONFLICT'
      });
    }

    return res.status(400).json({
      success: false,
      error
    });
  }

  res.status(200).json({
    success: true,
    data: switchResult.state
  });
}));

// POST /api/runtime/heartbeat - Renew session lease (session owner only)
router.post('/heartbeat', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const ctx = getAuthContext(req);
  const lifecycle = getRuntimeLifecycleManager(db);

  // Validate request
  const result = heartbeatSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request body',
      details: result.error.issues
    });
  }

  const { session_id } = result.data;

  // Authorization: Session owner can heartbeat
  // - Runtime sessions: session_id in auth context must match request
  // - Founder sessions (local mode): can heartbeat any valid connected session
  if (!ctx || !ctx.session_id) {
    throw new AuthorizationError('Session ownership required for heartbeat');
  }

  // For runtime sessions, verify the session_id matches the authenticated runtime
  if (ctx.owner_type === 'runtime') {
    if (ctx.session_id !== session_id) {
      throw new AuthorizationError('Session ownership required for heartbeat');
    }
  }
  // For Founder sessions (local mode), allow heartbeat for any connected session
  // This enables the bootstrap flow where Founder creates/connects a runtime

  // Verify the session exists and is connected via the lifecycle manager
  const ownership = lifecycle.getSessionOwnership(session_id);
  if (!ownership.isOwner) {
    throw new NotFoundError('Session not found or not active');
  }

  const heartbeatResult = lifecycle.heartbeat({ sessionId: session_id });

  if (!heartbeatResult.success) {
    const error = heartbeatResult.error || 'Unknown error';

    if (error === 'Session expired') {
      return res.status(410).json({
        success: false,
        error,
        code: 'SESSION_EXPIRED'
      });
    }

    return res.status(400).json({
      success: false,
      error
    });
  }

  res.status(200).json({
    success: true,
    data: heartbeatResult.state
  });
}));

// POST /api/runtime/recover - Recover stale sessions (admin/authorized only)
router.post('/recover', authMiddleware, requireFounder, asyncHandler(async (_req: Request, res: Response) => {
  const lifecycle = getRuntimeLifecycleManager(db);
  const result = lifecycle.recoverStaleSessions();

  res.json({
    success: true,
    data: {
      recovered: result.recovered,
      errors: result.errors
    }
  });
}));

export default router;