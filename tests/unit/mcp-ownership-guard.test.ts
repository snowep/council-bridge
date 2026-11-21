// MCP Runtime Ownership Guard Tests - Phase 10
// Tests that MCP tools are blocked for inactive runtimes

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import { createDatabase, DatabaseInstance } from '../../src/database.js';
import { getAuthContext } from '../../src/auth/index.js';
import { createRuntimeOwnershipGuard, mcpOwnershipErrorResponse } from '../../src/runtime/runtime-ownership.middleware.js';

let db: DatabaseInstance;
let app: express.Express;

describe('MCP Runtime Ownership Guard - Phase 10', () => {
  before(() => {
    db = createDatabase(':memory:');

    app = express();
    app.use(express.json());
  });

  after(() => {
    db.close();
  });

  beforeEach(() => {
    // Reset test database
    db.db.exec('DELETE FROM runtime_sessions');
  });

  describe('Ownership Guard Middleware', () => {
    it('should reject request with missing session ID', async () => {
      const guard = createRuntimeOwnershipGuard(db);
      const authContext = {
        owner_type: 'founder' as const,
        owner_id: 'founder',
        runtime: 'claude' as const,
        session_id: '',
        permissions: [],
        expires_at: Infinity,
        issued_at: Date.now(),
        founder_signed: true
      };

      const result = guard(authContext);
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.errorCode, 'SESSION_ID_REQUIRED');
    });

    it('should reject request when no active session exists', async () => {
      const guard = createRuntimeOwnershipGuard(db);
      const authContext = {
        owner_type: 'founder' as const,
        owner_id: 'founder',
        runtime: 'claude' as const,
        session_id: 'some-session-id',
        permissions: [],
        expires_at: Infinity,
        issued_at: Date.now(),
        founder_signed: true
      };

      const result = guard(authContext);
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.errorCode, 'NO_ACTIVE_SESSION');
    });

    it('should reject request when session is not connected (no active session)', async () => {
      // Create a disconnected session
      db.db.prepare(`
        INSERT INTO runtime_sessions (runtime, session_id, connection_status, connected_at, lease_expires_at, created_at, updated_at)
        VALUES ('claude', 'session-1', 'disconnected', null, null, datetime('now'), datetime('now'))
      `).run();

      const guard = createRuntimeOwnershipGuard(db);
      const authContext = {
        owner_type: 'founder' as const,
        owner_id: 'founder',
        runtime: 'claude' as const,
        session_id: 'session-1',
        permissions: [],
        expires_at: Infinity,
        issued_at: Date.now(),
        founder_signed: true
      };

      const result = guard(authContext);
      assert.strictEqual(result.allowed, false);
      // A disconnected session means no active session exists
      assert.strictEqual(result.errorCode, 'NO_ACTIVE_SESSION');
    });

    it('should reject request when lease has expired', async () => {
      const pastTime = String(Date.now() - 10000);
      db.db.prepare(`
        INSERT INTO runtime_sessions (runtime, session_id, connection_status, connected_at, lease_expires_at, created_at, updated_at)
        VALUES ('claude', 'session-1', 'connected', '1732123456789', ?, datetime('now'), datetime('now'))
      `).run(pastTime);

      const guard = createRuntimeOwnershipGuard(db);
      const authContext = {
        owner_type: 'founder' as const,
        owner_id: 'founder',
        runtime: 'claude' as const,
        session_id: 'session-1',
        permissions: [],
        expires_at: Infinity,
        issued_at: Date.now(),
        founder_signed: true
      };

      const result = guard(authContext);
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.errorCode, 'SESSION_EXPIRED');
    });

    it('should reject request when session ID does not match active session', async () => {
      const futureTime = String(Date.now() + 600000);
      db.db.prepare(`
        INSERT INTO runtime_sessions (runtime, session_id, connection_status, connected_at, lease_expires_at, created_at, updated_at)
        VALUES ('claude', 'session-active', 'connected', '1732123456789', ?, datetime('now'), datetime('now'))
      `).run(futureTime);

      const guard = createRuntimeOwnershipGuard(db);
      const authContext = {
        owner_type: 'founder' as const,
        owner_id: 'founder',
        runtime: 'claude' as const,
        session_id: 'session-different',
        permissions: [],
        expires_at: Infinity,
        issued_at: Date.now(),
        founder_signed: true
      };

      const result = guard(authContext);
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.errorCode, 'RUNTIME_NOT_ACTIVE');
      assert.strictEqual(result.activeRuntime, 'claude');
    });

    it('should reject request when runtime does not match active runtime', async () => {
      const futureTime = String(Date.now() + 600000);
      db.db.prepare(`
        INSERT INTO runtime_sessions (runtime, session_id, connection_status, connected_at, lease_expires_at, created_at, updated_at)
        VALUES ('hermes', 'session-active', 'connected', '1732123456789', ?, datetime('now'), datetime('now'))
      `).run(futureTime);

      const guard = createRuntimeOwnershipGuard(db);
      const authContext = {
        owner_type: 'founder' as const,
        owner_id: 'founder',
        runtime: 'claude' as const,  // Requesting as claude but hermes is active
        session_id: 'session-active',
        permissions: [],
        expires_at: Infinity,
        issued_at: Date.now(),
        founder_signed: true
      };

      const result = guard(authContext);
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.errorCode, 'RUNTIME_MISMATCH');
    });

    it('should allow request when session owns active runtime', async () => {
      const futureTime = String(Date.now() + 600000);
      db.db.prepare(`
        INSERT INTO runtime_sessions (runtime, session_id, connection_status, connected_at, lease_expires_at, created_at, updated_at)
        VALUES ('claude', 'session-active', 'connected', '1732123456789', ?, datetime('now'), datetime('now'))
      `).run(futureTime);

      const guard = createRuntimeOwnershipGuard(db);
      const authContext = {
        owner_type: 'founder' as const,
        owner_id: 'founder',
        runtime: 'claude' as const,
        session_id: 'session-active',
        permissions: [],
        expires_at: Infinity,
        issued_at: Date.now(),
        founder_signed: true
      };

      const result = guard(authContext);
      assert.strictEqual(result.allowed, true);
      assert.strictEqual(result.activeRuntime, 'claude');
      assert.strictEqual(result.activeSessionId, 'session-active');
    });
  });

  describe('MCP Error Response Format', () => {
    it('should return proper MCP error format for ownership violation', () => {
      const result = {
        allowed: false,
        reason: 'This runtime does not own the active Council Bridge session.',
        activeRuntime: 'claude' as const,
        errorCode: 'RUNTIME_NOT_ACTIVE'
      };

      const errorResponse = mcpOwnershipErrorResponse(result);

      assert.strictEqual(errorResponse.error, 'RUNTIME_NOT_ACTIVE');
      assert.strictEqual(errorResponse.message, 'This runtime does not own the active Council Bridge session.');
      assert.strictEqual(errorResponse.activeRuntime, 'claude');
    });

    it('should return error without activeRuntime when not provided', () => {
      const result = {
        allowed: false,
        reason: 'No active runtime session',
        errorCode: 'NO_ACTIVE_SESSION'
      };

      const errorResponse = mcpOwnershipErrorResponse(result);

      assert.strictEqual(errorResponse.error, 'NO_ACTIVE_SESSION');
      assert.strictEqual(errorResponse.message, 'No active runtime session');
      assert.strictEqual(errorResponse.activeRuntime, undefined);
    });
  });

  describe('Full MCP Request Flow with Ownership Guard', () => {
    let mcpApp: express.Express;

    before(() => {
      mcpApp = express();
      mcpApp.use(express.json());

      // Apply auth middleware (mock - auto-auth as founder for testing)
      mcpApp.use((req, res, next) => {
        const authContext = {
          owner_type: 'founder' as const,
          owner_id: 'founder',
          runtime: 'claude' as const,
          session_id: req.headers['x-test-session-id'] as string || 'test-session',
          permissions: [],
          expires_at: Infinity,
          issued_at: Date.now(),
          founder_signed: true
        };
        (req as any).authContext = authContext;
        (req as any).auth = authContext;
        next();
      });

      // Apply ownership guard
      mcpApp.all('/mcp', async (req, res) => {
        const authContext = getAuthContext(req);
        if (!authContext) {
          return res.status(401).json({
            error: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required to access MCP tools'
          });
        }

        const checkOwnership = createRuntimeOwnershipGuard(db);
        const ownershipResult = checkOwnership(authContext);

        if (!ownershipResult.allowed) {
          const errorResponse = mcpOwnershipErrorResponse(ownershipResult);
          return res.status(403).json(errorResponse);
        }

        // Simulate MCP tool execution
        res.json({
          success: true,
          message: 'MCP tool executed',
          activeRuntime: ownershipResult.activeRuntime
        });
      });
    });

    it('should allow MCP request when runtime owns active session', async () => {
      const futureTime = String(Date.now() + 600000);
      db.db.prepare(`
        INSERT INTO runtime_sessions (runtime, session_id, connection_status, connected_at, lease_expires_at, created_at, updated_at)
        VALUES ('claude', 'test-session', 'connected', '1732123456789', ?, datetime('now'), datetime('now'))
      `).run(futureTime);

      const response = await request(mcpApp)
        .post('/mcp')
        .set('x-test-session-id', 'test-session')
        .send({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'test', arguments: {} }, id: 1 })
        .expect(200);

      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.activeRuntime, 'claude');
    });

    it('should reject MCP request when different runtime is active', async () => {
      const futureTime = String(Date.now() + 600000);
      db.db.prepare(`
        INSERT INTO runtime_sessions (runtime, session_id, connection_status, connected_at, lease_expires_at, created_at, updated_at)
        VALUES ('hermes', 'hermes-session', 'connected', '1732123456789', ?, datetime('now'), datetime('now'))
      `).run(futureTime);

      const response = await request(mcpApp)
        .post('/mcp')
        .set('x-test-session-id', 'test-session')  // Different session ID
        .send({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'test', arguments: {} }, id: 1 })
        .expect(403);

      assert.strictEqual(response.body.error, 'RUNTIME_NOT_ACTIVE');
      assert.strictEqual(response.body.activeRuntime, 'hermes');
    });

    it('should reject MCP request when session is disconnected (no active session)', async () => {
      db.db.prepare(`
        INSERT INTO runtime_sessions (runtime, session_id, connection_status, connected_at, lease_expires_at, created_at, updated_at)
        VALUES ('claude', 'test-session', 'disconnected', '1732123456789', null, datetime('now'), datetime('now'))
      `).run();

      const response = await request(mcpApp)
        .post('/mcp')
        .set('x-test-session-id', 'test-session')
        .send({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'test', arguments: {} }, id: 1 })
        .expect(403);

      assert.strictEqual(response.body.error, 'NO_ACTIVE_SESSION');
    });
  });

  describe('Ownership Check Before MCP Tool Execution', () => {
    it('should block MCP tool execution for inactive runtime via ownership check', async () => {
      // Set up active Hermes session
      const futureTime = String(Date.now() + 600000);
      db.db.prepare(`
        INSERT INTO runtime_sessions (runtime, session_id, connection_status, connected_at, lease_expires_at, created_at, updated_at)
        VALUES ('hermes', 'hermes-session', 'connected', '1732123456789', ?, datetime('now'), datetime('now'))
      `).run(futureTime);

      // Create request with Claude session (but Hermes is active)
      const authContext = {
        owner_type: 'founder' as const,
        owner_id: 'founder',
        runtime: 'claude' as const,
        session_id: 'claude-session',
        permissions: [],
        expires_at: Infinity,
        issued_at: Date.now(),
        founder_signed: true
      };

      // The ownership check should happen BEFORE tool registration/execution
      const checkOwnership = createRuntimeOwnershipGuard(db);
      const ownershipResult = checkOwnership(authContext);

      assert.strictEqual(ownershipResult.allowed, false);
      assert.strictEqual(ownershipResult.errorCode, 'RUNTIME_NOT_ACTIVE');
      assert.strictEqual(ownershipResult.activeRuntime, 'hermes');
    });

    it('should allow MCP tool execution for active runtime via ownership check', async () => {
      // Set up active Claude session
      const futureTime = String(Date.now() + 600000);
      db.db.prepare(`
        INSERT INTO runtime_sessions (runtime, session_id, connection_status, connected_at, lease_expires_at, created_at, updated_at)
        VALUES ('claude', 'claude-session', 'connected', '1732123456789', ?, datetime('now'), datetime('now'))
      `).run(futureTime);

      const authContext = {
        owner_type: 'founder' as const,
        owner_id: 'founder',
        runtime: 'claude' as const,
        session_id: 'claude-session',
        permissions: [],
        expires_at: Infinity,
        issued_at: Date.now(),
        founder_signed: true
      };

      const checkOwnership = createRuntimeOwnershipGuard(db);
      const ownershipResult = checkOwnership(authContext);

      assert.strictEqual(ownershipResult.allowed, true);
      assert.strictEqual(ownershipResult.activeRuntime, 'claude');
    });
  });
});