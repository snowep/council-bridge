// Server with Production-Ready Authentication
// Phase 8: Explicit auth modes, fail-closed in production

import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod/v4';
import crypto from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createDatabase, DatabaseInstance } from './database.js';
import {
  AutonomyLevelSchema,
  ExecutionStatusSchema,
  ApprovalStatusSchema,
  CreateTaskAutonomyLevelInputSchema,
  RequestExecutionInputSchema,
  ApproveExecutionInputSchema,
  GetExecutionRequestInputSchema,
  ListExecutionRequestsInputSchema,
  ListApprovalRequestsInputSchema,
  GetExecutionHistoryInputSchema
} from './council/types.js';

import {
  validateSessionToken,
  hasPermission,
  listActiveSessions,
  cleanupExpiredSessions
} from './auth/session.js';

import {
  verifyFounderOperation,
  verifyFounderRequestWithLoadedKeys,
  getFounderKeyId,
  getFounderPublicKey
} from './auth/founder.js';

import {
  getAuthConfig,
  isProductionMode,
  isDevelopmentMode,
  AuthContext,
  validateAuthMode,
  authMiddleware,
  getAuthContext
} from './auth/index.js';

import {
  createTaskAutonomyLevel,
  listTaskAutonomyLevels,
  getTaskAutonomyLevel,
  requestExecution,
  approveExecution,
  getExecutionRequest,
  getExecutionHistory,
  listExecutionRequests,
  listApprovalRequests,
  setCryptoModule,
  executeExecutionRequest,
  cancelExecutionRequest
} from './council/operations.js';

import { registerMcpTools } from './mcp/tools.js';

// Initialize crypto module for operations
setCryptoModule(crypto);

const app = express();
app.use(express.json());

// Database instance
let db: DatabaseInstance;

// Initialize database
async function initDb() {
  try {
    const dbPath = process.env.DATABASE_PATH;
    const isProduction = process.env.NODE_ENV === 'production';

    // In production, DATABASE_PATH is required and must not be :memory:
    if (isProduction && (!dbPath || dbPath === ':memory:')) {
      console.error('❌ PRODUCTION ERROR: DATABASE_PATH environment variable is required and must point to a persistent database file. In-memory database (:memory:) is not allowed in production.');
      process.exit(1);
    }

    // In development/test, if no DATABASE_PATH is provided, createDatabase will use its default
    const effectiveDbPath = dbPath || (isProduction ? '' : undefined);
    db = createDatabase(effectiveDbPath);
  } catch (error) {
    console.error('❌ Database initialization failed:', error instanceof Error ? error.message : 'Unknown error');
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw error;
  }
}

// Auth mode configuration
const config = getAuthConfig();
const PRODUCTION_MODE = isProductionMode();
const DEVELOPMENT_MODE = isDevelopmentMode();

// Validate auth configuration on startup
const authValidation = validateAuthMode();
if (!authValidation.valid) {
  console.error('⚠️  AUTH CONFIGURATION ERRORS:');
  for (const error of authValidation.errors) {
    console.error(`   - ${error}`);
  }
  if (PRODUCTION_MODE) {
    console.error('❌ Server will not start in production with invalid auth config');
    process.exit(1);
  }
}

console.log(`🔐 Auth Mode: ${config.mode.toUpperCase()}`);
console.log(`🔐 Hardcoded Fallback: ${config.allow_hardcoded_fallback ? 'ENABLED (development only)' : 'DISABLED'}`);
console.log(`🔐 Session Timeout: ${config.session_timeout_ms / 1000 / 60} minutes`);
console.log(`🔐 Founder Key ID: ${getFounderKeyId() ?? 'NOT INITIALIZED'}`);

