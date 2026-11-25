// P1-01: Anonymous Identity Session Provisioning Tests
// Security requirement: Anonymous requests must NOT be able to create sessions
// for any identity (Founder, Staff, Division, or Seat)

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createDatabase, DatabaseInstance, closeDatabase, setDatabaseInstance } from '../../src/database.js';
import { initializeFounderKeys } from '../../src/auth/founder.js';
import { validateFounderOperation, verifyFounderOperation } from '../../src/auth/founder.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

let db: DatabaseInstance;
let keysDir: string;

describe('P1-01: Anonymous Identity Session Provisioning', () => {
  before(async () => {
    // Create test database
    db = createDatabase(':memory:');
    setDatabaseInstance(db);

    // Register test agents
    const agentService = (await import('../../src/communication/agents.js')).createAgentService(db);
    agentService.registerAgent({ agent_id: 'staff-001', display_name: 'Staff Agent', runtime: 'claude' });
    agentService.registerAgent({ agent_id: 'founder', display_name: 'Founder', runtime: 'claude' });

    // Initialize founder keys for production mode tests
    keysDir = fs.mkdtempSync(path.join(os.tmpdir(), 'council-test-keys-'));
    process.env.FOUNDER_KEYS_DIR = keysDir;
    process.env.FOUNDER_KEY_PATH = path.join(keysDir, 'founder-keys.json');
    initializeFounderKeys();
  });

  after(() => {
    closeDatabase();
    if (keysDir && fs.existsSync(keysDir)) {
      fs.rmSync(keysDir, { recursive: true, force: true });
    }
    delete process.env.FOUNDER_KEYS_DIR;
    delete process.env.FOUNDER_KEY_PATH;
  });

  beforeEach(() => {
    // Reset environment for each test
    delete process.env.AUTH_MODE;
    delete process.env.SESSION_SECRET;
    delete process.env.LOCAL_SINGLE_USER_MODE;
    delete process.env.LOCAL_SINGLE_USER_BIND_ADDRESS;
  });

  describe('Founder signature validation for session creation', () => {
    it('should reject anonymous Founder session creation in production mode (no signature)', async () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      // In production mode, Founder session creation requires a valid founder signature
      // An anonymous request would have no signature, which should fail verification
      const result = verifyFounderOperation(
        'create_session',
        { owner_type: 'founder', owner_id: 'founder', runtime: 'claude' },
        '', // empty signature
        Date.now(),
        'test-nonce',
        'test-key-id'
      );

      assert.strictEqual(result.valid, false, 'Empty founder signature should be rejected');
      assert.ok(result.error !== undefined, 'Error should be returned for missing signature');
    });

    it('should reject Founder session creation with invalid signature in production mode', async () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      const result = verifyFounderOperation(
        'create_session',
        { owner_type: 'founder', owner_id: 'founder', runtime: 'claude' },
        'invalid-signature', // invalid signature
        Date.now(),
        'test-nonce',
        'test-key-id'
      );

      assert.strictEqual(result.valid, false, 'Invalid founder signature should be rejected');
      assert.ok(result.error !== undefined, 'Error should be returned for invalid signature');
    });

    it('should accept valid Founder signature for session creation', async () => {
      // Use the actual key pair to sign a valid request
      const { generateFounderKeyPair, signFounderRequest } = await import('../../src/auth/founder.js');
      const keyPair = generateFounderKeyPair();

      const signedRequest = signFounderRequest(
        'create_session',
        { owner_type: 'founder', owner_id: 'founder', runtime: 'claude' },
        keyPair.private_key_pem,
        keyPair.key_id
      );

      const result = verifyFounderOperation(
        'create_session',
        signedRequest.payload,
        signedRequest.signature,
        signedRequest.timestamp,
        signedRequest.nonce,
        signedRequest.key_id
      );

      assert.strictEqual(result.valid, true, 'Valid founder signature should be accepted');
    });
  });

  describe('Identity validation for session creation', () => {
    it('should reject session creation for non-existent Staff identity', async () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      const { validateIdentityForSession } = await import('../../src/auth/index.js');

      const isValid = await validateIdentityForSession(db, 'staff', 'non-existent-staff', 'claude');

      assert.strictEqual(isValid, false, 'Non-existent staff identity should be rejected');
    });

    it('should reject session creation for non-existent Division identity', async () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      const { validateIdentityForSession } = await import('../../src/auth/index.js');

      const isValid = await validateIdentityForSession(db, 'division', 'non-existent-division', 'claude');

      assert.strictEqual(isValid, false, 'Non-existent division identity should be rejected');
    });

    it('should reject session creation for non-existent Seat identity', async () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      const { validateIdentityForSession } = await import('../../src/auth/index.js');

      const isValid = await validateIdentityForSession(db, 'seat', 'non-existent-seat', 'claude');

      assert.strictEqual(isValid, false, 'Non-existent seat identity should be rejected');
    });

    it('should validate founder identity for session creation', async () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      const { validateIdentityForSession } = await import('../../src/auth/index.js');

      const isValid = await validateIdentityForSession(db, 'founder', 'founder', 'claude');

      assert.strictEqual(isValid, true, 'Founder identity should be valid');
    });

    it('should validate staff identity that exists and is active', async () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      const { validateIdentityForSession } = await import('../../src/auth/index.js');

      // Add a division first (required for staff FK)
      db.stmt.insertDivision.run('div-test-2', 'Test Division 2', 'Description', null, 0, '[]', '[]');
      // Add a staff member to the database using the proper insert statement
      db.stmt.insertStaffAgent.run('staff-002', 'Test Staff', 'member', 'div-test-2', '[]', '[]', 'active');

      const isValid = await validateIdentityForSession(db, 'staff', 'staff-002', 'claude');

      assert.strictEqual(isValid, true, 'Existing active staff identity should be valid');
    });

    it('should reject inactive staff identity for session creation', async () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      const { validateIdentityForSession } = await import('../../src/auth/index.js');

      // Add an inactive staff member
      db.stmt.insertStaffAgent.run('staff-inactive', 'Inactive Staff', 'member', 'div-test-2', '[]', '[]', 'inactive');

      const isValid = await validateIdentityForSession(db, 'staff', 'staff-inactive', 'claude');

      assert.strictEqual(isValid, false, 'Inactive staff identity should be rejected');
    });

    it('should validate division identity that exists', async () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      const { validateIdentityForSession } = await import('../../src/auth/index.js');

      // Add a division to the database
      db.stmt.insertDivision.run('div-test', 'Test Division', 'Description', null, 0, '[]', '[]');

      const isValid = await validateIdentityForSession(db, 'division', 'div-test', 'claude');

      assert.strictEqual(isValid, true, 'Existing division identity should be valid');
    });
  });

  describe('Session Token Generation Security', () => {
    it('should generate valid session token for Founder', async () => {
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-characters-long';

      const { generateSessionToken, validateSessionToken } = await import('../../src/auth/session.js');

      const token = generateSessionToken({
        owner_type: 'founder',
        owner_id: 'founder',
        runtime: 'claude',
        client_ip: '127.0.0.1'
      });

      assert.ok(token, 'Session token should be generated');
      assert.ok(token.includes('|'), 'Token should have proper format');

      const session = validateSessionToken(token);
      assert.ok(session, 'Generated token should validate');
      assert.strictEqual(session?.owner_type, 'founder');
      assert.strictEqual(session?.owner_id, 'founder');
    });

    it('should generate valid session token for Staff', async () => {
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-characters-long';

      const { generateSessionToken, validateSessionToken } = await import('../../src/auth/session.js');

      const token = generateSessionToken({
        owner_type: 'staff',
        owner_id: 'staff-001',
        runtime: 'claude',
        client_ip: '127.0.0.1'
      });

      const session = validateSessionToken(token);
      assert.ok(session, 'Generated token should validate');
      assert.strictEqual(session?.owner_type, 'staff');
      assert.strictEqual(session?.owner_id, 'staff-001');
    });

    it('should reject token without valid signature', async () => {
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-characters-long';

      // Create an invalid token with wrong signature
      const invalidToken = 'some-session-id|1234567890|some-random|invalid-signature';

      const { validateSessionToken } = await import('../../src/auth/session.js');

      const session = validateSessionToken(invalidToken);
      assert.strictEqual(session, null, 'Invalid token should be rejected');
    });
  });

  describe('Auth Middleware Behavior', () => {
    it('should reject requests without auth in production mode', async () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      const { authMiddleware, getAuthContext } = await import('../../src/auth/index.js');

      const app = express();
      app.use(express.json());
      app.use((req, res, next) => authMiddleware(req, res, next));
      app.get('/protected', (req, res) => {
        const ctx = getAuthContext(req);
        res.json({ authenticated: !!ctx });
      });

      const server = app.listen(0);

      try {
        const response = await request(server)
          .get('/protected')
          .expect(401);

        assert.strictEqual(response.body.code, 'AUTH_REQUIRED',
          'Anonymous requests should be rejected in production mode');
      } finally {
        server.close();
        delete process.env.AUTH_MODE;
        delete process.env.SESSION_SECRET;
      }
    });

    it('should require valid token in production mode', async () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      const { authMiddleware, getAuthContext, generateSessionToken } = await import('../../src/auth/index.js');

      const app = express();
      app.use(express.json());
      app.use((req, res, next) => authMiddleware(req, res, next));
      app.get('/protected', (req, res) => {
        const ctx = getAuthContext(req);
        res.json({ authenticated: !!ctx, ctx });
      });

      const server = app.listen(0);

      const token = generateSessionToken({
        owner_type: 'staff',
        owner_id: 'staff-001',
        runtime: 'claude'
      });

      try {
        const response = await request(server)
          .get('/protected')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        assert.strictEqual(response.body.authenticated, true);
        assert.strictEqual(response.body.ctx.owner_type, 'staff');
        assert.strictEqual(response.body.ctx.owner_id, 'staff-001');
      } finally {
        server.close();
        delete process.env.AUTH_MODE;
        delete process.env.SESSION_SECRET;
      }
    });

    it('should reject invalid token in production mode', async () => {
      process.env.AUTH_MODE = 'production';
      process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-at-least-32-chars-long';

      const { authMiddleware, getAuthContext } = await import('../../src/auth/index.js');

      const app = express();
      app.use(express.json());
      app.use((req, res, next) => authMiddleware(req, res, next));
      app.get('/protected', (req, res) => {
        const ctx = getAuthContext(req);
        res.json({ authenticated: !!ctx });
      });

      const server = app.listen(0);

      try {
        const response = await request(server)
          .get('/protected')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        assert.strictEqual(response.body.code, 'INVALID_SESSION');
      } finally {
        server.close();
        delete process.env.AUTH_MODE;
        delete process.env.SESSION_SECRET;
      }
    });
  });
});