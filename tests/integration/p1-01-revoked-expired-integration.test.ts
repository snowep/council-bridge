// P1-01: Integration tests for revoked/expired credential rejection
// Tests HTTP-level rejection of revoked and expired runtime credentials

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createDatabase, DatabaseInstance, setDatabaseInstance, closeDatabase } from '../../src/database.js';
import { generateRuntimeCredential, hashCredential, insertRuntimeCredential, revokeRuntimeCredential } from '../../src/auth/runtime-credentials.js';
import { mcpRuntimeAuthMiddleware } from '../../src/api/middleware/authentication.js';
import { validateAuthMode } from '../../src/auth/index.js';

describe('P1-01: Revoked and Expired Credentials - HTTP Integration', () => {
  let db: DatabaseInstance;
  let testApp: express.Express;
  let server: any;

  beforeEach(async () => {
    // Reset environment
    delete process.env.LOCAL_SINGLE_USER_MODE;
    delete process.env.LOCAL_SINGLE_USER_BIND_ADDRESS;
    process.env.AUTH_MODE = 'development';
    process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

    db = createDatabase(':memory:');
    setDatabaseInstance(db);

    testApp = express();
    testApp.use(express.json());

    const { mcpRuntimeAuthMiddleware } = await import('../../src/api/middleware/authentication.js');
    testApp.all('/mcp', mcpRuntimeAuthMiddleware, (req, res) => {
      res.json({ authenticated: true, authContext: requireAuthContext(req) });
    });

    server = testApp.listen(0);
  });

  afterEach(() => {
    server.close();
    try { closeDatabase(); } catch {}
  });

  function requireAuthContext(req: express.Request) {
    return (req as any).authContext || null;
  }

  describe('Rejected Credentials', () => {
    it('should reject expired claude credential via HTTP', async () => {
      const cred = generateRuntimeCredential('claude');
      const credId = 'expiring-cred';

      insertRuntimeCredential(db, {
        credentialId: credId,
        runtimeId: 'claude',
        tokenHash: hashCredential(cred.secret),
        createdAt: Date.now() - 100000,
        expiresAt: Date.now() - 1  // Expired
      });

      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${cred.secret}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', params: {}, id: 1 })
        .expect(401);

      assert.strictEqual(response.body.code, 'TOKEN_EXPIRED');
      assert.ok(response.body.error?.includes('expired') || response.body.error?.includes('Expired'));
    });

    it('should reject revoked claude credential via HTTP', async () => {
      const cred = generateRuntimeCredential('claude');
      const credId = 'revoked-cred';

      insertRuntimeCredential(db, {
        credentialId: credId,
        runtimeId: 'claude',
        tokenHash: hashCredential(cred.secret),
        createdAt: Date.now() - 10000,
        expiresAt: Date.now() + 86400000
      });

      revokeRuntimeCredential(db, credId);

      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${cred.secret}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', params: {}, id: 1 })
        .expect(401);

      assert.strictEqual(response.body.code, 'TOKEN_REVOKED');
      assert.ok(response.body.error?.includes('revoked') || response.body.error?.includes('Revoked'));
    });

    it('should reject expired hermes credential via HTTP', async () => {
      const cred = generateRuntimeCredential('hermes');

      insertRuntimeCredential(db, {
        credentialId: 'hermes-expired',
        runtimeId: 'hermes',
        tokenHash: hashCredential(cred.secret),
        createdAt: Date.now() - 100000,
        expiresAt: Date.now() - 1000  // Expired
      });

      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${cred.secret}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', params: {}, id: 1 })
        .expect(401);

      assert.strictEqual(response.body.code, 'TOKEN_EXPIRED');
    });

    it('should reject revoked hermes credential via HTTP', async () => {
      const cred = generateRuntimeCredential('hermes');
      const credId = 'hermes-revoked';

      insertRuntimeCredential(db, {
        credentialId: credId,
        runtimeId: 'hermes',
        tokenHash: hashCredential(cred.secret),
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000
      });

      revokeRuntimeCredential(db, credId);

      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${cred.secret}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', params: {}, id: 1 })
        .expect(401);

      assert.strictEqual(response.body.code, 'TOKEN_REVOKED');
    });
  });

  describe('Valid Credentials', () => {
    it('should accept valid claude credential via HTTP', async () => {
      const cred = generateRuntimeCredential('claude');

      insertRuntimeCredential(db, {
        credentialId: 'valid-claude-cred',
        runtimeId: 'claude',
        tokenHash: hashCredential(cred.secret),
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000
      });

      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${cred.secret}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', params: {}, id: 1 })
        .expect(200);

      assert.strictEqual(response.body.authenticated, true);
      assert.strictEqual(response.body.authContext.owner_type, 'runtime');
      assert.strictEqual(response.body.authContext.runtime, 'claude');
    });

    it('should accept valid hermes credential via HTTP', async () => {
      const cred = generateRuntimeCredential('hermes');

      insertRuntimeCredential(db, {
        credentialId: 'valid-hermes-cred',
        runtimeId: 'hermes',
        tokenHash: hashCredential(cred.secret),
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000
      });

      const response = await request(server)
        .post('/mcp')
        .set('Authorization', `Bearer ${cred.secret}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', params: {}, id: 1 })
        .expect(200);

      assert.strictEqual(response.body.authenticated, true);
      assert.strictEqual(response.body.authContext.runtime, 'hermes');
    });
  });

  describe('No fallback behavior', () => {
    it('should reject anonymous request for MCP endpoint', async () => {
      const response = await request(server)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', method: 'tools/list', params: {}, id: 1 })
        .expect(401);

      assert.strictEqual(response.body.code, 'AUTH_REQUIRED');
    });
  });
});