// Founder signature middleware for privileged operations
// Verifies operation-bound signature with replay protection
function founderSignatureMiddleware(requiredOperations: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { founder_signature, founder_timestamp, founder_nonce, founder_key_id } = req.body;
    const operation = req.path.replace('/api/', '');

    if (!requiredOperations.includes(operation)) {
      return next();
    }

    // In production, ALL privileged operations require valid founder signature
    // In development, also require signature but with more lenient validation
    if (!founder_signature) {
      return res.status(403).json({
        error: 'Founder signature required for this operation',
        code: 'FOUNDER_SIGNATURE_REQUIRED',
        operation
      });
    }

    if (!founder_timestamp || !founder_nonce || !founder_key_id) {
      return res.status(403).json({
        error: 'Founder signature missing required fields (timestamp, nonce, key_id)',
        code: 'FOUNDER_SIGNATURE_INCOMPLETE'
      });
    }

    // Verify operation-bound signature
    const body = { ...req.body };
    delete body.founder_signature;
    delete body.founder_timestamp;
    delete body.founder_nonce;
    delete body.founder_key_id;

    const result = verifyFounderOperation(
      operation,
      body,
      founder_signature,
      founder_timestamp,
      founder_nonce,
      founder_key_id
    );

    if (!result.valid) {
      // Map error to appropriate HTTP status and code
      const errorMap: Record<string, { status: number; code: string; message: string }> = {
        'NO_KEYS': { status: 500, code: 'FOUNDER_KEYS_MISSING', message: 'Founder keys not initialized' },
        'KEY_MISMATCH': { status: 403, code: 'FOUNDER_KEY_MISMATCH', message: 'Key ID mismatch - key rotation may have occurred' },
        'TIMESTAMP_EXPIRED': { status: 403, code: 'FOUNDER_TIMESTAMP_EXPIRED', message: 'Signature timestamp expired or in future' },
        'NONCE_MISSING': { status: 403, code: 'FOUNDER_NONCE_MISSING', message: 'Nonce is required' },
        'NONCE_TOO_LONG': { status: 403, code: 'FOUNDER_NONCE_TOO_LONG', message: 'Nonce exceeds maximum length' },
        'NONCE_MALFORMED': { status: 403, code: 'FOUNDER_NONCE_MALFORMED', message: 'Nonce contains invalid characters' },
        'NONCE_REPLAY': { status: 403, code: 'FOUNDER_NONCE_REPLAY', message: 'Nonce already consumed - replay attack detected' },
        'INVALID_SIGNATURE': { status: 403, code: 'FOUNDER_SIGNATURE_INVALID', message: 'Invalid founder signature' },
        'VERIFICATION_ERROR': { status: 500, code: 'FOUNDER_VERIFICATION_ERROR', message: 'Signature verification failed' }
      };

      const errorInfo = errorMap[result.error || 'INVALID_SIGNATURE'] || errorMap['INVALID_SIGNATURE'];
      return res.status(errorInfo.status).json({
        error: errorInfo.message,
        code: errorInfo.code
      });
    }

    // Signature valid - set founder context
    (req as any).authContext = {
      owner_type: 'founder',
      owner_id: 'founder',
      runtime: 'claude',
      session_id: 'founder-signed',
      permissions: [],
      expires_at: Infinity,
      issued_at: Date.now(),
      founder_signed: true
    };

    next();
  };
}

