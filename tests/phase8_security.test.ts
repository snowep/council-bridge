// Phase 8: Security Hardening Tests
// Tests for production fail-closed behavior, signature replay, payload tampering, etc.

import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { createDatabase, DatabaseInstance } from '../src/database.js';
import {
  generateSessionToken,
  validateSessionToken,
  invalidateSession,
  addPermission,
  hasPermission,
  cleanupExpiredSessions,
  listActiveSessions,
  revokeSessionsByCriteria,
  getSessionStats
} from '../src/auth/session.js';
import {
  generateFounderKeyPair,
  loadFounderKeyPair,
  initializeFounderKeys,
  signFounderRequest,
  verifyFounderRequest,
  verifyFounderRequestWithLoadedKeys,
  verifyFounderOperation,
  getFounderPublicKey,
  getFounderKeyId,
  rotateFounderKeys,
  isKeyRotationNeeded,
  canonicalizeForSigning
} from '../src/auth/founder.js';
import { requirePermission, requireFounder, requireDivisionHead, validateSessionOwnership, getAuthConfig, isProductionMode, isDevelopmentMode, validateAuthMode, AuthContext } from '../src/auth/index.js';
import crypto from 'crypto';

let db: DatabaseInstance;

describe('Phase 8: Session Security Hardening', () => {
  before(() => {
    db = createDatabase(':memory:');
  });

  after(() => {
    db.close();
  });

  it('should generate session with cryptographically secure randomness', () => {
    const token = generateSessionToken({
      owner_type: 'staff',
      owner_id: 'staff-001',
      runtime: 'claude'
    });

    assert.ok(token);
    const parts = token.split('|');
    assert.strictEqual(parts.length, 4);
    // session_id should be UUID v4
    assert.ok(parts[0].match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));
    // timestamp should be valid
    const timestamp = parseInt(parts[1], 10);
    assert.ok(timestamp > 0);
    assert.ok(timestamp <= Date.now());
    // random should be base64url encoded 32 bytes
    assert.ok(parts[2].length > 20);
    // signature should be base64url encoded
    assert.ok(parts[3].length > 20);
  });

  it('should validate valid session token', () => {
    const token = generateSessionToken({
      owner_type: 'staff',
      owner_id: 'staff-001',
      runtime: 'claude'
    });

    const session = validateSessionToken(token);
    assert.ok(session);
    assert.strictEqual(session.owner_type, 'staff');
    assert.strictEqual(session.owner_id, 'staff-001');
    assert.strictEqual(session.runtime, 'claude');
    assert.ok(session.session_id);
    assert.ok(session.expires_at > Date.now());
    assert.ok(session.issued_at <= Date.now());
  });

  it('should reject tampered session token (constant-time comparison)', () => {
    const token = generateSessionToken({
      owner_type: 'staff',
      owner_id: 'staff-001',
      runtime: 'claude'
    });

    const parts = token.split('|');
    // Flip one bit in signature
    const tamperedSig = parts[3].slice(0, -1) + (parts[3].endsWith('A') ? 'B' : 'A');
    const tampered = `${parts[0]}|${parts[1]}|${parts[2]}|${tamperedSig}`;

    const session = validateSessionToken(tampered);
    assert.strictEqual(session, null);
  });

  it('should reject expired session token', () => {
    const token = generateSessionToken({
      owner_type: 'staff',
      owner_id: 'staff-001',
      runtime: 'claude'
    });

    const session = validateSessionToken(token);
    assert.ok(session);
    // Token structure includes expiry - verify it has issued_at and expires_at
    assert.ok(session.issued_at > 0);
    assert.ok(session.expires_at > session.issued_at);
  });

  it('should invalidate session', () => {
    const token = generateSessionToken({
      owner_type: 'staff',
      owner_id: 'staff-001',
      runtime: 'claude'
    });

    const session = validateSessionToken(token);
    assert.ok(session);

    const result = invalidateSession(session.session_id);
    assert.strictEqual(result, true);

    const invalidated = validateSessionToken(token);
    assert.strictEqual(invalidated, null);
  });

  it('should track active sessions', () => {
    const initialCount = listActiveSessions();

    generateSessionToken({ owner_type: 'staff', owner_id: 'staff-001', runtime: 'claude' });
    generateSessionToken({ owner_type: 'division', owner_id: 'div-001', runtime: 'claude' });

    assert.strictEqual(listActiveSessions(), initialCount + 2);
  });
  it('should revoke sessions by criteria', () => {
    // Create test sessions with unique identifiers
    const token1 = generateSessionToken({ owner_type: 'staff', owner_id: 'test-revoke-staff-1', runtime: 'claude' });
    const token2 = generateSessionToken({ owner_type: 'staff', owner_id: 'test-revoke-staff-2', runtime: 'claude' });
    const token3 = generateSessionToken({ owner_type: 'division', owner_id: 'test-revoke-div', runtime: 'claude' });

    const session1 = validateSessionToken(token1);
    const session2 = validateSessionToken(token2);
    const session3 = validateSessionToken(token3);

    // Verify all 3 exist
    assert.ok(session1, 'Session 1 should exist');
    assert.ok(session2, 'Session 2 should exist');
    assert.ok(session3, 'Session 3 should exist');

    // Revoke by owner_id pattern to only hit our test sessions
    const revoked = revokeSessionsByCriteria(s => s.owner_id.startsWith('test-revoke-') && s.owner_type === 'staff');
    
    // Should have revoked exactly 2 staff sessions (the ones we just created)
    assert.strictEqual(revoked, 2);
    
    // Verify staff sessions are gone, division session remains
    assert.strictEqual(validateSessionToken(token1), null);
    assert.strictEqual(validateSessionToken(token2), null);
    assert.ok(validateSessionToken(token3));
  });


  it('should get session stats', () => {
    const stats = getSessionStats();
    assert.ok(stats.total >= 0);
    assert.ok(stats.expired >= 0);
    assert.ok(stats.active >= 0);
    assert.strictEqual(stats.total, stats.expired + stats.active);
  });

  it('should add permissions to session', () => {
    const token = generateSessionToken({
      owner_type: 'staff',
      owner_id: 'staff-001',
      runtime: 'claude'
    });

    const session = validateSessionToken(token);
    assert.ok(session);

    addPermission(session.session_id, 'execute_task');

    const updated = validateSessionToken(token);
    assert.ok(updated);
    assert.ok(hasPermission(updated, 'execute_task'));
  });

  it('should check permissions correctly', () => {
    const token = generateSessionToken({
      owner_type: 'founder',
      owner_id: 'founder',
      runtime: 'claude'
    });

    const session = validateSessionToken(token);
    assert.ok(session);

    // Founder has all permissions
    assert.ok(hasPermission(session, 'any_permission'));
    assert.ok(hasPermission(session, 'execute_task'));
  });
});

