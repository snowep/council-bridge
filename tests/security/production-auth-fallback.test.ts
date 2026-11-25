// Production Auth Fallback Regression Tests
// SEC-03: Fix production authentication fallback in authMiddleware
// Tests for SEC-03 requirements:
// 1. Never allow hardcoded development Founder fallback when NODE_ENV=production
// 2. Keep production authentication fail-closed
// 3. Preserve legitimate local single-user mode (LOCAL_SINGLE_USER_MODE)
// 4. Reject invalid environment combinations
// 5. Add regression tests covering development, test, and production configurations

import { describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import { getAuthConfig, validateAuthMode, authMiddleware, getAuthContext } from '../../src/auth/index.js';
import { generateSessionToken, validateSessionToken } from '../../src/auth/session.js';

// Mock MCP transport handler
const mockMcpHandler = async (req: express.Request, res: express.Response) => {
  const ctx = getAuthContext(req);
  if (!ctx) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({
    authenticated: true,
    owner_type: ctx.owner_type,
    owner_id: ctx.owner_id,
    session_id: ctx.session_id
  });
};

// Helper to create fresh app for each test scenario
function createTestApp(middleware: any) {
  const app = express();
  app.use(express.json());
  app.all('/mcp', middleware, mockMcpHandler);
  return app;
}

describe('SEC-03: Production Auth Fallback Regression Tests', () => {
  describe('Production Mode Authentication', () => {
    it('should fail closed in production with no fallback', async () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      const { authMiddleware: middleware1 } = await import('../../src/auth/index.js');
      const app = createTestApp(middleware1);

      const response = await request(app)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 })
        .expect(401);

      assert.strictEqual(response.body.code, 'AUTH_REQUIRED');
      assert.ok(response.body.error.includes('Authentication required'));
    });

    it('should reject invalid token with 401 in production', async () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      const { authMiddleware: middleware1 } = await import('../../src/auth/index.js');
      const app = createTestApp(middleware1);

      const response = await request(app)
        .post('/mcp')
        .set('Authorization', 'Bearer invalid-token')
        .send({ jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 })
        .expect(401);

      assert.strictEqual(response.body.code, 'INVALID_SESSION');
    });

    it('should reject hardcoded fallback in production mode', async () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      const { authMiddleware: middleware1 } = await import('../../src/auth/index.js');
      const config = getAuthConfig();
      assert.strictEqual(config.allow_hardcoded_fallback, false);

      const app = createTestApp(middleware1);

      // Try to bypass auth - should still fail
      const response = await request(app)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 })
        .expect(401);

      assert.strictEqual(response.body.code, 'AUTH_REQUIRED');
    });
  });

  describe('Development Mode Authentication', () => {
    it('should fail without auth in development mode (fallback disabled)', async () => {
      process.env.AUTH_MODE = 'development';
      process.env.SESSION_SECRET = 'test-secret-key-for-dev-mode-testing';

      const { authMiddleware: middleware1 } = await import('../../src/auth/index.js');
      const app = createTestApp(middleware1);

      // In development mode, allow_hardcoded_fallback is false by default (secure default)
      // Requests without auth should be rejected
      const response = await request(app)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 })
        .expect(401);

      assert.strictEqual(response.body.code, 'AUTH_REQUIRED');
    });

    it('should allow hardcoded fallback when explicitly enabled via ALLOW_HARDCODED_FALLBACK', async () => {
      process.env.AUTH_MODE = 'development';
      process.env.SESSION_SECRET = 'test-secret-key-for-dev-mode-testing';
      process.env.ALLOW_HARDCODED_FALLBACK = 'true';

      const { authMiddleware: middleware1 } = await import('../../src/auth/index.js');
      const app = createTestApp(middleware1);

      // In development mode with ALLOW_HARDCODED_FALLBACK=true,
      // requests without auth should be allowed (explicit opt-in)
      const response = await request(app)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 })
        .expect(200);

      assert.strictEqual(response.body.authenticated, true);
      assert.strictEqual(response.body.owner_type, 'founder');
      assert.strictEqual(response.body.owner_id, 'founder');
    });
  });

  describe('Local Single-User Mode', () => {
    it('should allow local single-user mode in development', async () => {
      process.env.AUTH_MODE = 'development';
      process.env.LOCAL_SINGLE_USER_MODE = 'true';
      process.env.SESSION_SECRET = 'test-secret-key-for-local-single-user-mode';

      const { authMiddleware: middleware1 } = await import('../../src/auth/index.js');
      const app = createTestApp(middleware1);

      const response = await request(app)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 })
        .expect(200);

      assert.strictEqual(response.body.authenticated, true);
      assert.strictEqual(response.body.owner_type, 'founder');
      assert.strictEqual(response.body.owner_id, 'founder');
    });

    it('should reject local single-user mode in production', async () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';
      process.env.LOCAL_SINGLE_USER_MODE = 'true';

      const { authMiddleware: middleware1 } = await import('../../src/auth/index.js');
      const app = createTestApp(middleware1);

      // Local single-user mode should not work in production
      const response = await request(app)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 })
        .expect(401);

      assert.strictEqual(response.body.code, 'LOCAL_MODE_PROHIBITED_IN_PRODUCTION');
    });

    it('should authenticate with valid token in local mode', async () => {
      process.env.AUTH_MODE = 'development';
      process.env.LOCAL_SINGLE_USER_MODE = 'true';
      process.env.SESSION_SECRET = 'test-secret-key-for-local-single-user-mode';

      const { authMiddleware: middleware1 } = await import('../../src/auth/index.js');
      const app = createTestApp(middleware1);

      const token = generateSessionToken({
        owner_type: 'founder',
        owner_id: 'founder',
        runtime: 'claude'
      });

      const response = await request(app)
        .post('/mcp')
        .set('Authorization', `Bearer ${token}`)
        .send({ jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 })
        .expect(200);

      assert.strictEqual(response.body.authenticated, true);
      assert.strictEqual(response.body.owner_type, 'founder');
    });
  });

  describe('Environment Validation', () => {
    it('should validate auth mode in development', () => {
      process.env.AUTH_MODE = 'development';
      const result = validateAuthMode();
      assert.ok(result.valid);
    });

    it('should validate auth mode in production with proper config', () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      const result = validateAuthMode();
      assert.ok(result.valid);

      delete process.env.SESSION_SECRET;
      process.env.AUTH_MODE = 'development';
    });
  });

  describe('Token Management', () => {
    it('should accept valid token signature when using correct session secret', async () => {
      // This test verifies that tokens generated with the session secret
      // are accepted by the validation function
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      const token1 = generateSessionToken({
        owner_type: 'staff',
        owner_id: 'staff-001',
        runtime: 'claude'
      });

      const session = validateSessionToken(token1);
      assert.ok(session);
      assert.strictEqual(session.owner_type, 'staff');
      assert.strictEqual(session.owner_id, 'staff-001');
    });
  });

  describe('Production Config Security', () => {
    it('should have allow_hardcoded_fallback forced to false in production config', () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      const config = getAuthConfig();
      assert.strictEqual(config.allow_hardcoded_fallback, false, 'allow_hardcoded_fallback must be false in production');

      delete process.env.SESSION_SECRET;
      process.env.AUTH_MODE = 'development';
    });
  });
});