// Phase 7: Task Autonomy Level Endpoints
app.post('/api/task-autonomy', authMiddleware, async (req, res) => {
  try {
    const input = CreateTaskAutonomyLevelInputSchema.parse(req.body);
    const ctx = getAuthContext(req)!; // authMiddleware guarantees authContext in production

    if (ctx.owner_type !== 'founder') {
      return res.status(403).json({ error: 'Founder authorization required' });
    }

    const result = createTaskAutonomyLevel(db, ctx, input);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/task-autonomy', authMiddleware, async (req, res) => {
  try {
    const levels = await listTaskAutonomyLevels(db);
    res.json(levels);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch task autonomy levels' });
  }
});

// Phase 7: Execution Endpoints
app.post('/api/execution/request', authMiddleware, async (req, res) => {
  try {
    const input = RequestExecutionInputSchema.parse(req.body);
    const ctx = getAuthContext(req)!;

    const result = await requestExecution(db, ctx, input);

    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/execution/:id', authMiddleware, async (req, res) => {
  try {
    const executionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const input = { execution_id: executionId };
    const result = await getExecutionRequest(db, getAuthContext(req)!, input);

    if (!result) {
      return res.status(404).json({ error: 'Execution request not found' });
    }

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/execution', authMiddleware, async (req, res) => {
  try {
    const ctx = getAuthContext(req)!;
    const input: any = {
      status: req.query.status as any,
      autonomy_level: req.query.autonomy_level ? parseInt(req.query.autonomy_level as string) : undefined,
      requested_by_type: ctx.owner_type === 'founder' ? req.query.requested_by_type as any : undefined,
      requested_by_id: ctx.owner_type === 'founder' ? req.query.requested_by_id as string | undefined : undefined,
      task_id: req.query.task_id as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0
    };

    const result = await listExecutionRequests(db, ctx, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list execution requests' });
  }
});

// Phase 8: Approval with Founder Signature (operation-bound)
app.post('/api/execution/approve',
  authMiddleware,
  founderSignatureMiddleware(config.require_founder_signature_for),
  async (req, res) => {
  try {
    const input = ApproveExecutionInputSchema.parse(req.body);
    const ctx = getAuthContext(req)!;

    const result = await approveExecution(db, ctx, input);

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Phase 7: Approval Requests
app.get('/api/approvals', authMiddleware, async (req, res) => {
  try {
    const ctx = getAuthContext(req)!;
    const input: any = {
      status: req.query.status as any,
      requested_by_type: ctx.owner_type === 'founder' ? req.query.requested_by_type as any : undefined,
      requested_by_id: ctx.owner_type === 'founder' ? req.query.requested_by_id as string | undefined : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0
    };

    const result = await listApprovalRequests(db, ctx, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list approval requests' });
  }
});

// Phase 7: Execution History
app.get('/api/execution/:id/history', authMiddleware, async (req, res) => {
  try {
    const executionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const input = { execution_id: executionId };
    const result = await getExecutionHistory(db, getAuthContext(req)!, input);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Phase 7: Execute Execution Request (Level 1/2: requester or founder; Level 3: approved only)
app.post('/api/execution/:id/execute',
  authMiddleware,
  founderSignatureMiddleware(config.require_founder_signature_for),
  async (req, res) => {
  try {
    const executionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { result_payload = {} } = req.body;
    const result = await executeExecutionRequest(db, getAuthContext(req)!, executionId, result_payload);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Phase 7: Cancel Execution Request
app.post('/api/execution/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const executionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { error_message } = req.body;
    const result = await cancelExecutionRequest(db, getAuthContext(req)!, executionId, error_message);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Helper function to validate identity against database
async function validateIdentityForSession(db: DatabaseInstance, owner_type: string, owner_id: string, runtime: string): Promise<boolean> {
  switch (owner_type) {
    case 'founder':
      return owner_id === 'founder';
    case 'staff': {
      const staff = db.stmt.getStaffAgentById.get(owner_id) as { status: string; runtime_instances: string } | undefined;
      if (!staff || staff.status !== 'active') return false;
      // Check if runtime is in runtime_instances JSON array
      try {
        const runtimes = JSON.parse(staff.runtime_instances || '[]') as string[];
        return runtimes.includes(runtime);
      } catch {
        return false;
      }
    }
    case 'division': {
      const division = db.stmt.getDivisionById.get(owner_id) as object | undefined;
      return !!division;
    }
    case 'seat': {
      const seat = db.stmt.getSeatById.get(owner_id) as { status: string } | undefined;
      return !!seat && seat.status === 'active';
    }
    default:
      return false;
  }
}

// Auth management endpoints
app.post('/api/auth/session', async (req, res) => {
  try {
    const { owner_type, owner_id, runtime } = req.body;

    if (!owner_type || !owner_id || !runtime) {
      return res.status(400).json({ error: 'owner_type, owner_id, and runtime required' });
    }

    if (!['founder', 'staff', 'division', 'seat'].includes(owner_type)) {
      return res.status(400).json({ error: 'Invalid owner_type' });
    }

    if (!['claude', 'hermes'].includes(runtime)) {
      return res.status(400).json({ error: 'Invalid runtime' });
    }

    // PRODUCTION: Require Founder signature for ALL session provisioning
    if (PRODUCTION_MODE) {
      const { founder_signature, founder_timestamp, founder_nonce, founder_key_id } = req.body;

      if (!founder_signature || !founder_timestamp || !founder_nonce || !founder_key_id) {
        return res.status(403).json({
          error: 'Founder signature required for session provisioning in production',
          code: 'FOUNDER_SIGNATURE_REQUIRED',
          required_fields: ['founder_signature', 'founder_timestamp', 'founder_nonce', 'founder_key_id']
        });
      }

      // Verify operation-bound signature
      const body = { ...req.body };
      delete body.founder_signature;
      delete body.founder_timestamp;
      delete body.founder_nonce;
      delete body.founder_key_id;

      const result = verifyFounderOperation(
        'create_session',
        body,
        founder_signature,
        founder_timestamp,
        founder_nonce,
        founder_key_id
      );

      if (!result.valid) {
        const errorMap: Record<string, { status: number; code: string; message: string }> = {
          'NO_KEYS': { status: 500, code: 'FOUNDER_KEYS_MISSING', message: 'Founder keys not initialized' },
          'KEY_MISMATCH': { status: 403, code: 'FOUNDER_KEY_MISMATCH', message: 'Key ID mismatch - key rotation may have occurred' },
          'TIMESTAMP_EXPIRED': { status: 403, code: 'FOUNDER_TIMESTAMP_EXPIRED', message: 'Signature timestamp expired or in future' },
          'NONCE_MISSING': { status: 403, code: 'FOUNDER_NONCE_MISSING', message: 'Nonce is required' },
          'NONCE_TOO_LONG': { status: 403, code: 'FOUNDER_NONCE_TOO_LONG', message: 'Nonce exceeds maximum length' },
          'NONCE_MALFORMED': { status: 403, code: 'FOUNDER_NONCE_MALFORMED', message: 'Nonce contains invalid characters' },
          'NONCE_REPLAY': { status: 403, code: 'FOUNDER_NONCE_REPLAY', message: 'Nonce already consumed - replay attack detected' },
          'INVALID_SIGNATURE': { status: 403, code: 'FOUNDER_SIGNATURE_INVALID', message: 'Invalid founder signature' },
          'VERIFICATION_ERROR': { status: 500, code: 'FOUNDER_VERIFICATION_ERROR', message: 'Signature verification failed' }
        };

        const errorInfo = errorMap[result.error || 'INVALID_SIGNATURE'] || errorMap['INVALID_SIGNATURE'];
        return res.status(errorInfo.status).json({
          error: errorInfo.message,
          code: errorInfo.code
        });
      }

      // Validate requested identity against database
      const identityValid = await validateIdentityForSession(db, owner_type, owner_id, runtime);
      if (!identityValid) {
        return res.status(403).json({
          error: 'Invalid or inactive identity for session provisioning',
          code: 'INVALID_IDENTITY'
        });
      }
    } else {
      // DEVELOPMENT: Allow without signature but validate identity exists
      const identityValid = await validateIdentityForSession(db, owner_type, owner_id, runtime);
      if (!identityValid) {
        return res.status(400).json({ error: 'Invalid identity for session provisioning' });
      }
    }

    const { generateSessionToken } = await import('./auth/session.js');
    const token = generateSessionToken({
      owner_type,
      owner_id,
      runtime,
      client_ip: req.ip,
      user_agent: req.get('user-agent')
    });

    res.json({ session_token: token });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.delete('/api/auth/session', authMiddleware, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Session token required' });
    }

    const token = authHeader.substring(7);
    const { invalidateSession } = await import('./auth/session.js');

    // Extract session_id from token
    const parts = token.split('|');
    if (parts.length !== 4) {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    const session_id = parts[0];
    const revoked = invalidateSession(session_id);

    res.json({ revoked, session_id });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/auth/status', authMiddleware, async (req, res) => {
  const ctx = getAuthContext(req);
  const { listActiveSessions, cleanupExpiredSessions, getSessionStats } = await import('./auth/session.js');

  res.json({
    authenticated: !!ctx,
    auth_mode: config.mode,
    session: ctx ? {
      owner_type: ctx.owner_type,
      owner_id: ctx.owner_id,
      runtime: ctx.runtime,
      session_id: ctx.session_id,
      expires_at: ctx.expires_at,
      founder_signed: ctx.founder_signed
    } : null,
    stats: getSessionStats()
  });
});

app.get('/api/auth/founder/public-key', async (req, res) => {
  const publicKey = getFounderPublicKey();
  const keyId = getFounderKeyId();

  if (!publicKey) {
    return res.status(404).json({ error: 'Founder keys not initialized' });
  }

  res.json({ public_key: publicKey, key_id: keyId });
});

// MCP endpoint - create new server+transport per request for stateless operation
// Apply Phase 8 authentication to ALL MCP requests (initialization, notifications, tools)
// Fail-closed in production, no hardcoded identity fallbacks
// Bind authenticated identity to MCP request context - prevent caller override
app.all('/mcp', authMiddleware, async (req, res) => {
  // Auth context is bound by authMiddleware - prevent caller from overriding
  // req.authContext is set by authMiddleware and cannot be supplied by caller
  // Create a new transport for each request to support stateless operation
  const requestTransport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const requestMcpServer = new McpServer({ name: 'council-bridge', version: '1.0.0' }, { capabilities: { tools: {} } });
  await requestMcpServer.connect(requestTransport);
  // Pass the authenticated context directly to tools
  const authContext = getAuthContext(req);
  registerMcpTools(requestMcpServer, db, () => authContext);
  await requestTransport.handleRequest(req, res, req.body);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    auth_mode: config.mode,
    fallback_enabled: config.allow_hardcoded_fallback
  });
});

// Start server
const PORT = process.env.PORT || 3334;

initDb().then(() => {
  // Periodic session cleanup
  setInterval(() => {
    cleanupExpiredSessions();
  }, 5 * 60 * 1000); // Every 5 minutes

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${config.mode.toUpperCase()}]`);
  });
});

export default app;