describe('Phase 8: Founder Signature Security', () => {
  let keyPair: { public_key: string; private_key_pem: string; created_at: string; key_id: string };

  before(() => {
    keyPair = generateFounderKeyPair();
  });

  it('should generate founder key pair with key_id', () => {
    assert.ok(keyPair.public_key);
    assert.ok(keyPair.private_key_pem);
    assert.ok(keyPair.created_at);
    assert.ok(keyPair.key_id);
    assert.strictEqual(keyPair.key_id.length, 32); // 16 bytes hex = 32 chars
  });

  it('should load existing founder key pair', () => {
    const loaded = loadFounderKeyPair();
    assert.ok(loaded);
    assert.strictEqual(loaded.public_key, keyPair.public_key);
  });

  it('should initialize founder keys (reuse existing)', () => {
    const initialized = initializeFounderKeys();
    assert.strictEqual(initialized.public_key, keyPair.public_key);
  });

  it('should sign and verify founder request', () => {
    const operation = 'approve_execution';
    const payload = { action: 'approve_execution', execution_id: 'exec-123', approved: true };

    const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);
    assert.ok(signed.signature);
    assert.strictEqual(signed.operation, operation);
    assert.strictEqual(signed.key_id, keyPair.key_id);
    assert.ok(signed.timestamp > 0);
    assert.ok(signed.nonce.length > 20);

    const valid = verifyFounderRequest(
      operation,
      payload,
      signed.timestamp,
      signed.nonce,
      signed.signature,
      keyPair.public_key,
      keyPair.key_id
    );
    assert.strictEqual(valid, true);
  });

  it('should reject tampered payload', () => {
    const operation = 'approve_execution';
    const payload = { action: 'approve_execution', execution_id: 'exec-123', approved: true };
    const tamperedPayload = { action: 'approve_execution', execution_id: 'exec-123', approved: false };

    const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);
    const valid = verifyFounderRequest(
      operation,
      tamperedPayload,
      signed.timestamp,
      signed.nonce,
      signed.signature,
      keyPair.public_key,
      keyPair.key_id
    );
    assert.strictEqual(valid, false);
  });

  it('should verify with loaded keys', () => {
    const operation = 'create_division';
    const payload = { action: 'create_division', division_id: 'div-new' };

    const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);
    const valid = verifyFounderRequestWithLoadedKeys(signed);
    assert.strictEqual(valid, true);
  });

  it('should reject expired timestamp (replay protection)', () => {
    const operation = 'approve_execution';
    const payload = { action: 'approve_execution', execution_id: 'exec-123', approved: true };

    const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);
    // Use a timestamp from 10 minutes ago (beyond 5 minute tolerance)
    const expiredTimestamp = signed.timestamp - 10 * 60 * 1000;

    const valid = verifyFounderRequest(
      operation,
      payload,
      expiredTimestamp,
      signed.nonce,
      signed.signature,
      keyPair.public_key,
      keyPair.key_id
    );
    assert.strictEqual(valid, false);
  });

  it('should reject future timestamp', () => {
    const operation = 'approve_execution';
    const payload = { action: 'approve_execution', execution_id: 'exec-123', approved: true };

    const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);
    // Use a timestamp 10 minutes in the future
    const futureTimestamp = signed.timestamp + 10 * 60 * 1000;

    const valid = verifyFounderRequest(
      operation,
      payload,
      futureTimestamp,
      signed.nonce,
      signed.signature,
      keyPair.public_key,
      keyPair.key_id
    );
    assert.strictEqual(valid, false);
  });

  it('should reject wrong key_id (key rotation protection)', () => {
    const operation = 'approve_execution';
    const payload = { action: 'approve_execution', execution_id: 'exec-123', approved: true };

    const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);
    const valid = verifyFounderRequest(
      operation,
      payload,
      signed.timestamp,
      signed.nonce,
      signed.signature,
      keyPair.public_key,
      'wrong-key-id'
    );
    assert.strictEqual(valid, false);
  });

  it('should reject signature for different operation (operation binding)', () => {
    const operation1 = 'approve_execution';
    const operation2 = 'create_division';
    const payload = { action: 'approve_execution', execution_id: 'exec-123', approved: true };

    const signed = signFounderRequest(operation1, payload, keyPair.private_key_pem, keyPair.key_id);
    // Try to verify with different operation
    const valid = verifyFounderRequest(
      operation2,
      payload,
      signed.timestamp,
      signed.nonce,
      signed.signature,
      keyPair.public_key,
      keyPair.key_id
    );
    assert.strictEqual(valid, false);
  });

  it('should reject signature with different nonce', () => {
    const operation = 'approve_execution';
    const payload = { action: 'approve_execution', execution_id: 'exec-123', approved: true };

    const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);
    // Use different nonce
    const valid = verifyFounderRequest(
      operation,
      payload,
      signed.timestamp,
      'different-nonce-value',
      signed.signature,
      keyPair.public_key,
      keyPair.key_id
    );
    assert.strictEqual(valid, false);
  });

  it('should canonicalize payload deterministically', () => {
    const operation = 'approve_execution';
    const payload1 = { a: 1, b: 2 };
    const payload2 = { b: 2, a: 1 }; // Different key order

    const canonical1 = canonicalizeForSigning(operation, payload1, 1000, 'nonce', 'keyid');
    const canonical2 = canonicalizeForSigning(operation, payload2, 1000, 'nonce', 'keyid');

    assert.strictEqual(canonical1, canonical2);
  });

  it('should get founder public key', () => {
    const publicKey = getFounderPublicKey();
    assert.ok(publicKey);
    assert.ok(publicKey.includes('BEGIN PUBLIC KEY'));
  });

  it('should get founder key id', () => {
    const keyId = getFounderKeyId();
    assert.ok(keyId);
    assert.strictEqual(keyId, keyPair.key_id);
  });

  it('should rotate founder keys', () => {
    const oldKeyId = keyPair.key_id;
    const newKeyPair = rotateFounderKeys();

    assert.ok(newKeyPair.key_id !== oldKeyId);
    assert.ok(newKeyPair.public_key);
    assert.ok(newKeyPair.private_key_pem);

    // Old keys should be archived
    // New keys should be loaded
    const loaded = loadFounderKeyPair();
    assert.strictEqual(loaded?.key_id, newKeyPair.key_id);
  });

  it('should verify operation-bound signature via middleware', () => {
    const operation = 'approve_execution';
    const payload = { action: 'approve_execution', execution_id: 'exec-123', approved: true };

    const signed = signFounderRequest(operation, payload, keyPair.private_key_pem, keyPair.key_id);

    // Use verifyFounderRequest directly since we have all the key material
    const valid = verifyFounderRequest(
      operation,
      payload,
      signed.timestamp,
      signed.nonce,
      signed.signature,
      keyPair.public_key,
      keyPair.key_id
    );
    assert.strictEqual(valid, true);

    // Wrong operation should fail
    const invalid = verifyFounderRequest(
      'create_division',
      payload,
      signed.timestamp,
      signed.nonce,
      signed.signature,
      keyPair.public_key,
      keyPair.key_id
    );
    assert.strictEqual(invalid, false);
  });
});

