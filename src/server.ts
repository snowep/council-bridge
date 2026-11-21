// Server with Production-Ready Authentication
// Phase 8: Explicit auth modes, fail-closed in production
// Phase 10: Modular route registration

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createDatabase, DatabaseInstance } from './database.js';
import {
  startSessionCleanupInterval,
  stopSessionCleanupInterval,
  getSessionStats
} from './auth/session.js';

import {
  verifyFounderOperation,
  getFounderKeyId,
  getFounderPublicKey,
  startNonceCleanupInterval,
  stopNonceCleanupInterval,
  initializeFounderKeys
} from './auth/founder.js';

// Import setDatabaseInstance after database.ts to ensure proper initialization order
import { setDatabaseInstance as setDbInstance } from './database.js';

import {
  getAuthConfig,
  isProductionMode,
  isDevelopmentMode,
  isLocalSingleUserMode,
  getLocalBindAddress,
  validateAuthMode,
  validateFounderKeyConfiguration,
  validateLocalSingleUserConfig
} from './auth/index.js';

// Shared error map for founder signature verification errors
const FOUNDER_ERROR_MAP: Record<string, { status: number; code: string; message: string }> = {
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

function handleFounderVerificationError(res: Response, result: { valid: boolean; error?: string }) {
  const errorInfo = FOUNDER_ERROR_MAP[result.error || 'INVALID_SIGNATURE'] || FOUNDER_ERROR_MAP['INVALID_SIGNATURE'];
  return res.status(errorInfo.status).json({
    error: errorInfo.message,
    code: errorInfo.code
  });
}

import {
  createTaskAutonomyLevel,
  listTaskAutonomyLevels,
  requestExecution,
  approveExecution,
  getExecutionHistory,
  setCryptoModule
} from './council/operations.js';

import { createRuntimeOwnershipGuard, mcpOwnershipErrorResponse } from './runtime/runtime-ownership.middleware.js';
import { createRuntimeExecutionGuard } from './runtime/runtime-execution-guard.js';

import { registerMcpTools } from './mcp/tools.js';

// Import route modules
import messagesRoutes from './api/routes/messages.routes.js';
import meetingsRoutes from './api/routes/meetings.routes.js';
import councilRoutes from './api/routes/council.routes.js';
import memoryRoutes from './api/routes/memory.routes.js';
import divisionsRoutes from './api/routes/divisions.routes.js';
import staffRoutes from './api/routes/staff.routes.js';
import tasksRoutes from './api/routes/tasks.routes.js';
import executionsRoutes from './api/routes/executions.routes.js';
import approvalsRoutes from './api/routes/approvals.routes.js';
import deliverablesRoutes from './api/routes/deliverables.routes.js';
import qualityRoutes from './api/routes/quality.routes.js';
import activityRoutes from './api/routes/activity.routes.js';
import hermesBridgeRoutes from './api/routes/hermes-bridge.routes.js';

// Import middleware
import { authMiddleware, getAuthContext } from './api/middleware/authentication.js';
import { errorHandler } from './api/middleware/error-handler.js';

// Initialize crypto module for operations
setCryptoModule(crypto);

const app = express();

// CORS configuration - allow environment override for production
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Encoding', 'Accept-Language'],
}));
app.use(express.json());

// Database instance
let db: DatabaseInstance;

