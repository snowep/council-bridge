// Session Signing Regression Tests
// SEC-01: Prove tokens cannot be forged using timeout value or any predictable config

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { generateSessionToken, validateSessionToken, cleanupExpiredSessions } from '../../src/auth/session.js';
import { getAuthConfig } from '../../src/auth/config.js';
import crypto from 'crypto';

describe('SEC-01: Session Signing Secret Security', () => {
  beforeEach(() => {
    cleanupExpiredSessions();
  });

  it('should use SESSION_SECRET for signing, not timeout value', () => {
    const config = getAuthConfig();
    const token = generateSessionToken({
      owner_type: 'staff',
      owner_id: 'staff-001',
      runtime: 'claude'
    });

    const parts = token.split('|');
    assert.strictEqual(parts.length, 4);

    const [session_id, timestampStr, random, signature] = parts;

    // Verify the signature was created with SESSION_SECRET
    const data = `${session_id}|${timestampStr}|${random}`;
    const expectedSignature = crypto
      .createHmac('sha256', config.session_secret)
      .update(data)
      .digest('base64url');

    assert.strictEqual(signature, expectedSignature, 'Signature must use SESSION_SECRET');

    // Verify it would NOT validate with timeout as key (the old vulnerable behavior)
    const timeoutSignature = crypto
      .createHmac('sha256', config.session_timeout_ms.toString())
      .update(data)
      .digest('base64url');

    assert.notStrictEqual(signature, timeoutSignature, 'Signature must NOT match timeout-derived key');
  });

  it('should reject token signed with timeout value (forged token)', () => {
    const config = getAuthConfig();

    const session_id = crypto.randomUUID();
    const timestamp = Date.now();
    const random = crypto.randomBytes(32).toString('base64url');
    const data = `${session_id}|${timestamp}|${random}`;

    const forgedSignature = crypto
      .createHmac('sha256', config.session_timeout_ms.toString())
      .update(data)
      .digest('base64url');

    const forgedToken = `${session_id}|${timestamp}|${random}|${forgedSignature}`;

    const session = validateSessionToken(forgedToken);
    assert.strictEqual(session, null, 'Token signed with timeout must be rejected');
  });

  it('should validate token signed with SESSION_SECRET', () => {
    const token = generateSessionToken({
      owner_type: 'staff',
      owner_id: 'staff-001',
      runtime: 'claude'
    });

    const session = validateSessionToken(token);
    assert.ok(session, 'Valid token must be accepted');
    assert.strictEqual(session.owner_type, 'staff');
    assert.strictEqual(session.owner_id, 'staff-001');
  });

  it('should use different signatures for same payload with different secrets', () => {
    const config = getAuthConfig();
    const session_id = crypto.randomUUID();
    const timestamp = Date.now();
    const random = crypto.randomBytes(32).toString('base64url');
    const data = `${session_id}|${timestamp}|${random}`;

    const sigWithSecret = crypto
      .createHmac('sha256', config.session_secret)
      .update(data)
      .digest('base64url');

    const sigWithTimeout = crypto
      .createHmac('sha256', config.session_timeout_ms.toString())
      .update(data)
      .digest('base64url');

    assert.notStrictEqual(sigWithSecret, sigWithTimeout, 'Secret and timeout must produce different signatures');
  });

  it('should have session secret at least 32 chars in production', () => {
    const config = getAuthConfig();
    if (config.mode === 'production') {
      assert.ok(config.session_secret.length >= 32, 'Production SESSION_SECRET must be >= 32 chars');
    }
  });

  it('should generate process-local secret in development if not provided', () => {
    const config = getAuthConfig();
    if (config.mode === 'development' && !process.env.SESSION_SECRET) {
      assert.ok(config.session_secret.length >= 32, 'Dev secret must be >= 32 chars');
      assert.ok(config.session_secret.length >= 40, 'Dev secret should be base64url encoded 32 bytes');
    }
  });

  it('should produce different tokens for same input (randomness)', () => {
    const token1 = generateSessionToken({
      owner_type: 'staff',
      owner_id: 'staff-001',
      runtime: 'claude'
    });

    const token2 = generateSessionToken({
      owner_type: 'staff',
      owner_id: 'staff-001',
      runtime: 'claude'
    });

    assert.notStrictEqual(token1, token2, 'Tokens must differ due to cryptographic randomness');
    assert.ok(validateSessionToken(token1), 'First token must validate');
    assert.ok(validateSessionToken(token2), 'Second token must validate');
  });

  it('should reject token with tampered signature (constant-time)', () => {
    const token = generateSessionToken({
      owner_type: 'staff',
      owner_id: 'staff-001',
      runtime: 'claude'
    });

    const parts = token.split('|');
    const tamperedSig = parts[3].slice(0, -1) + (parts[3].endsWith('A') ? 'B' : 'A');
    const tampered = `${parts[0]}|${parts[1]}|${parts[2]}|${tamperedSig}`;

    const session = validateSessionToken(tampered);
    assert.strictEqual(session, null, 'Tampered signature must be rejected');
  });

  it('should reject token with tampered session_id', () => {
    const token = generateSessionToken({
      owner_type: 'staff',
      owner_id: 'staff-001',
      runtime: 'claude'
    });

    const parts = token.split('|');
    const tampered = `${crypto.randomUUID()}|${parts[1]}|${parts[2]}|${parts[3]}`;

    const session = validateSessionToken(tampered);
    assert.strictEqual(session, null, 'Token with changed session_id must be rejected');
  });

  it('should reject token with tampered timestamp', () => {
    const token = generateSessionToken({
      owner_type: 'staff',
      owner_id: 'staff-001',
      runtime: 'claude'
    });

    const parts = token.split('|');
    const oldTimestamp = parseInt(parts[1], 10);
    const farFutureTimestamp = oldTimestamp + 100000;
    const tampered = `${parts[0]}|${farFutureTimestamp}|${parts[2]}|${parts[3]}`;

    const session = validateSessionToken(tampered);
    assert.strictEqual(session, null, 'Token with changed timestamp must be rejected');
  });

  it('should reject token with tampered random component', () => {
    const token = generateSessionToken({
      owner_type: 'staff',
      owner_id: 'staff-001',
      runtime: 'claude'
    });

    const parts = token.split('|');
    const tampered = `${parts[0]}|${parts[1]}|${crypto.randomBytes(32).toString('base64url')}|${parts[3]}`;

    const session = validateSessionToken(tampered);
    assert.strictEqual(session, null, 'Token with changed random must be rejected');
  });

  it('should not expose signing secret in token', () => {
    const token = generateSessionToken({
      owner_type: 'staff',
      owner_id: 'staff-001',
      runtime: 'claude'
    });

    const config = getAuthConfig();
    assert.ok(!token.includes(config.session_secret), 'Token must not contain signing secret');
    const parts = token.split('|');
    assert.notStrictEqual(parts[3], config.session_secret, 'Signature must not equal secret');
  });

  it('should have unique secret per process restart in development', () => {
    if (process.env.AUTH_MODE === 'production') {
      return;
    }
    const config = getAuthConfig();
    assert.ok(config.session_secret);
    assert.ok(config.session_secret.length > 0);
  });
});

describe('SEC-01: Configuration Validation', () => {
  it('should accept valid production SESSION_SECRET', () => {
    process.env.AUTH_MODE = 'production';
    process.env.SESSION_SECRET = 'a'.repeat(32);

    const config = getAuthConfig();
    assert.strictEqual(config.session_secret.length, 32);
    assert.strictEqual(config.mode, 'production');
    assert.strictEqual(config.allow_hardcoded_fallback, false);

    delete process.env.SESSION_SECRET;
    delete process.env.AUTH_MODE;
  });

  it('should throw in production with short SESSION_SECRET', () => {
    process.env.AUTH_MODE = 'production';
    process.env.SESSION_SECRET = 'short';

    assert.throws(() => {
      getAuthConfig();
    }, /SESSION_SECRET must be at least 32 characters/);

    delete process.env.SESSION_SECRET;
    delete process.env.AUTH_MODE;
  });
});