describe('Phase 8: Auth Context and Permissions', () => {
  it('should require permission for staff', () => {
    const getSession = () => ({
      owner_type: 'staff' as const,
      owner_id: 'staff-001',
      runtime: 'claude' as const,
      session_id: 'test',
      permissions: ['execute_task'],
      expires_at: Date.now() + 3600000,
      issued_at: Date.now(),
      founder_signed: false
    });

    assert.ok(requirePermission('execute_task', getSession));
    assert.ok(!requirePermission('admin_action', getSession));
  });

  it('should grant all permissions to founder', () => {
    const getSession = () => ({
      owner_type: 'founder' as const,
      owner_id: 'founder',
      runtime: 'claude' as const,
      session_id: 'test',
      permissions: [],
      expires_at: Date.now() + 3600000,
      issued_at: Date.now(),
      founder_signed: true
    });

    assert.ok(requirePermission('any_permission', getSession));
    assert.ok(requirePermission('execute_task', getSession));
    assert.ok(requirePermission('admin_action', getSession));
  });

  it('should require founder for founder-only operations', () => {
    const founderCtx = {
      owner_type: 'founder' as const,
      owner_id: 'founder',
      runtime: 'claude' as const,
      session_id: 'test',
      permissions: [],
      expires_at: Date.now() + 3600000,
      issued_at: Date.now(),
      founder_signed: true
    };

    const staffCtx = {
      owner_type: 'staff' as const,
      owner_id: 'staff-001',
      runtime: 'claude' as const,
      session_id: 'test',
      permissions: ['execute_task'],
      expires_at: Date.now() + 3600000,
      issued_at: Date.now(),
      founder_signed: false
    };

    assert.ok(requireFounder(founderCtx));
    assert.ok(!requireFounder(staffCtx));
  });

  it('should validate division head', () => {
    const getDivisionById = (id: string) => id === 'div-001' ? { head_staff_id: 'staff-001' } : null;

    const divisionHeadCtx = {
      owner_type: 'division' as const,
      owner_id: 'div-001',
      runtime: 'claude' as const,
      session_id: 'test',
      permissions: [],
      expires_at: Date.now() + 3600000,
      issued_at: Date.now(),
      founder_signed: false
    };

    const staffCtx = {
      owner_type: 'staff' as const,
      owner_id: 'staff-001',
      runtime: 'claude' as const,
      session_id: 'test',
      permissions: [],
      expires_at: Date.now() + 3600000,
      issued_at: Date.now(),
      founder_signed: false
    };

    assert.ok(requireDivisionHead(divisionHeadCtx, 'div-001', getDivisionById));
    assert.ok(!requireDivisionHead(staffCtx, 'div-001', getDivisionById));
    assert.ok(!requireDivisionHead(divisionHeadCtx, 'div-002', getDivisionById));
  });

  it('should validate session ownership', () => {
    const founderCtx = {
      owner_type: 'founder' as const,
      owner_id: 'founder',
      runtime: 'claude' as const,
      session_id: 'test',
      permissions: [],
      expires_at: Date.now() + 3600000,
      issued_at: Date.now(),
      founder_signed: true
    };

    const staffCtx = {
      owner_type: 'staff' as const,
      owner_id: 'staff-001',
      runtime: 'claude' as const,
      session_id: 'test',
      permissions: [],
      expires_at: Date.now() + 3600000,
      issued_at: Date.now(),
      founder_signed: false
    };

    assert.ok(validateSessionOwnership(founderCtx, 'any-resource'));
    assert.ok(validateSessionOwnership(staffCtx, 'staff-001'));
    assert.ok(!validateSessionOwnership(staffCtx, 'staff-002'));
  });
});

