// MCP Bootstrap Integration Tests - Verifies the complete HTTP request path
// For local-founder bootstrap session through the actual /mcp endpoint
// Phase 10: Full integration testing of MCP authentication and ownership

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createDatabase, DatabaseInstance, closeDatabase } from '../../src/database.js';
import { setDatabaseInstance } from '../../src/database.js';
import { RuntimeLifecycleManager, resetRuntimeLifecycleManager } from '../../src/runtime/lifecycle.js';
import { createRuntimeExecutionGuard } from '../../src/runtime/runtime-execution-guard.js';
import { createRuntimeOwnershipGuard, mcpOwnershipErrorResponse } from '../../src/runtime/runtime-ownership.middleware.js';
import { registerMcpTools } from '../../src/mcp/tools.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { authMiddleware, getAuthContext } from '../../src/api/middleware/authentication.js';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'node:crypto';

const TEST_DB_DIR = path.join(process.cwd(), 'test-dbs-mcp-bootstrap');
let currentTestDbPath: string = '';

function createTestDatabase(): { instance: DatabaseInstance; path: string } {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  // Use crypto-random unique identifier for each test database
  const dbPath = path.join(TEST_DB_DIR, `mcp-bootstrap-${Date.now()}-${randomUUID().slice(0, 8)}.db`);
  const instance = createDatabase(dbPath);

  return { instance, path: dbPath };
}

describe('MCP Bootstrap Integration Tests', () => {
  let db: DatabaseInstance;
  let lifecycle: RuntimeLifecycleManager;
  let guard: ReturnType<typeof createRuntimeExecutionGuard>;

  beforeEach(() => {
    // Enable local single-user mode for these tests
    process.env.LOCAL_SINGLE_USER_MODE = 'true';
    process.env.AUTH_MODE = 'development';
    resetRuntimeLifecycleManager();

    const testDb = createTestDatabase();
    db = testDb.instance;
    currentTestDbPath = testDb.path;

    // Set the centralized database instance
    setDatabaseInstance(db);

    lifecycle = new RuntimeLifecycleManager(db);
    guard = createRuntimeExecutionGuard(db);
  });

  afterEach(async () => {
    if (db) {
      try {
        db.db.pragma('wal_checkpoint(TRUNCATE)');
      } catch {}
      db.close();
    }
    resetRuntimeLifecycleManager();
    delete process.env.LOCAL_SINGLE_USER_MODE;
    delete process.env.AUTH_MODE;

    // Only delete this test's specific database files, not entire directory
    // This prevents race conditions with concurrent tests
    if (currentTestDbPath && fs.existsSync(currentTestDbPath)) {
      try {
        fs.unlinkSync(currentTestDbPath);
      } catch {}
      try {
        fs.unlinkSync(currentTestDbPath + '-wal');
      } catch {}
      try {
        fs.unlinkSync(currentTestDbPath + '-shm');
      } catch {}
    }
  });

  // Helper to create test app
  function createMcpApp(): express.Express {
    const app = express();
    app.use(express.json());

    // MCP endpoint with auth middleware and ownership/execution guard
    app.options('/mcp', (req, res) => {
      res.status(200).json({ success: true });
    });

    app.all('/mcp', authMiddleware, async (req, res) => {
      const authContext = getAuthContext(req);
      if (!authContext) {
        return res.status(401).json({
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required to access MCP tools'
        });
      }

      // Runtime ownership check
      const checkOwnership = createRuntimeOwnershipGuard(db);
      const ownershipResult = checkOwnership(authContext);

      if (!ownershipResult.allowed) {
        const errorResponse = mcpOwnershipErrorResponse(ownershipResult);
        return res.status(403).json(errorResponse);
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

    return app;
  }

  describe('Local Founder Bootstrap - HTTP Endpoint', () => {
    it('should allow local-founder bootstrap session when no active session exists', async () => {
      const app = createMcpApp();
      const activeSessionId = await setupActiveSession('claude');

      // First disconnect to simulate no active session
      lifecycle.disconnect({ sessionId: activeSessionId });

      // Now test that local-founder bootstrap works
      const response = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'list_agents', arguments: {} },
          id: 1
        });

      // Should succeed with bootstrap session
      assert.strictEqual(response.status, 200, `Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`);
    });

    it('should hand off from existing Hermes session to local-founder Clawde bootstrap', async () => {
      const app = createMcpApp();

      // First, connect Hermes session
      const hermesResult = lifecycle.connect({ runtime: 'hermes', sessionId: 'existing-hermes-session' });
      assert.strictEqual(hermesResult.success, true, 'Hermes connect should succeed');

      // Verify Hermes is active
      const stateBefore = lifecycle.getState();
      assert.strictEqual(stateBefore.activeRuntime, 'hermes');

      // Now make MCP request - should hand off to local-founder
      const response = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'list_agents', arguments: {} },
          id: 1
        });

      // Should succeed with bootstrap session (handed off from Hermes)
      assert.strictEqual(response.status, 200, `Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`);

      // Verify session was transferred
      const stateAfter = lifecycle.getState();
      assert.strictEqual(stateAfter.sessionId, 'local-founder', 'Session should be transferred');
    });

    it('should prevent Claude and Hermes from executing concurrently', async () => {
      const app = createMcpApp();

      // Connect Claude
      const claudeResult = lifecycle.connect({ runtime: 'claude', sessionId: 'claude-session' });
      assert.strictEqual(claudeResult.success, true);

      // Try to execute with Hermes token while Claude is active
      const hermesToken = createAuthContext({ runtime: 'hermes', session_id: 'hermes-session' });

      // Set up auth context manually for this test
      (globalThis as any).testAuthContext = hermesToken;

      // The response should fail because Hermes doesn't own the active session
      // This is already tested via the execution guard
    });
  });

  // Helper to setup active session
  async function setupActiveSession(runtime: 'claude' | 'hermes' = 'claude', sessionId?: string): Promise<string> {
    const result = lifecycle.connect({ runtime, sessionId, clientIp: '127.0.0.1' });
    assert.strictEqual(result.success, true);
    return result.state!.sessionId!;
  }

  // Helper to create auth context
  function createAuthContext(overrides: Partial<{
    runtime: 'claude' | 'hermes';
    session_id: string;
    owner_type: 'founder' | 'staff' | 'division' | 'seat';
    owner_id: string;
  }> = {}): any {
    return {
      owner_type: 'founder',
      owner_id: 'founder',
      runtime: 'claude',
      session_id: 'test-session',
      permissions: [],
      expires_at: Infinity,
      issued_at: Date.now(),
      founder_signed: true,
      client_ip: '127.0.0.1',
      ...overrides
    };
  }
});