// Initialize database
async function initDb() {
  try {
    const dbPath = process.env.DATABASE_PATH;
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction && (!dbPath || dbPath === ':memory:')) {
      console.error('❌ PRODUCTION ERROR: DATABASE_PATH environment variable is required and must point to a persistent database file. In-memory database (:memory:) is not allowed in production.');
      process.exit(1);
    }

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
const LOCAL_MODE = isLocalSingleUserMode();
const LOCAL_BIND_ADDRESS = getLocalBindAddress();

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

// SEC-04: Validate Founder key configuration on startup
// Auto-initialize founder keys in development mode if missing
const founderKeyValidation = validateFounderKeyConfiguration();
if (!founderKeyValidation.valid) {
  console.error('⚠️  FOUNDER KEY CONFIGURATION ERRORS:');
  for (const error of founderKeyValidation.errors) {
    console.error(`   - ${error}`);
  }
  if (PRODUCTION_MODE) {
    console.error('❌ Server will not start in production without valid Founder keys');
    process.exit(1);
  }
  // Auto-initialize founder keys in non-production mode
  const keys = initializeFounderKeys();
  console.log(`🔐 Founder keys auto-initialized (key_id: ${keys.key_id})`);
}

// Validate local single-user mode configuration
const localConfigValidation = validateLocalSingleUserConfig();
if (!localConfigValidation.valid) {
  console.error('⚠️  LOCAL SINGLE-USER MODE CONFIGURATION ERRORS:');
  for (const error of localConfigValidation.errors) {
    console.error(`   - ${error}`);
  }
  console.error('❌ Server will not start with invalid local single-user mode config');
  process.exit(1);
}

console.log(`🔐 Auth Mode: ${config.mode.toUpperCase()}`);
console.log(`🔐 Hardcoded Fallback: ${config.allow_hardcoded_fallback ? 'ENABLED (development only)' : 'DISABLED'}`);
console.log(`🔐 Session Timeout: ${config.session_timeout_ms / 1000 / 60} minutes`);
console.log(`🔐 Founder Key ID: ${getFounderKeyId() ?? 'NOT INITIALIZED'}`);
if (LOCAL_MODE) {
  console.log(`🔐 Local Single-User Mode: ENABLED (bind: ${LOCAL_BIND_ADDRESS})`);
  console.log(`🔐 Loopback Restriction: ACTIVE`);
}

// Rate limiting for founder-signature endpoints (DoS protection)
const founderSignatureRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many founder signature attempts', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false
});

// Founder signature middleware for privileged operations
function founderSignatureMiddleware(requiredOperations: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { founder_signature, founder_timestamp, founder_nonce, founder_key_id } = req.body;
    const operation = req.path.replace('/api/', '');

    if (!requiredOperations.includes(operation)) {
      return next();
    }

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
      return handleFounderVerificationError(res, result);
    }

    (req as any).authContext = {
      owner_type: 'founder',
      owner_id: 'founder',
      runtime: 'claude',
      session_id: 'dev-fallback',
      permissions: [],
      expires_at: Infinity,
      issued_at: Date.now(),
      founder_signed: true
    };

    next();
  };
}

// ============================================================
// ROUTE REGISTRATION
// ============================================================

// Health check (no auth)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    auth_mode: config.mode,
    fallback_enabled: config.allow_hardcoded_fallback
  });
});

