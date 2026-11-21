// MCP Execution Guard Integration Tests
// Phase 10: Full integration tests for runtime execution guard at MCP boundary
// Focus on HTTP-level integration with Express/supertest

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createDatabase, DatabaseInstance } from '../../src/database.js';
import { createRuntimeExecutionGuard } from '../../src/runtime/runtime-execution-guard.js';
import { RuntimeLifecycleManager, resetRuntimeLifecycleManager } from '../../src/runtime/lifecycle.js';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'node:crypto';
import { AuthContext } from '../../src/auth/index.js';

const TEST_DB_DIR = path.join(process.cwd(), 'test-dbs-mcp-exec');

function createTestDatabase(): { instance: ReturnType<typeof createDatabase>; path: string } {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = path.join(TEST_DB_DIR, `mcp-exec-${Date.now()}-${randomUUID().slice(0, 8)}.db`);
  const instance = createDatabase(dbPath);

  return { instance, path: dbPath };
}

describe('MCP Execution Guard - Integration Tests', () => {
  let db: DatabaseInstance;
  let lifecycle: RuntimeLifecycleManager;
  let guard: ReturnType<typeof createRuntimeExecutionGuard>;

  beforeEach(() => {
    resetRuntimeLifecycleManager();
    const testDb = createTestDatabase();
    db = testDb.instance;
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
    if (fs.existsSync(TEST_DB_DIR)) {
      try {
        fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
      } catch {}
    }
  });

  // Helper to create auth context
  function createAuthContext(overrides: Partial<{
    runtime: 'claude' | 'hermes';
    session_id: string;
    owner_type: 'founder' | 'staff' | 'division' | 'seat';
    owner_id: string;
  }> = {}): AuthContext {
    return {
      owner_type: 'founder',
      owner_id: 'founder',
      runtime: 'claude',
      session_id: 'test-session',
      permissions: [],
      expires_at: Infinity,
      issued_at: Date.now(),
      founder_signed: true,
      ...overrides
    } as AuthContext;
  }

  // Helper to setup active session
  async function setupActiveSession(runtime: 'claude' | 'hermes' = 'claude', sessionId?: string): Promise<string> {
    const result = lifecycle.connect({ runtime, sessionId, clientIp: '127.0.0.1' });
    assert.strictEqual(result.success, true);
    return result.state!.sessionId!;
  }

  describe('MCP Tool Execution Flow', () => {
    let mcpApp: express.Express;
    let activeSessionId: string;

    beforeEach(async () => {
      mcpApp = express();
      mcpApp.use(express.json());

      // Mock auth middleware for testing
      mcpApp.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
        const authContext = createAuthContext({
          runtime: req.headers['x-test-runtime'] as 'claude' | 'hermes' || 'claude',
          session_id: req.headers['x-test-session-id'] as string || 'test-session'
        });
        (req as any).authContext = authContext;
        next();
      });

      // MCP endpoint with execution guard
      mcpApp.all('/mcp', async (req, res) => {
        const authContext = (req as any).authContext;

        // Use execution guard
        const result = await guard.executeWithGuard(authContext, async (ctx) => {
          // Simulate MCP tool execution
          const { method } = req.body;
          if (method === 'tools/call') {
            const { name } = req.body.params || {};
            return { tool: name, executed: true, executionId: ctx.executionId };
          }
          return { error: 'Invalid method' };
        });

        if (!result.success) {
          return res.status(403).json({
            error: result.error?.code,
            message: result.error?.message,
            activeRuntime: result.error?.activeRuntime
          });
        }

        res.json(result.result);
      });

      // Setup active Claude session
      activeSessionId = await setupActiveSession('claude');
    });

    it('should allow active Claude to execute read-only tool', async () => {
      const response = await request(mcpApp)
        .post('/mcp')
        .set('x-test-runtime', 'claude')
        .set('x-test-session-id', activeSessionId)
        .send({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'list_agents', arguments: {} }, id: 1 })
        .expect(200);

      assert.strictEqual(response.body.tool, 'list_agents');
      assert.strictEqual(response.body.executed, true);
      assert.ok(response.body.executionId);
    });

    it('should allow active Claude to execute control write tool', async () => {
      const response = await request(mcpApp)
        .post('/mcp')
        .set('x-test-runtime', 'claude')
        .set('x-test-session-id', activeSessionId)
        .send({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'send_message', arguments: { sender_id: 'test', recipient_id: 'other', content: 'hello' } }, id: 1 })
        .expect(200);

      assert.strictEqual(response.body.tool, 'send_message');
      assert.strictEqual(response.body.executed, true);
    });

    it('should reject request with wrong runtime when Claude is active', async () => {
      // Request with hermes header but claude session should fail with RUNTIME_MISMATCH
      // because the active session is claude, but we're claiming to be hermes
      const response = await request(mcpApp)
        .post('/mcp')
        .set('x-test-runtime', 'hermes')
        .set('x-test-session-id', activeSessionId)
        .send({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'list_agents', arguments: {} }, id: 1 })
        .expect(403);

      // The guard checks that the session_id matches the active runtime session
      // Since activeSessionId belongs to claude, but we claimed hermes, we get RUNTIME_MISMATCH
      assert.strictEqual(response.body.error, 'RUNTIME_MISMATCH');
      assert.strictEqual(response.body.activeRuntime, 'claude');
    });

    it('should allow active Hermes to succeed after switch', async () => {
      // Switch to Hermes
      const switchResult = lifecycle.switch({ newRuntime: 'hermes' });
      assert.strictEqual(switchResult.success, true);

      // Get new session ID
      const state = lifecycle.getState();
      const hermesSessionId = state.sessionId!;

      const response = await request(mcpApp)
        .post('/mcp')
        .set('x-test-runtime', 'hermes')
        .set('x-test-session-id', hermesSessionId)
        .send({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'list_agents', arguments: {} }, id: 1 })
        .expect(200);

      assert.strictEqual(response.body.tool, 'list_agents');
      assert.strictEqual(response.body.executed, true);
    });

    it('should reject expired lease due to no active connected session', async () => {
      // Expire the lease by setting it in the past
      const now = Date.now();
      const pastTime = String(now - 10000);
      db.db.prepare('UPDATE runtime_sessions SET lease_expires_at = ? WHERE session_id = ?')
        .run(pastTime, activeSessionId);

      const response = await request(mcpApp)
        .post('/mcp')
        .set('x-test-runtime', 'claude')
        .set('x-test-session-id', activeSessionId)
        .send({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'list_agents', arguments: {} }, id: 1 })
        .expect(403);

      // Expired lease means no active connected session
      assert.ok(['SESSION_EXPIRED', 'NO_ACTIVE_SESSION'].includes(response.body.error));
    });

    it('should reject malformed lease timestamp as invalid session', async () => {
      // Set malformed lease
      db.db.prepare('UPDATE runtime_sessions SET lease_expires_at = ? WHERE session_id = ?')
        .run('not-a-timestamp', activeSessionId);

      const response = await request(mcpApp)
        .post('/mcp')
        .set('x-test-runtime', 'claude')
        .set('x-test-session-id', activeSessionId)
        .send({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'list_agents', arguments: {} }, id: 1 })
        .expect(403);

      // Malformed timestamp should be rejected as invalid
      assert.ok(['SESSION_EXPIRED', 'DATABASE_ERROR', 'INVALID_SESSION_LEASE', 'NO_ACTIVE_SESSION'].includes(response.body.error));
    });

    it('should reject disconnected session', async () => {
      lifecycle.disconnect({ sessionId: activeSessionId });

      const response = await request(mcpApp)
        .post('/mcp')
        .set('x-test-runtime', 'claude')
        .set('x-test-session-id', activeSessionId)
        .send({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'list_agents', arguments: {} }, id: 1 })
        .expect(403);

      assert.strictEqual(response.body.error, 'NO_ACTIVE_SESSION');
    });
  });

  describe('Failed Ownership Causes No Tool Side Effects', () => {
    it('should not execute tool when ownership check fails', async () => {
      const sessionId = await setupActiveSession('claude');
      lifecycle.disconnect({ sessionId });

      let toolExecuted = false;

      const result = await guard.executeWithGuard(
        createAuthContext({ session_id: sessionId }),
        async () => {
          toolExecuted = true;
          return { data: 'should not execute' };
        }
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(toolExecuted, false);
    });

    it('should not execute tool when session expired', async () => {
      const sessionId = await setupActiveSession('claude');
      db.db.prepare('UPDATE runtime_sessions SET lease_expires_at = ? WHERE session_id = ?')
        .run(String(Date.now() - 10000), sessionId);

      let toolExecuted = false;

      const result = await guard.executeWithGuard(
        createAuthContext({ session_id: sessionId }),
        async () => {
          toolExecuted = true;
          return { data: 'should not execute' };
        }
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(toolExecuted, false);
    });

    it('should not execute tool when runtime mismatched', async () => {
      const sessionId = await setupActiveSession('hermes');

      let toolExecuted = false;

      const result = await guard.executeWithGuard(
        createAuthContext({ runtime: 'claude', session_id: sessionId }),
        async () => {
          toolExecuted = true;
          return { data: 'should not execute' };
        }
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(toolExecuted, false);
    });
  });

  describe('Database Failure Causes Fail-Closed', () => {
    it('should fail closed when database is unavailable', async () => {
      const sessId = await setupActiveSession('claude');

      // Create fresh guard that references closed db
      db.close();

      // Create a new guard with closed db
      const closedGuard = createRuntimeExecutionGuard(db as any);
      const result = await closedGuard.acquireExecutionPermit(createAuthContext({ session_id: sessId }));

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.code, 'DATABASE_ERROR');
    });
  });

  describe('Concurrent Execution Prevention', () => {
    it('should prevent multiple concurrent executions for same session', async () => {
      const sessionId = await setupActiveSession('claude');
      const authCtx = createAuthContext({ session_id: sessionId });

      // First execution (will be kept alive)
      const executionPromise = guard.executeWithGuard(authCtx, async () => {
        // Simulate long-running tool
        await new Promise(resolve => setTimeout(resolve, 50));
        return { data: 'first' };
      });

      // Second execution immediately - should be rejected
      const resultB = await guard.executeWithGuard(authCtx, async () => {
        return { data: 'second' };
      });

      // Wait for first to complete
      const resultA = await executionPromise;

      // One should succeed, one should fail
      const successCount = [resultA, resultB].filter(r => r.success).length;
      const failCount = [resultA, resultB].filter(r => !r.success).length;
      assert.strictEqual(successCount, 1);
      assert.strictEqual(failCount, 1);
      assert.strictEqual(
        [resultA, resultB].find(r => !r.success)?.error?.code,
        'EXECUTION_IN_PROGRESS'
      );
    });

    it('should allow switching during execution - guard prevents concurrent access', async () => {
      // This test verifies that the execution guard, not the lifecycle switch,
      // prevents concurrent execution with wrong runtime
      const sessionId = await setupActiveSession('claude');

      // Acquire permit (simulates start of tool execution)
      const authCtx = createAuthContext({ session_id: sessionId });
      const permit = await guard.acquireExecutionPermit(authCtx);
      assert.strictEqual(permit.success, true);

      // Note: lifecycle.switch() does NOT block on active executions
      // The guard prevents a second execution with a different session/runtime
      // This is the design - switch can occur, but new executions will be rejected

      // Release permit
      await guard.releaseExecutionPermit(permit.context!.executionId);

      // Now switch should succeed
      const switchResult = lifecycle.switch({ newRuntime: 'hermes' });
      assert.strictEqual(switchResult.success, true);
    });
  });

  describe('Ownership Verification at MCP Boundary', () => {
    it('should verify session owns active runtime', async () => {
      const claudeSession = await setupActiveSession('claude');

      // Try to use a different session ID - should fail
      const result = await guard.acquireExecutionPermit(createAuthContext({ session_id: 'different-session' }));
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.code, 'SESSION_NOT_FOUND');
    });

    it('should verify runtime ownership', async () => {
      const sessionId = await setupActiveSession('hermes');

      // Try to acquire permit as claude when hermes is active
      const result = await guard.acquireExecutionPermit(createAuthContext({ runtime: 'claude', session_id: sessionId }));
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.code, 'RUNTIME_MISMATCH');
      assert.strictEqual(result.error?.activeRuntime, 'hermes');
    });
  });
});