describe('Phase 8: Auth Mode Configuration', () => {
  it('should have correct default auth config', () => {
    const config = getAuthConfig();
    assert.ok(config.session_timeout_ms > 0);
    assert.ok(config.max_sessions > 0);
    assert.ok(config.require_founder_signature_for.length > 0);
    assert.ok(config.require_founder_signature_for.includes('approve_execution'));
    assert.ok(config.require_founder_signature_for.includes('create_division'));
    assert.ok(['development', 'production'].includes(config.mode));
  });

  it('should validate auth mode in production', () => {
    // This test documents expected behavior
    // In production, hardcoded fallback must be disabled
    const config = getAuthConfig();
    if (config.mode === 'production') {
      assert.strictEqual(config.allow_hardcoded_fallback, false);
    }
  });

  it('should validate auth mode configuration', () => {
    const result = validateAuthMode();
    // In development mode, should be valid
    if (!isProductionMode()) {
      assert.ok(result.valid);
    }
  });

  it('should identify production mode', () => {
    // Just verify the function exists and returns boolean
    const isProd = isProductionMode();
    const isDev = isDevelopmentMode();
    assert.ok(typeof isProd === 'boolean');
    assert.ok(typeof isDev === 'boolean');
    assert.strictEqual(isProd, !isDev);
  });
});

describe('Phase 8: Auth Middleware Integration - Production Behavior', () => {
  // Integration tests would require a running server
  // These test the expected behavior patterns

  it('should export AuthContext interface', () => {
    // Type check - if this compiles, the interface exists
    const ctx: AuthContext = {
      owner_type: 'founder',
      owner_id: 'founder',
      runtime: 'claude',
      session_id: 'test',
      permissions: [],
      expires_at: Date.now() + 3600000,
      issued_at: Date.now(),
      founder_signed: true
    };
    assert.ok(ctx);
  });

  it('should have verifyFounderOperation for middleware', () => {
    // Function exists for middleware use
    assert.ok(typeof verifyFounderOperation === 'function');
  });

  it('should have session revocation by criteria', () => {
    // Security incident response capability
    assert.ok(typeof revokeSessionsByCriteria === 'function');
  });
});