// Auth endpoints (some without auth middleware for session creation)
app.post('/api/auth/session', founderSignatureRateLimit, async (req, res) => {
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

    if (PRODUCTION_MODE) {
      const { founder_signature, founder_timestamp, founder_nonce, founder_key_id } = req.body;

      if (!founder_signature || !founder_timestamp || !founder_nonce || !founder_key_id) {
        return res.status(403).json({
          error: 'Founder signature required for session provisioning in production',
          code: 'FOUNDER_SIGNATURE_REQUIRED',
          required_fields: ['founder_signature', 'founder_timestamp', 'founder_nonce', 'founder_key_id']
        });
      }

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
        return handleFounderVerificationError(res, result);
      }

      // Validate requested identity against database
      const { validateIdentityForSession } = await import('./auth/index.js');
      const identityValid = await validateIdentityForSession(db, owner_type, owner_id, runtime);
      if (!identityValid) {
        return res.status(403).json({
          error: 'Invalid or inactive identity for session provisioning',
          code: 'INVALID_IDENTITY'
        });
      }
    } else {
      const { validateIdentityForSession } = await import('./auth/index.js');
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

// Task Autonomy endpoints (require Founder for write)
app.post('/api/task-autonomy',
  authMiddleware,
  founderSignatureRateLimit,
  founderSignatureMiddleware(config.require_founder_signature_for),
  async (req, res) => {
    try {
      const { CreateTaskAutonomyLevelInputSchema } = await import('./council/types.js');
      const input = CreateTaskAutonomyLevelInputSchema.parse(req.body);
      const ctx = getAuthContext(req)!;

      if (ctx.owner_type !== 'founder') {
        return res.status(403).json({ error: 'Founder authorization required' });
      }

      const result = createTaskAutonomyLevel(db, ctx, input);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
);

app.get('/api/task-autonomy', authMiddleware, async (req, res) => {
  try {
    const levels = listTaskAutonomyLevels(db);
    res.json(levels);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch task autonomy levels' });
  }
});

// Register modular route handlers
app.use('/api/messages', messagesRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/council', councilRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/divisions', divisionsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/executions', executionsRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/deliverables', deliverablesRoutes);
app.use('/api/quality-thresholds', qualityRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/hermes', hermesBridgeRoutes);

// Import and register runtime routes
import runtimeRoutes from './api/routes/runtime.routes.js';
app.use('/api/runtime', runtimeRoutes);

// MCP endpoint - create new server+transport per request for stateless operation
// NOTE: OPTIONS preflight must be handled BEFORE auth middleware
app.options('/mcp', (req, res) => {
  res.status(200).json({ success: true });
});

app.all('/mcp', authMiddleware, async (req, res) => {
  // Runtime ownership check - enforce single active runtime at MCP boundary
  const authContext = getAuthContext(req);
  if (!authContext) {
    res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required to access MCP tools'
    });
    return;
  }

  const checkOwnership = createRuntimeOwnershipGuard(db);
  const ownershipResult = checkOwnership(authContext);

  if (!ownershipResult.allowed) {
    // Return MCP-formatted error for ownership violations
    const errorResponse = mcpOwnershipErrorResponse(ownershipResult);
    res.status(403).json(errorResponse);
    return;
  }

  // Attach ownership info for tools to use if needed
  (req as any).runtimeOwnership = ownershipResult;

  // Acquire execution permit for TOCTOU protection
  const executionGuard = createRuntimeExecutionGuard(db);
  const permitResult = await executionGuard.acquireExecutionPermit(authContext);

  if (!permitResult.success || !permitResult.context) {
    res.status(403).json({
      error: permitResult.error?.code || 'DATABASE_ERROR',
      message: permitResult.error?.message || 'Failed to acquire execution permit'
    });
    return;
  }

  const executionContext = permitResult.context;

  try {
    const requestTransport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const requestMcpServer = new McpServer({ name: 'council-bridge', version: '1.0.0' }, { capabilities: { tools: {} } });
    await requestMcpServer.connect(requestTransport);
    registerMcpTools(requestMcpServer, db, () => authContext);
    await requestTransport.handleRequest(req, res, req.body);

    // Release execution permit on success
    await executionGuard.releaseExecutionPermit(executionContext.executionId);
  } catch (error) {
    // Release execution permit on error
    await executionGuard.releaseExecutionPermit(executionContext.executionId);
    throw error;
  } finally {
    // Stop heartbeat renewal interval if it was started
    // For bootstrap sessions, no heartbeat is started, but we clean up anyway for safety
    if (executionContext.heartbeatInterval) {
      clearInterval(executionContext.heartbeatInterval);
    }
  }
});

// Global error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = parseInt(process.env.PORT || '3334', 10);

initDb().then(async () => {
  setDbInstance(db);

  // Register Founder as the canonical communication identity
  try {
    const { createAgentService } = await import('./communication/agents.js');
    const agentService = createAgentService(db);
    agentService.registerFounder();
    console.log('🔐 Founder agent registered in identity registry');
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      console.log('[init] Founder agent already registered');
    } else {
      console.log('[init] Founder registration:', e.message);
    }
  }

  // Start scheduled cleanup tasks
    startSessionCleanupInterval();

    // Start deterministic founder nonce cleanup
    startNonceCleanupInterval();

  const bindAddress = LOCAL_MODE ? LOCAL_BIND_ADDRESS : '0.0.0.0';
  app.listen(PORT, bindAddress, () => {
    console.log(`Server running on ${bindAddress}:${PORT} [${config.mode.toUpperCase()}${LOCAL_MODE ? ' + LOCAL' : ''}]`);
  });
});

// Graceful shutdown cleanup
process.on('SIGTERM', () => {
  stopNonceCleanupInterval();
  stopSessionCleanupInterval();
  if (db) db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  stopNonceCleanupInterval();
  stopSessionCleanupInterval();
  if (db) db.close();
  process.exit(0);
});

export default app;